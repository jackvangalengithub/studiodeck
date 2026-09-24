<?php
declare(strict_types=1);

function migrate_checklist(PDO $db): void {
    if($db->query("SELECT 1 FROM migrations WHERE name='checklist-v1'")->fetchColumn())return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        if(!$db->query("SELECT 1 FROM migrations WHERE name='checklist-v1'")->fetchColumn()){
            $columns=array_column($db->query('PRAGMA table_info(open_questions)')->fetchAll(),'name');
            foreach(['accepted'=>"INTEGER NOT NULL DEFAULT 0",'item_type'=>"TEXT NOT NULL DEFAULT 'question' CHECK(item_type IN ('question','action'))",'responsible'=>"TEXT NOT NULL DEFAULT ''",'source_comment_id'=>"TEXT REFERENCES comments(id) ON DELETE SET NULL",'confirmation_id'=>"TEXT REFERENCES comment_confirmations(comment_id) ON DELETE SET NULL"] as $name=>$definition)
                if(!in_array($name,$columns,true))$db->exec("ALTER TABLE open_questions ADD COLUMN $name $definition");
            $db->exec("UPDATE open_questions SET accepted=1 WHERE published=1 OR edited=1 OR resolved=1 OR origin IN ('designer','conversation') OR EXISTS (SELECT 1 FROM open_question_replies r WHERE r.iteration_id=open_questions.iteration_id AND r.question_id=open_questions.id)");
            $db->exec("UPDATE slide_groups SET label='Checklist' WHERE id='questions' AND label='Open questions'");
            $db->exec("INSERT INTO migrations(name) VALUES('checklist-v1')");
        }
        $db->exec('COMMIT');
    } catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}

// Only the current iteration's evidence is supplied to the model. Quotes are
// checked against these excerpts before an AI answer can be displayed.
function open_question_context(string $iid): array {
    $project=one('SELECT p.name,p.description FROM projects p JOIN iterations i ON i.project_id=p.id WHERE i.id=?',[$iid]);
    $files=rows('SELECT v.id,v.name,v.extracted_text,v.metadata FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? ORDER BY v.id',[$iid]);
    $budget=budget_rows($iid);
    $visuals=rows('SELECT title,description,source_version_id,page_number,metadata FROM presentation_slides WHERE iteration_id=? ORDER BY position,id',[$iid]);
    $fingerprint=hash('sha256',json_encode([$project,$files,$budget,$visuals],JSON_INVALID_UTF8_SUBSTITUTE));
    $sources=[];$remaining=90000;$partial=false;
    foreach($files as $f){
        $pages=rows('SELECT number,text,metadata FROM document_pages WHERE version_id=? ORDER BY number',[$f['id']]);
        if(!$pages)$pages=[['number'=>0,'text'=>$f['extracted_text'],'metadata'=>$f['metadata']]];
        foreach($pages as $p){
            if(count($sources)>=120){$partial=true;continue;}
            $meta=json_decode($p['metadata'],true)?:[];
            $raw=$p['text'];$visual=$meta['analysis']['summary']??$meta['summary']??'';
            if(!$raw&&!$visual)continue;
            $text=substr($raw,0,max(0,min(6000,$remaining)));$remaining-=strlen($text);
            if(strlen($text)<strlen($raw))$partial=true;
            if($text!==''||$visual!=='')$sources[]=['key'=>$f['id'].':'.$p['number'],'version_id'=>$f['id'],'name'=>$f['name'],'page'=>(int)$p['number'],'text'=>$text,'visual_summary'=>substr($visual,0,800)];
        }
    }
    return ['project'=>$project,'sources'=>$sources,'budget'=>$budget,'known_total_cents'=>budget_total($budget),'visuals'=>array_slice(array_map(fn($v)=>array_intersect_key($v,array_flip(['title','description','source_version_id','page_number'])),$visuals),0,60),'partial'=>$partial,'fingerprint'=>$fingerprint];
}

function open_questions_payload(string $iid,bool $designer): array {
    $questions=rows('SELECT * FROM open_questions WHERE iteration_id=?'.($designer?'':' AND published=1 AND dismissed=0').' ORDER BY created_at,id',[$iid]);
    $fingerprint=$questions?open_question_context($iid)['fingerprint']:'';
    foreach($questions as &$q){
        $q['citations']=json_decode($q['citations'],true)?:[];
        $q['stale']=$q['fingerprint']!==''&&$q['fingerprint']!==$fingerprint;
        if($q['stale']){$q['answer']='';if($q['kind']==='answered')$q['kind']='clarification';}
        $q['thread_id']=checklist_thread($q);
        $q['replies']=$q['thread_id']?rows('SELECT id,author,body,created_at FROM comments WHERE parent_id=? ORDER BY created_at,rowid',[$q['thread_id']]):rows('SELECT id,author,body,created_at FROM open_question_replies WHERE iteration_id=? AND question_id=? ORDER BY created_at,rowid',[$iid,$q['id']]);
        $q['accepted']=(int)($q['accepted']||$q['published']);
        $q['confirmation']=$q['confirmation_id']?one('SELECT r.comment_id,r.status,r.recipient_name,c.iteration_id FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id WHERE r.comment_id=?',[$q['confirmation_id']]):null;
        $q['source_comment']=$q['source_comment_id']?one('SELECT id,iteration_id FROM comments WHERE id=?',[$q['source_comment_id']]):null;
        // Client grants cover one iteration; older conversations keep their original access rules.
        if(!$designer){
            if(($q['confirmation']['iteration_id']??$iid)!==$iid){$q['confirmation']=null;$q['confirmation_id']=null;}
            if(($q['source_comment']['iteration_id']??$iid)!==$iid){$q['source_comment']=null;$q['source_comment_id']=null;}
        }
        unset($q['fingerprint']);
    }unset($q);
    return $questions;
}

// Called within the caller's transaction, including the last ingest completion.
function queue_open_questions(string $iid): void {
    queue_consistency_checks($iid);
}

// Compatibility for queued jobs and older clients. Suggestions now mean inconsistencies only.
function generate_open_questions(string $iid,?callable $request=null): void {
    if(!$request&&env('OPENAI_API_KEY')==='')return;
    run_consistency_checks($iid,$request);
}

function open_question_key(string $question): string { return strtolower(preg_replace('/[^\pL\pN]+/u','',$question)??$question); }

function copy_open_questions(string $from,string $to): void {
    $before=open_question_context($from)['fingerprint'];$after=open_question_context($to)['fingerprint'];
    foreach(rows('SELECT * FROM open_questions WHERE iteration_id=? AND resolved=0',[$from]) as $q){
        if(checklist_thread($q))continue;
        if($q['fingerprint']===$before)$q['fingerprint']=$after;
        $q['iteration_id']=$to;insert('open_questions',$q);
        foreach(rows('SELECT * FROM open_question_replies WHERE iteration_id=? AND question_id=?',[$from,$q['id']]) as $r){$r['id']=id();$r['iteration_id']=$to;insert('open_question_replies',$r);}
    }
}
