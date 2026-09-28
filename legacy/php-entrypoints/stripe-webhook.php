<?php
declare(strict_types=1);
require_once __DIR__.'/../app/bootstrap.php';
header('Content-Type: application/json');header('Cache-Control: no-store');
try{
    if(($_SERVER['REQUEST_METHOD']??'')!=='POST')fail('Use POST.',405);
    $raw=file_get_contents('php://input',false,null,0,2*1024*1024+1);
    $event=stripe_verified_event($raw?:'',$_SERVER['HTTP_STRIPE_SIGNATURE']??'');
    query('INSERT OR IGNORE INTO stripe_events(id,type,payload,received_at) VALUES(?,?,?,?)',[$event['id'],$event['type'],$raw,time()]);
    // Acknowledge durable receipt. The billing worker retries fulfillment independently.
    http_response_code(200);echo '{"received":true}';
}catch(Throwable $e){$code=in_array($e->getCode(),[400,405,413,503],true)?$e->getCode():500;http_response_code($code);echo json_encode(['error'=>$code===500?'Unable to record event.':$e->getMessage()]);}
