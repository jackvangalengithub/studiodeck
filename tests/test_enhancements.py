"""Project image quotas, retained branches and shared snapshots. No external AI/email."""
from pathlib import Path
import base64, concurrent.futures, http.cookiejar, io, json, os, sqlite3, subprocess, tempfile, time
import urllib.request, urllib.error
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
PHP=os.environ.get('PHP_BIN','php')
def check(value,message):
    if not value: raise AssertionError(message)
    print('PASS',message,flush=True)
class Client:
    def __init__(self,base):
        self.base=base; self.csrf=''; self.bearer=''; self.client_share=''
        self.cookies=http.cookiejar.CookieJar()
        self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
    def call(self,action,data=None,query='',expected=200,raw=False):
        headers={'X-CSRF-Token':self.csrf}
        if self.bearer: headers['Authorization']='Bearer '+self.bearer
        if self.client_share: headers['Authorization']='Client '+self.client_share
        body=None if data is None else json.dumps(data).encode()
        if body: headers['Content-Type']='application/json'
        req=urllib.request.Request(self.base+'/api.php?action='+action+query,data=body,headers=headers)
        try: response=self.opener.open(req)
        except urllib.error.HTTPError as e: response=e
        content=response.read()
        if expected is not None: check(response.code==expected,f'{action} returns {expected}')
        if response.code!=expected and expected is not None: raise AssertionError(content)
        return (response.code,content) if expected is None else content if raw else json.loads(content)

with tempfile.TemporaryDirectory(prefix='studiodeck-enhancements-') as temp:
    tmp=Path(temp); base='http://127.0.0.1:8196'; dbfile=tmp/'test.sqlite'; log=tmp/'mail.log'
    env={**os.environ,'APP_ENV':'local','APP_URL':base,'DATABASE_PATH':str(dbfile),'MAIL_LOG_PATH':str(log),'MAIL_TRANSPORT':'log','OPENAI_API_KEY':'test-never-sent','DESIGNER_EMAILS':'','PHP_CLI_SERVER_WORKERS':'4'}
    output=open(tmp/'server.log','w')
    server=subprocess.Popen([PHP,'-S','127.0.0.1:8196','-t',str(ROOT/'public'),str(ROOT/'public/router.php')],env=env,stdout=output,stderr=output,start_new_session=True)
    def sql(q,args=()):
        with sqlite3.connect(dbfile) as conn: return conn.execute(q,args).fetchall()
    def php(code):
        r=subprocess.run([PHP,'-r','require '+json.dumps(str(ROOT/'app/ingest.php'))+'; '+code],env=env,check=True,capture_output=True,text=True)
        return json.loads(r.stdout)
    try:
        admin=Client(base)
        for _ in range(80):
            try: admin.call('session'); break
            except urllib.error.URLError: time.sleep(.1)
        admin.call('request_login',{'email':'quota@example.test'})
        tok=log.read_text().strip().splitlines()[-1].split('/#/login/')[1]
        admin.call('consume_login',{'token':tok});admin.csrf=admin.call('session')['csrf']
        # These legacy policy tests intentionally use a migration-exempt studio.
        sql('UPDATE studio_billing SET legacy_exempt=1,onboarded_at=1')
        def project(name): return admin.call('create_project',{'name':name},expected=201)
        p=project('Quota history');pid=p['project_id'];iid=p['iteration_id']
        png=io.BytesIO();Image.new('RGB',(24,16),'#ccbbaa').save(png,'PNG');blob=png.getvalue()
        # Seed an ordinary manual photo; production uploads are covered by test_manual_slides.
        php("insert('assets',['id'=>'asset','project_id'=>"+json.dumps(pid)+",'category'=>'renders','created_at'=>now()]);insert('file_versions',['id'=>'source','asset_id'=>'asset','number'=>1,'name'=>'room.png','mime'=>'image/png','size'=>1,'sha256'=>'test','data'=>base64_decode('"+base64.b64encode(blob).decode()+"'),'metadata'=>'{}','created_at'=>now()]);insert('iteration_files',['iteration_id'=>"+json.dumps(iid)+",'asset_id'=>'asset','version_id'=>'source','category'=>'renders']);insert('presentation_slides',['id'=>'slide','iteration_id'=>"+json.dumps(iid)+",'source_version_id'=>'source','type'=>'photo','title'=>'Room','position'=>0,'manual'=>1]);echo '{}';")
        def deck(iteration=None): return admin.call('project',query='&id='+pid+('&iteration='+iteration if iteration else ''))
        def enqueue(prompt,iteration=iid):
            sql('DELETE FROM rate_limits')
            return admin.call('slide_image_edit',{'iteration':iteration,'slide_id':'slide','prompt':prompt},expected=202)['id']
        def finish(jid):
            return php('$j=one("SELECT * FROM jobs WHERE id=?",['+json.dumps(jid)+']);$p=json_decode($j["payload"],true);$s=current_slide($j["iteration_id"],$p["slide_id"]);echo json_encode(save_slide_image_result($j,$s,$p,base64_decode("'+base64.b64encode(blob).decode()+'")));')
        for blocked_type in ['moodboard','floorplan','text','video']:
            sql('UPDATE presentation_slides SET type=? WHERE id=?',(blocked_type,'slide'))
            sql('DELETE FROM rate_limits')
            response=admin.call('slide_image_edit',{'iteration':iid,'slide_id':'slide','prompt':'Change this image.','ai_edit':True},expected=400)
            check('slide type' in response['error'],'Server rejects AI editing for '+blocked_type)
            check(deck()['enhancements']['used']==0,'Rejected edit does not reserve quota')
        sql("UPDATE presentation_slides SET type='photo' WHERE id='slide'")
        j=enqueue('Make the curtains warm linen. Keep the room unchanged.')
        check(deck()['enhancements']['remaining']==9,'Queued work reserves one project slot')
        first=finish(j); second=finish(enqueue('Add soft afternoon light.'))
        variants=deck()['slides'][0]['image_variants']
        check([v['id'] for v in variants]==[second,first] and variants[1]['summary']=='Make the curtains warm linen.','Versions have prompt summaries and stable creation order')
        admin.call('select_slide_image',{'iteration':iid,'slide_id':'slide','image_version_id':first})
        third=finish(enqueue('Use a muted green wall.'))
        check(len(deck()['slides'][0]['image_variants'])==3,'Generating from an older selection retains every branch')
        for v in [first,second,third]:
            check(admin.call('slide_image',query='&iteration='+iid+'&slide_id=slide&image_version_id='+v,raw=True)==blob,'Every retained image is retrievable')
        check(admin.call('slide_image',query='&iteration='+iid+'&slide_id=slide&original=1',raw=True)==blob,'Original remains available')
        admin.call('select_slide_image',{'iteration':iid,'slide_id':'slide','image_version_id':first})
        check(deck()['enhancements']['used']==3,'Selecting an older default does not use an enhancement')
        share=admin.call('share',{'iteration':iid,'emails':['client@example.test']})['links'][0]
        client=Client(base);client.call('request_login',{'email':'client@example.test'})
        client_token=log.read_text().strip().splitlines()[-1].split('/#/login/')[1]
        client.call('consume_login',{'token':client_token});client.csrf=client.call('session')['csrf'];client.client_share=share['id']
        check('enhancements' not in client.call('deck'),'Client receives images without owner quota controls')
        client.call('select_slide_image',{'iteration':iid,'slide_id':'slide','image_version_id':second},expected=403)
        admin.call('lock_iteration',{'iteration':iid})
        admin.call('select_slide_image',{'iteration':iid,'slide_id':'slide','image_version_id':second},expected=409)
        newer=admin.call('new_iteration',{'iteration':iid},expected=201)['id']
        check(len(deck(newer)['slides'][0]['image_variants'])==3,'New iteration inherits all branches, including unselected versions')
        fourth=finish(enqueue('A calm evening atmosphere.',newer))
        check(len(client.call('deck')['slides'][0]['image_variants'])==3,'New draft image does not alter the shared snapshot')
        client.call('slide_image',query='&iteration='+iid+'&slide_id=slide&image_version_id='+fourth,expected=404)
        check(deck(newer)['enhancements']['used']==4,'Usage is shared across iterations')
        # Retained legacy ancestry is readable without a history backfill.
        sql('DELETE FROM slide_image_history WHERE iteration_id=?',(iid,))
        check(client.call('deck')['slides'][0]['image_variants'][0]['id']==first,'Legacy default ancestry remains accessible')
        # Monthly reset excludes previous months; pass includes all project history.
        sql("UPDATE jobs SET created_at='2020-01-15T00:00:00Z' WHERE project_id=?",(pid,))
        check(deck(newer)['enhancements']['remaining']==10,'Monthly allowance resets without removing images')
        subprocess.run([PHP,str(ROOT/'scripts/set-project-enhancement-plan.php'),pid,'project_pass'],env=env,check=True,capture_output=True)
        check(deck(newer)['enhancements']['remaining']==6 and deck(newer)['enhancements']['resets_at'] is None,'Project Pass counts lifetime edits and never resets monthly')
        # Fill to nine, using both job types. The tenth slot is contested concurrently.
        for n in range(5):
            sql("INSERT INTO jobs(id,project_id,iteration_id,version_id,type,payload,status,created_at) VALUES(?,?,?,?,?,'{}','done',strftime('%Y-%m-%dT%H:%M:%SZ','now'))",('fill'+str(n),pid,newer,'source','image_edit' if n%2 else 'slide_image_edit'))
        sql('DELETE FROM rate_limits')
        def attempt(action):
            other=Client(base);other.cookies=admin.cookies;other.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(other.cookies));other.csrf=admin.csrf
            return other.call(action,{'iteration':newer,'slide_id':'slide','version_id':'source','prompt':'Warm light','plan_type':'monthly'},expected=None)
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(attempt,['image_edit','slide_image_edit']))
        check(sorted(r[0] for r in results)==[202,429],'Concurrent requests cannot spend the final slot twice or override the plan')
        check(deck(newer)['enhancements']['remaining']==0,'Both image endpoints share the same cap of ten')
        queued=json.loads(next(body for code,body in results if code==202))['id']
        sql("UPDATE jobs SET status='failed' WHERE id=?",(queued,))
        check(deck(newer)['enhancements']['remaining']==1,'Failed work releases its reservation')
        fifth=finish(enqueue('A touch of terracotta.',newer))
        check(len(deck(newer)['slides'][0]['image_variants'])==5,'All saved variants remain available at the cap')
        admin.call('select_slide_image',{'iteration':newer,'slide_id':'slide','image_version_id':second})
        check(deck(newer)['slides'][0]['image_version_id']==second,'Older versions can still be selected at zero remaining')
        if os.environ.get('STUDIODECK_TEST_EXPORT'):
            Path(os.environ['STUDIODECK_TEST_EXPORT']).write_text(json.dumps({'deck':deck(newer),'session':admin.call('session'),'png':base64.b64encode(blob).decode()}))
        another=project('Independent quota')
        check(admin.call('project',query='&id='+another['project_id'])['enhancements']['remaining']==10,'A different project has its own allowance')
        sql("INSERT INTO presentation_slides(id,iteration_id,source_version_id,type,title,position,manual) VALUES('sibling',?,'source','photo','Other crop',1,1)",(newer,))
        admin.call('slide_image',query='&iteration='+newer+'&slide_id=sibling&image_version_id='+fifth,expected=404)
        # Boundary calculation is deterministic and independent of server local timezone.
        sql("UPDATE project_enhancement_plans SET plan_type='monthly' WHERE project_id=?",(pid,))
        sql("UPDATE jobs SET created_at='2030-01-31T23:59:59Z' WHERE project_id=?",(pid,))
        allowance=php('echo json_encode(project_enhancement_allowance('+json.dumps(pid)+',new DateTimeImmutable("2030-02-01T01:00:00+01:00")));')
        check(allowance['remaining']==10 and allowance['resets_at']=='2030-03-01T00:00:00Z','Calendar-month reset uses exact UTC boundaries')
        confirmation=admin.call('prepare_delete_project',{'project_id':pid})
        admin.call('delete_project',{'project_id':pid,'confirmation':confirmation['confirmation'],'name':'Quota history','acknowledged':True})
        check(not sql('PRAGMA foreign_key_check') and not sql('SELECT * FROM slide_image_history') and not sql('SELECT * FROM project_enhancement_plans'),'Deleting a project cleans up image history and quota policy')
    finally:
        import signal
        os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=10);output.close()
