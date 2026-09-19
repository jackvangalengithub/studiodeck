<?php
declare(strict_types=1);
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
    $clientPage=preg_match('~^/client/projects/([A-Za-z0-9_-]+)/?$~',$path,$clientRoute);
    $studioPage=!$clientPage && preg_match('~^/([A-Za-z0-9_-]+)/(projects(?:/[A-Za-z0-9_-]+)?|slide/[A-Za-z0-9_-]+|users|activity|comments|settings|billing|website|profile)/?$~',$path,$studioRoute);
    $file=realpath(__DIR__.$path);
    $asset=$file && str_starts_with($file,__DIR__.'/assets/') && is_file($file) && !str_contains($path,'..');
    if(!$appPage&&!$clientPage&&!$studioPage&&!$asset)fail('Not found.',404);
    $user=current_session();
    if(!$user){
        if($asset)fail('Please sign in.',401);
        header('Location: /login?returnTo='.rawurlencode($_SERVER['REQUEST_URI']),true,302);return;
    }
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
        $types=['js'=>'text/javascript','css'=>'text/css','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','webp'=>'image/webp','csv'=>'text/csv','pdf'=>'application/pdf','woff2'=>'font/woff2','webm'=>'video/webm','vtt'=>'text/vtt; charset=utf-8'];
        $ext=strtolower(pathinfo($file,PATHINFO_EXTENSION));if(!isset($types[$ext]))fail('Not found.',404);
        header('Content-Type: '.$types[$ext]);readfile($file);return;
    }
    header('Content-Type: text/html; charset=utf-8');
    $html=file_get_contents(__DIR__.'/index.html');
    foreach(['app.js','app.css'] as $asset){$version=substr(hash_file('sha256',__DIR__.'/assets/'.$asset),0,16);$html=str_replace('assets/'.$asset.'"','assets/'.$asset.'?v='.$version.'"',$html);}
    echo $html;
} catch(Throwable $e){
    $status=$e instanceof RuntimeException && in_array($e->getCode(),[400,401,403,404],true)?$e->getCode():500;
    http_response_code($status);header('Content-Type: text/plain; charset=utf-8');echo $status===500?'The application is unavailable.':$e->getMessage();
    if($status===500)error_log((string)$e);
}
