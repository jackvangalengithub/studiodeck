"""Integration checks for profiles, unread comments, branding and email notifications.
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

with tempfile.TemporaryDirectory(prefix='studiodeck-story-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8094';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-S','127.0.0.1:8094','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('designer@example.test',log)
        from test_extraction import png
        admin.call('upload_avatar',{},files=[('avatar.png','image/png',png('#778899'))],file_field='avatar')
        p=admin.call('create_project',{'name':'Project story','visibility':'public'},expected=201);pid=p['project_id'];iid=p['iteration_id']
        admin.call('project_settings',{'project_id':pid,'tags':['Renovation','Coastal','Renovation'],'deadline':'2027-02-28'})
        admin.call('project_settings',{'project_id':pid,'location':'Amsterdam'})
        details=admin.call('project',query='&id='+pid)
        check(details['project']['location']=='Amsterdam' and details['project']['visibility']=='public','Location edits preserve existing project visibility and metadata')
        check(details['project']['tags']==['Renovation','Coastal'] and details['project']['deadline']=='2027-02-28','Project labels and deadline persist without duplicate labels')
        admin.call('project_settings',{'project_id':pid,'deadline':'2027-02-30'},expected=400)
        admin.call('project_settings',{'project_id':pid,'tags':['x']*21},expected=400)
        admin.call('project_settings',{'project_id':pid,'tags':['x'*41]},expected=400)
        check(admin.call('project',query='&id='+pid)['project']['deadline']=='2027-02-28','Invalid metadata leaves prior settings intact')
        admin.call('upload',{'iteration':iid},files=[('concept-render.png','image/png',png('#778899'))],expected=201)
        subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        deck=admin.call('project',query='&id='+pid);sid=deck['slides'][0]['id'];tile=admin.call('projects')['projects'][0]
        check(tile['cover_key'] and deck['cover_slide_id']==sid and tile['members'][0]['profile']['avatar'],'Project list exposes consistent cover and team avatars')
        check(admin.call('project_cover',query='&project_id='+pid,raw=True).startswith(b'\xff\xd8'),'Authorized project cover is served as a thumbnail')
        admin.call('save_slide',{'iteration':iid,'slide_id':sid,'title':'Ground floor','type':'floorplan','situation':'concept'})
        check(admin.call('project',query='&id='+pid)['slides'][0]['type']=='floorplan','Floorplan is a separate persistent slide type')
        admin.call('slide_layout',{'iteration':iid,'slide_id':'visual-'+sid,'operation':'section','section':'current'})
        admin.call('slide_layout',{'iteration':iid,'slide_id':'summary','operation':'section','section':'budget'})
        admin.call('slide_layout',{'iteration':iid,'slide_id':'summary','operation':'section','section':'bad'},expected=400)
        custom=admin.call('add_slide_group',{'iteration':iid,'label':'Materials & finishes'},expected=201)['id']
        admin.call('slide_layout',{'iteration':iid,'slide_id':'contacts','operation':'section','section':custom})
        check(admin.call('project',query='&id='+pid)['slide_groups'][custom]=='Materials & finishes','Custom slide groups are persistent')
        groups=admin.call('project',query='&id='+pid)['slide_groups'];group_order=list(reversed(groups))
        admin.call('reorder_slide_groups',{'iteration':iid,'order':group_order})
        check(list(admin.call('project',query='&id='+pid)['slide_groups'])==group_order,'Custom and default group order persists')
        admin.call('reorder_slide_groups',{'iteration':iid,'order':group_order[:-1]},expected=400)
        admin.call('reorder_slide_groups',{'iteration':iid,'order':[group_order[0]]*len(group_order)},expected=400)
        order=['summary','visual-'+sid,'intro','changes','budget','contacts'];admin.call('slide_layout',{'iteration':iid,'operation':'reorder','order':order})
        check(sorted(admin.call('project',query='&id='+pid)['slide_layout'],key=lambda s:s['position'])[0]['slide_id']=='summary','Complete slide reorder persists')
        admin.call('studio_theme',{'theme':{'palette':'warmgray','style':'classic','font':'serif'}})
        check(admin.call('session')['studio_theme']=={'palette':'warmgray','style':'editorial','font':'serif'},'Studio chrome stays fixed when legacy theme choices are submitted')
        users=admin.call('save_studio_user',{'email':'viewer@example.test','name':'Viewer'})['users'];viewer=Client(base);viewer.login('viewer@example.test',log)
        viewer.call('reorder_slide_groups',{'iteration':iid,'order':group_order},expected=403)
        viewer.call('project_settings',{'project_id':pid,'location':'Forbidden'},expected=403)
        viewer.call('project_settings',{'project_id':pid,'deadline':'2027-01-01'},expected=403)
        viewer.call('slide_layout',{'iteration':iid,'slide_id':'intro','operation':'section','section':'budget'},expected=403)
        link=admin.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0];client=Client(base);client.bearer=link['url'].split('/#/view/')[1]
        shared=client.call('deck');check(shared['team'][0]['profile']['avatar'] and 'email_comments' not in shared['team'][0]['profile'],'Client team slide receives avatars without private notification preferences')
        admin.call('lock_iteration',{'iteration':iid})
        admin.call('slide_layout',{'iteration':iid,'slide_id':'intro','operation':'section','section':'budget'},expected=409)
        admin.call('reorder_slide_groups',{'iteration':iid,'order':group_order},expected=409)
        newer=admin.call('new_iteration',{'iteration':iid},expected=201)['id']
        copied=admin.call('project',query='&id='+pid+'&iteration='+newer)
        check(list(copied['slide_groups'])==list(shared['slide_groups']),'New iterations preserve custom group definitions')
        check(copied['slide_sections']==shared['slide_sections'],'New iterations copy slide sections')
        admin.call('slide_layout',{'iteration':newer,'slide_id':'summary','operation':'section','section':'story'})
        check(client.call('deck')['slide_sections']==shared['slide_sections'],'Shared section assignments remain preserved')
        stranger=Client(base);stranger.login('other@example.test',log);stranger.call('project_cover',query='&project_id='+pid,expected=404)
        print('PASS Project metadata, covers, avatars, floorplans, ordering, sections and studio fonts')
    finally:
        server.terminate();server.wait(timeout=10);output.close()
