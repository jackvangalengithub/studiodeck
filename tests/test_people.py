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

with tempfile.TemporaryDirectory(prefix='studiodeck-people-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8093';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w')
    server=subprocess.Popen([PHP,'-S','127.0.0.1:8093','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('owner@example.test',log);session=admin.call('session');sid=session['studio']['id'];uid=session['user']['id']
        users=admin.call('save_studio_user',{'email':'member@example.test','name':'Member'})['users'];mid=next(u['id'] for u in users if u['email']=='member@example.test')
        member=Client(base);member.login('member@example.test',log)
        project=admin.call('create_project',{'name':'Design & <Review>','visibility':'public'},expected=201);pid=project['project_id'];iid=project['iteration_id']
        admin.call('project_members',{'project_id':pid,'user_ids':[uid,mid]})
        profile=member.call('save_profile',{'name':'New name','color':'#123456','email_comments':True})['profile']
        check(profile['name']=='New name' and profile['color']=='#123456','Profile persists name and personal color')
        member.call('save_profile',{'name':'Bad','color':'red'},expected=400)
        member.call('save_profile',{'name':'No CSRF'},csrf=False,expected=403)
        from test_extraction import png
        member.call('upload_avatar',{},files=[('avatar.png','image/png',png('#223344'))],file_field='avatar')
        check(member.call('profile')['profile']['avatar'].startswith('data:image/png;base64,'),'Avatar is normalized and saved server-side')
        member.call('upload_avatar',{},files=[('avatar.svg','image/svg+xml',b'<svg/>')],file_field='avatar',expected=400)
        member.call('remove_avatar',{});check(member.call('profile')['profile']['avatar'] is None,'Avatar can be removed')
        check(admin.call('project',query='&id='+pid)['branding']['source']=='studiodeck','Presentation defaults to Studiodeck branding')
        admin.call('upload_studio_logo',{},files=[('studio.png','image/png',png('#225566'))],file_field='logo')
        check(member.call('project',query='&id='+pid)['branding']['source']=='studio','Presentation inherits studio logo')
        admin.call('upload_project_logo',{'project_id':pid},files=[('client.png','image/png',png('#884422'))],file_field='logo')
        check(admin.call('project',query='&id='+pid)['branding']['source']=='project','Project logo overrides studio logo')
        admin.call('studio_theme',{'name':'Design Studio','theme':{'palette':'plum'}})
        links=admin.call('share',{'iteration':iid,'emails':['client@example.test','second@example.test'],'message':'Welcome <client> & enjoy!'})['links']
        client=Client(base);client.bearer=links[0]['url'].split('/#/view/')[1]
        second=Client(base);second.bearer=links[1]['url'].split('/#/view/')[1]
        check(client.call('deck')['branding']['source']=='project','Client gets project branding without studio access')
        client.call('save_profile',{'name':'Client Name','color':'#aa3355','email_comments':True})
        check(client.call('profile')['profile']['name']=='Client Name','Client has profile and notification preferences')
        client.call('comment',{'iteration':iid,'slide':'intro','body':'Please adjust the entrance light.'})
        comments=admin.call('comments_feed')['items'];cid=comments[0]['id']
        check(comments[0]['unread'] and comments[0]['profile']['name']=='Client Name','New comments show unread and client display name')
        check(admin.call('session')['unread_count']==1,'Unread count is studio-scoped and server-side')
        check(admin.call('comment_preview',query='&id='+cid,raw=True).startswith(b'\x89PNG'),'Comment includes authorized slide preview')
        admin.call('read_comments',{'ids':[cid]});check(not admin.call('comments_feed')['items'][0]['unread'] and admin.call('session')['unread_count']==0,'Reading persists across subsequent requests')
        check(member.call('comments_feed')['items'][0]['unread'],'Read status is independent for each person')
        check(not client.call('deck')['comments'][0]['unread'],'Own comment is already read')
        second.call('read_comments',{'ids':[cid]});check(not second.call('deck')['comments'][0]['unread'],'Clients persist read status too')
        stranger=Client(base);stranger.login('stranger@example.test',log)
        stranger.call('read_comments',{'ids':[cid]},expected=404);stranger.call('comment_preview',query='&id='+cid,expected=404)
        stranger.call('upload_project_logo',{'project_id':pid},files=[('bad.png','image/png',png('#000000'))],file_field='logo',expected=404)
        db=sqlite3.connect(tmp/'test.sqlite')
        check({r[0] for r in db.execute('SELECT email FROM email_outbox')}=={'owner@example.test','member@example.test','second@example.test'},'Comments queue other team members and active clients, excluding the author')
        # Recheck preferences and access at dispatch time, not just when queued.
        member.call('save_profile',{'name':'New name','color':'','email_comments':False})
        admin.call('revoke_share',{'id':links[1]['id']})
        for _ in range(4):subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        statuses=dict(db.execute('SELECT email,status FROM email_outbox'))
        check(statuses=={'owner@example.test':'logged','member@example.test':'cancelled','second@example.test':'cancelled'},'Queued notifications respect changed preferences and revoked shares')
        alias=db.execute('SELECT url FROM email_outbox WHERE email=?',('second@example.test',)).fetchone()[0].split('#/view/')[1]
        aliasclient=Client(base);aliasclient.bearer=alias;aliasclient.call('deck',expected=403)
        check(True,'Notification links inherit original share revocation')
        messages=[json.loads(x) for x in Path(str(log)+'.messages.jsonl').read_text().splitlines()]
        check(all('Presented by studiodeck' in m['html'] and '#68445f' in m['html'] for m in messages),'Emails use studio palette and Studiodeck attribution')
        check('Welcome &lt;client&gt; &amp; enjoy!' in messages[0]['html'],'Client email message is safely escaped')
        admin.call('remove_project_logo',{'project_id':pid});check(client.call('deck')['branding']['source']=='studio','Removing project logo falls back to studio logo')
        db.close()
        print('PASS Profiles, comment previews, persistent unread states, client branding and notifications')
    finally:
        server.terminate();server.wait(timeout=10);output.close()
