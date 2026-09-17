<?php
if($action==='project_settings'){
    $u=owner(true);$b=input();transaction(function()use($u,$b){
        $p=owned_project(text_field($b['project_id']??''),$u);$visibility=$b['visibility']??$p['visibility'];if(!in_array($visibility,['team','public'],true))fail('Choose public or team members only.');
        $archived=array_key_exists('archived',$b)?(!empty($b['archived'])?1:0):(int)$p['archived'];
        query('UPDATE projects SET visibility=?,archived=? WHERE id=?',[$visibility,$archived,$p['id']]);
        $details=project_details($p['id']);$tags=$b['tags']??$details['tags'];if(!is_array($tags)||count($tags)>20)fail('Use up to 20 project labels.');$tags=array_values(array_unique(array_filter(array_map(fn($tag)=>text_field($tag,40),$tags))));
        $deadline=text_field($b['deadline']??$details['deadline'],10);if($deadline){$date=DateTimeImmutable::createFromFormat('!Y-m-d',$deadline);if(!$date||$date->format('Y-m-d')!==$deadline)fail('Choose a valid deadline.');}
        query('INSERT INTO project_details(project_id,tags,deadline) VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET tags=excluded.tags,deadline=excluded.deadline',[$p['id'],json_encode($tags),$deadline]);
        $i=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$p['id']]);audit($p['id'],$i['id'],$u['email'],'project_settings_updated',($archived?'Archived':'Active').' · '.($visibility==='public'?'Public within studio':'Project team only'));
    });json_response(['ok'=>true]);
}
if($action==='pin_project'){
    $u=owner(true);$b=input();$p=owned_project(text_field($b['project_id']??''),$u,false);
    if(!empty($b['pinned']))query('INSERT OR IGNORE INTO project_pins(project_id,user_id) VALUES(?,?)',[$p['id'],$u['user_id']]);
    else query('DELETE FROM project_pins WHERE project_id=? AND user_id=?',[$p['id'],$u['user_id']]);json_response(['ok'=>true]);
}
if($action==='activity_feed'||$action==='comments_feed'){
    $u=owner();$offset=max(0,(int)($_GET['offset']??0));$params=[$u['studio_id'],$u['user_id']];$where=project_access_sql();
    if(!empty($_GET['project_id'])){$where.=' AND p.id=?';$params[]=text_field($_GET['project_id']);}
    if($action==='activity_feed')$items=rows('SELECT e.*,p.name AS project_name FROM events e JOIN projects p ON p.id=e.project_id WHERE '.$where.' ORDER BY e.created_at DESC,e.rowid DESC LIMIT 101 OFFSET '.$offset,$params);
    else $items=rows("SELECT c.*,p.id AS project_id,p.name AS project_name,i.number AS iteration_number,s.title AS slide_title FROM comments c JOIN iterations i ON i.id=c.iteration_id JOIN projects p ON p.id=i.project_id LEFT JOIN presentation_slides s ON s.iteration_id=c.iteration_id AND 'visual-'||s.id=c.slide WHERE ".$where.' ORDER BY c.created_at DESC,c.rowid DESC LIMIT 101 OFFSET '.$offset,$params);
    $more=count($items)>100;if($action==='comments_feed')$items=decorate_comments($items,person_key($u['email'],true));json_response(['items'=>array_slice($items,0,100),'has_more'=>$more,'unread_count'=>unread_comment_count($u)]);
}

if($action==='resolve_slide'){
    $u=owner();$sid=text_field($_GET['slide']??'');if(str_starts_with($sid,'visual-'))$sid=substr($sid,7);
    $params=[$sid,$u['studio_id'],$u['user_id']];$where='s.id=? AND '.project_access_sql();if(!empty($_GET['iteration'])){$where.=' AND i.id=?';$params[]=text_field($_GET['iteration']);}
    $slide=one('SELECT s.id,i.id AS iteration_id,p.id AS project_id FROM presentation_slides s JOIN iterations i ON i.id=s.iteration_id JOIN projects p ON p.id=i.project_id WHERE '.$where.' ORDER BY i.number DESC LIMIT 1',$params);
    if(!$slide)fail('Slide not found in this studio.',404);json_response($slide);
}

if($action==='project_cover'){
    $u=owner();$p=owned_project(text_field($_GET['project_id']??''),$u,false);$i=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$p['id']]);$slide=$i?project_cover($i['id']):null;if(!$slide)fail('No cover image yet.',404);$source=slide_image_source($slide);$im=@imagecreatefromstring($source['data']);if(!$im)fail('Cover image unavailable.',404);$scale=min(1,720/max(imagesx($im),imagesy($im)));$thumb=imagescale($im,max(1,(int)(imagesx($im)*$scale)),max(1,(int)(imagesy($im)*$scale)));header('Content-Type: image/jpeg');imagejpeg($thumb,null,85);exit;
}

if(in_array($action,['prepare_delete_project','delete_project'],true)){
    $u=owner(true);$b=input();
    $result=transaction(function()use($u,$b,$action){
        if(!one("SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=? AND role='admin'",[$u['studio_id'],$u['user_id']]))fail('Only studio admins can permanently delete projects.',403);
        $p=owned_project(text_field($b['project_id']??''),$u,false);$pid=$p['id'];
        if(one("SELECT 1 FROM jobs WHERE project_id=? AND status IN ('queued','running')",[$pid])||one("SELECT 1 FROM email_outbox WHERE comment_id IN (SELECT c.id FROM comments c JOIN iterations i ON i.id=c.iteration_id WHERE i.project_id=?) AND status='sending'",[$pid]))fail('Wait for processing and email delivery to finish before deleting this project.',409);
        if($action==='prepare_delete_project'){
            query('DELETE FROM project_delete_confirmations WHERE expires_at<? OR (project_id=? AND user_id=?)',[time(),$pid,$u['user_id']]);
            $t=token();insert('project_delete_confirmations',['token_hash'=>hash_token($t),'project_id'=>$pid,'user_id'=>$u['user_id'],'expires_at'=>time()+600]);
            return ['confirmation'=>$t,'name'=>$p['name'],'iterations'=>(int)one('SELECT COUNT(*) AS n FROM iterations WHERE project_id=?',[$pid])['n'],'files'=>(int)one('SELECT COUNT(*) AS n FROM file_versions v JOIN assets a ON a.id=v.asset_id WHERE a.project_id=?',[$pid])['n']];
        }
        $confirmation=one('SELECT 1 FROM project_delete_confirmations WHERE token_hash=? AND project_id=? AND user_id=? AND expires_at>?',[hash_token(text_field($b['confirmation']??'',128)),$pid,$u['user_id'],time()]);
        if(!$confirmation)fail('Start the deletion confirmation again. It expires after 10 minutes.',409);
        if(($b['name']??null)!==$p['name']||($b['acknowledged']??null)!==true)fail('Type the exact project name and confirm that deletion is permanent.');
        $iterations='SELECT id FROM iterations WHERE project_id=?';$versions='SELECT v.id FROM file_versions v JOIN assets a ON a.id=v.asset_id WHERE a.project_id=?';
        query("DELETE FROM email_outbox WHERE comment_id IN (SELECT id FROM comments WHERE iteration_id IN ($iterations))",[$pid]);
        query("DELETE FROM share_aliases WHERE share_id IN (SELECT id FROM shares WHERE iteration_id IN ($iterations))",[$pid]);
        foreach(['comments','shares','slide_sections','slide_groups','slide_layout','presentation_slides','iteration_files'] as $table)query("DELETE FROM $table WHERE iteration_id IN ($iterations)",[$pid]);
        query("UPDATE budget_items SET parent_id=NULL WHERE iteration_id IN ($iterations)",[$pid]);query("DELETE FROM budget_items WHERE iteration_id IN ($iterations)",[$pid]);
        query('DELETE FROM jobs WHERE project_id=?',[$pid]);
        query("UPDATE slide_image_versions SET parent_id=NULL WHERE source_version_id IN ($versions)",[$pid]);query("DELETE FROM slide_image_versions WHERE source_version_id IN ($versions)",[$pid]);
        query("DELETE FROM document_pages WHERE version_id IN ($versions)",[$pid]);
        query("UPDATE file_versions SET parent_id=NULL WHERE id IN ($versions)",[$pid]);query("DELETE FROM file_versions WHERE id IN ($versions)",[$pid]);
        foreach(['assets','contacts','events','project_members','project_pins','project_logos','project_details','iterations'] as $table)query("DELETE FROM $table WHERE project_id=?",[$pid]);
        query('DELETE FROM projects WHERE id=?',[$pid]);return ['ok'=>true];
    });json_response($result);
}
