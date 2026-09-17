<?php
declare(strict_types=1);
function person_key(string $email,bool $owner): string {return ($owner?'user:':'client:').strtolower($email);}
function profile_for(string $key,string $fallback=''): array {
    $p=one('SELECT name,color,email_comments,avatar FROM person_profiles WHERE person_key=?',[$key])?:['name'=>'','color'=>'','email_comments'=>1,'avatar'=>null];
    $p['name']=$p['name']?:$fallback;$p['email_comments']=(bool)$p['email_comments'];$p['avatar']=$p['avatar']?'data:image/png;base64,'.base64_encode($p['avatar']):null;return $p;
}
function profile_identity(bool $write=false): array {
    if(str_starts_with($_SERVER['HTTP_AUTHORIZATION']??'','Bearer ')){[$i,$email]=access_iteration();return [person_key($email,false),$email,explode('@',$email)[0]];}
    $u=owner($write);return [person_key($u['email'],true),$u['email'],$u['name']];
}
function normalized_upload(string $field,int $size=640): string {
    $f=$_FILES[$field]??null;if(!$f||$f['error']!==UPLOAD_ERR_OK||!is_uploaded_file($f['tmp_name']))fail('Choose an image.');
    if(filesize($f['tmp_name'])>2*1024*1024)fail('The image can be up to 2 MB.');$info=@getimagesize($f['tmp_name']);
    if(!$info||!in_array($info['mime'],['image/png','image/jpeg','image/webp'],true)||$info[0]*$info[1]>12000000)fail('Choose a PNG, JPEG or WebP image up to 12 megapixels.');
    $im=@imagecreatefromstring(file_get_contents($f['tmp_name']));if(!$im)fail('This image could not be read.');
    $scale=min(1,$size/max(imagesx($im),imagesy($im)));$out=imagecreatetruecolor(max(1,(int)(imagesx($im)*$scale)),max(1,(int)(imagesy($im)*$scale)));imagealphablending($out,false);imagesavealpha($out,true);imagecopyresampled($out,$im,0,0,0,0,imagesx($out),imagesy($out),imagesx($im),imagesy($im));ob_start();imagepng($out);$data=ob_get_clean();imagedestroy($im);imagedestroy($out);return $data;
}
function decorate_comments(array $comments,string $key): array {
    foreach($comments as &$c){$c['unread']=$c['author']!==substr($key,strpos($key,':')+1)&&!one('SELECT 1 FROM comment_reads WHERE comment_id=? AND person_key=?',[$c['id'],$key]);
        $account=one('SELECT name FROM users WHERE email=?',[$c['author']]);$c['profile']=profile_for(person_key($c['author'],(bool)$account),$account['name']??explode('@',$c['author'])[0]);}
    return $comments;
}
function presentation_branding(string $pid): array {
    $p=one('SELECT p.studio_id,s.name FROM projects p JOIN studios s ON s.id=p.studio_id WHERE p.id=?',[$pid]);
    $logo=one('SELECT data FROM project_logos WHERE project_id=?',[$pid]);$source=$logo?'project':'studio';
    if(!$logo)$logo=one('SELECT data FROM studio_logos WHERE studio_id=?',[$p['studio_id']]);
    return ['name'=>$p['name'],'source'=>$logo?$source:'studiodeck','logo'=>$logo?'data:image/png;base64,'.base64_encode($logo['data']):null,'has_project_logo'=>(bool)one('SELECT 1 FROM project_logos WHERE project_id=?',[$pid])];
}
function unread_comment_count(array $u): int {
    return (int)one('SELECT COUNT(*) AS n FROM comments c JOIN iterations i ON i.id=c.iteration_id JOIN projects p ON p.id=i.project_id WHERE '.project_access_sql().' AND c.author<>? AND NOT EXISTS(SELECT 1 FROM comment_reads r WHERE r.comment_id=c.id AND r.person_key=?)',[$u['studio_id'],$u['user_id'],$u['email'],person_key($u['email'],true)])['n'];
}
