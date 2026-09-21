<?php
declare(strict_types=1);
if($action==='communication_post')json_response(post_communication(input()),201);
if($action==='confirmation_decide')json_response(decide_confirmation(input()));
if($action==='mention_people'){
    $root=text_field($_GET['conversation']??'',80);
    if($root){$g=conversation_access($root);$i=one('SELECT * FROM iterations WHERE id=?',[$g['iteration_id']]);}
    else {[$i]=access_iteration(text_field($_GET['iteration']??'',80));$root=text_field($_GET['parent_id']??'',80);}
    json_response(mention_people($i,$root,!empty($_GET['conversation'])));
}
if($action==='conversation')json_response(conversation_payload(text_field($_GET['id']??'',80)));
if($action==='conversation_file'){
    $root=text_field($_GET['conversation']??'',80);conversation_access($root);$vid=text_field($_GET['id']??'',80);
    if(!in_array($vid,conversation_versions($root),true))fail('File not found in this conversation.',404);
    $v=one('SELECT name,mime,data,size FROM file_versions WHERE id=?',[$vid]);
    header('Content-Type: '.$v['mime']);header('Content-Length: '.$v['size']);
    header("Content-Disposition: attachment; filename=\"attachment\"; filename*=UTF-8''".rawurlencode($v['name']));echo $v['data'];exit;
}
if($action==='conversation_revoke'){
    $u=owner(true);$b=input();transaction(function()use($u,$b){
        $g=one('SELECT g.*,c.iteration_id FROM conversation_grants g JOIN comments c ON c.id=g.root_id WHERE g.id=?',[text_field($b['id']??'',80)]);if(!$g)fail('Invitation not found.',404);
        $i=owned_iteration($g['iteration_id'],$u,false,true);
        query('UPDATE conversation_grants SET revoked=1 WHERE id=?',[$g['id']]);
        query("UPDATE conversation_outbox SET status='cancelled' WHERE grant_id=? AND status='queued'",[$g['id']]);
        query('DELETE FROM login_tokens WHERE token_hash IN (SELECT token_hash FROM conversation_login_grants WHERE grant_id=?)',[$g['id']]);
        audit($i['project_id'],$i['id'],$u['email'],'conversation_access_revoked',$g['email'].' · conversation '.$g['root_id']);
    });json_response(['ok'=>true]);
}
