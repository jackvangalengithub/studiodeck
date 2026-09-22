<?php
declare(strict_types=1);
function website_billing_status(array $site): array {
    $local=env('APP_ENV','production')==='local'&&env('WEBSITE_LOCAL_FREE')==='true';
    $b=billing_studio($site['studio_id']);$included=billing_subscription_active($b);
    $subscriptionUntil=$included?(int)$b['paid_until']+($b['subscription_status']==='past_due'&&!$b['cancel_at_period_end']?3*BILLING_DAY:0):0;
    // Honor already-paid historical Website access while studio subscriptions include it for free.
    $until=$local?time()+366*86400:max($subscriptionUntil,(int)$site['paid_until']);
    return ['active'=>$until>time(),'until'=>$until,'status'=>$included?$b['subscription_status']:$site['subscription_status'],'local'=>$local,'included'=>$included,'price'=>0,'currency'=>'EUR','available'=>false,'has_subscription'=>(bool)$b['subscription_id']];
}
function website_require_paid(array $site): void {if(!website_billing_status($site)['active'])fail('Choose a Solo, Studio or Practice subscription to publish or export your included website. Your draft is saved.',402);}
function website_checkout(array $u): array {
    studio_admin($u);fail('Website is included with every subscription. Choose or manage your package in Billing.',409);
}
function website_sync_subscription(array $s): bool {
    // Bundled Website access is synchronized together with the studio subscription.
    if(one('SELECT 1 FROM studio_billing WHERE subscription_id=?',[$s['id']])||one("SELECT 1 FROM billing_orders WHERE id=? AND kind='subscription'",[$s['metadata']['order_id']??'']))return false;
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
    website_sync_live_access($sid,website_billing_status(website_get($sid))['until']);
    return true;
}

function website_sync_live_access(string $sid,int $paid): void {
    $root=website_dir($sid);if(is_dir($root)){$lock=fopen($root.'/publish.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('Website access update is busy.');{try{$live=website_live($sid);if($live){$live['paid_until']=$paid;$tmp=$root.'/current-'.id().'.tmp';website_write($tmp,json_encode($live));if(!rename($tmp,$root.'/current.json'))throw new RuntimeException('Website access update failed.');}}finally{flock($lock,LOCK_UN);fclose($lock);}}}
 }
function website_sync_package(array $s,string $sid): void {
    $site=one('SELECT * FROM websites WHERE studio_id=?',[$sid]);
    if(!$site)return;
    // Preserve historical standalone subscription records for reconciliation.
    // Studio website access now follows the paid studio package, without a separate line item.
    if($site['subscription_id']===$s['id']){
        query("UPDATE websites SET subscription_id=NULL,subscription_status='none',paid_until=0 WHERE studio_id=?",[$sid]);
        $site=website_get($sid);
    }
    website_sync_live_access($sid,website_billing_status($site)['until']);
}
