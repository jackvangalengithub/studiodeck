<?php
declare(strict_types=1);
if(in_array($action,['project_testimonials','project_testimonial_photo','project_testimonial_save','project_testimonial_delete'],true)){
    $read=in_array($action,['project_testimonials','project_testimonial_photo'],true);$u=owner(!$read);
    if($action==='project_testimonials')json_response(project_testimonials($u,text_field($_GET['project_id']??'',32)));
    if($action==='project_testimonial_photo'){
        $pid=text_field($_GET['project_id']??'',32);owned_project($pid,$u,false);$t=one('SELECT data,mime FROM project_testimonials WHERE id=? AND project_id=?',[text_field($_GET['id']??'',32),$pid]);if(!$t||!$t['data'])fail('Photo not found.',404);header('Content-Type: '.$t['mime']);echo $t['data'];exit;
    }
    if($action==='project_testimonial_save')json_response(project_testimonial_save($u,input()));
    json_response(project_testimonial_delete($u,input()));
}
