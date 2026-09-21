<?php
declare(strict_types=1);
function billing_subscription_items(array $s): array {
    return array_map(fn($i)=>['id'=>$i['id'],'price'=>stripe_id($i['price']),'quantity'=>(int)$i['quantity']],$s['items']['data']??[]);
}
function billing_change_preview(array $u,array $input,bool $immediate=false): array {
    studio_admin($u);$b=billing_studio($u['studio_id']);
    if(!billing_subscription_active($b)||!$b['subscription_id'])fail('An active paid subscription is required.',409);
    if(one("SELECT 1 FROM billing_changes WHERE studio_id=? AND status IN ('scheduled','applying','payment_pending')",[$u['studio_id']]))fail('Finish or cancel your existing package change first.',409);
    $plan=text_field($input['plan']??'',30);$ep=filter_var($input['extra_projects']??0,FILTER_VALIDATE_INT);$es=filter_var($input['extra_seats']??0,FILTER_VALIDATE_INT);
    if($ep===false||$es===false)fail('Enter whole numbers for capacity.');billing_require_fit($u['studio_id'],$plan,$ep,$es);
    $s=stripe_request('GET','subscriptions/'.rawurlencode($b['subscription_id']),['expand'=>['latest_invoice']]);billing_sync_subscription($s);
    if(($s['status']??'')!=='active'||!empty($s['cancel_at_period_end'])||!empty($s['pending_update'])||!empty($s['schedule']))fail('Resolve the pending payment, cancellation or scheduled change in Billing first.',409);
    $website=billing_website_selection($input,billing_studio($u['studio_id']));if($website){website_stripe_price();billing_require_website_bundle($u['studio_id']);}
    $catalog=billing_catalog();$desired=[$plan=>1];if($website)$desired['website']=1;if($ep)$desired['extra_project']=$ep;if($es)$desired['extra_seat']=$es;
    $old=billing_subscription_items($s);$items=[];$scheduleItems=[];$seen=[];
    foreach($desired as $key=>$qty){
        $price=$catalog[$key]['price_id'];if(!$price)fail('This package or capacity is not configured.',503);
        $existing=null;foreach($old as $item){if($item['price']===$price||(in_array($key,['solo','studio','practice'],true)&&in_array($item['price'],array_column(array_intersect_key($catalog,array_flip(['solo','studio','practice'])),'price_id'),true)))$existing=$item;}
        $new=['price'=>$price,'quantity'=>$qty];if($existing){$new['id']=$existing['id'];$seen[]=$existing['id'];}$items[]=$new;$scheduleItems[]=['price'=>$price,'quantity'=>$qty];
    }
    foreach($old as $item)if(!in_array($item['id'],$seen,true))$items[]=['id'=>$item['id'],'deleted'=>'true'];
    $current=billing_studio($u['studio_id']);$oldCost=$catalog[$current['plan']]['cents']+1000*(int)$current['extra_projects']+2000*(int)$current['extra_seats']+(billing_package_website($current)?3900:0);$newCost=$catalog[$plan]['cents']+1000*$ep+2000*$es+($website?3900:0);
    $oldLimits=billing_limits($current);$decrease=!$immediate&&($catalog[$plan]['projects']+$ep<$oldLimits['projects']||$catalog[$plan]['seats']+$es<$oldLimits['seats']||$newCost<$oldCost);
    if($plan===$current['plan']&&$ep===(int)$current['extra_projects']&&$es===(int)$current['extra_seats']&&$website===billing_package_website($current))fail('This is already your current package.');
    $at=time();$effective=$decrease?(int)$current['paid_until']:$at;$amount=0;$currency='eur';
    if(!$decrease){$preview=stripe_request('POST','invoices/create_preview',['customer'=>$current['customer_id'],'subscription'=>$s['id'],'subscription_details'=>['items'=>$items,'proration_behavior'=>'always_invoice','proration_date'=>$at]]);$amount=(int)$preview['amount_due'];$currency=$preview['currency'];}
    $id=id();insert('billing_changes',['id'=>$id,'studio_id'=>$u['studio_id'],'subscription_id'=>$s['id'],'plan'=>$plan,'extra_projects'=>$ep,'extra_seats'=>$es,'parameters'=>json_encode(['items'=>$items,'schedule_items'=>$scheduleItems,'decrease'=>$decrease,'website'=>$website]),'snapshot'=>json_encode($old),'amount'=>$amount,'currency'=>$currency,'proration_at'=>$at,'created_at'=>$at,'effective_at'=>$effective]);
    return ['change_id'=>$id,'amount'=>$amount,'currency'=>$currency,'effective_at'=>$effective,'scheduled'=>$decrease,'monthly_amount'=>$newCost,'expires_at'=>$at+600];
}
function billing_change_checkout(array $u,array $input): array {
    studio_admin($u);
    $plan=text_field($input['plan']??'',30);$ep=filter_var($input['extra_projects']??0,FILTER_VALIDATE_INT);$es=filter_var($input['extra_seats']??0,FILTER_VALIDATE_INT);
    if($ep===false||$es===false)fail('Enter whole numbers for capacity.');
    billing_require_fit($u['studio_id'],$plan,$ep,$es);
    $website=billing_website_selection($input,billing_studio($u['studio_id']));
    // Resume interrupted requests and unpaid changes instead of issuing another invoice.
    $pending=one("SELECT * FROM billing_changes WHERE studio_id=? AND status IN ('applying','payment_pending') ORDER BY created_at DESC LIMIT 1",[$u['studio_id']]);
    if($pending){
        if($pending['plan']!==$plan||(int)$pending['extra_projects']!==$ep||(int)$pending['extra_seats']!==$es||(bool)(json_decode($pending['parameters'],true)['website']??false)!==$website)fail('Finish your existing package payment first.',409);
        $id=$pending['id'];
    }else{
        $quote=billing_change_preview($u,$input,true);$id=$quote['change_id'];
    }
    billing_change_confirm($u,$id);
    $change=one('SELECT invoice_url,status FROM billing_changes WHERE id=?',[$id]);
    return ['url'=>$change['invoice_url']?:billing_portal($u)['url'],'status'=>$change['status']];
}
function billing_change_confirm(array $u,string $id): array {
    studio_admin($u);$c=one('SELECT * FROM billing_changes WHERE id=? AND studio_id=?',[$id,$u['studio_id']]);if(!$c)fail('Package change not found.',404);
    if(in_array($c['status'],['scheduled','payment_pending','applied'],true))return ['status'=>$c['status'],'url'=>$c['invoice_url']];
    if((int)$c['created_at']<time()-600&&$c['status']==='preview')fail('This quote expired. Preview the change again.',409);
    $s=stripe_request('GET','subscriptions/'.rawurlencode($c['subscription_id']),['expand'=>['latest_invoice']]);
    if($c['status']==='preview'&&(json_encode(billing_subscription_items($s))!==$c['snapshot']||!empty($s['schedule'])||!empty($s['pending_update'])))fail('Your subscription changed. Preview a new quote.',409);
    transaction(function()use($u,$c){
        if(one("SELECT 1 FROM billing_changes WHERE studio_id=? AND id<>? AND status IN ('scheduled','applying','payment_pending')",[$u['studio_id'],$c['id']]))fail('Another package change is in progress.',409);
        billing_require_fit($u['studio_id'],$c['plan'],(int)$c['extra_projects'],(int)$c['extra_seats']);
        if(!empty(json_decode($c['parameters'],true)['website']))billing_require_website_bundle($u['studio_id']);
        query("UPDATE billing_changes SET status='applying' WHERE id=? AND status='preview'",[$c['id']]);
    });
    $p=json_decode($c['parameters'],true);
    if($p['decrease']){
        $schedule=$c['schedule_id']?stripe_request('GET','subscription_schedules/'.rawurlencode($c['schedule_id'])):stripe_request('POST','subscription_schedules',['from_subscription'=>$c['subscription_id']],'schedule-'.$id);
        query('UPDATE billing_changes SET schedule_id=? WHERE id=?',[$schedule['id'],$id]);
        $current=$schedule['phases'][0];$oldItems=array_map(fn($item)=>['price'=>stripe_id($item['price']),'quantity'=>$item['quantity']],$current['items']);
        stripe_request('POST','subscription_schedules/'.rawurlencode($schedule['id']),['end_behavior'=>'release','proration_behavior'=>'none','phases'=>[
            ['start_date'=>$current['start_date'],'end_date'=>(int)$c['effective_at'],'items'=>$oldItems,'proration_behavior'=>'none'],
            ['start_date'=>(int)$c['effective_at'],'iterations'=>1,'items'=>$p['schedule_items'],'proration_behavior'=>'none']
        ]],'schedule-phases-'.$id);
        query("UPDATE billing_changes SET status='scheduled' WHERE id=?",[$id]);return ['status'=>'scheduled'];
    }
    $changed=stripe_request('POST','subscriptions/'.rawurlencode($c['subscription_id']),['items'=>$p['items'],'payment_behavior'=>'pending_if_incomplete','proration_behavior'=>'always_invoice','proration_date'=>(int)$c['proration_at'],'expand'=>['latest_invoice']],'change-'.$id);
    billing_sync_subscription($changed);$url=$changed['latest_invoice']['hosted_invoice_url']??null;$status=empty($changed['pending_update'])?'applied':'payment_pending';
    query('UPDATE billing_changes SET status=?,invoice_url=? WHERE id=?',[$status,$url,$id]);return ['status'=>$status,'url'=>$status==='payment_pending'?$url:null];
}
function billing_future_limits(string $sid,array $limits): array {
    $order=one("SELECT * FROM billing_orders WHERE studio_id=? AND kind='subscription' AND status='pending'",[$sid]);
    if($order){$p=billing_catalog()[$order['plan']];$extras=json_decode($order['parameters'],true);foreach(['projects'=>'extra_projects','seats'=>'extra_seats'] as $key=>$extra)$limits[$key]=$limits[$key]===null?$p[$key]+(int)($extras[$extra]??0):min($limits[$key],$p[$key]+(int)($extras[$extra]??0));}
    $c=one("SELECT * FROM billing_changes WHERE studio_id=? AND status IN ('scheduled','applying') ORDER BY created_at DESC LIMIT 1",[$sid]);
    if($c&&json_decode($c['parameters'],true)['decrease']){
        $p=billing_catalog()[$c['plan']];foreach(['projects'=>'extra_projects','seats'=>'extra_seats'] as $key=>$extra)$limits[$key]=$limits[$key]===null?$p[$key]+(int)$c[$extra]:min($limits[$key],$p[$key]+(int)$c[$extra]);
    }
    return $limits;
}
