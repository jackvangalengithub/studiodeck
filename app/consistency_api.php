<?php
declare(strict_types=1);

if($action==='check_image'){
    $u=owner();$i=owned_iteration(text_field($_GET['iteration']??''),$u);$context=consistency_context($i['id']);
    $source=$context['sources'][text_field($_GET['source_key']??'',160)]??null;
    if(!$source)fail('Source not found in this iteration.',404);
    $raw=consistency_image($i['id'],$source);if(!$raw)fail('Source image unavailable.',404);
    $info=@getimagesizefromstring($raw);header('Content-Type: '.($info['mime']??'image/png'));header('Content-Length: '.strlen($raw));echo $raw;exit;
}
if($action==='run_consistency_checks'){
    $u=owner(true);$b=input();
    $queued=transaction(function()use($u,$b){$i=owned_iteration(text_field($b['iteration']??''),$u,true);return queue_consistency_checks($i['id'],false);});
    json_response(['ok'=>true,'queued'=>$queued],202);
}
if($action==='check_source_role'){
    $u=owner(true);$b=input();
    transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$key=text_field($b['source_key']??'',160);$role=text_field($b['role']??'',40);$context=consistency_context($i['id']);
        $valid=isset($context['sources'][$key]);foreach($context['sources'] as $s)if($key===$s['version_id'].':file')$valid=true;
        if(!$valid)fail('Source not found in this iteration.',404);
        if($role!==''&&!in_array($role,CHECK_ROLES,true))fail('Choose a valid source role.');
        if($role==='')query('DELETE FROM check_source_roles WHERE iteration_id=? AND source_key=?',[$i['id'],$key]);
        else query('INSERT INTO check_source_roles(iteration_id,source_key,role) VALUES(?,?,?) ON CONFLICT(iteration_id,source_key) DO UPDATE SET role=excluded.role',[$i['id'],$key,$role]);
        audit($i['project_id'],$i['id'],$u['email'],'check_source_role_changed',$key.': '.($role?:'automatic'));
        queue_consistency_checks($i['id']);
    });json_response(['ok'=>true]);
}
if($action==='review_consistency_finding'){
    $u=owner(true);$b=input();
    $result=transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$f=one('SELECT * FROM consistency_findings WHERE iteration_id=? AND id=?',[$i['id'],text_field($b['id']??'',80)]);
        if(!$f)fail('Finding not found.',404);
        $op=$b['operation']??'';
        if(in_array($op,['open','resolved','dismissed'],true))query('UPDATE consistency_findings SET status=? WHERE id=?',[$op,$f['id']]);
        elseif($op==='question'){
            if($f['fingerprint']!==consistency_context($i['id'])['fingerprint'])fail('Run checks again before creating a question from outdated evidence.',409);
            if($f['question_id']&&one('SELECT 1 FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$f['question_id']]))return ['question_id'=>$f['question_id']];
            $qid=id();$citations=[];
            foreach(json_decode($f['evidence'],true) as $e)if($e['basis']==='text')$citations[]=array_intersect_key($e,array_flip(['version_id','name','page','quote']));
            insert('open_questions',['id'=>$qid,'iteration_id'=>$i['id'],'question'=>substr('Please clarify: '.$f['title'],0,240),'kind'=>'clarification','reason'=>substr($f['explanation'],0,600),'answer'=>'','citations'=>json_encode($citations,JSON_INVALID_UTF8_SUBSTITUTE),'origin'=>'designer','accepted'=>1,'edited'=>1,'published'=>0,'fingerprint'=>open_question_context($i['id'])['fingerprint'],'created_at'=>now()]);
            $root=ensure_checklist_thread(one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]),$u['email']);
            $body=$f['title']."\n\n".$f['explanation'];
            foreach(json_decode($f['evidence'],true) as $e)$body.="\n\n".$e['name'].(!empty($e['page'])?' · p. '.$e['page']:'').": ".$e['object'].' · '.$e['property'].': '.$e['value'].(!empty($e['quote'])?"\n“".$e['quote'].'”':' (visual observation)');
            query('UPDATE comments SET body=? WHERE id=?',[text_field($body,4000),$root]);
            query('UPDATE consistency_findings SET question_id=? WHERE id=?',[$qid,$f['id']]);
        }else fail('Unknown review action.');
        audit($i['project_id'],$i['id'],$u['email'],'consistency_finding_reviewed',$f['title'].' · '.$op);
        return ['ok'=>true,'question_id'=>$qid??$f['question_id']];
    });json_response($result);
}
