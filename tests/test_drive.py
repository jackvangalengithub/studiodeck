"""Google Drive OAuth, folder access and import integration checks.
Run: PHP_BIN=php python3 tests/test_drive.py
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
        return tok

from urllib.parse import urlparse,parse_qs,urlencode
import base64
with tempfile.TemporaryDirectory(prefix='studiodeck-drive-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8097';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':'','GOOGLE_DRIVE_CLIENT_ID':'test-client','GOOGLE_DRIVE_CLIENT_SECRET':'test-secret','GOOGLE_DRIVE_TOKEN_KEY':base64.b64encode(os.urandom(32)).decode(),'DRIVE_FIXTURES':str(tmp)}
    import fitz
    doc=fitz.open();doc.new_page().insert_text((50,50),'Studio terms: Two revision rounds are included.');doc.save(tmp/'sample.pdf');doc.close()
    for extension,part in [('xlsx','xl/workbook.xml'),('pptx','ppt/presentation.xml')]:
        with zipfile.ZipFile(tmp/('sample.'+extension),'w') as z:z.writestr(part,'<?xml version="1.0"?><document/>')
    router=tmp/'router.php';router.write_text("<?php require '"+str(ROOT/'tests/fixtures/drive-transport.php')+"'; return require '"+str(ROOT/'public/router.php')+"';")
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-S','127.0.0.1:8097','-t',str(ROOT/'public'),str(router)],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('drive-admin@example.test',log);session=admin.call('session')
        if not session['studio']:session=admin.call('create_studio',{'name':'Drive test studio'},expected=201)
        studio=session['studio']['id'];uid=session['user']['id']
        check(admin.call('drive_status')=={'configured':True,'connected':False,'email':''},'Configured Drive starts disconnected without exposing tokens')
        admin.call('drive_connect',{},csrf=False,expected=403)
        def connect(client=admin):
            auth=client.call('drive_connect',{})['url'];params=parse_qs(urlparse(auth).query)
            check(params['scope']==['https://www.googleapis.com/auth/drive.readonly'] and params['code_challenge_method']==['S256'],'OAuth requests read-only Drive access with PKCE')
            callback='&'+urlencode({'state':params['state'][0],'code':'test-code'})
            return callback
        callback=connect()
        stranger=Client(base);stranger.login('stranger@example.test',log)
        check(b'expired' in stranger.call('drive_callback',query=callback,raw=True),'OAuth state is bound to the initiating session')
        check(b'Google Drive is connected' in admin.call('drive_callback',query=callback,raw=True),'OAuth callback connects the correct studio account')
        check(b'expired' in admin.call('drive_callback',query=callback,raw=True),'OAuth callback replay is rejected')
        with sqlite3.connect(tmp/'test.sqlite') as db:
            tokens=db.execute('SELECT access_token,refresh_token FROM drive_connections').fetchone()
            check(all('test-' not in token for token in tokens),'Access and refresh tokens are encrypted at rest')
            db.execute('UPDATE drive_connections SET expires_at=0')
        root=admin.call('drive_list')
        check(root['folder']['id']=='root-id' and all(i['folder'] and not i['selectable'] for i in root['items']),'Folders can be browsed but never selected as uploads')
        listing=admin.call('drive_list',query='&folder=villa')
        check({i['id'] for i in listing['items'] if i['selectable']}=={'pdf','sheet','slides'},'Unsupported, restricted, shortcut and oversized items are disabled')
        check(admin.call('drive_list',query='&folder=villa&page=page-two')['items'][0]['export']=='pdf','Pagination and Google Docs export metadata work')
        check(admin.call('drive_list',query='&folder=shared')['items'][0]['id']=='shared-pdf','Shared-drive folder browsing uses the correct corpus')
        admin.call('drive_list',query='&folder=pdf',expected=400)
        admin.call('drive_list',query='&folder=missing',expected=404)
        p=admin.call('create_project',{'name':'Drive import project','visibility':'public','starting_pack':[]},expected=201);pid=p['project_id'];iid=p['iteration_id']
        def import_files(ids,expected=201,**extra):return admin.call('drive_import',{'iteration':iid,'folder':'villa','files':ids,**extra},expected=expected)
        for ids,status in [(['nested'],400),(['restricted'],400),(['outside'],409),(['large'],413),(['pdf','broken'],502),(['spoof'],400),(['pdf']*21,400)]:import_files(ids,status)
        check(not admin.call('project',query='&id='+pid)['files'],'Rejected imports are atomic and leave no files behind')
        result=import_files(['pdf','doc','sheet','slides']);check(len(result['ids'])==4,'Selected files and Google Workspace exports import through the project pipeline')
        deck=admin.call('project',query='&id='+pid);check({f['name'] for f in deck['files']}=={'Studio terms.pdf','Client brief.pdf','Project budget.xlsx','Design story.pptx'},'Google Docs, Sheets and Slides get supported filenames')
        check(all(f['metadata']['google_drive']['folder_id']=='villa' for f in deck['files']) and len(deck['jobs'])==4,'Imported copies retain source provenance and queue normal processing')
        check(import_files(['pdf'])['ids']==[next(f['id'] for f in deck['files'] if f['name']=='Studio terms.pdf')],'Retrying an identical import does not duplicate a file')
        admin.call('save_studio_user',{'email':'member@example.test','name':'Member','role':'member'})
        member=Client(base);member.login('member@example.test',log);check(not member.call('drive_status')['connected'],'Teammates cannot use another member’s Drive connection')
        member.call('drive_import',{'iteration':iid,'folder':'villa','files':['pdf']},expected=403)
        original_studio=studio
        second=admin.call('create_studio',{'name':'Other studio'},expected=201)['studio']['id'];check(not admin.call('drive_status')['connected'],'Drive connections are isolated between studios')
        admin.studio_context=original_studio
        # Reauthorize the project and account after downloads, before committing a batch.
        (tmp/'control.json').write_text(json.dumps({'lock_during_download':iid}));import_files(['outside'],409)
        import_files(['doc'],409)
        with sqlite3.connect(tmp/'test.sqlite') as db:db.execute("UPDATE iterations SET locked=0 WHERE id=?",(iid,))
        (tmp/'control.json').write_text(json.dumps({'disconnect_during_download':True}));import_files(['doc'],409)
        check(not admin.call('drive_status')['connected'],'Disconnect during a download prevents the import from committing')
        (tmp/'control.json').write_text('{}')
        callback=connect();admin.call('drive_disconnect',{});check(b'cancelled or expired' in admin.call('drive_callback',query=callback,raw=True) or not admin.call('drive_status')['connected'],'Disconnect invalidates outstanding OAuth requests')
        callback=connect();admin.call('drive_callback',query=callback,raw=True)
        with sqlite3.connect(tmp/'test.sqlite') as db:db.execute('UPDATE drive_connections SET expires_at=0')
        (tmp/'control.json').write_text(json.dumps({'expired':True}));admin.call('drive_list',expected=409)
        check(not admin.call('drive_status')['connected'],'Expired refresh grants request reconnection')
        (tmp/'control.json').write_text('{}')
        # Existing import bytes stay available after disconnect; no dependency on Drive remains.
        vid=result['ids'][0];check(admin.call('file',query='&iteration='+iid+'&id='+vid,raw=True)==(tmp/'sample.pdf').read_bytes(),'Disconnect leaves imported project originals intact')
        for _ in range(4):subprocess.run([PHP,str(ROOT/'scripts/worker.php'),'--once'],env=env,check=True,capture_output=True)
        deck=admin.call('project',query='&id='+pid);ref=next(f for f in deck['files'] if f['id']==vid)
        check(ref['pages'] and ref['metadata']['google_drive']['file_id']=='pdf','Normal document processing preserves Drive provenance and extracts text')
        share=admin.call('share',{'iteration':iid,'emails':['drive-client@example.test']})['links'][0]
        client=Client(base);client.login('drive-client@example.test',log);client.client_share=share['id']
        check(all('google_drive' not in f['metadata'] for f in client.call('deck')['files']),'Client presentations omit private Drive folder and file identifiers')
        client.call('drive_status',expected=403)
        client.call('drive_import',{'iteration':iid,'folder':'villa','files':['pdf']},expected=403)
        with sqlite3.connect(tmp/'test.sqlite') as db:check(not db.execute('PRAGMA foreign_key_check').fetchall(),'Drive lifecycle leaves no foreign-key violations')
    finally:
        server.terminate();server.wait();output.close()
