<?php
declare(strict_types=1);

/** A read-only work queue for active projects on the current user's team. */
function studio_attention(array $u,string $kind='all',int $offset=0): array {
    $kinds=['questions','confirmations','feedback','deadlines'];
    if($kind!=='all'&&!in_array($kind,$kinds,true))fail('Choose a valid attention filter.');
    $today=gmdate('Y-m-d');$until=gmdate('Y-m-d',strtotime($today.' +14 days'));
    $params=[$u['studio_id'],$u['user_id'],$u['email'],$u['email'],$u['email'],person_key($u['email'],true),$today,$until];
    // Use each question's latest copy, while retaining questions clients add to an
    // older shared iteration after a new draft was created. Conversations stay put.
    $cte="WITH scope AS (SELECT p.id,p.name FROM projects p WHERE ".project_team_sql()." AND p.archived=0),
    attention AS (
        SELECT 'questions' AS kind,q.id,p.id AS project_id,p.name AS project_name,i.id AS iteration_id,i.number AS iteration_number,
            q.question AS title,q.created_at AS occurred_at,'' AS deadline,'' AS recipient_name,0 AS assigned_to_me,0 AS unread_count,3 AS priority
        FROM open_questions q JOIN iterations i ON i.id=q.iteration_id JOIN scope p ON p.id=i.project_id
        WHERE q.published=1 AND q.dismissed=0 AND q.resolved=0 AND q.kind<>'answered'
            AND NOT EXISTS (SELECT 1 FROM open_questions newer JOIN iterations latest ON latest.id=newer.iteration_id
                WHERE newer.id=q.id AND latest.project_id=p.id AND latest.number>i.number)
        UNION ALL
        SELECT 'confirmations',c.id,p.id,p.name,i.id,i.number,c.body,c.created_at,'',r.recipient_name,r.recipient=?,0,
            CASE WHEN r.recipient=? THEN 1 ELSE 2 END
        FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id JOIN iterations i ON i.id=c.iteration_id JOIN scope p ON p.id=i.project_id
        WHERE r.status='pending'
        UNION ALL
        SELECT 'feedback',root.id,p.id,p.name,i.id,i.number,root.body,MIN(c.created_at),'','',0,COUNT(*),4
        FROM comments c JOIN comments root ON root.id=COALESCE(c.parent_id,c.id)
            JOIN iterations i ON i.id=c.iteration_id JOIN scope p ON p.id=i.project_id
        WHERE c.author<>? AND NOT EXISTS (SELECT 1 FROM comment_reads cr WHERE cr.comment_id=c.id AND cr.person_key=?)
        GROUP BY root.id
        UNION ALL
        SELECT 'deadlines',p.id,p.id,p.name,i.id,i.number,p.name,d.deadline,d.deadline,'',0,0,
            CASE WHEN d.deadline<? THEN 0 ELSE 5 END
        FROM scope p JOIN project_details d ON d.project_id=p.id JOIN iterations i ON i.project_id=p.id
        WHERE d.deadline<>'' AND d.deadline<=? AND i.number=(SELECT MAX(latest.number) FROM iterations latest WHERE latest.project_id=p.id)
    ) ";
    $counts=array_fill_keys($kinds,0);
    foreach(rows($cte.'SELECT kind,COUNT(*) AS n FROM attention GROUP BY kind',$params) as $row)$counts[$row['kind']]=(int)$row['n'];
    $where=$kind==='all'?'':' WHERE kind=?';$listParams=$params;if($kind!=='all')$listParams[]=$kind;
    $offset=max(0,$offset);
    $items=rows($cte.'SELECT * FROM attention'.$where.' ORDER BY priority,occurred_at,id LIMIT 51 OFFSET '.$offset,$listParams);
    $more=count($items)>50;$items=array_slice($items,0,50);
    foreach($items as &$item){$item['assigned_to_me']=(bool)$item['assigned_to_me'];$item['unread_count']=(int)$item['unread_count'];$item['overdue']=$item['deadline']!==''&&$item['deadline']<$today;}unset($item);
    return ['items'=>$items,'counts'=>$counts,'total'=>array_sum($counts),'has_more'=>$more,'next_offset'=>$offset+count($items),'today'=>$today,'deadline_until'=>$until];
}
