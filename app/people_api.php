<?php
if(in_array($action,['profile','save_profile','upload_avatar','remove_avatar'],true)){
    [$key,$email,$name]=profile_identity($action!=='profile');
    if($action!=='profile'){
        query('INSERT OR IGNORE INTO person_profiles(person_key) VALUES(?)',[$key]);
        if($action==='save_profile'){$b=input();$name=text_field($b['name']??'',100);if(!$name)fail('Enter your name.');$color='';$mentionsOnly=array_key_exists('email_mentions_only',$b)?$b['email_mentions_only']:profile_for($key)['email_mentions_only'];if(!is_bool($mentionsOnly))fail('Choose a notification preference.');$language=array_key_exists('language',$b)?language_field($b['language']):profile_for($key)['language'];query('UPDATE person_profiles SET name=?,color=?,email_comments=?,email_mentions_only=?,language=? WHERE person_key=?',[$name,$color,!empty($b['email_comments'])?1:0,$mentionsOnly?1:0,$language,$key]);if(str_starts_with($key,'user:'))query('UPDATE users SET name=? WHERE email=?',[$name,$email]);}
        elseif($action==='remove_avatar')query('UPDATE person_profiles SET avatar=NULL WHERE person_key=?',[$key]);
        else {$data=normalized_upload('avatar',160);$q=db()->prepare('UPDATE person_profiles SET avatar=? WHERE person_key=?');$q->bindValue(1,$data,PDO::PARAM_LOB);$q->bindValue(2,$key);$q->execute();}
    }
    json_response(['profile'=>profile_for($key,$name),'email'=>$email]);
}
if($action==='read_comments'){
    $b=input();[$key]=profile_identity(true);$ids=$b['ids']??[];if(!is_array($ids)||count($ids)>100)fail('Read up to 100 comments at a time.');
    transaction(function()use($ids,$key){foreach($ids as $id){$c=one('SELECT iteration_id FROM comments WHERE id=?',[text_field($id,80)]);if(!$c)fail('Comment not found.',404);access_iteration($c['iteration_id']);query('INSERT OR IGNORE INTO comment_reads(comment_id,person_key,read_at) VALUES(?,?,?)',[$id,$key,now()]);}});json_response(['ok'=>true]);
}
if($action==='comment_preview'){
    $c=one('SELECT * FROM comments WHERE id=?',[text_field($_GET['id']??'')]);if(!$c)fail('Comment not found.',404);[$i]=access_iteration($c['iteration_id']);
    require_once __DIR__.'/slides.php';$slide=str_starts_with($c['slide'],'visual-')?current_slide($i['id'],substr($c['slide'],7)):null;
    if($slide&&$slide['source_version_id']){try{$image=slide_image_source($slide);$im=@imagecreatefromstring($image['data']);if($im){$scale=min(240/imagesx($im),160/imagesy($im));$thumb=imagescale($im,max(1,(int)(imagesx($im)*$scale)),max(1,(int)(imagesy($im)*$scale)));header('Content-Type: image/png');imagepng($thumb);exit;}}catch(Throwable $e){}}
    $im=builtin_comment_thumbnail($c,$i);header('Content-Type: image/png');imagepng($im);exit;
}
if(in_array($action,['upload_project_logo','remove_project_logo'],true)){
    $b=$action==='upload_project_logo'?$_POST:input();$u=owner(true);$p=owned_project(text_field($b['project_id']??''),$u);
    $data=$action==='upload_project_logo'?normalized_upload('logo'):null;
    transaction(function()use($p,$data){query('DELETE FROM project_logos WHERE project_id=?',[$p['id']]);if($data)insert('project_logos',['project_id'=>$p['id'],'data'=>$data,'mime'=>'image/png']);});json_response(['ok'=>true]);
}
