<?php
declare(strict_types=1);

// Keep existing thread identities and decisions when simplifying their purposes.
function migrate_communication_topics(PDO $db): void {
    $schema=$db->query("SELECT sql FROM sqlite_master WHERE name='communication_topics'")->fetchColumn();
    if(str_contains($schema,"'conversation'"))return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        $schema=$db->query("SELECT sql FROM sqlite_master WHERE name='communication_topics'")->fetchColumn();
        if(!str_contains($schema,"'conversation'")){
            $db->exec("CREATE TABLE communication_topics_next (root_id TEXT PRIMARY KEY REFERENCES comments(id) ON DELETE CASCADE,type TEXT NOT NULL CHECK(type IN ('conversation','todo','approval')),assignee TEXT NOT NULL DEFAULT '',assignee_name TEXT NOT NULL DEFAULT '',due_date TEXT NOT NULL DEFAULT '',question_id TEXT,related_root_id TEXT REFERENCES comments(id) ON DELETE SET NULL)");
            $db->exec("INSERT INTO communication_topics_next SELECT root_id,CASE WHEN type IN ('discussion','question') THEN 'conversation' WHEN type IN ('confirmation','price_adjustment') THEN 'approval' ELSE type END,assignee,assignee_name,due_date,question_id,related_root_id FROM communication_topics");
            $db->exec('DROP TABLE communication_topics');
            $db->exec('ALTER TABLE communication_topics_next RENAME TO communication_topics');
            foreach(['from_type','to_type'] as $column)$db->exec("UPDATE communication_topic_history SET $column=CASE WHEN $column IN ('discussion','question') THEN 'conversation' WHEN $column IN ('confirmation','price_adjustment') THEN 'approval' ELSE $column END");
        }
        $db->exec('COMMIT');
    } catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function communication_type(string $type): string {
    return match($type){'message','discussion','question'=>'conversation','confirmation','price_adjustment'=>'approval',default=>$type};
}

function communication_audience(string $root): string {
    return one('SELECT audience FROM communication_audiences WHERE root_id=?',[$root])['audience']??'shared';
}
function communication_root(array $c): string { return $c['parent_id']?:$c['id']; }
function communication_guard(array $c,bool $designer): void {
    if(!$designer&&communication_audience(communication_root($c))==='studio')fail('Conversation not found.',404);
}
function communication_visible(array $comments,bool $designer): array {
    return $designer?$comments:array_values(array_filter($comments,fn($c)=>communication_audience(communication_root($c))==='shared'));
}
function checklist_thread(array $q): ?string {
    return one('SELECT root_id FROM checklist_threads WHERE iteration_id=? AND question_id=?',[$q['iteration_id'],$q['id']])['root_id']??null;
}
// Called inside the checklist write transaction. No historical backfill is performed.
function ensure_checklist_thread(array $q,string $actor): string {
    if($root=checklist_thread($q))return $root;
    $sourceId=$q['source_comment_id']?:($q['confirmation_id']??null);
    $source=$sourceId?one('SELECT * FROM comments WHERE id=?',[$sourceId]):null;
    if($source){$root=communication_root($source);if($q['published']&&communication_audience($root)==='studio')fail('Share the conversation before including this item in the client presentation.');}
    else {
        $root=id();$c=['id'=>$root,'iteration_id'=>$q['iteration_id'],'parent_id'=>null,'slide'=>'general','author'=>$actor,'body'=>$q['question'],'created_at'=>now()];
        insert('comments',$c);
        insert('communication_threads',['comment_id'=>$root,'title'=>preview_text($q['question'],100)]);
        insert('communication_audiences',['root_id'=>$root,'audience'=>$q['published']?'shared':'studio']);
        insert('communication_topics',['root_id'=>$root,'type'=>$q['item_type']==='action'?'todo':'conversation','assignee_name'=>$q['responsible']??'','question_id'=>$q['id']]);
        queue_comment_notifications(one('SELECT * FROM iterations WHERE id=?',[$q['iteration_id']]),$c);
    }
    insert('checklist_threads',['iteration_id'=>$q['iteration_id'],'question_id'=>$q['id'],'root_id'=>$root]);
    return $root;
}
function communication_iterations(array $i,bool $designer): array {
    if($designer)return rows('SELECT id,number,title,locked FROM iterations WHERE project_id=? ORDER BY number DESC',[$i['project_id']]);
    return rows("SELECT i.id,i.number,i.title,i.locked,(SELECT s.id FROM shares s WHERE s.iteration_id=i.id AND s.email=? AND s.revoked=0 AND s.expires_at>? ORDER BY s.created_at DESC LIMIT 1) AS share_id FROM iterations i WHERE i.project_id=? AND i.status='shared' AND EXISTS(SELECT 1 FROM project_client_members cm WHERE cm.project_id=i.project_id AND cm.email=?) AND EXISTS(SELECT 1 FROM shares s WHERE s.iteration_id=i.id AND s.email=? AND s.revoked=0 AND s.expires_at>?) ORDER BY i.number DESC",[current_session()['email'],time(),$i['project_id'],current_session()['email'],current_session()['email'],time()]);
}
function project_communication_payload(array $i,bool $designer): array {
    $iterations=communication_iterations($i,$designer);$comments=[];$threads=[];$confirmations=[];$attachments=[];$guests=[];$items=[];$recipients=[];$files=[];$slides=[];$publicSlides=[];
    foreach($iterations as $index=>$iteration){
        $source=one('SELECT * FROM iterations WHERE id=?',[$iteration['id']]);
        // Historical presentation threads keep the original iteration's audience.
        // The client payload is already restricted to that client's active shares.
        $iterations[$index]['status']=$source['status'];
        $iterations[$index]['presentation_visible']=$source['id']===$i['id']||($source['status']==='shared'&&(bool)one('SELECT 1 FROM shares s JOIN project_client_members m ON m.project_id=? AND m.email=s.email WHERE s.iteration_id=? AND s.revoked=0 AND s.expires_at>?',[$i['project_id'],$source['id'],time()]));
        $part=communication_payload($source);
        $slides[$source['id']]=communication_slides($source['id'],$designer);
        $publicSlides[$source['id']]=$designer?communication_slides($source['id'],false):$slides[$source['id']];
        $visible=communication_visible(rows('SELECT *,rowid AS comment_order FROM comments WHERE iteration_id=? ORDER BY created_at,rowid',[$source['id']]),$designer);
        $ids=array_fill_keys(array_column($visible,'id'),true);
        foreach($visible as &$c){$c['audience']=communication_audience(communication_root($c));$c['iteration_number']=$source['number'];}unset($c);
        array_push($comments,...$visible);
        foreach(['threads','confirmations','attachments'] as $key)foreach($part[$key] as $entry)if(isset($ids[$entry['comment_id']??$entry['id']]))${$key}[]=$entry;
        if($designer)array_push($guests,...$part['guests']);
        foreach(open_questions_payload($source['id'],$designer) as $q){$q['thread_id']=checklist_thread($q);$q['iteration_number']=$source['number'];$q['locked']=(bool)$source['locked'];$items[]=$q;}
        $recipients[$source['id']]=$part['recipients'];
        $files[$source['id']]=rows('SELECT v.id,v.name,v.number FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? ORDER BY v.name',[$source['id']]);
    }
    // Legacy checklist copies use their most recent identity; new items have one home.
    $seen=[];$items=array_values(array_filter($items,function($q)use(&$seen){if(isset($seen[$q['id']]))return false;$seen[$q['id']]=true;return true;}));
    usort($comments,fn($a,$b)=>strcmp($a['created_at'],$b['created_at'])?:$a['comment_order']<=>$b['comment_order']);
    [$key]=profile_identity();
    return ['actor'=>current_session()['email'],'comments'=>decorate_comments($comments,$key),'threads'=>$threads,'confirmations'=>$confirmations,'attachments'=>$attachments,'guests'=>$guests,'items'=>$items,'iterations'=>$iterations,'recipients'=>$recipients[$i['id']]??[],'iteration_recipients'=>$recipients,'iteration_files'=>$files,'iteration_slides'=>$slides,'public_iteration_slides'=>$publicSlides];
}
function share_communication(array $b): array {
    return transaction(function()use($b){
        $u=owner(true);$i=owned_iteration(text_field($b['iteration']??''),$u,false,true);
        $root=one('SELECT * FROM comments WHERE id=? AND iteration_id=? AND parent_id IS NULL',[text_field($b['id']??''),$i['id']]);if(!$root)fail('Conversation not found.',404);
        if(($b['share_history']??false)!==true)fail('Sharing includes all earlier messages and attachments.');
        query("UPDATE communication_audiences SET audience='shared' WHERE root_id=?",[$root['id']]);
        query('UPDATE open_questions SET published=1 WHERE iteration_id=? AND id=(SELECT question_id FROM communication_topics WHERE root_id=?)',[$i['id'],$root['id']]);
        return ['ok'=>true];
    });
}

function decide_communication_work(array $b): array {
    return transaction(function()use($b){
        $scoped=text_field($b['conversation']??'',80);
        if($scoped){$g=conversation_access($scoped,true);$i=one('SELECT * FROM iterations WHERE id=?',[$g['iteration_id']]);$actor=authenticated_user(true)['email'];$designer=false;}
        else [$i,$actor,$designer]=access_iteration(text_field($b['iteration']??''),true);
        $c=one('SELECT c.*,m.assignee,m.question_id FROM comments c JOIN communication_topics m ON m.root_id=c.id WHERE c.id=? AND c.iteration_id=?',[text_field($b['id']??'',80),$i['id']]);
        if(!$c||!$c['question_id']||($scoped&&communication_root($c)!==$scoped))fail('Work item not found.',404);
        communication_guard($c,$designer||!!$scoped);
        if(!$designer&&$actor!==$c['author']&&$actor!==$c['assignee'])fail('Only the responsible person, author or project team can complete this item.',403);
        if($i['locked'])fail('This iteration is locked.',409);
        if(!is_bool($b['resolved']??null))fail('Choose complete or reopen.');
        query('UPDATE open_questions SET resolved=?,edited=1 WHERE iteration_id=? AND id=?',[(int)$b['resolved'],$i['id'],$c['question_id']]);
        query('UPDATE comments SET answered=? WHERE id=?',[(int)$b['resolved'],$c['id']]);
        return ['ok'=>true];
    });
}

function communication_topic(string $root): ?array {
    $topic=one('SELECT * FROM communication_topics WHERE root_id=?',[$root]);
    if(!$topic)return null;
    $topic['history']=rows('SELECT actor,from_type,to_type,assignee_name,due_date,created_at FROM communication_topic_history WHERE root_id=? ORDER BY created_at,rowid',[$root]);
    $topic['resolved']=$topic['question_id']?(bool)(one('SELECT resolved FROM open_questions WHERE id=? AND iteration_id=(SELECT iteration_id FROM comments WHERE id=?)',[$topic['question_id'],$root])['resolved']??0):(bool)(one('SELECT answered FROM comments WHERE id=?',[$root])['answered']??0);
    return $topic;
}
function update_communication_thread(array $b): array {
    return transaction(function()use($b){
        [$i,$actor,$designer]=access_iteration(text_field($b['iteration']??''),true);
        $c=one('SELECT * FROM comments WHERE id=? AND iteration_id=? AND parent_id IS NULL',[text_field($b['id']??'',80),$i['id']]);
        if(!$c)fail('Conversation not found.',404);
        communication_guard($c,$designer);
        if(!$designer&&$c['author']!==$actor)fail('Only the author or project team can change the thread.',403);
        if($i['locked'])fail('This iteration is locked.',409);
        $request=one('SELECT * FROM comment_confirmations WHERE comment_id=?',[$c['id']]);
        $old=communication_topic($c['id'])??['type'=>$request?'approval':'conversation','assignee'=>'','assignee_name'=>'','due_date'=>'','question_id'=>null];
        $type=communication_type(text_field($b['thread_type']??$old['type'],30));
        if(($old['type']==='approval'&&$type!=='approval')||($old['type']!=='approval'&&!in_array($type,['conversation','todo'],true))||($old['type']==='todo'&&$type!=='todo'))fail('Approval terms are preserved. Start a linked thread for a new request.');
        foreach(['amount','recipient','body','annotation','version_id'] as $field)if(array_key_exists($field,$b))fail('The original message and approval terms cannot be changed here.');
        $title=array_key_exists('thread_title',$b)?text_field($b['thread_title'],160):null;
        if($title!==null&&$title==='')fail('A conversation needs a subject.');
        $previousAudience=communication_audience($c['id']);
        $audience=text_field($b['audience']??$previousAudience,20);
        if(!in_array($audience,['studio','shared'],true)||(!$designer&&$audience!==$previousAudience))fail('Only the project team can change the conversation audience.',403);
        if($audience!==$previousAudience&&$audience==='shared'&&($b['share_history']??false)!==true)fail('Sharing includes all earlier messages and attachments.');
        $people=confirmation_recipients($i);
        if($audience==='studio'&&$audience!==$previousAudience){
            $team=array_column(array_filter($people,fn($p)=>$p['group']==='team'),'email');
            foreach(rows('SELECT r.recipient FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id WHERE c.id=? OR c.parent_id=?',[$c['id'],$c['id']]) as $confirmation)if(!in_array($confirmation['recipient'],$team,true))fail('A conversation with an external approval must remain shared.');
        }
        $slide=text_field($b['slide']??$c['slide'],80);
        if($slide!==$c['slide']){
            if($c['slide']!=='general')fail('The original slide is already recorded.',409);
            validate_communication_slide($i,$slide,$designer);
        }
        $assignee=text_field($b['assignee']??$old['assignee'],254);$due=text_field($b['due_date']??$old['due_date'],10);$person=null;
        if($type==='approval'&&($assignee!==''||$due!==''))fail('Approval terms are preserved. Start a linked thread for a new request.');
        if($type==='todo'&&!$assignee)fail('Choose who is responsible for this to do.');
        if($due&&($type!=='todo'||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$due)||!checkdate((int)substr($due,5,2),(int)substr($due,8,2),(int)substr($due,0,4))))fail('Choose a valid due date.');
        foreach($people as $p)if($p['email']===$assignee&&$p['available']&&($audience!=='studio'||$p['group']==='team'))$person=$p;
        if($assignee&&!$person)fail('Choose a responsible person with access to this conversation.');
        // Save the metadata and work changes in the same transaction.
        if($title!==null)query('INSERT INTO communication_threads(comment_id,title) VALUES(?,?) ON CONFLICT(comment_id) DO UPDATE SET title=excluded.title',[$c['id'],$title]);
        if($audience!==$previousAudience)query('INSERT INTO communication_audiences(root_id,audience) VALUES(?,?) ON CONFLICT(root_id) DO UPDATE SET audience=excluded.audience',[$c['id'],$audience]);
        if($slide!==$c['slide'])query('UPDATE comments SET slide=? WHERE id=? OR parent_id=?',[$slide,$c['id'],$c['id']]);
        if($type!=='approval'){
            $qid=$old['question_id'];
            $linkedWork=$qid?one('SELECT origin,citations FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]):null;
            $track=$type==='todo'||$assignee!==''||($qid&&(!$old['assignee']||$linkedWork['origin']!=='conversation'||$linkedWork['citations']!=='[]'));
            $reopen=$type!==$old['type']||($assignee!==$old['assignee']&&$assignee!=='');
            if($track){
                if(!$qid){$qid=id();insert('open_questions',['id'=>$qid,'iteration_id'=>$i['id'],'question'=>preview_text($c['body'],240),'source_comment_id'=>$c['id'],'origin'=>'conversation','accepted'=>1,'edited'=>1,'published'=>communication_audience($c['id'])==='shared'?1:0,'created_at'=>now()]);ensure_checklist_thread(one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]),$actor);}
                query('UPDATE open_questions SET item_type=?,responsible=?,resolved=CASE WHEN ? THEN 0 ELSE resolved END,dismissed=0 WHERE iteration_id=? AND id=?',[$type==='todo'?'action':'question',$person['name']??'',$reopen?1:0,$i['id'],$qid]);
            }elseif($qid){query('DELETE FROM checklist_threads WHERE iteration_id=? AND question_id=?',[$i['id'],$qid]);query('DELETE FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]);$qid=null;}
            query('INSERT INTO communication_topics(root_id,type,assignee,assignee_name,due_date,question_id) VALUES(?,?,?,?,?,?) ON CONFLICT(root_id) DO UPDATE SET type=excluded.type,assignee=excluded.assignee,assignee_name=excluded.assignee_name,due_date=excluded.due_date,question_id=excluded.question_id',[$c['id'],$type,$assignee,$person['name']??'',$due,$qid]);
            if($reopen)query('UPDATE comments SET answered=0 WHERE id=?',[$c['id']]);
            if($type!==$old['type']||$assignee!==$old['assignee']||$due!==$old['due_date'])insert('communication_topic_history',['id'=>id(),'root_id'=>$c['id'],'actor'=>$actor,'from_type'=>$old['type'],'to_type'=>$type,'assignee_name'=>$person['name']??'','due_date'=>$due,'created_at'=>now()]);
        }
        if($audience!==$previousAudience){
            if($audience==='studio'){
                query('UPDATE open_questions SET published=0 WHERE EXISTS(SELECT 1 FROM checklist_threads t WHERE t.iteration_id=open_questions.iteration_id AND t.question_id=open_questions.id AND t.root_id=?)',[$c['id']]);
                query('UPDATE conversation_grants SET revoked=1 WHERE root_id=?',[$c['id']]);
            }else query('UPDATE open_questions SET published=1 WHERE iteration_id=? AND id=(SELECT question_id FROM communication_topics WHERE root_id=?)',[$i['id'],$c['id']]);
        }
        return ['ok'=>true];
    });
}

// The same predicates drive project metadata and the paginated studio feed.
function communication_view_sql(string $personKey,bool $designer=true): array {
    $actor=db()->quote(substr($personKey,strpos($personKey,':')+1));$key=db()->quote($personKey);
    $visible=$designer?'1=1':'q.published=1';
    $work="EXISTS(SELECT 1 FROM checklist_threads ct JOIN open_questions q ON q.iteration_id=ct.iteration_id AND q.id=ct.question_id WHERE ct.root_id=c.id AND (q.accepted=1 OR q.published=1) AND q.dismissed=0 AND q.resolved=0 AND $visible)";
    $hasWork="EXISTS(SELECT 1 FROM checklist_threads ct JOIN open_questions q ON q.iteration_id=ct.iteration_id AND q.id=ct.question_id WHERE ct.root_id=c.id AND q.dismissed=0 AND (q.accepted=1 OR q.published=1) AND $visible)";
    $requests="SELECT 1 FROM comments request JOIN comment_confirmations confirmation ON confirmation.comment_id=request.id WHERE (request.id=c.id OR request.parent_id=c.id)";
    $pending="EXISTS($requests AND confirmation.status='pending')";
    $assigned="EXISTS(SELECT 1 FROM communication_topics topic JOIN open_questions q ON q.id=topic.question_id AND q.iteration_id=c.iteration_id WHERE topic.root_id=c.id AND topic.assignee=$actor AND q.resolved=0 AND q.dismissed=0 AND $visible)";
    $participant="(c.author=$actor OR EXISTS(SELECT 1 FROM comments own WHERE own.parent_id=c.id AND own.author=$actor) OR EXISTS(SELECT 1 FROM communication_topics topic WHERE topic.root_id=c.id AND topic.assignee=$actor) OR EXISTS($requests AND confirmation.recipient=$actor))";
    $unread="EXISTS(SELECT 1 FROM comments unread WHERE (unread.id=c.id OR unread.parent_id=c.id) AND unread.author<>$actor AND NOT EXISTS(SELECT 1 FROM comment_reads cr WHERE cr.comment_id=unread.id AND cr.person_key=$key) AND ($participant OR EXISTS(SELECT 1 FROM comment_mentions mention WHERE mention.comment_id=unread.id AND mention.email=$actor)))";
    return ['open'=>"($work OR $pending OR (c.answered=0 AND NOT $hasWork AND NOT EXISTS($requests)))",'attention'=>"($assigned OR EXISTS($requests AND confirmation.status='pending' AND confirmation.recipient=$actor) OR $unread)"];
}

function communication_slides(string $iid,bool $designer): array {
    require_once __DIR__.'/slides.php';
    $titles=['intro'=>'Introduction','changes'=>'Changes','budget'=>'Budget','open-questions'=>'Open items','contacts'=>'Project team','summary'=>'Summary'];
    $visuals=array_column(rows('SELECT id,title FROM presentation_slides WHERE iteration_id=?',[$iid]),'title','id');
    $content=array_column(rows('SELECT slide_id,title FROM slide_content WHERE iteration_id=?',[$iid]),'title','slide_id');
    $layout=array_column(rows('SELECT * FROM slide_layout WHERE iteration_id=?',[$iid]),null,'slide_id');
    $files=rows('SELECT v.id,v.name FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=?',[$iid]);
    $slides=[];
    foreach(array_unique(editor_slide_ids($iid)) as $id){
        if(!empty($layout[$id]['deleted'])||(!$designer&&!empty($layout[$id]['hidden'])))continue;
        $type=system_slide_type($iid,$id);
        $title=$content[$id]??$content[$type??'']??$visuals[substr($id,7)]??$titles[$type??'']??$id;
        if($title===$id)foreach($files as $file){
            if($id==='visual-legacy-'.$file['id'])$title=$file['name'];
            if(str_starts_with($id,'source-'.$file['id'].'-')){$page=(int)substr($id,strlen('source-'.$file['id'].'-'));$title=$file['name'].($page?' · p. '.$page:'');}
        }
        $slides[]=['id'=>$id,'title'=>$title];
    }
    return $slides;
}
function validate_communication_slide(array $i,string $slide,bool $designer): void {
    if($slide==='general')return;
    if(!in_array($slide,array_column(communication_slides($i['id'],$designer),'id'),true))fail('Slide not found in this presentation.',404);
}
function link_communication_slide(array $b): array {
    return transaction(function()use($b){
        [$i,$actor,$designer]=access_iteration(text_field($b['iteration']??''),true);
        $c=one('SELECT * FROM comments WHERE id=? AND iteration_id=? AND parent_id IS NULL',[text_field($b['id']??'',80),$i['id']]);
        if(!$c)fail('Conversation not found.',404);
        communication_guard($c,$designer);
        if(!$designer&&$c['author']!==$actor)fail('Only the author or project team can link this thread.',403);
        if($i['locked'])fail('This iteration is locked.',409);
        if($c['slide']!=='general')fail('The original slide is already recorded.',409);
        $slide=text_field($b['slide']??'',80);
        if($slide==='general')fail('Choose an original slide.');
        validate_communication_slide($i,$slide,$designer);
        query('UPDATE comments SET slide=? WHERE id=? OR parent_id=?',[$slide,$c['id'],$c['id']]);

        return ['ok'=>true];
    });
}
