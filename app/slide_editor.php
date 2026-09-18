<?php
declare(strict_types=1);
require_once __DIR__.'/youtube.php';

function migrate_manual_slides(PDO $db): void {
    $hasManual=fn()=>in_array('manual',array_column($db->query('PRAGMA table_info(presentation_slides)')->fetchAll(),'name'),true);
    if($hasManual())return;
    $db->exec('BEGIN IMMEDIATE');
    try{
        if(!$hasManual()){
            $db->exec("CREATE TABLE presentation_slides_new (id TEXT NOT NULL,iteration_id TEXT NOT NULL REFERENCES iterations(id),source_version_id TEXT REFERENCES file_versions(id),page_number INTEGER NOT NULL DEFAULT 0,image_number INTEGER NOT NULL DEFAULT 0,type TEXT NOT NULL,situation TEXT NOT NULL DEFAULT 'unknown',title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',metadata TEXT NOT NULL DEFAULT '{}',position INTEGER NOT NULL,image_version_id TEXT REFERENCES slide_image_versions(id),manual INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(iteration_id,id))");
            $db->exec('INSERT INTO presentation_slides_new SELECT *,0 FROM presentation_slides');
            $db->exec('DROP TABLE presentation_slides');
            $db->exec('ALTER TABLE presentation_slides_new RENAME TO presentation_slides');
            $db->exec('CREATE INDEX idx_slides_source ON presentation_slides(iteration_id,source_version_id)');
            $db->exec('CREATE UNIQUE INDEX idx_extracted_slide ON presentation_slides(iteration_id,source_version_id,page_number,image_number) WHERE manual=0');
        }
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}

function save_designed_slide(array $i,array $b,array $u): array {
    $sid=text_field($b['slide_id']??'');$slide=$sid?current_slide($i['id'],$sid):null;
    $title=text_field($b['title']??'',160);$description=text_field($b['description']??($slide['description']??''),1600);
    if(!$title)fail('Give the slide a title.');
    $section=text_field($b['section']??'',40);if($section&&!isset(slide_groups($i['id'])[$section]))fail('Choose a valid group.');
    if($systemType=system_slide_type($i['id'],$sid)){
        query('INSERT INTO slide_content(iteration_id,slide_id,title,description) VALUES(?,?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET title=excluded.title,description=excluded.description',[$i['id'],$systemType,$title,$description]);
        if($section)query('INSERT INTO slide_sections(iteration_id,slide_id,section) VALUES(?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET section=excluded.section',[$i['id'],$sid,$section]);
        audit($i['project_id'],$i['id'],$u['email'],'slide_updated',$title);return ['id'=>$sid];
    }
    if($sid&&!$slide)fail('Slide not found.',404);
    $type=$b['type']??'';$situation=$b['situation']??'unknown';
    if(!in_array($type,[...VISUAL_TYPES,'text','video'],true)||!in_array($situation,VISUAL_SITUATIONS,true))fail('Choose a valid slide type and situation.');
    if($slide&&!$slide['manual']&&in_array($type,['text','video'],true))fail('Create a separate text or video slide to keep this source image available.');
    $meta=$slide?(json_decode($slide['metadata'],true)?:[]):[];$source=$slide;
    unset($meta['video']);
    if($type==='video'){
        $video=youtube_video(text_field($b['video_url']??'',2048));
        if(!$video)fail('Paste a valid YouTube video link, such as https://www.youtube.com/watch?v=… or https://youtu.be/…');
        $meta=['video'=>$video];
    }
    if(!in_array($type,['text','video'],true)){
        $upload=$_FILES['image']??null;
        if($upload&&$upload['error']!==UPLOAD_ERR_NO_FILE){
            if(in_array($upload['error'],[UPLOAD_ERR_INI_SIZE,UPLOAD_ERR_FORM_SIZE],true)||$upload['size']>100*1024*1024)fail('This photo is too large. Choose an image up to 100 MB.',413);
            if($upload['error']!==UPLOAD_ERR_OK||!is_uploaded_file($upload['tmp_name']))fail('The photo did not finish uploading. Please try again.');
            $name=basename(str_replace('\\','/',text_field($upload['name'],240)));$mime=validate_upload($name,$upload['tmp_name']);
            if(!in_array($mime,['image/jpeg','image/png','image/webp'],true))fail('Choose a JPG, PNG or WebP photo.');
            $raw=file_get_contents($upload['tmp_name']);$preview=png_preview($raw);if(!$preview)fail('This photo could not be opened. Please try another image.');
            billing_reserve_usage($i['project_id'],'uploads');billing_reserve_usage($i['project_id'],'upload_bytes',strlen($raw));billing_trial_storage($u['studio_id'],strlen($raw));
            $asset=id();$vid=id();insert('assets',['id'=>$asset,'project_id'=>$i['project_id'],'category'=>'renders','created_at'=>now()]);
            insert('file_versions',['id'=>$vid,'asset_id'=>$asset,'number'=>1,'name'=>$name,'mime'=>$mime,'size'=>strlen($raw),'sha256'=>hash('sha256',$raw),'data'=>$raw,'preview'=>$preview,'metadata'=>'{"manual":true}','created_at'=>now()]);
            insert('iteration_files',['iteration_id'=>$i['id'],'asset_id'=>$asset,'version_id'=>$vid,'category'=>'renders']);
            $source=['source_version_id'=>$vid,'page_number'=>0,'image_number'=>0,'image_version_id'=>null];$meta=['palette'=>palette($preview)];
        }elseif(!empty($b['image_source'])){
            $key=text_field($b['image_source']);
            if(str_starts_with($key,'slide:')){
                $source=current_slide($i['id'],substr($key,6));if(!$source||in_array($source['type'],['text','video'],true))fail('Choose an image from this iteration.');
                $meta=json_decode($source['metadata'],true)?:[];
            }elseif(str_starts_with($key,'file:')){
                $v=one("SELECT v.id FROM file_versions v JOIN iteration_files f ON f.version_id=v.id WHERE f.iteration_id=? AND v.id=? AND v.mime LIKE 'image/%' AND f.category!='legal'",[$i['id'],substr($key,5)]);
                if(!$v)fail('Choose an image from this iteration.');
                $source=['source_version_id'=>$v['id'],'page_number'=>0,'image_number'=>0,'image_version_id'=>null];$meta=[];
            }else fail('Choose an image from this iteration.');
        }
        if(empty($source['source_version_id']))fail('Choose a project image or upload a photo for this slide.');
        slide_image_source($source);
    }else $source=['source_version_id'=>null,'page_number'=>0,'image_number'=>0,'image_version_id'=>null];
    // Source replacement is explicit and manual; extraction must never overwrite it.
    $manual=true;
    $meta['confidence']='manual';$meta['evidence']='Created or edited by the designer.';
    if(!$sid)$sid=id();
    $fields=['source_version_id'=>$source['source_version_id'],'page_number'=>$source['page_number'],'image_number'=>$source['image_number'],'image_version_id'=>$source['image_version_id'],'type'=>$type,'situation'=>$situation,'title'=>$title,'description'=>$description,'metadata'=>json_encode($meta),'manual'=>(int)$manual];
    if($slide)query('UPDATE presentation_slides SET '.implode(',',array_map(fn($key)=>$key.'=?',array_keys($fields))).' WHERE iteration_id=? AND id=?',[...array_values($fields),$i['id'],$sid]);
    else insert('presentation_slides',['id'=>$sid,'iteration_id'=>$i['id'],...$fields,'position'=>(int)(one('SELECT MAX(position) AS n FROM presentation_slides WHERE iteration_id=?',[$i['id']])['n']??0)+1]);
    if(!empty($source['id'])&&$source['source_version_id'])copy_slide_image_history($source,['id'=>$sid,'iteration_id'=>$i['id'],...$fields]);
    if($section)query('INSERT INTO slide_sections(iteration_id,slide_id,section) VALUES(?,?,?) ON CONFLICT(iteration_id,slide_id) DO UPDATE SET section=excluded.section',[$i['id'],'visual-'.$sid,$section]);
    audit($i['project_id'],$i['id'],$u['email'],$slide?'slide_updated':'slide_created',$title);
    return ['id'=>'visual-'.$sid];
}
