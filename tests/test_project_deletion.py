"""Integration checks for custom groups, legal extraction and permanent deletion.
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
        self.base=base; self.csrf=''; self.bearer=''; self.client_share=''; self.studio_context=None
        self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,query='',files=None,expected=200,csrf=True,raw=False,file_field='files[]'):
        headers={}
        if self.studio_context:headers['X-Studio-ID']=self.studio_context
        if self.csrf and csrf: headers['X-CSRF-Token']=self.csrf
        if self.bearer: headers['Authorization']='Bearer '+self.bearer
        if self.client_share: headers['Authorization']='Client '+self.client_share
        if files:
            boundary='studiodeck-test-boundary';parts=[]
            for k,v in data.items():parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
            for name,mime,blob in files:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+blob+b'\r\n')
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
        # This suite exercises existing-studio deletion, independently of new signup billing.
        with sqlite3.connect(log.parent/'test.sqlite') as db:
            db.execute('UPDATE studio_billing SET legacy_exempt=1,onboarded_at=1 WHERE studio_id IN (SELECT m.studio_id FROM studio_members m JOIN users u ON u.id=m.user_id WHERE u.email=?)',(email,))
        return tok

with tempfile.TemporaryDirectory(prefix='studiodeck-editor-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8095';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-S','127.0.0.1:8095','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('designer@example.test',log)
        p=admin.call('create_project',{'name':'Keep / Delete carefully','visibility':'public'},expected=201);pid=p['project_id'];iid=p['iteration_id']
        # Simulate the old constrained schema so the real HTTP startup migrates it.
        with sqlite3.connect(tmp/'test.sqlite') as db:
            db.executescript("DROP TABLE slide_sections; CREATE TABLE slide_sections(iteration_id TEXT NOT NULL REFERENCES iterations(id),slide_id TEXT NOT NULL,section TEXT NOT NULL CHECK(section IN ('story','current','moodboards','designs','budget')),PRIMARY KEY(iteration_id,slide_id));")
            db.execute('INSERT INTO slide_sections VALUES(?,?,?)',(iid,'intro','story'))
        group=admin.call('add_slide_group',{'iteration':iid,'label':'Materials & finishes'},expected=201)['id']
        admin.call('slide_layout',{'iteration':iid,'slide_id':'intro','operation':'section','section':group})
        deck=admin.call('project',query='&id='+pid)
        check(deck['slide_groups'][group]=='Materials & finishes' and deck['slide_sections'][0]['section']==group,'Legacy assignments migrate and custom groups persist')
        admin.call('add_slide_group',{'iteration':iid,'label':'Materials & finishes'},expected=400)
        admin.call('slide_layout',{'iteration':iid,'slide_id':'intro','operation':'section','section':'missing'},expected=400)
        admin.call('save_studio_user',{'email':'viewer@example.test','name':'Viewer'})
        viewer=Client(base);viewer.login('viewer@example.test',log)
        viewer.call('add_slide_group',{'iteration':iid,'label':'Denied'},expected=403)
        viewer.call('prepare_delete_project',{'project_id':pid},expected=403)
        viewer.call('delete_project',{'project_id':pid},expected=403)
        # Promoting an existing member grants deletion; demotion must take effect
        # immediately, even with a confirmation issued before the role changed.
        member_project=viewer.call('create_project',{'name':'Role change deletion check'},expected=201)
        member_pid=member_project['project_id']
        viewer.call('prepare_delete_project',{'project_id':member_pid},expected=403)
        viewer.call('save_studio_user',{'email':'viewer@example.test','name':'Viewer','role':'admin'},expected=403)
        viewer_id=viewer.call('session')['user']['id']
        role_payload={'id':viewer_id,'email':'viewer@example.test','name':'Viewer','role':'admin'}
        admin.call('save_studio_user',role_payload)
        check(viewer.call('session')['studio']['role']=='admin','Promotion updates the existing member session without signing in again')
        role_confirmation=viewer.call('prepare_delete_project',{'project_id':member_pid})['confirmation']
        role_delete={'project_id':member_pid,'confirmation':role_confirmation,'name':'Role change deletion check','acknowledged':True}
        admin.call('save_studio_user',{**role_payload,'role':'member'})
        viewer.call('prepare_delete_project',{'project_id':member_pid},expected=403)
        viewer.call('delete_project',role_delete,expected=403)
        check(viewer.call('project',query='&id='+member_pid)['project']['id']==member_pid,'Demotion blocks a previously authorized deletion and preserves the project')
        admin.call('save_studio_user',role_payload)
        role_delete['confirmation']=viewer.call('prepare_delete_project',{'project_id':member_pid})['confirmation']
        viewer.call('delete_project',role_delete)
        viewer.call('project',query='&id='+member_pid,expected=404)
        admin.call('save_studio_user',{**role_payload,'role':'member'})
        check(admin.call('project',query='&id='+pid)['project']['id']==pid,'A promoted admin can delete an accessible project without affecting another project')
        stranger=Client(base);stranger.login('other@example.test',log)
        stranger.call('prepare_delete_project',{'project_id':pid},expected=404)
        other=admin.call('create_project',{'name':'Another project'},expected=201)
        link=admin.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0]
        client=Client(base);client.login('client@example.test',log);client.client_share=link['id']
        client.call('add_slide_group',{'iteration':iid,'label':'Denied'},expected=403)
        admin.call('lock_iteration',{'iteration':iid})
        admin.call('add_slide_group',{'iteration':iid,'label':'Frozen'},expected=409)
        newer=admin.call('new_iteration',{'iteration':iid},expected=201)['id']
        check(admin.call('project',query='&id='+pid+'&iteration='+newer)['slide_groups']==deck['slide_groups'],'Custom group definitions carry forward into new iterations')
        # Deletion includes comments, reads, queued emails, aliases, version chains and image variants.
        client.call('comment',{'slide':'intro','body':'Please review this inclusion.'})
        from test_extraction import png
        admin.call('upload',{'iteration':newer},files=[('concept-render.png','image/png',png('#778899'))],expected=201)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        # Ingestion also queues question suggestions; deletion waits for all project work.
        for _ in range(20):
            with sqlite3.connect(tmp/'test.sqlite') as db: pending=db.execute("SELECT COUNT(*) FROM jobs WHERE project_id=? AND status IN ('queued','running')",(pid,)).fetchone()[0]
            if not pending: break
            subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        d=admin.call('project',query='&id='+pid+'&iteration='+newer);source=next(f['id'] for f in d['files'] if f['name']=='concept-render.png')
        with sqlite3.connect(tmp/'test.sqlite') as db:
            db.execute("INSERT INTO document_pages VALUES(?,1,'Source text','{}',NULL)",(source,))
            db.execute("INSERT INTO document_images VALUES(?,1,1,'{}',?)",(source,png('#778899')))
            db.execute("INSERT INTO slide_image_versions VALUES('variant1',NULL,?,'image/png',?,'{}','now')",(source,png('#778899')))
            db.execute("INSERT INTO slide_image_versions VALUES('variant2','variant1',?,'image/png',?,'{}','now')",(source,png('#778899')))
            db.execute("UPDATE presentation_slides SET image_version_id='variant2' WHERE source_version_id=?",(source,))
        confirmation=admin.call('prepare_delete_project',{'project_id':pid})['confirmation']
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation,'name':'wrong','acknowledged':True},expected=400)
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation,'name':'Keep / Delete carefully'},expected=400)
        admin.call('delete_project',{'project_id':other['project_id'],'confirmation':confirmation,'name':'Another project','acknowledged':True},expected=409)
        with sqlite3.connect(tmp/'test.sqlite') as db:db.execute('UPDATE project_delete_confirmations SET expires_at=0')
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation,'name':'Keep / Delete carefully','acknowledged':True},expected=409)
        confirmation=admin.call('prepare_delete_project',{'project_id':pid})['confirmation']
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation,'name':'Keep / Delete carefully','acknowledged':True},csrf=False,expected=403)
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation,'name':'Keep / Delete carefully','acknowledged':True})
        admin.call('project',query='&id='+pid,expected=404)
        client.call('deck',expected=404)
        check(admin.call('project',query='&id='+other['project_id'])['project']['name']=='Another project','Deletion preserves unrelated projects and revokes client access')
        with sqlite3.connect(tmp/'test.sqlite') as db:
            check(not db.execute('PRAGMA foreign_key_check').fetchall(),'Permanent deletion leaves no broken foreign keys')
            for table in ['file_versions','document_pages','document_images','slide_image_versions','comments','comment_reads','email_outbox','shares','share_aliases','slide_groups','project_delete_confirmations']:
                check(db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]==0,'Deletion removes '+table)
        print('PASS Group migration, permissions and permanent project deletion')
    finally:
        server.terminate();server.wait(timeout=10);output.close()
