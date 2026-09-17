<?php
declare(strict_types=1);
require __DIR__.'/../app/ingest.php';
require __DIR__.'/../app/ai.php';
function check_analysis(bool $value,string $message): void { if(!$value)throw new RuntimeException($message);echo 'PASS '.$message."\n"; }
$e=['text'=>'Complete source text','preview'=>null,'warnings'=>[],'pages'=>[]];
for($n=1;$n<=5;$n++)$e['pages'][]=['number'=>$n,'text'=>'Evidence on page '.$n,'preview'=>'preview-'.$n,'images'=>[['number'=>1,'data'=>'crop-'.$n]],'palette'=>[['hex'=>'#668055','weight'=>1]]];
$calls=[];
$request=function($prompt,$content)use(&$calls){
    $calls[]=$content;$pages=[];
    foreach($content as $c)if(($c['type']??'')==='text'&&preg_match('/^PAGE (\d+)/',$c['text'],$m))$pages[]=['number'=>(int)$m[1],'category'=>'moodboard','style'=>'Japandi','evidence'=>'Oak and linen','confidence'=>'medium'];
    if($pages)return ['pages'=>[...$pages,['number'=>999,'category'=>'moodboard']]];
    return ['category'=>'moodboard','style'=>'Japandi','style_pages'=>[2,5,999]];
};
$r=analyze_file(['name'=>'source.pdf'],$e,$request);
check_analysis(count($calls)===3,'All five pages are analyzed in batches before the document summary');
check_analysis(count(array_filter($calls[0],fn($c)=>$c['type']==='image_url'))===8,'Page previews and separate crops are both sent as visual evidence');
check_analysis($r['style_pages']===[2,5]&&$r['analyzed_pages']===5,'Style evidence cites only actual analyzed pages');
check_analysis($e['pages'][4]['analysis']['style']==='Japandi','Later page analysis is retained for review');
$e2=$e;$e2['warnings']=[];$attempt=0;
$r=analyze_file(['name'=>'source.pdf'],$e2,function($prompt,$content)use(&$attempt,$request){if(++$attempt===1)throw new RuntimeException('Simulated unavailable AI');return $request($prompt,$content);});
check_analysis(count($e2['pages'])===5&&$e2['pages'][0]['images'][0]['data']==='crop-1'&&count($e2['warnings'])===1,'An AI batch failure preserves local extraction and reports incomplete visual analysis');
check_analysis($r['analyzed_pages']===1,'Partial analysis reports accurate coverage');

$visualInput=['text'=>'','preview'=>null,'warnings'=>[],'pages'=>[
    ['number'=>1,'text'=>'Before photo on the left. Concept rendering on the right.','preview'=>'page-context','analysis'=>['category'=>'presentation'],'palette'=>[],
     'text_blocks'=>[['text'=>'Before photo','bbox'=>[.05,.15,.4,.2]],['text'=>'Concept rendering','bbox'=>[.55,.15,.95,.2]]],
     'images'=>[['number'=>1,'data'=>'before-photo','bbox'=>[.05,.25,.4,.7]],['number'=>2,'data'=>'concept-render','bbox'=>[.55,.25,.95,.7]]]]]];
for($n=3;$n<=8;$n++)$visualInput['pages'][0]['images'][]=['number'=>$n,'data'=>'image-'.$n,'bbox'=>null];
$v=['id'=>'test','name'=>'mixed.pdf','mime'=>'application/pdf'];$calls=[];
$classified=classify_visuals($v,$visualInput,function($prompt,$content)use(&$calls){
    $calls[]=$content;$images=[];
    foreach($content as $part)if(($part['type']??'')==='text'&&preg_match('/^CLASSIFY IMAGE ([0-9:]+)/',$part['text'],$m)){
        $photo=$m[1]==='1:1';$images[]=['key'=>$m[1],'type'=>$photo?'photo':'render','situation'=>$photo?'before':'concept','title'=>$photo?'Existing room':'Proposed room','confidence'=>'high'];
    }
    return ['images'=>[...$images,['key'=>'9:999','type'=>'photo']]];
});
check_analysis(count($classified)===8&&count($calls)===2,'Every extracted image is classified, including crops beyond the first three or first batch');
check_analysis($classified[0]['type']==='photo'&&$classified[0]['situation']==='before'&&$classified[1]['type']==='render'&&$classified[1]['situation']==='concept','Before photos and concept renders on one page get independent labels');
$hints=visual_candidates($v,$visualInput);
check_analysis($hints[0]['type']==='photo'&&$hints[0]['situation']==='before'&&$hints[1]['type']==='render'&&$hints[1]['situation']==='concept','Nearby captions preserve mixed-page meaning without vision');
check_analysis(visual_text_hint('living-room.jpg')['type']==='other'&&visual_text_hint('beautiful photo')['situation']==='unknown','Unlabeled pictures are not automatically treated as before photos or renders');
$failedInput=$visualInput;$failedInput['warnings']=[];
$failed=classify_visuals($v,$failedInput,function(){throw new RuntimeException('Simulated service failure');});
check_analysis(count($failed)===8&&count($failedInput['warnings'])===2,'Failed classification keeps all images available for manual review');
