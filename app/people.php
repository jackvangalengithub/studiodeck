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
function builtin_comment_thumbnail(array $c,array $i): GdImage {
    $p=one('SELECT name,theme FROM projects WHERE id=?',[$i['project_id']]);$theme=json_decode($i['theme'],true)?:json_decode($p['theme'],true)?:[];
    $dark=($theme['mode']??'light')==='dark';$hex=$dark?($theme['background']??'#152235'):'#f8f8f4';if(!preg_match('/^#[a-f0-9]{6}$/i',$hex))$hex='#152235';
    $im=imagecreatetruecolor(480,300);$bg=imagecolorallocate($im,hexdec(substr($hex,1,2)),hexdec(substr($hex,3,2)),hexdec(substr($hex,5,2)));$ink=$dark?imagecolorallocate($im,245,245,242):imagecolorallocate($im,38,43,38);$soft=$dark?imagecolorallocate($im,70,80,88):imagecolorallocate($im,220,224,214);imagefill($im,0,0,$bg);
    $font='/usr/share/fonts/truetype/dejavu/DejaVu'.(($theme['font']??'serif')==='serif'?'Serif':'Sans').'.ttf';
    $text=function(string $value,int $x,int $y,int $size=20)use($im,$ink,$font){if(is_file($font)&&function_exists('imagettftext'))imagettftext($im,$size,0,$x,$y,$ink,$font,preview_text($value,42));else { $value=substr($value,0,42);$layer=imagecreatetruecolor(max(1,strlen($value)*9),16);$color=imagecolorsforindex($im,imagecolorat($im,0,0));$background=imagecolorallocate($layer,$color['red'],$color['green'],$color['blue']);imagefill($layer,0,0,$background);$fg=imagecolorsforindex($im,$ink);$foreground=imagecolorallocate($layer,$fg['red'],$fg['green'],$fg['blue']);imagestring($layer,5,0,0,$value,$foreground);$scale=$size/12;imagecopyresampled($im,$layer,$x,$y-(int)(16*$scale),0,0,(int)(imagesx($layer)*$scale),(int)(16*$scale),imagesx($layer),16);imagedestroy($layer); }};
    $text('CONCEPT '.str_pad((string)$i['number'],2,'0',STR_PAD_LEFT),24,35,10);
    if($c['slide']==='intro'){
        $text('A place to',24,95);$text('come home to.',24,126);$text(preview_text($p['name'],24),24,170,11);
        imagefilledrectangle($im,265,60,456,258,$soft);
        $slide=one("SELECT * FROM presentation_slides WHERE iteration_id=? AND type IN ('render','photo','moodboard') ORDER BY CASE type WHEN 'render' THEN 0 WHEN 'photo' THEN 1 ELSE 2 END,position LIMIT 1",[$i['id']]);
        if($slide){try{$source=slide_image_source($slide);$photo=@imagecreatefromstring($source['data']);if($photo){$scale=min(191/imagesx($photo),198/imagesy($photo));$w=(int)(imagesx($photo)*$scale);$h=(int)(imagesy($photo)*$scale);imagecopyresampled($im,$photo,265+(int)((191-$w)/2),60+(int)((198-$h)/2),0,0,$w,$h,imagesx($photo),imagesy($photo));imagedestroy($photo);}}catch(Throwable $e){}}
    }else{
        $titles=['budget'=>'The investment.','contacts'=>'Your project team.','summary'=>'Everything, together.','changes'=>'A little closer.','general'=>'General comment'];$text($titles[$c['slide']]??'Source slide unavailable',24,85,23);
        if(in_array($c['slide'],['budget','summary'],true)){$total=budget_total(rows('SELECT * FROM budget_items WHERE iteration_id=?',[$i['id']]));$text('€ '.number_format($total/100,0,'.',','),24,155,29);foreach([270,220,165] as $n=>$w)imagefilledrectangle($im,24,182+$n*22,$w,192+$n*22,$soft);}
        elseif($c['slide']==='contacts'){$people=rows("SELECT name FROM contacts WHERE project_id=? AND role<>'Client' LIMIT 3",[$i['project_id']]);foreach($people as $n=>$person){$x=45+$n*145;imagefilledellipse($im,$x+18,145,44,44,$soft);$text(preview_text($person['name'],12),$x-18,195,11);}}
        else{$text(preview_text($p['name'],36),24,148,15);imagefilledrectangle($im,24,178,365,186,$soft);imagefilledrectangle($im,24,202,305,210,$soft);}
    }
    return $im;
}

function preview_text(string $value,int $length): string {preg_match('/^.{0,'.$length.'}/us',$value,$matches);return $matches[0]??substr($value,0,$length);}
