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
}

function add_comment(array $i,string $actor,array $input): array {
    $body=text_field($input['body']??'',4000);
    if(!$body)fail('Write your feedback first.');
    $parentId=text_field($input['parent_id']??'',80);
    return transaction(function()use($i,$actor,$input,$body,$parentId){
        $parent=$parentId?one('SELECT * FROM comments WHERE id=? AND iteration_id=?',[$parentId,$i['id']]):null;
        if($parentId&&!$parent)fail('The comment you are replying to was not found in this iteration.',404);
        if($parent&&!empty($parent['parent_id']))fail('Reply to the original comment to keep the conversation in one thread.');
        $slide=text_field($input['slide']??($parent['slide']??'intro'),80);
        if($parent&&$slide!==$parent['slide'])fail('A reply must stay on the same slide as its original comment.');
        $comment=['id'=>id(),'iteration_id'=>$i['id'],'parent_id'=>$parentId?:null,'slide'=>$slide,'author'=>$actor,'body'=>$body,'created_at'=>now()];
        insert('comments',$comment);
        audit($i['project_id'],$i['id'],$actor,'change_requested',$slide.': '.($parent?'Reply: ':'').$body);
        queue_comment_notifications($i,$comment);
        return $comment;
    });
}

// Page whole threads: a reply is never detached from its original comment.
function comment_feed_page(string $where,array $params,int $offset,string $personKey,string $sort='newest',bool $showAnswered=false): array {
    $direction=$sort==='oldest'?'ASC':'DESC';
    $select="SELECT c.*,c.rowid AS comment_order,p.id AS project_id,p.name AS project_name,i.number AS iteration_number,COALESCE(sc.title,s.title) AS slide_title,ss.type AS system_slide_type FROM comments c JOIN iterations i ON i.id=c.iteration_id JOIN projects p ON p.id=i.project_id LEFT JOIN presentation_slides s ON s.iteration_id=c.iteration_id AND 'visual-'||s.id=c.slide LEFT JOIN system_slides ss ON ss.iteration_id=c.iteration_id AND ss.id=c.slide LEFT JOIN slide_content sc ON sc.iteration_id=c.iteration_id AND sc.slide_id=COALESCE(ss.type,c.slide) WHERE ";
    $roots=rows($select.$where.' AND c.parent_id IS NULL'.($showAnswered?'':' AND c.answered=0').' ORDER BY c.created_at '.$direction.',c.rowid '.$direction.' LIMIT 101 OFFSET '.$offset,$params);
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
        if($comment['parent_id'])fail('Only the original comment can be marked answered.');
        $answered=$input['answered']?1:0;
        if((int)$comment['answered']!==$answered){
            query('UPDATE comments SET answered=? WHERE id=?',[$answered,$comment['id']]);
            audit($iteration['project_id'],$iteration['id'],$actor,'comment_status_changed',($answered?'Marked answered: ':'Reopened comment: ').$comment['body']);
        }
        return ['id'=>$comment['id'],'answered'=>(bool)$answered];
    });
}
