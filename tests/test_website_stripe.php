<?php
declare(strict_types=1);
$dir=sys_get_temp_dir().'/website-stripe-'.bin2hex(random_bytes(5));mkdir($dir,0700,true);
putenv('DATABASE_PATH='.$dir.'/test.sqlite');putenv('WEBSITE_STORAGE_PATH='.$dir.'/sites');putenv('APP_ENV=local');putenv('WEBSITE_LOCAL_FREE=false');putenv('STRIPE_SECRET_KEY=sk_test_mock');putenv('STRIPE_PRICE_WEBSITE=price_website');
require __DIR__.'/../app/bootstrap.php';
function check(bool $ok,string $m): void {if(!$ok)throw new RuntimeException($m);echo "PASS $m\n";}
try{
 $uid=id();insert('users',['id'=>$uid,'email'=>'admin@example.test','name'=>'Admin','created_at'=>now()]);$sid=create_studio($uid,'Website billing');$u=['user_id'=>$uid,'studio_id'=>$sid,'email'=>'admin@example.test'];website_get($sid);query('UPDATE studio_billing SET customer_id=? WHERE studio_id=?',['cus_test',$sid]);
 $params=[];$calls=0;$invoiceStatus='open';$sub=null;
 $GLOBALS['stripe_test_transport']=function($method,$path,$body,$key)use(&$params,&$calls,&$invoiceStatus,&$sub){
  if($path==='prices/price_website')return ['currency'=>'usd','unit_amount'=>3900,'recurring'=>['interval'=>'month','interval_count'=>1]];
  if($path==='checkout/sessions'){$calls++;$params=$body;$sub=['id'=>'sub_website','customer'=>'cus_test','metadata'=>$body['metadata'],'status'=>'active','items'=>['data'=>[['price'=>'price_website','quantity'=>1,'current_period_end'=>time()+86400]]]];return ['id'=>'cs_test','url'=>'https://checkout.stripe.com/test'];}
  if($path==='subscriptions/sub_website')return [...$sub,'latest_invoice'=>['status'=>$invoiceStatus]];
  throw new RuntimeException('Unexpected Stripe call: '.$path);
 };
 $first=website_checkout($u);$again=website_checkout($u);check($first===$again&&$calls===1,'Repeated checkout resumes one pending Website purchase');check($params['mode']==='subscription'&&$params['line_items'][0]['price']==='price_website'&&$params['subscription_data']['metadata']['product']==='website','Checkout creates the dedicated recurring Website product');
 $session=['id'=>'cs_test','customer'=>'cus_test','metadata'=>$params['metadata'],'subscription'=>'sub_website','payment_status'=>'unpaid'];billing_fulfill_checkout($session);check(!website_billing_status(website_get($sid))['active'],'Unpaid checkout cannot unlock Website');
 $session['payment_status']='paid';$invoiceStatus='paid';billing_fulfill_checkout($session);check(website_billing_status(website_get($sid))['active'],'Verified paid checkout unlocks Website');check(billing_studio($sid)['subscription_id']===null,'Studio package stays unchanged');
 billing_sync_subscription([...$sub,'latest_invoice'=>['status'=>'open'],'status'=>'past_due']);check(website_billing_status(website_get($sid))['until']<(time()+86401),'Unpaid renewal does not extend website coverage');
 echo "Website Stripe checks passed.\n";
}finally{website_remove_build($dir);}
