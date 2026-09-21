<?php
declare(strict_types=1);
// Temporary, self-contained product concept. No application session or data access.
$mockPath=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'/');
if($mockPath==='/mock'||str_starts_with($mockPath,'/mock/')){
    $mockFiles=['/mock'=>'index.html','/mock/'=>'index.html','/mock/index.html'=>'index.html','/mock/mock.css'=>'mock.css','/mock/mock.js'=>'mock.js'];
    header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'");
    $mockFile=$mockFiles[$mockPath]??null;
    if(!$mockFile&&preg_match('~^/mock/assets/[a-zA-Z0-9_./-]+\.(?:js|css|svg|webp|png|jpg|csv|pdf|woff2|vtt)$~D',$mockPath)&&!str_contains($mockPath,'..'))$mockFile=substr($mockPath,6);
    $mockReal=$mockFile?realpath(__DIR__.'/mock/'.$mockFile):false;
    if($mockReal&&!str_starts_with($mockReal,__DIR__.'/mock/'))$mockFile=null;
    if(!$mockFile||!is_file(__DIR__.'/mock/'.$mockFile)){http_response_code(404);header('Content-Type: text/plain; charset=utf-8');echo 'Not found.';return;}
    $mockTypes=['html'=>'text/html; charset=utf-8','css'=>'text/css; charset=utf-8','js'=>'text/javascript; charset=utf-8','webp'=>'image/webp','ttf'=>'font/ttf','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','csv'=>'text/csv; charset=utf-8','pdf'=>'application/pdf','woff2'=>'font/woff2','vtt'=>'text/vtt; charset=utf-8'];
    header('Content-Type: '.$mockTypes[pathinfo($mockFile,PATHINFO_EXTENSION)]);
    readfile(__DIR__.'/mock/'.$mockFile);return;
}
// All pages AND static assets must pass through this gateway in production.
require_once __DIR__.'/../app/bootstrap.php';
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'/');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
// The practice tour embeds our own app; all other pages remain unframeable.
$practiceFrame=$path==='/index.html'&&($_GET['app-tour']??'')==='1';
header('X-Frame-Options: '.($practiceFrame?'SAMEORIGIN':'DENY'));
if($practiceFrame)header("Content-Security-Policy: frame-ancestors 'self'");
try {
    require_once __DIR__.'/../app/website_public.php';
    if(website_public_route($path))return;
    if($path==='/stripe-webhook.php'){require __DIR__.'/stripe-webhook.php';return;}
    if($path==='/api.php'){require __DIR__.'/api.php';return;}
    if($path==='/login'){
        header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
        header('Content-Type: text/html; charset=utf-8');
        $catalogs=[];foreach(['en','nl'] as $language){$copy=require __DIR__.'/../app/languages/'.$language.'.php';$catalogs[$language]=array_filter($copy,fn($key)=>str_starts_with($key,'login_'),ARRAY_FILTER_USE_KEY);}
        $html=file_get_contents(__DIR__.'/auth/login.html');
        $replacements=['{{login_translations}}'=>json_encode($catalogs,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)];
        foreach($catalogs['en'] as $key=>$value)$replacements['{{'.$key.'}}']=htmlspecialchars($value,ENT_QUOTES,'UTF-8');
        echo strtr($html,$replacements);return;
    }
    if(in_array($path,['/auth/login.js','/auth/login.css'],true)){
        header('Content-Type: '.(str_ends_with($path,'.js')?'text/javascript':'text/css').'; charset=utf-8');readfile(__DIR__.$path);return;
    }
    $appPage=$path==='/'||$path==='/index.html'||$path==='/choose';
    $conversationPage=preg_match('~^/conversations/([A-Za-z0-9_-]+)/?$~',$path,$conversationRoute);
    $clientPage=preg_match('~^/client/projects/([A-Za-z0-9_-]+)/?$~',$path,$clientRoute);
    $studioPage=!$clientPage && preg_match('~^/([A-Za-z0-9_-]+)/(projects(?:/[A-Za-z0-9_-]+)?|slide/[A-Za-z0-9_-]+|users|activity|comments|settings|billing|website|profile)/?$~',$path,$studioRoute);
    $file=realpath(__DIR__.$path);
    $asset=$file && str_starts_with($file,__DIR__.'/assets/') && is_file($file) && !str_contains($path,'..');
    if(!$appPage&&!$clientPage&&!$studioPage&&!$conversationPage&&!$asset)fail('Not found.',404);
    $user=current_session();
    if(!$user){
        if($asset)fail('Please sign in.',401);
        header('Location: /login?returnTo='.rawurlencode($_SERVER['REQUEST_URI']),true,302);return;
    }
    if($conversationPage)conversation_access($conversationRoute[1]);
    if($clientPage)account_client_share($user,$clientRoute[1],text_field($_GET['iteration']??''));
    if($studioPage){
        $user['studio_id']=$studioRoute[1];require_studio_member($user);
        $route=explode('/',$studioRoute[2]);
        if(in_array($route[0],['billing','website'],true))studio_admin($user);
        $project=null;
        if($route[0]==='projects'&&isset($route[1]))$project=owned_project($route[1],$user,false);
        if($route[0]==='slide'){
            $pid=text_field($_GET['project']??'');$iid=text_field($_GET['iteration']??'');
            if($pid)$project=owned_project($pid,$user,false);
            else {
                $slide=preg_replace('/^visual-/','',$route[1]);
                $params=[$slide,$user['studio_id'],$user['user_id']];$where='s.id=? AND '.project_access_sql();
                if($iid){$where.=' AND i.id=?';$params[]=$iid;}
                $found=one('SELECT p.id FROM presentation_slides s JOIN iterations i ON i.id=s.iteration_id JOIN projects p ON p.id=i.project_id WHERE '.$where.' ORDER BY i.number DESC LIMIT 1',$params);
                if(!$found)fail('Slide not found.',404);$project=owned_project($found['id'],$user,false);
            }
        }
        if($project&&!empty($_GET['iteration'])){
            $iteration=owned_iteration(text_field($_GET['iteration']),$user);
            if($iteration['project_id']!==$project['id'])fail('Presentation not found.',404);
        }
    }
    if($asset){
        $types=['json'=>'application/json','js'=>'text/javascript','css'=>'text/css','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp','csv'=>'text/csv','pdf'=>'application/pdf','woff2'=>'font/woff2','webm'=>'video/webm','vtt'=>'text/vtt; charset=utf-8'];
        $ext=strtolower(pathinfo($file,PATHINFO_EXTENSION));if(!isset($types[$ext]))fail('Not found.',404);
        header('Content-Type: '.$types[$ext]);
        $size=filesize($file);
        if($ext==='webm'){
            header('Accept-Ranges: bytes');
            if(preg_match('/^bytes=(\d*)-(\d*)$/',$_SERVER['HTTP_RANGE']??'',$range)&&($range[1]!==''||$range[2]!=='')){
                $start=$range[1]===''?max(0,$size-(int)$range[2]):(int)$range[1];
                $end=$range[1]===''||$range[2]===''?$size-1:min($size-1,(int)$range[2]);
                if($start>$end||$start>=$size){http_response_code(416);header('Content-Range: bytes */'.$size);header('Content-Length: 0');return;}
                http_response_code(206);header("Content-Range: bytes $start-$end/$size");header('Content-Length: '.($end-$start+1));
                $stream=fopen($file,'rb');fseek($stream,$start);$remaining=$end-$start+1;
                while($remaining>0&&!feof($stream)){$chunk=fread($stream,min(65536,$remaining));if($chunk===false||$chunk==='')break;echo $chunk;$remaining-=strlen($chunk);}
                fclose($stream);return;
            }
        }
        header('Content-Length: '.$size);readfile($file);return;
    }
    header('Content-Type: text/html; charset=utf-8');
    $html=file_get_contents(__DIR__.'/index.html');
    foreach(['app.js','app.css'] as $asset){$version=substr(hash_file('sha256',__DIR__.'/assets/'.$asset),0,16);$html=str_replace('assets/'.$asset.'"','assets/'.$asset.'?v='.$version.'"',$html);}
    if($conversationPage)$html=preg_replace('~<script type="module" src="assets/app.js[^"]*"></script>~','<script type="module" src="assets/conversation.js"></script>',$html);
    echo $html;
} catch(Throwable $e){
    $status=$e instanceof RuntimeException && in_array($e->getCode(),[400,401,403,404],true)?$e->getCode():500;
    http_response_code($status);header('Content-Type: text/plain; charset=utf-8');echo $status===500?'The application is unavailable.':$e->getMessage();
    if($status===500)error_log((string)$e);
}
