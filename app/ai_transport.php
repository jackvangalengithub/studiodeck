<?php
declare(strict_types=1);

function ai_request_handle(string $path,array $body,bool $multipart=false): CurlHandle {
    if(env('OPENAI_API_KEY')==='')throw new RuntimeException('AI is not connected.');
    $ch=curl_init('https://api.openai.com/v1/'.$path);
    $headers=['Authorization: Bearer '.env('OPENAI_API_KEY')];
    if(!$multipart)$headers[]='Content-Type: application/json';
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$multipart?$body:json_encode($body,JSON_INVALID_UTF8_SUBSTITUTE),CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>15,CURLOPT_TIMEOUT=>$multipart?240:90,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS]);
    return $ch;
}

function ai_response(string|false $raw,int $code,int $errno=0): array {
    if($raw===false||$errno!==0||$code>=300) {
        error_log('AI request failed with HTTP '.$code.' cURL '.$errno);
        throw new RuntimeException('The AI service could not finish this request. Please try again.');
    }
    $data=json_decode($raw,true);
    if(!is_array($data))throw new RuntimeException('The AI service returned an unreadable response.');
    return $data;
}

function ai_request(string $path,array $body,bool $multipart=false): array {
    $ch=ai_request_handle($path,$body,$multipart);
    try{$raw=curl_exec($ch);return ai_response($raw,curl_getinfo($ch,CURLINFO_RESPONSE_CODE),curl_errno($ch));}
    finally{curl_close($ch);}
}

function ai_json_body(string $system,array $content): array {
    return ['model'=>env('OPENAI_TEXT_MODEL','gpt-4.1-mini'),'messages'=>[['role'=>'system','content'=>$system.' Return a JSON object only.'],['role'=>'user','content'=>$content]],'response_format'=>['type'=>'json_object'],'max_completion_tokens'=>6000];
}

function ai_json_response(array $response): array {
    $raw=$response['choices'][0]['message']['content']??null;
    $data=is_string($raw)?json_decode($raw,true):null;
    if(!is_array($data))throw new RuntimeException('The AI response needs another attempt.');
    return $data;
}

function ai_json(string $system,array $content): array {
    return ai_json_response(ai_request('chat/completions',ai_json_body($system,$content)));
}

function document_page_concurrency(): int {
    $value=env('DOCUMENT_PAGE_CONCURRENCY','4');
    return preg_match('/^[1-8]$/D',$value)?(int)$value:4;
}

/**
 * Factories return [system prompt, content] only when a slot is free.
 * Results retain input keys/order and contain either data or a per-request error.
 * The optional handle factory is a test seam, never a configurable API endpoint.
 */
function ai_json_parallel(array $factories,int $concurrency,?callable $progress=null,?callable $handleFactory=null): array {
    if($concurrency<1||$concurrency>8)throw new InvalidArgumentException('AI concurrency must be between 1 and 8.');
    $handleFactory??=fn($body)=>ai_request_handle('chat/completions',$body);
    $multi=curl_multi_init();$active=[];$results=[];$keys=array_keys($factories);$next=0;$total=count($keys);
    $lastReport=0.0;$lastCounts=null;
    $report=function()use($progress,&$results,&$active,$total,&$lastReport,&$lastCounts){
        $counts=[count($results),$total,count($active)];$time=hrtime(true)/1e9;
        if($progress&&($counts!==$lastCounts||$time-$lastReport>=5)){
            $progress(...$counts);$lastCounts=$counts;$lastReport=$time;
        }
    };
    try {
        do {
            while($next<$total&&count($active)<$concurrency){
                $key=$keys[$next++];$ch=null;
                try{
                    [$system,$content]=$factories[$key]();
                    $ch=$handleFactory(ai_json_body($system,$content));
                    unset($system,$content);
                    if(curl_multi_add_handle($multi,$ch)!==CURLM_OK)throw new RuntimeException('The AI request could not start.');
                    $active[spl_object_id($ch)]=['handle'=>$ch,'key'=>$key];
                }catch(Throwable $error){
                    if($ch instanceof CurlHandle)curl_close($ch);
                    $results[$key]=['error'=>$error->getMessage()];
                }
                unset($ch,$system,$content);
            }
            $report();
            if(!$active)break;
            do{$status=curl_multi_exec($multi,$running);}while($status===CURLM_CALL_MULTI_PERFORM);
            if($status!==CURLM_OK)throw new RuntimeException('The AI request pool could not continue.');
            $finished=false;
            while($info=curl_multi_info_read($multi)){
                $ch=$info['handle'];$slot=spl_object_id($ch);$key=$active[$slot]['key'];
                try{
                    $results[$key]=['data'=>ai_json_response(ai_response(curl_multi_getcontent($ch),curl_getinfo($ch,CURLINFO_RESPONSE_CODE),$info['result']))];
                }catch(Throwable $error){$results[$key]=['error'=>$error->getMessage()];}
                finally{curl_multi_remove_handle($multi,$ch);curl_close($ch);unset($active[$slot]);}
                unset($ch,$info);$finished=true;
            }
            $report();
            // Refill immediately; a slow request must not hold up the next page.
            if(!$finished&&$active&&curl_multi_select($multi,0.5)===-1)usleep(10000);
        }while($active||$next<$total);
    }finally{
        foreach($active as $entry){curl_multi_remove_handle($multi,$entry['handle']);curl_close($entry['handle']);}
        curl_multi_close($multi);
    }
    $ordered=[];foreach($keys as $key)$ordered[$key]=$results[$key];
    return $ordered;
}
