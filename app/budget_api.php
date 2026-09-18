<?php
declare(strict_types=1);
function budget_form_properties(array $b): array {
    $type=$b['price_type']??(($b['kind']??'')==='unknown'?'unknown':'fixed');
    if(!in_array($type,['fixed','range','unknown'],true))fail('Choose a fixed price, a price range or an unspecified price.');
    $low=$type==='range'?money_cents($b['min_amount']??''):null;$high=$type==='range'?money_cents($b['max_amount']??''):null;
    if($type==='range'&&($low===null||$high===null||$low<0||$high<$low))fail('Enter both range prices. The luxury price must be at least the budget price.');
    return ['min_amount_cents'=>$low,'max_amount_cents'=>$high,'is_optional'=>!empty($b['is_optional'])?1:0];
}
if($action==='budget_choice'){
    $b=input();[$i,$actor,$designer]=access_iteration(text_field($b['iteration']??''),true);
    $result=transaction(function()use($b,$i,$actor,$designer){
        // Recheck authorization after acquiring the write lock (including revoked links).
        access_iteration($i['id'],true);
        $item=one('SELECT * FROM budget_items WHERE id=? AND iteration_id=?',[text_field($b['id']??''),$i['id']]);if(!$item)fail('Budget item not found.',404);
        $current=one('SELECT * FROM budget_choices WHERE budget_item_id=?',[$item['id']]);$selected=(int)($current['selected']??0);$percent=(int)($current['range_percent']??0);
        if(array_key_exists('selected',$b)){if(empty($item['is_optional']))fail('Only optional items can be selected.');if(!is_bool($b['selected']))fail('Choose whether to include this option.');$selected=$b['selected']?1:0;}
        if(array_key_exists('range_percent',$b)){if(!budget_is_range($item))fail('This item has no price range.');if(!is_int($b['range_percent'])||$b['range_percent']<0||$b['range_percent']>100)fail('Choose a position between Budget and Luxury.');$percent=$b['range_percent'];}
        if(!array_key_exists('selected',$b)&&!array_key_exists('range_percent',$b))fail('Choose an option or a range position.');
        query('INSERT INTO budget_choices (budget_item_id,selected,range_percent,updated_by,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(budget_item_id) DO UPDATE SET selected=excluded.selected,range_percent=excluded.range_percent,updated_by=excluded.updated_by,updated_at=excluded.updated_at',[$item['id'],$selected,$percent,$actor,now()]);
        $detail=$item['label'].': '.(!empty($item['is_optional'])?($selected?'option selected':'option not selected').'; ':'').(budget_is_range($item)?'Budget–Luxury '.$percent.'%; selected amount €'.number_format(budget_amount($item,$percent)/100,2,'.',''):'fixed price');
        audit($i['project_id'],$i['id'],$actor,'budget_choice_updated',$detail);
        return budget_payload($i['id'],$designer);
    });json_response($result);
}
