<?php
declare(strict_types=1);

// Search only the exact source versions attached to the authorized iteration.
function legal_evidence(string $iid,string $question): array {
    $files=rows("SELECT v.id,v.name,v.metadata FROM iteration_files f JOIN file_versions v ON v.id=f.version_id WHERE f.iteration_id=? AND f.category='legal' ORDER BY v.id",[$iid]);
    $terms=preg_split('/[^\pL\pN]+/u',strtolower($question),-1,PREG_SPLIT_NO_EMPTY);
    $stop=['does','it','include','includes','included','the','and','are','this','that','what','with','for','from','can','you','is','of','in','a','to','het','de','een','en','zit','er','bij'];
    $terms=array_values(array_filter($terms,fn($t)=>strlen($t)>2&&!in_array($t,$stop,true)));
    foreach([['paint','painting','paintwork','verf','schilderwerk','schilderen'],['garbage','waste','rubbish','debris','afval','puin'],['removal','disposal','afvoer','verwijderen']] as $synonyms)if(array_intersect($terms,$synonyms))$terms=array_merge($terms,$synonyms);
    $terms=array_unique($terms);$chunks=[];$warnings=[];$total=0;
    foreach($files as $file){
        $meta=json_decode($file['metadata'],true)?:[];if(!empty($meta['warnings']))$warnings[]=$file['name'].': '.implode(' ',array_slice($meta['warnings'],0,6));
        $pages=rows('SELECT number,text FROM document_pages WHERE version_id=? ORDER BY number',[$file['id']]);
        if(!$pages){$warnings[]=$file['name'].': page text has not been extracted yet.';continue;}
        if(($meta['page_count']??count($pages))>count($pages))$warnings[]=$file['name'].': extraction is incomplete.';
        foreach($pages as $page){
            $text=$page['text'];if(!trim($text))continue;
            // Overlap keeps clauses spanning chunk boundaries available together.
            $characters=preg_split('//u',$text,-1,PREG_SPLIT_NO_EMPTY)?:[];
            for($offset=0;$offset<count($characters);$offset+=2600){
                $excerpt=implode('',array_slice($characters,$offset,3000));$total++;$score=0;$lower=strtolower($excerpt);
                foreach($terms as $term)if(str_contains($lower,$term))$score+=1+min(3,substr_count($lower,$term))*.1;
                $chunks[]=['version_id'=>$file['id'],'name'=>$file['name'],'page'=>(int)$page['number'],'text'=>$excerpt,'score'=>$score,'offset'=>$offset];
            }
        }
    }
    usort($chunks,fn($a,$b)=>($b['score']<=>$a['score'])?:strcmp($a['version_id'],$b['version_id'])?:($a['page']<=>$b['page'])?:($a['offset']<=>$b['offset']));
    $selected=array_slice(array_values(array_filter($chunks,fn($c)=>$c['score']>0)),0,16);
    // Small sources can be read in full even if wording differs from the question.
    if(count($chunks)<=16)$selected=$chunks;
    foreach($selected as &$chunk){$chunk['citation']=$chunk['version_id'].':'.$chunk['page'];unset($chunk['score'],$chunk['offset']);}unset($chunk);
    return ['file_count'=>count($files),'total_chunks'=>$total,'partial'=>count($selected)<$total,'warnings'=>$warnings,'excerpts'=>$selected];
}
