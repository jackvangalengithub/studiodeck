<?php
declare(strict_types=1);
function website_billing_status(array $site): array {
    $local=env('APP_ENV','production')==='local'&&env('WEBSITE_LOCAL_FREE')==='true';
    $until=$local?time()+366*86400:(int)$site['paid_until'];
    return ['active'=>$until>time(),'until'=>$until,'status'=>$site['subscription_status'],'local'=>$local,'price'=>3900,'currency'=>'USD','available'=>(bool)env('STRIPE_PRICE_WEBSITE')&&(bool)env('STRIPE_SECRET_KEY'),'has_subscription'=>(bool)$site['subscription_id']];
}
function website_require_paid(array $site): void {if(!website_billing_status($site)['active'])fail('Activate Website for $39/month to publish or export. Your draft is saved.',402);}
function website_checkout(array $u): array {
    studio_admin($u);$site=website_get($u['studio_id']);if(website_billing_status($site)['active']||($site['subscription_id']&&!in_array($site['subscription_status'],['canceled','incomplete_expired'],true)))fail('Manage your existing Website subscription in Billing.',409);
    $price=env('STRIPE_PRICE_WEBSITE');if(!$price||!env('STRIPE_SECRET_KEY'))fail('Website payments are not configured yet. You can still build and preview.',503);
    $p=stripe_request('GET','prices/'.rawurlencode($price));if(($p['currency']??'')!=='usd'||(int)($p['unit_amount']??0)!==3900||($p['recurring']['interval']??'')!=='month'||(int)($p['recurring']['interval_count']??1)!==1)fail('Website price must be $39 USD per month.',503);
    $order=transaction(function()use($u,$price){
        $o=one("SELECT * FROM billing_orders WHERE studio_id=? AND kind='website' AND status='pending'",[$u['studio_id']]);if($o)return $o;
        $id=id();insert('billing_orders',['id'=>$id,'studio_id'=>$u['studio_id'],'actor_id'=>$u['user_id'],'kind'=>'website','plan'=>'website','price_id'=>$price,'created_at'=>time(),'expires_at'=>time()+1800]);return one('SELECT * FROM billing_orders WHERE id=?',[$id]);
    });
    if($order['checkout_url'])return ['url'=>$order['checkout_url']];
    $customer=stripe_customer($u);$meta=['order_id'=>$order['id'],'studio_id'=>$u['studio_id'],'product'=>'website'];$url=base_url().'/'.$u['studio_id'].'/website';
    $session=stripe_request('POST','checkout/sessions',['mode'=>'subscription','customer'=>$customer,'line_items'=>[['price'=>$order['price_id'],'quantity'=>1]],'metadata'=>$meta,'subscription_data'=>['metadata'=>$meta],'success_url'=>$url.'?website_checkout=success','cancel_url'=>$url.'?website_checkout=cancelled','expires_at'=>(int)$order['expires_at'],'automatic_tax'=>['enabled'=>env('STRIPE_AUTOMATIC_TAX','false')==='true'?'true':'false'],'billing_address_collection'=>'required','customer_update'=>['address'=>'auto'],'tax_id_collection'=>['enabled'=>'true']],'website-checkout-'.$order['id']);
    query('UPDATE billing_orders SET checkout_id=?,checkout_url=? WHERE id=?',[$session['id'],$session['url'],$order['id']]);return ['url'=>$session['url']];
}
function website_sync_subscription(array $s): bool {
    $known=one('SELECT * FROM websites WHERE subscription_id=?',[$s['id']]);$oid=$s['metadata']['order_id']??'';$order=one("SELECT * FROM billing_orders WHERE id=? AND kind='website'",[$oid]);
    if(!$known&&!$order&&($s['metadata']['product']??'')!=='website')return false;
    if(!$known&&!$order)throw new RuntimeException('Unknown Website subscription.');
    $sid=$known['studio_id']??$order['studio_id'];if($order&&$order['studio_id']!==$sid)throw new RuntimeException('Website order studio mismatch.');$site=website_get($sid);$billing=billing_studio($sid);
    if(stripe_id($s['customer']??'')!==$billing['customer_id'])throw new RuntimeException('Website customer mismatch.');
    if($site['subscription_id']&&$site['subscription_id']!==$s['id']){
        if(!$order||$order['status']!=='pending')return true;
        if(!in_array($site['subscription_status'],['canceled','incomplete_expired'],true))throw new RuntimeException('Multiple Website subscriptions require review.');
    }
    $items=$s['items']['data']??[];$price=$order['price_id']??env('STRIPE_PRICE_WEBSITE');if(count($items)!==1||stripe_id($items[0]['price'])!==$price||(int)($items[0]['quantity']??0)!==1)throw new RuntimeException('Website subscription price mismatch.');
    $invoice=$s['latest_invoice']??null;if(is_string($invoice)&&$invoice)$invoice=stripe_request('GET','invoices/'.rawurlencode($invoice));
    $paid=$site['subscription_id']===$s['id']?(int)$site['paid_until']:0;
    if(($invoice['status']??'')==='paid'&&in_array($s['status'],['active','past_due'],true))$paid=max($paid,(int)($items[0]['current_period_end']??$s['current_period_end']??0));
    if($s['status']==='canceled')$paid=min($paid,(int)($s['ended_at']??time()));
    query('UPDATE websites SET subscription_id=?,subscription_status=?,paid_until=? WHERE studio_id=?',[$s['id'],$s['status'],$paid,$sid]);
    if($order&&$paid>time())query("UPDATE billing_orders SET status='paid',paid_at=COALESCE(paid_at,?),error='' WHERE id=?",[time(),$order['id']]);
    $root=website_dir($sid);if(is_dir($root)){$lock=fopen($root.'/publish.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Website access update is busy.');{try{$live=website_live($sid);if($live){$live['paid_until']=$paid;$tmp=$root.'/current-'.id().'.tmp';website_write($tmp,json_encode($live));if(!rename($tmp,$root.'/current.json'))throw new RuntimeException('Website access update failed.');}}finally{flock($lock,LOCK_UN);fclose($lock);}}}
    return true;
}
