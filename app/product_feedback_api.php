<?php
declare(strict_types=1);

if($action==='product_feedback_submit'){
    $u=owner(true);
    if((int)($_SERVER['CONTENT_LENGTH']??0)>6*1024*1024)fail('Choose a screenshot smaller than 5 MB.',413);
    $b=str_starts_with($_SERVER['CONTENT_TYPE']??'','multipart/form-data')?json_decode($_POST['feedback']??'',true):input();
    if(!is_array($b))fail('Please send valid feedback.');
    json_response(product_feedback_submit($u,$b),201);
}
if($action==='product_feedback_inbox'){
    require_product_feedback_reviewer();json_response(product_feedback_inbox($_GET));
}
if($action==='product_feedback_review'){
    require_product_feedback_reviewer(true);$b=input();$id=text_field($b['id']??'',80);
    $status=product_feedback_choice($b['status']??null,PRODUCT_FEEDBACK_STATUSES);
    $theme=text_field($b['theme']??'',120);$notes=text_field($b['notes']??'',6000);
    $updated=text_field($b['updated_at']??'',80);
    // Reject stale edits so two reviewers do not silently overwrite one another.
    $result=transaction(function()use($id,$status,$theme,$notes,$updated){
        $record=one('SELECT * FROM product_feedback WHERE id=?',[$id]);if(!$record)fail('Feedback not found.',404);
        if($record['updated_at']!==$updated)fail('Someone updated this report. Reopen it before saving your changes.',409);
        $version=sprintf('%.6f',microtime(true));
        query('UPDATE product_feedback SET status=?,theme=?,notes=?,updated_at=? WHERE id=?',[$status,$theme,$notes,$version,$id]);
        return ['ok'=>true,'updated_at'=>$version];
    });json_response($result);
}
if($action==='product_feedback_image'){
    require_product_feedback_reviewer();$image=one('SELECT data,mime FROM product_feedback_images WHERE feedback_id=?',[text_field($_GET['id']??'',80)]);
    if(!$image)fail('Screenshot not found.',404);
    header('Content-Type: '.$image['mime']);header('Content-Length: '.strlen($image['data']));header('Content-Disposition: inline; filename="feedback.jpg"');echo $image['data'];exit;
}
