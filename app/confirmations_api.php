<?php
declare(strict_types=1);
if($action==='communication_slide_link')return api_result(link_communication_slide(($requestBody??input())));
if($action==='communication_thread_update')return api_result(update_communication_thread(($requestBody??input())));
if($action==='communication_work_decide')return api_result(decide_communication_work(($requestBody??input())));
if($action==='communication_share')return api_result(share_communication(($requestBody??input())));
if($action==='communication_post')return api_result(post_communication(($requestBody??input())),201);
if($action==='confirmation_decide')return api_result(decide_confirmation(($requestBody??input())));
if($action==='mention_people'){
    $root=text_field($query['conversation']??'',80);
    if($root){$g=conversation_access($root);$i=one('SELECT * FROM iterations WHERE id=?',[$g['iteration_id']]);}
    else {[$i]=access_iteration(text_field($query['iteration']??'',80));$root=text_field($query['parent_id']??'',80);}
    $people=mention_people($i,$root,!empty($query['conversation']));
    if(!$root&&($query['audience']??'')==='studio')$people=array_values(array_filter($people,fn($p)=>($p['group']??'')==='team'));
    return api_result($people);
}
if($action==='conversation')return api_result(conversation_payload(text_field($query['id']??'',80)));
if($action==='conversation_file'){
    $root=text_field($query['conversation']??'',80);conversation_access($root);$vid=text_field($query['id']??'',80);
    if(!in_array($vid,conversation_versions($root),true))fail('File not found in this conversation.',404);
    $v=one('SELECT name,mime,data,size FROM file_versions WHERE id=?',[$vid]);
    header('Content-Type: '.$v['mime']);header('Content-Length: '.$v['size']);
    header("Content-Disposition: attachment; filename=\"attachment\"; filename*=UTF-8''".rawurlencode($v['name']));echo $v['data'];exit;
}
if($action==='conversation_revoke'){
    $u=owner(true);$b=($requestBody??input());transaction(function()use($u,$b){
        $g=one('SELECT g.*,c.iteration_id FROM conversation_grants g JOIN comments c ON c.id=g.root_id WHERE g.id=?',[text_field($b['id']??'',80)]);if(!$g)fail('Invitation not found.',404);
        $i=owned_iteration($g['iteration_id'],$u,false,true);
        query('UPDATE conversation_grants SET revoked=1 WHERE id=?',[$g['id']]);
        query("UPDATE conversation_outbox SET status='cancelled' WHERE grant_id=? AND status='queued'",[$g['id']]);
        query('DELETE FROM login_tokens WHERE token_hash IN (SELECT token_hash FROM conversation_login_grants WHERE grant_id=?)',[$g['id']]);
    });return api_result(['ok'=>true]);
}
