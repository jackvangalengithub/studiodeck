<?php
declare(strict_types=1);

if($action==='generate_open_questions'){
    $u=owner(true);$b=input();
    transaction(function()use($u,$b){$i=owned_iteration(text_field($b['iteration']??''),$u,true);queue_open_questions($i['id']);});
    json_response(['ok'=>true],202);
}
if($action==='save_open_question'){
    $u=owner(true);$b=input();
    $qid=transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$qid=text_field($b['id']??'');
        $q=$qid?one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]):null;
        if($qid&&!$q)fail('Question not found.',404);
        $op=$b['operation']??'save';
        if($op==='accept'){
            if(!$q)fail('Question not found.',404);
            query('UPDATE open_questions SET accepted=1,edited=1,dismissed=0 WHERE iteration_id=? AND id=?',[$i['id'],$qid]);
        }elseif(in_array($op,['dismiss','restore','resolve','reopen'],true)){
            if(!$q)fail('Question not found.',404);
            if($op==='resolve'&&!$q['accepted']&&!$q['published'])fail('Accept this suggestion before marking it done.');
            $field=in_array($op,['dismiss','restore'],true)?'dismissed':'resolved';
            query("UPDATE open_questions SET $field=?,edited=1 WHERE iteration_id=? AND id=?",[in_array($op,['dismiss','resolve'],true)?1:0,$i['id'],$qid]);
        }elseif($op==='save'){
            $question=text_field($b['question']??'',240);$answer=text_field($b['answer']??'',1200);$reason=text_field($b['reason']??'',600);$kind=$b['kind']??'clarification';
            if(!$question)fail('Write a question first.');
            if(!in_array($kind,['answered','clarification','preference'],true))fail('Choose a valid question state.');
            if($kind==='answered'&&!$answer)fail('Add an answer, or choose Needs clarification.');
            if(!is_bool($b['published']??null))fail('Choose whether to include this question.');
            $itemType=$b['item_type']??$q['item_type']??'question';
            if(!in_array($itemType,['question','action'],true))fail('Choose a question or action.');
            $responsible=text_field($b['responsible']??$q['responsible']??'',160);
            $source=text_field($b['source_comment_id']??$q['source_comment_id']??'',80);
            if($source&&$source!==($q['source_comment_id']??null)&&!one('SELECT 1 FROM comments WHERE id=? AND iteration_id=?',[$source,$i['id']]))fail('Comment not found in this iteration.',404);
            $confirmation=text_field($b['confirmation_id']??$q['confirmation_id']??'',80);
            if($confirmation&&$confirmation!==($q['confirmation_id']??null)&&!one('SELECT 1 FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id WHERE r.comment_id=? AND c.iteration_id=?',[$confirmation,$i['id']]))fail('Confirmation not found in this iteration.',404);
            if($confirmation&&$q&&($root=checklist_thread($q))){$request=one('SELECT * FROM comments WHERE id=?',[$confirmation]);if(!$request||(communication_root($request)!==$root&&(communication_topic(communication_root($request))['related_root_id']??null)!==$root))fail('Choose an approval from this conversation or a linked thread.');}
            if($confirmation!==($q['confirmation_id']??'')&&!empty($q['confirmation_id'])&&one("SELECT 1 FROM comment_confirmations WHERE comment_id=? AND status='pending'",[$q['confirmation_id']]))fail('Withdraw or complete the linked confirmation before replacing it.');
            if($confirmation&&one('SELECT 1 FROM open_questions WHERE iteration_id=? AND confirmation_id=? AND id<>?',[$i['id'],$confirmation,$qid]))fail('This confirmation is already linked to a checklist item.');
            if($q&&($root=checklist_thread($q))&&$b['published']&&communication_audience($root)==='studio')fail('Share the conversation before including this item in the client presentation.');
            $fields=['question'=>$question,'answer'=>$kind==='answered'?$answer:'','reason'=>$reason,'kind'=>$kind,'published'=>(int)$b['published'],'accepted'=>1,'item_type'=>$itemType,'responsible'=>$responsible,'source_comment_id'=>$source?:null,'confirmation_id'=>$confirmation?:null,'edited'=>1,'fingerprint'=>open_question_context($i['id'])['fingerprint']];
            if($q){
                if($answer!==$q['answer']||$question!==$q['question']){$fields['origin']='designer';$fields['citations']='[]';}
                query('UPDATE open_questions SET '.implode(',',array_map(fn($k)=>$k.'=?',array_keys($fields))).' WHERE iteration_id=? AND id=?',[...array_values($fields),$i['id'],$qid]);
            }else{$qid=id();insert('open_questions',['id'=>$qid,'iteration_id'=>$i['id'],...$fields,'created_at'=>now()]);}
        }else fail('Unknown question action.');
        $saved=one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]);
        if($saved['accepted']||$saved['published'])ensure_checklist_thread($saved,$u['email']);
        if(in_array($op,['resolve','reopen'],true))query('UPDATE comments SET answered=? WHERE id IN (SELECT root_id FROM communication_topics WHERE question_id=?) AND iteration_id=?',[$op==='resolve'?1:0,$qid,$i['id']]);
        audit($i['project_id'],$i['id'],$u['email'],'open_question_updated',($op==='save'?$question:ucfirst($op).': '.$q['question']));return $qid;
    });json_response(['id'=>$qid]);
}
if($action==='reply_open_question'){
    $b=input();
    transaction(function()use($b){
        [$i,$actor,$designer]=access_iteration(text_field($b['iteration']??''),true);
        $q=one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],text_field($b['id']??'')]);
        if(!$q||(!$designer&&(!$q['published']||$q['dismissed'])))fail('Question not found.',404);
        $body=text_field($b['body']??'',4000);if(!$body)fail('Write your reply first.');
        $root=ensure_checklist_thread($q,$actor);
        communication_guard(one('SELECT * FROM comments WHERE id=?',[$root]),$designer);
        $c=['id'=>id(),'iteration_id'=>$i['id'],'parent_id'=>$root,'slide'=>one('SELECT slide FROM comments WHERE id=?',[$root])['slide'],'author'=>$actor,'body'=>$body,'created_at'=>now()];
        insert('comments',$c);save_comment_mentions($i,$c,$b);queue_comment_notifications($i,$c);
        audit($i['project_id'],$i['id'],$actor,'open_question_reply',$q['question'].': '.$body);
    });json_response(['ok'=>true]);
}
if($action==='add_client_question'){
    $b=input();
    $result=transaction(function()use($b){
        [$i,$actor]=access_iteration(text_field($b['iteration']??''),true);
        $question=text_field($b['question']??'',240);if(!$question)fail('Write a question first.');
        $qid=id();insert('open_questions',['id'=>$qid,'iteration_id'=>$i['id'],'question'=>$question,'origin'=>'conversation','published'=>1,'accepted'=>1,'edited'=>1,'created_at'=>now()]);
        ensure_checklist_thread(one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]),$actor);
        audit($i['project_id'],$i['id'],$actor,'open_question_added',$question);
        return ['ok'=>true,'id'=>$qid];
    });json_response($result);
}
