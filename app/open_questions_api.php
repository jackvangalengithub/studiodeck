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
        if(in_array($op,['dismiss','restore','resolve','reopen'],true)){
            if(!$q)fail('Question not found.',404);
            $field=in_array($op,['dismiss','restore'],true)?'dismissed':'resolved';
            query("UPDATE open_questions SET $field=?,edited=1 WHERE iteration_id=? AND id=?",[in_array($op,['dismiss','resolve'],true)?1:0,$i['id'],$qid]);
        }elseif($op==='save'){
            $question=text_field($b['question']??'',240);$answer=text_field($b['answer']??'',1200);$reason=text_field($b['reason']??'',600);$kind=$b['kind']??'clarification';
            if(!$question)fail('Write a question first.');
            if(!in_array($kind,['answered','clarification','preference'],true))fail('Choose a valid question state.');
            if($kind==='answered'&&!$answer)fail('Add an answer, or choose Needs clarification.');
            if(!is_bool($b['published']??null))fail('Choose whether to include this question.');
            $fields=['question'=>$question,'answer'=>$kind==='answered'?$answer:'','reason'=>$reason,'kind'=>$kind,'published'=>(int)$b['published'],'edited'=>1,'fingerprint'=>open_question_context($i['id'])['fingerprint']];
            if($q){
                if($answer!==$q['answer']||$question!==$q['question']){$fields['origin']='designer';$fields['citations']='[]';}
                query('UPDATE open_questions SET '.implode(',',array_map(fn($k)=>$k.'=?',array_keys($fields))).' WHERE iteration_id=? AND id=?',[...array_values($fields),$i['id'],$qid]);
            }else{$qid=id();insert('open_questions',['id'=>$qid,'iteration_id'=>$i['id'],...$fields,'created_at'=>now()]);}
        }else fail('Unknown question action.');
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
        insert('open_question_replies',['id'=>id(),'iteration_id'=>$i['id'],'question_id'=>$q['id'],'author'=>$actor,'body'=>$body,'created_at'=>now()]);
        audit($i['project_id'],$i['id'],$actor,'open_question_reply',$q['question'].': '.$body);
    });json_response(['ok'=>true]);
}
if($action==='add_client_question'){
    $b=input();
    transaction(function()use($b){
        [$i,$actor]=access_iteration(text_field($b['iteration']??''),true);
        $question=text_field($b['question']??'',240);if(!$question)fail('Write a question first.');
        insert('open_questions',['id'=>id(),'iteration_id'=>$i['id'],'question'=>$question,'origin'=>'conversation','published'=>1,'edited'=>1,'created_at'=>now()]);
        audit($i['project_id'],$i['id'],$actor,'open_question_added',$question);
    });json_response(['ok'=>true]);
}
