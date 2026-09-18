<?php
// A populated legacy table must retain all slide fields when allowing manual slides.
$path=tempnam(sys_get_temp_dir(),'slides-');putenv('DATABASE_PATH='.$path);
require __DIR__.'/../app/slide_editor.php';
$db=new PDO('sqlite:'.$path,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
try{
 $db->exec(file_get_contents(__DIR__.'/../app/schema.sql'));
 $db->exec("INSERT INTO presentation_slides(id,iteration_id,source_version_id,page_number,image_number,type,situation,title,description,metadata,position,image_version_id) VALUES('slide','iteration','source',3,2,'render','concept','Existing design','Keep this caption','{\"palette\":[]}',17,'variant')");
 $before=$db->query('SELECT * FROM presentation_slides')->fetch();migrate_manual_slides($db);migrate_manual_slides($db);
 $after=$db->query('SELECT * FROM presentation_slides')->fetch();$manual=$after['manual'];unset($after['manual']);
 if($before!==$after||$manual!==0)throw new RuntimeException('Legacy slide changed during migration');
 $db->exec("INSERT INTO presentation_slides(id,iteration_id,type,title,position,manual) VALUES('text','iteration','text','Our story',18,1)");
 $db->exec("INSERT INTO presentation_slides(id,iteration_id,source_version_id,page_number,image_number,type,title,position,manual) VALUES('copy','iteration','source',3,2,'fullphoto','Our introduction',19,1)");
 echo "PASS Legacy slide migration preserves source, image variant, content and position; manual text and image reuse are allowed.\n";
}finally{unset($db);unlink($path);}
