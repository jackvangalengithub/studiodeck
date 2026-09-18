<?php
declare(strict_types=1);
function migrate_studios(PDO $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
    if($db->query("SELECT 1 FROM migrations WHERE name='studios-v1'")->fetchColumn())return;
    $db->exec('BEGIN IMMEDIATE');
    try{
        if(!$db->query("SELECT 1 FROM migrations WHERE name='studios-v1'")->fetchColumn()){
            $db->exec("ALTER TABLE projects ADD COLUMN studio_id TEXT REFERENCES studios(id)");
            $db->exec("ALTER TABLE projects ADD COLUMN visibility TEXT NOT NULL DEFAULT 'team'");
            $db->exec("ALTER TABLE projects ADD COLUMN archived INTEGER NOT NULL DEFAULT 0");
            $db->exec("ALTER TABLE sessions ADD COLUMN studio_id TEXT REFERENCES studios(id)");
            foreach($db->query('SELECT * FROM users')->fetchAll() as $u){
                $sid=bin2hex(random_bytes(16));$q=$db->prepare('SELECT theme FROM studio_preferences WHERE user_id=?');$q->execute([$u['id']]);$theme=$q->fetchColumn()?:'{}';
                $db->prepare('INSERT INTO studios(id,name,theme,created_at) VALUES(?,?,?,?)')->execute([$sid,$u['name']."’s studio",$theme,gmdate('Y-m-d\TH:i:s\Z')]);
                $db->prepare("INSERT INTO studio_members(studio_id,user_id,role) VALUES(?,?,'admin')")->execute([$sid,$u['id']]);
                $db->prepare('UPDATE projects SET studio_id=? WHERE user_id=?')->execute([$sid,$u['id']]);
            }
            $db->exec('INSERT INTO project_members(project_id,user_id) SELECT id,user_id FROM projects');
            $db->exec("INSERT INTO migrations(name) VALUES('studios-v1')");
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function user_studios(string $uid): array {return rows('SELECT s.id,s.name,s.theme,m.role,EXISTS(SELECT 1 FROM studio_logos l WHERE l.studio_id=s.id) AS has_logo FROM studios s JOIN studio_members m ON m.studio_id=s.id WHERE m.user_id=? ORDER BY s.name,s.id',[$uid]);}
function session_details(?array $s): array {
    if(!$s)return ['user'=>null,'csrf'=>null,'studio'=>null,'studios'=>[],'studio_theme'=>null,'capabilities'=>capabilities()];
    $studios=user_studios($s['user_id']);$studio=null;foreach($studios as $v)if($v['id']===$s['studio_id'])$studio=$v;
    return ['user'=>['id'=>$s['user_id'],'email'=>$s['email'],'name'=>$s['name'],'profile'=>profile_for(person_key($s['email'],true),$s['name'])],'unread_count'=>unread_comment_count($s),'csrf'=>$s['csrf'],'studio'=>$studio,'studios'=>$studios,'studio_theme'=>fixed_studio_theme(),'capabilities'=>capabilities()];
}
function create_studio(string $uid,string $name): string {
    $sid=id();insert('studios',['id'=>$sid,'name'=>$name,'theme'=>'{}','created_at'=>now()]);insert('studio_members',['studio_id'=>$sid,'user_id'=>$uid,'role'=>'admin']);return $sid;
}
function studio_members(string $sid): array {
    $members=rows("SELECT u.id,u.email,COALESCE(NULLIF(m.display_name,''),u.name) AS name,m.role,p.avatar FROM studio_members m JOIN users u ON u.id=m.user_id LEFT JOIN person_profiles p ON p.person_key='user:'||u.email WHERE m.studio_id=? ORDER BY u.name,u.email",[$sid]);
    foreach($members as &$member){$member['profile']=['avatar'=>$member['avatar']?'data:image/png;base64,'.base64_encode($member['avatar']):null];unset($member['avatar']);}
    return $members;
}
function studio_admin(array $u): void {if(!one("SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=? AND role='admin'",[$u['studio_id'],$u['user_id']]))fail('Only studio admins can manage users.',403);}
function project_member(string $pid,string $uid): bool {return (bool)one('SELECT 1 FROM project_members WHERE project_id=? AND user_id=?',[$pid,$uid]);}
function project_team_sql(): string {return "p.studio_id=? AND EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?)";}
function project_access_sql(): string {return "p.studio_id=? AND (p.visibility='public' OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?))";}

function fixed_studio_theme(): array {return ['palette'=>'warmgray','style'=>'editorial','font'=>'serif'];}
