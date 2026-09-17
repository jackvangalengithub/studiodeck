<?php
declare(strict_types=1);

function processing_progress(string $stage,array $detail=[]): void {
    if(isset($GLOBALS['processing_job'])) {
        query("UPDATE jobs SET payload=?,started_at=? WHERE id=? AND status='running'",[json_encode(['progress'=>['stage'=>$stage,...$detail]],JSON_INVALID_UTF8_SUBSTITUTE),now(),$GLOBALS['processing_job']]);
    }
}
function extract_document(string $path,string $dir): array {
    processing_progress('reading_pages');
    $buffer='';
    run_process(['python3',ROOT.'/scripts/extract_document.py',$path,$dir],7200,function($chunk)use(&$buffer){
        $buffer.=$chunk;
        while(($pos=strpos($buffer,"\n"))!==false) {
            $line=substr($buffer,0,$pos);$buffer=substr($buffer,$pos+1);
            $p=json_decode($line,true);
            if(is_array($p)&&isset($p['stage']))processing_progress($p['stage'],array_diff_key($p,['stage'=>1]));
        }
    });
    $manifest=json_decode(file_get_contents($dir.'/manifest.json'),true);
    if(!is_array($manifest))throw new RuntimeException('Document extraction did not return readable results.');
    foreach($manifest['pages'] as &$page) {
        $fallback=suggested_style($page['text']);
        $page['analysis']=['category'=>category_for('','',$page['text']),'style'=>$fallback['style'],'summary'=>'','evidence'=>$fallback['reason'],'confidence'=>'low'];
        $page['preview']=$page['preview']?file_get_contents($dir.'/'.basename($page['preview'])):null;
        foreach($page['images'] as &$image) { $image['data']=file_get_contents($dir.'/'.basename($image['file']));unset($image['file']); }
        unset($image);
    }
    unset($page);
    return $manifest;
}
function document_palette(array $pages,string $category): array {
    $buckets=[];
    foreach($pages as $page) {
        $cat=$page['analysis']['category']??category_for('','',$page['text']);
        if(in_array($cat,['budget','drawings'],true))continue;
        $weight=$cat==='moodboard'?4:($category==='moodboard'?2:1);
        foreach($page['palette']??[] as $color) {
            $hex=$color['hex'];$rgb=sscanf($hex,'#%02x%02x%02x');$key=$hex;
            foreach($buckets as $k=>$bucket) { $sum=0;foreach($rgb as $n=>$value)$sum+=($value-$bucket['rgb'][$n])**2;if($sum<32**2){$key=$k;break;} }
            if(!isset($buckets[$key]))$buckets[$key]=['rgb'=>$rgb,'weight'=>0,'pages'=>[]];
            $buckets[$key]['weight']+=$weight*($color['weight']??.2);
            $buckets[$key]['pages'][$page['number']]=true;
        }
    }
    uasort($buckets,fn($a,$b)=>$b['weight']<=>$a['weight']);
    $result=[];foreach(array_slice($buckets,0,5,true) as $hex=>$bucket)$result[]=['hex'=>$hex,'pages'=>array_keys($bucket['pages'])];
    return $result;
}
function suggested_style(string $text): array {
    $rules=[
        'Japandi'=>'japandi', 'Scandinavian'=>'scandinavian|scandinavisch|nordic',
        'Industrial'=>'industrial|industrieel', 'Mid-century modern'=>'mid.century',
        'Warm minimalism'=>'warm minimal|minimalis', 'Mediterranean'=>'mediterranean|mediterraan',
        'Organic modern'=>'organic modern|organisch', 'Classic contemporary'=>'classic|klassiek',
    ];
    foreach($rules as $style=>$pattern)if(preg_match('/'.$pattern.'/i',$text,$match))return ['style'=>$style,'font'=>in_array($style,['Industrial','Scandinavian','Warm minimalism'])?'sans':'serif','reason'=>'Source text mentions “'.$match[0].'”.','confidence'=>'low'];
    return ['style'=>'','font'=>'serif','reason'=>'No clear style evidence yet. Review the extracted pages or connect visual analysis.','confidence'=>'low'];
}
function save_document_pages(string $vid,array $pages): void {
    query('DELETE FROM document_pages WHERE version_id=?',[$vid]);
    foreach($pages as $page) {
        $metadata=$page;unset($metadata['text'],$metadata['preview'],$metadata['images']);
        insert('document_pages',['version_id'=>$vid,'number'=>$page['number'],'text'=>$page['text'],'metadata'=>json_encode($metadata,JSON_INVALID_UTF8_SUBSTITUTE),'preview'=>$page['preview']]);
        foreach($page['images'] as $image) {
            $meta=$image;unset($meta['data']);
            insert('document_images',['version_id'=>$vid,'page_number'=>$page['number'],'number'=>$image['number'],'metadata'=>json_encode($meta,JSON_INVALID_UTF8_SUBSTITUTE),'data'=>$image['data']]);
        }
    }
}
function document_page_summaries(string $vid): array {
    $pages=rows('SELECT number,metadata,LENGTH(text) AS text_length,CASE WHEN preview IS NOT NULL THEN 1 ELSE 0 END AS has_preview FROM document_pages WHERE version_id=? ORDER BY number',[$vid]);
    foreach($pages as &$page) {
        $meta=json_decode($page['metadata'],true)?:[];
        $images=rows('SELECT number,LENGTH(data) AS size FROM document_images WHERE version_id=? AND page_number=? ORDER BY number',[$vid,$page['number']]);
        $page=['number'=>$page['number'],'has_preview'=>$page['has_preview'],'has_text'=>$page['text_length']>0,'images'=>$images,'image_count'=>(int)one('SELECT COUNT(*) AS n FROM document_images WHERE version_id=? AND page_number=?',[$vid,$page['number']])['n'],'palette'=>$meta['palette']??[],'category'=>$meta['analysis']['category']??'','summary'=>$meta['analysis']['summary']??''];
    }
    return $pages;
}
