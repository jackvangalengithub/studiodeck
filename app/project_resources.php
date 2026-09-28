<?php
declare(strict_types=1);

// Read handlers return values: legacy endpoints and /batch share authorization and data helpers.
function project_read_context(array $u, array $params): array {
    $pid=text_field($params['projectId']??'',80);
    $p=owned_project($pid,$u,false);
    $iid=text_field($params['iterationId']??'',80);
    $i=$iid?owned_iteration($iid,$u):one('SELECT * FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$pid]);
    if(!$i||$i['project_id']!==$pid)fail('Presentation not found.',404);
    return [$p,$i];
}

function project_jobs_resource(array $i): array {
    $jobs=rows('SELECT j.id,j.version_id,j.type,j.status,j.error,j.payload,v.name,jd.dismissed_at FROM jobs j LEFT JOIN job_dismissals jd ON jd.job_id=j.id LEFT JOIN file_versions v ON v.id=j.version_id WHERE j.iteration_id=? ORDER BY j.created_at',[$i['id']]);
    foreach($jobs as &$job){$payload=json_decode($job['payload'],true)?:[];if($job['type']==='open_questions')$job['name']='Checklist';if($job['type']==='consistency')$job['name']='Consistency checks';$job['progress']=$payload['progress']??null;if(in_array($job['type'],['slide_image_edit','slide_video'],true))$job['slide_id']=$payload['slide_id']??null;unset($job['payload']);}unset($job);
    return ['jobs'=>$jobs];
}

function project_shell_resource(array $u,array $p,array $i): array {
    $project=array_intersect_key($p,array_flip(['id','name','location','description','created_at','studio_id','visibility','archived']));
    $project=array_merge($project,project_language($p['id']),project_details($p['id']));
    $project['theme']=json_decode($i['theme'],true)?:json_decode($p['theme'],true)?:[];
    $billing=billing_access($p['id']);
    return ['project'=>$project,'iteration'=>$i,'iterations'=>rows('SELECT * FROM iterations WHERE project_id=? ORDER BY number DESC',[$p['id']]),
        'file_count'=>(int)one('SELECT COUNT(*) AS n FROM iteration_files WHERE iteration_id=?',[$i['id']])['n'],
        'billing'=>$billing,'can_edit'=>project_member($p['id'],$u['user_id'])&&$billing['can_edit']&&($billing['source']!=='project_pass'||$billing['designer_id']===$u['user_id']),
        'branding'=>presentation_branding($p['id']),'enhancements'=>project_enhancement_allowance($p['id']),'motion_allowance'=>motion_allowance($p['id'])];
}

function project_slides_resource(array $i): array {
    require_once __DIR__.'/slides.php';
    return ['slides'=>project_slides($i['id']),'files'=>project_files($i['id']),
        'slide_layout'=>rows('SELECT slide_id,hidden,deleted,position FROM slide_layout WHERE iteration_id=?',[$i['id']]),
        'system_slides'=>rows('SELECT id,type FROM system_slides WHERE iteration_id=? ORDER BY rowid',[$i['id']]),
        'slide_groups'=>slide_groups($i['id']),'slide_content'=>rows('SELECT slide_id,title,description FROM slide_content WHERE iteration_id=?',[$i['id']]),
        'slide_sections'=>rows('SELECT slide_id,section FROM slide_sections WHERE iteration_id=?',[$i['id']]),'cover_slide_id'=>project_cover($i['id'])['id']??null,
        ...project_budget_summary($i['id'])];
}

function project_budget_summary(string $iid): array {
    // Only the columns needed by the established rollup; no source text, confirmations or per-row enrichment.
    $items=rows('SELECT b.id,b.parent_id,b.included,b.is_optional,b.amount_cents,b.min_amount_cents,b.max_amount_cents,COALESCE(c.selected,0) AS selected,COALESCE(c.range_percent,0) AS range_percent FROM budget_items b LEFT JOIN budget_choices c ON c.budget_item_id=b.id WHERE b.iteration_id=?',[$iid]);
    return ['total_cents'=>budget_total($items),'budget_min_cents'=>budget_total($items,0),'budget_max_cents'=>budget_total($items,100)];
}

function project_overview_resource(array $p,array $i): array {
    require_once __DIR__.'/slides.php';
    $iid=$i['id'];
    $visible="(s.manual=1 OR f.category!='legal') AND COALESCE(l.hidden,0)=0 AND COALESCE(l.deleted,0)=0";
    $joins="FROM presentation_slides s LEFT JOIN iteration_files f ON f.iteration_id=s.iteration_id AND f.version_id=s.source_version_id LEFT JOIN slide_layout l ON l.iteration_id=s.iteration_id AND l.slide_id='visual-'||s.id";
    $count=(int)one("SELECT COUNT(*) AS n $joins WHERE s.iteration_id=? AND $visible",[$iid])['n'];
    // System slides and document-only sources also belong to the presentation.
    $count+=(int)one("WITH ids(id) AS (SELECT 'intro' UNION ALL SELECT 'changes' UNION ALL SELECT 'budget' UNION ALL SELECT 'open-questions' UNION ALL SELECT 'contacts' UNION ALL SELECT 'summary' UNION ALL SELECT id FROM system_slides WHERE iteration_id=?) SELECT COUNT(*) AS n FROM ids LEFT JOIN slide_layout l ON l.iteration_id=? AND l.slide_id=ids.id WHERE COALESCE(l.hidden,0)=0 AND COALESCE(l.deleted,0)=0",[$iid,$iid])['n'];
    $sources=rows("SELECT f.version_id,p.number FROM iteration_files f LEFT JOIN document_pages p ON p.version_id=f.version_id WHERE f.iteration_id=? AND f.category IN ('drawings','presentation','moodboard') AND NOT EXISTS(SELECT 1 FROM presentation_slides s WHERE s.iteration_id=f.iteration_id AND s.source_version_id=f.version_id AND s.type NOT IN ('text','video')) AND (p.version_id IS NULL OR (p.preview IS NOT NULL AND COALESCE(json_extract(p.metadata,'$.include_in_presentation'),1)=1))",[$iid]);
    foreach($sources as $source){$layout=one('SELECT hidden,deleted FROM slide_layout WHERE iteration_id=? AND slide_id=?',[$iid,'source-'.$source['version_id'].'-'.($source['number']??0)]);if(empty($layout['hidden'])&&empty($layout['deleted']))$count++;}
    $preview=rows("SELECT s.id,s.source_version_id,s.title,s.type,s.page_number,s.image_number,s.image_version_id,v.name,v.mime $joins LEFT JOIN file_versions v ON v.id=s.source_version_id WHERE s.iteration_id=? AND $visible AND s.type IN ('render','photo','moodboard','drawing','floorplan','fullphoto','other') ORDER BY COALESCE(l.position,100000+s.position),s.id LIMIT 4",[$iid]);
    $cover=project_cover($iid);
    $visual=static fn($s)=>$s?['id'=>$s['source_version_id'],'name'=>$s['title'],'slide_id'=>$s['id'],'slide_image_version'=>$s['image_version_id']??'','page_number'=>$s['page_number']??0,'image_number'=>$s['image_number']??0,'has_preview'=>true]:null;
    $fileCount=(int)one('SELECT COUNT(*) AS n FROM iteration_files WHERE iteration_id=?',[$iid])['n'];
    $client=one('SELECT name FROM project_client_members WHERE project_id=? ORDER BY name LIMIT 1',[$p['id']]);
    return ['overview'=>['file_count'=>$fileCount,'slide_count'=>$count,'cover'=>$visual($cover),
        'previews'=>array_map(static fn($s)=>['id'=>'visual-'.$s['id'],'title'=>$s['title'],'visual'=>$visual($s)],$preview),
        'client_count'=>(int)one('SELECT COUNT(*) AS n FROM project_client_members WHERE project_id=?',[$p['id']])['n'],'client_name'=>$client['name']??'',
        'pending_confirmation_count'=>(int)one("SELECT COUNT(*) AS n FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id JOIN iterations i ON i.id=c.iteration_id WHERE i.project_id=? AND r.status='pending'",[$p['id']])['n']],...project_budget_summary($iid)];
}

function project_resource(string $name,array $u,array $p,array $i): array {
    return match($name){
        'shell'=>project_shell_resource($u,$p,$i),
        'jobs'=>project_jobs_resource($i),
        'overview'=>project_overview_resource($p,$i),
        'slides'=>project_slides_resource($i),
        'files'=>project_files_resource($i),
        'budget'=>[...budget_payload($i['id']), 'files'=>rows("SELECT v.id,v.name,v.mime,f.asset_id,f.category FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? AND f.category='budget'",[$i['id']])],
        'people'=>['people'=>project_directory($p['id']),'team'=>project_people($p['id']),'clients'=>project_clients($p['id']),
            'shares'=>rows('SELECT id,email,expires_at,revoked,created_at FROM shares WHERE iteration_id=?',[$i['id']]),
            'members'=>rows('SELECT user_id AS id FROM project_members WHERE project_id=?',[$p['id']]),'contacts'=>rows('SELECT * FROM contacts WHERE project_id=?',[$p['id']])],
        'communication'=>project_communication_resource($i),
        'presentation'=>deck_payload($i,true),
        default=>throw new RuntimeException('Unknown project resource.',404),
    };
}

function project_communication_resource(array $i): array {
    $communication=project_communication_payload($i,true);
    return ['communication'=>$communication,'comments'=>array_values(array_filter($communication['comments'],fn($c)=>$c['iteration_id']===$i['id'])),
        'open_questions'=>array_values(array_filter($communication['items'],fn($q)=>$q['iteration_id']===$i['id']||$q['thread_id'])),
        'checks'=>consistency_payload($i['id'])];
}

function project_files_resource(array $i): array {
    require_once __DIR__.'/slides.php';
    return ['files'=>project_files($i['id']),'slides'=>project_slides($i['id'])];
}
