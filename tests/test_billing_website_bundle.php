<?php
declare(strict_types=1);
// Bundled Website billing uses an isolated database and an in-process Stripe double.
$dir=sys_get_temp_dir().'/sd-website-bundle-'.bin2hex(random_bytes(5));mkdir($dir);
foreach(['DATABASE_PATH'=>$dir.'/db.sqlite','WEBSITE_STORAGE_PATH'=>$dir.'/sites','APP_ENV'=>'local','WEBSITE_LOCAL_FREE'=>'false','STRIPE_SECRET_KEY'=>'sk_test_mock','STRIPE_PORTAL_CONFIGURATION'=>'bpc_test'] as $key=>$value)putenv($key.'='.$value);
foreach(['pass','extension','solo','studio','practice','extra_project','extra_seat','website'] as $key)putenv('STRIPE_PRICE_'.strtoupper($key).'=price_'.$key);
require __DIR__.'/../app/bootstrap.php';
function verify(bool $value,string $message): void {if(!$value)throw new RuntimeException($message);echo "PASS $message\n";}
function blocked(callable $call,int $code): void {try{$call();}catch(RuntimeException $e){verify($e->getCode()===$code,$e->getMessage());return;}throw new RuntimeException('Expected rejection');}
function updated_items(array $old,array $updates): array {
    $result=[];foreach($old as $item)$result[$item['id']]=$item;
    foreach($updates as $item){$id=$item['id']??'si_'.$item['price'];if(!empty($item['deleted']))unset($result[$id]);else $result[$id]=['id'=>$id,'price'=>['id'=>$item['price']],'quantity'=>$item['quantity'],'current_period_end'=>time()+30*BILLING_DAY];}
    return array_values($result);
}
try{
    db();$uid=id();insert('users',['id'=>$uid,'email'=>'bundle@example.test','name'=>'Bundle','created_at'=>now()]);$sid=create_studio($uid,'Bundle');$u=['user_id'=>$uid,'studio_id'=>$sid,'email'=>'bundle@example.test'];
    complete_studio_setup($u,['name'=>'Bundle','language'=>'en','business_type'=>'interior']);
    $calls=[];$session=null;$sub=null;$pay=true;$pendingItems=[];
    $GLOBALS['stripe_test_transport']=function($method,$path,$params,$key)use(&$calls,&$session,&$sub,&$pay,&$pendingItems){
        $calls[]=[$method,$path,$params,$key];
        if($path==='prices/price_website')return ['currency'=>'eur','unit_amount'=>3900,'recurring'=>['interval'=>'month','interval_count'=>1]];
        if($path==='customers')return ['id'=>'cus_bundle'];
        if($path==='checkout/sessions'){
            $session=['id'=>'cs_bundle','metadata'=>$params['metadata'],'customer'=>'cus_bundle','subscription'=>'sub_bundle','payment_status'=>'unpaid','status'=>'complete','url'=>'https://checkout.stripe.com/bundle','lines'=>$params['line_items']];
            $sub=['id'=>'sub_bundle','metadata'=>$params['metadata'],'customer'=>'cus_bundle','status'=>'active','items'=>['data'=>updated_items([],$params['line_items'])],'latest_invoice'=>['status'=>'open'],'cancel_at_period_end'=>false];return $session;
        }
        if($path==='checkout/sessions/cs_bundle/line_items')return ['data'=>$session['lines']];
        if($path==='invoices/create_preview')return ['amount_due'=>1234,'currency'=>'eur'];
        if($path==='subscriptions/sub_bundle'){
            if($method==='POST'){
                verify($params['payment_behavior']==='pending_if_incomplete'&&$params['proration_behavior']==='always_invoice','Stripe handles proration and pending payment');
                $pendingItems=updated_items($sub['items']['data'],$params['items']);
                if($pay){$sub['items']['data']=$pendingItems;unset($sub['pending_update']);}else $sub['pending_update']=['expires_at'=>time()+3600];
                $sub['latest_invoice']=['status'=>$pay?'paid':'open','hosted_invoice_url'=>'https://invoice.stripe.com/bundle'];
            }return $sub;
        }
        throw new RuntimeException('Unexpected Stripe call: '.$path);
    };
    $checkout=billing_checkout($u,['plan'=>'solo','extra_projects'=>2,'extra_seats'=>1,'website'=>true]);
    verify(count($session['lines'])===4&&end($session['lines'])===['price'=>'price_website','quantity'=>1],'Checkout includes one €39 Website item alongside the selected package and capacity');
    billing_fulfill_checkout($session);verify(!one('SELECT 1 FROM websites WHERE studio_id=?',[$sid]),'Unpaid checkout does not activate or create a Website');
    $session['payment_status']='paid';$sub['latest_invoice']['status']='paid';billing_fulfill_checkout($session);
    $site=website_get($sid);verify(website_billing_status($site)['active']&&$site['subscription_id']==='sub_bundle','Paid package checkout activates Website on the same subscription');
    verify(billing_package_website(billing_studio($sid))&&billing_addons($sid)[0]['in_package'],'Billing remembers Website in the purchased package');
    blocked(fn()=>website_checkout($u),409);
    $change=billing_change_checkout($u,['plan'=>'studio','extra_projects'=>0,'extra_seats'=>0]);
    verify($change['url']==='https://invoice.stripe.com/bundle'&&billing_package_website(billing_studio($sid)),'Package changes preserve Website when omitted by older clients');
    $change=billing_change_checkout($u,['plan'=>'studio','extra_projects'=>0,'extra_seats'=>0,'website'=>false]);
    verify(!billing_package_website(billing_studio($sid))&&!website_billing_status(website_get($sid))['active'],'Removing Website updates Stripe and ends Website access');
    // A Website-only change still needs payment, even when the studio package is paid.
    $pay=false;$change=billing_change_checkout($u,['plan'=>'studio','extra_projects'=>0,'extra_seats'=>0,'website'=>true]);
    verify($change['status']==='payment_pending'&&!website_billing_status(website_get($sid))['active'],'Unpaid Website addition never inherits the studio’s existing paid period');
    $updates=count(array_filter($calls,fn($c)=>$c[0]==='POST'&&$c[1]==='subscriptions/sub_bundle'));
    billing_change_checkout($u,['plan'=>'studio','extra_projects'=>0,'extra_seats'=>0,'website'=>true]);
    verify(count(array_filter($calls,fn($c)=>$c[0]==='POST'&&$c[1]==='subscriptions/sub_bundle'))===$updates,'Retrying pending Website payment reuses its invoice');
    blocked(fn()=>website_checkout($u),409);
    $sub['items']['data']=$pendingItems;unset($sub['pending_update']);$sub['latest_invoice']['status']='paid';billing_sync_subscription($sub);
    verify(website_billing_status(website_get($sid))['active']&&!one("SELECT 1 FROM billing_changes WHERE studio_id=? AND status='payment_pending'",[$sid]),'Verified invoice payment activates Website and completes its package change');
    $pay=true;billing_change_checkout($u,['plan'=>'studio','website'=>false]);
    query("UPDATE websites SET subscription_id='sub_separate',subscription_status='active',paid_until=? WHERE studio_id=?",[time()+86400,$sid]);
    blocked(fn()=>billing_change_checkout($u,['plan'=>'studio','website'=>true]),409);
    verify(billing_addons($sid)[0]['separate_subscription'],'A separately billed Website is identified and cannot be charged twice');
    blocked(fn()=>billing_checkout($u,['plan'=>'website']),400);
    echo "Bundled Website billing checks passed.\n";
}finally{website_remove_build($dir);}
