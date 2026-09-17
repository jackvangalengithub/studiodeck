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
