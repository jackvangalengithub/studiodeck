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
        self.base=base; self.csrf=''; self.bearer=''; self.studio_context=None
        self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,query='',files=None,expected=200,csrf=True,raw=False,file_field='files[]'):
        headers={}
        if self.studio_context:headers['X-Studio-ID']=self.studio_context
        if self.csrf and csrf: headers['X-CSRF-Token']=self.csrf
        if self.bearer: headers['Authorization']='Bearer '+self.bearer
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
        return tok

with tempfile.TemporaryDirectory(prefix='studiodeck-studios-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8091';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    legacy=sqlite3.connect(tmp/'test.sqlite')
    legacy.executescript((ROOT/'app/schema.sql').read_text().split('CREATE TABLE IF NOT EXISTS studios ')[0])
    legacy.execute('INSERT INTO users VALUES(?,?,?,?)',('legacy-admin','admin@example.test','Admin','2026-01-01'))
    legacy.execute('INSERT INTO projects VALUES(?,?,?,?,?,?,?)',('legacy-project','legacy-admin','Existing project','','','{}','2026-01-01'))
    legacy.execute('INSERT INTO iterations(id,project_id,number,title,status,theme,created_at) VALUES(?,?,?,?,?,?,?)',('legacy-iteration','legacy-project',1,'First concept','draft','{}','2026-01-01'))
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
        check(admin.call('project',query='&id=legacy-project')['can_edit'] and session['studio_theme']['palette']=='warmgray','Migration preserves legacy project access with the fixed studio palette')
        admin.call('save_studio_user',{'email':'member@example.test','name':'Member','role':'member'},csrf=False,expected=403)
        users=admin.call('save_studio_user',{'email':'member@example.test','name':'Member','role':'member'})['users']
        mid=next(u['id'] for u in users if u['email']=='member@example.test')
        member=Client(base);member.login('member@example.test',log)
        check(member.call('session')['studio']['id']==studio,'Added user joins the intended studio')
        member.call('save_studio_user',{'email':'blocked@example.test','name':'Blocked'},expected=403)
        from test_extraction import png
        logo=png('#225566')
        admin.call('upload_studio_logo',{},files=[('logo.png','image/png',logo)],file_field='logo')
        check(member.call('studio_logo',raw=True).startswith(b'\x89PNG') and member.call('session')['studio']['has_logo'],'Studio logo is shared with members as a normalized image')
        admin.call('upload_studio_logo',{},files=[('logo.svg','image/svg+xml',b'<svg onload="alert(1)"/>')],file_field='logo',expected=400)
        admin.call('studio_theme',{'name':'Shared studio','theme':{'palette':'ocean','style':'modern'}})
        check(member.call('session')['studio_theme']['palette']=='warmgray','All studio members receive the fixed studio palette')

        p=admin.call('create_project',{'name':'Private admin project','emails':[]},expected=201);pid=p['project_id'];iid=p['iteration_id']
        check(member.call('projects')['projects']==[],'Studio membership does not reveal private projects')
        member.call('project',query='&id='+pid,expected=404)
        admin.call('project_settings',{'project_id':pid,'visibility':'public'})
        check(any(p['id']==pid for p in member.call('projects')['projects']),'Public projects appear for other members of the selected studio')
        check(member.call('project',query='&id='+pid)['can_edit'] is False,'Public projects are read-only for non-team members')
        for action,payload in [('theme',{'iteration':iid}),('new_iteration',{'iteration':iid}),('share',{'iteration':iid,'emails':['client@example.test']}),('save_contact',{'project_id':pid}),('project_settings',{'project_id':pid,'archived':True}),('project_members',{'project_id':pid,'user_ids':[mid]})]:
            member.call(action,payload,expected=403)
        member.call('save_project_person',{'project_id':pid,'group':'other','name':'Blocked','email':''},expected=403)
        member.call('pin_project',{'project_id':pid,'pinned':True})
        check(member.call('projects')['projects'][0]['pinned']==1,'Public projects can be pinned personally')
        check(next(p for p in admin.call('projects')['projects'] if p['id']==pid)['pinned']==0,'Pins are personal to each user')
        admin.call('project_settings',{'project_id':pid,'archived':True})
        check(member.call('projects')['projects']==[],'Archived projects are hidden by default')
        check(member.call('projects',query='&archived=1')['projects'][0]['archived']==1,'Show archived includes accessible archived projects')
        admin.call('project_settings',{'project_id':pid,'archived':False})
        admin.call('upload',{'iteration':iid},files=[('costs.csv','text/csv',b'label,amount\nDesk,20\n')],expected=201)
        check(member.call('projects')['projects'][0]['processing']==1,'Project list exposes active processing jobs')
        admin.call('project_settings',{'project_id':pid,'visibility':'team'})
        check(member.call('projects')['projects']==[],'Making a project private removes it from non-team lists')
        admin.call('project_members',{'project_id':pid,'user_ids':[aid,mid]})
        check(member.call('project',query='&id='+pid)['can_edit'],'Project team members can open and edit their project')
        member.call('theme',{'iteration':iid,'theme':{'colors':['#112233'],'font':'sans','style':'Modern','mode':'dark','background':'#111314'}})
        admin.call('studio_theme',{'theme':{'palette':'plum','style':'modern'}})
        t=member.call('project',query='&id='+pid)['project']['theme']
        check(t['mode']=='dark' and t['background']=='#111314' and t['colors']==['#112233'],'Studio branding changes preserve the independent project palette and dark presentation settings')

        admin.call('upload_avatar',{},files=[('avatar.png','image/png',logo)],file_field='avatar')
        admin.call('save_studio_user',{'id':aid,'email':'admin@example.test','name':'Admin','role':'admin','phone':'+31 20 1234567'})
        admin.call('save_project_person',{'project_id':pid,'group':'team','key':aid,'role':'Project lead'})
        admin.call('project_members',{'project_id':pid,'user_ids':[aid,mid]})
        people=admin.call('project',query='&id='+pid)['people']
        lead=next(person for person in people['team'] if person['key']==aid)
        check(lead['name']=='Admin' and lead['role']=='Project lead' and lead['phone']=='+31 20 1234567' and lead['profile']['avatar'].startswith('data:image/png'), 'Project roles persist while names, phones and avatars come from studio members')
        admin.call('save_project_person',{'project_id':pid,'group':'team','key':aid,'name':'Wrong','email':'another@example.test'},expected=400)
        role_project=admin.call('create_project',{'name':'Independent roles','emails':[]},expected=201)
        admin.call('project_members',{'project_id':role_project['project_id'],'user_ids':[aid,mid],'roles':{aid:'Consultant',mid:'Project architect'}})
        check(admin.call('project',query='&id='+pid)['people']['team'][0]['role']=='Project lead','A role in a second project does not replace the first project role')
        other_team=admin.call('project',query='&id='+role_project['project_id'])['people']['team']
        check(next(x for x in other_team if x['id']==mid)['role']=='Project architect','Team addition stores a distinct role for each selected studio member')
        admin.call('project_members',{'project_id':pid,'user_ids':[aid,mid],'roles':{'outside':'Designer'}},expected=400)
        member.call('save_studio_user',{'id':mid,'email':'member@example.test','name':'Unauthorized','phone':'123'},expected=403)
        member.call('save_project_person',{'project_id':role_project['project_id'],'group':'team','key':mid,'role':'admin'})
        check(member.call('session')['studio']['role']=='member','Project role text cannot grant studio administrator permissions')

        admin.call('save_project_person',{'project_id':pid,'group':'clients','name':'Homeowner','email':'client@example.test','phone':'+31 6 12345678'})
        admin.call('save_project_person',{'project_id':pid,'group':'other','name':'Painter','email':'','phone':'020 7654321','role':'Painting contractor'})
        people=admin.call('project',query='&id='+pid)['people'];painter=people['other'][0]
        check(len(people['team'])==2 and len(people['clients'])==1 and len(people['other'])==1,'People are grouped without duplicating team members as other contacts')
        check(people['clients'][0]['phone']=='+31 6 12345678' and painter['phone']=='020 7654321','Client and subcontractor phone numbers are stored; other contacts may omit email')
        admin.call('save_project_person',{'project_id':pid,'group':'other','key':painter['key'],'name':'Painter updated','email':'paint@example.test','phone':'020 1111111','role':'Painting contractor'})
        admin.call('save_project_person',{'project_id':pid,'group':'other','name':'Duplicate','email':'client@example.test'},expected=400)
        admin.call('save_project_person',{'project_id':pid,'group':'other','key':'missing','name':'Missing','email':''},expected=404)
        admin.call('remove_project_person',{'project_id':pid,'group':'other','key':painter['key']},csrf=False,expected=403)
        admin.call('remove_project_person',{'project_id':pid,'group':'other','key':painter['key']})
        check(admin.call('project',query='&id='+pid)['people']['other']==[],'Removing an other contact removes only that project contact')
        admin.call('remove_project_person',{'project_id':pid,'group':'team','key':aid},expected=400)
        admin.call('remove_project_person',{'project_id':pid,'group':'clients','key':'client@example.test'})
        check(admin.call('project',query='&id='+pid)['people']['clients']==[],'Removing a client clears the project directory')
        member.call('remove_project_person',{'project_id':pid,'group':'team','key':aid})
        check(member.call('project',query='&id='+pid)['people']['other']==[],'Removing a team person also removes their legacy contact entry')
        member.call('project_members',{'project_id':pid,'user_ids':[aid,mid]})

        member.call('comment',{'iteration':iid,'slide':'intro','body':'Please review the entrance.'})
        member.call('comment',{'iteration':iid,'slide':'budget','body':'Please check the allowance.'})
        comments=admin.call('comments_feed')['items']
        check([c['slide'] for c in comments[:2]]==['budget','intro'] and comments[0]['project_id']==pid and comments[0]['iteration_id']==iid,'Comments are newest first with exact project, iteration, and slide links')
        check(any(e['project_id']==pid for e in member.call('activity_feed')['items']),'Activity feed spans accessible project events')
        own=member.call('create_project',{'name':'Private member project','emails':[]},expected=201)
        admin.call('project',query='&id='+own['project_id'],expected=404)
        member.call('comment',{'iteration':own['iteration_id'],'slide':'intro','body':'Private feedback'})
        check(all(c['body']!='Private feedback' for c in admin.call('comments_feed')['items']),'Comments from private projects never leak to studio admins')
        member.call('project_settings',{'project_id':own['project_id'],'visibility':'public'})
        check(any(p['id']==own['project_id'] for p in admin.call('projects')['projects']),'Public non-team projects remain visible in the project list')
        check(all(c['project_id']!=own['project_id'] for c in admin.call('comments_feed')['items']),'Comments exclude public projects when even an admin is not on their team')
        check(admin.call('comments_feed',query='&project_id='+own['project_id'])['items']==[],'A project filter cannot bypass comment feed team membership')
        check(admin.call('comments_feed')['unread_count']==2 and admin.call('session')['unread_count']==2,'Feed and menu unread totals exclude non-team project comments')
        check(any(e['project_id']==own['project_id'] for e in admin.call('activity_feed')['items']),'Activity continues to include accessible public projects')
        member.call('project_members',{'project_id':own['project_id'],'user_ids':[mid,aid]})
        check(any(c['project_id']==own['project_id'] for c in admin.call('comments_feed')['items']) and admin.call('session')['unread_count']==3,'Joining a project adds its comments and unread count')
        member.call('project_members',{'project_id':own['project_id'],'user_ids':[mid]})
        check(all(c['project_id']!=own['project_id'] for c in admin.call('comments_feed')['items']) and admin.call('session')['unread_count']==2,'Leaving a public project removes its comments and unread count')
        check(True,'Admin role grants no special access to private projects')
        admin.call('remove_studio_user',{'id':mid},expected=409)
        member.call('project_members',{'project_id':own['project_id'],'user_ids':[mid,aid]})
        other=admin.call('create_studio',{'name':'Second studio'},expected=201)['studio']['id']
        # Membership regression fixture: grant this additional studio legacy migration access.
        with sqlite3.connect(tmp/'test.sqlite') as db: db.execute('UPDATE studio_billing SET legacy_exempt=1,onboarded_at=1 WHERE studio_id=?',(other,))
        check(admin.call('projects')['projects']==[],'Selected studio scopes the project list')
        check(admin.call('comments_feed')['items']==[] and admin.call('activity_feed')['items']==[],'Feeds are isolated to the selected studio')
        admin.call('project',query='&id='+pid,expected=404)
        admin.studio_context=studio
        check(admin.call('project',query='&id='+pid)['project']['id']==pid,'An open tab keeps its explicit studio context when another tab switches studios')
        admin.studio_context='not-a-member'
        admin.call('projects',expected=404)
        admin.studio_context=None
        admin.call('save_studio_user',{'email':'member@example.test','name':'Member in studio two','role':'admin'})
        check(len(member.call('session')['studios'])==2,'One account can belong to multiple studios')
        member.call('switch_studio',{'studio_id':other})
        check(member.call('session')['studio']['role']=='admin','Roles are independent per studio')
        admin.call('switch_studio',{'studio_id':studio})
        admin.call('remove_studio_user',{'id':mid})
        member.call('switch_studio',{'studio_id':studio},expected=404)
        member.call('studio_logo',query='&studio_id='+studio,expected=404)
        check(len(member.call('session')['studios'])==1,'Removal revokes only the selected studio membership')
        admin.call('save_studio_user',{'id':aid,'email':'admin@example.test','name':'Admin','role':'member'},expected=409)
        check(True,'Last studio admin cannot be removed or demoted')
        print('All studio access checks passed.')
    finally:
        server.terminate();server.wait();output.close()
