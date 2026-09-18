"""Real HTTP signup, billing isolation, expiry and export tests. No external services."""
import hashlib, hmac, http.cookiejar, io, json, os, shutil, socket, sqlite3, subprocess, tempfile, time, unittest, urllib.error, urllib.request, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class BillingTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='billing-test-'); self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)
        for name in ('app','public'):
            shutil.copytree(ROOT/name,self.path/name)
        self.db = self.path/'db.sqlite'; self.log=self.path/'mail.log'
        with socket.socket() as s: s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
        self.base=f'http://127.0.0.1:{port}'
        self.env={**os.environ,'DATABASE_PATH':str(self.db),'APP_ENV':'local','APP_URL':self.base,'MAIL_TRANSPORT':'log','MAIL_LOG_PATH':str(self.log),'DESIGNER_EMAILS':'','OPENAI_API_KEY':'','STRIPE_SECRET_KEY':'','STRIPE_WEBHOOK_SECRET':'whsec_test','BILLING_RETENTION_DELETE':'false'}
        self.output=open(self.path/'server.log','w');self.addCleanup(self.output.close)
        self.server=subprocess.Popen(['php','-d','display_errors=0','-S',f'127.0.0.1:{port}','-t',str(self.path/'public'),str(self.path/'public/router.php')],env=self.env,stdout=self.output,stderr=self.output)
        self.addCleanup(self.stop)
        self.client=self.new_client()
        for _ in range(100):
            try:self.call('session');break
            except urllib.error.URLError:time.sleep(.03)

    def stop(self):
        self.server.terminate();self.server.wait(timeout=5)
    def new_client(self):
        return {'opener':urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())),'csrf':''}
    def call(self,action,data=None,expected=200,client=None,extra=None,raw=False):
        c=client or self.client; headers={'X-CSRF-Token':c['csrf'],**(extra or {})}
        body=None if data is None else json.dumps(data).encode()
        if body is not None:headers['Content-Type']='application/json'
        req=urllib.request.Request(self.base+'/api.php?action='+action,data=body,headers=headers)
        try:r=c['opener'].open(req)
        except urllib.error.HTTPError as e:r=e
        value=r.read();self.assertEqual(r.code,expected,(action,value[:800],(self.path/'server.log').read_text()[-1000:]))
        return value if raw else json.loads(value)
    def sql(self,q,args=()):
        with sqlite3.connect(self.db) as db:return db.execute(q,args).fetchall()
    def login(self,email='admin@example.test',client=None,onboard=True):
        c=client or self.client;self.call('request_login',{'email':email},client=c)
        token=self.log.read_text().splitlines()[-1].split('/#/login/')[1]
        self.call('consume_login',{'token':token},client=c);s=self.call('session',client=c);c['csrf']=s['csrf']
        if onboard and s['billing'] and s['billing']['needs_onboarding']:s=self.call('billing_onboard',{'name':'Designer','studio_name':'Test studio'},client=c)
        return s
    def project(self):return self.call('create_project',{'name':'Trial project'},201)

    def test_verified_signup_trial_and_no_reset(self):
        self.call('request_login',{'email':'admin@example.test'})
        self.assertIsNone(self.sql('SELECT trial_started_at FROM studio_billing')[0][0])
        s=self.login(onboard=False);self.assertTrue(s['billing']['needs_onboarding'])
        self.call('create_project',{'name':'Premature'},402)
        self.call('billing_onboard',{'name':'Name','studio_name':'Studio'},403,extra={'X-CSRF-Token':'wrong'})
        s=self.call('billing_onboard',{'name':'Name','studio_name':'Studio'})
        self.assertAlmostEqual(s['billing']['trial_ends_at']-time.time(),7*86400,delta=3)
        self.project();self.call('create_project',{'name':'Second'},402)
        self.call('save_studio_user',{'name':'Second','email':'second@example.test'},402)
        other=self.call('create_studio',{'name':'Another'},201)
        other=self.call('billing_onboard',{'name':'Name','studio_name':'Another'})
        self.assertFalse(other['billing']['trial_active'])
        self.call('create_project',{'name':'Another free trial'},402)

    def test_expiry_restricts_writes_but_allows_downloads_and_archive(self):
        s=self.login();p=self.project();pid=p['project_id'];iid=p['iteration_id']
        self.call('theme',{'iteration':iid,'theme':{'style':'Modern'}})
        self.sql('UPDATE studio_billing SET trial_ends_at=?',(int(time.time())-1,))
        d=self.call('project&id='+pid);self.assertFalse(d['can_edit']);self.assertFalse(d['billing']['active'])
        for action,body in [('theme',{'iteration':iid}),('new_iteration',{'iteration':iid}),('share',{'iteration':iid}),('comment',{'iteration':iid,'body':'No'}),('budget_chat',{'iteration':iid,'question':'No'}),('project_settings',{'project_id':pid,'location':'No'})]:
            self.call(action,body,402)
        data=self.call('project_export&project_id='+pid,raw=True)
        with zipfile.ZipFile(io.BytesIO(data)) as z:self.assertEqual(json.loads(z.read('project.json'))['project']['id'],pid)
        self.call('project_settings',{'project_id':pid,'archived':True})
        self.call('project_settings',{'project_id':pid,'archived':False},402)
        self.call('billing')

    def test_admin_billing_and_tenant_isolation(self):
        s=self.login();sid=s['studio']['id'];p=self.project()
        self.sql("INSERT INTO users(id,email,name,created_at) VALUES('member','member@example.test','Member','2026-01-01')")
        self.sql("INSERT INTO studio_members(studio_id,user_id,role) VALUES(?,'member','member')",(sid,))
        member=self.new_client();self.login('member@example.test',member)
        for a in ['billing','billing_invoices']:self.call(a,expected=403,client=member)
        for a,body in [('billing_checkout',{'plan':'pass','project_id':p['project_id']}),('billing_portal',{}),('billing_refresh',{}),('billing_coverage',{'project_id':p['project_id'],'source':'subscription'})]:self.call(a,body,403,client=member)
        other=self.new_client();self.login('other@example.test',other)
        self.call('project_export&project_id='+p['project_id'],expected=404,client=other)
        self.call('billing',expected=404,client=other,extra={'X-Studio-ID':sid})
        self.call('billing_coverage',{'project_id':p['project_id'],'source':'subscription'},404,client=other)

    def test_unpaid_pass_cannot_create_project(self):
        self.login();self.call('create_project',{'name':'Paid later','billing_intent':'pass'},402)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM projects')[0][0],0)

    def pass_credit(self,session,status='paid'):
        oid=os.urandom(12).hex()
        self.sql("INSERT INTO billing_orders(id,studio_id,actor_id,kind,plan,price_id,status,created_at,paid_at,expires_at) VALUES(?,?,?,'pass','pass','price_pass',?,?,?,?)",(oid,session['studio']['id'],session['user']['id'],status,int(time.time()),int(time.time()),int(time.time())+3600))
        return oid

    def test_prepaid_pass_is_tenant_bound_and_consumed_once(self):
        s=self.login();self.sql('UPDATE studio_billing SET trial_ends_at=?',(int(time.time())-1,))
        for status in ['pending','failed','refunded']:
            oid=self.pass_credit(s,status)
            self.call('create_project',{'name':'Not paid','billing_intent':'pass'},402)
            self.sql('DELETE FROM billing_orders WHERE id=?',(oid,))
        self.pass_credit(s)
        other=self.new_client();self.login('other@example.test',other)
        self.call('create_project',{'name':'Wrong studio','billing_intent':'pass'},402,client=other)
        self.assertEqual(self.call('billing')['summary']['available_passes'],1)
        p=self.call('create_project',{'name':'Paid project','billing_intent':'pass'},201)
        self.assertEqual(self.call('project&id='+p['project_id'])['billing']['source'],'project_pass')
        self.assertEqual(self.call('billing')['summary']['available_passes'],0)
        self.call('create_project',{'name':'Reuse pass','billing_intent':'pass'},402)

    def subscription(self):
        self.sql("UPDATE studio_billing SET plan='solo',subscription_status='active',paid_until=?",(int(time.time())+86400,))

    def test_capacity_existing_access_and_atomic_swap(self):
        s=self.login();self.subscription();projects=[self.project() for _ in range(3)]
        first=projects[0]['project_id']
        self.assertEqual(self.call('project_access&project_id='+first)['reason'],'ready')
        self.call('theme',{'iteration':projects[0]['iteration_id'],'theme':{'style':'Still editable'}})
        self.assertEqual(self.call('project_access')['reason'],'capacity')
        self.pass_credit(s)
        draft=self.call('create_project',{'name':'Separate pass','billing_intent':'pass'},201)['project_id']
        self.assertTrue(self.call('project_access&project_id='+draft)['full'])
        self.call('project_activate',{'project_id':draft,'source':'subscription'},402)
        self.call('project_activate',{'project_id':draft,'source':'project_pass','archive_project_id':first},409)
        self.assertEqual(self.sql('SELECT archived FROM projects WHERE id=?',(first,))[0][0],0)
        self.call('project_activate',{'project_id':draft,'source':'subscription','archive_project_id':first})
        self.assertEqual(self.sql('SELECT archived FROM projects WHERE id=?',(first,))[0][0],1)
        self.assertEqual(self.call('billing')['summary']['usage']['projects'],3)
        # Retry neither consumes another slot nor archives a different project.
        self.call('project_activate',{'project_id':draft,'source':'subscription'})
        self.call('project_activate',{'project_id':first,'source':'subscription'},402)
        self.call('project_settings',{'project_id':first,'archived':False},402)
        self.call('project_activate',{'project_id':first,'source':'subscription','archive_project_id':draft})
        self.assertEqual(self.call('billing')['summary']['usage']['projects'],3)
        # A stale archive selection cannot partially modify either project.
        self.call('project_activate',{'project_id':draft,'source':'subscription','archive_project_id':draft},400)
        self.assertEqual(self.sql('SELECT archived FROM projects WHERE id=?',(draft,))[0][0],1)

    def test_access_permissions_and_expiry_reasons(self):
        s=self.login();p=self.project();pid=p['project_id'];sid=s['studio']['id']
        self.sql('UPDATE studio_billing SET trial_ends_at=?',(int(time.time())-1,))
        self.assertEqual(self.call('project_access&project_id='+pid)['reason'],'trial_expired')
        r=self.call('theme',{'iteration':p['iteration_id']},402);self.assertEqual(r['project_access'],pid)
        self.sql("INSERT INTO users(id,email,name,created_at) VALUES('member','member@example.test','Member','2026-01-01')")
        self.sql("INSERT INTO studio_members(studio_id,user_id,role) VALUES(?,'member','member')",(sid,))
        self.sql("INSERT INTO project_members(project_id,user_id) VALUES(?,'member')",(pid,))
        member=self.new_client();self.login('member@example.test',member)
        decision=self.call('project_access&project_id='+pid,client=member)
        self.assertFalse(decision['admin']);self.assertFalse(decision['can_buy_pass'])
        self.subscription()
        self.call('project_activate',{'project_id':pid,'source':'subscription'},403,client=member)
        other=self.new_client();self.login('other@example.test',other)
        self.call('project_access&project_id='+pid,expected=404,client=other)
        self.call('project_activate',{'project_id':pid,'source':'subscription'},404,client=other)
        self.call('project_activate',{'project_id':pid,'source':'subscription'},403,extra={'X-CSRF-Token':'wrong'})
        self.call('project_activate',{'project_id':pid,'source':'subscription'})
        self.sql("UPDATE studio_billing SET subscription_status='past_due',paid_until=? WHERE studio_id=?",(int(time.time())-86400,sid))
        self.assertEqual(self.call('project_access&project_id='+pid)['reason'],'ready')
        self.sql('UPDATE studio_billing SET paid_until=? WHERE studio_id=?',(int(time.time())-3*86400,sid))
        self.assertEqual(self.call('project_access&project_id='+pid)['reason'],'payment_required')

    def test_concurrent_restores_only_one_takes_last_slot(self):
        s=self.login();self.subscription();projects=[self.project() for _ in range(3)]
        archived=projects.pop()['project_id'];self.call('project_settings',{'project_id':archived,'archived':True})
        second=self.project()['project_id'];self.call('project_settings',{'project_id':second,'archived':True})
        u={'user_id':s['user']['id'],'studio_id':s['studio']['id'],'email':s['user']['email']}
        script=self.path/'restore.php'
        script.write_text("<?php require __DIR__.'/app/bootstrap.php';try{billing_activate_project(json_decode($argv[1],true),['project_id'=>$argv[2],'source'=>'subscription']);echo 'ok';}catch(RuntimeException $e){echo $e->getCode();}")
        jobs=[subprocess.Popen(['php',str(script),json.dumps(u),pid],env=self.env,stdout=subprocess.PIPE,stderr=subprocess.PIPE) for pid in [archived,second]]
        results=[j.communicate(timeout=10) for j in jobs]
        self.assertEqual(sorted(r[0] for r in results),[b'402',b'ok'],results)
        self.assertEqual(self.call('billing')['summary']['usage']['projects'],3)

    def test_archive_and_create_rolls_back_when_creation_fails(self):
        self.login();self.subscription();projects=[self.project() for _ in range(3)];pid=projects[0]['project_id']
        self.call('create_project',{'name':'Bad pack','archive_project_id':pid,'starting_pack':['missing']},404)
        self.assertEqual(self.sql('SELECT archived FROM projects WHERE id=?',(pid,))[0][0],0)
        self.call('create_project',{'name':'Replacement','archive_project_id':pid},201)
        self.assertEqual(self.sql('SELECT archived FROM projects WHERE id=?',(pid,))[0][0],1)
        self.assertEqual(self.call('billing')['summary']['usage']['projects'],3)

    def test_pass_restoration_does_not_consume_subscription_capacity(self):
        s=self.login();self.subscription();[self.project() for _ in range(3)]
        oid=self.pass_credit(s)
        pid=self.call('create_project',{'name':'Pass project','billing_intent':'pass'},201)['project_id']
        at=self.sql('SELECT paid_at FROM project_access_grants WHERE order_id=?',(oid,))[0][0]
        self.call('project_settings',{'project_id':pid,'archived':True})
        d=self.call('project_access&project_id='+pid);self.assertTrue(d['can_use_pass']);self.assertEqual(d['reason'],'archived')
        self.call('project_activate',{'project_id':pid,'source':'project_pass'})
        self.assertEqual(self.call('billing')['summary']['usage']['projects'],3)
        self.assertEqual(self.call('project_access&project_id='+pid)['access']['expires_at'],at+150*86400)
        self.sql("UPDATE project_access_grants SET paid_at=? WHERE order_id=?",(at-151*86400,oid))
        d=self.call('project_access&project_id='+pid);self.assertEqual(d['reason'],'pass_expired');self.assertTrue(d['has_pass']);self.assertTrue(d['can_buy_pass'])
        self.call('project_activate',{'project_id':pid,'source':'project_pass'},402)
        self.call('project_activate',{'project_id':pid,'source':'subscription'},402)

    def test_concurrent_creations_cannot_spend_one_pass_twice(self):
        s=self.login();self.pass_credit(s)
        u={'user_id':s['user']['id'],'studio_id':s['studio']['id']}
        script=self.path/'redeem.php'
        script.write_text("""<?php require __DIR__.'/app/bootstrap.php';
        $u=json_decode($argv[1],true);try{transaction(function()use($u){
            $source=billing_new_project($u,'pass');$pid=id();
            insert('projects',['id'=>$pid,'studio_id'=>$u['studio_id'],'user_id'=>$u['user_id'],'name'=>'Concurrent','created_at'=>now()]);
            insert('project_coverage',['project_id'=>$pid,'source'=>$source]);
            insert('project_members',['project_id'=>$pid,'user_id'=>$u['user_id']]);
            billing_redeem_pass($u,$pid);
        });echo 'ok';}catch(RuntimeException $e){echo $e->getCode();}""")
        jobs=[subprocess.Popen(['php',str(script),json.dumps(u)],env=self.env,stdout=subprocess.PIPE,stderr=subprocess.PIPE) for _ in range(2)]
        results=[job.communicate(timeout=10) for job in jobs]
        self.assertEqual(sorted(r[0] for r in results),[b'402',b'ok'],results)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM projects')[0][0],1)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM project_access_grants')[0][0],1)

    def test_webhook_signature_durable_deduplication(self):
        event={'id':'evt_test','type':'unhandled.test','data':{'object':{'id':'unused'}}};body=json.dumps(event).encode();at=str(int(time.time()))
        signature=hmac.new(b'whsec_test',at.encode()+b'.'+body,hashlib.sha256).hexdigest()
        def post(sig,expected):
            req=urllib.request.Request(self.base+'/stripe-webhook.php',data=body,headers={'Stripe-Signature':sig,'Content-Type':'application/json'})
            try:r=urllib.request.urlopen(req)
            except urllib.error.HTTPError as e:r=e
            self.assertEqual(r.code,expected,r.read())
        post('t='+at+',v1=bad',400);post('t='+str(int(at)-1000)+',v1='+signature,400)
        post('t='+at+',v1='+signature,200);post('t='+at+',v1='+signature,200)
        self.assertEqual(self.sql('SELECT COUNT(*) FROM stripe_events')[0][0],1)

if __name__=='__main__':unittest.main(verbosity=2)
