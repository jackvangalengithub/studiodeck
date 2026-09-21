<?php
if($action==='project_access')json_response(billing_project_decision(owner(),text_field($_GET['project_id']??'')));
if($action==='project_activate')json_response(billing_activate_project(owner(true),input()));
if($action==='billing_onboard'){$u=owner(true);billing_onboard($u,input());json_response(session_details(current_session()));}
if($action==='billing'){
    $u=owner();studio_admin($u);$b=billing_studio($u['studio_id']);$projects=[];
    foreach(rows('SELECT id,name,archived FROM projects WHERE studio_id=? ORDER BY name',[$u['studio_id']]) as $p){$p['coverage']=billing_access($p['id']);$p['has_pass']=(bool)one('SELECT 1 FROM project_access_grants WHERE project_id=?',[$p['id']]);$projects[]=$p;}
    $catalog=billing_catalog();foreach($catalog as &$p){$p['available']=(bool)$p['price_id']&&(bool)env('STRIPE_SECRET_KEY');unset($p['price_id']);}unset($p);
    json_response(['summary'=>billing_summary($u['studio_id']),'catalog'=>$catalog,'addons'=>billing_addons($u['studio_id']),'projects'=>$projects,'extra_projects'=>(int)$b['extra_projects'],'extra_seats'=>(int)$b['extra_seats'],'website_included'=>billing_package_website($b),'has_customer'=>(bool)$b['customer_id'],
        'orders'=>rows("SELECT id,project_id,plan,status,created_at,error FROM billing_orders WHERE studio_id=? ORDER BY created_at DESC LIMIT 30",[$u['studio_id']]),
        'changes'=>rows("SELECT id,plan,extra_projects,extra_seats,effective_at,status,invoice_url FROM billing_changes WHERE studio_id=? AND status IN ('scheduled','applying','payment_pending')",[$u['studio_id']])]);
}
if($action==='billing_invoices')json_response(['invoices'=>billing_invoices(owner())]);
if($action==='billing_checkout')json_response(billing_checkout(owner(true),input()));
if($action==='billing_resume_checkout'){
    $u=owner(true);studio_admin($u);$o=one("SELECT * FROM billing_orders WHERE id=? AND studio_id=? AND status='pending'",[text_field(input()['order_id']??''),$u['studio_id']]);if(!$o)fail('Pending checkout not found.',404);
    if($o['kind']==='website')json_response(website_checkout($u));
    json_response(billing_checkout($u,array_merge(json_decode($o['parameters'],true),['plan'=>$o['plan'],'project_id'=>$o['project_id']??''])));
}
if($action==='billing_cancel_checkout'){$u=owner(true);billing_cancel_checkout($u,text_field(input()['order_id']??''));json_response(['ok'=>true]);}
if($action==='billing_portal')json_response(billing_portal(owner(true)));
if($action==='billing_coverage'){$u=owner(true);$b=input();billing_switch_project($u,text_field($b['project_id']??''),text_field($b['source']??''));json_response(['ok'=>true]);}
if($action==='billing_refresh'){
    $u=owner(true);studio_admin($u);rate_limit('billing-refresh:'.$u['studio_id'],10,60);billing_process_events(10,$u['studio_id']);billing_reconcile_studio($u['studio_id']);json_response(['ok'=>true]);
}
if($action==='billing_change_preview')json_response(billing_change_preview(owner(true),input()));
if($action==='billing_change_checkout')json_response(billing_change_checkout(owner(true),input()));
if($action==='billing_change_confirm')json_response(billing_change_confirm(owner(true),text_field(input()['change_id']??'')));
if($action==='billing_cancel_change'){
    $u=owner(true);studio_admin($u);$c=one("SELECT * FROM billing_changes WHERE id=? AND studio_id=? AND status='scheduled'",[text_field(input()['change_id']??''),$u['studio_id']]);if(!$c)fail('Scheduled change not found.',404);
    stripe_request('POST','subscription_schedules/'.rawurlencode($c['schedule_id']).'/release',[],'release-'.$c['id']);query("UPDATE billing_changes SET status='cancelled' WHERE id=?",[$c['id']]);json_response(['ok'=>true]);
}
