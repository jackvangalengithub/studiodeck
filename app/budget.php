<?php
declare(strict_types=1);

function migrate_budget(PDO $db): void {
    $db->exec('BEGIN IMMEDIATE');
    try{
        $columns=array_column($db->query('PRAGMA table_info(budget_items)')->fetchAll(),'name');
        foreach(['min_amount_cents'=>'INTEGER','max_amount_cents'=>'INTEGER','is_optional'=>'INTEGER NOT NULL DEFAULT 0'] as $name=>$type)if(!in_array($name,$columns,true))$db->exec("ALTER TABLE budget_items ADD COLUMN $name $type");
        $db->exec('COMMIT');
    }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
}
function budget_is_range(array $item): bool { return isset($item['min_amount_cents'],$item['max_amount_cents']); }
function budget_amount(array $item,?int $percent=null): ?int {
    if(budget_is_range($item)){$low=(int)$item['min_amount_cents'];$high=(int)$item['max_amount_cents'];$p=max(0,min(100,$percent??(int)($item['range_percent']??0)));return $low+intdiv(($high-$low)*$p+50,100);}
    return isset($item['amount_cents'])?(int)$item['amount_cents']:null;
}
function budget_enabled(array $item,array $byId): bool {
    $seen=[];
    while(true){if(!empty($item['is_optional'])&&empty($item['selected']))return false;$parent=$item['parent_id']??null;if(!$parent||!isset($byId[$parent]))return true;if(isset($seen[$parent]))return false;$seen[$parent]=true;$item=$byId[$parent];}
}
function budget_total(array $items,?int $percent=null): int {
    $total=0;$byId=array_column($items,null,'id');foreach($items as $item)if(empty($item['included'])&&budget_enabled($item,$byId))$total+=budget_amount($item,$percent)??0;return $total;
}
function budget_rows(string $iid): array {
    $items=rows('SELECT b.*,c.selected AS choice_selected,c.range_percent,c.updated_at AS choice_updated_at,c.updated_by AS choice_updated_by FROM budget_items b LEFT JOIN budget_choices c ON c.budget_item_id=b.id WHERE b.iteration_id=? ORDER BY b.rowid',[$iid]);
    foreach($items as &$item){$item['selected']=empty($item['is_optional'])||!empty($item['choice_selected']);$item['range_percent']=(int)($item['range_percent']??0);$item['effective_amount_cents']=budget_amount($item);unset($item['choice_selected']);}unset($item);
    return $items;
}
function budget_payload(string $iid,bool $designer=true): array {
    $items=budget_rows($iid);if(!$designer)foreach($items as &$item)unset($item['choice_updated_by']);unset($item);
    return ['budget'=>$items,'total_cents'=>budget_total($items),'budget_min_cents'=>budget_total($items,0),'budget_max_cents'=>budget_total($items,100)];
}
// Recover only explicit old extraction evidence; never infer prices from descriptive text.
function budget_evidence_properties(array $item): array {
    $low=$item['min_amount_cents']??null;$high=$item['max_amount_cents']??null;$note=(string)($item['note']??'');
    if($low===null&&$high===null&&!isset($item['amount_cents'])&&preg_match('/Indicative range\s*€\s*([\d.,]+)\s*[–—-]\s*€?\s*([\d.,]+)/u',$note,$m)){$low=money_cents($m[1]);$high=money_cents($m[2]);}
    if(($low===null)!==($high===null)||($low!==null&&(!is_numeric($low)||!is_numeric($high)||$low<0||$high<$low||$high>10000000000)))throw new RuntimeException('A budget range needs valid lower and upper prices. Please review the source.');
    $optional=$item['is_optional']??(bool)preg_match('/^(?:Page\s+\d+\.\s*)?(?:Optional\b|Optioneel\b)/i',$note);
    return ['min_amount_cents'=>$low===null?null:(int)$low,'max_amount_cents'=>$high===null?null:(int)$high,'is_optional'=>in_array($optional,[true,1,'1'],true)?1:0];
}
