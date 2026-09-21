<?php
declare(strict_types=1);

function migrate_mentions(PDO $db): void {
    if(!in_array('email_mentions_only',array_column($db->query('PRAGMA table_info(person_profiles)')->fetchAll(),'name'),true)){
        $db->exec('BEGIN IMMEDIATE');
        try {
            if(!in_array('email_mentions_only',array_column($db->query('PRAGMA table_info(person_profiles)')->fetchAll(),'name'),true))$db->exec('ALTER TABLE person_profiles ADD COLUMN email_mentions_only INTEGER NOT NULL DEFAULT 0');
            $db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    }
    $db->exec('CREATE TABLE IF NOT EXISTS comment_mentions (comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE, email TEXT NOT NULL, label TEXT NOT NULL, PRIMARY KEY(comment_id,email))');
}

function mention_people(array $i,string $root='',bool $scoped=false): array {
    if($root&&!one('SELECT 1 FROM comments WHERE id=? AND iteration_id=? AND parent_id IS NULL',[$root,$i['id']]))fail('Conversation not found.',404);
    if($scoped)return conversation_participants($root);
    $people=[];
    foreach(confirmation_recipients($i) as $n=>$p)$people[$p['email']?:'missing:'.$n]=$p;
    if($root)foreach(rows('SELECT g.*,? AS project_id FROM conversation_grants g WHERE root_id=?',[$i['project_id'],$root]) as $g)if(conversation_grant_valid($g))$people[$g['email']]=['email'=>$g['email'],'name'=>$g['name'],'available'=>true,'invitable'=>false];
    return array_values($people);
}

function mention_pattern(array $labels): string {
    usort($labels,fn($a,$b)=>strlen($b)<=>strlen($a));
    return '/(?<![\p{L}\p{N}_@])@('.implode('|',array_map(fn($s)=>preg_quote($s,'/'),$labels)).')(?![\p{L}\p{N}_@+-]|\.[\p{L}\p{N}])/u';
}

// Names are explicit selections from the picker. A typed @email also works.
// Project editors may explicitly invite a selected contact to this thread only.
function save_comment_mentions(array $i,array $c,array $input,bool $scoped=false): void {
    $selected=$input['mentions']??[];
    if(!is_array($selected)||count($selected)>50)fail('Mention up to 50 people in one message.');
    $people=array_column(mention_people($i,$c['parent_id']?:$c['id'],$scoped),null,'email');
    $labels=[];$invitations=[];
    foreach($selected as $m){
        if(!is_array($m))fail('Choose a person from the mention list.');
        $email=email_field($m['email']??'');$label=text_field($m['label']??'',254);
        if(!$label||!preg_match(mention_pattern([$label]),$c['body']))continue;
        $p=$people[$email]??null;
        if(!$p||!in_array($label,[$p['name'],$email],true)||(($p['available']??true)===false&&($scoped||empty($p['invitable'])||($m['invite']??false)!==true)))fail('A mentioned person is no longer available. Remove the mention or select them again.');
        if(isset($labels[$label])&&$labels[$label]!==$email)fail('Use an @email address to distinguish people with the same name.');
        $labels[$label]=$email;
        if(($p['available']??true)===false)$invitations[$email]=$p;
    }
    foreach($people as $email=>$p)if($email!==''&&($p['available']??true)&&preg_match(mention_pattern([$email]),$c['body']))$labels[$email]=$email;
    if(!$labels)return;
    preg_match_all(mention_pattern(array_keys($labels)),$c['body'],$matches);
    foreach(array_unique($matches[1]) as $label){
        $email=$labels[$label];
        if(isset($invitations[$email])){conversation_invite($i,$c['parent_id']?:$c['id'],$invitations[$email],$c['author']);unset($invitations[$email]);}
        query('INSERT OR IGNORE INTO comment_mentions(comment_id,email,label) VALUES(?,?,?)',[$c['id'],$email,$label]);
    }
}
function comment_mentions(string $id): array {return rows('SELECT email,label FROM comment_mentions WHERE comment_id=?',[$id]);}
function comment_mentions_person(string $id,string $email): bool {return (bool)one('SELECT 1 FROM comment_mentions WHERE comment_id=? AND email=?',[$id,$email]);}
function comment_email_enabled(string $key,string $id,string $email): bool {
    $p=profile_for($key);
    return $p['email_comments']&&(!$p['email_mentions_only']||comment_mentions_person($id,$email));
}
