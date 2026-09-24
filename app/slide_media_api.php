<?php
declare(strict_types=1);
if($action==='slide_media'){
    [$i,,$isOwner]=access_iteration(text_field($_GET['iteration']??''));
    $slide=current_slide($i['id'],text_field($_GET['slide_id']??''));if(!$slide)fail('Slide not found.',404);
    $meta=json_decode($slide['metadata'],true)?:[];$mid=text_field($_GET['media_id']??'');$allowed=[];
    if($slide['type']==='video'&&($meta['video']['provider']??'')==='upload')$allowed[]=$meta['video']['media_id'];
    foreach($isOwner?['motion','motion_candidate']:['motion'] as $key)if(($meta[$key]['source_key']??null)===motion_source_key($slide))$allowed[]=$meta[$key]['media_id']??'';
    if(!$mid||!in_array($mid,$allowed,true))fail('Video not found in this presentation.',404);
    $media=one('SELECT mime,data FROM slide_media WHERE id=? AND project_id=?',[$mid,$i['project_id']]);if(!$media)fail('Video not found.',404);
    $size=strlen($media['data']);$start=0;$end=$size-1;header('Accept-Ranges: bytes');header('Content-Type: '.$media['mime']);
    if(isset($_SERVER['HTTP_RANGE'])){
        if(!preg_match('/^bytes=(\d*)-(\d*)$/',$_SERVER['HTTP_RANGE'],$m)||($m[1]===''&&$m[2]==='')){http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
        if($m[1]==='')$start=max(0,$size-(int)$m[2]);else{$start=(int)$m[1];if($m[2]!=='')$end=min($end,(int)$m[2]);}
        if($start>$end||$start>=$size){http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
        http_response_code(206);header("Content-Range: bytes $start-$end/$size");
    }
    header('Content-Length: '.($end-$start+1));echo substr($media['data'],$start,$end-$start+1);exit;
}
if(in_array($action,['save_slide_motion','generate_slide_motion'],true)){
    $u=owner(true);$b=input();
    $result=transaction(function()use($action,$u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$slide=motion_slide($i,text_field($b['slide_id']??''));
        if($action==='generate_slide_motion')return ['id'=>queue_slide_video($i,$slide,$b)];
        $mode=$b['mode']??'none';$meta=json_decode($slide['metadata'],true)?:[];
        if($mode==='none')unset($meta['motion']);
        elseif($mode==='ai'){
            $candidate=$meta['motion_candidate']??$meta['motion']??[];
            if(empty($candidate['media_id'])||$candidate['media_id']!==($b['media_id']??'')||($candidate['source_key']??'')!==motion_source_key($slide))fail('Preview the movement for the current photo before applying it.',409);
            if(isset($candidate['prompt'])&&slide_motion_prompt($b['prompt']??'')!==$candidate['prompt'])fail('The instructions changed. Generate and preview the new movement before applying it.',409);
            $meta['motion']=[...$candidate,'mode'=>'ai'];
        }elseif($mode==='simple'){
            $movement=$b['movement']??'pan-right';$duration=filter_var($b['duration']??8,FILTER_VALIDATE_INT);
            if(!in_array($movement,PHOTO_MOVEMENTS,true)||!in_array($duration,[4,6,8,10,12],true))fail('Choose a valid movement and duration.');
            $meta['motion']=['mode'=>'simple','movement'=>$movement,'duration'=>$duration,'source_key'=>motion_source_key($slide)];
        }else fail('Choose a valid movement.');
        query('UPDATE presentation_slides SET metadata=? WHERE iteration_id=? AND id=?',[json_encode($meta),$i['id'],$slide['id']]);
        audit($i['project_id'],$i['id'],$u['email'],'slide_motion_updated',$slide['title']);return ['ok'=>true];
    });json_response($result);
}
