<?php
declare(strict_types=1);
ob_start();$dir=sys_get_temp_dir().'/studiodeck-quotes-'.bin2hex(random_bytes(5));mkdir($dir,0700,true);putenv('DATABASE_PATH='.$dir.'/test.sqlite');putenv('WEBSITE_STORAGE_PATH='.$dir.'/sites');putenv('APP_ENV=local');putenv('APP_URL=http://localhost:8080');putenv('WEBSITE_LOCAL_FREE=true');require __DIR__.'/../app/bootstrap.php';
function check(bool $ok,string $text): void {if(!$ok)throw new RuntimeException($text);echo "PASS $text\n";}
function denied(callable $f,int $status): void {try{$f();}catch(RuntimeException $e){check($e->getCode()===$status,$e->getMessage());return;}throw new RuntimeException('Expected denial');}
try{
 $uid=id();insert('users',['id'=>$uid,'email'=>'quote@example.test','name'=>'Quote studio','created_at'=>now()]);$sid=create_studio($uid,'Quote studio');$u=['user_id'=>$uid,'studio_id'=>$sid,'email'=>'quote@example.test'];query('UPDATE studio_billing SET legacy_exempt=1 WHERE studio_id=?',[$sid]);
 $pid=id();insert('projects',['id'=>$pid,'studio_id'=>$sid,'user_id'=>$uid,'name'=>'Miller family','created_at'=>now()]);insert('project_members',['project_id'=>$pid,'user_id'=>$uid]);insert('project_coverage',['project_id'=>$pid,'source'=>'legacy']);
 $photo=imagecreatetruecolor(30,30);ob_start();imagepng($photo);$bytes=ob_get_clean();imagedestroy($photo);
 $saved=project_testimonial_save($u,['project_id'=>$pid,'name'=>'Robin','title'=>'Homeowner','content'=>'A wonderful place to live.','photo'=>base64_encode($bytes),'approved'=>true]);$t=$saved['testimonials'][0];check($t['project_id']===$pid&&$t['has_photo']===1&&!isset($t['data']),'Testimonial and photo belong to the project without leaking photo bytes');
 $private=project_testimonial_save($u,['project_id'=>$pid,'name'=>'Private quote','content'=>'Not approved.']);$privateId=$private['testimonials'][0]['id'];foreach($private['testimonials'] as $q)if(!$q['approved'])$privateId=$q['id'];
 $site=website_start($u,['template'=>'editorial','revision'=>1]);
 denied(fn()=>website_import($u,['project_id'=>$pid,'title'=>'Miller family','revision'=>2,'testimonials'=>[$privateId]]),400);
 $site=website_import($u,['project_id'=>$pid,'title'=>'Miller family','revision'=>2,'testimonials'=>[$t['id']]]);$d=json_decode($site['draft'],true);$copy=$d['testimonials'][0];check($copy['project']===$d['projects'][0]['id']&&$copy['source_testimonial']===$t['id']&&$copy['photo']!==''&&str_contains($d['files']['index.html'],$t['content']),'Approved quote is copied with its project and independent photo');
 $r=website_publish($u,3);$public=website_dir($sid).'/releases/'.$r['id'].'/public/index.html';$html=file_get_contents($public);
 project_testimonial_save($u,['project_id'=>$pid,'id'=>$t['id'],'revision'=>1,'name'=>'Robin','content'=>'Updated original quote.','approved'=>true]);check(json_decode(website_get($sid)['draft'],true)['testimonials'][0]['content']===$t['content']&&file_get_contents($public)===$html,'Editing an original changes neither the website draft nor published snapshot');
 denied(fn()=>project_testimonial_save($u,['project_id'=>$pid,'id'=>$t['id'],'revision'=>1,'name'=>'Robin','content'=>'Stale overwrite']),409);
 $d['projects'][0]['included']=false;website_save($u,$d,3);$hidden=json_decode(website_get($sid)['draft'],true);check(!str_contains($hidden['files']['index.html'],$t['content']),'Hiding a project also removes its linked quotes from the draft');
 $hidden['projects'][0]['included']=true;website_save($u,$hidden,4);$restored=json_decode(website_get($sid)['draft'],true);check(str_contains($restored['files']['index.html'],$t['content']),'Including a project restores its linked testimonial');
 website_reset($u,5);check(count(project_testimonials($u,$pid)['testimonials'])===2&&one('SELECT data FROM project_testimonials WHERE id=?',[$t['id']])['data']===$bytes,'Website reset preserves project testimonials and original photos');
 $other=id();insert('users',['id'=>$other,'email'=>'other@example.test','name'=>'Other','created_at'=>now()]);$otherSid=create_studio($other,'Other');$otherU=['user_id'=>$other,'studio_id'=>$otherSid,'email'=>'other@example.test'];denied(fn()=>project_testimonials($otherU,$pid),404);denied(fn()=>project_testimonial_delete($otherU,['project_id'=>$pid,'id'=>$t['id'],'revision'=>2]),404);
 project_testimonial_delete($u,['project_id'=>$pid,'id'=>$t['id'],'revision'=>2]);check(!one('SELECT 1 FROM project_testimonials WHERE id=?',[$t['id']]),'Project testimonial deletion is scoped and revision checked');
 transaction(fn()=>delete_project_records($pid));check(!one('SELECT 1 FROM project_testimonials WHERE project_id=?',[$pid]),'Deleting a source project cleans up its original testimonials');
 echo "Project testimonial checks passed.\n";
}finally{website_remove_build($dir);}
