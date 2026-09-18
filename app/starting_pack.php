<?php
declare(strict_types=1);

function pack_admin(array $u): void {
    if(!one("SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=? AND role='admin'",[$u['studio_id'],$u['user_id']]))fail('Only studio admins can manage the starting pack.',403);
}
function studio_pack(string $sid): array {
    return rows('SELECT t.*,v.id AS version_id,v.revision,v.title,v.body,v.name,v.mime,length(v.data) AS size,v.created_at FROM studio_pack_items t JOIN studio_pack_versions v ON v.item_id=t.id AND v.revision=(SELECT MAX(revision) FROM studio_pack_versions WHERE item_id=t.id) WHERE t.studio_id=? AND t.archived=0 ORDER BY t.position,t.rowid',[$sid]);
}
function pack_version(string $vid,string $sid): array {
    $v=one('SELECT v.*,t.studio_id,t.kind,t.slide_type,t.position,t.archived FROM studio_pack_versions v JOIN studio_pack_items t ON t.id=v.item_id WHERE v.id=? AND t.studio_id=?',[$vid,$sid]);
    if(!$v)fail('Starting-pack item not found in this studio.',404);return $v;
}
function pack_tokens(array $p,array $u): array {
    $studio=one('SELECT name FROM studios WHERE id=?',[$p['studio_id']]);$clients=rows("SELECT name FROM contacts WHERE project_id=? AND role='Client' ORDER BY rowid",[$p['id']]);
    $values=['project_name'=>$p['name'],'studio_name'=>$studio['name'],'designer_name'=>$u['name'],'designer_email'=>$u['email'],'location'=>$p['location'],'client_names'=>implode(', ',array_column($clients,'name'))];
    $replace=[];foreach($values as $key=>$value)if($value!=='')$replace['{{'.$key.'}}']=$value;return $replace;
}
function pack_fingerprint(string $iid,array $mapping): string {
    if($mapping['asset_id']&&!$mapping['slide_id'])$data=one('SELECT version_id,category FROM iteration_files WHERE iteration_id=? AND asset_id=?',[$iid,$mapping['asset_id']]);
    elseif(in_array($mapping['slide_id'],['intro','contacts'],true))$data=one('SELECT title,description FROM slide_content WHERE iteration_id=? AND slide_id=?',[$iid,$mapping['slide_id']]);
    else $data=one('SELECT title,description,type,situation,metadata,source_version_id,page_number,image_number,image_version_id FROM presentation_slides WHERE iteration_id=? AND id=?',[$iid,$mapping['slide_id']]);
    $key=in_array($mapping['slide_id'],['intro','contacts'],true)?$mapping['slide_id']:'visual-'.$mapping['slide_id'];
    $layout=$mapping['slide_id']?one('SELECT hidden,deleted,position FROM slide_layout WHERE iteration_id=? AND slide_id=?',[$iid,$key]):null;
    return hash('sha256',json_encode([$data,$layout],JSON_INVALID_UTF8_SUBSTITUTE));
}
// Existing copies and custom built-in text are never replaced by Add slide.
function available_pack_slides(array $i,array $library): array {
    $applied=array_column(rows('SELECT item_id FROM iteration_pack_items WHERE iteration_id=? AND excluded=0',[$i['id']]),'item_id');
    $custom=array_column(rows('SELECT slide_id FROM slide_content WHERE iteration_id=? UNION SELECT slide_id FROM iteration_pack_items WHERE iteration_id=? AND excluded=0',[$i['id'],$i['id']]),'slide_id');
    return array_values(array_filter($library,function($item)use($applied,$custom){
        return $item['kind']==='slide'&&!in_array($item['id'],$applied,true)&&!in_array($item['slide_type'],$custom,true);
    }));
}
function project_pack(array $i,array $p,array $u): array {
    $library=studio_pack($p['studio_id']);$latest=array_column($library,null,'id');
    foreach($library as &$item){$item['preview_title']=strtr($item['title'],pack_tokens($p,$u));$item['preview_body']=strtr($item['body'],pack_tokens($p,$u));}unset($item);
    $applied=rows('SELECT m.*,v.title,v.body,v.revision,v.name,t.kind,t.slide_type,t.archived FROM iteration_pack_items m JOIN studio_pack_versions v ON v.id=m.version_id JOIN studio_pack_items t ON t.id=m.item_id WHERE m.iteration_id=? ORDER BY t.position,t.rowid',[$i['id']]);
    foreach($applied as &$row){$row['current_fingerprint']=pack_fingerprint($i['id'],$row);$row['modified']=!$row['excluded']&&$row['current_fingerprint']!==$row['fingerprint'];$row['update_available']=isset($latest[$row['item_id']])&&$latest[$row['item_id']]['version_id']!==$row['version_id'];
        $content=in_array($row['slide_id'],['intro','contacts'],true)?one('SELECT title,description FROM slide_content WHERE iteration_id=? AND slide_id=?',[$i['id'],$row['slide_id']]):one('SELECT title,description FROM presentation_slides WHERE iteration_id=? AND id=?',[$i['id'],$row['slide_id']]);
        $row['current_title']=$content['title']??$row['title'];$row['current_body']=$content['description']??'';
        if($row['kind']==='document'){$file=one('SELECT v.name FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? AND f.asset_id=?',[$i['id'],$row['asset_id']]);$row['name']=$file['name']??$row['name'];}
    }unset($row);
    return ['library'=>$library,'applied'=>$applied,'available_slides'=>available_pack_slides($i,$library),'snapshot'=>hash('sha256',json_encode([$library,$applied,rows('SELECT * FROM slide_content WHERE iteration_id=? ORDER BY slide_id',[$i['id']])],JSON_INVALID_UTF8_SUBSTITUTE))];
}
function remove_project_pack_item(array $i,array $mapping): void {
    if($mapping['asset_id']){
        if(one("SELECT 1 FROM jobs WHERE iteration_id=? AND version_id IN(SELECT id FROM file_versions WHERE asset_id=?) AND status IN('queued','running')",[$i['id'],$mapping['asset_id']]))fail('Wait for this file to finish processing before removing it.',409);
        if(!$mapping['slide_id'])query('DELETE FROM iteration_files WHERE iteration_id=? AND asset_id=?',[$i['id'],$mapping['asset_id']]);
    }
    if($mapping['slide_id']){
        if(in_array($mapping['slide_id'],['intro','contacts'],true))query('DELETE FROM slide_content WHERE iteration_id=? AND slide_id=?',[$i['id'],$mapping['slide_id']]);
        // Keep custom slide originals and enhancement history, as with ordinary slide deletion.
        $key=in_array($mapping['slide_id'],['intro','contacts'],true)?$mapping['slide_id']:'visual-'.$mapping['slide_id'];
        if(in_array($mapping['slide_id'],['intro','contacts'],true))query('DELETE FROM slide_layout WHERE iteration_id=? AND slide_id=?',[$i['id'],$key]);
        else query('INSERT INTO slide_layout(iteration_id,slide_id,deleted) VALUES(?,?,1) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET deleted=1',[$i['id'],$key]);
    }
    query('UPDATE iteration_pack_items SET excluded=1 WHERE iteration_id=? AND item_id=?',[$i['id'],$mapping['item_id']]);
}
// Caller holds BEGIN IMMEDIATE and has authorized edits to this draft.
function apply_pack_version(array $i,array $p,array $v,array $u): void {
    if(!empty($i['locked'])||$v['studio_id']!==$p['studio_id']||$v['archived'])fail('This starting-pack item cannot be applied here.',409);
    $mapping=one('SELECT * FROM iteration_pack_items WHERE iteration_id=? AND item_id=?',[$i['id'],$v['item_id']]);
    if($mapping&&$mapping['version_id']===$v['id']&&!$mapping['excluded'])return;
    $parent=$mapping&&$mapping['asset_id']?one('SELECT version_id FROM iteration_files WHERE iteration_id=? AND asset_id=?',[$i['id'],$mapping['asset_id']]):null;
    if($mapping)remove_project_pack_item($i,$mapping);
    $tokens=pack_tokens($p,$u);$title=strtr($v['title'],$tokens);$body=strtr($v['body'],$tokens);$asset=null;$slide=null;
    if($v['kind']==='document'||$v['slide_type']==='fullphoto'){
        $asset=$mapping['asset_id']??id();$old=one('SELECT id,number FROM file_versions WHERE asset_id=? ORDER BY number DESC LIMIT 1',[$asset]);$vid=id();$category=$v['kind']==='document'?'legal':'renders';
        if(!$old)insert('assets',['id'=>$asset,'project_id'=>$p['id'],'category'=>$category,'created_at'=>now()]);
        billing_reserve_usage($p['id'],'uploads');billing_reserve_usage($p['id'],'upload_bytes',strlen($v['data']));billing_trial_storage($u['studio_id'],strlen($v['data']));
        insert('file_versions',['id'=>$vid,'asset_id'=>$asset,'parent_id'=>$parent['version_id']??null,'number'=>($old['number']??0)+1,'name'=>$v['name'],'mime'=>$v['mime'],'size'=>strlen($v['data']),'sha256'=>hash('sha256',$v['data']),'data'=>$v['data'],'preview'=>$v['kind']==='document'?null:png_preview($v['data']),'metadata'=>json_encode(['studio_reference'=>$v['kind']==='document','library_revision'=>$v['revision']]),'created_at'=>now()]);
        query('INSERT INTO iteration_files(iteration_id,asset_id,version_id,category) VALUES(?,?,?,?) ON CONFLICT(iteration_id,asset_id) DO UPDATE SET version_id=excluded.version_id,category=excluded.category',[$i['id'],$asset,$vid,$category]);
        if($v['kind']==='document')insert('jobs',['id'=>id(),'project_id'=>$p['id'],'iteration_id'=>$i['id'],'version_id'=>$vid,'type'=>'ingest','created_at'=>now()]);
    }
    if($v['kind']==='slide'){
        $slide=in_array($v['slide_type'],['intro','contacts'],true)?$v['slide_type']:($mapping['slide_id']??id());
        if(one('SELECT 1 FROM iteration_pack_items WHERE iteration_id=? AND item_id!=? AND slide_id=? AND excluded=0',[$i['id'],$v['item_id'],$slide]))fail('This presentation already uses a template for that built-in slide. Remove it first.',409);
        if(in_array($slide,['intro','contacts'],true))query('INSERT INTO slide_content(iteration_id,slide_id,title,description) VALUES(?,?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET title=excluded.title,description=excluded.description',[$i['id'],$slide,$title,$body]);
        else query("INSERT INTO presentation_slides(id,iteration_id,source_version_id,type,situation,title,description,metadata,position,manual) VALUES(?,?,?,?,'reference',?,?,'{\"confidence\":\"manual\"}',?,1) ON CONFLICT(iteration_id,id) DO UPDATE SET source_version_id=excluded.source_version_id,type=excluded.type,situation=excluded.situation,title=excluded.title,description=excluded.description,metadata=excluded.metadata,image_version_id=NULL,page_number=0,image_number=0,manual=1",[$slide,$i['id'],$asset?$vid:null,$v['slide_type'],$title,$body,$v['position']]);
        $key=in_array($slide,['intro','contacts'],true)?$slide:'visual-'.$slide;
        query('INSERT INTO slide_layout(iteration_id,slide_id,position) VALUES(?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET hidden=0,deleted=0,position=excluded.position',[$i['id'],$key,$v['position']]);
        query("INSERT INTO slide_sections(iteration_id,slide_id,section) VALUES(?,?,'story') ON CONFLICT(iteration_id,slide_id) DO UPDATE SET section=excluded.section",[$i['id'],$key]);
    }
    $data=['iteration_id'=>$i['id'],'item_id'=>$v['item_id'],'version_id'=>$v['id'],'asset_id'=>$asset,'slide_id'=>$slide,'excluded'=>0];
    query('DELETE FROM iteration_pack_items WHERE iteration_id=? AND item_id=?',[$i['id'],$v['item_id']]);insert('iteration_pack_items',[...$data,'fingerprint'=>pack_fingerprint($i['id'],$data)]);
}
function apply_new_project_pack(string $pid,string $iid,array $u,array $request): void {
    $p=one('SELECT * FROM projects WHERE id=?',[$pid]);$i=one('SELECT * FROM iterations WHERE id=?',[$iid]);
    $library=studio_pack($p['studio_id']);$versions=$request['starting_pack']??array_column(array_filter($library,fn($r)=>$r['default_enabled']),'version_id');
    if(!is_array($versions)||count($versions)>40||count(array_filter($versions,'is_string'))!==count($versions))fail('Choose valid starting-pack items.');
    $seen=[];foreach(array_unique($versions) as $vid){$v=pack_version($vid,$p['studio_id']);if(isset($seen[$v['item_id']]))fail('Choose one version of each starting-pack item.');$seen[$v['item_id']]=true;apply_pack_version($i,$p,$v,$u);}
    if($versions&&($logo=one('SELECT data,mime FROM studio_logos WHERE studio_id=?',[$p['studio_id']])))insert('project_logos',['project_id'=>$pid,'data'=>$logo['data'],'mime'=>$logo['mime']]);
}
