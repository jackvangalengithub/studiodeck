<?php
declare(strict_types=1);
require_once __DIR__.'/project_resources.php';
require_once __DIR__.'/api_dispatch.php';
require_once __DIR__.'/batch_actions.php';

function decode_api_batch(string $raw,string $studio): array {
    // Website drafts allow 2 MB of source; nested JSON string escaping adds overhead.
    if(strlen($raw)>16*1024*1024)fail('Batch is too large.',413);
    try{$groups=json_decode($raw,false,64,JSON_THROW_ON_ERROR);}catch(JsonException $e){fail('Please send a valid JSON batch.');}
    if(!is_array($groups)||!$groups)fail('A batch must contain request groups.');
    $calls=[];$ids=[];
    $allowed=['app:context','app:status','project:shell','project:overview','project:slides','project:files','project:budget','project:people','project:communication','project:jobs','project:presentation'];
    foreach($groups as $group){
        if(!is_array($group)||!$group)fail('Each batch group must contain requests.');
        foreach($group as $call){
            if(count($calls)>=100)fail('A batch supports at most 100 requests.');
            if(!$call instanceof stdClass||!is_string($call->id??null)||$call->id===''||isset($ids[$call->id]))fail('Request IDs must be unique nonempty strings.');
            $ids[$call->id]=true;
            if(!is_string($call->relative_url??null)||!str_starts_with($call->relative_url,$studio.'/'))fail('Subrequest studio does not match the batch.');
            $resource=substr($call->relative_url,strlen($studio)+1);
            $action=str_starts_with($resource,'api:')?substr($resource,4):null;
            $method=$action!==null?batch_action_method($action):(in_array($resource,$allowed,true)?'QUERY':null);
            if(!$method)fail('Unknown batch resource.',404);
            if(!in_array($call->method??null,$method==='QUERY'?['GET','QUERY']:['POST'],true))fail('Unsupported method for this batch resource.',405);
            // Existing writes can send email or call external services. Preserve each
            // action's own transaction; do not advertise multi-action atomicity.
            if($method==='POST'&&count($group)!==1)fail('Each write must have its own request group.');
            if($action!==null&&batch_context_action($action)&&($studio!=='account'||count($groups)!==1))fail('Session changes require a separate account batch.');
            if($action===null&&($studio==='account'||!empty($_SERVER['HTTP_AUTHORIZATION'])))fail('Use your studio session for project resources.',403);
            if(!is_string($call->body??null))fail('Subrequest bodies must be JSON strings.');
            if($action===null&&str_contains($call->body,'{{'))fail('Batch dependency tokens are not supported.');
            if(isset($call->requestingId)&&!is_string($call->requestingId))fail('Invalid requestingId.');
            try{$body=json_decode($call->body,false,64,JSON_THROW_ON_ERROR);}catch(JsonException $e){fail('Invalid subrequest JSON.');}
            if(!$body instanceof stdClass)fail('Subrequest bodies must be objects.');
            if($action===null&&str_contains(json_encode($body,JSON_UNESCAPED_UNICODE),'{{'))fail('Batch dependency tokens are not supported.');
            if($action===null){
                $fields=str_starts_with($resource,'project:')?['projectId','iterationId']:[];
                if(array_diff(array_keys((array)$body),$fields))fail('Unsupported resource parameters.');
            }elseif($method==='QUERY'){
                foreach((array)$body as $value)if(!is_scalar($value)&&$value!==null)fail('Read parameters must be scalar values.');
                if($action==='document_page'&&(isset($body->image)||isset($body->preview)))fail('Use the dedicated route for file downloads.');
            }
            $calls[]=['id'=>$call->id,'resource'=>$resource,'action'=>$action,'method'=>$method,'params'=>json_decode($call->body,true,64,JSON_THROW_ON_ERROR)];
        }
    }
    return $calls;
}

function execute_api_batch(array $calls): array {
    $results=[];$contexts=[];
    foreach($calls as $index=>$call){
        $start=microtime(true);$code=200;
        try{
            if($call['action']===null)$user=owner();
            if($call['action']!==null){
                $params=$call['params'];
                if($call['method']==='QUERY'){
                    // Match the legacy URLSearchParams contract, including boolean filters.
                    $query=[];foreach($params as $key=>$value)if($value!==null)$query[$key]=is_bool($value)?($value?'true':'false'):(string)$value;
                    $response=dispatch_api_action($call['action'],$query,null,'GET');
                }else{
                    $contexts=[];
                    $response=dispatch_api_action($call['action'],[],$params,'POST');
                }
                $code=$response->status;$payload=$response->payload;
            }
            elseif($call['resource']==='app:context')$payload=session_details(current_session());
            elseif($call['resource']==='app:status')$payload=['unread_count'=>unread_comment_count($user),'billing'=>billing_summary($user['studio_id'])];
            else{
                $params=$call['params'];
                $key=json_encode([$params['projectId']??null,$params['iterationId']??null]);
                if(!isset($contexts[$key]))$contexts[$key]=project_read_context($user,$params);
                [$project,$iteration]=$contexts[$key];
                $payload=project_resource(explode(':',$call['resource'],2)[1],$user,$project,$iteration);
            }
            $body=$code>=400?['message'=>$payload['error']??'This request could not be completed.','other'=>$payload]:['other'=>$payload];
        }catch(Throwable $e){
            $code=$e instanceof RuntimeException&&in_array($e->getCode(),[400,401,402,403,404,409,429],true)?$e->getCode():500;
            if($code===500)error_log((string)$e);
            $body=['message'=>$code===500?'Unable to load this resource.':$e->getMessage()];
        }
        $results[]=['index'=>$index,'responseid'=>$call['id'],'code'=>$code,'body'=>$body,'duration'=>(int)round((microtime(true)-$start)*1000)];
    }
    return $results;
}

function serve_api_batch(string $studio): never {
    try{
        if(($_SERVER['REQUEST_METHOD']??'')!=='POST')fail('Please use POST for batches.',405);
        if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')fail('Please send a JSON batch.');
        $authorization=$_SERVER['HTTP_AUTHORIZATION']??'';
        if($authorization!==''&&($studio!=='account'||!preg_match('/^Client [A-Za-z0-9_-]+$/D',$authorization)))fail('Use a valid session context for this batch.',403);
        if(isset($_SERVER['HTTP_X_STUDIO_ID'])&&$_SERVER['HTTP_X_STUDIO_ID']!==$studio)fail('Studio header does not match the URL.');
        if($studio==='account')unset($_SERVER['HTTP_X_STUDIO_ID']);else $_SERVER['HTTP_X_STUDIO_ID']=$studio;
        if($studio==='account')authenticated_user(true);else owner(true);
        $calls=decode_api_batch(file_get_contents('php://input'),$studio);
        json_response(execute_api_batch($calls));
    }catch(Throwable $e){
        $status=$e instanceof RuntimeException&&in_array($e->getCode(),[400,401,403,404,405,413,429],true)?$e->getCode():500;
        if($status===500)error_log((string)$e);
        json_response(['message'=>$status===500?'Unable to process this batch.':$e->getMessage()],$status);
    }
}
