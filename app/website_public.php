<?php
declare(strict_types=1);
// Published pages use filesystem snapshots only; they never read project or studio records.
function website_public_route(string $path): bool {
    $host=strtolower(explode(':',$_SERVER['HTTP_HOST']??'')[0]);$appHost=strtolower((string)parse_url(base_url(),PHP_URL_HOST));$sid='';$relative='';$mount='';
    if($path==='/website-tls-check'&&$host===$appHost){
        $domain=strtolower((string)($_GET['domain']??''));$allowed=false;
        foreach(glob(website_root().'/*/domain.json')?:[] as $f){$entry=json_decode(file_get_contents($f),true);if(($entry['name']??'')===$domain){$allowed=true;break;}}
        http_response_code($allowed?200:403);header('Content-Type: text/plain');echo $allowed?'Allowed':'Not allowed';return true;
    }
    if($host!==$appHost){
        foreach(glob(website_root().'/*/current.json')?:[] as $f){$current=json_decode(file_get_contents($f),true);if(($current['domain']??'')===$host){$sid=basename(dirname($f));break;}}
        if(!$sid){http_response_code(404);echo 'Website not found.';return true;}$relative=ltrim($path,'/');
    }elseif(preg_match('~^/sites/([a-f0-9]{32})(?:/(.*))?$~D',$path,$m)){
        $sid=$m[1];$relative=$m[2]??'';$mount='/sites/'.$sid;
        if($path===$mount){header('Location: '.$mount.'/',true,301);return true;}
    }else return false;
    $live=website_live($sid);if(!$live||(int)($live['paid_until']??0)<=time()){http_response_code(404);echo 'Website unavailable.';return true;}
    if($mount&&!empty($live['domain'])){header('Location: https://'.$live['domain'].'/'.ltrim($relative,'/'),true,301);return true;}
    if(!preg_match('/^[a-f0-9]{32}$/D',$live['release']??'')){http_response_code(404);return true;}
    $root=website_dir($sid).'/releases/'.$live['release'];$relative=$relative?:'index.html';
    if(str_contains($relative,'..')||str_contains($relative,"\0")||str_contains($relative,'\\')||!preg_match('~^(?:index\.html|styles\.css|script\.js|404\.html|robots\.txt|sitemap\.xml|projects/[a-z0-9-]+\.html|assets/[a-f0-9]+(?:-[0-9]+)?\.(?:jpg|webp))$~D',$relative)){http_response_code(404);return true;}
    $meta=json_decode(file_get_contents($root.'/release.json'),true);if(isset($meta['redirects'][$relative])){header('Location: '.$mount.'/'.$meta['redirects'][$relative],true,301);return true;}
    $file=$root.'/public/'.$relative;if(!is_file($file)){http_response_code(404);$file=$root.'/public/404.html';}
    $types=['css'=>'text/css; charset=utf-8','js'=>'text/javascript; charset=utf-8','html'=>'text/html; charset=utf-8','txt'=>'text/plain; charset=utf-8','xml'=>'application/xml; charset=utf-8','jpg'=>'image/jpeg','webp'=>'image/webp'];header('Content-Type: '.$types[pathinfo($file,PATHINFO_EXTENSION)]);header('Cache-Control: public, max-age=60');header('Content-Security-Policy: '.website_code_policy());header('Referrer-Policy: strict-origin-when-cross-origin');readfile($file);return true;
}
