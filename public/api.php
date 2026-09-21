<?php
declare(strict_types=1);
require_once __DIR__.'/../app/ingest.php';
require_once __DIR__.'/../app/ai.php';
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
try {
    $action=$_GET['action']??'';
    if(in_array($action,['project_testimonial_photo','website_preview','website_template_preview','website_asset','website_source_image','website_export'],true)&&isset($_GET['website_studio']))$_SERVER['HTTP_X_STUDIO_ID']=text_field($_GET['website_studio'],32);
    // Every API is private unless explicitly part of the authentication flow.
    if(!in_array($action,['session','request_login','consume_login'],true))$apiUser=authenticated_user();
    $read=['attention','mention_people','project_testimonials','project_testimonial_photo','conversation','conversation_file','website','website_sources','website_source_image','website_asset','website_preview','website_template_preview','website_export','project_export','project_access','billing','billing_invoices','destinations','client_project','destination_cover','drive_status','drive_list','drive_callback','session','projects','project','deck','file','document_page','slide_image','studio_users','activity_feed','comments_feed','studio_logo','resolve_slide','profile','comment_preview','project_cover','studio_starting_pack','pack_file','project_starting_pack'];
    if(!in_array($action,$read,true) && ($_SERVER['REQUEST_METHOD']??'GET')!=='POST')fail('Please use POST for this action.',405);
    // Serialize the iteration lock check with simple metadata writes.
    if(in_array($action,['category','theme','save_budget','retry_job','save_slide','add_system_slide','slide_layout','add_slide_group','remove_slide_group','reorder_slide_groups','studio_theme'],true)) { db()->exec('BEGIN IMMEDIATE'); $GLOBALS['atomic_write']=true; }
    if($action==='session')json_response(session_details(current_session()));
    require __DIR__.'/../app/confirmations_api.php';
    require __DIR__.'/../app/project_testimonials_api.php';
    require __DIR__.'/../app/website_api.php';
    require __DIR__.'/../app/billing_api.php';
    require __DIR__.'/../app/project_export_api.php';
    require __DIR__.'/../app/destinations_api.php';
    require __DIR__.'/../app/studio_api.php';
    require __DIR__.'/../app/starting_pack_api.php';
    require __DIR__.'/../app/drive_api.php';
    require __DIR__.'/../app/project_api.php';
    require __DIR__.'/../app/open_questions_api.php';
    require __DIR__.'/../app/project_clients_api.php';
    require __DIR__.'/../app/people_api.php';
    require __DIR__.'/../app/project_directory_api.php';
    if($action==='request_login') {
        $b=input();$email=email_field($b['email']??'');$name=text_field($b['name']??explode('@',$email)[0],100);
        rate_limit('login-ip:'.($_SERVER['REMOTE_ADDR']??''),20,3600);rate_limit('login-email:'.$email,5,900);
        $allowed=array_filter(array_map('trim',explode(',',env('DESIGNER_EMAILS'))));
        if($allowed && !in_array($email,$allowed,true)&&!one('SELECT 1 FROM studio_members m JOIN users u ON u.id=m.user_id WHERE u.email=?',[$email])&&!one('SELECT 1 FROM shares WHERE email=?',[$email])&&!one('SELECT 1 FROM conversation_grants WHERE email=?',[$email]))json_response(['message'=>'If this address has access, a sign-in link will arrive shortly.']);
        $u=one('SELECT * FROM users WHERE email=?',[$email]);
        if(!$u) { $u=['id'=>id(),'email'=>$email,'name'=>$name?:'Designer','created_at'=>now()]; insert('users',$u);if(!one('SELECT 1 FROM project_client_members WHERE email=? UNION SELECT 1 FROM shares WHERE email=? UNION SELECT 1 FROM conversation_grants WHERE email=?',[$email,$email,$email]))create_studio($u['id'],$u['name']."’s studio"); }
        $t=token();insert('login_tokens',['token_hash'=>hash_token($t),'user_id'=>$u['id'],'expires_at'=>time()+900]);
        $url=base_url().'/#/login/'.$t;
        $sent=send_email($email,'Your Studiodeck sign-in link',"Sign in to Studiodeck:\n\n".$url."\n\nThis link expires in 15 minutes and works once.");
        if(!$sent && env('APP_ENV','production')==='local') {
            $log=env('MAIL_LOG_PATH')?:ROOT.'/storage/mail.log';file_put_contents($log,now().' '.$email.' '.$url."\n",FILE_APPEND|LOCK_EX);@chmod($log,0600);
        }
        if(!$sent && env('APP_ENV','production')!=='local')fail('Sign-in email is unavailable. Please contact your studio administrator.',503);
        json_response(['message'=>$sent?'Check your email for your sign-in link.':'Local development: the sign-in link is in storage/mail.log.']);
    }
    if($action==='consume_login') {
        $b=input();$hash=hash_token(text_field($b['token']??'',128));
        $result=transaction(function()use($hash){
            $t=one('SELECT * FROM login_tokens WHERE token_hash=? AND expires_at>?',[$hash,time()]);if(!$t)fail('This sign-in link is expired or has already been used.',403);
            $grant=one('SELECT share_id FROM client_login_grants WHERE token_hash=?',[$hash]);
            $redirect='/choose';
            if($grant){$user=one('SELECT * FROM users WHERE id=?',[$t['user_id']]);$share=account_client_share($user,'','',$grant['share_id']);$redirect='/client/projects/'.$share['project_id'].'?iteration='.$share['iteration_id'];}
            $conversationGrant=one('SELECT g.root_id FROM conversation_login_grants l JOIN conversation_grants g ON g.id=l.grant_id WHERE l.token_hash=?',[$hash]);
            if($conversationGrant){$user=one('SELECT * FROM users WHERE id=?',[$t['user_id']]);conversation_access($conversationGrant['root_id'],false,$user);$redirect='/conversations/'.$conversationGrant['root_id'];}
            query('DELETE FROM login_tokens WHERE token_hash=?',[$hash]);$session=token();$csrf=token();
            insert('sessions',['token_hash'=>hash_token($session),'user_id'=>$t['user_id'],'csrf'=>$csrf,'expires_at'=>time()+14*86400]);
            claim_client_profile(one('SELECT email FROM users WHERE id=?',[$t['user_id']])['email']);
            return [$session,$csrf,$redirect];
        });
        setcookie('studiodeck_session',$result[0],['expires'=>time()+14*86400,'path'=>'/','secure'=>str_starts_with(base_url(),'https://'),'httponly'=>true,'samesite'=>'Lax']);json_response(['ok'=>true,'redirect'=>$result[2]]);
    }
    if($action==='logout') { $u=authenticated_user(true);query('DELETE FROM sessions WHERE token_hash=?',[$u['token_hash']]);setcookie('studiodeck_session','',['expires'=>1,'path'=>'/','httponly'=>true,'samesite'=>'Lax','secure'=>str_starts_with(base_url(),'https://')]);json_response(['ok'=>true]); }
    if($action==='projects') {
        $u=owner();$ps=rows('SELECT p.*,EXISTS(SELECT 1 FROM project_pins pin WHERE pin.project_id=p.id AND pin.user_id=?) AS pinned,EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=?) AS can_edit,(SELECT COUNT(*) FROM jobs j WHERE j.project_id=p.id AND j.status IN ("queued","running")) AS processing FROM projects p WHERE '.project_access_sql().(empty($_GET['archived'])?' AND p.archived=0':'').' ORDER BY pinned DESC,p.created_at DESC,p.id',[$u['user_id'],$u['user_id'],$u['studio_id'],$u['user_id']]);
        foreach($ps as &$p) { $p['billing']=billing_access($p['id']);$p['can_manage']=(bool)$p['can_edit'];$p['can_edit']=$p['can_edit']&&$p['billing']['can_edit']&&($p['billing']['source']!=='project_pass'||$p['billing']['designer_id']===$u['user_id']);$p['iteration']=one('SELECT * FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$p['id']]);$p=array_merge($p,project_details($p['id']));$p['members']=project_people($p['id']);$cover=project_cover($p['iteration']['id']);$p['cover_key']=$cover?implode(':',[$p['iteration']['id'],$cover['id'],$cover['image_version_id']??'']):null;$p['file_count']=(int)one('SELECT COUNT(*) AS n FROM iteration_files WHERE iteration_id=?',[$p['iteration']['id']])['n']; }
        // Studio-wide existence includes archived and private projects; expose no private metadata.
        $studioEmpty=!one('SELECT 1 FROM projects WHERE studio_id=? LIMIT 1',[$u['studio_id']]);
        json_response(['projects'=>$ps,'studio_empty'=>$studioEmpty,'billing'=>billing_summary($u['studio_id'])]);
    }
    if($action==='create_project') {
        $u=owner(true);$b=input();$name=text_field($b['name']??'',160);if(!$name)fail('Give your project a name.');$emails=[];
        foreach(array_slice($b['emails']??[],0,20) as $email)$emails[]=email_field($email);
        $visibility=$b['visibility']??'team';if(!in_array($visibility,['team','public'],true))fail('Choose project visibility.');
        $p=transaction(function()use($u,$b,$name,$emails,$visibility){
            if(!$u['studio_id'])fail('Join or create a studio first.',403);$coverage=billing_new_project($u,text_field($b['billing_intent']??'',20),text_field($b['archive_project_id']??''));$pid=id();$iid=id();insert('projects',['id'=>$pid,'user_id'=>$u['user_id'],'studio_id'=>$u['studio_id'],'visibility'=>$visibility,'name'=>$name,'location'=>text_field($b['location']??'',160),'description'=>text_field($b['description']??'',2000),'theme'=>'{}','created_at'=>now()]);
            insert('project_coverage',['project_id'=>$pid,'source'=>$coverage]);
            insert('project_members',['project_id'=>$pid,'user_id'=>$u['user_id']]);
            if($coverage==='project_pass')billing_redeem_pass($u,$pid);
            insert('iterations',['id'=>$iid,'project_id'=>$pid,'number'=>1,'title'=>'First concept','status'=>'draft','theme'=>'{}','created_at'=>now()]);
            foreach(array_unique($emails) as $email){insert('contacts',['id'=>id(),'project_id'=>$pid,'name'=>explode('@',$email)[0],'role'=>'Client','email'=>$email,'phone'=>'']);add_project_client($pid,$email);}
            insert('contacts',['id'=>id(),'project_id'=>$pid,'name'=>$u['name'],'role'=>'Interior designer','email'=>$u['email'],'phone'=>'']);
            if($coverage!=='none')apply_new_project_pack($pid,$iid,$u,$b);
            audit($pid,$iid,$u['email'],'project_created','Created the project');return ['project_id'=>$pid,'iteration_id'=>$iid];
        });json_response($p,201);
    }
    if($action==='project') {
        $u=owner();$p=owned_project((string)($_GET['id']??''),$u,false);$iid=$_GET['iteration']??'';
        $i=$iid?owned_iteration($iid,$u):one('SELECT * FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$p['id']]);if($i['project_id']!==$p['id'])fail('Presentation not found.',404);json_response(deck_payload($i,true));
    }
    if($action==='deck') { [$i,$actor,$isOwner]=access_iteration((string)($_GET['iteration']??''));json_response(deck_payload($i,$isOwner)); }
    if($action==='lock_iteration') {
        $u=owner(true);$b=input();$locked=$b['locked']??true;
        if(!is_bool($locked))fail('Choose whether to lock this iteration.');
        transaction(function()use($u,$b,$locked){
            $i=owned_iteration(text_field($b['iteration']??''),$u,false,true);
            if(!one("SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=? AND role='admin'",[$u['studio_id'],$u['user_id']]))fail('Only studio admins can lock or unlock iterations.',403);
            if((bool)$i['locked']===$locked)return;
            if($locked&&one("SELECT 1 FROM jobs WHERE iteration_id=? AND status IN ('queued','running')",[$i['id']]))fail('Wait for processing to finish before locking this iteration.',409);
            query('UPDATE iterations SET locked=? WHERE id=?',[(int)$locked,$i['id']]);
            audit($i['project_id'],$i['id'],$u['email'],$locked?'iteration_locked':'iteration_unlocked',($locked?'Locked':'Unlocked').' iteration '.$i['number']);
        });json_response(['ok'=>true]);
    }
    if($action==='new_iteration') {
        $u=owner(true);$b=input();$base=owned_iteration(text_field($b['iteration']??''),$u,false,true);
        $new=transaction(function()use($u,$b,$base){
            if(one("SELECT id FROM jobs WHERE iteration_id=? AND status IN ('queued','running')",[$base['id']]))fail('Wait for file processing to finish before creating another iteration.',409);
            $n=(int)one('SELECT MAX(number) AS n FROM iterations WHERE project_id=?',[$base['project_id']])['n']+1;$iid=id();
            insert('iterations',['id'=>$iid,'project_id'=>$base['project_id'],'number'=>$n,'title'=>text_field($b['title']??('Design development '.$n),120),'status'=>'draft','theme'=>$base['theme'],'created_at'=>now()]);
            foreach(rows('SELECT * FROM iteration_files WHERE iteration_id=?',[$base['id']]) as $r){$r['iteration_id']=$iid;insert('iteration_files',$r);}
            foreach(rows('SELECT * FROM presentation_slides WHERE iteration_id=?',[$base['id']]) as $slide){$slide['iteration_id']=$iid;insert('presentation_slides',$slide);}
            foreach(rows('SELECT * FROM presentation_slides WHERE iteration_id=?',[$base['id']]) as $slide)copy_slide_image_history($slide,[...$slide,'iteration_id'=>$iid]);
            foreach(rows('SELECT * FROM system_slides WHERE iteration_id=? ORDER BY rowid',[$base['id']]) as $slide){$slide['iteration_id']=$iid;insert('system_slides',$slide);}
            foreach(rows('SELECT * FROM slide_content WHERE iteration_id=?',[$base['id']]) as $content){$content['iteration_id']=$iid;insert('slide_content',$content);}
            foreach(rows('SELECT * FROM slide_layout WHERE iteration_id=?',[$base['id']]) as $layout){$layout['iteration_id']=$iid;insert('slide_layout',$layout);}
            foreach(rows('SELECT * FROM slide_sections WHERE iteration_id=?',[$base['id']]) as $section){$section['iteration_id']=$iid;insert('slide_sections',$section);}
            foreach(rows('SELECT * FROM slide_groups WHERE iteration_id=?',[$base['id']]) as $group){$group['iteration_id']=$iid;insert('slide_groups',$group);}
            foreach(rows('SELECT * FROM iteration_pack_items WHERE iteration_id=?',[$base['id']]) as $item){$item['iteration_id']=$iid;insert('iteration_pack_items',$item);}
            ensure_iteration_slides($iid);
            $items=rows('SELECT * FROM budget_items WHERE iteration_id=?',[$base['id']]);$map=[];foreach($items as $r)$map[$r['id']]=id();
            foreach($items as $r){$r['id']=$map[$r['id']];$r['iteration_id']=$iid;$r['parent_id']=null;insert('budget_items',$r);}
            foreach($items as $r){$link=one('SELECT comment_id FROM confirmation_budget_links WHERE budget_item_id=?',[$r['id']]);if($link)insert('confirmation_budget_links',['budget_item_id'=>$map[$r['id']],'comment_id'=>$link['comment_id']]);}
            foreach($items as $r){$choice=one('SELECT * FROM budget_choices WHERE budget_item_id=?',[$r['id']]);if($choice){$choice['budget_item_id']=$map[$r['id']];insert('budget_choices',$choice);}}
            foreach($items as $r)if($r['parent_id'])query('UPDATE budget_items SET parent_id=? WHERE id=?',[$map[$r['parent_id']],$map[$r['id']]]);
            foreach(rows('SELECT * FROM budget_link_suggestions WHERE iteration_id=?',[$base['id']]) as $suggestion){$suggestion['id']=id();$suggestion['iteration_id']=$iid;$suggestion['child_id']=$map[$suggestion['child_id']];$suggestion['parent_id']=$map[$suggestion['parent_id']];insert('budget_link_suggestions',$suggestion);}
            copy_open_questions($base['id'],$iid);
            audit($base['project_id'],$iid,$u['email'],'iteration_created','Created iteration '.$n.' from iteration '.$base['number']);return ['id'=>$iid];
        });json_response($new,201);
    }
    if($action==='upload'||$action==='communication_upload') {
        if((int)($_SERVER['CONTENT_LENGTH']??0)>128*1024*1024)fail('This upload is too large. Please choose fewer files: up to 100 MB per file and 120 MB in one batch.',413);
        $communicationUpload=$action==='communication_upload';$iid=(string)($_POST['iteration']??'');
        if($communicationUpload){[$i,$actor]=access_iteration($iid,true);if(!empty($i['locked']))fail('This iteration is locked.',409);$u=authenticated_user(true);$u['studio_id']=one('SELECT studio_id FROM projects WHERE id=?',[$i['project_id']])['studio_id'];}else{$u=owner(true);$i=owned_iteration($iid,$u,true);}
        $uploads=$_FILES['files']??null;
        if(!$uploads || !is_array($uploads['name']))fail('Choose one or more files.');if(count($uploads['name'])>20)fail('Drop up to 20 files at a time.');
        $replace=(string)($_POST['replace_asset']??'');if($replace && count($uploads['name'])!==1)fail('Choose one replacement file.');$prepared=[];$totalBytes=0;
        foreach($uploads['name'] as $k=>$rawName) {
            $name=basename(str_replace('\\','/',text_field($rawName,240)));if(preg_match('/[\x00-\x1f]/',$name))fail('Please rename this file.');
            $sizeMessage='“'.$name.'” is too large. Each file can be up to 100 MB. Please compress it or split it into smaller files, then try again.';
            $error=$uploads['error'][$k];
            if(in_array($error,[UPLOAD_ERR_INI_SIZE,UPLOAD_ERR_FORM_SIZE],true))fail($sizeMessage,413);
            if($error!==UPLOAD_ERR_OK)fail('“'.$name.'” did not finish uploading. Please check your connection and try again.');
            $tmp=$uploads['tmp_name'][$k];
            if(!is_uploaded_file($tmp))fail('Invalid upload.');$size=filesize($tmp);
            if($size>100*1024*1024)fail($sizeMessage,413);
            $totalBytes+=$size;if($totalBytes>120*1024*1024)fail('These files add up to more than 120 MB. Please select fewer files and upload the rest in another batch.',413);
            $prepared[]=['name'=>$name,'mime'=>validate_upload($name,$tmp),'data'=>file_get_contents($tmp)];
        }
        $uploadCategory=text_field($_POST['category']??'');if(!in_array($uploadCategory,['','legal'],true))fail('Unknown upload category.');
        if($communicationUpload&&($replace||count($prepared)!==1))fail('Attach one new file at a time.');
        $result=save_project_uploads($prepared,$replace,$i,$u,$communicationUpload?'legal':$uploadCategory,null,$communicationUpload);json_response($result,201);
    }
    if($action==='file') {
        [$i,$actor,$isOwner]=access_iteration((string)($_GET['iteration']??''));$vid=(string)($_GET['id']??'');$allowed=allowed_versions($i['id']);if(!isset($allowed[$vid]))fail('File not found in this iteration.',404);
        $f=one('SELECT * FROM file_versions WHERE id=?',[$vid]);$isPreview=isset($_GET['preview']);
        if($isPreview && $f['preview']!==null){$data=$f['preview'];$mime='image/png';}else{$data=$f['data'];$mime=$f['mime'];}
        $name=preg_replace('/[^\x20-\x7e]|["\\\\]/','_',$f['name']);
        header('Content-Type: '.$mime);header('Content-Length: '.strlen($data));header('Content-Disposition: '.($isPreview?'inline':'attachment').'; filename="'.$name.'"; filename*=UTF-8\'\''.rawurlencode($f['name']));
        if(!$isPreview)audit($i['project_id'],$i['id'],$actor,'file_downloaded',$f['name']);echo $data;exit;
    }
    if($action==='document_page') {
        [$i]=access_iteration((string)($_GET['iteration']??''));$vid=(string)($_GET['id']??'');
        if(!isset(allowed_versions($i['id'])[$vid]))fail('File not found in this iteration.',404);
        $number=(int)($_GET['page']??1);$p=one('SELECT * FROM document_pages WHERE version_id=? AND number=?',[$vid,$number]);
        if(!$p)fail('Page not found.',404);
        if(isset($_GET['image'])||isset($_GET['preview'])) {
            $data=$p['preview'];
            if(isset($_GET['image']))$data=one('SELECT data FROM document_images WHERE version_id=? AND page_number=? AND number=?',[$vid,$number,(int)$_GET['image']])['data']??null;
            if($data===null)fail('Image not found.',404);
            header('Content-Type: image/jpeg');header('Content-Length: '.strlen($data));echo $data;exit;
        }
        $images=rows('SELECT number,metadata FROM document_images WHERE version_id=? AND page_number=? ORDER BY number',[$vid,$number]);
        foreach($images as &$image)$image=['number'=>$image['number'],...json_decode($image['metadata'],true)];unset($image);
        json_response(['number'=>$number,'text'=>$p['text'],'has_preview'=>$p['preview']!==null,'metadata'=>json_decode($p['metadata'],true),'images'=>$images]);
    }
    if($action==='reprocess') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$vid=text_field($b['version_id']??'');
        $new=transaction(function()use($u,$i,$vid){
            owned_iteration($i['id'],$u,true);billing_reserve_usage($i['project_id'],'reprocess');
            $v=one('SELECT v.* FROM file_versions v JOIN iteration_files f ON f.version_id=v.id WHERE f.iteration_id=? AND v.id=?',[$i['id'],$vid]);
            if(!$v)fail('Source file not found.',404);billing_trial_storage($u['studio_id'],strlen($v['data']));
            if(one("SELECT id FROM jobs WHERE iteration_id=? AND version_id=? AND status IN ('queued','running')",[$i['id'],$vid]))fail('This file is already processing.',409);
            // A fresh version protects earlier shared snapshots, even when bytes are identical.
            $new=id();$number=(int)one('SELECT MAX(number) AS n FROM file_versions WHERE asset_id=?',[$v['asset_id']])['n']+1;
            $v['id']=$new;$v['parent_id']=$vid;$v['number']=$number;$v['preview']=null;$v['extracted_text']='';$v['metadata']='{}';$v['created_at']=now();insert('file_versions',$v);
            query('UPDATE iteration_files SET version_id=? WHERE iteration_id=? AND asset_id=?',[$new,$i['id'],$v['asset_id']]);
            insert('jobs',['id'=>id(),'project_id'=>$i['project_id'],'iteration_id'=>$i['id'],'version_id'=>$new,'type'=>'ingest','payload'=>'{}','status'=>'queued','error'=>'','created_at'=>now()]);
            audit($i['project_id'],$i['id'],$u['email'],'extraction_requested',$v['name']);return $new;
        });json_response(['id'=>$new],202);
    }
    if($action==='category') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$cat=text_field($b['category']??'');if(!in_array($cat,['moodboard','renders','drawings','budget','legal','presentation','other'],true))fail('Unknown category.');
        if(one("SELECT 1 FROM jobs j JOIN file_versions v ON v.id=j.version_id WHERE j.iteration_id=? AND v.asset_id=? AND j.status IN ('queued','running')",[$i['id'],text_field($b['asset_id']??'')]))fail('Wait for this file to finish processing before changing its category.',409);
        query('UPDATE iteration_files SET category=? WHERE iteration_id=? AND asset_id=?',[$cat,$i['id'],text_field($b['asset_id']??'')]);audit($i['project_id'],$i['id'],$u['email'],'category_changed',$cat);json_response(['ok'=>true]);
    }
    if($action==='studio_theme') {
        $u=owner(true);studio_admin($u);$b=input();$theme=fixed_studio_theme();
        if(array_key_exists('business_type',$b))query('UPDATE studios SET business_type=? WHERE id=?',[studio_business_type_field($b['business_type']),$u['studio_id']]);
        if(array_key_exists('language',$b))query('UPDATE studios SET language=? WHERE id=?',[language_field($b['language'],false),$u['studio_id']]);
        $name=text_field($b['name']??'',100);if($name)query('UPDATE studios SET name=? WHERE id=?',[$name,$u['studio_id']]);
        query('UPDATE studios SET theme=? WHERE id=?',[json_encode($theme),$u['studio_id']]);json_response(['studio_theme'=>$theme]);
    }
    if($action==='theme') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$theme=$b['theme']??[];
        $style=text_field($theme['style']??'Modern',40);$font=in_array($theme['font']??'',['serif','sans'],true)?$theme['font']:'serif';$colors=array_values(array_filter(array_slice($theme['colors']??[],0,5),fn($c)=>is_string($c)&&preg_match('/^#[a-f0-9]{6}$/i',$c)));
        query('UPDATE iterations SET theme=? WHERE id=?',[json_encode(['style'=>$style,'font'=>$font,'colors'=>$colors,'mode'=>($theme['mode']??'light')==='dark'?'dark':'light','background'=>is_string($theme['background']??null)&&preg_match('/^#[a-f0-9]{6}$/i',$theme['background'])?$theme['background']:'#152235','light_background'=>is_string($theme['light_background']??null)&&preg_match('/^#[a-f0-9]{6}$/i',$theme['light_background'])?$theme['light_background']:'','automatic'=>false]),$i['id']]);json_response(['ok'=>true]);
    }
    require __DIR__.'/../app/budget_api.php';
    if($action==='save_budget') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$label=text_field($b['label']??'',300);if(!$label)fail('Give the cost a name.');$bid=text_field($b['id']??'');
        if($bid&&!one('SELECT id FROM budget_items WHERE id=? AND iteration_id=?',[$bid,$i['id']]))fail('Cost not found.',404);
        $parent=text_field($b['parent_id']??'');if($parent&&!one('SELECT id FROM budget_items WHERE id=? AND iteration_id=?',[$parent,$i['id']]))fail('Parent quote not found.');guard_confirmation_budget($bid);guard_confirmation_budget($parent);
        $cursor=$parent;$seen=[];while($cursor){if($cursor===$bid||isset($seen[$cursor]))fail('A quote cannot contain itself.');$seen[$cursor]=true;$cursor=one('SELECT parent_id FROM budget_items WHERE id=?',[$cursor])['parent_id']??'';}
        $amount=money_cents($b['amount']??'');$kind=in_array($b['kind']??'',['quote','estimate','unknown'],true)?$b['kind']:'estimate';if(($b['price_type']??'')==='unknown')$kind='unknown';if($kind==='unknown')$amount=null;
        if(($b['price_type']??'')==='fixed'&&$kind!=='unknown'&&$amount===null)fail('Enter the fixed price, or choose Still to be specified.');
        $data=['label'=>$label,'vendor'=>text_field($b['vendor']??'',200),'amount_cents'=>$amount,'kind'=>$kind,'parent_id'=>$parent?:null,'included'=>$parent&&!empty($b['included'])?1:0,'note'=>text_field($b['note']??'',2000),...budget_form_properties($b)];
        if($data['min_amount_cents']!==null){$data['amount_cents']=null;if($data['kind']==='unknown')$data['kind']='estimate';}
        if($bid)query('UPDATE budget_items SET label=?,vendor=?,amount_cents=?,kind=?,parent_id=?,included=?,note=?,min_amount_cents=?,max_amount_cents=?,is_optional=? WHERE id=?',[...array_values($data),$bid]);else insert('budget_items',['id'=>id(),'iteration_id'=>$i['id'],'source_version_id'=>null,...$data]);
        if($bid){query("UPDATE budget_items SET relationship_locked=1,relationship_origin='manual',relationship_evidence='' WHERE id=?",[$bid]);query("UPDATE budget_link_suggestions SET status='dismissed' WHERE child_id=?",[$bid]);}
        audit($i['project_id'],$i['id'],$u['email'],'budget_updated',$label);json_response(['ok'=>true]);
    }
    if($action==='save_contact') {
        $u=owner(true);$b=input();$p=owned_project(text_field($b['project_id']??''),$u);$name=text_field($b['name']??'',100);if(!$name)fail('Enter a name.');
        $email=email_field($b['email']??'');$role=text_field($b['role']??'Architect',80);$phone=text_field($b['phone']??'',40);
        transaction(function()use($p,$name,$email,$role,$phone){insert('contacts',['id'=>id(),'project_id'=>$p['id'],'name'=>$name,'email'=>$email,'role'=>$role,'phone'=>$phone]);if($role==='Client')add_project_client($p['id'],$email,$name);});json_response(['ok'=>true]);
    }
    if($action==='share') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,false,true);
        $selection=array_key_exists('client_emails',$b);$recipients=$selection?$b['client_emails']:($b['emails']??[]);
        if(!is_array($recipients)||!array_is_list($recipients)||count($recipients)>20)fail('Choose up to 20 clients.');
        $emails=array_values(array_unique(array_map('email_field',$recipients)));if(!$emails)fail('Select at least one client.');
        $message=text_field($b['message']??'Your presentation is ready. You can review the design, explore the budget and leave feedback.',3000);
        $links=transaction(function()use($i,$u,$emails,$selection){
            owned_iteration($i['id'],$u,false,true);
            foreach($emails as $email)if(!one('SELECT 1 FROM project_client_members WHERE project_id=? AND email=?',[$i['project_id'],$email])){
                if($selection)fail('A selected client is no longer a member of this project. Refresh and choose again.',409);
                // Older API callers invited by email. Keep those invitations in
                // the project roster; the new picker selects existing members.
                add_project_client($i['project_id'],$email);
            }
            if(one("SELECT id FROM jobs WHERE iteration_id=? AND status IN ('queued','running')",[$i['id']]))fail('Your files are still being processed. Please wait before sharing.',409);
            $links=[];foreach(array_unique($emails) as $email){$t=token();$sid=id();insert('shares',['id'=>$sid,'iteration_id'=>$i['id'],'token_hash'=>hash_token($t),'email'=>$email,'expires_at'=>time()+90*86400,'revoked'=>0,'created_at'=>now()]);$links[]=['id'=>$sid,'email'=>$email,'url'=>base_url().'/client/projects/'.$i['project_id'].'?iteration='.$i['id']];}
            query("UPDATE iterations SET status='shared' WHERE id=?",[$i['id']]);audit($i['project_id'],$i['id'],$u['email'],'links_created','Created '.$i['number'].' client presentation links');return $links;
        });
        foreach($links as &$link){$loginUrl=transaction(fn()=>client_login_url($link['id']));$link['sent']=send_branded_email($link['email'],$i['project_id'],'Your interior design presentation',$message,$loginUrl);if($link['sent'])audit($i['project_id'],$i['id'],$u['email'],'presentation_sent',$link['email']);}
        json_response(['links'=>$links]);
    }
    if($action==='revoke_share') {
        $u=owner(true);$b=input();$s=one('SELECT * FROM shares WHERE id=?',[text_field($b['id']??'')]);if(!$s)fail('Link not found.',404);$i=owned_iteration($s['iteration_id'],$u,false,true);query('UPDATE shares SET revoked=1 WHERE id=?',[$s['id']]);audit($i['project_id'],$i['id'],$u['email'],'link_revoked',$s['email']);json_response(['ok'=>true]);
    }
    if($action==='comment_answered')json_response(set_comment_answered(input()));
    if($action==='comment' || $action==='view_event') {
        $b=input();[$i,$actor,$isOwner]=access_iteration(text_field($b['iteration']??''),true);rate_limit('engagement:'.$actor,80,3600);$slide=text_field($b['slide']??'intro',80);
        if($action==='comment') {$comment=add_comment($i,$actor,$b);json_response(['ok'=>true,'id'=>$comment['id'],'parent_id'=>$comment['parent_id']]);}
        else audit($i['project_id'],$i['id'],$actor,$isOwner?'preview_opened':'presentation_viewed',$slide);
        json_response(['ok'=>true]);
    }
    if($action==='budget_chat') {
        $b=input();[$i,$actor]=access_iteration(text_field($b['iteration']??''),true);rate_limit('chat:'.$actor,30,3600);$question=text_field($b['question']??'',2000);if(!$question)fail('Ask a question first.');$items=budget_rows($i['id']);
        $slide=text_field($b['slide']??'budget',100);
        $result=answer_with_activity($i,$actor,$slide,$question,fn()=>budget_answer($question,$items,legal_evidence($i['id'],$question),null,project_view_language($i['project_id'],$actor)));
        access_iteration($i['id'],true);json_response($result);
    }
    if($action==='retry_job') {
        $u=owner(true);$b=input();$j=one('SELECT * FROM jobs WHERE id=?',[text_field($b['id']??'')]);if(!$j)fail('Processing task not found.',404);owned_iteration($j['iteration_id'],$u,true);
        if($j['status']!=='failed')fail('This task is not waiting for a retry.');
        if(in_array($j['type'],['image_edit','slide_image_edit'],true))fail('To avoid a duplicate paid image request, start a new image variation after reviewing the failed task.');
        query("UPDATE jobs SET status='queued',error='',started_at=NULL,payload='{}' WHERE id=?",[$j['id']]);json_response(['ok'=>true]);
    }
    if($action==='slide_image') {
        [$i]=access_iteration((string)($_GET['iteration']??''));$slide=current_slide($i['id'],(string)($_GET['slide_id']??''));
        if(!$slide)fail('Slide not found.',404);
        $variant=text_field($_GET['image_version_id']??'');
        $image=$variant&&!isset($_GET['original'])?slide_variant_image($slide,$variant):slide_image_source($slide,isset($_GET['original']));header('Content-Type: '.$image['mime']);header('Content-Length: '.strlen($image['data']));echo $image['data'];exit;
    }
    if($action==='select_slide_image') {
        $u=owner(true);$b=input();
        transaction(function()use($u,$b){
            $i=owned_iteration(text_field($b['iteration']??''),$u,true);
            $slide=current_slide($i['id'],text_field($b['slide_id']??''));if(!$slide)fail('Slide not found.',404);
            $vid=text_field($b['image_version_id']??'');
            if(!in_array($vid,array_column(slide_image_variants($slide),'id'),true))fail('Image variation not found in this presentation.',404);
            foreach(rows("SELECT payload FROM jobs WHERE iteration_id=? AND type='slide_image_edit' AND status IN ('queued','running')",[$i['id']]) as $job)if((json_decode($job['payload'],true)['slide_id']??'')===$slide['id'])fail('Wait for this image enhancement to finish before choosing a version.',409);
            copy_slide_image_history($slide,$slide);
            query('UPDATE presentation_slides SET image_version_id=? WHERE iteration_id=? AND id=?',[$vid,$i['id'],$slide['id']]);
            audit($i['project_id'],$i['id'],$u['email'],'slide_image_selected',$slide['title']);
        });json_response(['ok'=>true]);
    }
    if($action==='reorder_slide_groups') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$groups=slide_groups($i['id']);$order=$b['order']??null;
        if(!is_array($order)||!array_is_list($order)||count($order)!==count($groups)||count(array_filter($order,'is_string'))!==count($order))fail('Include every group exactly once.');
        $keys=array_keys($groups);$sorted=$order;sort($keys);sort($sorted);if($keys!==$sorted)fail('Include every group exactly once.');
        foreach($order as $position=>$gid)query('INSERT INTO slide_groups(iteration_id,id,label,position) VALUES(?,?,?,?) ON CONFLICT(iteration_id,id) DO UPDATE SET position=excluded.position',[$i['id'],$gid,$groups[$gid],$position]);
        audit($i['project_id'],$i['id'],$u['email'],'slides_updated','Reordered presentation groups');json_response(['ok'=>true]);
    }
    if($action==='add_slide_group') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$label=text_field($b['label']??'',60);
        if(!$label)fail('Give the group a name.');$groups=slide_groups($i['id']);if(count($groups)>=35)fail('Use up to 35 slide groups.');
        foreach($groups as $existing)if(strtolower($existing)===strtolower($label))fail('A group with this name already exists.');
        $gid=id();insert('slide_groups',['iteration_id'=>$i['id'],'id'=>$gid,'label'=>$label,'position'=>count($groups)]);audit($i['project_id'],$i['id'],$u['email'],'slides_updated','Added slide group: '.$label);json_response(['id'=>$gid],201);
    }
    if($action==='remove_slide_group') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$groups=slide_groups($i['id']);
        $gid=text_field($b['group']??'',40);$destination=text_field($b['destination']??'',40);
        if(!isset($groups[$gid]))fail('Group not found.',404);
        if(count($groups)<2)fail('Keep at least one slide group.');
        $members=array_filter(editor_slide_sections($i['id']),fn($section)=>$section===$gid);
        $deleted=array_column(rows('SELECT slide_id FROM slide_layout WHERE iteration_id=? AND deleted=1',[$i['id']]),'slide_id');
        $hasSlides=(bool)array_diff(array_keys($members),$deleted);
        if(($destination!==''||$hasSlides)&&($gid===$destination||!isset($groups[$destination])))fail('Choose another group for the slides.');
        if($destination!==''){
            foreach($members as $sid=>$section)query('INSERT INTO slide_sections(iteration_id,slide_id,section) VALUES(?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET section=excluded.section',[$i['id'],$sid,$destination]);
        }else query('DELETE FROM slide_sections WHERE iteration_id=? AND section=?',[$i['id'],$gid]);
        // Retain a tombstone so built-in groups stay removed, including in later iterations.
        query('INSERT INTO slide_groups(iteration_id,id,label,position,deleted) VALUES(?,?,?,?,1) ON CONFLICT(iteration_id,id) DO UPDATE SET deleted=1',[$i['id'],$gid,$groups[$gid],array_search($gid,array_keys($groups),true)]);
        audit($i['project_id'],$i['id'],$u['email'],'slides_updated','Removed slide group: '.$groups[$gid].($destination!==''?'; moved slides to '.$groups[$destination]:''));
        json_response(['ok'=>true]);
    }
    if($action==='slide_layout') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);
        $ids=editor_slide_ids($i['id']);$op=$b['operation']??'';
        if($op==='reorder') {
            $deleted=array_column(rows('SELECT slide_id FROM slide_layout WHERE iteration_id=? AND deleted=1',[$i['id']]),'slide_id');
            $expected=array_values(array_diff($ids,$deleted));$order=$b['order']??null;
            if(!is_array($order)||count(array_filter($order,'is_string'))!==count($order))fail('Send the complete slide order.');
            $a=$expected;$c=$order;sort($a);sort($c);if($a!==$c)fail('The slide list changed. Refresh before reordering.',409);
            foreach($order as $n=>$sid)query('INSERT INTO slide_layout(iteration_id,slide_id,position) VALUES(?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET position=excluded.position',[$i['id'],$sid,$n]);
        }else {
            $sid=text_field($b['slide_id']??'');if(!in_array($sid,$ids,true))fail('Slide not found.',404);
            if($op==='section'){$section=text_field($b['section']??'',40);if(!isset(slide_groups($i['id'])[$section]))fail('Choose a slide section.');query('INSERT INTO slide_sections(iteration_id,slide_id,section) VALUES(?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET section=excluded.section',[$i['id'],$sid,$section]);audit($i['project_id'],$i['id'],$u['email'],'slides_updated','Slide section updated');json_response(['ok'=>true]);}
            if(!in_array($op,['show','hide','delete','restore'],true))fail('Unknown slide action.');
            $column=in_array($op,['show','hide'],true)?'hidden':'deleted';$value=in_array($op,['hide','delete'],true)?1:0;
            query('INSERT INTO slide_layout(iteration_id,slide_id,'.$column.') VALUES(?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET '.$column.'=excluded.'.$column,[$i['id'],$sid,$value]);
        }
        audit($i['project_id'],$i['id'],$u['email'],'slides_updated','Presentation slides: '.$op);json_response(['ok'=>true]);
    }
    if($action==='add_system_slide') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);
        $type=text_field($b['type']??'');if(!in_array($type,SYSTEM_SLIDE_TYPES,true))fail('Choose a valid system slide.');
        $groups=slide_groups($i['id']);$section=text_field($b['section']??'',40);
        if($section!==''&&!isset($groups[$section]))fail('Choose a valid group.');
        if($section===''){$section=match($type){'budget'=>'budget','open-questions'=>'questions',default=>'story'};if(!isset($groups[$section]))$section=array_key_first($groups);}
        $position=max(100000+count(editor_slide_ids($i['id'])),(int)(one('SELECT MAX(position) AS n FROM slide_layout WHERE iteration_id=?',[$i['id']])['n']??0))+1;
        $sid='system-'.id();insert('system_slides',['iteration_id'=>$i['id'],'id'=>$sid,'type'=>$type]);
        insert('slide_layout',['iteration_id'=>$i['id'],'slide_id'=>$sid,'position'=>$position]);
        insert('slide_sections',['iteration_id'=>$i['id'],'slide_id'=>$sid,'section'=>$section]);
        audit($i['project_id'],$i['id'],$u['email'],'slide_created','Added system slide: '.$type);json_response(['id'=>$sid],201);
    }
    if($action==='save_slide') {
        if((int)($_SERVER['CONTENT_LENGTH']??0)>128*1024*1024)fail('This photo is too large. Choose an image up to 100 MB.',413);
        $u=owner(true);$b=str_starts_with($_SERVER['CONTENT_TYPE']??'','multipart/form-data')?$_POST:input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);
        json_response(save_designed_slide($i,$b,$u));
    }
    if($action==='slide_image_edit') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);$sid=text_field($b['slide_id']??'');$mode=text_field($b['mode']??'edit',30);
        if(!in_array($mode,['photorealistic','edit'],true))fail('Unknown image edit.');
        $prompt=text_field($b['prompt']??'',2000);if(!$prompt)fail('Describe the change.');
        rate_limit('image:'.$u['user_id'],12,3600);
        $jid=transaction(function()use($u,$i,$sid,$mode,$prompt){
            owned_iteration($i['id'],$u,true);$slide=current_slide($i['id'],$sid);if(!$slide)fail('Slide not found.',404);
            if(!slide_type_can_ai_edit($slide['type']))fail('AI editing is not available for this slide type.');
            if($mode==='photorealistic'&&$slide['type']!=='render')fail('Make photorealistic is available only for render slides.');
            if(!capabilities()['ai'])fail('Image editing needs the AI connection.',503);
            foreach(rows("SELECT payload FROM jobs WHERE iteration_id=? AND type='slide_image_edit' AND status IN ('queued','running')",[$i['id']]) as $job)if((json_decode($job['payload'],true)['slide_id']??'')===$sid)fail('This slide already has an image edit in progress.',409);
            $source=slide_image_source($slide,true);if(!str_starts_with($source['mime'],'image/'))fail('This slide does not have an editable image.');
            require_project_enhancement($i['project_id']);
            $jid=id();insert('jobs',['id'=>$jid,'project_id'=>$i['project_id'],'iteration_id'=>$i['id'],'version_id'=>$slide['source_version_id'],'type'=>'slide_image_edit','payload'=>json_encode(['slide_id'=>$sid,'mode'=>$mode,'prompt'=>$prompt,'expected_image_version_id'=>$slide['image_version_id']]),'status'=>'queued','error'=>'','created_at'=>now()]);return $jid;
        });json_response(['id'=>$jid,'enhancements'=>project_enhancement_allowance($i['project_id'])],202);
    }
    if($action==='image_edit') {
        $u=owner(true);$b=input();$i=owned_iteration(text_field($b['iteration']??''),$u,true);if(!capabilities()['ai'])fail('Image editing is not connected yet. Add the AI service key in your server configuration.',503);rate_limit('image:'.$u['user_id'],12,3600);
        $v=one('SELECT v.id,v.mime FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? AND v.id=?',[$i['id'],text_field($b['version_id']??'')]);if(!$v||!str_starts_with($v['mime'],'image/'))fail('Choose an image from this iteration.');
        $prompt=text_field($b['prompt']??'',2000);if(!$prompt)fail('Describe the change.');$jid=id();transaction(function()use($jid,$i,$v,$prompt,$u){
            owned_iteration($i['id'],$u,true);
            if(!one('SELECT version_id FROM iteration_files WHERE iteration_id=? AND version_id=?',[$i['id'],$v['id']]))fail('The source image has changed. Please refresh.');
            if(one("SELECT id FROM jobs WHERE iteration_id=? AND version_id=? AND type='image_edit' AND status IN ('queued','running')",[$i['id'],$v['id']]))fail('This image already has an enhancement in progress.',409);
            require_project_enhancement($i['project_id']);
            insert('jobs',['id'=>$jid,'project_id'=>$i['project_id'],'iteration_id'=>$i['id'],'version_id'=>$v['id'],'type'=>'image_edit','payload'=>json_encode(['prompt'=>$prompt]),'status'=>'queued','error'=>'','created_at'=>now()]);
        });json_response(['id'=>$jid,'enhancements'=>project_enhancement_allowance($i['project_id'])],202);
    }
    fail('Action not found.',404);
} catch(Throwable $e) {
    if(!empty($GLOBALS['atomic_write'])) { db()->exec('ROLLBACK');$GLOBALS['atomic_write']=false; }
    elseif(db()->inTransaction())db()->rollBack();$code=$e instanceof RuntimeException&&$e->getCode()>=400&&$e->getCode()<=599?$e->getCode():500;
    if($code===500)error_log('Studiodeck: '.$e->getMessage());
    $details=[];
    if(env('APP_ENV','production')==='local' && !empty($apiUser['user_id'])){
        // No stack arguments, request bodies, credentials or session tokens in diagnostics.
        $details['debug']=['action'=>$action??'','exception'=>get_class($e),'message'=>$e->getMessage(),'file'=>basename($e->getFile()),'line'=>$e->getLine()];
        if($e instanceof StripeRequestFailed)$details['debug']['provider']=$e->diagnostic;
    }
    json_response(['error'=>$code===500?'Something went wrong. Please try again.':$e->getMessage()]+($e instanceof ProjectAccessRequired?['project_access'=>$e->projectId]:[])+$details,$code);
}
