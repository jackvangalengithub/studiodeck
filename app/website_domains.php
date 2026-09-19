<?php
declare(strict_types=1);
function website_domain(array $u,array $b): void {
    $sid=$u['studio_id'];$site=website_get($sid);$name=strtolower(text_field($b['name']??'',253));
    if(!preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/D',$name)||filter_var($name,FILTER_VALIDATE_IP)||$name===parse_url(base_url(),PHP_URL_HOST))fail('Enter a public domain such as www.yourstudio.com.');
    if($name!==$site['domain']){query('UPDATE websites SET domain=?,domain_verified=0,domain_token=? WHERE studio_id=?',[$name,token(),$sid]);return;}
    $target=strtolower(rtrim(env('WEBSITE_CNAME_TARGET'),'.'));if(!$target)fail('Custom-domain hosting has not been configured yet.',503);
    rate_limit('website-domain:'.$sid,10,3600);$txt=dns_get_record('_studiodeck.'.$name,DNS_TXT)?:[];$cnames=dns_get_record($name,DNS_CNAME)?:[];
    if(!array_filter($txt,fn($r)=>($r['txt']??'')===$site['domain_token']))fail('The ownership TXT record is not visible yet. Check the value and try again.');
    if(!array_filter($cnames,fn($r)=>strtolower(rtrim($r['target']??'','.'))===$target))fail('The CNAME record is not pointing to StudioDeck yet. Check it and try again.');
    $root=website_root();if(!is_dir($root))mkdir($root,0700,true);$lock=fopen($root.'/domains.lock','c');if(!$lock||!flock($lock,LOCK_EX))fail('Domain setup is busy.',409);
    try{
        foreach(glob($root.'/*/domain.json')?:[] as $file){$other=json_decode(file_get_contents($file),true);if(($other['name']??'')===$name&&($other['studio_id']??'')!==$sid)fail('This domain is already connected to another website.',409);}
        $dir=website_dir($sid);if(!is_dir($dir))mkdir($dir,0700,true);website_write($dir.'/domain.json',json_encode(['name'=>$name,'studio_id'=>$sid]));query('UPDATE websites SET domain_verified=1 WHERE studio_id=?',[$sid]);
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
