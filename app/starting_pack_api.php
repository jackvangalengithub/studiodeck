<?php
if($action==='studio_starting_pack'){$u=owner();json_response(['items'=>studio_pack($u['studio_id']),'can_manage'=>(bool)one("SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=? AND role='admin'",[$u['studio_id'],$u['user_id']])]);}
if($action==='pack_file'){
    $u=owner();$v=pack_version(text_field($_GET['version']??''),$u['studio_id']);if(!$v['data'])fail('This template has no attached file.',404);
    header('Content-Type: '.$v['mime']);header('Content-Length: '.strlen($v['data']));header("Content-Disposition: attachment; filename*=UTF-8''".rawurlencode($v['name']));echo $v['data'];exit;
}
if($action==='save_pack_item'){
    $u=owner(true);pack_admin($u);$b=str_starts_with($_SERVER['CONTENT_TYPE']??'','multipart/form-data')?$_POST:input();
    $uploaded=null;$file=$_FILES['file']??null;
    if($file&&$file['error']!==UPLOAD_ERR_NO_FILE){
        if($file['error']!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']))fail('The template file did not finish uploading.');
        if(filesize($file['tmp_name'])>20*1024*1024)fail('Starting-pack files can be up to 20 MB.');
        $name=basename(str_replace('\\','/',text_field($file['name'],240)));$mime=validate_upload($name,$file['tmp_name']);$uploaded=['name'=>$name,'mime'=>$mime,'data'=>file_get_contents($file['tmp_name'])];
    }
    $result=transaction(function()use($u,$b,$uploaded){
        pack_admin($u);$itemId=text_field($b['id']??'');$old=$itemId?one('SELECT * FROM studio_pack_items WHERE id=? AND studio_id=?',[$itemId,$u['studio_id']]):null;
        if($itemId&&!$old)fail('Starting-pack item not found.',404);
        $kind=$old['kind']??($b['kind']??'slide');$type=$old['slide_type']??($b['slide_type']??'text');
        if(!in_array($kind,['slide','document'],true)||!in_array($type,['intro','contacts','text','fullphoto'],true))fail('Choose a supported template type.');
        if((!$old||$old['archived'])&&(int)one('SELECT COUNT(*) n FROM studio_pack_items WHERE studio_id=? AND archived=0',[$u['studio_id']])['n']>=40)fail('Use up to 40 starting-pack items.');
        if($kind==='slide'&&in_array($type,['intro','contacts'],true)&&one("SELECT 1 FROM studio_pack_items WHERE studio_id=? AND kind='slide' AND slide_type=? AND archived=0 AND id!=?",[$u['studio_id'],$type,$itemId]))fail('The studio already has a template for this built-in slide. Edit that template instead.');
        $previous=$old?one('SELECT * FROM studio_pack_versions WHERE item_id=? ORDER BY revision DESC LIMIT 1',[$itemId]):null;
        if($previous&&($b['base_version']??'')!==$previous['id'])fail('This template changed while you were editing. Open it again to review the latest version.',409);
        $title=text_field($b['title']??'',160);if(!$title)fail('Give the template a title.');$body=text_field($b['body']??'',1600);
        $attachment=$uploaded??($previous?array_intersect_key($previous,array_flip(['data','name','mime'])):['data'=>null,'name'=>'','mime'=>'']);
        if($kind==='document'&&(!$attachment['data']||$attachment['mime']!=='application/pdf'))fail('Choose a PDF for this client reference document.');
        if($kind==='slide'&&$type==='fullphoto'&&(!$attachment['data']||!in_array($attachment['mime'],['image/jpeg','image/png','image/webp'],true)||!png_preview($attachment['data'])))fail('Choose a readable JPG, PNG or WebP image.');
        if($kind==='slide'&&$type!=='fullphoto')$attachment=['data'=>null,'name'=>'','mime'=>''];
        $default=in_array($b['default_enabled']??false,[true,1,'1','on'],true)?1:0;$position=max(0,min(999,(int)($b['position']??0)));
        if(!$old){$itemId=id();insert('studio_pack_items',['id'=>$itemId,'studio_id'=>$u['studio_id'],'kind'=>$kind,'slide_type'=>$type,'default_enabled'=>$default,'position'=>$position]);}
        else query('UPDATE studio_pack_items SET default_enabled=?,position=?,archived=0 WHERE id=?',[$default,$position,$itemId]);
        billing_trial_storage($u['studio_id'],strlen($attachment['data']??''));
        $vid=id();insert('studio_pack_versions',['id'=>$vid,'item_id'=>$itemId,'revision'=>($previous['revision']??0)+1,'title'=>$title,'body'=>$body,...$attachment,'created_at'=>now()]);return ['id'=>$itemId,'version_id'=>$vid];
    });json_response($result);
}
if($action==='archive_pack_item'){
    $u=owner(true);$b=input();transaction(function()use($u,$b){pack_admin($u);$item=one('SELECT id FROM studio_pack_items WHERE id=? AND studio_id=?',[text_field($b['id']??''),$u['studio_id']]);if(!$item)fail('Starting-pack item not found.',404);query('UPDATE studio_pack_items SET archived=1 WHERE id=?',[$item['id']]);});json_response(['ok'=>true]);
}
if($action==='project_starting_pack'){
    $u=owner();$i=owned_iteration(text_field($_GET['iteration']??''),$u);$p=owned_project($i['project_id'],$u,false);json_response(project_pack($i,$p,$u));
}
if($action==='add_project_pack_slide'){
    $u=owner(true);$b=input();transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$p=owned_project($i['project_id'],$u);
        $pack=project_pack($i,$p,$u);
        if(($b['snapshot']??'')!==$pack['snapshot'])fail('The project or studio templates changed. Open Add slide again to see the available slides.',409);
        $vid=text_field($b['version_id']??'');
        if(!in_array($vid,array_column($pack['available_slides'],'version_id'),true))fail('This studio slide is already included or is no longer available.',409);
        apply_pack_version($i,$p,pack_version($vid,$p['studio_id']),$u);
        audit($p['id'],$i['id'],$u['email'],'starting_pack_slide_added','Added a missing studio template slide');
    });json_response(['ok'=>true]);
}
if($action==='apply_project_pack'){
    $u=owner(true);$b=input();transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$p=owned_project($i['project_id'],$u);
        $review=project_pack($i,$p,$u);if(($b['snapshot']??'')!==$review['snapshot'])fail('The project or studio pack changed. Review the latest content before applying updates.',409);
        $changes=$b['changes']??null;if(!is_array($changes)||count($changes)>40)fail('Choose valid starting-pack changes.');$seen=[];
        foreach($changes as $change){
            if(!is_array($change)||!is_string($change['item_id']??null)||isset($seen[$change['item_id']]))fail('Choose each starting-pack item once.');$seen[$change['item_id']]=true;
            $mapping=one('SELECT * FROM iteration_pack_items WHERE iteration_id=? AND item_id=?',[$i['id'],$change['item_id']]);
            if(($change['operation']??'')==='remove'){if(!$mapping)fail('This item is not attached to the project.');remove_project_pack_item($i,$mapping);}
            elseif(($change['operation']??'')==='apply'){$v=pack_version(text_field($change['version_id']??''),$p['studio_id']);if($v['item_id']!==$change['item_id'])fail('Choose the correct version of this item.');apply_pack_version($i,$p,$v,$u);}
            else fail('Choose add, update or remove.');
        }
        audit($p['id'],$i['id'],$u['email'],'starting_pack_updated','Reviewed and applied '.count($changes).' starting-pack changes');
    });json_response(['ok'=>true]);
}
