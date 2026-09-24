<?php
declare(strict_types=1);

function migrate_comment_threads(PDO $db): void {
    $columns=array_column($db->query('PRAGMA table_info(comments)')->fetchAll(),'name');
    if(!in_array('parent_id',$columns,true)||!in_array('answered',$columns,true)) {
        $db->exec('BEGIN IMMEDIATE');
        try {
            $columns=array_column($db->query('PRAGMA table_info(comments)')->fetchAll(),'name');
            if(!in_array('parent_id',$columns,true))$db->exec('ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE');
            if(!in_array('answered',$columns,true))$db->exec('ALTER TABLE comments ADD COLUMN answered INTEGER NOT NULL DEFAULT 0');
            $db->exec('COMMIT');
        } catch(Throwable $e) {$db->exec('ROLLBACK');throw $e;}
    }
    $db->exec('CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id)');
    if(!in_array('annotation',array_column($db->query('PRAGMA table_info(comments)')->fetchAll(),'name'),true)) {
        $db->exec('BEGIN IMMEDIATE');
        try {
            if(!in_array('annotation',array_column($db->query('PRAGMA table_info(comments)')->fetchAll(),'name'),true))$db->exec('ALTER TABLE comments ADD COLUMN annotation TEXT');
            $db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    }
}

function comment_annotation(array $i,string $slide,mixed $value): ?string {
    if($value===null)return null;
    if(!is_array($value))fail('Choose a point on the image.');
    foreach(['x','y'] as $axis)if(!isset($value[$axis])||(!is_int($value[$axis])&&!is_float($value[$axis]))||!is_finite((float)$value[$axis])||$value[$axis]<0||$value[$axis]>1)fail('Choose a point inside the image.');
    require_once __DIR__.'/slides.php';
    $s=str_starts_with($slide,'visual-')?current_slide($i['id'],substr($slide,7)):null;
    if(!$s||!in_array($s['type'],VISUAL_TYPES,true)||!$s['source_version_id'])fail('Choose an image slide in this presentation.',404);
    $layout=one('SELECT hidden,deleted FROM slide_layout WHERE iteration_id=? AND slide_id=?',[$i['id'],$slide]);
    if(!empty($layout['deleted'])||(!empty($layout['hidden'])&&str_starts_with($_SERVER['HTTP_AUTHORIZATION']??'','Client ')))fail('Image slide not found.',404);
    foreach(['source_version_id','page_number','image_number'] as $field)if(!array_key_exists($field,$value)||(string)$value[$field]!== (string)$s[$field])fail('This image has changed. Reload it before placing feedback.',409);
    $variant=text_field($value['image_version_id']??'',80);
    if($variant&&!in_array($variant,array_column(slide_image_variants($s),'id'),true))fail('Image variation not found in this presentation.',404);
    return json_encode(['x'=>$value['x'],'y'=>$value['y'],'source_version_id'=>$s['source_version_id'],'page_number'=>(int)$s['page_number'],'image_number'=>(int)$s['image_number'],'image_version_id'=>$variant]);
}

function add_comment(array $i,string $actor,array $input): array {
    $body=text_field($input['body']??'',4000);
    if(!$body)fail('Write your feedback first.');
    $parentId=text_field($input['parent_id']??'',80);
    return transaction(function()use($i,$actor,$input,$body,$parentId){
        $parent=$parentId?one('SELECT * FROM comments WHERE id=? AND iteration_id=?',[$parentId,$i['id']]):null;
        if($parentId&&!$parent)fail('The comment you are replying to was not found in this iteration.',404);
        if($parent)communication_guard($parent,!str_starts_with($_SERVER['HTTP_AUTHORIZATION']??'','Client '));
        if($parent&&!empty($parent['parent_id']))fail('Reply to the original comment to keep the conversation in one thread.');
        $slide=text_field($input['slide']??($parent['slide']??'intro'),80);
        if($parent&&$slide!==$parent['slide'])fail('A reply must stay on the same slide as its original comment.');
        if($parent&&isset($input['annotation']))fail('Replies use the original feedback pin.');
        $comment=['id'=>id(),'iteration_id'=>$i['id'],'parent_id'=>$parentId?:null,'slide'=>$slide,'author'=>$actor,'body'=>$body,'created_at'=>now()];
        $comment['annotation']=comment_annotation($i,$slide,$input['annotation']??null);
        insert('comments',$comment);
        save_comment_mentions($i,$comment,$input);
        audit($i['project_id'],$i['id'],$actor,'change_requested',$slide.': '.($parent?'Reply: ':'').$body);
        queue_comment_notifications($i,$comment);
        return $comment;
    });
}

// Page whole threads: a reply is never detached from its original comment.
function comment_feed_page(string $where,array $params,int $offset,string $personKey,string $sort='newest',bool $showAnswered=false,string $filter='all'): array {
    $direction=$sort==='oldest'?'ASC':'DESC';
    $select="SELECT c.*,c.rowid AS comment_order,p.id AS project_id,p.name AS project_name,i.number AS iteration_number,COALESCE(sc.title,s.title) AS slide_title,ss.type AS system_slide_type,t.title AS thread_title FROM comments c JOIN iterations i ON i.id=c.iteration_id JOIN projects p ON p.id=i.project_id LEFT JOIN communication_threads t ON t.comment_id=COALESCE(c.parent_id,c.id) LEFT JOIN presentation_slides s ON s.iteration_id=c.iteration_id AND 'visual-'||s.id=c.slide LEFT JOIN system_slides ss ON ss.iteration_id=c.iteration_id AND ss.id=c.slide LEFT JOIN slide_content sc ON sc.iteration_id=c.iteration_id AND sc.slide_id=COALESCE(ss.type,c.slide) WHERE ";
    $rootParams=$params;$attention='';
    if($filter==='attention'){
        // Filter subjects before pagination; replies and each work item keep their original scope.
        $attention=" AND p.archived=0 AND (
            EXISTS(SELECT 1 FROM comments unread WHERE (unread.id=c.id OR unread.parent_id=c.id) AND unread.author<>? AND NOT EXISTS(SELECT 1 FROM comment_reads cr WHERE cr.comment_id=unread.id AND cr.person_key=?))
            OR EXISTS(SELECT 1 FROM checklist_threads ct JOIN open_questions q ON q.iteration_id=ct.iteration_id AND q.id=ct.question_id WHERE ct.root_id=c.id AND (q.accepted=1 OR q.published=1) AND q.dismissed=0 AND q.resolved=0)
            OR EXISTS(SELECT 1 FROM comments request JOIN comment_confirmations confirmation ON confirmation.comment_id=request.id WHERE (request.id=c.id OR request.parent_id=c.id) AND confirmation.status='pending')
        )";
        $rootParams[]=substr($personKey,strpos($personKey,':')+1);$rootParams[]=$personKey;
    }
    $roots=rows($select.$where.' AND c.parent_id IS NULL'.$attention.($showAnswered||$filter==='attention'?'':' AND c.answered=0').' ORDER BY c.created_at '.$direction.',c.rowid '.$direction.' LIMIT 101 OFFSET '.$offset,$rootParams);
    $more=count($roots)>100;$roots=array_slice($roots,0,100);$replies=[];
    if($roots){
        $ids=array_column($roots,'id');$marks=implode(',',array_fill(0,count($ids),'?'));
        foreach(rows($select.$where.' AND c.parent_id IN ('.$marks.') ORDER BY c.created_at '.$direction.',c.rowid '.$direction,array_merge($params,$ids)) as $reply)$replies[$reply['parent_id']][]=$reply;
    }
    $items=[];foreach($roots as $root){$items[]=$root;foreach($replies[$root['id']]??[] as $reply)$items[]=$reply;}
    return ['items'=>decorate_comments($items,$personKey),'has_more'=>$more,'next_offset'=>$offset+count($roots)];
}

function set_comment_answered(array $input): array {
    if(!isset($input['answered'])||!is_bool($input['answered']))fail('Choose whether the comment is answered.');
    return transaction(function()use($input){
        [$iteration,$actor,$isOwner]=access_iteration(text_field($input['iteration']??''),true);
        // Team members and assigned clients may resolve threads, with CSRF.
        $comment=one('SELECT * FROM comments WHERE id=? AND iteration_id=?',[text_field($input['id']??'',80),$iteration['id']]);
        if(!$comment)fail('Comment not found in this iteration.',404);
        communication_guard($comment,$isOwner);
        if($comment['parent_id'])fail('Only the original comment can be marked answered.');
        $topic=communication_topic($comment['id']);
        if($topic&&($topic['type']!=='conversation'||$topic['question_id']))fail('Use the thread completion or approval action.');
        $answered=$input['answered']?1:0;
        if((int)$comment['answered']!==$answered){
            query('UPDATE comments SET answered=? WHERE id=?',[$answered,$comment['id']]);
            audit($iteration['project_id'],$iteration['id'],$actor,'comment_status_changed',($answered?'Marked answered: ':'Reopened comment: ').$comment['body']);
        }
        return ['id'=>$comment['id'],'answered'=>(bool)$answered];
    });
}
