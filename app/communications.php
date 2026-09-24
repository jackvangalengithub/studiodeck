<?php
declare(strict_types=1);
function email_template(?string $pid,string $heading,string $message,string $url,string $label='Open presentation',?string $footer=null): string {
    $p=$pid===null?null:one('SELECT p.name,s.name AS studio_name,s.theme FROM projects p JOIN studios s ON s.id=p.studio_id WHERE p.id=?',[$pid]);$t=fixed_studio_theme();
    $palettes=['sage'=>['#465441','#f7f7f3'],'clay'=>['#794f40','#faf6f0'],'slate'=>['#3d566c','#f5f7fa'],'ink'=>['#303239','#f6f6f7'],'ocean'=>['#285b6b','#f3f8f8'],'plum'=>['#68445f','#faf6f9'],'rust'=>['#86482f','#fbf6f0'],'forest'=>['#30564a','#f5f8f3'],'mustard'=>['#776022','#faf9f1'],'rose'=>['#80515b','#fbf6f7'],'lavender'=>['#57527d','#f7f6fb'],'espresso'=>['#58483a','#faf7f2'],'grayscale'=>['#454545','#fafafa'],'warmgray'=>['#55534f','#faf9f6']];
    [$accent,$bg]=$palettes[$t['palette']??'sage']??$palettes['sage'];$h=fn($s)=>htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
    $projectHeading=$p?'<h2 style="font-size:18px">'.$h($p['name']).'</h2>':'';
    $footer??=$p?'Manage comment emails in your profile inside Studiodeck or the client presentation.':'If you did not request this sign-in link, you can ignore this email.';
    return '<!doctype html><html><body style="margin:0;background:'.$bg.';font-family:Arial,sans-serif;color:#2b2b2b"><table role="presentation" width="100%"><tr><td style="padding:36px 16px"><table role="presentation" style="max-width:600px;margin:auto;width:100%;background:#fff;border-top:6px solid '.$accent.'"><tr><td style="padding:32px"><p style="color:'.$accent.'">'.$h($p['studio_name']??'Studiodeck').'</p><h1>'.$h($heading).'</h1>'.$projectHeading.'<p style="line-height:1.7">'.nl2br($h($message)).'</p><p style="margin:30px 0"><a href="'.$h($url).'" style="display:inline-block;padding:14px 22px;background:'.$accent.';color:#fff;border-radius:6px;text-decoration:none">'.$h($label).'</a></p><p style="font-size:12px;color:#666666">'.$h($footer).'</p><p style="font-size:12px;color:#666666">Presented by studiodeck</p></td></tr></table></td></tr></table></body></html>';
}
function send_branded_email(string $email,string $pid,string $heading,string $message,string $url,string $label='Open presentation'): bool {
    return send_email($email,$heading,$message."\n\n".$url."\n\nPresented by studiodeck",email_template($pid,$heading,$message,$url,$label));
}
function queue_comment_notifications(array $i,array $c): void {
    queue_conversation_notifications($c);
    $p=one('SELECT * FROM projects WHERE id=?',[$i['project_id']]);$recipients=[];
    foreach(rows('SELECT u.id,u.email FROM project_members m JOIN users u ON u.id=m.user_id JOIN studio_members sm ON sm.user_id=u.id AND sm.studio_id=? WHERE m.project_id=?',[$p['studio_id'],$p['id']]) as $u){$recipients[$u['email']]=['key'=>person_key($u['email'],true),'user'=>$u['id'],'share'=>null,'url'=>base_url().'/'.$p['studio_id'].'/projects/'.$p['id'].'?iteration='.$i['id'].'&tab=comments'];}
    if(communication_audience(communication_root($c))==='shared')foreach(rows('SELECT s.* FROM shares s JOIN iterations i ON i.id=s.iteration_id JOIN project_client_members cm ON cm.project_id=i.project_id AND cm.email=s.email WHERE s.iteration_id=? AND i.status="shared" AND s.revoked=0 AND s.expires_at>? ORDER BY s.created_at',[$i['id'],time()]) as $s){if($s['email']===$c['author']||isset($recipients[$s['email']]))continue;$key=person_key($s['email'],(bool)one('SELECT 1 FROM users WHERE email=?',[$s['email']]));if(!profile_for($key)['email_comments'])continue;$recipients[$s['email']]=['key'=>$key,'user'=>null,'share'=>$s['id'],'url'=>base_url().'/client/projects/'.$i['project_id'].'?iteration='.$i['id'].'&slide='.rawurlencode($c['slide'])];}
    foreach($recipients as $email=>$r){if($email===$c['author']||!comment_email_enabled($r['key'],$c['id'],$email))continue;if(one('SELECT 1 FROM conversation_outbox o JOIN conversation_grants g ON g.id=o.grant_id WHERE o.comment_id=? AND g.email=?',[$c['id'],$email]))continue;insert('email_outbox',['id'=>id(),'comment_id'=>$c['id'],'person_key'=>$r['key'],'email'=>$email,'user_id'=>$r['user'],'share_id'=>$r['share'],'url'=>$r['url']]);}
}
function dispatch_comment_email(): bool {
    $job=transaction(function(){query("UPDATE email_outbox SET status='queued' WHERE status='sending' AND next_attempt<?",[time()-300]);$j=one("SELECT * FROM email_outbox WHERE status='queued' AND next_attempt<=? ORDER BY rowid LIMIT 1",[time()]);if($j)query("UPDATE email_outbox SET status='sending',attempts=attempts+1,next_attempt=? WHERE id=?",[time(),$j['id']]);return $j;});if(!$job)return dispatch_conversation_email();
    try{
        $c=one('SELECT c.*,i.project_id,p.studio_id FROM comments c JOIN iterations i ON i.id=c.iteration_id JOIN projects p ON p.id=i.project_id WHERE c.id=?',[$job['comment_id']]);
        $allowed=$job['user_id']?one('SELECT 1 FROM project_members pm JOIN studio_members sm ON sm.user_id=pm.user_id AND sm.studio_id=? WHERE pm.project_id=? AND pm.user_id=?',[$c['studio_id'],$c['project_id'],$job['user_id']]):one('SELECT 1 FROM shares s JOIN iterations i ON i.id=s.iteration_id JOIN project_client_members cm ON cm.project_id=i.project_id AND cm.email=s.email WHERE s.id=? AND i.status="shared" AND s.revoked=0 AND s.expires_at>?',[$job['share_id'],time()]);
        if(!$job['user_id']&&communication_audience(communication_root($c))==='studio')$allowed=false;
        if(!$allowed||!comment_email_enabled($job['person_key'],$job['comment_id'],$job['email'])){query("UPDATE email_outbox SET status='cancelled' WHERE id=?",[$job['id']]);return true;}
        $url=$job['share_id']?transaction(fn()=>client_login_url($job['share_id'])):$job['url'];
        $confirmation=one('SELECT * FROM comment_confirmations WHERE comment_id=?',[$c['id']]);
        $heading=$confirmation?'Confirmation requested on your project':(empty($c['parent_id'])?'New comment on your design presentation':'New reply on your design presentation');
        if(comment_mentions_person($c['id'],$job['email']))$heading='You were mentioned in a conversation';
        $message=$c['author']." wrote:\n\n".$c['body'];
        if($confirmation){$message.="\n\nConfirmation requested from ".$confirmation['recipient_name'].'.';if($confirmation['amount_cents']!==null)$message.="\nBudget change: ".($confirmation['amount_cents']>0?'+':'').number_format($confirmation['amount_cents']/100,2,'.','').' EUR, including VAT. Applied only after confirmation.';}
        $sent=send_branded_email($job['email'],$c['project_id'],$heading,$message,$url,'Open communication');
        if(!$sent&&env('MAIL_TRANSPORT','log')==='mail')throw new RuntimeException('The mail transport did not accept this email.');
        query('UPDATE email_outbox SET status=?,error=? WHERE id=?',[$sent?'sent':'logged','',$job['id']]);
    }catch(Throwable $e){query('UPDATE email_outbox SET status=?,next_attempt=?,error=? WHERE id=?',[$job['attempts']>=3?'failed':'queued',time()+300,substr($e->getMessage(),0,400),$job['id']]);}
    return true;
}
