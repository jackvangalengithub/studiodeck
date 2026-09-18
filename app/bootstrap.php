<?php
declare(strict_types=1);

require_once __DIR__.'/studios.php';
require_once __DIR__.'/budget.php';
require_once __DIR__.'/activity.php';
require_once __DIR__.'/slide_editor.php';
require_once __DIR__.'/people.php';
require_once __DIR__.'/project_directory.php';
require_once __DIR__.'/project_details.php';
require_once __DIR__.'/communications.php';

const ROOT = __DIR__ . '/..';
foreach (is_file(ROOT . '/.env') ? file(ROOT . '/.env', FILE_IGNORE_NEW_LINES) : [] as $line) {
    if (!$line || str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
    [$key, $value] = explode('=', $line, 2);
    if (getenv(trim($key)) === false) putenv(trim($key) . '=' . trim(trim($value), "\"'"));
}
function env(string $key, string $default = ''): string { return (string)(getenv($key) === false ? $default : getenv($key)); }
function id(): string { return bin2hex(random_bytes(16)); }
function now(): string { return gmdate('Y-m-d\TH:i:s\Z'); }
function token(): string { return bin2hex(random_bytes(32)); }
function hash_token(string $value): string { return hash('sha256', $value); }
function db(): PDO {
    static $db;
    if ($db) return $db;
    $path = env('DATABASE_PATH') ?: ROOT . '/storage/studiodeck.sqlite';
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
    $db = new PDO('sqlite:' . $path, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA busy_timeout = 5000');
    $db->exec('PRAGMA journal_mode = WAL');
    $db->exec(file_get_contents(__DIR__ . '/schema.sql'));
    migrate_studios($db);
    migrate_project_team_roles($db);
    migrate_budget($db);
    migrate_slide_groups($db);
    migrate_manual_slides($db);
    @chmod($path, 0600);
    return $db;
}
function query(string $sql, array $params = []): PDOStatement { $s = db()->prepare($sql); $s->execute($params); return $s; }
function one(string $sql, array $params = []): ?array { return query($sql,$params)->fetch() ?: null; }
function rows(string $sql, array $params = []): array { return query($sql,$params)->fetchAll(); }
function insert(string $table, array $data): void {
    $keys = array_keys($data);
    $s = db()->prepare('INSERT INTO ' . $table . ' (' . implode(',', $keys) . ') VALUES (' . implode(',', array_fill(0,count($keys),'?')) . ')');
    foreach (array_values($data) as $i=>$v) $s->bindValue($i+1,$v, in_array($keys[$i],['data','preview'],true) && $v !== null ? PDO::PARAM_LOB : ($v===null ? PDO::PARAM_NULL : (is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR)));
    $s->execute();
}
function transaction(callable $fn): mixed {
    db()->exec('BEGIN IMMEDIATE');
    try { $result=$fn(); db()->exec('COMMIT'); return $result; }
    catch (Throwable $e) { db()->exec('ROLLBACK'); throw $e; }
}
function fail(string $message, int $status=400): never { throw new RuntimeException($message, $status); }
function json_response(mixed $value,int $status=200): never { if(!empty($GLOBALS['atomic_write'])) { db()->exec('COMMIT'); $GLOBALS['atomic_write']=false; } http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($value,JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function input(): array { $raw=file_get_contents('php://input'); $data=json_decode($raw ?: '{}',true); if(!is_array($data)) fail('Please send valid JSON.'); return $data; }
function text_field(mixed $v,int $max=500): string { if(!is_string($v)) fail('A text field was expected.'); $v=trim($v); if(strlen($v)>$max) fail('This text is too long.'); return $v; }
function email_field(mixed $v): string { $v=strtolower(text_field($v,254)); if(!filter_var($v,FILTER_VALIDATE_EMAIL)) fail('Please enter a valid email address.'); return $v; }
function base_url(): string { return rtrim(env('APP_URL','http://localhost:8080'),'/'); }
function audit(string $project,string $iteration,string $actor,string $type,string $detail): void {
    insert('events',['id'=>id(),'project_id'=>$project,'iteration_id'=>$iteration,'actor'=>$actor,'type'=>$type,'detail'=>$detail,'created_at'=>now()]);
}
function rate_limit(string $key,int $limit,int $seconds): void {
    transaction(function() use($key,$limit,$seconds) {
        $key=hash_token($key); $r=one('SELECT * FROM rate_limits WHERE key_hash=?',[$key]);
        if(!$r) insert('rate_limits',['key_hash'=>$key,'hits'=>1,'reset_at'=>time()+$seconds]);
        elseif((int)$r['reset_at']<time()) query('UPDATE rate_limits SET hits=1, reset_at=? WHERE key_hash=?',[time()+$seconds,$key]);
        elseif((int)$r['hits'] >= $limit) fail('Please wait a little before trying again.',429);
        else query('UPDATE rate_limits SET hits=hits+1 WHERE key_hash=?',[$key]);
    });
}
function current_session(): ?array {
    $t=$_COOKIE['studiodeck_session']??'';
    $s=$t?one('SELECT s.*,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',[hash_token($t),time()]):null;
    if($s&&!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$s['studio_id'],$s['user_id']])){
        $s['studio_id']=user_studios($s['user_id'])[0]['id']??null;
        query('UPDATE sessions SET studio_id=? WHERE token_hash=?',[$s['studio_id'],$s['token_hash']]);
    }
    if($s&&!empty($_SERVER['HTTP_X_STUDIO_ID'])){
        $studio=$_SERVER['HTTP_X_STUDIO_ID'];if(!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$studio,$s['user_id']]))fail('Studio not found.',404);
        $s['studio_id']=$studio;
    }
    return $s;
}
function owner(bool $write=false): array {
    $s=current_session(); if(!$s) fail('Please sign in to your studio.',401);
    if($write && !hash_equals($s['csrf'],$_SERVER['HTTP_X_CSRF_TOKEN']??'')) fail('Please refresh the page and try again.',403);
    return $s;
}
function owned_project(string $pid,array $u,bool $write=true): array {
    $p=one('SELECT p.* FROM projects p WHERE p.id=? AND '.project_access_sql(),[$pid,$u['studio_id'],$u['user_id']]);
    if(!$p)fail('Project not found.',404);
    if($write&&!project_member($pid,$u['user_id']))fail('Only project team members can edit this project.',403);
    return $p;
}
function owned_iteration(string $iid,array $u,bool $editable=false,bool $write=false): array {
    $i=one('SELECT * FROM iterations WHERE id=?',[$iid]);if(!$i)fail('Presentation not found.',404);
    owned_project($i['project_id'],$u,$editable||$write);
    if($editable&&$i['status']!=='draft')fail('This iteration has been shared. Create a new iteration to make changes.',409);
    return $i;
}
function access_iteration(string $iid='', bool $write=false): array {
    $auth=$_SERVER['HTTP_AUTHORIZATION']??'';
    if(str_starts_with($auth,'Client ')) {
        $user=owner($write);$share=account_client_share($user,'',$iid,substr($auth,7));
        return [one('SELECT * FROM iterations WHERE id=?',[$share['iteration_id']]),$user['email'],false,$share];
    }
    if(str_starts_with($auth,'Bearer ')) {
        $s=one('SELECT * FROM shares WHERE (token_hash=? OR id IN (SELECT share_id FROM share_aliases WHERE token_hash=?)) AND revoked=0 AND expires_at>?',[hash_token(substr($auth,7)),hash_token(substr($auth,7)),time()]);
        if(!$s || ($iid && $iid!==$s['iteration_id'])) fail('This presentation link is expired or unavailable.',403);
        $i=one('SELECT * FROM iterations WHERE id=?',[$s['iteration_id']]);
        return [$i,$s['email'],false,$s];
    }
    $u=owner($write); return [owned_iteration($iid,$u,false,$write),$u['email'],true,null];
}
function allowed_versions(string $iid): array {
    $allowed=[];
    foreach(rows('SELECT version_id FROM iteration_files WHERE iteration_id=?',[$iid]) as $r) {
        $v=$r['version_id'];
        while($v && !isset($allowed[$v])) { $allowed[$v]=true; $r=one('SELECT parent_id FROM file_versions WHERE id=?',[$v]); $v=$r['parent_id']??null; }
    }
    return $allowed;
}
function capabilities(): array { return ['ai'=>env('OPENAI_API_KEY')!=='','mail'=>env('MAIL_TRANSPORT','log')==='mail','demo'=>false]; }
function send_email(string $to,string $subject,string $body,?string $html=null): bool {
    if(env('MAIL_TRANSPORT','log')!=='mail') {
        if($html){$path=(env('MAIL_LOG_PATH')?:ROOT.'/storage/mail.log').'.messages.jsonl';file_put_contents($path,json_encode(['at'=>now(),'to'=>$to,'subject'=>$subject,'text'=>$body,'html'=>$html],JSON_INVALID_UTF8_SUBSTITUTE)."\n",FILE_APPEND|LOCK_EX);@chmod($path,0600);}return false;
    }
    $from=email_field(env('MAIL_FROM','studio@example.com'));$headers=['From'=>$from,'MIME-Version'=>'1.0'];
    if($html){$boundary='sd-'.bin2hex(random_bytes(16));$headers['Content-Type']='multipart/alternative; boundary="'.$boundary.'"';$body="--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($body))."--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n".chunk_split(base64_encode($html))."--$boundary--\r\n";}else $headers['Content-Type']='text/plain; charset=UTF-8';
    return mail($to,$subject,$body,$headers);
}
function project_files(string $iid): array {
    $files=rows('SELECT v.id, f.asset_id, f.category, v.parent_id, v.number, v.name, v.mime, v.size, v.metadata, v.created_at, CASE WHEN v.preview IS NOT NULL THEN 1 ELSE 0 END AS has_preview FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? ORDER BY v.created_at, v.name',[$iid]);
    foreach($files as &$f) {
        $f['metadata']=json_decode($f['metadata'],true)?:[];
        require_once __DIR__.'/documents.php';
        $f['pages']=document_page_summaries($f['id']);
        $f['history']=[]; $vid=$f['id'];
        while($vid) { $v=one('SELECT id,parent_id,number,name,mime,size,created_at FROM file_versions WHERE id=?',[$vid]); if(!$v)break; $f['history'][]=$v; $vid=$v['parent_id']; }
    }
    return $files;
}
function deck_payload(array $i, bool $isOwner): array {
    $p=one('SELECT id,name,location,description,theme,created_at FROM projects WHERE id=?',[$i['project_id']]);
    $p['theme']=json_decode($i['theme'],true)?:json_decode($p['theme'],true)?:[];
    $items=budget_rows($i['id']);
    $files=project_files($i['id']);
    $previous=one('SELECT * FROM iterations WHERE project_id=? AND number<? ORDER BY number DESC LIMIT 1',[$p['id'],$i['number']]);
    $changes=[];
    if($previous) {
        $before=[]; foreach(project_files($previous['id']) as $f)$before[$f['asset_id']]=$f;
        foreach($files as $f) { if(!isset($before[$f['asset_id']]))$changes[]=['type'=>'added','name'=>$f['name']]; elseif($before[$f['asset_id']]['id']!==$f['id'])$changes[]=['type'=>'updated','name'=>$f['name']]; unset($before[$f['asset_id']]); }
        foreach($before as $f)$changes[]=['type'=>'removed','name'=>$f['name']];
        require_once __DIR__.'/slides.php';
        $previousSlides=array_column(project_slides($previous['id']),null,'id');
        foreach(project_slides($i['id']) as $s)if(isset($previousSlides[$s['id']])&&($s['image_version_id']!==$previousSlides[$s['id']]['image_version_id']||$s['type']!==$previousSlides[$s['id']]['type']||$s['situation']!==$previousSlides[$s['id']]['situation']))$changes[]=['type'=>'updated','name'=>$s['title']];
    }
    require_once __DIR__.'/slides.php';
    $result=['project'=>$p,'iteration'=>$i,'files'=>$files,'slides'=>project_slides($i['id']),'slide_layout'=>rows('SELECT slide_id,hidden,deleted,position FROM slide_layout WHERE iteration_id=?',[$i['id']]),'budget'=>$items,'total_cents'=>budget_total($items),'changes'=>$changes,'previous_total_cents'=>$previous?budget_total(budget_rows($previous['id'])):null,'contacts'=>rows('SELECT * FROM contacts WHERE project_id=?'.($isOwner?'':" AND role <> 'Client'"),[$p['id']]),'comments'=>rows('SELECT * FROM comments WHERE iteration_id=? ORDER BY created_at',[$i['id']]),'capabilities'=>capabilities()];
    $result=array_merge($result,budget_payload($i['id'],$isOwner));
    $directory=project_directory($p['id']);$result['presentation_people']=presentation_people($directory);
    if($isOwner) {
        $result['people']=$directory;
        $u=current_session();$project=one('SELECT studio_id,visibility,archived FROM projects WHERE id=?',[$p['id']]);$result['project']=array_merge($result['project'],$project);$result['can_edit']=$u?project_member($p['id'],$u['user_id']):false;$result['members']=rows("SELECT u.id,COALESCE(NULLIF(sm.display_name,''),u.name) AS name,u.email FROM project_members m JOIN users u ON u.id=m.user_id JOIN projects p ON p.id=m.project_id JOIN studio_members sm ON sm.user_id=u.id AND sm.studio_id=p.studio_id WHERE m.project_id=? ORDER BY name",[$p['id']]);
        $result['iterations']=rows('SELECT * FROM iterations WHERE project_id=? ORDER BY number DESC',[$p['id']]);
        $result['events']=activity_with_questions(rows('SELECT * FROM events WHERE project_id=? ORDER BY created_at DESC,rowid DESC LIMIT 80',[$p['id']]));
        $result['jobs']=rows('SELECT j.id,j.version_id,j.type,j.status,j.error,j.payload,v.name FROM jobs j LEFT JOIN file_versions v ON v.id=j.version_id WHERE j.iteration_id=? ORDER BY j.created_at',[$i['id']]);
        foreach($result['jobs'] as &$job) { $payload=json_decode($job['payload'],true)?:[];$job['progress']=$payload['progress']??null;if($job['type']==='slide_image_edit')$job['slide_id']=$payload['slide_id']??null;unset($job['payload']); }unset($job);
        $result['shares']=rows('SELECT id,email,expires_at,revoked,created_at FROM shares WHERE iteration_id=?',[$i['id']]);
    }
    [$key,$email,$name]=profile_identity();$result['profile']=profile_for($key,$name);$result['team']=project_people($p['id']);$result['slide_groups']=slide_groups($i['id']);$result['slide_content']=rows('SELECT slide_id,title,description FROM slide_content WHERE iteration_id=?',[$i['id']]);$result['slide_sections']=rows('SELECT slide_id,section FROM slide_sections WHERE iteration_id=?',[$i['id']]);$result['project']=array_merge($result['project'],project_details($p['id']));$cover=project_cover($i['id']);$result['cover_slide_id']=$cover?$cover['id']:null;$result['comments']=decorate_comments($result['comments'],$key);$result['branding']=presentation_branding($p['id']);
    return $result;
}

require_once __DIR__.'/destinations.php';
