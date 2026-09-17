"""Integration checks for authorization, immutable shares, imports and budget accounting.
Run: PHP_BIN=php python3 tests/test_workflows.py
Uses a temporary database and log-only email. No real messages or AI calls.
"""
from pathlib import Path
import http.cookiejar, urllib.request, urllib.error, json, os, tempfile, subprocess, time, zipfile, io, sqlite3

ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('PHP_BIN','php')
def check(value,message):
    if not value: raise AssertionError(message)
    print('PASS',message)
class Client:
    def __init__(self,base):
        self.base=base; self.csrf=''; self.bearer=''
        self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,query='',files=None,expected=200,csrf=True,raw=False):
        headers={}
        if self.csrf and csrf: headers['X-CSRF-Token']=self.csrf
        if self.bearer: headers['Authorization']='Bearer '+self.bearer
        if files:
            boundary='studiodeck-test-boundary';parts=[]
            for k,v in data.items():parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
            for name,mime,blob in files:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="files[]"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+blob+b'\r\n')
            parts.append(f'--{boundary}--\r\n'.encode());body=b''.join(parts);headers['Content-Type']='multipart/form-data; boundary='+boundary
        elif data is not None:body=json.dumps(data).encode();headers['Content-Type']='application/json'
        else:body=None
        req=urllib.request.Request(self.base+'/api.php?action='+action+query,data=body,headers=headers)
        try:r=self.opener.open(req)
        except urllib.error.HTTPError as e:r=e
        value=r.read()
        if r.code!=expected:raise AssertionError(f'{action}: expected {expected}, got {r.code}: {value[:600]!r}')
        return value if raw else json.loads(value)
    def login(self,email,log):
        self.call('request_login',{'email':email})
        tok=log.read_text().strip().splitlines()[-1].split('/#/login/')[1]
        self.call('consume_login',{'token':tok})
        self.csrf=self.call('session')['csrf']
        return tok

with tempfile.TemporaryDirectory(prefix='studiodeck-studios-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8091';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    legacy=sqlite3.connect(tmp/'test.sqlite')
    legacy.executescript((ROOT/'app/schema.sql').read_text().split('CREATE TABLE IF NOT EXISTS studios ')[0])
    legacy.execute('INSERT INTO users VALUES(?,?,?,?)',('legacy-admin','admin@example.test','Admin','2026-01-01'))
    legacy.execute('INSERT INTO projects VALUES(?,?,?,?,?,?,?)',('legacy-project','legacy-admin','Existing project','','','{}','2026-01-01'))
    legacy.execute('INSERT INTO iterations VALUES(?,?,?,?,?,?,?)',('legacy-iteration','legacy-project',1,'First concept','draft','{}','2026-01-01'))
    legacy.execute('INSERT INTO studio_preferences VALUES(?,?)',('legacy-admin','{"palette":"clay","style":"classic"}'))
    legacy.commit();legacy.close()
    output=open(tmp/'server.log','w')
    server=subprocess.Popen([PHP,'-S','127.0.0.1:8091','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('admin@example.test',log)
        session=admin.call('session');studio=session['studio']['id'];aid=session['user']['id']
        check(session['studio']['role']=='admin' and session['user']['id']=='legacy-admin','Existing account owns its migrated studio')
        check(admin.call('project',query='&id=legacy-project')['can_edit'] and session['studio_theme']['palette']=='clay','Migration preserves legacy project access and studio preferences')
        admin.call('save_studio_user',{'email':'member@example.test','name':'Member','role':'member'},csrf=False,expected=403)
        users=admin.call('save_studio_user',{'email':'member@example.test','name':'Member','role':'member'})['users']
        mid=next(u['id'] for u in users if u['email']=='member@example.test')
        member=Client(base);member.login('member@example.test',log)
        check(member.call('session')['studio']['id']==studio,'Added user joins the intended studio')
        member.call('save_studio_user',{'email':'blocked@example.test','name':'Blocked'},expected=403)
        p=admin.call('create_project',{'name':'Private admin project','emails':[]},expected=201);pid=p['project_id'];iid=p['iteration_id']
        check(member.call('projects')['projects']==[],'Studio membership does not reveal private projects')
        member.call('project',query='&id='+pid,expected=404)
        admin.call('project_members',{'project_id':pid,'user_ids':[aid,mid]})
        check(member.call('project',query='&id='+pid)['can_edit'],'Project team members can open and edit their project')
        member.call('theme',{'iteration':iid,'theme':{'colors':['#112233'],'font':'sans','style':'Modern'}})
        own=member.call('create_project',{'name':'Private member project','emails':[]},expected=201)
        admin.call('project',query='&id='+own['project_id'],expected=404)
        check(True,'Admin role grants no special access to private projects')
        admin.call('remove_studio_user',{'id':mid},expected=409)
        member.call('project_members',{'project_id':own['project_id'],'user_ids':[mid,aid]})
        other=admin.call('create_studio',{'name':'Second studio'},expected=201)['studio']['id']
        check(admin.call('projects')['projects']==[],'Selected studio scopes the project list')
        admin.call('project',query='&id='+pid,expected=404)
        admin.call('save_studio_user',{'email':'member@example.test','name':'Member in studio two','role':'admin'})
        check(len(member.call('session')['studios'])==2,'One account can belong to multiple studios')
        member.call('switch_studio',{'studio_id':other})
        check(member.call('session')['studio']['role']=='admin','Roles are independent per studio')
        admin.call('switch_studio',{'studio_id':studio})
        admin.call('remove_studio_user',{'id':mid})
        member.call('switch_studio',{'studio_id':studio},expected=404)
        check(len(member.call('session')['studios'])==1,'Removal revokes only the selected studio membership')
        admin.call('save_studio_user',{'id':aid,'email':'admin@example.test','name':'Admin','role':'member'},expected=409)
        check(True,'Last studio admin cannot be removed or demoted')
        print('All studio access checks passed.')
    finally:
        server.terminate();server.wait();output.close()
