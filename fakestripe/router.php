<?php
declare(strict_types=1);
require __DIR__.'/service.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH); $method=$_SERVER['REQUEST_METHOD'];
if ($path==='/health') { header('Content-Type: application/json'); echo '{"ok":true,"service":"fakestripe"}'; exit; }
$file=setting('FAKESTRIPE_STATE_PATH',__DIR__.'/state.json');
$lock=fopen($file.'.lock','c+'); if (!$lock || !flock($lock,LOCK_EX)) { http_response_code(503); exit('State unavailable'); }
$db=is_file($file)?json_decode(file_get_contents($file),true,512,JSON_THROW_ON_ERROR):seed();
$before=$db;
$isApi=str_starts_with($path,'/v1/'); $sendEvents=false;
function h(mixed $v): string { return htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8'); }
function money(int $amount): string { return '€'.number_format($amount/100,2); }
function link_to(string $url,string $label): string { return '<a href="'.h($url).'">'.h($label).'</a>'; }
function form(array $db,string $action,string $body): string { return '<form method="post" action="'.h($action).'"><input type="hidden" name="csrf" value="'.h($db['csrf']).'">'.$body.'</form>'; }
function payment_form(array $db,string $path): string { return form($db,$path,'<fieldset><legend>Choose a payment result</legend><label><input type="radio" name="outcome" value="accepted" checked> Payment accepted</label><label><input type="radio" name="outcome" value="declined"> Payment declined</label></fieldset><button>Submit test payment</button>'); }
function line_table(array $db,array $lines): string {
    $out='<table><tr><th>Package</th><th>Quantity</th><th>Amount</th></tr>';
    foreach ($lines as $item) $out.='<tr><td>'.h($db['products'][$item['price']['product']]['name']??$item['price']['id']).'</td><td>'.h($item['quantity']).'</td><td>'.money($item['price']['unit_amount']*$item['quantity']).'</td></tr>';
    return $out.'</table>';
}
function page(string $title,string $body): string {
    return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'.h($title).' · Fakestripe</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#f3f5f8;color:#182438;margin:0}main{max-width:820px;margin:48px auto;padding:28px;background:white;border-radius:16px;box-shadow:0 8px 40px #18243812}a{color:#2859bd}header{display:flex;justify-content:space-between;align-items:center}.badge{background:#fff0be;color:#664500;padding:5px 12px;border-radius:30px;font-size:13px}h1{line-height:1.2}label{display:block;margin:15px 0}fieldset{border:1px solid #ccd3de;border-radius:8px;margin:24px 0}button{background:#2859bd;color:white;padding:12px 20px;border:0;border-radius:8px;cursor:pointer;font:inherit}table{border-collapse:collapse;width:100%;margin:20px 0;text-align:left}td,th{padding:10px;border-bottom:1px solid #e5e9f0;overflow-wrap:anywhere}p,small{overflow-wrap:anywhere}.notice{padding:16px;border-radius:8px;background:#eef4ff}.muted{color:#64748b}form{margin:16px 0}@media(max-width:860px){main{margin:12px;padding:20px}table{font-size:13px}}</style><main><header><a href="/">Fakestripe</a><span class="badge">LOCAL PAYMENT SIMULATOR</span></header><h1>'.h($title).'</h1>'.$body.'<p class="muted">Test payments only. No money moves and no card details are needed.</p></main></html>';
}
try {
    if ($isApi) {
        if (!hash_equals('Bearer '.setting('FAKESTRIPE_API_KEY','sk_test_fakestripe'),$_SERVER['HTTP_AUTHORIZATION']??'')) missing('Invalid simulator API key.',401);
        $p=$method==='GET'?$_GET:$_POST; $key=$_SERVER['HTTP_IDEMPOTENCY_KEY']??'';
        $fingerprint=hash('sha256',$method.' '.$path.' '.json_encode($p));
        if ($method==='POST' && $key && isset($db['idempotency'][$key])) {
            $cached=$db['idempotency'][$key];
            if ($cached['fingerprint']!==$fingerprint) missing('Idempotency key reused with different parameters.',409);
            $result=$cached['response'];
        } else {
            $result=api($db,$method,substr($path,4),$p);
            if ($method==='POST' && $key) $db['idempotency'][$key]=['fingerprint'=>$fingerprint,'response'=>$result];
        }
        $sendEvents=true; header('Content-Type: application/json'); $output=json_encode($result,JSON_THROW_ON_ERROR);
    } else {
        if (!in_array($method,['GET','POST'],true)) missing('Use GET or POST.',405);
        if ($method==='POST' && !hash_equals($db['csrf'],$_POST['csrf']??'')) missing('Invalid form token. Reload the page.',403);
        $parts=explode('/',trim($path,'/')); $id=$parts[1]??'';
        if ($path==='/') {
            $body='<p>Start a purchase on the Studiodeck Billing page, then choose its result here.</p>'.link_to(setting('FAKESTRIPE_APP_URL','http://localhost:8199'),'Open Studiodeck');
            $body.='<h2>Checkouts</h2><p>Pending purchases appear here once Studiodeck has created a checkout. A subscription is created only after payment is accepted.</p><table><tr><th>Checkout</th><th>Amount</th><th>Result</th></tr>';
            foreach (array_reverse($db['sessions']) as $s) $body.='<tr><td>'.link_to('/checkout/'.$s['id'],$s['id']).'</td><td>'.money($s['amount_total']).'</td><td>'.h($s['fake_outcome']??$s['status']).'</td></tr>';
            if (!$db['sessions']) $body.='<tr><td colspan="3">No checkouts received yet.</td></tr>';
            $body.='</table><h2>Subscriptions</h2><table><tr><th>Subscription</th><th>Package</th><th>Status</th></tr>';
            foreach (array_reverse($db['subscriptions']) as $s) {
                $names=array_map(fn($i)=>($db['products'][$i['price']['product']]['name']??$i['price']['id']).' × '.$i['quantity'],$s['items']['data']);
                $body.='<tr><td>'.h($s['id']).'</td><td>'.h(implode(', ',$names)).'</td><td>'.h($s['status']).($s['cancel_at_period_end']?' · cancels at period end':'').'</td></tr>';
            }
            if (!$db['subscriptions']) $body.='<tr><td colspan="3">No subscriptions created yet.</td></tr>';
            $body.='</table><h2>Invoices</h2><table><tr><th>Invoice</th><th>Amount</th><th>Status</th></tr>';
            foreach (array_reverse($db['invoices']) as $i) $body.='<tr><td>'.link_to('/invoice/'.$i['id'],$i['number']).'</td><td>'.money($i['total']).'</td><td>'.h($i['status']).'</td></tr>';
            $body.='</table><h2>Webhook deliveries</h2>'.form($db,'/events/retry','<button>Retry undelivered webhooks</button>').'<table><tr><th>Event</th><th>Delivery</th></tr>';
            foreach (array_slice(array_reverse($db['events']),0,30) as $event) $body.='<tr><td>'.h($event['payload']['type']).'</td><td>'.($event['delivered']?'Delivered':'Pending').' · HTTP '.$event['http_status'].' · '.$event['attempts'].' attempt(s)</td></tr>';
            $output=page('Payment test desk',$body.'</table>');
        } elseif ($path==='/events/retry' && $method==='POST') {
            $sendEvents=true; header('Location: /',true,303); $output='';
        } elseif ($parts[0]==='checkout' && $id) {
            $s=object_get($db,'sessions',$id);
            if ($method==='POST') {
                $outcome=$_POST['outcome']??''; if (!in_array($outcome,['accepted','declined'],true)) missing('Choose accepted or declined.');
                $s=checkout_finish($db,$id,$outcome); $sendEvents=true;
            }
            $s=api($db,'GET','checkout/sessions/'.$id,[]);
            $body='<p>Checkout <small>'.h($id).'</small></p>'.line_table($db,$s['lines']).'<h2>Total '.money($s['amount_total']).'</h2>';
            if ($s['status']==='open') $body.=payment_form($db,$path).'<p>'.link_to($s['cancel_url'],'Cancel and return to Studiodeck').'</p>';
            else {
                $accepted=$s['payment_status']==='paid';
                $returnUrl=$accepted?$s['success_url']:str_replace('checkout=success','checkout='.($s['status']==='expired'?'expired':'failed'),$s['success_url']);
                $body.='<p class="notice">'.($accepted?'Payment accepted.':($s['status']==='expired'?'Checkout expired.':'Payment declined. This purchase grants no new access. Existing trial, paid or legacy access stays valid. Start a new checkout in Billing to try again.')).'</p><p>'.link_to($returnUrl,'Return to Studiodeck').'</p>';
            }
            $output=page('Test checkout',$body);
        } elseif ($parts[0]==='invoice' && $id) {
            $i=object_get($db,'invoices',$id); $notice='';
            if ($method==='POST') {
                $outcome=$_POST['outcome']??''; if (!in_array($outcome,['accepted','declined'],true)) missing('Choose accepted or declined.');
                invoice_finish($db,$id,$outcome); $i=$db['invoices'][$id]; $sendEvents=true;
                $notice='<p class="notice">Payment '.h($outcome).'.</p>';
            }
            $body=$notice.'<p>'.h($i['description']).'</p><p>Status: <strong>'.h($i['status']).'</strong></p><h2>'.money($i['total']).'</h2>';
            if ($i['status']!=='paid') $body.=payment_form($db,$path);
            $body.='<p>'.link_to(setting('FAKESTRIPE_APP_URL','http://localhost:8199'),'Return to Studiodeck, then refresh Billing').'</p>';
            $output=page('Invoice '.$i['number'],$body);
        } elseif ($parts[0]==='portal' && $id) {
            $portal=object_get($db,'portals',$id);
            if ($method==='POST') {
                $sub=object_get($db,'subscriptions',$_POST['subscription']??'');
                if ($sub['customer']!==$portal['customer']) missing('Subscription belongs to another customer.',403);
                api($db,'POST','subscriptions/'.$sub['id'],['cancel_at_period_end'=>($_POST['cancel']??'')==='true'?'true':'false']); $sendEvents=true;
            }
            $body='<p>Manage this test customer’s subscription and view invoices.</p><p>Payment method updates are simulated by choosing a result on each payment form.</p>';
            foreach ($db['subscriptions'] as $s) if ($s['customer']===$portal['customer']) $body.='<h2>'.h($s['id']).'</h2><p>'.($s['cancel_at_period_end']?'Cancels at the end of the paid period.':'Active subscription.').'</p>'.form($db,$path,'<input type="hidden" name="subscription" value="'.h($s['id']).'"><input type="hidden" name="cancel" value="'.($s['cancel_at_period_end']?'false':'true').'"><button>'.($s['cancel_at_period_end']?'Keep subscription':'Cancel at period end').'</button>');
            foreach ($db['invoices'] as $i) if ($i['customer']===$portal['customer']) $body.='<p>'.link_to('/invoice/'.$i['id'],$i['number'].' · '.money($i['total']).' · '.$i['status']).'</p>';
            $output=page('Test billing portal',$body.'<p>'.link_to($portal['return_url'],'Return to Studiodeck').'</p>');
        } else missing('Page not found.',404);
        header('Content-Type: text/html; charset=utf-8');
    }
} catch (Throwable $e) {
    $db=$before; $sendEvents=false;
    $status=in_array($e->getCode(),[400,401,403,404,405,409],true)?$e->getCode():500; http_response_code($status);
    if ($status===500) error_log((string)$e);
    $message=$status===500?'Simulator error. Check container logs.':$e->getMessage();
    if ($isApi) { header('Content-Type: application/json'); $output=json_encode(['error'=>['type'=>'invalid_request_error','message'=>$message]]); }
    else { header('Content-Type: text/html; charset=utf-8'); $output=page('Unable to continue','<p>'.h($message).'</p>'); }
}
// Delivery runs in a separate process: the app may be waiting for this API response.
function persist(array $db,string $file): void {
    $tmp=$file.'.tmp';
    if (file_put_contents($tmp,json_encode($db,JSON_THROW_ON_ERROR))===false || !rename($tmp,$file)) throw new RuntimeException('Could not persist simulator state.');
}
persist($db,$file);
if ($path==='/events/retry' && $method==='POST' && $sendEvents) {
    foreach ($db['events'] as &$event) if (!$event['delivered']) $event['next_attempt']=0;
    unset($event); persist($db,$file);
}
flock($lock,LOCK_UN); fclose($lock);
echo $output;
