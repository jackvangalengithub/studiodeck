<?php
declare(strict_types=1);

function conversation_contact(string $pid,string $email): ?array {
    foreach(project_directory($pid) as $group=>$people)foreach($people as $p)if($email!==''&&strtolower($p['email'])===$email)return $p;
    return null;
}
function conversation_grant_valid(array $g): bool {
    return !(int)$g['revoked']&&(int)$g['expires_at']>time()&&conversation_contact($g['project_id'],$g['email'])!==null;
}
function conversation_access(string $rootId,bool $write=false,?array $user=null): array {
    $user??=authenticated_user($write);
    $g=one('SELECT g.*,c.iteration_id,i.project_id FROM conversation_grants g JOIN comments c ON c.id=g.root_id JOIN iterations i ON i.id=c.iteration_id WHERE g.root_id=? AND g.email=? AND c.parent_id IS NULL',[$rootId,$user['email']]);
    if(!$g||!conversation_grant_valid($g))fail('This conversation is no longer available to your account.',404);
    billing_require_project($g['project_id'],null,true,$write);
    return $g;
}
function conversation_invite(array $i,string $root,array $person,string $actor): void {
    // Caller holds a write transaction and has verified project editing rights.
    $g=one('SELECT * FROM conversation_grants WHERE root_id=? AND email=?',[$root,$person['email']]);
    if($g&&!$g['revoked']&&$g['expires_at']>time())return;
    if($g)query('UPDATE conversation_grants SET revoked=0,expires_at=?,invited_by=?,created_at=?,name=? WHERE id=?',[time()+90*86400,$actor,now(),$person['name'],$g['id']]);
    else insert('conversation_grants',['id'=>id(),'root_id'=>$root,'email'=>$person['email'],'name'=>$person['name'],'invited_by'=>$actor,'created_at'=>now(),'expires_at'=>time()+90*86400]);
    // Give general-message roots their own visible conversation so access can be managed.
    $message=one('SELECT slide,body FROM comments WHERE id=?',[$root]);
    if($message['slide']==='general'&&!one('SELECT 1 FROM communication_threads WHERE comment_id=?',[$root])){
        preg_match('/^.{1,100}/us',$message['body'],$title);
        insert('communication_threads',['comment_id'=>$root,'title'=>$title[0]]);
    }
    // Provision an identity, never studio membership or a presentation share.
    if(!one('SELECT 1 FROM users WHERE email=?',[$person['email']]))insert('users',['id'=>id(),'email'=>$person['email'],'name'=>$person['name'],'created_at'=>now()]);
    audit($i['project_id'],$i['id'],$actor,'conversation_invited',$person['email'].' · conversation '.$root);
}
function conversation_participants(string $root): array {
    $c=one('SELECT c.iteration_id,i.project_id FROM comments c JOIN iterations i ON i.id=c.iteration_id WHERE c.id=?',[$root]);
    $i=one('SELECT * FROM iterations WHERE id=?',[$c['iteration_id']]);
    $authors=array_column(rows('SELECT DISTINCT author FROM comments WHERE id=? OR parent_id=?',[$root,$root]),'author');
    $people=[];
    foreach(confirmation_recipients($i) as $p)if($p['available']&&in_array($p['email'],$authors,true))$people[$p['email']]=['email'=>$p['email'],'name'=>$p['name']];
    foreach(rows('SELECT g.*,? AS project_id FROM conversation_grants g WHERE root_id=?',[$c['project_id'],$root]) as $g)if(conversation_grant_valid($g))$people[$g['email']]=['email'=>$g['email'],'name'=>$g['name']];
    return array_values($people);
}
function conversation_payload(string $root): array {
    $g=conversation_access($root);$user=authenticated_user();
    $comments=rows('SELECT id,parent_id,author,body,created_at FROM comments WHERE id=? OR parent_id=? ORDER BY created_at,rowid',[$root,$root]);
    foreach($comments as &$c){$c['mentions']=comment_mentions($c['id']);$p=profile_for(person_key($c['author'],true));$c['name']=$p['name']?:one('SELECT name FROM users WHERE email=?',[$c['author']])['name']??$c['author'];}unset($c);
    $profile=profile_for(person_key($user['email'],true));$language=project_language($g['project_id']);
    return ['root'=>$root,'project_name'=>one('SELECT name FROM projects WHERE id=?',[$g['project_id']])['name'],
        'title'=>one('SELECT title FROM communication_threads WHERE comment_id=?',[$root])['title']??'Conversation',
        'actor'=>$user['email'],'language'=>$profile['language']?:($language['language']?:$language['studio_language']),
        'locked'=>(bool)one('SELECT locked FROM iterations WHERE id=?',[$g['iteration_id']])['locked'],
        'comments'=>$comments,'recipients'=>conversation_participants($root),
        'confirmations'=>rows('SELECT r.* FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id WHERE c.id=? OR c.parent_id=?',[$root,$root]),
        'attachments'=>rows('SELECT a.comment_id,v.id,v.name,v.number,v.mime FROM comment_attachments a JOIN comments c ON c.id=a.comment_id JOIN file_versions v ON v.id=a.version_id WHERE c.id=? OR c.parent_id=?',[$root,$root])];
}
function conversation_versions(string $root): array {
    return array_column(rows('SELECT a.version_id FROM comment_attachments a JOIN comments c ON c.id=a.comment_id WHERE c.id=? OR c.parent_id=?',[$root,$root]),'version_id');
}
function conversation_login_url(array $g): string {
    $u=one('SELECT * FROM users WHERE email=?',[$g['email']]);
    conversation_access($g['root_id'],false,$u);
    $t=token();$hash=hash_token($t);
    insert('login_tokens',['token_hash'=>$hash,'user_id'=>$u['id'],'expires_at'=>min(time()+900,(int)$g['expires_at'])]);
    insert('conversation_login_grants',['token_hash'=>$hash,'grant_id'=>$g['id']]);
    return base_url().'/#/login/'.$t;
}
function queue_conversation_notifications(array $c): void {
    $root=$c['parent_id']?:$c['id'];
    foreach(rows('SELECT g.*,i.project_id FROM conversation_grants g JOIN comments c ON c.id=g.root_id JOIN iterations i ON i.id=c.iteration_id WHERE g.root_id=?',[$root]) as $g){
        if($g['email']===$c['author']||!conversation_grant_valid($g))continue;
        if(!comment_email_enabled(person_key($g['email'],true),$c['id'],$g['email']))continue;
        query('INSERT OR IGNORE INTO conversation_outbox(id,comment_id,grant_id) VALUES(?,?,?)',[id(),$c['id'],$g['id']]);
    }
}
function dispatch_conversation_email(): bool {
    $job=transaction(function(){query("UPDATE conversation_outbox SET status='queued' WHERE status='sending' AND next_attempt<?",[time()-300]);$j=one("SELECT * FROM conversation_outbox WHERE status='queued' AND next_attempt<=? ORDER BY rowid LIMIT 1",[time()]);if($j)query("UPDATE conversation_outbox SET status='sending',attempts=attempts+1,next_attempt=? WHERE id=?",[time(),$j['id']]);return $j;});
    if(!$job)return false;
    try{
        $g=one('SELECT g.*,i.project_id FROM conversation_grants g JOIN comments c ON c.id=g.root_id JOIN iterations i ON i.id=c.iteration_id WHERE g.id=?',[$job['grant_id']]);
        if(!$g||!conversation_grant_valid($g)||!comment_email_enabled(person_key($g['email'],true),$job['comment_id'],$g['email'])){query("UPDATE conversation_outbox SET status='cancelled' WHERE id=?",[$job['id']]);return true;}
        $c=one('SELECT * FROM comments WHERE id=? AND (id=? OR parent_id=?)',[$job['comment_id'],$g['root_id'],$g['root_id']]);if(!$c)throw new RuntimeException('Message is no longer in this conversation.');
        $r=one('SELECT * FROM comment_confirmations WHERE comment_id=?',[$c['id']]);
        $url=transaction(fn()=>conversation_login_url($g));
        $message=$c['body'].($r&&$r['amount_cents']!==null?"\n\nBudget change: ".number_format($r['amount_cents']/100,2,'.','').' EUR, including VAT. Applied only after confirmation.':'')."\n\nYour invitation opens only this conversation and the files attached to it.";
        $sent=send_branded_email($g['email'],$g['project_id'],comment_mentions_person($c['id'],$g['email'])?'You were mentioned in a conversation':($r?'Confirmation requested':'New message in your conversation'),$message,$url,'Open conversation');
        if(!$sent&&env('MAIL_TRANSPORT','log')==='mail')throw new RuntimeException('The mail transport did not accept this email.');
        query('UPDATE conversation_outbox SET status=?,error=? WHERE id=?',[$sent?'sent':'logged','',$job['id']]);
    }catch(Throwable $e){query('UPDATE conversation_outbox SET status=?,next_attempt=?,error=? WHERE id=?',[$job['attempts']>=3?'failed':'queued',time()+300,substr($e->getMessage(),0,400),$job['id']]);}
    return true;
}
function conversation_destinations(array $user): array {
    $items=[];
    foreach(rows('SELECT g.*,i.project_id,p.name AS project_name,t.title FROM conversation_grants g JOIN comments c ON c.id=g.root_id JOIN iterations i ON i.id=c.iteration_id JOIN projects p ON p.id=i.project_id LEFT JOIN communication_threads t ON t.comment_id=c.id WHERE g.email=? AND g.revoked=0 AND g.expires_at>? ORDER BY g.created_at DESC',[$user['email'],time()]) as $g){
        if(!conversation_grant_valid($g))continue;
        $a=billing_access($g['project_id']);if(!$a['active']||($a['archived']&&$a['source']!=='subscription'))continue;
        $items[]=['id'=>$g['root_id'],'title'=>$g['title']?:'Conversation','project_name'=>$g['project_name']];
    }
    return $items;
}
