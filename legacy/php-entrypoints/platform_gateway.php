<?php
declare(strict_types=1);
// Application shell + fixed-upstream proxy. No StudioDeck database or API dispatch.
function serve_platform_gateway(string $path): void {
    header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
    $root=realpath(__DIR__.'/../public');
    if($path==='/api.php'||$path==='/stripe-webhook.php'){
        http_response_code(410);header('Content-Type: application/json');echo json_encode(['error'=>'The legacy StudioDeck API has been retired.']);return;
    }
    if(str_starts_with($path,'/platform-unavailable/')){http_response_code(501);header('Content-Type: application/json');echo json_encode(['error'=>'This feature needs platform integration.']);return;}
    $remote=preg_match('~^/(?:api/1\.0/|whoami$|auth/config$|authenticate(?:/|$)|webauthn/|sso/|google/|microsoft/|apple/|oauth/|login$|logout$|administrations(?:/|$)|approval/|wizard/|platform-assets/|[A-Za-z0-9_-]+/userfiles(?:/|$))~',$path);
    if($remote){
        $upstream=rtrim(getenv('PLATFORM_UPSTREAM')?:((is_file('/.dockerenv')?'http://host.docker.internal':'http://localhost').':8101'),'/');
        if(!preg_match('~^https?://[^/?#]+$~D',$upstream)){http_response_code(503);echo 'Invalid PLATFORM_UPSTREAM configuration.';return;}
        $uri=$_SERVER['REQUEST_URI'];if(str_starts_with($path,'/platform-assets/'))$uri='/assets/'.substr($uri,17);
        $curl=curl_init($upstream.$uri);$headers=[];
        foreach(getallheaders() as $name=>$value){if(in_array(strtolower($name),['host','connection','content-length','accept-encoding','transfer-encoding','forwarded','x-forwarded-host','x-forwarded-proto','x-forwarded-for'],true))continue;$headers[]=$name.': '.$value;}
        // Preserve browser Origin and cookies; the platform performs authentication and CSRF checks.
        $headers[]='Host: '.$_SERVER['HTTP_HOST'];
        $responseHeaders=[];
        curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$_SERVER['REQUEST_METHOD'],CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>25,CURLOPT_NOBODY=>($_SERVER['REQUEST_METHOD']==='HEAD'),CURLOPT_HEADERFUNCTION=>static function($ch,$line)use(&$responseHeaders){$responseHeaders[]=$line;return strlen($line);}]);
        if(!in_array($_SERVER['REQUEST_METHOD'],['GET','HEAD'],true))curl_setopt($curl,CURLOPT_POSTFIELDS,file_get_contents('php://input'));
        $body=curl_exec($curl);$status=(int)curl_getinfo($curl,CURLINFO_RESPONSE_CODE);$type=(string)curl_getinfo($curl,CURLINFO_CONTENT_TYPE);
        if($body===false){http_response_code(502);header('Content-Type: application/json');echo json_encode(['error'=>'Cannot reach the platform. Check PLATFORM_UPSTREAM.']);return;}
        http_response_code($status);
        foreach($responseHeaders as $line){$parts=explode(':',$line,2);if(count($parts)!==2)continue;[$name,$value]=$parts;$value=trim($value);$lower=strtolower($name);if(in_array($lower,['content-length','transfer-encoding','connection','content-encoding'],true))continue;
            if($lower==='location'){$value=str_replace($upstream,'',$value);if(preg_match('~^/(\d+)/?$~',$value,$m))$value='/'.$m[1].'/projects';}
            header($name.': '.$value,$lower!=='set-cookie');
        }
        if(str_contains($type,'text/html'))$body=str_replace(['/assets/','http://localhost:8101/'],['/platform-assets/','/'],$body);
        echo $body;return;
    }
    $file=realpath($root.$path);
    if($file&&str_starts_with($file,$root.'/')&&is_file($file)&&preg_match('~^/(?:assets/|auth/error-page\.)~',$path)){
        $types=['js'=>'text/javascript','css'=>'text/css','json'=>'application/json','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp','woff2'=>'font/woff2','ttf'=>'font/ttf','csv'=>'text/csv','pdf'=>'application/pdf','webm'=>'video/webm','vtt'=>'text/vtt'];$ext=pathinfo($file,PATHINFO_EXTENSION);
        if(!isset($types[$ext])){http_response_code(404);return;}header('Content-Type: '.$types[$ext]);readfile($file);return;
    }
    if($path==='/starttrial'){header('Location: /administrations',true,302);return;}
    if(preg_match('~^/(\d+)/?$~D',$path,$tenantRoot)){header('Location: /'.$tenantRoot[1].'/projects',true,302);return;}
    $page=in_array($path,['/','/index.html','/choose'],true)||preg_match('~^/(?:[A-Za-z0-9_-]+/(?:projects(?:/[A-Za-z0-9_-]+)?|slide/[A-Za-z0-9_-]+|users|comments|attention|settings|billing|website|profile)|client/projects/[A-Za-z0-9_-]+|conversations/[A-Za-z0-9_-]+)/?$~D',$path);
    if(!$page){http_response_code(404);echo 'Not found.';return;}
    header('Content-Type: text/html; charset=utf-8');$html=file_get_contents($root.'/index.html');
    $mappingPath=__DIR__.'/platform-studios.json';
    try{$studioMappings=is_file($mappingPath)?json_decode(file_get_contents($mappingPath),false,512,JSON_THROW_ON_ERROR):(object)[];
        if(!is_object($studioMappings))throw new RuntimeException('Invalid studio mapping.');
        foreach($studioMappings as $tenant=>$studioId)if(!is_string($studioId)||!preg_match('/^[a-zA-Z0-9_-]+$/D',$studioId))throw new RuntimeException('Invalid studio ID.');
    }catch(Throwable $e){http_response_code(503);echo 'Invalid app/platform-studios.json configuration.';return;}
    $config=json_encode(['studioMappings'=>$studioMappings],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT);
    $html=str_replace('</head>','<script type="application/json" id="platform-config">'.$config.'</script></head>',$html);
    foreach(['app.js','app.css'] as $asset)$html=str_replace('assets/'.$asset.'"','assets/'.$asset.'?v='.substr(hash_file('sha256',$root.'/assets/'.$asset),0,16).'"',$html);
    if(str_starts_with($path,'/conversations/'))$html=preg_replace('~<script type="module" src="assets/app.js[^"]*"></script>~','<script type="module" src="assets/conversation.js"></script>',$html);
    echo $html;
}
