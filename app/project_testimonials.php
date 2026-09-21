<?php
declare(strict_types=1);
function project_testimonials(array $u,string $pid): array {
    $p=owned_project($pid,$u,false);
    return ['project'=>['id'=>$p['id'],'name'=>$p['name']], 'testimonials'=>rows("SELECT id,project_id,name,title,content,video,approved,revision,updated_at,CASE WHEN data IS NULL THEN 0 ELSE 1 END has_photo FROM project_testimonials WHERE project_id=? ORDER BY updated_at DESC,id",[$pid])];
}
function project_testimonial_save(array $u,array $b): array {
    return transaction(function()use($u,$b){
        $pid=text_field($b['project_id']??'',32);owned_project($pid,$u,true);$tid=text_field($b['id']??'',32);
        $old=$tid?one('SELECT * FROM project_testimonials WHERE id=? AND project_id=?',[$tid,$pid]):null;
        if($tid&&!$old)fail('Project testimonial not found.',404);
        if($old&&(int)$old['revision']!==(int)($b['revision']??0))fail('This testimonial changed. Reopen it before saving.',409);
        if(!$old&&(int)one('SELECT COUNT(*) n FROM project_testimonials WHERE project_id=?',[$pid])['n']>=50)fail('This project already has 50 testimonials.');
        $name=text_field($b['name']??'',120);$content=text_field($b['content']??'',2000);if(!$name||!$content)fail('Enter a name and quote.');
        $video=text_field($b['video']??'',2048);if($video&&!youtube_video($video))fail('Use a valid YouTube video link.');
        $data=!empty($b['remove_photo'])?null:($old['data']??null);$mime=$data?($old['mime']??''):'';
        if(!empty($b['photo'])){
            $data=base64_decode(text_field($b['photo'],28*1024*1024),true);$info=$data===false?false:@getimagesizefromstring($data);
            if(!$info||strlen($data)>20*1024*1024||$info[0]*$info[1]>24000000||!in_array($info['mime'],['image/jpeg','image/png','image/webp'],true))fail('Use a JPEG, PNG or WebP photo up to 20 MB and 24 megapixels.');$mime=$info['mime'];
        }
        $tid=$old['id']??id();$row=['id'=>$tid,'project_id'=>$pid,'name'=>$name,'title'=>text_field($b['title']??'',120),'content'=>$content,'video'=>$video?youtube_video($video)['url']:'','approved'=>!empty($b['approved'])?1:0,'data'=>$data,'mime'=>$mime,'revision'=>(int)($old['revision']??0)+1,'updated_at'=>now()];
        if($old)query('DELETE FROM project_testimonials WHERE id=?',[$tid]);insert('project_testimonials',$row);
        return project_testimonials($u,$pid);
    });
}
function project_testimonial_delete(array $u,array $b): array {
    return transaction(function()use($u,$b){$pid=text_field($b['project_id']??'',32);owned_project($pid,$u,true);$old=one('SELECT * FROM project_testimonials WHERE id=? AND project_id=?',[text_field($b['id']??'',32),$pid]);if(!$old)fail('Project testimonial not found.',404);if((int)$old['revision']!==(int)($b['revision']??0))fail('This testimonial changed. Reopen it before removing it.',409);query('DELETE FROM project_testimonials WHERE id=?',[$old['id']]);return project_testimonials($u,$pid);});
}
