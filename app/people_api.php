<?php
if(in_array($action,['profile','save_profile','upload_avatar','remove_avatar'],true)){
    [$key,$email,$name]=profile_identity($action!=='profile');
    if($action!=='profile'){
        query('INSERT OR IGNORE INTO person_profiles(person_key) VALUES(?)',[$key]);
        if($action==='save_profile'){$b=input();$name=text_field($b['name']??'',100);if(!$name)fail('Enter your name.');$color=text_field($b['color']??'',7);if($color&&!preg_match('/^#[a-f0-9]{6}$/i',$color))fail('Choose a valid color.');query('UPDATE person_profiles SET name=?,color=?,email_comments=? WHERE person_key=?',[$name,$color,!empty($b['email_comments'])?1:0,$key]);if(str_starts_with($key,'user:'))query('UPDATE users SET name=? WHERE email=?',[$name,$email]);}
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
    if($slide){try{$image=slide_image_source($slide);$im=@imagecreatefromstring($image['data']);if($im){$w=240;$h=max(1,(int)(imagesy($im)*$w/imagesx($im)));$thumb=imagescale($im,$w,min(360,$h));header('Content-Type: image/png');imagepng($thumb);exit;}}catch(Throwable $e){}}
    // Built-in slides have a compact title card instead of a source photograph.
    $titles=['intro'=>'Welcome home','budget'=>'The investment','contacts'=>'Project team','summary'=>'Everything, together','changes'=>"What is new",'general'=>'General comment'];
    $p=one('SELECT name FROM projects WHERE id=?',[$i['project_id']]);$im=imagecreatetruecolor(240,150);$bg=imagecolorallocate($im,239,240,233);$ink=imagecolorallocate($im,55,65,51);imagefill($im,0,0,$bg);imagestring($im,4,14,45,substr($titles[$c['slide']]??'Source slide unavailable',0,28),$ink);imagestring($im,2,14,85,substr($p['name'],0,32),$ink);header('Content-Type: image/png');imagepng($im);exit;
}
if(in_array($action,['upload_project_logo','remove_project_logo'],true)){
    $b=$action==='upload_project_logo'?$_POST:input();$u=owner(true);$p=owned_project(text_field($b['project_id']??''),$u);
    $data=$action==='upload_project_logo'?normalized_upload('logo'):null;
    transaction(function()use($p,$data){query('DELETE FROM project_logos WHERE project_id=?',[$p['id']]);if($data)insert('project_logos',['project_id'=>$p['id'],'data'=>$data,'mime'=>'image/png']);});json_response(['ok'=>true]);
}
