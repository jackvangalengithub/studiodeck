"""Explicit iteration locks, editable sharing and activity pagination.
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
        self.base=base; self.csrf=''; self.share_id=''
        self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,query='',files=None,expected=200,csrf=True,raw=False):
        headers={}
        if self.csrf and csrf: headers['X-CSRF-Token']=self.csrf
        if self.share_id: headers['Authorization']='Client '+self.share_id
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

with tempfile.TemporaryDirectory(prefix='studiodeck-lock-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8089';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    # Start with the previous schema to exercise migration for existing shared iterations.
    with sqlite3.connect(tmp/'test.sqlite') as db:
        db.executescript((ROOT/'app/schema.sql').read_text().replace('locked INTEGER NOT NULL DEFAULT 0, ',''))
    output=open(tmp/'server.log','w')
    server=subprocess.Popen([PHP,'-S','127.0.0.1:8089','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        owner=Client(base)
        for _ in range(60):
            try:owner.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        owner.login('designer@example.test',log)
        made=owner.call('create_project',{'name':'Editable client presentation'},expected=201)
        pid,iid=made['project_id'],made['iteration_id']
        def deck(page=0):return owner.call('project',query=f'&id={pid}&iteration={iid}&events_page={page}')
        check(deck()['iteration']['locked']==0,'Existing database receives an unlocked iteration column')
        owner.call('save_budget',{'iteration':iid,'label':'Lighting','amount':'100','is_optional':True})
        budget=deck()['budget'][0]['id']
        link=owner.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0]
        client=Client(base);client.login('client@example.test',log);client.share_id=link['id']
        style={'style':'Modern','font':'sans','colors':['#123456']}
        owner.call('theme',{'iteration':iid,'theme':style})
        owner.call('save_slide',{'iteration':iid,'slide_id':'intro','title':'Updated after sharing'})
        owner.call('save_budget',{'iteration':iid,'id':budget,'label':'Lighting','amount':'125','is_optional':True})
        client.call('budget_choice',{'iteration':iid,'id':budget,'selected':True})
        check(client.call('deck')['project']['theme']['font']=='sans' and client.call('deck')['total_cents']==12500,'Shared links reflect style and budget edits until explicitly locked')
        owner.call('upload',{'iteration':iid},files=[('budget.csv','text/csv',b'label,amount\nTable,20\n')],expected=201)
        owner.call('lock_iteration',{'iteration':iid},expected=409)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        check(all(j['status']=='done' for j in deck()['jobs']),'Shared unlocked iterations accept uploads and background processing')
        owner.call('lock_iteration',{'iteration':iid},csrf=False,expected=403)
        stranger=Client(base);stranger.login('stranger@example.test',log)
        stranger.call('lock_iteration',{'iteration':iid},expected=404)
        owner.call('save_studio_user',{'email':'observer@example.test','name':'Observer'})
        owner.call('project_settings',{'project_id':pid,'visibility':'public','tags':[],'deadline':''})
        observer=Client(base);observer.login('observer@example.test',log)
        observer.call('lock_iteration',{'iteration':iid},expected=403)
        owner.call('project_members',{'project_id':pid,'user_ids':[owner.call('session')['user']['id'],observer.call('session')['user']['id']]})
        check(observer.call('project',query='&id='+pid)['can_edit'],'Non-admin fixture belongs to the project team')
        observer.call('lock_iteration',{'iteration':iid,'locked':True},expected=403)
        owner.call('lock_iteration',{'iteration':iid,'locked':'false'},expected=400)
        owner.call('lock_iteration',{'iteration':iid})
        owner.call('lock_iteration',{'iteration':iid})
        check(deck()['iteration']['locked']==1,'Only studio admins on the team can lock; repeated locking is harmless')
        for action,data in [('theme',{'theme':style}),('save_slide',{'slide_id':'intro','title':'Blocked'}),('save_budget',{'label':'Blocked','amount':'99'}),('slide_layout',{'slide_id':'intro','operation':'hide'}),('budget_choice',{'id':budget,'selected':False}),('category',{'asset_id':deck()['files'][0]['asset_id'],'category':'other'}),('reprocess',{'version_id':deck()['files'][0]['id']})]:
            owner.call(action,{'iteration':iid,**data},expected=409)
        owner.call('upload',{'iteration':iid},files=[('budget.csv','text/csv',b'label,amount\nBlocked,30\n')],expected=409)
        client.call('budget_choice',{'iteration':iid,'id':budget,'selected':False},expected=409)
        client.call('comment',{'iteration':iid,'slide':'intro','body':'Feedback is still available.'})
        owner.call('share',{'iteration':iid,'emails':['client@example.test']})
        check(deck()['iteration']['locked']==1,'Lock blocks changes while feedback and sharing remain available')
        observer.call('lock_iteration',{'iteration':iid,'locked':False},expected=403)
        stranger.call('lock_iteration',{'iteration':iid,'locked':False},expected=404)
        owner.call('lock_iteration',{'iteration':iid,'locked':False},csrf=False,expected=403)
        owner.call('lock_iteration',{'iteration':iid,'locked':False})
        owner.call('lock_iteration',{'iteration':iid,'locked':False})
        owner.call('theme',{'iteration':iid,'theme':style})
        observer.call('save_slide',{'iteration':iid,'slide_id':'intro','title':'Editable again'})
        client.call('budget_choice',{'iteration':iid,'id':budget,'selected':False})
        check(deck()['iteration']['locked']==0 and any(e['type']=='iteration_unlocked' for e in deck()['events']),'Admin unlock restores team and client edits and records activity')
        owner.call('lock_iteration',{'iteration':iid,'locked':True})
        new=owner.call('new_iteration',{'iteration':iid,'title':'Next concept'},expected=201)['id']
        owner.call('theme',{'iteration':new,'theme':{'style':'Next concept'}})
        check(client.call('deck')['project']['theme']['font']=='sans','A new editable iteration keeps the locked client presentation unchanged')
        # More than the previous 80-entry cutoff, all with tied timestamps.
        with sqlite3.connect(tmp/'test.sqlite') as db:
            db.execute('DELETE FROM events WHERE project_id=?',(pid,))
            db.executemany('INSERT INTO events (id,project_id,iteration_id,actor,type,detail,created_at) VALUES (?,?,?,?,?,?,?)',[(f'event-{n}',pid,iid,'Tester','test',str(n),'2026-09-18T12:00:00Z') for n in range(105)])
        pages=[deck(n) for n in range(6)]
        check([len(p['events']) for p in pages]==[20,20,20,20,20,5],'Activity uses 20 entries per page including history beyond the former cutoff')
        check([e['id'] for p in pages for e in p['events']]==[f'event-{n}' for n in reversed(range(105))],'Activity ordering is stable without missing or duplicate entries')
        check(deck(-1)['events_pagination']['page']==0 and deck(999)['events_pagination']['page']==5,'Activity page bounds are clamped')
        check('events_pagination' not in client.call('deck'),'Client payload keeps studio activity private')
        print('All iteration lock and activity checks passed.')
    finally:
        server.terminate();server.wait();output.close()
