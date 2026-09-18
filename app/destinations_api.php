<?php
if($action==='destinations')json_response(account_destinations(owner()));
if($action==='client_project'){
    $user=owner();$project=text_field($_GET['project_id']??'');if(!$project)fail('Choose a shared project.');$share=account_client_share($user,$project,text_field($_GET['iteration']??''));
    json_response(['share_id'=>$share['id'],'project_id'=>$share['project_id'],'iteration_id'=>$share['iteration_id']]);
}
if($action==='destination_cover'){
    $user=owner();$project=text_field($_GET['project_id']??'');if(!$project)fail('Choose a shared project.');$share=account_client_share($user,$project,text_field($_GET['iteration']??''));
    $slide=project_cover($share['iteration_id']);if(!$slide)fail('No cover image yet.',404);
    $source=slide_image_source($slide);$im=@imagecreatefromstring($source['data']);if(!$im)fail('Cover image unavailable.',404);
    $scale=min(1,720/max(imagesx($im),imagesy($im)));$thumb=imagescale($im,max(1,(int)(imagesx($im)*$scale)),max(1,(int)(imagesy($im)*$scale)));
    header('Content-Type: image/jpeg');imagejpeg($thumb,null,85);exit;
}
