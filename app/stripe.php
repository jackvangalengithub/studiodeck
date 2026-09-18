<?php
declare(strict_types=1);
require_once __DIR__.'/billing.php';
require_once __DIR__.'/billing_changes.php';
require_once __DIR__.'/billing_worker.php';
require_once __DIR__.'/project_delete.php';

class StripeRequestFailed extends RuntimeException {
    public function __construct(public readonly array $diagnostic){parent::__construct('The billing service could not complete this request. Please try again shortly.',503);}
}

function stripe_request(string $method,string $path,array $params=[],string $key=''): array {
    // Tests inject a transport only in their CLI process; HTTP requests cannot select a host or transport.
    if(PHP_SAPI==='cli'&&isset($GLOBALS['stripe_test_transport']))return ($GLOBALS['stripe_test_transport'])($method,$path,$params,$key);
    if(!env('STRIPE_SECRET_KEY')||!function_exists('curl_init'))fail('Billing is not connected yet. Please contact the studio administrator.',503);
    $base=rtrim(env('STRIPE_API_URL','https://api.stripe.com/v1'),'/');
    $protocols=CURLPROTO_HTTPS;
    // Plain HTTP is reserved for the explicitly configured local simulator.
    if(env('APP_ENV','production')==='local')$protocols|=CURLPROTO_HTTP;
    $url=$base.'/'.$path;$body=http_build_query($params,'','&',PHP_QUERY_RFC3986);
    if($method==='GET'&&$body)$url.='?'.$body;
    $ch=curl_init($url);$headers=['Authorization: Bearer '.env('STRIPE_SECRET_KEY'),'Stripe-Version: '.env('STRIPE_API_VERSION','2025-06-30.basil')];
    if($key)$headers[]='Idempotency-Key: '.$key;
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>25,CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_PROTOCOLS=>$protocols]);
    if($method!=='GET')curl_setopt($ch,CURLOPT_POSTFIELDS,$body);
    $raw=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_HTTP_CODE);$curlCode=curl_errno($ch);$curlError=curl_error($ch);curl_close($ch);
    $data=is_string($raw)?json_decode($raw,true):null;
    if($status<200||$status>=300||!is_array($data)){
        $diagnostic=['service'=>'stripe','method'=>$method,'endpoint'=>$path,'http_status'=>$status,'curl_code'=>$curlCode,'curl_error'=>$curlError,'provider_code'=>$data['error']['code']??null,'provider_message'=>$data['error']['message']??null];
        error_log('Stripe request failed: '.json_encode($diagnostic));
        throw new StripeRequestFailed($diagnostic);
    }
    return $data;
}
function stripe_id(mixed $value): string {return is_array($value)?(string)($value['id']??''):(string)($value??'');}
function stripe_customer(array $u): string {
    $b=billing_studio($u['studio_id']);if($b['customer_id'])return $b['customer_id'];
    $params=transaction(function()use($u){
        $b=billing_studio($u['studio_id']);if(!empty($b['customer_parameters']))return json_decode($b['customer_parameters'],true);
        $s=one('SELECT name FROM studios WHERE id=?',[$u['studio_id']]);$params=['name'=>$s['name'],'email'=>$u['email'],'metadata'=>['studio_id'=>$u['studio_id']]];
        query('UPDATE studio_billing SET customer_parameters=? WHERE studio_id=?',[json_encode($params),$u['studio_id']]);return $params;
    });
    $c=stripe_request('POST','customers',$params,'studio-customer-'.$u['studio_id']);
    query('UPDATE studio_billing SET customer_id=COALESCE(customer_id,?) WHERE studio_id=?',[$c['id'],$u['studio_id']]);
    return billing_studio($u['studio_id'])['customer_id'];
}
function billing_require_fit(string $sid,string $plan,int $extraProjects=0,int $extraSeats=0,bool $includeTrial=false): void {
    if(!in_array($plan,['solo','studio','practice'],true)||$extraProjects<0||$extraProjects>500||$extraSeats<0||$extraSeats>100||($extraSeats&&$plan!=='practice'))fail('Choose a valid plan and capacity.');
    $p=billing_catalog()[$plan];$usage=billing_usage($sid);
    $additional=$includeTrial?(int)one("SELECT COUNT(*) n FROM projects p JOIN project_coverage c ON c.project_id=p.id WHERE p.studio_id=? AND p.archived=0 AND c.source IN ('trial','legacy')",[$sid])['n']:0;
    if($usage['seats']>$p['seats']+$extraSeats||$usage['projects']+$additional>$p['projects']+$extraProjects)fail('This package is too small for your current studio. Archive projects or remove studio memberships first.',409);
}
function billing_checkout(array $u,array $input): array {
    studio_admin($u);$plan=text_field($input['plan']??'',30);$catalog=billing_catalog();
    if(!isset($catalog[$plan])||in_array($plan,['extra_project','extra_seat'],true))fail('Choose a package.');
    if(!$catalog[$plan]['price_id'])fail('This package is not available for checkout yet.',503);
    $pid=text_field($input['project_id']??'');$kind=in_array($plan,['pass','extension'],true)?$plan:'subscription';
    $extras=['extra_projects'=>filter_var($input['extra_projects']??0,FILTER_VALIDATE_INT),'extra_seats'=>filter_var($input['extra_seats']??0,FILTER_VALIDATE_INT)];
    if(in_array(false,$extras,true))fail('Enter whole numbers for extra capacity.');
    $order=transaction(function()use($u,$plan,$catalog,$pid,$kind,$extras){
        $b=billing_studio($u['studio_id']);if(!$b['onboarded_at']&&!$b['legacy_exempt'])fail('Complete your studio setup first.',409);
        if($kind==='subscription'){
            if($b['subscription_id']&&!in_array($b['subscription_status'],['canceled','incomplete_expired'],true))fail('Manage your existing subscription instead of purchasing another.',409);
            billing_require_fit($u['studio_id'],$plan,$extras['extra_projects'],$extras['extra_seats'],true);
        }elseif($pid||$kind==='extension'){
            $p=one('SELECT * FROM projects WHERE id=? AND studio_id=?',[$pid,$u['studio_id']]);if(!$p)fail('Project not found.',404);
            if((int)one('SELECT COUNT(*) n FROM project_members WHERE project_id=?',[$pid])['n']!==1)fail('A pass covers one designer. Keep one project team member or choose a subscription.',409);
            $coverage=billing_access($pid);
            if($kind==='pass'&&one('SELECT 1 FROM project_access_grants WHERE project_id=?',[$pid]))fail('This project already has a pass. Choose Extend instead.',409);
            if($kind==='extension'&&!one('SELECT 1 FROM project_access_grants WHERE project_id=?',[$pid]))fail('Buy the initial Project Pass first.',409);
            if($kind==='extension'&&$coverage['designer_id']!==one('SELECT user_id FROM project_members WHERE project_id=?',[$pid])['user_id'])fail('Restore the pass’s named designer before extending it.',409);
        }
        $pending=$kind==='subscription'?one("SELECT * FROM billing_orders WHERE studio_id=? AND kind='subscription' AND status='pending'",[$u['studio_id']]):($pid?one("SELECT * FROM billing_orders WHERE project_id=? AND status='pending'",[$pid]):one("SELECT * FROM billing_orders WHERE studio_id=? AND kind='pass' AND project_id IS NULL AND status='pending'",[$u['studio_id']]));
        if($pending){
            if($pending['plan']!==$plan||json_decode($pending['parameters'],true)!==$extras)fail('Another checkout is pending. Cancel it on the Billing page before choosing a different package.',409);
            return $pending;
        }
        $o=['id'=>id(),'studio_id'=>$u['studio_id'],'project_id'=>$kind==='subscription'||!$pid?null:$pid,'actor_id'=>$u['user_id'],'kind'=>$kind,'plan'=>$plan,'price_id'=>$catalog[$plan]['price_id'],'created_at'=>time(),'expires_at'=>time()+3600,'parameters'=>json_encode($extras)];insert('billing_orders',$o);return one('SELECT * FROM billing_orders WHERE id=?',[$o['id']]);
    });
    if($order['checkout_url'])return ['url'=>$order['checkout_url'],'order_id'=>$order['id']];
    $customer=stripe_customer($u);$lineItems=[['price'=>$order['price_id'],'quantity'=>1]];
    foreach(['extra_projects'=>'extra_project','extra_seats'=>'extra_seat'] as $field=>$key)if($kind==='subscription'&&$extras[$field]){
        if(!$catalog[$key]['price_id'])fail('Extra capacity is not configured yet.',503);$lineItems[]=['price'=>$catalog[$key]['price_id'],'quantity'=>$extras[$field]];
    }
    $url=base_url().'/'.rawurlencode($u['studio_id']).'/billing';$meta=['order_id'=>$order['id'],'studio_id'=>$u['studio_id']];
    $params=['mode'=>$kind==='subscription'?'subscription':'payment','customer'=>$customer,'line_items'=>$lineItems,'client_reference_id'=>$order['id'],'metadata'=>$meta,'success_url'=>$url.'?checkout=success&order='.$order['id'],'cancel_url'=>$url.'?checkout=cancelled','expires_at'=>(int)$order['expires_at'],'billing_address_collection'=>'required','customer_update'=>['address'=>'auto','name'=>'auto'],'tax_id_collection'=>['enabled'=>'true'],'automatic_tax'=>['enabled'=>env('STRIPE_AUTOMATIC_TAX','false')==='true'?'true':'false']];
    if($kind==='subscription')$params['subscription_data']=['metadata'=>$meta];
    else {$params['invoice_creation']=['enabled'=>'true','invoice_data'=>['description'=>$catalog[$plan]['name'].($pid?' · '.one('SELECT name FROM projects WHERE id=?',[$pid])['name']:' · One new project'),'metadata'=>$meta]];$params['payment_intent_data']=['metadata'=>$meta];}
    $params['custom_text']=['submit'=>['message'=>$kind==='subscription'?'Your paid subscription starts immediately. Any remaining trial is waived.':(!$pid?'Buy one Project Pass, then create your project. Includes 150 days from project creation. No automatic renewal.':'150 days of access for this project. No automatic renewal. Extensions add time only and do not reset image enhancements.')]];
    $session=stripe_request('POST','checkout/sessions',$params,'checkout-'.$order['id']);
    query('UPDATE billing_orders SET checkout_id=?,checkout_url=? WHERE id=?',[$session['id'],$session['url'],$order['id']]);return ['url'=>$session['url'],'order_id'=>$order['id']];
}
function billing_cancel_checkout(array $u,string $oid): void {
    studio_admin($u);$o=one('SELECT * FROM billing_orders WHERE id=? AND studio_id=?',[$oid,$u['studio_id']]);if(!$o)fail('Checkout not found.',404);
    if($o['status']!=='pending')return;
    if($o['checkout_id']){
        $s=stripe_request('GET','checkout/sessions/'.rawurlencode($o['checkout_id']));
        if($s['status']==='complete'){billing_fulfill_checkout($s);fail('This checkout has completed. Refresh Billing to see its payment status.',409);}
        if($s['status']==='open')stripe_request('POST','checkout/sessions/'.rawurlencode($s['id']).'/expire',[],'expire-'.$o['id']);
    }elseif((int)$o['created_at']>time()-120)fail('Checkout is still being prepared. Please try again in two minutes.',409);
    query("UPDATE billing_orders SET status='cancelled' WHERE id=? AND status='pending'",[$oid]);
}
function billing_fulfill_checkout(array $s): void {
    $oid=$s['metadata']['order_id']??$s['client_reference_id']??'';$order=one('SELECT * FROM billing_orders WHERE id=?',[$oid]);if(!$order)return;
    $b=billing_studio($order['studio_id']);
    if(stripe_id($s['customer']??null)!==$b['customer_id']||($order['checkout_id']&&$order['checkout_id']!==$s['id']))throw new RuntimeException('Checkout customer or order mismatch.');
    if(in_array($order['status'],['paid','refunded'],true))return;
    if(($s['payment_status']??'')!=='paid')return;
    $lines=stripe_request('GET','checkout/sessions/'.rawurlencode($s['id']).'/line_items',['limit'=>100]);
    if(!in_array($order['price_id'],array_map(fn($v)=>stripe_id($v['price']),$lines['data']??[]),true))throw new RuntimeException('Checkout price mismatch.');
    $payment=stripe_id($s['payment_intent']??null);$paidAt=time();$refunded=false;
    if($payment){
        $pi=stripe_request('GET','payment_intents/'.rawurlencode($payment),['expand'=>['latest_charge']]);if(($pi['status']??'')!=='succeeded')return;
        $refunded=!empty($pi['latest_charge']['refunded']);
        // A delayed payment's charge creation predates settlement. Use its paid invoice timestamp.
        if(stripe_id($s['invoice']??null)){$invoice=stripe_request('GET','invoices/'.rawurlencode(stripe_id($s['invoice'])));$paidAt=(int)($invoice['status_transitions']['paid_at']??time());}
    }
    if($order['kind']==='subscription'){
        $sub=stripe_request('GET','subscriptions/'.rawurlencode(stripe_id($s['subscription'])),['expand'=>['latest_invoice']]);billing_sync_subscription($sub);
    }
    transaction(function()use($order,$s,$payment,$paidAt,$refunded){
        $o=one('SELECT * FROM billing_orders WHERE id=?',[$order['id']]);if(in_array($o['status'],['paid','refunded'],true))return;
        if($refunded){query("UPDATE billing_orders SET status='refunded',paid_at=?,payment_id=?,invoice_id=?,checkout_id=? WHERE id=?",[$paidAt,$payment,stripe_id($s['invoice']??null)?:null,$s['id'],$o['id']]);return;}
        if($o['kind']==='pass'&&!$o['project_id']){
            // The paid, unassigned order is the pass. Project creation redeems it atomically.
        }elseif($o['kind']!=='subscription'){
            $p=one('SELECT * FROM projects WHERE id=? AND studio_id=?',[$o['project_id'],$o['studio_id']]);
            if(!$p)throw new RuntimeException('Paid project no longer exists; refund requires review.');
            $team=rows('SELECT user_id FROM project_members WHERE project_id=?',[$p['id']]);if(count($team)!==1)throw new RuntimeException('Paid pass needs one project designer; review required.');
            insert('project_access_grants',['order_id'=>$o['id'],'project_id'=>$p['id'],'paid_at'=>$paidAt,'days'=>150]);
            // Buying a pass explicitly moves this project off subscription coverage.
            query("INSERT INTO project_coverage(project_id,source,designer_id) VALUES(?,'project_pass',?) ON CONFLICT(project_id) DO UPDATE SET source='project_pass',designer_id=COALESCE(project_coverage.designer_id,excluded.designer_id),restricted_at=NULL,retention_notified_at=NULL",[$p['id'],$team[0]['user_id']]);
        }else{
            // Initial subscription converts trial/legacy projects, never separately purchased passes.
            $b=billing_studio($o['studio_id']);if(!billing_subscription_active($b))throw new RuntimeException('Awaiting paid subscription invoice.');
            billing_require_fit($o['studio_id'],$b['plan'],(int)$b['extra_projects'],(int)$b['extra_seats'],true);
            query("UPDATE project_coverage SET source='subscription',restricted_at=NULL,retention_notified_at=NULL WHERE source IN ('trial','legacy') AND project_id IN (SELECT id FROM projects WHERE studio_id=?)",[$o['studio_id']]);
            query('UPDATE studio_billing SET legacy_exempt=0,trial_ends_at=MIN(COALESCE(trial_ends_at,?),?) WHERE studio_id=?',[time(),time(),$o['studio_id']]);
        }
        query("UPDATE billing_orders SET status='paid',paid_at=?,payment_id=?,invoice_id=?,checkout_id=?,error='' WHERE id=?",[$paidAt,$payment?:null,stripe_id($s['invoice']??null)?:null,$s['id'],$o['id']]);
        if($o['kind']==='pass'&&$o['project_id'])query('UPDATE studio_billing SET trial_ends_at=MIN(COALESCE(trial_ends_at,?),?) WHERE studio_id=?',[time(),time(),$o['studio_id']]);
    });
}
function billing_sync_subscription(array $s): void {
    $customer=stripe_id($s['customer']??null);$b=one('SELECT * FROM studio_billing WHERE customer_id=?',[$customer]);if(!$b)return;
    if($b['subscription_id']&&$b['subscription_id']!==$s['id']){
        // A late event for an older subscription must never replace the current one.
        $order=one("SELECT 1 FROM billing_orders WHERE id=? AND studio_id=? AND kind='subscription' AND status='pending'",[$s['metadata']['order_id']??'',$b['studio_id']]);
        if(!$order)return;
        if(!in_array($b['subscription_status'],['canceled','incomplete_expired'],true))throw new RuntimeException('Multiple studio subscriptions require review.');
    }
    $catalog=billing_catalog();$plan=null;$extraProjects=0;$extraSeats=0;$periodEnd=0;
    foreach($s['items']['data']??[] as $item){
        $price=stripe_id($item['price']);$key=null;foreach($catalog as $k=>$p)if($p['price_id']&&$p['price_id']===$price)$key=$k;
        if(in_array($key,['solo','studio','practice'],true)){$plan=$key;$periodEnd=(int)($item['current_period_end']??$s['current_period_end']??0);}
        elseif($key==='extra_project')$extraProjects=(int)$item['quantity'];elseif($key==='extra_seat')$extraSeats=(int)$item['quantity'];
        else throw new RuntimeException('Unknown Stripe subscription price.');
    }
    if(!$plan)throw new RuntimeException('Subscription package is missing.');
    $invoice=$s['latest_invoice']??null;if(is_string($invoice)&&$invoice)$invoice=stripe_request('GET','invoices/'.rawurlencode($invoice));
    $s['latest_invoice']=$invoice;
    // A subscription can be active before its first payment is settled. Never infer paid access from status alone.
    $paid=(int)$b['paid_until'];if(($invoice['status']??'')==='paid'&&in_array($s['status'],['active','past_due','canceled'],true))$paid=max($paid,$periodEnd);
    if($b['subscription_id']&&$b['subscription_id']!==$s['id'])$paid=($invoice['status']??'')==='paid'?$periodEnd:0;
    query('UPDATE studio_billing SET subscription_id=?,subscription_status=?,plan=?,paid_until=?,cancel_at_period_end=?,extra_projects=?,extra_seats=?,subscription_json=?,synced_at=? WHERE studio_id=?',[$s['id'],$s['status'],$plan,$paid,!empty($s['cancel_at_period_end'])?1:0,$extraProjects,$extraSeats,json_encode($s),time(),$b['studio_id']]);
    // A paid upgrade webhook must settle the UI's change record immediately.
    billing_reconcile_changes($b['studio_id']);
}
function billing_portal(array $u): array {
    studio_admin($u);$b=billing_studio($u['studio_id']);if(!$b['customer_id'])fail('Buy a package before opening payment management.',409);
    $config=env('STRIPE_PORTAL_CONFIGURATION');if(!$config)fail('Payment management is not configured yet.',503);
    $c=stripe_request('GET','billing_portal/configurations/'.rawurlencode($config));
    if(!empty($c['features']['subscription_update']['enabled']))fail('The billing portal must disable plan changes; use the validated package controls in Studiodeck.',503);
    return stripe_request('POST','billing_portal/sessions',['customer'=>$b['customer_id'],'configuration'=>$config,'return_url'=>base_url().'/'.rawurlencode($u['studio_id']).'/billing?portal=return']);
}
function billing_invoices(array $u): array {
    studio_admin($u);$b=billing_studio($u['studio_id']);if(!$b['customer_id'])return [];
    $r=stripe_request('GET','invoices',['customer'=>$b['customer_id'],'limit'=>24]);
    return array_map(fn($i)=>['id'=>$i['id'],'number'=>$i['number'],'created'=>$i['created'],'description'=>$i['description']??'Studiodeck','amount'=>$i['total'],'currency'=>$i['currency'],'status'=>$i['status'],'url'=>$i['hosted_invoice_url'],'pdf'=>$i['invoice_pdf']],$r['data']);
}
function stripe_verified_event(string $raw,string $header,?int $at=null): array {
    $secret=env('STRIPE_WEBHOOK_SECRET');if(!$secret)fail('Webhook is not configured.',503);
    if(strlen($raw)>2*1024*1024)fail('Payload too large.',413);
    $parts=[];foreach(explode(',',$header) as $part){$v=explode('=',trim($part),2);if(count($v)===2)$parts[$v[0]][]=$v[1];}
    $timestamp=$parts['t'][0]??'';if(!ctype_digit($timestamp)||abs(($at??time())-(int)$timestamp)>300)fail('Invalid webhook signature.',400);
    $expected=hash_hmac('sha256',$timestamp.'.'.$raw,$secret);$valid=false;foreach($parts['v1']??[] as $sig)if(hash_equals($expected,$sig))$valid=true;
    if(!$valid)fail('Invalid webhook signature.',400);
    $e=json_decode($raw,true);if(!is_array($e)||!is_string($e['id']??null)||!is_string($e['type']??null)||!is_array($e['data']['object']??null))fail('Invalid event.',400);
    return $e;
}
function billing_process_event(array $event): void {
    $type=$event['type'];$o=$event['data']['object'];
    if(str_starts_with($type,'checkout.session.')){
        $s=stripe_request('GET','checkout/sessions/'.rawurlencode($o['id']));
        if(($s['payment_status']??'')==='paid')billing_fulfill_checkout($s);
        elseif($type==='checkout.session.async_payment_failed'||($s['status']??'')==='expired')query("UPDATE billing_orders SET status=? WHERE checkout_id=? AND status='pending'",[$type==='checkout.session.async_payment_failed'?'failed':'expired',$s['id']]);
    }elseif(str_starts_with($type,'customer.subscription.')){
        billing_sync_subscription(stripe_request('GET','subscriptions/'.rawurlencode($o['id']),['expand'=>['latest_invoice']]));
    }elseif(str_starts_with($type,'invoice.')){
        $sub=stripe_id($o['parent']['subscription_details']['subscription']??$o['subscription']??null);
        if($sub)billing_sync_subscription(stripe_request('GET','subscriptions/'.rawurlencode($sub),['expand'=>['latest_invoice']]));
    }elseif($type==='charge.refunded'){
        $charge=stripe_request('GET','charges/'.rawurlencode($o['id']));
        if(!empty($charge['refunded'])){
            $payment=stripe_id($charge['payment_intent']);$order=one('SELECT * FROM billing_orders WHERE payment_id=?',[$payment]);
            if(!$order){$pi=stripe_request('GET','payment_intents/'.rawurlencode($payment));$order=one("SELECT o.* FROM billing_orders o JOIN studio_billing b ON b.studio_id=o.studio_id WHERE o.id=? AND b.customer_id=? AND o.kind IN ('pass','extension')",[$pi['metadata']['order_id']??'',stripe_id($pi['customer']??null)]);}
            if(!$order)return;
            transaction(function()use($order,$payment){
            query('UPDATE project_access_grants SET revoked=1 WHERE order_id=?',[$order['id']]);query("UPDATE billing_orders SET status='refunded' WHERE id=?",[$order['id']]);
            query('UPDATE billing_orders SET payment_id=COALESCE(payment_id,?) WHERE id=?',[$payment,$order['id']]);
            });
        }
    }elseif(str_starts_with($type,'charge.dispute.')){
        // Flag for review; never revoke unrelated paid periods automatically.
        $charge=stripe_request('GET','charges/'.rawurlencode(stripe_id($o['charge'])));
        query("UPDATE billing_orders SET error='Payment disputed — review in Stripe' WHERE payment_id=?",[stripe_id($charge['payment_intent'])]);
    }
}
function billing_process_events(int $limit=10,?string $studioId=null): void {
    $scope=$studioId!==null?" AND type LIKE 'checkout.session.%' AND json_extract(payload,'$.data.object.id') IN (SELECT checkout_id FROM billing_orders WHERE studio_id=?)":'';
    foreach(rows("SELECT * FROM stripe_events WHERE status='pending' AND next_attempt<=?".$scope." ORDER BY received_at LIMIT ".max(1,min(100,$limit)),$studioId!==null?[time(),$studioId]:[time()]) as $row){
        // One worker claims a lease; crashed workers are retried after the lease expires.
        $claim=query("UPDATE stripe_events SET next_attempt=? WHERE id=? AND status='pending' AND next_attempt<=?",[time()+120,$row['id'],time()]);if(!$claim->rowCount())continue;
        try{billing_process_event(json_decode($row['payload'],true));query("UPDATE stripe_events SET status='done',error='' WHERE id=?",[$row['id']]);}
        catch(Throwable $e){query('UPDATE stripe_events SET attempts=attempts+1,next_attempt=?,error=? WHERE id=?',[time()+min(3600,30*(2**min(7,(int)$row['attempts']))),substr($e->getMessage(),0,500),$row['id']]);error_log('Billing event '.$row['id'].': '.$e->getMessage());}
    }
}
