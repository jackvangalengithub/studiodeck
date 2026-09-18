<?php
// No AI calls. Model responses are injected so matching, validation and races are reproducible.
$path=sys_get_temp_dir().'/studiodeck-subquotes-'.bin2hex(random_bytes(6)).'.sqlite';putenv('DATABASE_PATH='.$path);putenv('OPENAI_API_KEY=');
require __DIR__.'/../app/ingest.php';require __DIR__.'/../app/ai.php';
function check($ok,$message){if(!$ok)throw new RuntimeException($message);echo "PASS $message\n";}
function source($name,$text,$items,$asset=null){
    $vid=id();$asset??=id();if(!one('SELECT id FROM assets WHERE id=?',[$asset]))insert('assets',['id'=>$asset,'project_id'=>'p','category'=>'budget','created_at'=>now()]);
    insert('file_versions',['id'=>$vid,'asset_id'=>$asset,'number'=>(int)(one('SELECT MAX(number) AS n FROM file_versions WHERE asset_id=?',[$asset])['n']??0)+1,'name'=>$name,'mime'=>'text/csv','size'=>1,'sha256'=>'test','data'=>'test','extracted_text'=>$text,'created_at'=>now()]);
    query("INSERT INTO iteration_files(iteration_id,asset_id,version_id,category) VALUES('i',?,?,'budget') ON CONFLICT(iteration_id,asset_id) DO UPDATE SET version_id=excluded.version_id",[$asset,$vid]);
    transaction(fn()=>replace_source_budget('i',$vid,$items));return $vid;
}
function item($key,$label,$vendor,$amount,$note='',$parent='',$included=false){return compact('key','label','vendor','note','parent','included')+['amount_cents'=>$amount,'kind'=>'quote'];}
function row($key){return one("SELECT * FROM budget_items WHERE iteration_id='i' AND source_key=?",[$key]);}
function proposed_link($child,$parent,$child_excerpt,$parent_excerpt,$confidence='high',$inclusion='included'){return ['child_id'=>$child,'parent_id'=>$parent,...compact('child_excerpt','parent_excerpt','confidence','inclusion')];}
function match_links($links,$during=null){return reconcile_subquotes('i',function($prompt,$content)use($links,$during){if($during)$during();return ['links'=>$links];});}
try{
 insert('users',['id'=>'u','email'=>'test@example.test','name'=>'Tester','created_at'=>now()]);insert('projects',['id'=>'p','user_id'=>'u','name'=>'Quotes','created_at'=>now()]);insert('iterations',['id'=>'i','project_id'=>'p','number'=>1,'title'=>'Draft','created_at'=>now()]);
 $parentText='Main contract includes the Greenworks garden quote GW-2026-014 in the total.';$childText='Greenworks garden quote GW-2026-014: planting and paving.';
 $parent=source('main.csv',$parentText,[item('main','Main contract','BuildCo',5000000,$parentText)]);
 $child=source('garden.csv',$childText,[item('garden','Garden works','Greenworks',800000,$childText)]);
 $links=[proposed_link(row('garden')['id'],row('main')['id'],$childText,$parentText)];
 $r=match_links($links);check($r['linked']===1&&row('garden')['included']===1,'A later subcontractor quote links automatically from explicit evidence');
 check(budget_total(budget_rows('i'))===5000000,'Included subquote is not added twice');
 check(str_contains(row('garden')['relationship_evidence'],'main.csv'),'Automatic link stores named source evidence');
 check(match_links($links)['linked']===0,'Repeating detection is idempotent');
 // A parent arriving later must be eligible as well.
 $earlyText='StoneCo stone quote SC-1044 for the terrace.';$lateText='Landscape contract includes StoneCo quote SC-1044.';
 source('stone.csv',$earlyText,[item('stone','Stone terrace','StoneCo',250000,$earlyText)]);
 source('landscape.csv',$lateText,[item('landscape','Landscaping','GardenCo',1500000,$lateText)]);
 check(match_links([proposed_link(row('stone')['id'],row('landscape')['id'],$earlyText,$lateText)])['linked']===1,'Parent uploaded later links existing subquotes');
 // Similarity and unknown inclusion stay as suggestions; totals do not change.
 source('irrigation.csv','WaterCo irrigation system for the garden.',[item('water','Irrigation','WaterCo',100000,'WaterCo irrigation system for the garden.')]);
 $uncertain=proposed_link(row('water')['id'],row('landscape')['id'],'WaterCo irrigation system for the garden.',$lateText,'medium','unknown');$total=budget_total(budget_rows('i'));
 check(match_links([$uncertain])['suggested']===1&&row('water')['parent_id']===null&&budget_total(budget_rows('i'))===$total,'Ambiguous inclusion leaves the budget unchanged');
 query("UPDATE budget_link_suggestions SET status='dismissed' WHERE child_id=?",[row('water')['id']]);check(match_links([$uncertain])['suggested']===0,'Dismissed suggestions stay dismissed on later checks');
 // Fabricated IDs, evidence and same-document links cannot be applied.
 $bad=[...$uncertain,'parent_id'=>'foreign-project-id'];check(match_links([$bad])['linked']===0,'Invented or foreign item IDs are rejected');
 $bad=[...$uncertain,'parent_excerpt'=>'This sentence is not in the uploaded source.'];check(match_links([$bad])['suggested']===0,'Invented evidence is rejected');
 source('combined.csv','Combined source describes both the frame and glass.',[item('frame','Window frame','GlassCo',200000),item('glass','Glass','GlassCo',100000)]);
 check(match_links([proposed_link(row('glass')['id'],row('frame')['id'],'Combined source describes both the frame and glass.','Combined source describes both the frame and glass.')])['linked']===0,'Existing within-document hierarchy is not guessed again');
 // Model confidence cannot override conflicting alternatives.
 source('alternate.csv','Another contract includes WaterCo irrigation system.',[item('alternate','Another contract','OtherCo',400000,'Another contract includes WaterCo irrigation system.')]);
 query("DELETE FROM budget_link_suggestions WHERE child_id=?",[row('water')['id']]);
 $a=proposed_link(row('water')['id'],row('alternate')['id'],'WaterCo irrigation system for the garden.','Another contract includes WaterCo irrigation system.');
 check(match_links([$a,[...$a,'parent_id'=>row('landscape')['id'],'parent_excerpt'=>$lateText]])['linked']===0,'Competing parents require review even with high confidence');
 // Human choices and changes made while AI is running are authoritative.
 query("UPDATE budget_items SET relationship_locked=1,relationship_origin='manual' WHERE source_key='water'");check(match_links([$a])['linked']===0,'Manual keep-separate decision cannot be overwritten');
 query("UPDATE budget_items SET relationship_locked=0 WHERE source_key='water'");
 check(match_links([$a],fn()=>query("UPDATE budget_items SET note='Designer revised the scope' WHERE source_key='water'"))['status']==='changed','Concurrent budget edits invalidate stale model results');
 check(row('water')['parent_id']===null,'Stale results do not mutate costs');
 $before=one("SELECT COUNT(*) n FROM budget_link_suggestions")['n'];
 check(match_links([$a],fn()=>query("UPDATE iterations SET locked=1 WHERE id='i'"))['status']==='preserved','Locking while detection runs preserves the shared snapshot');
 check(one("SELECT COUNT(*) n FROM budget_link_suggestions")['n']===$before,'No proposals are written into a newly locked snapshot');query("UPDATE iterations SET locked=0 WHERE id='i'");
 // Manual links and decisions survive source revisions using stable source keys.
 $gardenId=row('garden')['id'];$mainId=row('main')['id'];query("UPDATE budget_items SET relationship_locked=1,relationship_origin='manual' WHERE id=?",[$gardenId]);
 $mainAsset=one('SELECT asset_id FROM file_versions WHERE id=?',[$parent])['asset_id'];
 $parent2=source('main-revised.csv',$parentText,[item('main','Revised main contract','BuildCo',5200000,$parentText)],$mainAsset);
 check(row('main')['id']===$mainId&&row('garden')['parent_id']===$mainId,'Replacing a parent source preserves manual cross-file links');
 $childAsset=one('SELECT asset_id FROM file_versions WHERE id=?',[$child])['asset_id'];source('garden-revised.csv',$childText,[item('garden','Garden revised','Greenworks',850000,$childText)],$childAsset);
 check(row('garden')['id']===$gardenId&&row('garden')['relationship_locked']===1&&row('garden')['parent_id']===$mainId,'Replacing a child source preserves manually confirmed relationships');
 source('main-without-cost.csv','The line was removed.',[],$mainAsset);
 check(row('garden')['parent_id']===null&&row('garden')['included']===0,'Removing a parent does not leave an orphan excluded from totals');
 // Automatic links reset on parent revision and are rediscovered with fresh evidence.
 $landId=row('landscape')['id'];$landAsset=one('SELECT asset_id FROM file_versions WHERE id=?',[row('landscape')['source_version_id']])['asset_id'];
 source('landscape-revised.csv',$lateText,[item('landscape','Landscaping revised','GardenCo',1600000,$lateText)],$landAsset);
 check(row('landscape')['id']===$landId&&row('stone')['parent_id']===null&&row('stone')['included']===0,'Replacing an automatic parent triggers a fresh relationship check');
 check(match_links([proposed_link(row('stone')['id'],$landId,$earlyText,$lateText)])['linked']===1,'Automatic links are rediscovered after source replacement');
 // Cycle protection applies to both imports and cross-file matching.
 check(subquote_would_cycle(rows('SELECT id,parent_id FROM budget_items'),$landId,row('stone')['id']),'Nested links cannot create cycles');
 $before=count(rows('SELECT * FROM budget_items'));
 try{transaction(fn()=>replace_source_budget('i',row('stone')['source_version_id'],[item('x','X','',1,'','y'),item('y','Y','',1,'','x')]));throw new RuntimeException('Expected cycle rejection');}catch(RuntimeException $e){check(str_contains($e->getMessage(),'Circular'),'Circular import rejected');}
 check(count(rows('SELECT * FROM budget_items'))===$before,'Rejected source replacement rolls back without losing costs');
 check_uploaded_subquotes('i',$parent2);$meta=json_decode(one('SELECT metadata FROM file_versions WHERE id=?',[$parent2])['metadata'],true);check($meta['subquote_matching']['status']==='unavailable','Missing AI is a visible matching status, not a failed import');
 check(!rows('PRAGMA foreign_key_check'),'No foreign-key errors after imports, replacements and matches');
 // Automatic inclusion must not be inferred from tax wording or contradiction.
 check(!subquote_explicit(['parent_excerpt'=>'Greenworks amount includes VAT.','child_excerpt'=>$childText,'included'=>1],row('garden')),'Tax inclusion is not evidence of subquote inclusion');
 check(!subquote_explicit(['parent_excerpt'=>'Greenworks quote is not included.','child_excerpt'=>$childText,'included'=>1],row('garden')),'Negative wording prevents an automatic included link');
 $snap=subquote_snapshot('i');$context=subquote_context($snap);$proposal=proposed_link(row('water')['id'],row('alternate')['id'],'WaterCo irrigation system for the garden.','Another contract includes WaterCo irrigation system.');
 foreach($snap['items'] as &$cost)if($cost['id']===$proposal['parent_id'])$cost['amount_cents']=null;unset($cost);
 $valid=valid_subquote_links(['links'=>[$proposal]],$snap,$context);check(count($valid)===1&&!$valid[0]['automatic'],'Known subquote is not automatically swallowed by an unpriced parent');
 foreach($snap['items'] as &$cost)if($cost['id']===$proposal['parent_id'])$cost['amount_cents']=1;unset($cost);
 $valid=valid_subquote_links(['links'=>[$proposal]],$snap,$context);check(count($valid)===1&&!$valid[0]['automatic'],'Contradictory parent and child amounts require review');
}finally{foreach([$path,$path.'-wal',$path.'-shm'] as $file)if(is_file($file))unlink($file);}
