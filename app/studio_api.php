<?php
// Included by the API router after method validation.
if($action==='studio_users'){$u=owner();json_response(['users'=>studio_members($u['studio_id']??'')]);}
if($action==='create_studio'){
    $u=owner(true);$b=input();$name=text_field($b['name']??'',100);if(!$name)fail('Give the studio a name.');
    transaction(function()use($u,$name){$sid=create_studio($u['user_id'],$name);query('UPDATE sessions SET studio_id=? WHERE token_hash=?',[$sid,$u['token_hash']]);});json_response(session_details(current_session()),201);
}
if($action==='switch_studio'){
    $u=owner(true);$sid=text_field(input()['studio_id']??'');if(!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$sid,$u['user_id']]))fail('Studio not found.',404);
    query('UPDATE sessions SET studio_id=? WHERE token_hash=?',[$sid,$u['token_hash']]);json_response(session_details(current_session()));
}
if($action==='save_studio_user'||$action==='remove_studio_user'){
    $u=owner(true);$b=input();
    transaction(function()use($u,$b,$action){
        studio_admin($u);$uid=text_field($b['id']??'');$existing=$uid?one('SELECT * FROM studio_members WHERE studio_id=? AND user_id=?',[$u['studio_id'],$uid]):null;
        if($uid&&!$existing)fail('User not found in this studio.',404);
        $role=$b['role']??'member';if(!in_array($role,['admin','member'],true))fail('Choose admin or member.');
        if($existing&&$existing['role']==='admin'&&($action==='remove_studio_user'||$role!=='admin')&&(int)one("SELECT COUNT(*) n FROM studio_members WHERE studio_id=? AND role='admin'",[$u['studio_id']])['n']<=1)fail('Keep at least one studio admin.',409);
        if($action==='remove_studio_user'){
            if(!$uid)fail('Choose a user.');
            if(one('SELECT pm.project_id FROM project_members pm JOIN projects p ON p.id=pm.project_id WHERE p.studio_id=? AND pm.user_id=? AND (SELECT COUNT(*) FROM project_members others WHERE others.project_id=p.id)=1',[$u['studio_id'],$uid]))fail('Add another team member to this user’s projects before removing them.',409);
            query('DELETE FROM project_members WHERE user_id=? AND project_id IN (SELECT id FROM projects WHERE studio_id=?)',[$uid,$u['studio_id']]);
            query('DELETE FROM studio_members WHERE studio_id=? AND user_id=?',[$u['studio_id'],$uid]);return;
        }
        $email=email_field($b['email']??'');$name=text_field($b['name']??'',100);if(!$name)fail('Enter a name.');
        $phone=array_key_exists('phone',$b)?text_field($b['phone'],40):($existing['phone']??'');
        if($existing){
            $old=one('SELECT email FROM users WHERE id=?',[$uid]);if($old['email']!==$email)fail('Email identifies the account. Remove and add a different account to change it.');
            // Studio contact details and access roles do not change the shared account.
            query('UPDATE studio_members SET role=?,display_name=?,phone=? WHERE studio_id=? AND user_id=?',[$role,$name,$phone,$u['studio_id'],$uid]);
        }else{
            $account=one('SELECT id FROM users WHERE email=?',[$email]);$uid=$account['id']??id();
            if(!$account)insert('users',['id'=>$uid,'email'=>$email,'name'=>$name,'created_at'=>now()]);
            if(one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$u['studio_id'],$uid]))fail('This user is already a studio member.',409);
            insert('studio_members',['studio_id'=>$u['studio_id'],'user_id'=>$uid,'display_name'=>$name,'phone'=>$phone,'role'=>$role]);
        }
    });json_response(['users'=>studio_members($u['studio_id'])]);
}
if($action==='project_members'){
    $u=owner(true);$b=input();
    transaction(function()use($u,$b){$p=owned_project(text_field($b['project_id']??''),$u);$ids=array_values(array_unique($b['user_ids']??[]));if(!$ids)fail('Keep at least one project team member.');
        foreach($ids as $uid)if(!is_string($uid)||!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$p['studio_id'],$uid]))fail('Choose members of this studio.');
        $roles=$b['roles']??[];if(!is_array($roles))fail('Provide a project role for each selected member.');
        foreach($roles as $uid=>$role)if(!in_array($uid,$ids,true)||!is_string($role))fail('Roles must belong to selected studio members.');
        query('DELETE FROM project_members WHERE project_id=?',[$p['id']]);foreach($ids as $uid)insert('project_members',['project_id'=>$p['id'],'user_id'=>$uid]);
        foreach($roles as $uid=>$role)query('INSERT INTO project_team_contacts(project_id,user_id,role) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role',[$p['id'],$uid,text_field($role,80)]);
    });json_response(['ok'=>true]);
}

if($action==='studio_logo'){
    $u=owner();$sid=text_field($_GET['studio_id']??$u['studio_id']??'');if(!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$sid,$u['user_id']]))fail('Studio not found.',404);
    $logo=one('SELECT data,mime FROM studio_logos WHERE studio_id=?',[$sid]);if(!$logo)fail('Logo not found.',404);header('Content-Type: '.$logo['mime']);header('Content-Length: '.strlen($logo['data']));echo $logo['data'];exit;
}
if($action==='upload_studio_logo'){
    $u=owner(true);if(!$u['studio_id'])fail('Choose a studio first.',403);$f=$_FILES['logo']??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name']))fail('Choose a logo image.');
    if(filesize($f['tmp_name'])>2*1024*1024)fail('The logo can be up to 2 MB.');$info=@getimagesize($f['tmp_name']);
    if(!$info||!in_array($info['mime'],['image/png','image/jpeg','image/webp'],true)||$info[0]*$info[1]>12000000)fail('Choose a PNG, JPEG, or WebP logo up to 12 megapixels.');
    $image=@imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$image)fail('This logo could not be read.');
    $scale=min(1,640/max($info[0],$info[1]));$w=max(1,(int)round($info[0]*$scale));$h=max(1,(int)round($info[1]*$scale));$out=imagecreatetruecolor($w,$h);imagealphablending($out,false);imagesavealpha($out,true);imagecopyresampled($out,$image,0,0,0,0,$w,$h,$info[0],$info[1]);ob_start();imagepng($out);$data=ob_get_clean();imagedestroy($image);imagedestroy($out);
    transaction(function()use($u,$data){query('DELETE FROM studio_logos WHERE studio_id=?',[$u['studio_id']]);insert('studio_logos',['studio_id'=>$u['studio_id'],'data'=>$data,'mime'=>'image/png']);});json_response(['ok'=>true]);
}
if($action==='remove_studio_logo'){$u=owner(true);query('DELETE FROM studio_logos WHERE studio_id=?',[$u['studio_id']]);json_response(['ok'=>true]);}
