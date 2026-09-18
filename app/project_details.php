<?php
declare(strict_types=1);
function project_details(string $pid): array {
    $r=one('SELECT tags,deadline FROM project_details WHERE project_id=?',[$pid])?:['tags'=>'[]','deadline'=>''];$r['tags']=json_decode($r['tags'],true)?:[];return $r;
}
function project_people(string $pid): array {
    $people=rows("SELECT u.id,u.email,COALESCE(NULLIF(sm.display_name,''),u.name) AS name FROM project_members m JOIN users u ON u.id=m.user_id JOIN projects p ON p.id=m.project_id JOIN studio_members sm ON sm.user_id=u.id AND sm.studio_id=p.studio_id WHERE m.project_id=? ORDER BY name",[$pid]);
    foreach($people as &$person){$person['profile']=array_intersect_key(profile_for(person_key($person['email'],true),$person['name']),array_flip(['name','color','avatar']));$person['name']=$person['profile']['name'];}return $people;
}
function project_cover(string $iid): ?array {
    require_once __DIR__.'/slides.php';
    return one("SELECT s.* FROM presentation_slides s JOIN iteration_files f ON f.iteration_id=s.iteration_id AND f.version_id=s.source_version_id WHERE f.category!='legal' AND s.iteration_id=? AND s.type IN ('render','photo','moodboard','fullphoto') ORDER BY CASE s.type WHEN 'render' THEN 0 WHEN 'photo' THEN 1 ELSE 2 END,s.position,s.id LIMIT 1",[$iid]);
}

function migrate_slide_groups(PDO $db): void {
    if(!str_contains((string)$db->query("SELECT sql FROM sqlite_master WHERE name='slide_sections'")->fetchColumn(),'CHECK'))return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        if(str_contains((string)$db->query("SELECT sql FROM sqlite_master WHERE name='slide_sections'")->fetchColumn(),'CHECK')) {
            $db->exec('ALTER TABLE slide_sections RENAME TO slide_sections_legacy');
            $db->exec('CREATE TABLE slide_sections (iteration_id TEXT NOT NULL REFERENCES iterations(id),slide_id TEXT NOT NULL,section TEXT NOT NULL,PRIMARY KEY(iteration_id,slide_id))');
            $db->exec('INSERT INTO slide_sections SELECT * FROM slide_sections_legacy');
            $db->exec('DROP TABLE slide_sections_legacy');
        }
        $db->exec('COMMIT');
    } catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function slide_groups(string $iid): array {
    $defaults=['story'=>'The story','current'=>'The current situation','moodboards'=>'The moodboards','designs'=>'The designs','budget'=>'The budget'];
    $ordered=[];foreach(rows('SELECT id,label FROM slide_groups WHERE iteration_id=? ORDER BY position,id',[$iid]) as $group)$ordered[$group['id']]=$group['label'];
    // Existing custom-only records follow the default groups until an order is explicitly saved.
    return isset($ordered['story'])?$ordered+$defaults:$defaults+$ordered;
}
