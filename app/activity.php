<?php
declare(strict_types=1);

function activity_with_questions(array $events): array {
    if(!$events)return [];$ids=array_column($events,'id');$placeholders=implode(',',array_fill(0,count($ids),'?'));
    $questions=array_column(rows("SELECT * FROM event_questions WHERE event_id IN ($placeholders)",$ids),null,'event_id');
    foreach($events as &$event)if(isset($questions[$event['id']])){$q=$questions[$event['id']];$q['answer_meta']=json_decode($q['answer_meta'],true)?:[];unset($q['event_id']);$event['question_answer']=$q;}unset($event);
    return $events;
}
// Scope and facets use the same authorized project set; filters run before pagination.
function activity_page_data(string $scope,array $scopeParams,array $options,int $offset=0,int $limit=100): array {
    $scope="($scope) AND e.type<>'comment_status_changed'";
    $from=' FROM events e JOIN projects p ON p.id=e.project_id';
    $facets=[
        'types'=>array_column(rows('SELECT DISTINCT e.type'.$from.' WHERE '.$scope.' ORDER BY e.type',$scopeParams),'type'),
        'actors'=>array_column(rows('SELECT DISTINCT e.actor'.$from.' WHERE '.$scope.' ORDER BY e.actor COLLATE NOCASE',$scopeParams),'actor'),
        'projects'=>rows('SELECT DISTINCT p.id,p.name'.$from.' WHERE '.$scope.' ORDER BY p.name COLLATE NOCASE,p.id',$scopeParams)
    ];
    $where=$scope;$params=$scopeParams;
    $sort=text_field($options['sort']??'newest',10);
    if(!in_array($sort,['newest','oldest'],true))fail('Choose newest or oldest first.');
    foreach(['type'=>'e.type','actor'=>'e.actor','project'=>'p.id'] as $key=>$column){
        $value=text_field($options[$key]??'',200);
        if($value!==''){$where.=' AND '.$column.'=?';$params[]=$value;}
    }
    $dates=[];
    foreach(['from','to'] as $key){
        $value=text_field($options[$key]??'',10);
        if($value==='')continue;
        $date=DateTimeImmutable::createFromFormat('!Y-m-d',$value);
        if(!$date||$date->format('Y-m-d')!==$value)fail('Choose a valid activity date.');
        $dates[$key]=$value;
        $where.=' AND substr(e.created_at,1,10)'.($key==='from'?'>=':'<=').'?';$params[]=$value;
    }
    if(isset($dates['from'],$dates['to'])&&$dates['from']>$dates['to'])fail('The end date must be on or after the start date.');
    $search=text_field($options['search']??'',200);
    if($search!==''){
        $pattern='%'.strtr($search,['!'=>'!!','%'=>'!%','_'=>'!_']).'%';
        $columns=['e.detail','e.actor','p.name',"replace(e.type,'_',' ')"];
        $clauses=array_map(fn($column)=>$column." LIKE ? ESCAPE '!'",$columns);
        $clauses[]="EXISTS (SELECT 1 FROM event_questions q WHERE q.event_id=e.id AND (q.question LIKE ? ESCAPE '!' OR q.answer LIKE ? ESCAPE '!' OR q.slide_title LIKE ? ESCAPE '!'))";
        $where.=' AND ('.implode(' OR ',$clauses).')';
        array_push($params,...array_fill(0,7,$pattern));
    }
    $total=(int)one('SELECT COUNT(*) AS n'.$from.' WHERE '.$where,$params)['n'];
    $limit=max(1,min(100,$limit));$offset=min(max(0,$offset),max(0,(int)ceil($total/$limit)-1)*$limit);
    $direction=$sort==='oldest'?'ASC':'DESC';
    $items=activity_with_questions(rows('SELECT e.*,p.name AS project_name'.$from.' WHERE '.$where.' ORDER BY e.created_at '.$direction.',e.rowid '.$direction.' LIMIT '.$limit.' OFFSET '.$offset,$params));
    return ['items'=>$items,'total'=>$total,'offset'=>$offset,'has_more'=>$offset+count($items)<$total,'next_offset'=>$offset+count($items),'facets'=>$facets];
}
function question_slide_title(string $iid,string $slide): string {
    require_once __DIR__.'/slides.php';
    if(!in_array($slide,editor_slide_ids($iid),true))fail('This slide was not found in the presentation.',404);
    $titles=['intro'=>'Welcome home','changes'=>'What’s new','budget'=>'The investment','open-questions'=>'Checklist','contacts'=>'Your project team','summary'=>'Everything, together'];
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
