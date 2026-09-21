<?php
declare(strict_types=1);
// Contract tests for server-bound checkout, Stripe event recovery and package changes.
$dir=sys_get_temp_dir().'/sd-stripe-'.bin2hex(random_bytes(5));mkdir($dir);putenv('DATABASE_PATH='.$dir.'/db.sqlite');putenv('APP_ENV=local');putenv('MAIL_TRANSPORT=log');putenv('MAIL_LOG_PATH='.$dir.'/mail.log');putenv('STRIPE_PORTAL_CONFIGURATION=bpc_test');
foreach(['pass','extension','solo','studio','practice','extra_project','extra_seat'] as $key)putenv('STRIPE_PRICE_'.strtoupper($key).'=price_'.$key);
require __DIR__.'/../app/bootstrap.php';
function ok(bool $v,string $m): void {if(!$v)throw new RuntimeException($m);echo "PASS $m\n";}
function rejects(callable $f,int $code): void {try{$f();}catch(RuntimeException $e){ok($e->getCode()===$code,'Request rejected with '.$code);return;}throw new RuntimeException('Missing rejection');}
db();$uid=id();insert('users',['id'=>$uid,'email'=>'test@example.test','name'=>'Tester','created_at'=>now()]);$sid=create_studio($uid,'Studio');$u=['user_id'=>$uid,'studio_id'=>$sid,'email'=>'test@example.test'];billing_onboard($u,['name'=>'Tester','studio_name'=>'Studio']);
$pid=id();insert('projects',['id'=>$pid,'studio_id'=>$sid,'user_id'=>$uid,'name'=>'House','created_at'=>now()]);insert('project_members',['project_id'=>$pid,'user_id'=>$uid]);insert('project_coverage',['project_id'=>$pid,'source'=>'trial']);insert('iterations',['id'=>id(),'project_id'=>$pid,'number'=>1,'title'=>'First','created_at'=>now()]);
$calls=[];$sessions=[];$sub=null;$quote=1234;$failOnce=false;$schedule=null;
$GLOBALS['stripe_test_transport']=function($method,$path,$params,$key)use(&$calls,&$sessions,&$sub,&$quote,&$failOnce,&$schedule){
    $calls[]=[$method,$path,$params,$key];
    if($path==='customers')return ['id'=>'cus_test'];
    if($path==='checkout/sessions'){
        $session=['id'=>'cs_'.$params['metadata']['order_id'],'metadata'=>$params['metadata'],'customer'=>$params['customer'],'url'=>'https://checkout.stripe.com/test','status'=>'open','payment_status'=>'unpaid','mode'=>$params['mode'],'lines'=>$params['line_items']];$sessions[$session['id']]=$session;return $session;
    }
    if(str_starts_with($path,'checkout/sessions/')){
        $parts=explode('/',$path);$id=$parts[2];if(($parts[3]??'')==='expire'){$sessions[$id]['status']='expired';return $sessions[$id];}
        if(($parts[3]??'')==='line_items')return ['data'=>$sessions[$id]['lines']];return $sessions[$id];
    }
    if($path==='invoices/create_preview')return ['amount_due'=>$quote,'currency'=>'eur'];
    if(str_starts_with($path,'subscriptions/')){
        if($method==='POST'){
            if($failOnce){$failOnce=false;throw new RuntimeException('Simulated network interruption',503);}
            $items=[];foreach($params['items'] as $i)if(empty($i['deleted']))$items[]=['id'=>$i['id']??'si_extra','price'=>['id'=>$i['price']],'quantity'=>$i['quantity'],'current_period_start'=>time()-86400,'current_period_end'=>time()+29*86400];
            $sub['items']['data']=$items;$sub['latest_invoice']=['status'=>'paid','hosted_invoice_url'=>'https://invoice.stripe.com/test'];
        }return $sub;
    }
    if($path==='subscription_schedules')return $schedule=['id'=>'sched_test','phases'=>[['start_date'=>time()-86400,'items'=>array_map(fn($i)=>['price'=>$i['price'],'quantity'=>$i['quantity']],$sub['items']['data'])]]];
    if(str_starts_with($path,'subscription_schedules/')){if($method==='POST')$schedule['phases']=$params['phases']??$schedule['phases'];return $schedule;}
    if($path==='billing_portal/configurations/bpc_test')return ['features'=>['subscription_update'=>['enabled'=>false]]];
    if($path==='billing_portal/sessions')return ['url'=>'https://billing.stripe.com/test'];
    throw new RuntimeException('Unexpected call '.$method.' '.$path);
};
$r=billing_checkout($u,['plan'=>'pass','project_id'=>$pid]);$r2=billing_checkout($u,['plan'=>'pass','project_id'=>$pid]);ok($r['order_id']===$r2['order_id'],'Repeat purchase click resumes one pending order');
$creates=array_values(array_filter($calls,fn($c)=>$c[1]==='checkout/sessions'));ok(count($creates)===1,'One Stripe Checkout session is created');$params=$creates[0][2];
ok($params['mode']==='payment'&&$params['invoice_creation']['enabled']==='true','Pass uses a one-time checkout with a paid invoice');ok($params['line_items'][0]['price']==='price_pass','Checkout price comes from server catalog');ok($params['customer']==='cus_test','Checkout bound to studio customer');
rejects(fn()=>billing_checkout($u,['plan'=>'extension','project_id'=>$pid]),409);
billing_cancel_checkout($u,$r['order_id']);ok(one('SELECT status FROM billing_orders WHERE id=?',[$r['order_id']])['status']==='cancelled','Cancel expires the Stripe checkout before clearing the pending order');
$r=billing_checkout($u,['plan'=>'solo','extra_projects'=>2]);$order=one('SELECT * FROM billing_orders WHERE id=?',[$r['order_id']]);$s=$sessions[$order['checkout_id']];$s['status']='complete';$s['payment_status']='paid';$s['subscription']='sub_test';$s['invoice']='in_first';$sessions[$s['id']]=$s;
$sub=['id'=>'sub_test','metadata'=>['order_id'=>$order['id']],'customer'=>'cus_test','status'=>'active','cancel_at_period_end'=>false,'items'=>['data'=>[['id'=>'si_plan','price'=>['id'=>'price_solo'],'quantity'=>1,'current_period_start'=>time()-86400,'current_period_end'=>time()+29*86400],['id'=>'si_extra','price'=>['id'=>'price_extra_project'],'quantity'=>2,'current_period_end'=>time()+29*86400]]],'latest_invoice'=>['status'=>'paid']];
billing_fulfill_checkout($s);ok(billing_access($pid)['source']==='subscription','Subscription purchase converts existing trial project');ok(billing_limits(billing_studio($sid))['projects']===5,'Explicit recurring extra projects add capacity');
rejects(fn()=>billing_checkout($u,['plan'=>'studio']),409);
// Upgrades preview a concrete amount, and retry an interrupted confirmation with the same key.
$q=billing_change_preview($u,['plan'=>'studio','extra_projects'=>0,'extra_seats'=>0]);ok($q['amount']===1234&&!$q['scheduled'],'Upgrade presents Stripe proration quote');
$failOnce=true;rejects(fn()=>billing_change_confirm($u,$q['change_id']),503);ok(one('SELECT status FROM billing_changes WHERE id=?',[$q['change_id']])['status']==='applying','Network failure retains a resumable change');
$done=billing_change_confirm($u,$q['change_id']);ok($done['status']==='applied'&&billing_studio($sid)['plan']==='studio','Retry confirms upgrade and synchronizes paid capacity');
$updates=array_values(array_filter($calls,fn($c)=>$c[0]==='POST'&&$c[1]==='subscriptions/sub_test'));ok($updates[0][3]===$updates[1][3],'Confirmation retries use the same Stripe idempotency key');ok($updates[1][2]['payment_behavior']==='pending_if_incomplete','Upgrade never grants increased capacity on an unpaid pending update');
$q=billing_change_preview($u,['plan'=>'solo','extra_projects'=>0,'extra_seats'=>0]);ok($q['scheduled']&&$q['amount']===0,'Downgrade has no immediate charge');$done=billing_change_confirm($u,$q['change_id']);ok($done['status']==='scheduled','Downgrade is scheduled for renewal');
ok(billing_limits(billing_studio($sid))['projects']===3,'Scheduled reduction reserves the future project limit');ok($schedule['phases'][1]['items'][0]['price']==='price_solo','Scheduled renewal uses requested price');
// Older subscription events cannot overwrite the current one.
$old=$sub;$old['id']='sub_old';$old['status']='canceled';$old['metadata']=[];billing_sync_subscription($old);ok(billing_studio($sid)['subscription_id']==='sub_test','Stale subscription event cannot replace current subscription');
$portal=billing_portal($u);ok($portal['url']==='https://billing.stripe.com/test','Portal is bound to authenticated studio customer');
// Inbox is durable, retries errors, and ignores duplicate completed delivery.
$e=['id'=>'evt_retry','type'=>'customer.subscription.updated','data'=>['object'=>['id'=>'sub_test']]];insert('stripe_events',['id'=>$e['id'],'type'=>$e['type'],'payload'=>json_encode($e),'received_at'=>time()]);billing_process_events();ok(one('SELECT status FROM stripe_events WHERE id=?',[$e['id']])['status']==='done','Durable webhook inbox processes subscription event');$count=count($calls);billing_process_events();ok(count($calls)===$count,'Completed event is not processed twice');
echo "All Stripe contract checks passed.\n";
// The package button skips app confirmation; Stripe calculates and invoices all changes.
query("UPDATE billing_changes SET status='cancelled' WHERE status='scheduled'");
$direct=billing_change_checkout($u,['plan'=>'practice','extra_projects'=>2,'extra_seats'=>3]);
ok($direct['url']==='https://invoice.stripe.com/test','Direct package update opens the Stripe-hosted invoice');
$updates=array_values(array_filter($calls,fn($c)=>$c[0]==='POST'&&$c[1]==='subscriptions/sub_test'));$update=end($updates)[2];
ok($update['proration_behavior']==='always_invoice'&&$update['payment_behavior']==='pending_if_incomplete','Stripe calculates prorations and applies capacity only after successful payment');
ok(billing_limits(billing_studio($sid))===['seats'=>18,'projects'=>52],'Direct update uses the selected package and capacity');
$schedules=count(array_filter($calls,fn($c)=>$c[1]==='subscription_schedules'));$quote=0;
$direct=billing_change_checkout($u,['plan'=>'solo','extra_projects'=>0,'extra_seats'=>0]);
ok($direct['url']==='https://invoice.stripe.com/test'&&billing_studio($sid)['plan']==='solo','Direct downgrade also uses Stripe invoice calculations');
ok(count(array_filter($calls,fn($c)=>$c[1]==='subscription_schedules'))===$schedules,'Direct updates do not create app-managed downgrade schedules');
$failOnce=true;rejects(fn()=>billing_change_checkout($u,['plan'=>'studio','extra_projects'=>1,'extra_seats'=>1]),503);
$retry=billing_change_checkout($u,['plan'=>'studio','extra_projects'=>1,'extra_seats'=>1]);
$updates=array_values(array_filter($calls,fn($c)=>$c[0]==='POST'&&$c[1]==='subscriptions/sub_test'));
ok($retry['url']==='https://invoice.stripe.com/test'&&$updates[count($updates)-1][3]===$updates[count($updates)-2][3],'Direct retry resumes the same Stripe update without a second charge');
rejects(fn()=>billing_change_checkout($u,['plan'=>'studio','extra_projects'=>-1]),400);
echo "Direct Stripe handoff checks passed.\n";
