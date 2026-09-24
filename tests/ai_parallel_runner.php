<?php
declare(strict_types=1);
// Isolated harness: never loads .env, the application database, or real credentials.
function env(string $key,string $default=''): string { return getenv($key)===false?$default:(string)getenv($key); }
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function query(string $sql,array $params): void {
    $GLOBALS['heartbeats'][]=['time'=>microtime(true),'progress'=>json_decode($params[0],true)['progress'],'started_at'=>$params[1],'job'=>$params[2]];
}
require __DIR__.'/../app/ai_transport.php';
require __DIR__.'/../app/documents.php';
$input=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);
$handles=[];$reports=[];$built=[];$GLOBALS['heartbeats']=[];
$handleFactory=function($body)use($input,&$handles){
    $ch=curl_init($input['url']);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($body),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>1,CURLOPT_TIMEOUT_MS=>$input['timeout_ms']??10000,CURLOPT_PROTOCOLS=>CURLPROTO_HTTP]);
    $handles[]=WeakReference::create($ch);
    return $ch;
};
$started=microtime(true);
$progress=function($completed,$total,$active)use(&$reports,$input){
    $reports[]=['time'=>microtime(true),'completed'=>$completed,'total'=>$total,'active'=>$active];
    if(!empty($input['abort'])&&$active)throw new RuntimeException('Stop fixture pool');
};
if(($input['mode']??'pool')==='pages'){
    putenv('DOCUMENT_PAGE_CONCURRENCY='.($input['concurrency']??4));
    $GLOBALS['processing_job']='fixture-job';
    $dir=sys_get_temp_dir().'/sd-parallel-'.bin2hex(random_bytes(5));mkdir($dir);
    file_put_contents($dir.'/preview.jpg','mock-page-image');
    $inventory=['pages'=>[],'page_count'=>count($input['requests']),'warnings'=>[]];
    foreach($input['requests'] as $request)$inventory['pages'][]=['number'=>$request['number'],'text'=>json_encode($request),'preview'=>($request['preview']??true)?(!empty($request['missing'])?'missing.jpg':'preview.jpg'):null,'candidates'=>[]];
    try{
        $results=plan_document_pages($inventory,$dir,null,fn($factories,$limit,$callback)=>ai_json_parallel($factories,$limit,$callback,$handleFactory));
    }finally{unlink($dir.'/preview.jpg');rmdir($dir);}
    $output=['results'=>$results,'warnings'=>$inventory['warnings'],'heartbeats'=>$GLOBALS['heartbeats']];
}else{
    $factories=[];
    foreach($input['requests'] as $request){
        $factories[$request['number']]=function()use($request,&$built){
            $built[]=['number'=>$request['number'],'time'=>microtime(true)];
            if(!empty($request['factory_error']))throw new RuntimeException('Unavailable preview');
            return ['fixture',[['type'=>'text','text'=>json_encode($request)]]];
        };
    }
    try{$results=ai_json_parallel($factories,$input['concurrency']??4,$progress,$handleFactory);}
    catch(RuntimeException $error){if(empty($input['abort']))throw $error;$results=[];}
    $output=['results'=>$results,'reports'=>$reports,'built'=>$built];
}
$output['elapsed']=microtime(true)-$started;
$output['live_handles']=count(array_filter($handles,fn($ref)=>$ref->get()!==null));
$output['configured_concurrency']=document_page_concurrency();
echo json_encode($output,JSON_THROW_ON_ERROR)."\n";
