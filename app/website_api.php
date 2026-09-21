<?php
declare(strict_types=1);
if(str_starts_with($action,'website_')||$action==='website'){
    $read=in_array($action,['website','website_sources','website_source_image','website_asset','website_preview','website_template_preview','website_export'],true);$u=owner(!$read);studio_admin($u);$sid=$u['studio_id'];$site=website_get($sid);
    if($action==='website')json_response(website_payload($u));
    if($action==='website_sources')json_response(website_sources($u,text_field($_GET['project_id']??'')));
    if($action==='website_source_image'){
        $source=website_sources($u,text_field($_GET['project_id']??''));$id=text_field($_GET['id']??'');if(!in_array($id,array_column($source['images'],'id'),true))fail('Project image not found.',404);
        require_once __DIR__.'/slides.php';$slide=one('SELECT * FROM presentation_slides WHERE id=? AND iteration_id=?',[$id,$source['iteration']]);$raw=slide_image_source($slide);$info=@getimagesizefromstring($raw['data']);
        if(!$info||$info[0]*$info[1]>24000000||!function_exists('imagecreatefromstring'))fail('Image preview unavailable.',400);
        $image=@imagecreatefromstring($raw['data']);if(!$image)fail('Image preview unavailable.',400);$w=min(360,$info[0]);$h=max(1,(int)round($info[1]*$w/$info[0]));$thumb=imagecreatetruecolor($w,$h);imagefill($thumb,0,0,imagecolorallocate($thumb,255,255,255));imagecopyresampled($thumb,$image,0,0,0,0,$w,$h,$info[0],$info[1]);header('Content-Type: image/jpeg');imagejpeg($thumb,null,75);imagedestroy($thumb);imagedestroy($image);exit;
    }
    if($action==='website_asset'){
        $a=one('SELECT * FROM website_assets WHERE id=? AND studio_id=?',[text_field($_GET['id']??''),$sid]);if(!$a)fail('Website image not found.',404);header('Content-Type: '.$a['mime']);echo $a['data'];exit;
    }
    if($action==='website_preview'||$action==='website_template_preview'){
        $d=website_with_source(json_decode($site['draft'],true));$assets=[];
        if($action==='website_template_preview'){
            $template=website_template_id(text_field($_GET['template']??'',30));$sample=str_repeat('0',32);
            $studio=one('SELECT business_type,language FROM studios WHERE id=?',[$sid]);
            $definition=array_column(website_templates(),null,'id')[$template];
            $exampleType=isset($definition['layout'])?$definition['business_types'][0]:$studio['business_type'];
            $profile=studio_business_profile($exampleType,$studio['language']);
            $d=array_replace($d,website_empty_draft('Studio Forma',$exampleType,$studio['language']),[
                'email'=>'hello@example.com','logo'=>'','testimonials'=>[],
                'about'=>$profile['intro'],
                'projects'=>[['id'=>str_repeat('2',32),'title'=>$profile['projectTitle'],'description'=>$profile['projectIntro'],'category'=>$profile['label'],'location'=>'','included'=>true,'images'=>[['asset'=>$sample,'alt'=>$profile['alt']]]]]
            ]);
            unset($d['pages']);$d['files']=website_seed_files($d,$template,$sample);
            $raw=file_get_contents(ROOT.'/public'.$profile['image']);$info=getimagesizefromstring($raw);$url='data:image/webp;base64,'.base64_encode($raw);$assets[$sample]=['jpeg'=>$url,'webp'=>$url,'width'=>$info[0],'height'=>$info[1]];
        }else{$page=website_page_find($d,text_field($_GET['page']??'home',32));if(!website_page_enabled($d,$page))fail('This project is hidden from the website.',404);$assets=website_preview_assets($sid,website_page_files($d,$page));}
        header('Content-Type: text/html; charset=utf-8');header('X-Robots-Tag: noindex, nofollow');header('X-Frame-Options: SAMEORIGIN');header('Content-Security-Policy: '.website_code_policy(true));
        $d=website_with_source($d);$page=website_page_find($d,$action==='website_template_preview'?'home':text_field($_GET['page']??'home',32));if(!website_page_enabled($d,$page))fail('This project is hidden from the website.',404);$compiled=website_compile_page($d,$assets,website_origin($site),$page,true,text_field($_GET['channel']??'',100));echo $compiled['index.html'];exit;
    }
    if($action==='website_export'){
        website_require_paid($site);$live=website_live($sid);if(!$live)fail('Publish a version before downloading it.');if(!class_exists('ZipArchive'))fail('ZIP export is unavailable on this server.',503);
        $dir=website_dir($sid).'/releases/'.$live['release'].'/public';$temp=tempnam(sys_get_temp_dir(),'website-');$zip=new ZipArchive();
        try{if($zip->open($temp,ZipArchive::OVERWRITE)!==true)throw new RuntimeException('Could not prepare export.');foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS)) as $f)if($f->isFile())$zip->addFile($f->getPathname(),substr($f->getPathname(),strlen($dir)+1));if(!$zip->close())throw new RuntimeException('Could not finish export.');header('Content-Type: application/zip');header('Content-Disposition: attachment; filename="studio-website.zip"');readfile($temp);}finally{unlink($temp);}exit;
    }
    $b=input();
    if($action==='website_reset'){if(($b['confirm']??false)!==true)fail('Confirm that you want to remove this website and start from scratch.');website_reset($u,(int)($b['revision']??0));json_response(website_payload($u));}
    if($action==='website_page')json_response(website_page_change($u,$b));
    if($action==='website_start'){website_start($u,$b);json_response(website_payload($u));}
    if($action==='website_save'){website_save($u,is_array($b['draft']??null)?$b['draft']:[],(int)($b['revision']??0));json_response(website_payload($u));}
    if($action==='website_import'){website_import($u,$b);json_response(website_payload($u));}
    if($action==='website_upload'){
        $bytes=base64_decode(text_field($b['data']??'',28*1024*1024),true);if($bytes===false)fail('Invalid image upload.');$id=transaction(fn()=>website_store_image($sid,$bytes));json_response(['id'=>$id]);
    }
    if($action==='website_publish'){rate_limit('website-publish:'.$sid,10,3600);website_publish($u,(int)($b['revision']??0));json_response(website_payload($u));}
    if($action==='website_restore'){
        website_require_paid($site);$id=text_field($b['release']??'',32);if(!preg_match('/^[a-f0-9]{32}$/D',$id))fail('Version not found.',404);$dir=website_dir($sid).'/releases/'.$id;
        if(!is_file($dir.'/release.json'))fail('Version not found.',404);$draft=json_decode(file_get_contents($dir.'/draft.json'),true);website_save($u,website_with_source($draft),(int)($b['revision']??0));json_response(website_payload($u));
    }
    if($action==='website_undo'){
        transaction(function()use($sid,$b){$site=website_get($sid);if((int)$site['revision']!==(int)($b['revision']??0))fail('Reload before undoing changes.',409);$h=one('SELECT * FROM website_history WHERE studio_id=? ORDER BY rowid DESC LIMIT 1',[$sid]);if(!$h)fail('No earlier draft available.');query('UPDATE websites SET draft=?,revision=revision+1,updated_at=? WHERE studio_id=?',[$h['draft'],now(),$sid]);query('DELETE FROM website_history WHERE id=?',[$h['id']]);});json_response(website_payload($u));
    }
    if($action==='website_chat')json_response(website_chat_edit($u,$b));
    if($action==='website_checkout')json_response(website_checkout($u));
    if($action==='website_refresh_billing'){
        rate_limit('website-billing:'.$sid,10,60);billing_reconcile_studio($sid);$site=website_get($sid);if($site['subscription_id'])billing_sync_subscription(stripe_request('GET','subscriptions/'.rawurlencode($site['subscription_id']),['expand'=>['latest_invoice']]));json_response(website_payload($u));
    }
    if($action==='website_domain'){
        require_once __DIR__.'/website_domains.php';website_domain($u,$b);json_response(website_payload($u));
    }
    fail('Website action not found.',404);
}
