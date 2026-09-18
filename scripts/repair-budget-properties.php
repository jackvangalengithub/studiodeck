<?php
// Recover explicit ranges/option flags from older extraction notes. Defaults to preview only.
require __DIR__.'/../app/ingest.php';
$options=getopt('',['project:','apply']);$pid=$options['project']??'';
if(!$pid){fwrite(STDERR,"Usage: php scripts/repair-budget-properties.php --project=PROJECT_ID [--apply]\n");exit(1);}
$changes=transaction(function()use($pid,$options){
    $changes=[];foreach(rows("SELECT b.* FROM budget_items b JOIN iterations i ON i.id=b.iteration_id WHERE i.project_id=? AND i.locked=0 AND b.source_version_id IS NOT NULL",[$pid]) as $item){
        $evidence=$item;unset($evidence['is_optional']);$p=budget_evidence_properties($evidence);$p['is_optional']=max((int)$item['is_optional'],$p['is_optional']);
        if($item['min_amount_cents']===$p['min_amount_cents']&&$item['max_amount_cents']===$p['max_amount_cents']&&(int)$item['is_optional']===$p['is_optional'])continue;
        $changes[]=['id'=>$item['id'],'label'=>$item['label'],...$p];
        if(isset($options['apply']))query('UPDATE budget_items SET min_amount_cents=?,max_amount_cents=?,is_optional=? WHERE id=?',[...array_values($p),$item['id']]);
    }
    if(isset($options['apply'])&&$changes)audit($pid,'','system','budget_properties_recovered',count($changes).' budget rows recovered from their explicit source extraction notes.');
    return $changes;
});
echo json_encode(['applied'=>isset($options['apply']),'changes'=>$changes],JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)."\n";
