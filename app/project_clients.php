<?php
declare(strict_types=1);

function migrate_project_clients(PDO $db): void {
    if($db->query("SELECT 1 FROM migrations WHERE name='project-clients-v1'")->fetchColumn())return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        if(!$db->query("SELECT 1 FROM migrations WHERE name='project-clients-v1'")->fetchColumn()) {
            $db->exec("INSERT OR IGNORE INTO project_client_members(project_id,email,name,created_at)
                SELECT project_id,lower(trim(email)),name,datetime('now') FROM contacts
                WHERE role='Client' AND instr(email,'@')>1 ORDER BY rowid");
            $db->exec("INSERT OR IGNORE INTO project_client_members(project_id,email,name,created_at)
                SELECT i.project_id,lower(trim(s.email)),COALESCE(NULLIF(u.name,''),substr(s.email,1,instr(s.email,'@')-1)),s.created_at
                FROM shares s JOIN iterations i ON i.id=s.iteration_id LEFT JOIN users u ON u.email=lower(trim(s.email))
                ORDER BY s.created_at,s.id");
            $db->exec("INSERT INTO migrations(name) VALUES('project-clients-v1')");
        }
        $db->exec('COMMIT');
    } catch(Throwable $e) { $db->exec('ROLLBACK');throw $e; }
}

function project_clients(string $pid): array {
    return rows('SELECT email,name,created_at FROM project_client_members WHERE project_id=? ORDER BY name COLLATE NOCASE,email',[$pid]);
}

function add_project_client(string $pid,string $email,string $name=''): void {
    $email=email_field($email);$name=text_field($name,100)?:explode('@',$email)[0];
    query('INSERT INTO project_client_members(project_id,email,name,created_at) VALUES(?,?,?,?) ON CONFLICT(project_id,email) DO UPDATE SET name=excluded.name',[$pid,$email,$name,now()]);
}
