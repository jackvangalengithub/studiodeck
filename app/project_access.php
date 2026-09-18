<?php
declare(strict_types=1);

// This decision describes options; every mutation rechecks them under a write lock.
function billing_project_decision(array $u,string $pid=''): array {
    $sid=$u['studio_id'];$b=billing_studio($sid);$summary=billing_summary($sid);
    $p=$pid?owned_project($pid,$u,false):null;$a=$p?billing_access($pid):null;
    $admin=(bool)one("SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=? AND role='admin'",[$sid,$u['user_id']]);
    $manage=$p?project_member($pid,$u['user_id']):true;
    $sub=$summary['subscription_active'];$used=$summary['usage']['projects'];$limit=$summary['limits']['projects'];
    $consumes=!$p||$p['archived']||$a['source']!=='subscription';
    $full=$sub&&$consumes&&$limit!==null&&$used>=$limit;
    $hasPass=$p&&(bool)one('SELECT 1 FROM project_access_grants WHERE project_id=?',[$pid]);
    $team=$p?rows('SELECT user_id FROM project_members WHERE project_id=?',[$pid]):[];
    $passTeam=count($team)===1&&(!$hasPass||$team[0]['user_id']===$a['designer_id']);
    $validPass=$p&&$a['pass_expires_at']>time()&&$passTeam;
    $reason='ready';
    if(!$p){
        if(($sub&&!$full)||(!$sub&&$summary['trial_active']&&!$b['trial_project_used'])||$summary['available_passes']>0)$reason='ready';
        else $reason=$full?'capacity':($summary['trial_active']?'trial_used':'uncovered');
    }elseif($a['archived'])$reason='archived';
    elseif(!$a['active']){
        $reason=match($a['source']){'trial'=>'trial_expired','project_pass'=>'pass_expired','subscription'=>$b['subscription_status']==='past_due'?'payment_required':'subscription_ended',default=>'uncovered'};
    }elseif($a['source']==='project_pass'&&$a['designer_id']!==$u['user_id'])$reason='named_designer';
    $alternatives=[];
    if($full&&$admin&&$manage)foreach(rows("SELECT p.id,p.name FROM projects p JOIN project_coverage c ON c.project_id=p.id JOIN project_members m ON m.project_id=p.id WHERE p.studio_id=? AND m.user_id=? AND p.archived=0 AND c.source='subscription' AND p.id<>? ORDER BY p.name",[$sid,$u['user_id'],$pid]) as $other)$alternatives[]=$other;
    return ['project'=>$p?['id'=>$pid,'name'=>$p['name']]:null,'access'=>$a,'reason'=>$reason,'admin'=>$admin,'can_manage'=>(bool)$manage,
        'summary'=>$summary,'full'=>$full,'consumes_slot'=>$consumes,'can_use_subscription'=>$sub,'can_use_pass'=>$validPass,
        'can_buy_pass'=>!$p||$passTeam,'has_pass'=>$hasPass,'other_passes'=>(bool)one("SELECT 1 FROM project_coverage WHERE source='project_pass' AND project_id IN (SELECT id FROM projects WHERE studio_id=? AND id<>?)",[$sid,$pid]),
        'archive_candidates'=>$alternatives];
}

function billing_activate_project(array $u,array $input): array {
    return transaction(function()use($u,$input){
        $pid=text_field($input['project_id']??'');$p=owned_project($pid,$u,false);
        if(!project_member($pid,$u['user_id']))fail('Only project team members can reactivate this project.',403);
        $source=text_field($input['source']??billing_access($pid)['source']);
        $archive=text_field($input['archive_project_id']??'');
        if($archive){
            studio_admin($u);if($archive===$pid)fail('Choose a different project to archive.');
            $other=owned_project($archive,$u,false);
            if(!project_member($archive,$u['user_id']))fail('You cannot archive this project.',403);
            if($other['archived']||billing_access($archive)['source']!=='subscription')fail('That project no longer occupies a subscription slot. Review your options again.',409);
            if($source!=='subscription'||(!$p['archived']&&billing_access($pid)['source']==='subscription'))fail('This action does not need another subscription slot.',409);
            query('UPDATE projects SET archived=1 WHERE id=?',[$archive]);
            $i=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$archive]);audit($archive,$i['id'],$u['email'],'project_settings_updated','Archived to free a subscription slot');
        }
        if($source!==billing_access($pid)['source'])billing_set_project_coverage($u,$pid,$source);
        // Idempotent retries must not count the already-active target twice.
        if($p['archived']){
            billing_restore($p);query('UPDATE projects SET archived=0 WHERE id=?',[$pid]);
            $i=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$pid]);audit($pid,$i['id'],$u['email'],'project_settings_updated','Reactivated project');
        }else billing_require_project($pid,$u['user_id']);
        return billing_project_decision($u,$pid);
    });
}
