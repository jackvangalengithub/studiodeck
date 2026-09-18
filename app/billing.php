<?php
declare(strict_types=1);

const BILLING_DAY = 86400;
class ProjectAccessRequired extends RuntimeException {
    public function __construct(public readonly string $projectId,string $message,int $status=402){parent::__construct($message,$status);}
}
function billing_catalog(): array {
    $plans=[
        'pass'=>['name'=>'Project Pass','cents'=>1900,'days'=>150,'seats'=>1,'projects'=>1],
        'extension'=>['name'=>'Pass extension','cents'=>1500,'days'=>150,'seats'=>1,'projects'=>1],
        'solo'=>['name'=>'Solo','cents'=>3900,'seats'=>1,'projects'=>3],
        'studio'=>['name'=>'Studio','cents'=>19900,'seats'=>5,'projects'=>15],
        'practice'=>['name'=>'Practice','cents'=>39900,'seats'=>15,'projects'=>50],
        'extra_project'=>['name'=>'Extra active project','cents'=>1000],
        'extra_seat'=>['name'=>'Extra Practice designer','cents'=>2000],
    ];
    foreach($plans as $key=>&$plan)$plan['price_id']=env('STRIPE_PRICE_'.strtoupper($key));unset($plan);
    return $plans;
}
function migrate_billing(PDO $db): void {
    $db->exec(file_get_contents(__DIR__.'/billing_schema.sql'));
    // CREATE TABLE IF NOT EXISTS does not upgrade an existing billing table.
    if(!$db->query("SELECT 1 FROM migrations WHERE name='billing-customer-parameters-v1'")->fetchColumn()){
        $db->exec('BEGIN IMMEDIATE');
        try{
            if(!in_array('customer_parameters',array_column($db->query('PRAGMA table_info(studio_billing)')->fetchAll(PDO::FETCH_ASSOC),'name'),true))$db->exec('ALTER TABLE studio_billing ADD COLUMN customer_parameters TEXT');
            $db->exec("INSERT OR IGNORE INTO migrations(name) VALUES('billing-customer-parameters-v1')");
            $db->exec('COMMIT');
        }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
    }
    if($db->query("SELECT 1 FROM migrations WHERE name='billing-v1'")->fetchColumn())return;
    $db->exec('BEGIN IMMEDIATE');
    try {
        if(!$db->query("SELECT 1 FROM migrations WHERE name='billing-v1'")->fetchColumn()){
            $db->exec('INSERT OR IGNORE INTO studio_billing(studio_id,legacy_exempt,onboarded_at) SELECT id,1,strftime(\'%s\',\'now\') FROM studios');
            $db->exec("INSERT OR IGNORE INTO project_coverage(project_id,source) SELECT id,'legacy' FROM projects");
            $db->exec("INSERT INTO migrations(name) VALUES('billing-v1')");
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function billing_studio(string $sid): array {
    return one('SELECT * FROM studio_billing WHERE studio_id=?',[$sid])??['studio_id'=>$sid,'legacy_exempt'=>0,'onboarded_at'=>null,'trial_ends_at'=>null,'plan'=>null,'subscription_status'=>'none','paid_until'=>0,'extra_projects'=>0,'extra_seats'=>0,'cancel_at_period_end'=>0,'customer_id'=>null,'subscription_id'=>null];
}
function billing_subscription_active(array $b,?int $at=null): bool {
    $at??=time();
    if(!in_array($b['plan'],['solo','studio','practice'],true))return false;
    if(in_array($b['subscription_status'],['active','past_due','canceled'],true)&&(int)$b['paid_until']>$at)return true;
    return $b['subscription_status']==='past_due' && !(int)$b['cancel_at_period_end'] && (int)$b['paid_until']>0 && (int)$b['paid_until']+3*BILLING_DAY>$at;
}
function billing_pass_expiry(string $pid): int {
    $end=0;
    foreach(rows('SELECT * FROM project_access_grants WHERE project_id=? AND revoked=0 ORDER BY paid_at,order_id',[$pid]) as $g)$end=max($end,(int)$g['paid_at'])+(int)$g['days']*BILLING_DAY;
    return $end;
}
function billing_access(string $pid,?int $at=null): array {
    $at??=time();$p=one('SELECT * FROM projects WHERE id=?',[$pid]);if(!$p)fail('Project not found.',404);
    $b=billing_studio($p['studio_id']);$c=one('SELECT * FROM project_coverage WHERE project_id=?',[$pid])??['source'=>'none','designer_id'=>null,'restricted_at'=>null,'retention_notified_at'=>null];
    $source=$c['source'];$end=0;$valid=false;
    if($source==='legacy')$valid=(bool)$b['legacy_exempt'];
    if($source==='trial'){$end=(int)$b['trial_ends_at'];$valid=$end>$at;}
    if($source==='project_pass'){$end=billing_pass_expiry($pid);$valid=$end>$at;}
    if($source==='subscription'){$valid=billing_subscription_active($b,$at);$end=(int)$b['paid_until']+($b['subscription_status']==='past_due'&&!$b['cancel_at_period_end']?3*BILLING_DAY:0);}
    $archived=(bool)$p['archived'];
    $restricted=$valid?null:($c['restricted_at']?:(($end>0&&$end<=$at)?$end:$at));
    // Cleanup is staged: no deletion before both 90 days of restriction and 90 days' actual notice.
    $deleteAt=$restricted&&$c['retention_notified_at']?max((int)$restricted,(int)$c['retention_notified_at'])+90*BILLING_DAY:null;
    return ['source'=>$source,'active'=>$valid,'can_edit'=>$valid&&!$archived,'archived'=>$archived,'expires_at'=>$end?:null,'designer_id'=>$c['designer_id'],'restricted_at'=>$restricted,'delete_after'=>$deleteAt,'pass_expires_at'=>billing_pass_expiry($pid)?:null];
}
function billing_require_project(string $pid,?string $uid=null,bool $client=false,bool $write=true): void {
    $a=billing_access($pid);
    if($client&&!$a['active'])fail('This presentation is temporarily unavailable. Please contact the studio.',403);
    if($client&&$a['archived']&&($write||$a['source']!=='subscription'))fail('This presentation is temporarily unavailable. Please contact the studio.',403);
    if($write&&!$a['active'])throw new ProjectAccessRequired($pid,'This project is read-only. Renew access to continue.');
    if($write&&$a['archived'])throw new ProjectAccessRequired($pid,'Restore this archived project before making changes.',409);
    if($write&&$uid&&$a['source']==='project_pass'&&$a['designer_id']!==$uid)throw new ProjectAccessRequired($pid,'This pass covers one named designer. Move the project to a subscription for team collaboration.',403);
}
function billing_limits(array $b): array {
    if(billing_subscription_active($b)){
        $p=billing_catalog()[$b['plan']];return billing_future_limits($b['studio_id'],['seats'=>$p['seats']+($b['plan']==='practice'?(int)$b['extra_seats']:0),'projects'=>$p['projects']+(int)$b['extra_projects']]);
    }
    if($b['legacy_exempt'])return billing_future_limits($b['studio_id'],['seats'=>null,'projects'=>null]);
    return ['seats'=>1,'projects'=>1];
}
function billing_usage(string $sid): array {
    return ['seats'=>(int)one('SELECT COUNT(*) n FROM studio_members WHERE studio_id=?',[$sid])['n'],
        'projects'=>(int)one("SELECT COUNT(*) n FROM projects p JOIN project_coverage c ON c.project_id=p.id WHERE p.studio_id=? AND p.archived=0 AND c.source='subscription'",[$sid])['n'],
        'passes'=>(int)one("SELECT COUNT(*) n FROM projects p JOIN project_coverage c ON c.project_id=p.id WHERE p.studio_id=? AND c.source='project_pass'",[$sid])['n']];
}
function billing_summary(string $sid): array {
    $b=billing_studio($sid);$active=billing_subscription_active($b);$trial=(int)$b['trial_ends_at']>time();
    return ['needs_onboarding'=>!$b['onboarded_at']&&!$b['legacy_exempt'],'legacy_exempt'=>(bool)$b['legacy_exempt'],
        'package'=>$b['legacy_exempt']?'Existing studio':($active?billing_catalog()[$b['plan']]['name']:($trial?'7-day trial':'Project passes / read-only')),
        'trial_ends_at'=>$b['trial_ends_at'],'trial_active'=>$trial,'subscription_active'=>$active,
        'plan'=>$b['plan'],'status'=>$b['subscription_status'],'paid_until'=>(int)$b['paid_until'],
        'cancel_at_period_end'=>(bool)$b['cancel_at_period_end'],'limits'=>billing_limits($b),'usage'=>billing_usage($sid),'available_passes'=>billing_available_passes($sid)];
}
function billing_available_passes(string $sid): int {
    return (int)one("SELECT COUNT(*) n FROM billing_orders WHERE studio_id=? AND kind='pass' AND status='paid' AND project_id IS NULL",[$sid])['n'];
}
// Called inside project creation's transaction. Allocation and project creation commit together.
function billing_redeem_pass(array $u,string $pid): void {
    $o=one("SELECT * FROM billing_orders WHERE studio_id=? AND kind='pass' AND status='paid' AND project_id IS NULL ORDER BY paid_at,id LIMIT 1",[$u['studio_id']]);
    if(!$o)fail('Buy a Project Pass before creating this project.',402);
    $claim=query("UPDATE billing_orders SET project_id=? WHERE id=? AND project_id IS NULL AND status='paid'",[$pid,$o['id']]);
    if($claim->rowCount()!==1)fail('This Project Pass has already been used. Refresh Billing.',409);
    insert('project_access_grants',['order_id'=>$o['id'],'project_id'=>$pid,'paid_at'=>time(),'days'=>150]);
    query("UPDATE project_coverage SET designer_id=? WHERE project_id=? AND source='project_pass'",[$u['user_id'],$pid]);
}
function billing_onboard(array $u,array $input): void {
    studio_admin($u);$name=text_field($input['name']??'',100);$studio=text_field($input['studio_name']??'',100);
    if(!$name||!$studio)fail('Enter your name and studio name.');
    transaction(function()use($u,$name,$studio){
        $b=billing_studio($u['studio_id']);if($b['onboarded_at']||$b['legacy_exempt'])return;
        $eligible=!one('SELECT 1 FROM billing_trials WHERE user_id=?',[$u['user_id']]);$at=time();
        if($eligible)insert('billing_trials',['user_id'=>$u['user_id'],'studio_id'=>$u['studio_id'],'started_at'=>$at]);
        query('UPDATE studio_billing SET onboarded_at=?,trial_started_at=?,trial_ends_at=? WHERE studio_id=?',[$at,$eligible?$at:null,$eligible?$at+7*BILLING_DAY:null,$u['studio_id']]);
        query('UPDATE studios SET name=? WHERE id=?',[$studio,$u['studio_id']]);
        query('UPDATE users SET name=? WHERE id=?',[$name,$u['user_id']]);
        query('UPDATE studio_members SET display_name=? WHERE studio_id=? AND user_id=?',[$name,$u['studio_id'],$u['user_id']]);
    });
}
// Called inside the same transaction as project creation / restoration.
function billing_new_project(array $u,string $intent='',string $archive=''): string {
    $sid=$u['studio_id'];$b=billing_studio($sid);
    if(!in_array($intent,['','pass'],true))fail('Choose valid project access.');
    if(!$b['onboarded_at']&&!$b['legacy_exempt'])fail('Complete your studio setup before creating a project.',402);
    $passes=billing_available_passes($sid);
    if($intent==='pass'){
        if($archive)fail('A Project Pass does not require archiving another project.',409);
        if(!$passes)fail('Buy a Project Pass before creating this project.',402);
        return 'project_pass';
    }
    if($archive){
        studio_admin($u);$other=owned_project($archive,$u,false);
        if(!project_member($archive,$u['user_id']))fail('You cannot archive this project.',403);
        if($intent==='pass'||!billing_subscription_active($b)||$other['archived']||billing_access($archive)['source']!=='subscription')fail('That project no longer frees a subscription slot. Review your options again.',409);
        query('UPDATE projects SET archived=1 WHERE id=?',[$archive]);
        $i=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$archive]);audit($archive,$i['id'],$u['email'],'project_settings_updated','Archived to create a subscription project');
    }
    if(one("SELECT 1 FROM billing_orders WHERE studio_id=? AND kind='subscription' AND status='pending'",[$sid])){
        if($passes&&!$archive)return 'project_pass';
        fail('Finish or cancel the pending subscription checkout before adding projects.',409);
    }
    if(billing_subscription_active($b)){
        if(billing_usage($sid)['projects']<billing_limits($b)['projects'])return 'subscription';
        if(!$passes)fail('Your subscription has no free project slots. Archive a project, buy a Project Pass or add capacity in Billing.',402);
    }
    if(!billing_subscription_active($b)&&(int)$b['trial_ends_at']>time()&&!($b['trial_project_used']??0)){query('UPDATE studio_billing SET trial_project_used=1 WHERE studio_id=?',[$sid]);return 'trial';}
    if($passes)return 'project_pass';
    fail('Buy a Project Pass or choose a subscription in Billing before creating a project.',402);
}
function billing_check_seat(string $sid): void {
    $limit=billing_limits(billing_studio($sid))['seats'];if($limit!==null&&billing_usage($sid)['seats']>=$limit)fail('Your designer allowance is full. Change your package in Billing before adding a studio user.',402);
}
function billing_check_team(string $pid,array $ids): void {
    $a=billing_access($pid);if($a['source']==='project_pass'&&(count($ids)!==1||$ids[0]!==$a['designer_id']))fail('A Project Pass covers its named designer only. Move this project to your subscription to add a team.',402);
}
function billing_restore(array $p): void {
    if(one("SELECT 1 FROM billing_orders WHERE studio_id=? AND kind='subscription' AND status='pending'",[$p['studio_id']]))fail('Finish or cancel the pending subscription checkout before restoring projects.',409);
    $a=billing_access($p['id']);if(!$p['archived'])return;if(!$a['active'])fail('Renew project access in Billing before restoring it.',402);
    if($a['source']==='subscription'){
        $b=billing_studio($p['studio_id']);if(billing_usage($p['studio_id'])['projects']>=billing_limits($b)['projects'])fail('No free subscription project slots. Archive a project or add capacity in Billing.',402);
    }
}
function billing_switch_project(array $u,string $pid,string $source): void {
    transaction(fn()=>billing_set_project_coverage($u,$pid,$source));
}
// Caller owns the transaction, including any explicitly selected archive/restore.
function billing_set_project_coverage(array $u,string $pid,string $source): void {
    studio_admin($u);
    $p=one('SELECT * FROM projects WHERE id=? AND studio_id=?',[$pid,$u['studio_id']]);if(!$p)fail('Project not found.',404);
    $c=one('SELECT * FROM project_coverage WHERE project_id=?',[$pid]);if($c&&$c['source']===$source)return;
    if(one("SELECT 1 FROM billing_orders WHERE project_id=? AND status='pending'",[$pid]))fail('Finish or cancel this project’s checkout first.',409);
    if($source==='subscription'){
        $b=billing_studio($u['studio_id']);if(!billing_subscription_active($b))fail('An active subscription is required.',402);
        if(!$p['archived']&&billing_usage($u['studio_id'])['projects']>=billing_limits($b)['projects'])fail('Your subscription has no free project slots.',402);
    }elseif($source==='project_pass'){
        if(billing_pass_expiry($pid)<=time())fail('Buy or extend this project’s pass first.',402);
        if(!$c['designer_id']||!one('SELECT 1 FROM project_members WHERE project_id=? AND user_id=?',[$pid,$c['designer_id']])||(int)one('SELECT COUNT(*) n FROM project_members WHERE project_id=?',[$pid])['n']!==1)fail('Keep only the pass’s named designer on this project before changing coverage.',409);
    }else fail('Choose pass or subscription coverage.');
    query('UPDATE project_coverage SET source=?,restricted_at=NULL,retention_notified_at=NULL WHERE project_id=?',[$source,$pid]);
    $i=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$pid]);audit($pid,$i['id'],$u['email'],'billing_coverage_changed','Coverage changed to '.$source);
}
function billing_reserve_usage(string $pid,string $kind,int $amount=1): void {
    $a=billing_access($pid);billing_require_project($pid);if($a['source']!=='trial')return;
    $limit=['upload_bytes'=>250*1024*1024,'uploads'=>30,'questions'=>30,'reprocess'=>10][$kind]??30;
    query("INSERT INTO billing_usage(project_id,kind,window,used) VALUES(?,?,'trial',0) ON CONFLICT DO NOTHING",[$pid,$kind]);
    $q=query("UPDATE billing_usage SET used=used+? WHERE project_id=? AND kind=? AND window='trial' AND used+?<=CAST(? AS INTEGER)",[$amount,$pid,$kind,$amount,$limit]);
    if(!$q->rowCount())fail('Your trial allowance for this activity is used. Choose a package in Billing to continue.',402);
}
function billing_trial_storage(string $sid,int $additional): void {
    $b=billing_studio($sid);
    if($b['legacy_exempt']||billing_subscription_active($b))return;
    foreach(rows('SELECT id FROM projects WHERE studio_id=?',[$sid]) as $p)if(billing_pass_expiry($p['id'])>time())return;
    if((int)$b['trial_ends_at']<=time())fail('Choose a package in Billing before adding studio files.',402);
    $files=(int)one('SELECT COALESCE(SUM(v.size),0) n FROM file_versions v JOIN assets a ON a.id=v.asset_id JOIN projects p ON p.id=a.project_id WHERE p.studio_id=?',[$sid])['n'];
    $library=(int)one('SELECT COALESCE(SUM(length(v.data)),0) n FROM studio_pack_versions v JOIN studio_pack_items i ON i.id=v.item_id WHERE i.studio_id=?',[$sid])['n'];
    if($files+$library+$additional>250*1024*1024)fail('Your trial includes 250 MB of files. Choose a package in Billing for more storage.',402);
}
