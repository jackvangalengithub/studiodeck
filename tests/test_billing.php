<?php
declare(strict_types=1);
// Lifecycle tests run in an isolated SQLite database with an in-process Stripe transport.
$dir=sys_get_temp_dir().'/sd-billing-'.bin2hex(random_bytes(6));mkdir($dir);
putenv('DATABASE_PATH='.$dir.'/db.sqlite');putenv('APP_ENV=local');putenv('MAIL_TRANSPORT=log');putenv('MAIL_LOG_PATH='.$dir.'/mail.log');putenv('BILLING_RETENTION_DELETE=false');
foreach(['pass','extension','solo','studio','practice','extra_project','extra_seat'] as $k)putenv('STRIPE_PRICE_'.strtoupper($k).'=price_'.$k);
require __DIR__.'/../app/bootstrap.php';
function check(bool $v,string $message): void {if(!$v)throw new RuntimeException($message);echo "PASS $message\n";}
function denied(callable $f,int $code): void {try{$f();}catch(RuntimeException $e){check($e->getCode()===$code,'Denied with '.$code.': '.$e->getMessage());return;}throw new RuntimeException('Expected denial '.$code);}
db();$uid=id();insert('users',['id'=>$uid,'email'=>'admin@example.test','name'=>'Admin','created_at'=>now()]);$sid=create_studio($uid,'Billing test');$u=['user_id'=>$uid,'studio_id'=>$sid,'email'=>'admin@example.test'];billing_onboard($u,['name'=>'Admin','studio_name'=>'Billing test']);
function project(array $u,string $source): string {
    $pid=id();insert('projects',['id'=>$pid,'studio_id'=>$u['studio_id'],'user_id'=>$u['user_id'],'name'=>'Test','created_at'=>now()]);insert('project_members',['project_id'=>$pid,'user_id'=>$u['user_id']]);insert('project_coverage',['project_id'=>$pid,'source'=>$source]);insert('iterations',['id'=>id(),'project_id'=>$pid,'number'=>1,'title'=>'First','created_at'=>now()]);return $pid;
}
$pid=transaction(function()use($u){return project($u,billing_new_project($u));});
check(billing_access($pid)['active'],'Trial grants access');check(project_enhancement_allowance($pid)['limit']===3,'Trial has three image enhancements');
transaction(fn()=>billing_reserve_usage($pid,'uploads',30));denied(fn()=>transaction(fn()=>billing_reserve_usage($pid,'uploads')),402);
query('UPDATE studio_billing SET customer_id=? WHERE studio_id=?',['cus_test',$sid]);
$paidAt=time();$session=['id'=>'cs_pass','customer'=>'cus_test','metadata'=>['order_id'=>'order_pass'],'payment_status'=>'unpaid','status'=>'complete','payment_intent'=>'pi_pass','invoice'=>'in_pass'];
insert('billing_orders',['id'=>'order_pass','studio_id'=>$sid,'project_id'=>$pid,'actor_id'=>$uid,'kind'=>'pass','plan'=>'pass','price_id'=>'price_pass','checkout_id'=>'cs_pass','created_at'=>$paidAt,'expires_at'=>$paidAt+3600]);
$price='price_pass';$sub=[];$latestChargeTime=$paidAt;$refunded=false;$requests=[];
$GLOBALS['stripe_test_transport']=function($method,$path,$params,$key)use(&$price,&$session,&$sub,&$latestChargeTime,&$refunded,&$requests){
    $requests[]=[$method,$path,$params,$key];
    if(str_ends_with($path,'/line_items'))return ['data'=>[['price'=>['id'=>$price],'quantity'=>1]]];
    if(str_starts_with($path,'checkout/sessions/'))return $session;
    if(str_starts_with($path,'payment_intents/'))return ['status'=>'succeeded','latest_charge'=>['created'=>$latestChargeTime]];
    if(str_starts_with($path,'subscriptions/'))return $sub;
    if(str_starts_with($path,'invoices/'))return ['status'=>'paid','status_transitions'=>['paid_at'=>$latestChargeTime]];
    if(str_starts_with($path,'charges/'))return ['refunded'=>$refunded,'payment_intent'=>'pi_extension'];
    throw new RuntimeException('Unexpected Stripe call '.$method.' '.$path);
};
billing_fulfill_checkout($session);check(!one('SELECT 1 FROM project_access_grants'),'Unpaid completed checkout does not grant access');
$session['payment_status']='paid';billing_fulfill_checkout($session);$expiry=billing_pass_expiry($pid);
check($expiry===$paidAt+150*BILLING_DAY,'Initial pass runs 150 days');check(billing_access($pid)['source']==='project_pass','Paid pass attaches to the same project');
billing_fulfill_checkout($session);check(billing_pass_expiry($pid)===$expiry,'Duplicate checkout does not extend twice');
check(project_enhancement_allowance($pid)['limit']===10,'Paid pass uses lifetime enhancement allowance');
check(!billing_access($pid,$expiry)['active'],'Exact expiry boundary is restricted');check(billing_access($pid,$expiry-1)['active'],'Second before expiry remains active');
// A refund delivered before fulfillment cannot create paid access later.
$refundedPid=project($u,'none');insert('billing_orders',['id'=>'already_refunded','studio_id'=>$sid,'project_id'=>$refundedPid,'actor_id'=>$uid,'kind'=>'pass','plan'=>'pass','price_id'=>'price_pass','checkout_id'=>'cs_refunded','created_at'=>$paidAt,'expires_at'=>$paidAt+3600]);
$savedTransport=$GLOBALS['stripe_test_transport'];
$GLOBALS['stripe_test_transport']=function($method,$path,$params,$key)use($savedTransport){$r=$savedTransport($method,$path,$params,$key);if(str_starts_with($path,'payment_intents/'))$r['latest_charge']['refunded']=true;return $r;};
billing_fulfill_checkout(array_merge($session,['id'=>'cs_refunded','metadata'=>['order_id'=>'already_refunded'],'payment_intent'=>'pi_refunded']));
check(!billing_access($refundedPid)['active']&&one('SELECT status FROM billing_orders WHERE id=?',['already_refunded'])['status']==='refunded','Refund before checkout fulfillment never unlocks a project');
$GLOBALS['stripe_test_transport']=$savedTransport;
// Early extension retains remaining time.
insert('billing_orders',['id'=>'order_extension','studio_id'=>$sid,'project_id'=>$pid,'actor_id'=>$uid,'kind'=>'extension','plan'=>'extension','price_id'=>'price_extension','checkout_id'=>'cs_extension','created_at'=>$paidAt,'expires_at'=>$paidAt+3600]);
$price='price_extension';$session=array_merge($session,['id'=>'cs_extension','metadata'=>['order_id'=>'order_extension'],'payment_intent'=>'pi_extension']);billing_fulfill_checkout($session);
check(billing_pass_expiry($pid)===$expiry+150*BILLING_DAY,'Early extension adds a full 150 days');
$refunded=true;billing_process_event(['type'=>'charge.refunded','data'=>['object'=>['id'=>'ch_extension']]]);
check(billing_pass_expiry($pid)===$expiry,'Extension refund revokes only its grant');
billing_process_event(['type'=>'charge.refunded','data'=>['object'=>['id'=>'ch_extension']]]);check(billing_pass_expiry($pid)===$expiry,'Repeated refund is idempotent');
// Late extension starts at payment, rather than paying for the gap.
$late=$expiry+10*BILLING_DAY;insert('billing_orders',['id'=>'order_late','studio_id'=>$sid,'project_id'=>$pid,'actor_id'=>$uid,'kind'=>'extension','plan'=>'extension','price_id'=>'price_extension','checkout_id'=>'cs_late','created_at'=>$late,'expires_at'=>$late+3600]);
$session=array_merge($session,['id'=>'cs_late','metadata'=>['order_id'=>'order_late'],'payment_intent'=>'pi_late']);$latestChargeTime=$late;billing_fulfill_checkout($session);
check(billing_pass_expiry($pid)===$late+150*BILLING_DAY,'Late extension starts at successful payment');
$paidUntil=time()+30*BILLING_DAY;$sub=['id'=>'sub_test','customer'=>'cus_test','status'=>'active','cancel_at_period_end'=>false,'items'=>['data'=>[['id'=>'si_test','price'=>['id'=>'price_solo'],'quantity'=>1,'current_period_end'=>$paidUntil]]],'latest_invoice'=>['status'=>'open']];
billing_sync_subscription($sub);check(!billing_subscription_active(billing_studio($sid)),'Active subscription with unpaid initial invoice does not unlock access');
$sub['latest_invoice']['status']='paid';billing_sync_subscription($sub);check(billing_subscription_active(billing_studio($sid)),'Paid initial invoice unlocks subscription');
billing_switch_project($u,$pid,'subscription');check(billing_usage($sid)['projects']===1,'Explicit pass-to-subscription move consumes a slot');
check(billing_pass_expiry($pid)===$late+150*BILLING_DAY,'Moving coverage preserves original pass expiry');
check(project_enhancement_allowance($pid)['plan_type']==='monthly','Subscription derives monthly enhancement policy');
$second=project($u,'subscription');$third=project($u,'subscription');denied(fn()=>transaction(fn()=>billing_new_project($u)),402);
query('UPDATE projects SET archived=1 WHERE id=?',[$third]);check(transaction(fn()=>billing_new_project($u))==='subscription','Archiving frees subscription capacity');
transaction(fn()=>billing_restore(one('SELECT * FROM projects WHERE id=?',[$third])));query('UPDATE projects SET archived=0 WHERE id=?',[$third]);
$sub['status']='past_due';$sub['latest_invoice']['status']='open';billing_sync_subscription($sub);$b=billing_studio($sid);
check(billing_subscription_active($b,$paidUntil+3*BILLING_DAY-1),'Failed renewal gets three-day grace');check(!billing_subscription_active($b,$paidUntil+3*BILLING_DAY),'Grace ends at exact boundary');
$sub['status']='canceled';billing_sync_subscription($sub);$b=billing_studio($sid);check(billing_subscription_active($b,$paidUntil-1),'Cancellation retains the paid period');check(!billing_subscription_active($b,$paidUntil),'Cancellation ends at paid-through date');
billing_switch_project($u,$pid,'project_pass');check(billing_access($pid)['active'],'Existing valid pass survives subscription cancellation');
check(project_enhancement_allowance($pid)['plan_type']==='project_pass','Switching back restores lifetime usage window');
// Staged retention must not delete anything without delivery and the configured cleanup switch.
query('UPDATE studio_billing SET paid_until=? WHERE studio_id=?',[time()-1,$sid]);billing_deadlines();check(one('SELECT restricted_at FROM project_coverage WHERE project_id=?',[$second])['restricted_at']!==null,'Expiry persists a restriction date');
check(billing_access($second)['delete_after']===null,'No deletion deadline before notification delivery');
for($j=0;$j<10;$j++)billing_dispatch_notice();billing_deadlines();check(billing_access($second)['delete_after']>time()+89*BILLING_DAY,'Delivered notice starts a full 90-day retention period');
billing_deadlines(time()+200*BILLING_DAY);check((bool)one('SELECT 1 FROM projects WHERE id=?',[$second]),'Cleanup is staged off by default');
// Migrations exempt only pre-existing data, not newly provisioned studios.
check(!billing_studio($sid)['legacy_exempt'],'New studios are not migration-exempt');
query("DELETE FROM migrations WHERE name='billing-v1'");query('DELETE FROM studio_billing WHERE studio_id=?',[$sid]);migrate_billing(db());check((bool)billing_studio($sid)['legacy_exempt'],'Existing studios retain access on migration');
echo "All billing lifecycle checks passed.\n";
