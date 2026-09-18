<?php
declare(strict_types=1);

function activity_with_questions(array $events): array {
    if(!$events)return [];$ids=array_column($events,'id');$placeholders=implode(',',array_fill(0,count($ids),'?'));
    $questions=array_column(rows("SELECT * FROM event_questions WHERE event_id IN ($placeholders)",$ids),null,'event_id');
    foreach($events as &$event)if(isset($questions[$event['id']])){$q=$questions[$event['id']];$q['answer_meta']=json_decode($q['answer_meta'],true)?:[];unset($q['event_id']);$event['question_answer']=$q;}unset($event);
    return $events;
}
function question_slide_title(string $iid,string $slide): string {
    require_once __DIR__.'/slides.php';
    if(!in_array($slide,editor_slide_ids($iid),true))fail('This slide was not found in the presentation.',404);
    $titles=['intro'=>'Welcome home','changes'=>'What’s new','budget'=>'The investment','open-questions'=>'Open questions','contacts'=>'Your project team','summary'=>'Everything, together'];
    $slide=system_slide_type($iid,$slide)??$slide;
    $custom=one('SELECT title FROM slide_content WHERE iteration_id=? AND slide_id=?',[$iid,$slide]);if($custom)return $custom['title'];
    if(isset($titles[$slide]))return $titles[$slide];
    foreach(project_slides($iid) as $record)if('visual-'.$record['id']===$slide)return $record['title'];
    return 'Source slide';
}
function answer_with_activity(array $i,string $actor,string $slide,string $question,callable $answerer): array {
    transaction(fn()=>billing_reserve_usage($i['project_id'],'questions'));
    $title=question_slide_title($i['id'],$slide);$eventId=id();
    transaction(function()use($eventId,$i,$actor,$slide,$title,$question){
        insert('events',['id'=>$eventId,'project_id'=>$i['project_id'],'iteration_id'=>$i['id'],'actor'=>$actor,'type'=>'question_asked','detail'=>$question,'created_at'=>now()]);
        insert('event_questions',['event_id'=>$eventId,'slide'=>$slide,'slide_title'=>$title,'question'=>$question]);
    });
    try{
        $result=$answerer();
        transaction(function()use($eventId,$result){
            query("UPDATE event_questions SET answer=?,status='answered',answer_meta=?,answered_at=? WHERE event_id=?",[(string)$result['answer'],json_encode(array_intersect_key($result,array_flip(['sources','citations','mode'])),JSON_INVALID_UTF8_SUBSTITUTE),now(),$eventId]);
            query("UPDATE events SET type='question_answered' WHERE id=?",[$eventId]);
        });
        $result['activity_event']=activity_with_questions(rows('SELECT * FROM events WHERE id=?',[$eventId]))[0]??null;
        return $result;
    }catch(Throwable $error){
        transaction(function()use($eventId){
            query("UPDATE event_questions SET status='failed',answer='The answer could not be generated. Please try again.',answered_at=? WHERE event_id=?",[now(),$eventId]);
            query("UPDATE events SET type='question_failed' WHERE id=?",[$eventId]);
        });
        throw $error;
    }
}
