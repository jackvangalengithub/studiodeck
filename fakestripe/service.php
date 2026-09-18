<?php
declare(strict_types=1);

function setting(string $key, string $default = ''): string { return getenv($key) === false ? $default : (string)getenv($key); }
function fake_id(string $prefix): string { return $prefix.'_fake_'.bin2hex(random_bytes(8)); }
function public_url(string $path): string { return rtrim(setting('FAKESTRIPE_PUBLIC_URL', 'http://localhost:8299'), '/').$path; }
function missing(string $message, int $code = 400): never { throw new RuntimeException($message, $code); }
function object_get(array $db, string $collection, string $id): array { return $db[$collection][$id] ?? missing('No such '.$collection.': '.$id, 404); }
function listing(array $items): array { return ['object'=>'list', 'data'=>array_values($items), 'has_more'=>false]; }
function seed(): array {
    $db = array_fill_keys(['customers','sessions','subscriptions','invoices','payment_intents','charges','products','prices','configurations','portals','schedules','events','idempotency'], []);
    $db['csrf'] = bin2hex(random_bytes(24));
    foreach (['pass'=>['Project Pass',1900], 'extension'=>['Pass extension',1500], 'solo'=>['Solo',3900], 'studio'=>['Studio',19900], 'practice'=>['Practice',39900], 'extra_project'=>['Extra active project',1000], 'extra_seat'=>['Extra Practice designer',2000]] as $key=>$entry) {
        $product = 'prod_fakestrip_'.$key; $price = 'price_fakestrip_'.$key;
        $db['products'][$product] = ['id'=>$product, 'object'=>'product', 'name'=>'Studiodeck '.$entry[0]];
        $db['prices'][$price] = ['id'=>$price, 'object'=>'price', 'product'=>$product, 'currency'=>'eur', 'unit_amount'=>$entry[1], 'lookup_key'=>'studiodeck_v1_'.$key, 'active'=>true, 'recurring'=>in_array($key,['pass','extension'],true)?null:['interval'=>'month']];
    }
    $db['configurations']['bpc_fakestrip'] = ['id'=>'bpc_fakestrip', 'object'=>'billing_portal.configuration', 'features'=>['subscription_update'=>['enabled'=>false], 'subscription_cancel'=>['enabled'=>true, 'mode'=>'at_period_end']]];
    return $db;
}
function event_add(array &$db, string $type, array $object): void {
    $id = fake_id('evt');
    $db['events'][$id] = ['payload'=>['id'=>$id, 'object'=>'event', 'livemode'=>false, 'created'=>time(), 'type'=>$type, 'data'=>['object'=>$object]], 'delivered'=>false, 'attempts'=>0, 'http_status'=>0];
}
function deliver_events(array &$db): void {
    $url = setting('FAKESTRIPE_WEBHOOK_URL');
    if (!$url) return;
    foreach ($db['events'] as &$event) {
        if ($event['delivered'] || ($event['next_attempt'] ?? 0)>time()) continue;
        $raw = json_encode($event['payload'], JSON_THROW_ON_ERROR); $at = time();
        $sig = hash_hmac('sha256', $at.'.'.$raw, setting('FAKESTRIPE_WEBHOOK_SECRET','whsec_fakestripe_local'));
        $context = stream_context_create(['http'=>['method'=>'POST','timeout'=>3,'ignore_errors'=>true,'follow_location'=>0,'header'=>"Content-Type: application/json\r\nStripe-Signature: t=$at,v1=$sig\r\n",'content'=>$raw]]);
        $http_response_header = [];
        @file_get_contents($url, false, $context);
        preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $match);
        $event['http_status'] = (int)($match[1] ?? 0); $event['attempts']++;
        $event['delivered'] = $event['http_status'] >= 200 && $event['http_status'] < 300;
        $event['next_attempt'] = time()+min(60,2**min(6,$event['attempts']));
    }
}
function items(array $db, array $input, ?array $previous = null): array {
    $out = [];
    foreach ($input as $item) {
        if (($item['deleted'] ?? '') === 'true') continue;
        $price = object_get($db, 'prices', is_array($item['price']) ? $item['price']['id'] : $item['price']);
        $quantity = (int)($item['quantity'] ?? 1);
        if ($quantity < 1) missing('Quantity must be positive.');
        $out[] = ['id'=>$item['id'] ?? fake_id('si'), 'price'=>$price, 'quantity'=>$quantity, 'current_period_start'=>$previous['current_period_start'] ?? time(), 'current_period_end'=>$previous['current_period_end'] ?? strtotime('+1 month')];
    }
    if (!$out) missing('At least one line item is required.');
    return $out;
}
function total(array $items): int { return array_sum(array_map(fn($i)=>(int)$i['price']['unit_amount']*(int)$i['quantity'], $items)); }
function invoice_create(array &$db, string $customer, array $lines, string $status, ?string $sub = null, ?int $amount = null, string $description = 'Studiodeck test payment'): array {
    $id = fake_id('in');
    return $db['invoices'][$id] = ['id'=>$id,'object'=>'invoice','customer'=>$customer,'number'=>'FAKE-'.(count($db['invoices'])+1),'created'=>time(),'description'=>$description,'total'=>$amount ?? total($lines),'amount_due'=>$amount ?? total($lines),'currency'=>'eur','status'=>$status,'status_transitions'=>['paid_at'=>$status==='paid'?time():null],'hosted_invoice_url'=>public_url('/invoice/'.$id),'invoice_pdf'=>null,'parent'=>['subscription_details'=>['subscription'=>$sub]],'subscription'=>$sub,'lines'=>listing($lines)];
}
function subscription_view(array $db, array $sub): array {
    if (is_string($sub['latest_invoice'] ?? null)) $sub['latest_invoice'] = object_get($db,'invoices',$sub['latest_invoice']);
    return $sub;
}
function checkout_finish(array &$db, string $id, string $outcome): array {
    $session = object_get($db,'sessions',$id);
    if ($session['status'] !== 'open') return $session;
    if ($session['expires_at'] <= time()) { $session['status']='expired'; $db['sessions'][$id]=$session; event_add($db,'checkout.session.expired',$session); return $session; }
    if ($outcome === 'declined') {
        // Model an asynchronous payment failure so the app receives a definitive failed order.
        $session['status']='complete'; $session['payment_status']='unpaid'; $session['fake_outcome']='declined';
        $db['sessions'][$id]=$session; event_add($db,'checkout.session.async_payment_failed',$session); return $session;
    }
    $sub = null; $lines = $session['lines'];
    if ($session['mode']==='subscription') {
        $sub = fake_id('sub');
        $db['subscriptions'][$sub] = ['id'=>$sub,'object'=>'subscription','customer'=>$session['customer'],'metadata'=>$session['metadata'],'status'=>'active','cancel_at_period_end'=>false,'items'=>listing($lines),'current_period_start'=>time(),'current_period_end'=>strtotime('+1 month'),'pending_update'=>null,'schedule'=>null];
    }
    $invoice = invoice_create($db,$session['customer'],$lines,'paid',$sub,null,$session['invoice_creation']['invoice_data']['description'] ?? 'Studiodeck test payment');
    $pi = fake_id('pi'); $charge = fake_id('ch');
    $db['charges'][$charge] = ['id'=>$charge,'object'=>'charge','payment_intent'=>$pi,'customer'=>$session['customer'],'refunded'=>false,'created'=>time(),'amount'=>$invoice['total']];
    $db['payment_intents'][$pi] = ['id'=>$pi,'object'=>'payment_intent','status'=>'succeeded','customer'=>$session['customer'],'metadata'=>$session['metadata'],'latest_charge'=>$db['charges'][$charge]];
    $session = array_replace($session,['status'=>'complete','payment_status'=>'paid','payment_intent'=>$sub?null:$pi,'invoice'=>$invoice['id'],'subscription'=>$sub,'fake_outcome'=>'accepted']);
    $db['sessions'][$id]=$session;
    if ($sub) { $db['subscriptions'][$sub]['latest_invoice']=$invoice['id']; event_add($db,'customer.subscription.created',subscription_view($db,$db['subscriptions'][$sub])); }
    event_add($db,'checkout.session.completed',$session); event_add($db,'invoice.paid',$invoice);
    return $session;
}
function invoice_finish(array &$db, string $id, string $outcome): void {
    $invoice = object_get($db,'invoices',$id); if ($invoice['status']==='paid') return;
    $sub = $invoice['subscription'];
    if ($outcome==='accepted') {
        $invoice['status']='paid'; $invoice['status_transitions']['paid_at']=time();
        if ($sub && !empty($db['subscriptions'][$sub]['pending_update'])) {
            $db['subscriptions'][$sub]['items'] = listing($db['subscriptions'][$sub]['pending_update']['items']);
            $db['subscriptions'][$sub]['pending_update']=null;
        }
    }
    $db['invoices'][$id]=$invoice;
    event_add($db,$outcome==='accepted'?'invoice.paid':'invoice.payment_failed',$invoice);
    if ($sub) event_add($db,'customer.subscription.updated',subscription_view($db,$db['subscriptions'][$sub]));
}
function api(array &$db, string $method, string $path, array $p): array {
    $parts = explode('/',trim($path,'/')); $id=$parts[1]??'';
    if ($path==='customers' && $method==='POST') { $id=fake_id('cus'); return $db['customers'][$id]=array_replace($p,['id'=>$id,'object'=>'customer']); }
    if ($path==='products' && $method==='POST') { $id=fake_id('prod'); return $db['products'][$id]=array_replace($p,['id'=>$id,'object'=>'product']); }
    if ($path==='prices' && $method==='GET') return listing(array_filter($db['prices'],fn($v)=>empty($p['lookup_keys'])||in_array($v['lookup_key']??'', $p['lookup_keys'],true)));
    if ($path==='prices' && $method==='POST') { object_get($db,'products',$p['product']); $id=fake_id('price'); return $db['prices'][$id]=array_replace($p,['id'=>$id,'object'=>'price','unit_amount'=>(int)$p['unit_amount'],'active'=>true]); }
    if ($path==='checkout/sessions' && $method==='POST') {
        object_get($db,'customers',$p['customer']); if (!in_array($p['mode']??'', ['payment','subscription'],true)) missing('Unsupported checkout mode.');
        $lines=items($db,$p['line_items']??[]); $id=fake_id('cs');
        return $db['sessions'][$id]=array_replace($p,['id'=>$id,'object'=>'checkout.session','livemode'=>false,'created'=>time(),'expires_at'=>(int)($p['expires_at']??time()+3600),'url'=>public_url('/checkout/'.$id),'status'=>'open','payment_status'=>'unpaid','lines'=>$lines,'amount_total'=>total($lines),'currency'=>'eur','payment_intent'=>null,'subscription'=>null,'invoice'=>null]);
    }
    if (str_starts_with($path,'checkout/sessions/')) {
        $id=$parts[2]; $s=object_get($db,'sessions',$id);
        if ($s['status']==='open' && ($s['expires_at']<=time() || ($method==='POST' && ($parts[3]??'')==='expire'))) { $s['status']='expired'; $db['sessions'][$id]=$s; event_add($db,'checkout.session.expired',$s); }
        if ($method==='GET') return ($parts[3]??'')==='line_items'?listing($s['lines']):$s;
        if (($parts[3]??'')==='expire') return $s;
    }
    if ($path==='invoices/create_preview' && $method==='POST') {
        $s=object_get($db,'subscriptions',$p['subscription']);
        return ['id'=>fake_id('upcoming'),'object'=>'invoice','amount_due'=>max(0,total(items($db,$p['subscription_details']['items']))-total($s['items']['data'])),'currency'=>'eur'];
    }
    if ($parts[0]==='subscriptions' && $id) {
        $s=object_get($db,'subscriptions',$id);
        if ($method==='GET') return subscription_view($db,$s);
        if ($method==='POST') {
            if (isset($p['cancel_at_period_end'])) $s['cancel_at_period_end']=filter_var($p['cancel_at_period_end'],FILTER_VALIDATE_BOOLEAN);
            if (isset($p['items'])) {
                $new=items($db,$p['items'],$s); $amount=max(0,total($new)-total($s['items']['data']));
                $invoice=invoice_create($db,$s['customer'],$new,'open',$id,$amount,'Studiodeck package change');
                $s['pending_update']=['items'=>$new,'expires_at'=>time()+86400]; $s['latest_invoice']=$invoice['id'];
            }
            $db['subscriptions'][$id]=$s; event_add($db,'customer.subscription.updated',subscription_view($db,$s)); return subscription_view($db,$s);
        }
    }
    if ($path==='subscription_schedules' && $method==='POST') {
        $s=object_get($db,'subscriptions',$p['from_subscription']); $id=fake_id('sub_sched'); $db['subscriptions'][$s['id']]['schedule']=$id;
        return $db['schedules'][$id]=['id'=>$id,'object'=>'subscription_schedule','subscription'=>$s['id'],'status'=>'active','phases'=>[['start_date'=>$s['current_period_start'],'end_date'=>$s['current_period_end'],'items'=>$s['items']['data']]]];
    }
    if ($parts[0]==='subscription_schedules' && $id) {
        $s=object_get($db,'schedules',$id);
        if ($method==='GET') return $s;
        if ($method==='POST') {
            if (($parts[2]??'')==='release') { $s['status']='released'; $db['subscriptions'][$s['subscription']]['schedule']=null; }
            else $s=array_replace($s,$p);
            return $db['schedules'][$id]=$s;
        }
    }
    if ($path==='billing_portal/configurations' && $method==='POST') {
        $id=fake_id('bpc'); $p['features']['subscription_update']['enabled']=filter_var($p['features']['subscription_update']['enabled']??false,FILTER_VALIDATE_BOOLEAN);
        return $db['configurations'][$id]=array_replace($p,['id'=>$id,'object'=>'billing_portal.configuration']);
    }
    if (str_starts_with($path,'billing_portal/configurations/') && $method==='GET') return object_get($db,'configurations',$parts[2]);
    if ($path==='billing_portal/sessions' && $method==='POST') {
        object_get($db,'customers',$p['customer']); object_get($db,'configurations',$p['configuration']); $id=fake_id('bps');
        return $db['portals'][$id]=array_replace($p,['id'=>$id,'object'=>'billing_portal.session','url'=>public_url('/portal/'.$id)]);
    }
    if ($path==='invoices' && $method==='GET') return listing(array_filter($db['invoices'],fn($v)=>!isset($p['customer'])||$v['customer']===$p['customer']));
    if (in_array($parts[0],['invoices','payment_intents','charges','customers','prices'],true) && $id && $method==='GET') return object_get($db,$parts[0],$id);
    missing('Unsupported fake Stripe endpoint: '.$method.' '.$path,404);
}
