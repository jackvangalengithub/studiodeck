"""Question/answer activity persistence and access checks. No AI or real email."""
from pathlib import Path
import http.cookiejar,urllib.request,urllib.error,json,os,tempfile,subprocess,time,sqlite3
ROOT=Path(__file__).resolve().parents[1];PHP=os.environ.get('PHP_BIN','php')
def check(value,message):
    if not value:raise AssertionError(message)
    print('PASS',message,flush=True)
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
            for name,mime,blob in files:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+blob+b'\r\n')
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

with tempfile.TemporaryDirectory(prefix='studiodeck-manual-') as temp:
    tmp=Path(temp);base='http://127.0.0.1:8097';log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(tmp/'test.sqlite'),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen([PHP,'-S','127.0.0.1:8097','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        admin=Client(base)
        for _ in range(60):
            try:admin.call('session');break
            except (ConnectionError,urllib.error.URLError):time.sleep(.1)
        admin.login('designer@example.test',log)
        p=admin.call('create_project',{'name':'Manual slides','visibility':'public'},expected=201);pid=p['project_id'];iid=p['iteration_id']
        def deck():return admin.call('project',query='&id='+pid)
        def save(**kwargs):return admin.call('save_slide',{'iteration':iid,**kwargs})['id']
        text=save(type='text',title='Our story',description='Line one\nLine two',section='story')
        row=deck()['slides'][0];check(row['id']==text[7:] and row['source_version_id'] is None and row['description']=='Line one\nLine two','Text slides save without a source file')
        from PIL import Image
        import io
        im=Image.new('RGB',(240,160),'#202030');raw=io.BytesIO();im.save(raw,'PNG')
        photo=admin.call('save_slide',{'iteration':iid,'title':'Welcome home','type':'fullphoto','section':'story'},files=[('photo.png','image/png',raw.getvalue())])['id']
        row=next(s for s in deck()['slides'] if s['id']==photo[7:]);vid=row['source_version_id']
        check(row['manual']==1 and row['type']=='fullphoto','Full photo upload creates a persistent manual slide and source')
        check(admin.call('slide_image',query='&iteration='+iid+'&slide_id='+photo[7:],raw=True).startswith(b'\x89PNG'),'Full photo image is served with iteration access checks')
        duplicate=save(type='fullphoto',title='Same image, second slide',image_source='slide:'+photo[7:],section='designs')
        check(len(deck()['slides'])==3,'One image can be reused on multiple manual slides')
        save(slide_id=photo[7:],type='photo',title='Edited photograph',description='A caption',situation='before')
        save(slide_id='intro',title='Our introduction',description='Our own words',section='story')
        check(deck()['slide_content'][0]['title']=='Our introduction','Built-in titles and introductory text persist')
        admin.call('save_slide',{'iteration':iid,'type':'fullphoto','title':'No photo'},expected=400)
        admin.call('save_slide',{'iteration':iid,'type':'text','title':'Bad group','section':'wrong'},expected=400)
        admin.call('save_slide',{'iteration':iid,'type':'text','title':'No CSRF'},csrf=False,expected=403)
        other=admin.call('create_project',{'name':'Separate project'},expected=201)
        admin.call('save_slide',{'iteration':other['iteration_id'],'type':'fullphoto','title':'Invalid image','image_source':'slide:'+photo[7:]},expected=400)
        admin.call('save_slide',{'iteration':other['iteration_id'],'type':'fullphoto','title':'Invalid file','image_source':'file:'+vid},expected=400)
        admin.call('save_studio_user',{'email':'viewer@example.test','name':'Viewer'})
        viewer=Client(base);viewer.login('viewer@example.test',log)
        viewer.call('save_slide',{'iteration':iid,'type':'text','title':'Forbidden'},expected=403)
        check(len(deck()['slides'])==3,'Validation and access failures do not create slides or expose other projects')
        # Reprocessing cannot erase a manually authored slide.
        code='require '+json.dumps(str(ROOT/'app/ingest.php'))+'; $v=one("SELECT * FROM file_versions WHERE id=?",['+json.dumps(vid)+']);save_visual_slides('+json.dumps(iid)+',$v,[]);'
        subprocess.run([PHP,'-r',code],env=env,check=True,capture_output=True)
        check(len(deck()['slides'])==3,'Reprocessing preserves manual slides')
        for operation in ['hide','show','delete','restore']:
            admin.call('slide_layout',{'iteration':iid,'slide_id':text,'operation':operation})
        admin.call('comment',{'iteration':iid,'slide':text,'body':'Text slide feedback'})
        comment=deck()['comments'][0]
        check(admin.call('comment_preview',query='&id='+comment['id'],raw=True).startswith(b'\x89PNG'),'Text slides support comment thumbnails')
        link=admin.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0];client=Client(base);client.bearer=link['url'].split('/#/view/')[1]
        shared=client.call('deck');check(len(shared['slides'])==3 and shared['slide_content'][0]['title']=='Our introduction','Clients receive saved manual slides and built-in edits')
        client.call('save_slide',{'iteration':iid,'type':'text','title':'Forbidden'},expected=401)
        admin.call('save_slide',{'iteration':iid,'slide_id':text[7:],'type':'text','title':'Shared'},expected=409)
        newer=admin.call('new_iteration',{'iteration':iid},expected=201)['id']
        admin.call('save_slide',{'iteration':newer,'slide_id':text[7:],'type':'text','title':'New story'})
        check(next(s for s in client.call('deck')['slides'] if s['id']==text[7:])['title']=='Our story','New iterations copy manual slides without changing shared content')
        confirmation=admin.call('prepare_delete_project',{'project_id':pid})
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation['confirmation'],'name':'Manual slides','acknowledged':True})
        check(not sqlite3.connect(tmp/'test.sqlite').execute('PRAGMA foreign_key_check').fetchall(),'Project deletion cleans up manual slides and content without foreign key errors')
    finally:
        server.terminate();server.wait(timeout=10);output.close()
