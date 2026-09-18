<?php
require __DIR__.'/../app/budget.php';
$items=[['id'=>'parent','amount_cents'=>100000],['id'=>'included','parent_id'=>'parent','amount_cents'=>40000,'included'=>1],['id'=>'option','parent_id'=>'parent','amount_cents'=>25000,'is_optional'=>1,'selected'=>false],['id'=>'extra','parent_id'=>'included','amount_cents'=>5000,'is_optional'=>1,'selected'=>true]];
function same($a,$b){if($a!==$b)throw new RuntimeException("Expected $b, got $a");}
same(budget_line_total($items[0],$items),105000);$items[2]['selected']=true;same(budget_line_total($items[0],$items),130000);same(budget_total($items),130000);
$items[2]['min_amount_cents']=20000;$items[2]['max_amount_cents']=40000;$items[2]['range_percent']=50;same(budget_line_total($items[0],$items),135000);
$items[0]['amount_cents']=null;same(budget_line_total($items[0],$items),35000);same(budget_line_total(['id'=>'unknown'],$items),null);
echo "PASS PHP parent rollups match selected optional costs, ranges and included subquotes.\n";
