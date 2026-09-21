"""Private editor/public snapshot API tests. Uses isolated data; no paid AI or Stripe requests."""
from pathlib import Path
import base64, http.cookiejar, io, json, os, sqlite3, subprocess, tempfile, time, urllib.request, urllib.error, zipfile
ROOT=Path(__file__).resolve().parents[1]
class Client:
    def __init__(self,base):
        self.base=base;self.csrf='';self.cookies=http.cookiejar.CookieJar();self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,body=None,expected=200,csrf=True,raw=False):
        headers={'Content-Type':'application/json'}
        if csrf:headers['X-CSRF-Token']=self.csrf
        req=urllib.request.Request(self.base+'/api.php?action='+action,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        try:r=self.opener.open(req)
        except urllib.error.HTTPError as e:r=e
        data=r.read()
        assert r.code==expected,(action,r.code,data[:400])
        return (data,r.headers) if raw else json.loads(data)
    def login(self,email,log):
        self.call('request_login',{'email':email});tok=log.read_text().strip().splitlines()[-1].split('/#/login/')[1];self.call('consume_login',{'token':tok});session=self.call('session');self.csrf=session['csrf'];return session

def check(ok,message):
    assert ok,message
    print('PASS',message)

def run(tmp):
    base='http://127.0.0.1:8098';log=tmp/'mail.log';db=tmp/'test.sqlite'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(db),'WEBSITE_STORAGE_PATH':str(tmp/'sites'),'WEBSITE_LOCAL_FREE':'true','MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'','STRIPE_SECRET_KEY':'','STRIPE_PRICE_WEBSITE':'','WEBSITE_CNAME_TARGET':'','DESIGNER_EMAILS':''}
    output=open(tmp/'server.log','w');server=subprocess.Popen(['php','-S','127.0.0.1:8098','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output)
    try:
        a=Client(base)
        for _ in range(60):
            try:a.call('session');break
            except urllib.error.URLError:time.sleep(.1)
        session=a.login('admin@example.test',log);sid=session['studio']['id'];uid=session['user']['id']
        a.call('complete_studio_setup',{'name':'Willow Studio','language':'en','business_type':'interior'})
        a.call('billing_onboard',{'name':'Admin','studio_name':'Willow Studio'})
        project=a.call('create_project',{'name':'Miller family','description':'A carefully considered family home.'},expected=201);pid=project['project_id']
        site=a.call('website');check(site['billing']['local'] and not site['draft']['started'] and len(site['templates'])==26,'Welcome screen offers 26 starting designs')
        example,eh=a.call('website_template_preview&template=noir&website_studio='+sid,raw=True)
        check(b'Studio Forma' in example and 'allow-scripts' in eh['Content-Security-Policy'] and 'allow-same-origin' not in eh['Content-Security-Policy'],'Full-screen examples are sandboxed')
        site=a.call('website_start',{'template':'editorial','revision':site['revision']})
        Client(base).call('website',expected=401)
        a.call('website_save',{'draft':site['draft'],'revision':site['revision']},csrf=False,expected=403)
        member=Client(base);m=member.login('member@example.test',log)
        with sqlite3.connect(db) as c:
            c.execute("INSERT INTO studio_members(studio_id,user_id,role) VALUES(?,?,'member')",(sid,m['user']['id']))
            c.execute('UPDATE sessions SET studio_id=? WHERE user_id=?',(sid,m['user']['id']))
        member.call('website_reset',{'confirm':True,'revision':site['revision']},expected=403);
        member.call('website',expected=403);member.call('website_publish',{'revision':1},expected=403)
        check(True,'Anonymous, non-admin and CSRF-less writes are denied')
        site['draft'].update(description='Calm interiors, thoughtful details.',intro='Welcome to our studio.',about='Designing spaces for everyday life.',email='hello@example.test')
        site=a.call('website_save',{'draft':site['draft'],'revision':site['revision']})
        from PIL import Image
        image=Image.new('RGB',(1400,1000),'#a18f77');out=io.BytesIO();image.save(out,format='PNG')
        asset=a.call('website_upload',{'data':base64.b64encode(out.getvalue()).decode()})['id']
        quote=a.call('project_testimonial_save',{'project_id':pid,'name':'Robin','title':'Homeowner','content':'Our home finally feels like us.','approved':True,'photo':base64.b64encode(out.getvalue()).decode()})['testimonials'][0]
        member.call('project_testimonials&project_id='+pid,expected=404)
        member.call('project_testimonial_photo&project_id='+pid+'&id='+quote['id'],expected=404)
        a.call('project_testimonial_save',{'project_id':pid,'name':'No CSRF','content':'Denied'},csrf=False,expected=403)
        a.call('project_testimonial_save',{'project_id':pid,'id':quote['id'],'revision':0,'name':'Stale','content':'Denied'},expected=409)
        photo,photo_headers=a.call('project_testimonial_photo&project_id='+pid+'&id='+quote['id'],raw=True)
        check(photo_headers['Content-Type']=='image/png' and photo==out.getvalue(),'Project testimonials and photos are scoped to authorized project access')

        d=site['draft'];d['projects']=[{'id':'a'*32,'source_id':'','slug':'willow-house','title':'Willow house','description':'A calm family home.','category':'Residential','location':'Amsterdam','included':True,'images':[{'asset':asset,'alt':'Warm oak furniture in the living room'}]}]
        site=a.call('website_save',{'draft':d,'revision':site['revision']})
        preview,headers=a.call('website_preview&website_studio='+sid,raw=True)
        check(headers['X-Robots-Tag']=='noindex, nofollow' and b'id="project-' in preview,'Private previews are noindex and projects stay on the same page')
        a.call('website_asset&id='+asset+'&website_studio='+m['studio']['id'],expected=404)
        a.call('website_chat',{'prompt':'Make it warmer','revision':site['revision']},expected=503)
        a.call('website_checkout',{},expected=409)  # Explicit local publishing mode is already active.
        site=a.call('website_publish',{'revision':site['revision']})
        public=urllib.request.urlopen(base+'/sites/'+sid+'/');published=public.read();check(public.headers['Content-Type'].startswith('text/html') and b'Willow house' in published,'Published website is accessible without login')
        package,_=a.call('website_export&website_studio='+sid,raw=True);z=zipfile.ZipFile(io.BytesIO(package));check('index.html' in z.namelist() and 'sitemap.xml' in z.namelist() and 'styles.css' in z.namelist() and 'script.js' in z.namelist() and not any('draft' in x or 'release.json' in x for x in z.namelist()),'Static export contains public files only')
        old=site['live']['release'];site['draft']['files']['index.html']=site['draft']['files']['index.html'].replace('Spaces made for living.','Draft only headline');site=a.call('website_save',{'draft':site['draft'],'revision':site['revision']});check(urllib.request.urlopen(base+'/sites/'+sid+'/').read()==published,'Saving through the API leaves public output unchanged')
        site=a.call('website_undo',{'revision':site['revision']});check('Draft only headline' not in site['draft']['files']['index.html'],'Undo restores previous draft')
        site=a.call('website_restore',{'release':old,'revision':site['revision']});check(site['live']['release']==old,'Restore changes draft without publishing')
        # Optional pages: real HTTP routing, preview permissions, export and whole-site restoration.
        member.call('website_page',{'operation':'add','name':'Denied','slug':'denied','revision':site['revision']},expected=403)
        a.call('website_page',{'operation':'add','name':'Denied','slug':'denied','revision':site['revision']},csrf=False,expected=403)
        created=a.call('website_page',{'operation':'add','kind':'contact','name':'Contact','slug':'contact','navigation':True,'revision':site['revision']});site=created['website'];page_id=created['page']
        preview,_=a.call('website_preview&page='+page_id+'&channel=page-test',raw=True)
        check(b'website-page-navigation' in preview and b'page-test' in preview and b'aria-current="page"' in preview and b'>Contact</a>' in preview,'Page preview includes safe navigation and active menu state')
        a.call('website_preview&page='+'0'*32,expected=404)
        page_file='pages/'+page_id+'.html';site['draft']['files'][page_file]=site['draft']['files'][page_file].replace('</main>','<img src="assets/'+asset+'.webp" alt="Studio"></main>')
        site=a.call('website_save',{'draft':site['draft'],'revision':site['revision']});site=a.call('website_publish',{'revision':site['revision']});multi=site['live']['release']
        public_base=base+'/sites/'+sid
        nested=urllib.request.urlopen(public_base+'/contact');check(nested.geturl().endswith('/contact/') and b'Contact |' in nested.read(),'Clean addresses normalize to a trailing slash and serve the correct page')
        html=urllib.request.urlopen(public_base+'/contact/').read();check(b'src="../assets/' in html and urllib.request.urlopen(public_base+'/contact/styles.css').code==200,'Nested pages resolve their styles and portable images')
        package,_=a.call('website_export',raw=True);z=zipfile.ZipFile(io.BytesIO(package));check('contact/index.html' in z.namelist() and 'contact/styles.css' in z.namelist() and 'header.html' not in z.namelist() and not any(x.startswith('pages/') for x in z.namelist()),'ZIP includes every compiled page without shared source files')
        for path in ['/pages/'+page_id+'.html','/contact/../../draft.json','/contact/%2e%2e/draft.json','/header.html']:
            try:urllib.request.urlopen(public_base+path);raise AssertionError('Source file exposed')
            except urllib.error.HTTPError as e:assert e.code==404
        site=a.call('website_page',{'operation':'update','id':page_id,'name':'Contact us','slug':'studio/contact','navigation':True,'revision':site['revision']})['website'];site=a.call('website_publish',{'revision':site['revision']})
        moved=urllib.request.urlopen(public_base+'/contact/');check(moved.geturl().endswith('/studio/contact/') and b'Contact us' in moved.read(),'Published old addresses redirect to renamed nested pages')
        pointer=tmp/'sites'/sid/'current.json';previous_pointer=pointer.read_text();domain_pointer=json.loads(previous_pointer);domain_pointer['domain']='pages.example.test';pointer.write_text(json.dumps(domain_pointer))
        try:
            custom=urllib.request.urlopen(urllib.request.Request(base+'/studio/contact/',headers={'Host':'pages.example.test'}));check(custom.code==200 and b'Contact us' in custom.read(),'Verified custom-domain routing serves nested pages from the same snapshot')
        finally:pointer.write_text(previous_pointer)
        site=a.call('website_restore',{'release':multi,'revision':site['revision']});check(len(site['draft']['pages'])==2 and site['draft']['pages'][1]['slug']=='contact' and site['live']['release']!=multi,'Restore recovers all pages and shared source without changing live output')
        site=a.call('website_restore',{'release':old,'revision':site['revision']});check(len(site['draft']['pages'])==1 and 'header.html' not in site['draft']['files'],'Restoring an older one-page release restores its original source layout')
        a.call('website_domain',{'name':'javascript:alert(1)'},expected=400)
        site=a.call('website_domain',{'name':'www.example.test'});a.call('website_domain',{'name':'www.example.test'},expected=503)
        check(not site['domain']['verified'],'Unconfigured DNS does not pretend a domain is connected')
        for path in ['/sites/'+sid+'/release.json','/sites/'+sid+'/assets/not-an-image.php']:
            try:urllib.request.urlopen(base+path);raise AssertionError('Private file exposed')
            except urllib.error.HTTPError as e:assert e.code==404
        site=a.call('website')
        a.call('website_reset',{'confirm':True,'revision':site['revision']},csrf=False,expected=403)
        a.call('website_reset',{'revision':site['revision']},expected=400)
        a.call('website_reset',{'confirm':True,'revision':site['revision']-1},expected=409)
        reset=a.call('website_reset',{'confirm':True,'revision':site['revision']})
        check(not reset['draft']['started'] and not reset['live'] and not reset['releases'] and not reset['can_undo'] and reset['domain']==site['domain'],'Confirmed reset removes the website and retains domain setup')
        a.call('website_asset&id='+asset,expected=404)
        a.call('website_undo',{'revision':reset['revision']},expected=400)
        a.call('website_restore',{'release':old,'revision':reset['revision']},expected=404)
        try:urllib.request.urlopen(base+'/sites/'+sid+'/');raise AssertionError('Reset website remains public')
        except urllib.error.HTTPError as e:assert e.code==404

        check(len(a.call('project_testimonials&project_id='+pid)['testimonials'])==1,'Website reset preserves original project testimonials')
        cookies=[{'name':c.name,'value':c.value,'domain':'127.0.0.1','path':'/'} for c in a.cookies]
        (tmp/'fixture.json').write_text(json.dumps({'studio':sid,'user':uid,'csrf':a.csrf,'cookies':cookies,'asset':asset,'project':pid,'testimonial':quote['id']}))
        print('Website API checks passed.')
    finally:server.terminate();server.wait();output.close()
if os.environ.get('STUDIODECK_TEST_EXPORT'):
    tmp=Path(os.environ['STUDIODECK_TEST_EXPORT']);tmp.mkdir(parents=True,exist_ok=True);run(tmp)
else:
    with tempfile.TemporaryDirectory(prefix='website-api-') as tmp:run(Path(tmp))
