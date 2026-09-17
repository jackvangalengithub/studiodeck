<?php
declare(strict_types=1);
require_once __DIR__.'/bootstrap.php';
require_once __DIR__.'/documents.php';
require_once __DIR__.'/slides.php';

function category_for(string $name,string $mime,string $text=''): string {
    $rules=['budget'=>'budget|quote|offerte|begroting|cost|invoice','moodboard'=>'mood|material|styling|palette|sfeer','drawings'=>'drawing|floor.?plan|plattegrond|construction|detail|technical|tekening','renders'=>'render|3d|visualisation|visualization|interior|photo'];
    // A cost row mentioning styling must not turn an explicitly named budget into a moodboard.
    foreach($rules as $category=>$pattern)if(preg_match('/'.$pattern.'/i',$name))return $category;
    if(preg_match('/\.(xlsx?|csv)$/i',$name))return 'budget';
    foreach($rules as $category=>$pattern)if(preg_match('/'.$pattern.'/i',substr($text,0,1500)))return $category;
    if(str_starts_with($mime,'image/'))return 'renders';
    if(preg_match('/\.pptx?$/i',$name))return 'presentation';
    return 'other';
}
function validate_upload(string $name,string $path): string {
    $ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    $allowed=['pdf'=>['application/pdf'],'png'=>['image/png'],'jpg'=>['image/jpeg'],'jpeg'=>['image/jpeg'],'webp'=>['image/webp'],'pptx'=>['application/zip','application/vnd.openxmlformats-officedocument.presentationml.presentation'],'xlsx'=>['application/zip','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],'ppt'=>['application/vnd.ms-powerpoint','application/x-ole-storage','application/CDFV2'],'xls'=>['application/vnd.ms-excel','application/x-ole-storage','application/CDFV2'],'csv'=>['text/plain','text/csv','application/csv']];
    if(!isset($allowed[$ext]))fail('Supported files: PDF, PowerPoint, Excel, CSV, JPG, PNG and WebP.');
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($path);
    if(!in_array($mime,$allowed[$ext],true))fail('The contents of '.$name.' do not match its file type.');
    if(in_array($ext,['xlsx','pptx'],true)) {
        $z=open_office_zip($path); $required=$ext==='xlsx'?'xl/workbook.xml':'ppt/presentation.xml';
        if($z->locateName($required)===false)fail('This Office file is not valid.'); $z->close();
        $mime=$allowed[$ext][1];
    }
    if(str_starts_with($mime,'image/')) { $size=@getimagesize($path); if(!$size || $size[0]*$size[1]>40000000)fail('Please use an image smaller than 40 megapixels.'); }
    return $mime;
}
function open_office_zip(string $path): ZipArchive {
    $z=new ZipArchive; if($z->open($path)!==true)fail('This Office file cannot be opened.');
    if($z->numFiles>4000)fail('This Office file has too many embedded parts.');
    $total=0; for($i=0;$i<$z->numFiles;$i++) { $s=$z->statIndex($i); $total+=$s['size']; if($total>100*1024*1024)fail('This Office file expands beyond the import limit.'); }
    return $z;
}
function safe_xml(string $s): SimpleXMLElement|false {
    if(stripos($s,'<!DOCTYPE')!==false || stripos($s,'<!ENTITY')!==false)return false;
    return simplexml_load_string($s,SimpleXMLElement::class,LIBXML_NONET|LIBXML_NOERROR|LIBXML_NOWARNING);
}
function xml_text(string $s): string {
    $xml=safe_xml($s); if(!$xml)return '';
    $texts=$xml->xpath('//*[local-name()="t"]')?:[];
    return implode(' ',array_map(fn($n)=>(string)$n,$texts));
}
function run_process(array $command,int $timeout=45,?callable $onOutput=null): string {
    $pipes=[]; $proc=proc_open($command,[0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes);
    if(!is_resource($proc))throw new RuntimeException('Document conversion is unavailable.');
    fclose($pipes[0]);stream_set_blocking($pipes[1],false);stream_set_blocking($pipes[2],false);
    $start=time();$heartbeat=0;$out='';$error='';
    try {
        while(true) {
            $chunk=stream_get_contents($pipes[1]);$out.=$chunk;if($onOutput&&$chunk!=='')$onOutput($chunk);
            $error.=stream_get_contents($pipes[2]);$status=proc_get_status($proc);
            if(!$status['running'])break;
            if(time()-$start>$timeout||strlen($out)>2000000||strlen($error)>1000000) { proc_terminate($proc,9);throw new RuntimeException('Document conversion timed out.'); }
            if(isset($GLOBALS['processing_job'])&&time()-$heartbeat>=5) { query('UPDATE jobs SET started_at=? WHERE id=?',[now(),$GLOBALS['processing_job']]);$heartbeat=time(); }
            usleep(20000);
        }
        $chunk=stream_get_contents($pipes[1]);$out.=$chunk;if($onOutput&&$chunk!=='')$onOutput($chunk);
        if($status['exitcode']!==0)throw new RuntimeException('Document conversion is unavailable or the file could not be read.');
        return $out;
    } finally { fclose($pipes[1]);fclose($pipes[2]);proc_close($proc); }
}
function xlsx_rows(string $path): array {
    $z=open_office_zip($path); $shared=[];
    if($s=$z->getFromName('xl/sharedStrings.xml')) { $x=safe_xml($s); foreach($x ? ($x->xpath('//*[local-name()="si"]')?:[]) : [] as $n)$shared[]=xml_text($n->asXML()); }
    $result=[];
    for($n=0;$n<$z->numFiles;$n++) {
        $name=$z->getNameIndex($n); if(!preg_match('~^xl/worksheets/sheet\d+\.xml$~',$name))continue;
        $x=safe_xml($z->getFromIndex($n)); if(!$x)continue;
        foreach($x->xpath('//*[local-name()="row"]')?:[] as $row) {
            $cells=[];
            foreach($row->xpath('./*[local-name()="c"]')?:[] as $c) {
                $col=preg_replace('/\d/','',(string)$c['r']); $index=0; foreach(str_split($col) as $letter)$index=$index*26+ord($letter)-64; $index=max(0,$index-1);
                $v=$c->xpath('./*[local-name()="v"]'); $value=(string)($v[0]??'');
                if((string)$c['t']==='s')$value=$shared[(int)$value]??'';
                if((string)$c['t']==='inlineStr')$value=xml_text($c->asXML());
                $cells[$index]=$value;
            }
            if($cells) { $line=array_fill(0,min(128,max(array_keys($cells))+1),''); foreach($cells as $k=>$v)if($k<128)$line[$k]=$v; $result[]=$line; }
            if(count($result)>=5000)break 2;
        }
    }
    $z->close(); return $result;
}
function money_cents(mixed $s): ?int {
    $s=trim((string)$s); if($s==='' || preg_match('/^(tbd|unknown|unspecified|n\/a|pm|p\.m\.)$/i',$s))return null;
    $s=preg_replace('/[^\d,.\-]/','',$s); if(!preg_match('/\d/',$s))return null;
    if(str_contains($s,',')&&str_contains($s,'.')) { $s=strrpos($s,',')>strrpos($s,'.')?str_replace(',','.',str_replace('.','',$s)):str_replace(',','',$s); }
    elseif(str_contains($s,',')) { $s=preg_match('/,\d{1,2}$/',$s)?str_replace(',','.',$s):str_replace(',','',$s); }
    if(!is_numeric($s))return null;
    $n=(float)$s; if(abs($n)>100000000)throw new RuntimeException('An amount exceeds the supported range.');
    return (int)round($n*100);
}
function table_budget(array $table): array {
    $items=[]; $headers=null;
    foreach($table as $r) {
        $normalized=array_map(fn($v)=>strtolower(trim((string)$v)),$r);
        if(in_array('label',$normalized,true)&&in_array('amount',$normalized,true)) { $headers=$normalized; continue; }
        if(!$headers)continue;
        $v=[];foreach($headers as $k=>$h)if($h!=='')$v[$h]=(string)($r[$k]??'');
        if(empty($v['label']) || preg_match('/^(grand total|total|totaal)$/i',$v['label']))continue;
        $items[]=['key'=>$v['key']??$v['label'],'label'=>$v['label'],'vendor'=>$v['vendor']??'','amount_cents'=>money_cents($v['amount']??''),'kind'=>in_array($v['kind']??'',['quote','estimate','unknown'],true)?$v['kind']:'estimate','parent'=>$v['parent']??'','included'=>in_array(strtolower($v['included']??''),['1','true','yes'],true),'note'=>$v['note']??''];
    }
    return $items;
}
function replace_source_budget(string $iid,string $vid,array $items): void {
    // Delete only this asset's previous imported rows in the editable snapshot.
    $asset=one('SELECT asset_id FROM file_versions WHERE id=?',[$vid]);
    $old=rows('SELECT b.id FROM budget_items b JOIN file_versions v ON v.id=b.source_version_id WHERE b.iteration_id=? AND v.asset_id=?',[$iid,$asset['asset_id']]);
    foreach($old as $r)query('UPDATE budget_items SET parent_id=NULL WHERE parent_id=?',[$r['id']]);
    foreach($old as $r)query('DELETE FROM budget_items WHERE id=?',[$r['id']]);
    $map=[]; foreach(array_slice($items,0,300) as $n=>$item) { $key=(string)($item['key']??$n); if(isset($map[$key]))throw new RuntimeException('Duplicate budget reference. Please review the source.'); $map[$key]=id(); }
    foreach(array_slice($items,0,300) as $n=>$item) {
        $key=(string)($item['key']??$n); $parent=$map[(string)($item['parent']??'')]??null;
        insert('budget_items',['id'=>$map[$key],'iteration_id'=>$iid,'parent_id'=>null,'source_version_id'=>$vid,'label'=>substr((string)($item['label']??'Unnamed item'),0,300),'vendor'=>substr((string)($item['vendor']??''),0,200),'amount_cents'=>isset($item['amount_cents'])?(int)$item['amount_cents']:null,'kind'=>in_array($item['kind']??'',['quote','estimate','unknown'],true)?$item['kind']:'estimate','included'=>$parent&&!empty($item['included'])?1:0,'note'=>substr((string)($item['note']??''),0,2000)]);
    }
    foreach(array_slice($items,0,300) as $n=>$item) {
        $key=(string)($item['key']??$n); $p=(string)($item['parent']??'');
        if(!isset($map[$p]) || $p===$key)continue;
        $seen=[$key=>true]; $cursor=$p;
        while($cursor!=='' && isset($map[$cursor])) { if(isset($seen[$cursor]))throw new RuntimeException('Circular subquote references. Please review the source.'); $seen[$cursor]=true; $next=''; foreach($items as $j=>$candidate)if((string)($candidate['key']??$j)===$cursor)$next=(string)($candidate['parent']??''); $cursor=$next; }
        query('UPDATE budget_items SET parent_id=? WHERE id=?',[$map[$p],$map[$key]]);
    }
}
function extract_version(array $v): array {
    $dir=sys_get_temp_dir().'/studiodeck-'.id(); mkdir($dir,0700); $ext=strtolower(pathinfo($v['name'],PATHINFO_EXTENSION)); $path=$dir.'/source.'.$ext; file_put_contents($path,$v['data']);
    $text='';$preview=null;$table=[];$warnings=[];$pages=[];$pageCount=0;
    try {
        if($ext==='xls') {
            $target='xlsx';
            run_process(['libreoffice','-env:UserInstallation=file://'.$dir.'/lo-profile','--headless','--convert-to',$target,'--outdir',$dir,$path],60);
            $path=$dir.'/source.'.$target; $ext=$target;
            if(!is_file($path))throw new RuntimeException('Legacy Office conversion is unavailable.');
        }
        if(in_array($ext,['pdf','ppt','pptx'],true)) {
            $document=extract_document($path,$dir);$pages=$document['pages'];$pageCount=$document['page_count'];$warnings=$document['warnings'];
            $text=implode("\n\n",array_map(fn($p)=>'--- Page '.$p['number']." ---\n".$p['text'],$pages));
            foreach($pages as $p) { if(!$preview&&$p['preview'])$preview=png_preview($p['preview']);foreach($p['warnings'] as $w)$warnings[]='Page '.$p['number'].': '.$w; }
            if(!$pages)$warnings[]='No pages could be extracted. Review the original or try exporting it as a PDF.';
        } elseif($ext==='xlsx') {
            $table=xlsx_rows($path);$text=implode("\n",array_map(fn($r)=>implode(' | ',$r),$table)); $warnings[]='Spreadsheet formulas use saved values. Confirm totals against the original workbook.';
        } elseif($ext==='csv') {
            $h=fopen($path,'r');$sample=fgets($h);rewind($h);$separator=substr_count($sample?:'', ';')>substr_count($sample?:'', ',')?';':',';
            while(($r=fgetcsv($h,0,$separator,'"',''))!==false && count($table)<5000)$table[]=$r;fclose($h);$text=implode("\n",array_map(fn($r)=>implode(' | ',$r),$table));
        }
        if(str_starts_with($v['mime'],'image/'))$preview=png_preview($v['data']);
    } catch(Throwable $e) { $warnings[]=$e->getMessage(); }
    finally { remove_temp_dir($dir); }
    return ['text'=>substr($text,0,150000),'preview'=>$preview,'items'=>table_budget($table),'warnings'=>$warnings,'pages'=>$pages,'page_count'=>$pageCount];
}
function remove_temp_dir(string $dir): void { foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir,FilesystemIterator::SKIP_DOTS),RecursiveIteratorIterator::CHILD_FIRST) as $f) { if($f->isDir())rmdir($f->getPathname());else unlink($f->getPathname()); } rmdir($dir); }
function png_preview(string $raw): ?string {
    if(!function_exists('imagecreatefromstring'))return null;
    $dim=@getimagesizefromstring($raw); if(!$dim || $dim[0]*$dim[1]>40000000)return null;
    $im=@imagecreatefromstring($raw);if(!$im)return null;$w=imagesx($im);$h=imagesy($im);$ratio=min(1,1500/max($w,$h));$small=imagescale($im,max(1,(int)($w*$ratio)),max(1,(int)($h*$ratio)));ob_start();imagepng($small);$png=ob_get_clean();imagedestroy($im);imagedestroy($small);return $png;
}
function palette(string $raw): array {
    if(!function_exists('imagecreatefromstring'))return [];
    $dim=@getimagesizefromstring($raw);if(!$dim||$dim[0]*$dim[1]>40000000)return [];
    $im=@imagecreatefromstring($raw);if(!$im)return [];$small=imagescale($im,96,96);$bins=[];
    for($x=0;$x<96;$x++)for($y=0;$y<96;$y++) {
        $c=imagecolorsforindex($small,imagecolorat($small,$x,$y));$rgb=[$c['red'],$c['green'],$c['blue']];
        if($c['alpha']>64||min($rgb)>246||max($rgb)<9)continue;
        $key=implode(',',array_map(fn($n)=>(int)floor($n/24),$rgb));
        if(!isset($bins[$key]))$bins[$key]=['n'=>0,'sum'=>[0,0,0]];
        $bins[$key]['n']++;foreach($rgb as $n=>$value)$bins[$key]['sum'][$n]+=$value;
    }
    imagedestroy($im);imagedestroy($small);uasort($bins,fn($a,$b)=>$b['n']<=>$a['n']);$colors=[];
    foreach($bins as $bin) {
        $rgb=array_map(fn($sum)=>(int)round($sum/$bin['n']),$bin['sum']);$duplicate=false;
        foreach($colors as $old) { $distance=0;foreach($rgb as $n=>$value)$distance+=($value-$old[$n])**2;if($distance<32**2){$duplicate=true;break;} }
        if(!$duplicate)$colors[]=$rgb;if(count($colors)===5)break;
    }
    return array_map(fn($rgb)=>sprintf('#%02x%02x%02x',...$rgb),$colors);
}
