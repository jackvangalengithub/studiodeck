<?php
declare(strict_types=1);

// Both computer uploads and Drive imports use the same versioning and ingest path.
function save_project_uploads(array $prepared,string $replace,array $i,array $u,string $uploadCategory='',?callable $beforeSave=null,bool $communication=false): array {
    if(!in_array($uploadCategory,['','legal'],true))fail('Unknown upload category.');
    if(!$prepared||count($prepared)>20)fail('Choose between 1 and 20 files.');
    if($replace&&count($prepared)!==1)fail('Choose one replacement file.');
    return transaction(function()use($prepared,$replace,$i,$u,$uploadCategory,$beforeSave,$communication){
        if($beforeSave)$beforeSave();
        if($communication){[$current]=access_iteration($i['id'],true);if(!empty($current['locked']))fail('This iteration is locked.',409);}else owned_iteration($i['id'],$u,true);billing_reserve_usage($i['project_id'],'uploads',count($prepared));billing_reserve_usage($i['project_id'],'upload_bytes',array_sum(array_map(fn($f)=>strlen($f['data']),$prepared)));$ids=[];
        billing_trial_storage($u['studio_id'],array_sum(array_map(fn($f)=>strlen($f['data']),$prepared)));
        foreach($prepared as $f){
            $old=$communication?null:($replace?one('SELECT v.id,v.asset_id,v.sha256 FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? AND f.asset_id=?',[$i['id'],$replace]):one('SELECT v.id,v.asset_id,v.sha256 FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? AND v.name=?',[$i['id'],$f['name']]));
            if($replace&&!$old)fail('The file to replace was not found.',404);
            $sha=hash('sha256',$f['data']);if($old&&$old['sha256']===$sha){$ids[]=$old['id'];continue;}
            $asset=$old['asset_id']??id();$vid=id();$category=$uploadCategory?:category_for($f['name'],$f['mime']);
            if(!$old)insert('assets',['id'=>$asset,'project_id'=>$i['project_id'],'category'=>$category,'created_at'=>now()]);
            $n=(int)(one('SELECT MAX(number) AS n FROM file_versions WHERE asset_id=?',[$asset])['n']??0)+1;
            insert('file_versions',['id'=>$vid,'asset_id'=>$asset,'parent_id'=>$old['id']??null,'number'=>$n,'name'=>$f['name'],'mime'=>$f['mime'],'size'=>strlen($f['data']),'sha256'=>$sha,'data'=>$f['data'],'preview'=>null,'extracted_text'=>'','metadata'=>json_encode($f['metadata']??new stdClass()),'created_at'=>now()]);
            if($old)query('UPDATE iteration_files SET version_id=?,category=? WHERE iteration_id=? AND asset_id=?',[$vid,$category,$i['id'],$asset]);
            else insert('iteration_files',['iteration_id'=>$i['id'],'asset_id'=>$asset,'version_id'=>$vid,'category'=>$category]);
            insert('jobs',['id'=>id(),'project_id'=>$i['project_id'],'iteration_id'=>$i['id'],'version_id'=>$vid,'type'=>'ingest','created_at'=>now()]);
            audit($i['project_id'],$i['id'],$u['email'],$old?'file_replaced':'file_uploaded',$f['name']);$ids[]=$vid;
        }
        return ['ids'=>$ids,'message'=>'Files received. Your presentation is being assembled.'];
    });
}
