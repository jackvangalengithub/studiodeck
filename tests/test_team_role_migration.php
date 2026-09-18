<?php
require __DIR__.'/../app/bootstrap.php';
$db=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$db->exec("CREATE TABLE project_team_contacts(project_id TEXT,user_id TEXT,name TEXT,phone TEXT);CREATE TABLE studio_members(studio_id TEXT,user_id TEXT,display_name TEXT,role TEXT)");
$db->exec("INSERT INTO project_team_contacts VALUES('project','user','Legacy name','12345');INSERT INTO studio_members VALUES('studio','user','Studio name','member')");
migrate_project_team_roles($db);
migrate_project_team_roles($db);
$contact=$db->query('SELECT * FROM project_team_contacts')->fetch();$member=$db->query('SELECT * FROM studio_members')->fetch();
if($contact['name']!=='Legacy name'||$contact['phone']!=='12345'||$contact['role']!==''||$member['display_name']!=='Studio name'||$member['role']!=='member'||$member['phone']!=='')throw new RuntimeException('Migration changed existing member details.');
echo "PASS Existing databases gain project roles and studio phones without losing saved data; migration is repeatable.\n";
