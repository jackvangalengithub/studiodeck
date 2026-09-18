<?php
declare(strict_types=1);

const PROJECT_ENHANCEMENT_LIMIT = 10;

// Plans are assigned by the server, never by a project member's request payload.
function project_enhancement_allowance(string $pid, ?DateTimeImmutable $at = null): array {
    $at=($at??new DateTimeImmutable('now',new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('UTC'));
    $coverage=billing_access($pid);
    $plan=$coverage['source']==='legacy'?(one('SELECT plan_type FROM project_enhancement_plans WHERE project_id=?',[$pid])['plan_type']??'monthly'):($coverage['source']==='subscription'?'monthly':($coverage['source']==='trial'?'trial':'project_pass'));
    $limit=$plan==='trial'?3:PROJECT_ENHANCEMENT_LIMIT;
    $start=$plan==='monthly'?$at->modify('first day of this month')->setTime(0,0)->format('Y-m-d\TH:i:s\Z'):null;
    $reset=$plan==='monthly'?$at->modify('first day of next month')->setTime(0,0)->format('Y-m-d\TH:i:s\Z'):null;
    $params=[$pid];$window='';
    if($start){$window=' AND created_at>=? AND created_at<?';$params[]=$start;$params[]=$reset;}
    $counts=one("SELECT COUNT(*) AS used,COALESCE(SUM(CASE WHEN status IN ('queued','running') THEN 1 ELSE 0 END),0) AS reserved FROM jobs WHERE project_id=? AND type IN ('image_edit','slide_image_edit') AND status IN ('queued','running','done')".$window,$params);
    return ['plan_type'=>$plan,'limit'=>$limit,'used'=>(int)$counts['used'],'reserved'=>(int)$counts['reserved'],'remaining'=>max(0,$limit-(int)$counts['used']),'resets_at'=>$reset];
}

// Call inside the same BEGIN IMMEDIATE transaction that inserts the queued job.
function require_project_enhancement(string $pid): void {
    billing_require_project($pid);
    $allowance=project_enhancement_allowance($pid);
    if($allowance['plan_type']==='trial'&&$allowance['remaining']<=0)fail('Your trial includes 3 image enhancements. Choose a package in Billing to continue.',402);
    if($allowance['remaining']>0)return;
    fail($allowance['plan_type']==='project_pass'
        ?'This project has used its 10 included AI enhancements. Your original and saved enhancements remain available.'
        :'This project has used its 10 AI enhancements for this month. The allowance resets on '.substr($allowance['resets_at'],0,10).' (UTC). Your saved images remain available.',429);
}

function enhancement_prompt_summary(string $prompt): string {
    $text=trim(preg_replace('/\s+/u',' ',$prompt)??$prompt);
    // The opening instruction carries the edit intent; avoid an extra paid AI call.
    $sentence=preg_split('/(?<=[.!?])\s+/u',$text,2)[0]??$text;
    $chars=preg_split('//u',$sentence,-1,PREG_SPLIT_NO_EMPTY)?:[];
    return count($chars)>88?rtrim(implode('',array_slice($chars,0,85))).'…':($sentence?:'AI enhancement');
}

// Per-iteration membership preserves shared snapshots, including when a designer
// picks an older variant and later generates another branch from the original.
function slide_image_variants(array $slide): array {
    if(empty($slide['source_version_id']))return [];
    $versions=[];
    if(!empty($slide['iteration_id'])&&!empty($slide['id'])){
        foreach(rows('SELECT v.id,v.parent_id,v.source_version_id,v.metadata,v.created_at,v.rowid AS sequence FROM slide_image_history h JOIN slide_image_versions v ON v.id=h.image_version_id WHERE h.iteration_id=? AND h.slide_id=? AND v.source_version_id=? AND h.page_number=? AND h.image_number=?',[$slide['iteration_id'],$slide['id'],$slide['source_version_id'],$slide['page_number'],$slide['image_number']]) as $v)$versions[$v['id']]=$v;
    }
    // Older installations kept ancestry only. Include it without rewriting images.
    $vid=$slide['image_version_id']??null;$seen=[];
    while($vid&&!isset($seen[$vid])){
        $seen[$vid]=true;
        $v=one('SELECT id,parent_id,source_version_id,metadata,created_at,rowid AS sequence FROM slide_image_versions WHERE id=? AND source_version_id=?',[$vid,$slide['source_version_id']]);
        if(!$v)break;
        $versions[$vid]=$v;$vid=$v['parent_id'];
    }
    $versions=array_values($versions);
    usort($versions,fn($a,$b)=>strcmp($b['created_at'],$a['created_at'])?:($b['sequence']<=>$a['sequence']));
    return array_map(function($v){$meta=json_decode($v['metadata'],true)?:[];return ['id'=>$v['id'],'summary'=>enhancement_prompt_summary($meta['prompt']??''),'created_at'=>$v['created_at']];},$versions);
}

function remember_slide_image(array $slide,string $vid): void {
    query('INSERT OR IGNORE INTO slide_image_history(iteration_id,slide_id,image_version_id,page_number,image_number) VALUES(?,?,?,?,?)',[$slide['iteration_id'],$slide['id'],$vid,$slide['page_number'],$slide['image_number']]);
}

function copy_slide_image_history(array $source,array $target): void {
    foreach(slide_image_variants($source) as $v)remember_slide_image($target,$v['id']);
}

function slide_variant_image(array $slide,string $vid): array {
    if(!in_array($vid,array_column(slide_image_variants($slide),'id'),true))fail('Image variation not found in this presentation.',404);
    $image=one('SELECT data,mime FROM slide_image_versions WHERE id=?',[$vid]);
    if(!$image)fail('Image variation not found.',404);
    return $image;
}
