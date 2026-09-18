<?php
// No AI request: verify that prior generated images cannot become the editing base.
$path=sys_get_temp_dir().'/studiodeck-image-source-'.bin2hex(random_bytes(8)).'.sqlite';putenv('DATABASE_PATH='.$path);
require __DIR__.'/../app/bootstrap.php';
require __DIR__.'/../app/slides.php';
function check_image($condition,$message){if(!$condition)throw new RuntimeException($message);echo "PASS $message\n";}
try{
    insert('users',['id'=>'user','name'=>'Designer','email'=>'images@example.test','created_at'=>now()]);
    insert('projects',['id'=>'project','user_id'=>'user','name'=>'Source test','created_at'=>now()]);
    insert('assets',['id'=>'asset','project_id'=>'project','category'=>'renders','created_at'=>now()]);
    $original=['id'=>'original','asset_id'=>'asset','parent_id'=>null,'number'=>1,'name'=>'source.png','mime'=>'image/png','size'=>8,'sha256'=>'test','data'=>'original','preview'=>null,'extracted_text'=>'','metadata'=>'{}','created_at'=>now()];insert('file_versions',$original);
    $variant=[...$original,'id'=>'variant','parent_id'=>'original','number'=>2,'data'=>'generated','metadata'=>'{"generated":true}'];insert('file_versions',$variant);
    $second=[...$variant,'id'=>'second','parent_id'=>'variant','number'=>3,'data'=>'generated again'];insert('file_versions',$second);
    check_image(original_file_image($second)['data']==='original','Repeated file edits use the original upload');
    $replacement=[...$original,'id'=>'replacement','parent_id'=>'second','number'=>4,'data'=>'new upload'];insert('file_versions',$replacement);
    $third=[...$variant,'id'=>'third','parent_id'=>'replacement','number'=>5];insert('file_versions',$third);
    check_image(original_file_image($third)['data']==='new upload','A manual replacement becomes the new original');
    insert('slide_image_versions',['id'=>'ai-image','parent_id'=>null,'source_version_id'=>'original','mime'=>'image/png','data'=>'generated slide','metadata'=>'{}','created_at'=>now()]);
    $slide=['image_version_id'=>'ai-image','page_number'=>0,'image_number'=>0,'source_version_id'=>'original'];
    check_image(slide_image_source($slide,true)['data']==='original','Slide edits can read the original despite a selected AI variant');
    check_image(slide_image_source([...$slide,'source_version_id'=>'second'],true)['data']==='original','Slides built from file variations still edit the uploaded original');
    insert('document_pages',['version_id'=>'original','number'=>1,'text'=>'','metadata'=>'{}','preview'=>'page preview']);
    insert('document_images',['version_id'=>'original','page_number'=>1,'number'=>1,'metadata'=>'{}','data'=>'original crop']);
    check_image(slide_image_source([...$slide,'page_number'=>1,'image_number'=>1],true)['data']==='original crop','Document slide editing uses the original crop, not the entire page');
}finally{foreach([$path,$path.'-wal',$path.'-shm'] as $file)if(is_file($file))unlink($file);}
