<?php
if($action==='project_export'){
    require_once __DIR__.'/slides.php';
    $u=owner();$p=owned_project(text_field($_GET['project_id']??''),$u,false);
    if(!class_exists('ZipArchive'))fail('Project export is unavailable.',503);
    $path=tempnam(sys_get_temp_dir(),'studiodeck-export-');$zip=new ZipArchive();
    try{
        if($zip->open($path,ZipArchive::OVERWRITE)!==true)throw new RuntimeException('Unable to prepare export.');
        $iterations=rows('SELECT * FROM iterations WHERE project_id=? ORDER BY number',[$p['id']]);
        $manifest=['project'=>$p,'iterations'=>[],'exported_at'=>now()];
        foreach($iterations as $i){
            $manifest['iterations'][]=['iteration'=>$i,'communication'=>communication_payload($i),'budget'=>budget_rows($i['id']),'comments'=>array_map(fn($c)=>[...$c,'mentions'=>comment_mentions($c['id'])],rows('SELECT * FROM comments WHERE iteration_id=?',[$i['id']])),'open_questions'=>open_questions_payload($i['id'],true),'slides'=>project_slides($i['id']),'system_slides'=>rows('SELECT id,type FROM system_slides WHERE iteration_id=?',[$i['id']]),'slide_layout'=>rows('SELECT * FROM slide_layout WHERE iteration_id=?',[$i['id']]),'slide_sections'=>rows('SELECT * FROM slide_sections WHERE iteration_id=?',[$i['id']]),'slide_content'=>rows('SELECT * FROM slide_content WHERE iteration_id=?',[$i['id']]),'files'=>project_files($i['id'])];
        }
        $zip->addFromString('project.json',json_encode($manifest,JSON_PRETTY_PRINT|JSON_INVALID_UTF8_SUBSTITUTE));
        // Stream one database BLOB at a time to disk; do not hold the whole project in PHP memory.
        $temps=[];
        foreach(rows('SELECT v.id,v.name FROM file_versions v JOIN assets a ON a.id=v.asset_id WHERE a.project_id=? ORDER BY v.created_at',[$p['id']]) as $v){
            $file=tempnam(sys_get_temp_dir(),'studiodeck-file-');$temps[]=$file;
            file_put_contents($file,one('SELECT data FROM file_versions WHERE id=?',[$v['id']])['data']);
            $safe=preg_replace('/[^\pL\pN._ -]/u','_',basename($v['name']));$zip->addFile($file,'files/'.$v['id'].'-'.($safe?:'document'));
        }
        foreach(rows('SELECT v.id,v.mime FROM slide_image_versions v JOIN file_versions f ON f.id=v.source_version_id JOIN assets a ON a.id=f.asset_id WHERE a.project_id=?',[$p['id']]) as $v){
            $file=tempnam(sys_get_temp_dir(),'studiodeck-image-');$temps[]=$file;file_put_contents($file,one('SELECT data FROM slide_image_versions WHERE id=?',[$v['id']])['data']);$zip->addFile($file,'enhancements/'.$v['id'].match($v['mime']){'image/jpeg'=>'.jpg','image/webp'=>'.webp',default=>'.png'});
        }
        if(!$zip->close())throw new RuntimeException('Unable to complete export.');
        header('Content-Type: application/zip');header('Content-Disposition: attachment; filename="studiodeck-project.zip"');header('Content-Length: '.filesize($path));readfile($path);
    }finally{foreach($temps??[] as $file)@unlink($file);@unlink($path);}exit;
}
