<?php
declare(strict_types=1);
function budget_form_properties(array $b): array {
    $type=$b['price_type']??(($b['kind']??'')==='unknown'?'unknown':'fixed');
    if(!in_array($type,['fixed','range','unknown'],true))fail('Choose a fixed price, a price range or an unspecified price.');
    $low=$type==='range'?money_cents($b['min_amount']??''):null;$high=$type==='range'?money_cents($b['max_amount']??''):null;
    if($type==='range'&&($low===null||$high===null||$low<0||$high<$low))fail('Enter both range prices. The luxury price must be at least the budget price.');
    return ['min_amount_cents'=>$low,'max_amount_cents'=>$high,'is_optional'=>!empty($b['is_optional'])?1:0];
}
