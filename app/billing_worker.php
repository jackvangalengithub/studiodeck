<?php
declare(strict_types=1);
function billing_reconcile_studio(string $sid): void {
    $b=billing_studio($sid);
    $website=one('SELECT subscription_id FROM websites WHERE studio_id=?',[$sid]);
    if(!empty($website['subscription_id'])&&$website['subscription_id']!==$b['subscription_id'])website_sync_subscription(stripe_request('GET','subscriptions/'.rawurlencode($website['subscription_id']),['expand'=>['latest_invoice']]));
    if($b['subscription_id'])billing_sync_subscription(stripe_request('GET','subscriptions/'.rawurlencode($b['subscription_id']),['expand'=>['latest_invoice']]));
    foreach(rows("SELECT * FROM billing_orders WHERE studio_id=? AND status='pending'",[$sid]) as $o){
        if(!$o['checkout_id'])continue;
        $s=stripe_request('GET','checkout/sessions/'.rawurlencode($o['checkout_id']));
        if(($s['payment_status']??'')==='paid')billing_fulfill_checkout($s);
        elseif(($s['status']??'')==='expired')query("UPDATE billing_orders SET status='expired' WHERE id=? AND status='pending'",[$o['id']]);
    }
    billing_reconcile_changes($sid);
}
function billing_reconcile_changes(string $sid): void {
    $b=billing_studio($sid);$sub=json_decode($b['subscription_json'],true);
    foreach(rows("SELECT * FROM billing_changes WHERE studio_id=? AND subscription_id=? AND status IN ('scheduled','payment_pending')",[$sid,$b['subscription_id']]) as $c){
        $matches=$b['plan']===$c['plan']&&(int)$b['extra_projects']===(int)$c['extra_projects']&&(int)$b['extra_seats']===(int)$c['extra_seats']&&billing_package_website($b)===(bool)(json_decode($c['parameters'],true)['website']??false);
        if($matches&&empty($sub['pending_update'])&&($sub['latest_invoice']['status']??'')==='paid')query("UPDATE billing_changes SET status='applied' WHERE id=?",[$c['id']]);
        elseif(!$matches&&$c['status']==='payment_pending'&&empty($sub['pending_update']))query("UPDATE billing_changes SET status='expired' WHERE id=?",[$c['id']]);
    }
}
function billing_notice(string $key,string $sid,string $subject,string $body): void {
    foreach(rows("SELECT u.email FROM studio_members m JOIN users u ON u.id=m.user_id WHERE m.studio_id=? AND m.role='admin'",[$sid]) as $u){
        query('INSERT OR IGNORE INTO billing_notices(notice_key,studio_id,email,subject,body) VALUES(?,?,?,?,?)',[$key.':'.$u['email'],$sid,$u['email'],$subject,$body."\n\nManage access: ".base_url().'/'.$sid.'/billing']);
    }
}
function billing_deadlines(?int $at=null): void {
    $at??=time();
    foreach(rows('SELECT * FROM studio_billing WHERE legacy_exempt=0') as $b){
        $end=(int)$b['trial_ends_at'];
        if($end&&!$b['subscription_id']&&$end>$at&&$end<=$at+2*BILLING_DAY)billing_notice('trial-reminder:'.$b['studio_id'].':'.$end,$b['studio_id'],'Your Studiodeck trial ends soon','Your 7-day trial ends on '.gmdate('j F Y H:i',$end).' UTC. Choose a Project Pass or a subscription to keep editing. No automatic charge will be made.');
        if($b['subscription_status']==='past_due')billing_notice('payment-failed:'.$b['studio_id'].':'.$b['paid_until'],$b['studio_id'],'Your Studiodeck payment needs attention','Update your payment method in Billing. Project editing pauses three days after your last paid period ends.');
    }
    foreach(rows('SELECT p.id,p.name,p.studio_id FROM projects p JOIN project_coverage c ON c.project_id=p.id') as $p){
        $a=billing_access($p['id'],$at);
        if($a['source']==='project_pass'&&$a['active'])foreach([14,3] as $days)if($a['expires_at']<=$at+$days*BILLING_DAY)billing_notice('pass:'.$p['id'].':'.$a['expires_at'].':'.$days,$p['studio_id'],'Project Pass ends soon: '.$p['name'],'Your pass ends on '.gmdate('j F Y H:i',$a['expires_at']).' UTC. Extend this same project for another 150 days for €15 excluding VAT. Extensions do not renew automatically or reset image enhancements.');
        if($a['active']){query('UPDATE project_coverage SET restricted_at=NULL,retention_notified_at=NULL WHERE project_id=?',[$p['id']]);continue;}
        query('UPDATE project_coverage SET restricted_at=COALESCE(restricted_at,?) WHERE project_id=?',[$a['restricted_at'],$p['id']]);
        $key='expired:'.$p['id'].':'.$a['restricted_at'];
        billing_notice($key,$p['studio_id'],'Project is now read-only: '.$p['name'],'Editing and client access are paused. Your studio can view and download its work. Renew in Billing. We retain the project for at least 90 days after this notice; export or renew before deletion.');
        // Begin the deletion notice period only after a notice was actually sent (or logged in local development).
        $delivered=one("SELECT 1 FROM billing_notices WHERE notice_key LIKE ? AND status IN ('sent','logged')",[$key.':%']);
        if($delivered)query('UPDATE project_coverage SET retention_notified_at=COALESCE(retention_notified_at,?) WHERE project_id=?',[$at,$p['id']]);
        $a=billing_access($p['id'],$at);$delete=$a['delete_after'];
        if($delete)foreach([30,7] as $days)if($delete<=$at+$days*BILLING_DAY)billing_notice('deletion:'.$p['id'].':'.$delete.':'.$days,$p['studio_id'],'Export or renew: '.$p['name'],'Your inactive project is scheduled for deletion after '.gmdate('j F Y H:i',$delete).' UTC. Download your project or renew access before this date.');
        if($delete&&$delete<=$at&&env('BILLING_RETENTION_DELETE','false')==='true'){
            // Never delete a project with work, payment or delivery in flight, or without the final notice.
            if(!one("SELECT 1 FROM billing_notices WHERE notice_key LIKE ? AND status IN ('sent','logged')",['deletion:'.$p['id'].':'.$delete.':7:%']))continue;
            transaction(function()use($p,$at){$access=billing_access($p['id'],$at);if(!$access['active']&&$access['delete_after']&&$access['delete_after']<=$at&&!billing_project_busy($p['id']))delete_project_records($p['id']);});
        }
    }
}
function billing_dispatch_notice(): void {
    $n=transaction(function(){
        $n=one("SELECT * FROM billing_notices WHERE status IN ('pending','sending') AND next_attempt<=? ORDER BY next_attempt,notice_key LIMIT 1",[time()]);
        if($n)query("UPDATE billing_notices SET status='sending',next_attempt=? WHERE notice_key=?",[time()+120,$n['notice_key']]);return $n;
    });if(!$n)return;
    try{
        $sent=send_email($n['email'],$n['subject'],$n['body'],'<p>'.nl2br(htmlspecialchars($n['body'],ENT_QUOTES,'UTF-8')).'</p>');
        if(!$sent&&env('APP_ENV','production')!=='local')throw new RuntimeException('Email not delivered');
        query('UPDATE billing_notices SET status=? WHERE notice_key=?',[$sent?'sent':'logged',$n['notice_key']]);
    }catch(Throwable $e){query("UPDATE billing_notices SET status='pending',attempts=attempts+1,next_attempt=? WHERE notice_key=?",[time()+min(86400,60*2**min(10,(int)$n['attempts'])),$n['notice_key']]);}
}
function billing_project_busy(string $pid): bool {
    return (bool)(one("SELECT 1 FROM jobs WHERE project_id=? AND status IN ('queued','running')",[$pid])||one("SELECT 1 FROM billing_orders WHERE (project_id=? OR (kind='subscription' AND studio_id=(SELECT studio_id FROM projects WHERE id=?))) AND status='pending'",[$pid,$pid])||one("SELECT 1 FROM email_outbox WHERE status='sending' AND comment_id IN (SELECT c.id FROM comments c JOIN iterations i ON i.id=c.iteration_id WHERE i.project_id=?)",[$pid]));
}
function billing_worker_tick(): void {
    static $last=0,$reconciled=0;
    if(time()-$last<15)return;$last=time();
    try{
        billing_process_events();billing_dispatch_notice();billing_deadlines();
        if(time()-$reconciled>=300&&env('STRIPE_SECRET_KEY')){
            $reconciled=time();foreach(rows('SELECT studio_id FROM studio_billing WHERE customer_id IS NOT NULL') as $b){try{billing_reconcile_studio($b['studio_id']);}catch(Throwable $e){error_log('Billing reconciliation: '.$e->getMessage());}}
        }
    }catch(Throwable $e){error_log('Billing worker: '.$e->getMessage());}
}
