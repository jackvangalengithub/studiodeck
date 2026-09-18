<?php
declare(strict_types=1);

/** Accept individual YouTube videos only; never persist arbitrary embed HTML or hosts. */
function youtube_video(string $value): ?array {
    $value=trim($value);if(strlen($value)>2048||preg_match('/[\s\\\\]/',$value))return null;
    if(preg_match('~^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)/~i',$value))$value='https://'.$value;
    $url=parse_url($value);
    if(!$url||!in_array(strtolower($url['scheme']??''),['http','https'],true)||isset($url['user'])||isset($url['pass'])||isset($url['port']))return null;
    $host=strtolower($url['host']??'');$path=$url['path']??'';parse_str($url['query']??'',$query);$id=null;
    if($host==='youtu.be'&&preg_match('~^/([A-Za-z0-9_-]{11})/?$~D',$path,$match))$id=$match[1];
    elseif(in_array($host,['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'],true)){
        if(rtrim($path,'/')==='/watch')$id=$query['v']??null;
        elseif(preg_match('~^/(?:shorts|live|embed)/([A-Za-z0-9_-]{11})/?$~D',$path,$match))$id=$match[1];
    }elseif(in_array($host,['youtube-nocookie.com','www.youtube-nocookie.com'],true)&&preg_match('~^/embed/([A-Za-z0-9_-]{11})/?$~D',$path,$match))$id=$match[1];
    if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id))return null;
    $time=$query['start']??$query['t']??'0';$start=0;
    if(is_string($time)){
        if(preg_match('/^\d{1,6}s?$/D',$time))$start=(int)$time;
        elseif(preg_match('/^(?:(\d{1,2})h)?(?:(\d{1,2})m)?(?:(\d{1,2})s)?$/D',$time,$parts))$start=(int)($parts[1]??0)*3600+(int)($parts[2]??0)*60+(int)($parts[3]??0);
    }
    $start=min(86400,$start);
    return ['provider'=>'youtube','id'=>$id,'start'=>$start,'url'=>'https://www.youtube.com/watch?v='.$id.($start?'&t='.$start:'')];
}
