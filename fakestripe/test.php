<?php
declare(strict_types=1);
// Runs real HTTP calls and signed webhooks against an isolated app database and fake store.
$root=dirname(__DIR__); $tmp=sys_get_temp_dir().'/fakestripe-test-'.bin2hex(random_bytes(5)); mkdir($tmp);
function free_port(): int { $s=stream_socket_server('tcp://127.0.0.1:0'); $address=stream_socket_get_name($s,false); fclose($s); return (int)substr(strrchr($address,':'),1); }
$fakePort=free_port(); $appPort=free_port(); $fake='http://127.0.0.1:'.$fakePort;
foreach (['APP_ENV'=>'local','APP_URL'=>'http://127.0.0.1:'.$appPort,'DATABASE_PATH'=>$tmp.'/app.sqlite','MAIL_TRANSPORT'=>'log','MAIL_LOG_PATH'=>$tmp.'/mail.log','STRIPE_API_URL'=>$fake.'/v1','STRIPE_SECRET_KEY'=>'sk_test_fakestripe','STRIPE_WEBHOOK_SECRET'=>'whsec_fakestripe_local','STRIPE_PORTAL_CONFIGURATION'=>'bpc_fakestrip','FAKESTRIPE_STATE_PATH'=>$tmp.'/state.json','FAKESTRIPE_PUBLIC_URL'=>$fake,'FAKESTRIPE_WEBHOOK_URL'=>'http://127.0.0.1:'.$appPort.'/stripe-webhook.php','FAKESTRIPE_WEBHOOK_SECRET'=>'whsec_fakestripe_local'] as $key=>$value) putenv($key.'='.$value);
foreach (['pass','extension','solo','studio','practice','extra_project','extra_seat'] as $key) putenv('STRIPE_PRICE_'.strtoupper($key).'=price_fakestrip_'.$key);
require $root.'/app/bootstrap.php';
function check(bool $v,string $message): void { if (!$v) throw new RuntimeException($message); echo "PASS $message\n"; }
function http(string $url,?array $p=null): array {
    $c=curl_init($url); curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>5]);
    if ($p!==null) curl_setopt_array($c,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($p)]);
    $body=curl_exec($c); $code=curl_getinfo($c,CURLINFO_HTTP_CODE); curl_close($c); return [$code,$body];
}
function app_call(string $action,array $body): array {
    global $appPort,$sessionToken,$csrf;
    $c=curl_init('http://127.0.0.1:'.$appPort.'/api.php?action='.$action);
    curl_setopt_array($c,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>10,CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body),CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-CSRF-Token: '.$csrf,'Cookie: studiodeck_session='.$sessionToken]]);
    $raw=curl_exec($c);$code=curl_getinfo($c,CURLINFO_HTTP_CODE);curl_close($c);return [$code,json_decode($raw,true)];
}
function choose(string $url,string $outcome): void {
    [$status,$html]=http($url); check($status===200,'Payment form is reachable');
    preg_match('/name="csrf" value="([^"]+)"/',$html,$m); check(!empty($m[1]),'Payment form has a CSRF token');
    [$status,$html]=http($url,['csrf'=>$m[1],'outcome'=>$outcome]); check($status===200 && str_contains($html,'Payment '.$outcome.'.'),'Form submits '.$outcome.' result');
}
function drain(bool $process=true): void {
    global $tmp;
    for ($i=0;$i<100;$i++) {
        usleep(100000); $state=json_decode(file_get_contents($tmp.'/state.json'),true);
        if (!array_filter($state['events'],fn($e)=>!$e['delivered'])) { if($process){billing_process_events(100); check(!one("SELECT 1 FROM stripe_events WHERE status!='done'"),'Signed webhooks delivered and processed');} return; }
    }
    throw new RuntimeException('Webhook delivery timed out');
}
$processes=[];
try {
    db();
    foreach ([[PHP_BINARY,'-S','127.0.0.1:'.$fakePort,$root.'/fakestripe/router.php'],[PHP_BINARY,'-S','127.0.0.1:'.$appPort,'-t',$root.'/public',$root.'/public/router.php'],[PHP_BINARY,$root.'/fakestripe/webhook-worker.php']] as $cmd) {
        $processes[]=proc_open($cmd,[0=>['file','/dev/null','r'],1=>['file',$tmp.'/server.log','a'],2=>['file',$tmp.'/server.log','a']],$pipes,$root);
    }
    for ($i=0;$i<100;$i++) { if (http($fake.'/health')[0]===200) break; usleep(30000); }
    check(http($fake.'/v1/prices')[0]===401,'API rejects missing credentials');
    $uid=id(); insert('users',['id'=>$uid,'email'=>'fake-test@example.test','name'=>'Test','created_at'=>now()]); $sid=create_studio($uid,'Test'); $u=['user_id'=>$uid,'studio_id'=>$sid,'email'=>'fake-test@example.test']; billing_onboard($u,['name'=>'Test','studio_name'=>'Test']);
    $pid=id(); insert('projects',['id'=>$pid,'studio_id'=>$sid,'user_id'=>$uid,'name'=>'House','created_at'=>now()]); insert('project_members',['project_id'=>$pid,'user_id'=>$uid]); insert('project_coverage',['project_id'=>$pid,'source'=>'trial']);
    $sessionToken=token();$csrf=token();insert('sessions',['token_hash'=>hash_token($sessionToken),'user_id'=>$uid,'studio_id'=>$sid,'csrf'=>$csrf,'expires_at'=>time()+3600]);
    // Reproduce the older deployed schema, including an order saved before customer creation failed.
    db()->exec('ALTER TABLE studio_billing DROP COLUMN customer_parameters');db()->exec("DELETE FROM migrations WHERE name='billing-customer-parameters-v1'");
    $oid=id();insert('billing_orders',['id'=>$oid,'studio_id'=>$sid,'project_id'=>$pid,'actor_id'=>$uid,'kind'=>'pass','plan'=>'pass','price_id'=>'price_fakestrip_pass','created_at'=>time(),'expires_at'=>time()+3600,'parameters'=>'{"extra_projects":0,"extra_seats":0}']);
    [$status,$r]=app_call('billing_resume_checkout',['order_id'=>$oid]);check($status===200 && $r['order_id']===$oid,'HTTP Resume migrates older database and recovers pending checkout');
    check(str_contains(http($fake.'/')[1],one('SELECT checkout_id FROM billing_orders WHERE id=?',[$oid])['checkout_id']),'Recovered checkout appears on simulator dashboard');
    [$status,$error]=app_call('billing_resume_checkout',['order_id'=>'missing']);check($status===404 && $error['debug']['exception']==='RuntimeException','Authenticated local API errors include technical diagnostics');
    $guest=http('http://127.0.0.1:'.$appPort.'/api.php?action=billing');check($guest[0]===401 && !isset(json_decode($guest[1],true)['debug']),'Unauthenticated errors do not expose technical diagnostics');
    $repeat=billing_checkout($u,['plan'=>'pass','project_id'=>$pid]); check($r===$repeat,'Repeated checkout resumes the same session');
    check(http($r['url'],['outcome'=>'accepted','csrf'=>'invalid'])[0]===403,'Payment rejects invalid CSRF');
    choose($r['url'],'declined');
    check(str_contains(http($r['url'])[1],'checkout=failed&amp;order='.$oid),'Decline return URL identifies failed checkout and order');
    drain(false);[$status]=app_call('billing_refresh',[]);check($status===200,'Billing refresh processes delivered checkout webhook without waiting for worker');
    check(one('SELECT status FROM billing_orders WHERE id=?',[$r['order_id']])['status']==='failed','Declined payment fails the order'); check(!one('SELECT 1 FROM project_access_grants WHERE project_id=?',[$pid]),'Declined payment grants no paid access');
    check(billing_access($pid)['can_edit'],'Declined purchase preserves an active trial');
    $trialEnd=billing_studio($sid)['trial_ends_at'];query('UPDATE studio_billing SET trial_ends_at=? WHERE studio_id=?',[time()-1,$sid]);
    $iid=id();insert('iterations',['id'=>$iid,'project_id'=>$pid,'number'=>1,'title'=>'Test','created_at'=>now()]);
    foreach(['theme','share'] as $action){[$status]=app_call($action,['iteration'=>$iid]);check($status===402,'Declined payment with expired trial blocks '.$action);}
    query('UPDATE studio_billing SET trial_ends_at=? WHERE studio_id=?',[$trialEnd,$sid]);
    $r=billing_checkout($u,['plan'=>'pass','project_id'=>$pid]); choose($r['url'],'accepted'); drain(); check(one('SELECT status FROM billing_orders WHERE id=?',[$r['order_id']])['status']==='paid','Accepted pass marks order paid'); check(billing_access($pid)['source']==='project_pass','Accepted pass grants project access');
    http($r['url'],['csrf'=>json_decode(file_get_contents($tmp.'/state.json'),true)['csrf'],'outcome'=>'accepted']); drain(); check((int)one('SELECT COUNT(*) n FROM project_access_grants WHERE project_id=?',[$pid])['n']===1,'Repeated acceptance does not duplicate access');
    $r=billing_checkout($u,['plan'=>'extension','project_id'=>$pid]); choose($r['url'],'accepted'); drain(); check((int)one('SELECT COUNT(*) n FROM project_access_grants WHERE project_id=?',[$pid])['n']===2,'Extension adds another access grant');
    $r=billing_checkout($u,['plan'=>'solo']); billing_cancel_checkout($u,$r['order_id']); check(one('SELECT status FROM billing_orders WHERE id=?',[$r['order_id']])['status']==='cancelled','Checkout cancellation expires the session');
    $r=billing_checkout($u,['plan'=>'solo','extra_projects'=>1]); choose($r['url'],'accepted'); drain(); check(billing_studio($sid)['plan']==='solo' && billing_subscription_active(billing_studio($sid)),'Subscription is active after accepted payment');
    [$status]=app_call('save_studio_user',['email'=>'second@example.test','name'=>'Second']);check($status===402,'Solo blocks a second studio member');
    $q=billing_change_preview($u,['plan'=>'studio']); check($q['amount']===15000,'Upgrade preview returns deterministic price difference'); $change=billing_change_confirm($u,$q['change_id']); check($change['status']==='payment_pending','Upgrade waits for invoice payment');
    choose($change['url'],'declined'); drain(); check(billing_studio($sid)['plan']==='solo','Declined upgrade retains existing plan');
    choose($change['url'],'accepted'); drain(); check(billing_studio($sid)['plan']==='studio','Paid upgrade applies new plan');
    check(one('SELECT status FROM billing_changes WHERE id=?',[$q['change_id']])['status']==='applied','Paid webhook clears payment_pending without periodic reconciliation');
    $added=[];
    for($n=2;$n<=5;$n++){[$status,$body]=app_call('save_studio_user',['email'=>'member'.$n.'@example.test','name'=>'Member '.$n]);check($status===200,'Studio accepts team member '.$n);$added[]=one('SELECT id FROM users WHERE email=?',['member'.$n.'@example.test'])['id'];}
    [$status]=app_call('save_studio_user',['email'=>'sixth@example.test','name'=>'Sixth']);check($status===402,'Studio rejects a sixth member even without project assignments');
    $practice=billing_change_preview($u,['plan'=>'practice','extra_projects'=>2,'extra_seats'=>2]);$upgrade=billing_change_confirm($u,$practice['change_id']);
    [$status]=app_call('save_studio_user',['email'=>'sixth@example.test','name'=>'Sixth']);check($status===402,'Unpaid Practice upgrade does not grant member capacity');
    choose($upgrade['url'],'accepted');drain();check(billing_limits(billing_studio($sid))['seats']===17,'Paid Practice includes 15 members plus two paid slots');
    for($n=6;$n<=17;$n++){[$status]=app_call('save_studio_user',['email'=>'member'.$n.'@example.test','name'=>'Member '.$n]);if($status!==200)throw new RuntimeException('Practice rejected included member '.$n);$added[]=one('SELECT id FROM users WHERE email=?',['member'.$n.'@example.test'])['id'];}
    [$status]=app_call('save_studio_user',['email'=>'eighteenth@example.test','name'=>'Eighteenth']);check($status===402,'Practice rejects members beyond purchased capacity');
    [$status]=app_call('billing_change_preview',['plan'=>'studio','extra_projects'=>0,'extra_seats'=>0]);check($status===409,'Downgrade rejects a plan smaller than the existing team');
    [$status]=app_call('billing_change_preview',['plan'=>'practice','extra_projects'=>2,'extra_seats'=>1]);check($status===409,'Seat reduction rejects capacity below existing team size');
    $remove=array_pop($added);app_call('remove_studio_user',['id'=>$remove]);
    $reduction=billing_change_preview($u,['plan'=>'practice','extra_projects'=>2,'extra_seats'=>1]);billing_change_confirm($u,$reduction['change_id']);
    [$status]=app_call('save_studio_user',['email'=>'reserved@example.test','name'=>'Reserved']);check($status===402,'Scheduled seat reduction reserves the future member limit');
    app_call('billing_cancel_change',['change_id'=>$reduction['change_id']]);
    foreach($added as $remove){[$status]=app_call('remove_studio_user',['id'=>$remove]);if($status!==200)throw new RuntimeException('Could not remove test member');}
    $q=billing_change_preview($u,['plan'=>'solo']); check(billing_change_confirm($u,$q['change_id'])['status']==='scheduled','Downgrade creates subscription schedule');
    $schedule=one('SELECT schedule_id FROM billing_changes WHERE id=?',[$q['change_id']])['schedule_id']; stripe_request('POST','subscription_schedules/'.$schedule.'/release',[],'test-release'); check(stripe_request('GET','subscription_schedules/'.$schedule)['status']==='released','Scheduled downgrade can be released');
    $portal=billing_portal($u); [$status,$html]=http($portal['url']); check($status===200 && str_contains($html,'Cancel at period end'),'Billing portal opens with cancellation controls');
    preg_match('/name="csrf" value="([^"]+)"/',$html,$m); http($portal['url'],['csrf'=>$m[1],'subscription'=>billing_studio($sid)['subscription_id'],'cancel'=>'true']); drain(); check((int)billing_studio($sid)['cancel_at_period_end']===1,'Portal cancellation synchronizes to app');
    check(count(billing_invoices($u))===5,'Invoice history is returned for this customer');
    $a=stripe_request('POST','customers',['name'=>'Idempotent'],'same-key'); $b=stripe_request('POST','customers',['name'=>'Idempotent'],'same-key'); check($a===$b,'API honors idempotency keys');
    passthru(escapeshellarg(PHP_BINARY).' '.escapeshellarg($root.'/scripts/setup-stripe.php'),$exit); check($exit===0,'Catalog setup script works against simulator');
    $sid=create_studio($uid,'Prepaid passes');$u['studio_id']=$sid;billing_onboard($u,['name'=>'Test','studio_name'=>'Prepaid passes']);query('UPDATE sessions SET studio_id=? WHERE token_hash=?',[$sid,hash_token($sessionToken)]);
    foreach(['','pass'] as $intent){[$status]=app_call('create_project',['name'=>'Unpaid project','billing_intent'=>$intent]);check($status===402,'No entitlement blocks creation with intent '.$intent);}
    query('UPDATE studio_billing SET legacy_exempt=1 WHERE studio_id=?',[$sid]);[$status]=app_call('create_project',['name'=>'Legacy bypass']);check($status===402,'Legacy exemption does not allow new unpaid projects');query('UPDATE studio_billing SET legacy_exempt=0 WHERE studio_id=?',[$sid]);
    [$status,$purchase]=app_call('billing_checkout',['plan'=>'pass']);check($status===200,'Pass checkout works before any project exists');
    [$status]=app_call('create_project',['name'=>'Pending payment','billing_intent'=>'pass']);check($status===402,'Pending pass does not allow project creation');
    choose($purchase['url'],'declined');drain();check(billing_available_passes($sid)===0,'Declined prepaid pass adds no creation rights');
    [$status,$purchase]=app_call('billing_checkout',['plan'=>'pass']);choose($purchase['url'],'accepted');drain();
    check(billing_available_passes($sid)===1 && !one('SELECT 1 FROM projects WHERE studio_id=?',[$sid]),'Accepted prepaid pass is available without creating a project');
    query('UPDATE billing_orders SET paid_at=? WHERE id=?',[time()-200*86400,$purchase['order_id']]);
    [$status]=app_call('create_project',['name'=>'Rollback test','billing_intent'=>'pass','starting_pack'=>['missing-version']]);check($status===404 && billing_available_passes($sid)===1 && !one('SELECT 1 FROM projects WHERE studio_id=?',[$sid]),'Failed project creation rolls back pass consumption');
    [$status,$created]=app_call('create_project',['name'=>'Prepaid project','billing_intent'=>'pass']);check($status===201,'Paid pass permits project creation');
    $access=billing_access($created['project_id']);check($access['source']==='project_pass' && $access['can_edit'] && abs($access['expires_at']-(time()+150*86400))<5,'Pass begins its 150 days on project creation, not purchase');
    check($access['designer_id']===$uid && billing_available_passes($sid)===0,'One pass is assigned to one project and its creator');
    [$status]=app_call('create_project',['name'=>'Second use','billing_intent'=>'pass']);check($status===402,'Used pass cannot create another project');
    [$status]=app_call('theme',['iteration'=>$created['iteration_id'],'theme'=>['style'=>'Modern']]);check($status===200,'New prepaid project is editable immediately');
    transaction(fn()=>delete_project_records($created['project_id']));check(billing_available_passes($sid)===0,'Deleting a project does not recycle its used pass');
    echo "All Fakestripe integration checks passed.\n";
} catch (Throwable $e) { fwrite(STDERR,$e."\n".(is_file($tmp.'/server.log')?file_get_contents($tmp.'/server.log'):'')); exit(1); }
finally { foreach ($processes as $p) { proc_terminate($p); proc_close($p); } }
