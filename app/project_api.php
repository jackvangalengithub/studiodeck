<?php
if($action==='project_settings'){
    $u=owner(true);$b=input();transaction(function()use($u,$b){
        $p=owned_project(text_field($b['project_id']??''),$u);$visibility=$b['visibility']??$p['visibility'];if(!in_array($visibility,['team','public'],true))fail('Choose public or team members only.');
        $archived=array_key_exists('archived',$b)?(!empty($b['archived'])?1:0):(int)$p['archived'];
        query('UPDATE projects SET visibility=?,archived=? WHERE id=?',[$visibility,$archived,$p['id']]);
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
    $more=count($items)>100;json_response(['items'=>array_slice($items,0,100),'has_more'=>$more]);
}
