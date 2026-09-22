<?php
declare(strict_types=1);
$dir=sys_get_temp_dir().'/website-stripe-'.bin2hex(random_bytes(5));mkdir($dir,0700,true);
putenv('DATABASE_PATH='.$dir.'/test.sqlite');putenv('WEBSITE_STORAGE_PATH='.$dir.'/sites');putenv('APP_ENV=local');putenv('WEBSITE_LOCAL_FREE=false');putenv('STRIPE_SECRET_KEY=sk_test_mock');putenv('STRIPE_PRICE_WEBSITE=price_website');
require __DIR__.'/../app/bootstrap.php';
function check(bool $ok,string $m): void {if(!$ok)throw new RuntimeException($m);echo "PASS $m\n";}
try{
 $uid=id();insert('users',['id'=>$uid,'email'=>'admin@example.test','name'=>'Admin','created_at'=>now()]);$sid=create_studio($uid,'Website billing');$u=['user_id'=>$uid,'studio_id'=>$sid,'email'=>'admin@example.test'];
 check(billing_addons($sid)===[],'Billing offers no optional Website module');
 check(!one('SELECT 1 FROM websites WHERE studio_id=?',[$sid]),'Viewing Billing does not create website content');
 $GLOBALS['stripe_test_transport']=function(){throw new RuntimeException('No new Stripe purchase may be made');};
 try{website_checkout($u);throw new RuntimeException('Expected rejection');}catch(RuntimeException $e){check($e->getCode()===409,'Standalone Website checkout is retired');}
 check(!one("SELECT 1 FROM billing_orders WHERE kind='website'"),'Retired checkout creates no order');
 website_get($sid);query('UPDATE studio_billing SET customer_id=? WHERE studio_id=?',['cus_test',$sid]);
 query("UPDATE websites SET subscription_id='sub_website',subscription_status='active' WHERE studio_id=?",[$sid]);
 $sub=['id'=>'sub_website','customer'=>'cus_test','status'=>'active','items'=>['data'=>[['price'=>'price_website','quantity'=>1,'current_period_end'=>time()+86400]]],'latest_invoice'=>['status'=>'paid']];
 billing_sync_subscription($sub);check(website_billing_status(website_get($sid))['active'],'Historical paid Website invoices still reconcile');
 check(billing_studio($sid)['subscription_id']===null,'Historical Website invoice does not change studio package');
 $sub['status']='canceled';$sub['ended_at']=time()-1;billing_sync_subscription($sub);check(!website_billing_status(website_get($sid))['active'],'Historical cancellation expires access');
 echo "Website Stripe checks passed.\n";
}finally{website_remove_build($dir);}
