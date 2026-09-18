<?php
declare(strict_types=1);
function budget_form_properties(array $b): array {
    $type=$b['price_type']??(($b['kind']??'')==='unknown'?'unknown':'fixed');
    if(!in_array($type,['fixed','range','unknown'],true))fail('Choose a fixed price, a price range or an unspecified price.');
    $low=$type==='range'?money_cents($b['min_amount']??''):null;$high=$type==='range'?money_cents($b['max_amount']??''):null;
    if($type==='range'&&($low===null||$high===null||$low<0||$high<$low))fail('Enter both range prices. The luxury price must be at least the budget price.');
    return ['min_amount_cents'=>$low,'max_amount_cents'=>$high,'is_optional'=>!empty($b['is_optional'])?1:0];
}
if($action==='match_subquotes'){
    $u=owner(true);$b=input();rate_limit('subquotes:'.$u['user_id'],12,3600);
    $jid=transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);
        if(!capabilities()['ai'])fail('Subquote matching is temporarily unavailable.',503);
        if(one("SELECT 1 FROM jobs WHERE iteration_id=? AND status IN ('queued','running')",[$i['id']]))fail('Wait for the current file processing to finish.',409);
        $sources=rows("SELECT version_id FROM iteration_files WHERE iteration_id=? AND category='budget'",[$i['id']]);
        if(count($sources)<2)fail('Add at least two quote or budget files to check their relationships.');
        $jid=id();insert('jobs',['id'=>$jid,'project_id'=>$i['project_id'],'iteration_id'=>$i['id'],'version_id'=>$sources[0]['version_id'],'type'=>'budget_match','payload'=>'{}','status'=>'queued','created_at'=>now()]);return $jid;
    });json_response(['id'=>$jid],202);
}
if($action==='review_subquote'){
    $u=owner(true);$b=input();
    transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$decision=$b['decision']??'';
        if(!in_array($decision,['dismiss','included','additional'],true))fail('Choose how this quote relates to the parent.');
        $s=one("SELECT * FROM budget_link_suggestions WHERE id=? AND iteration_id=? AND status='pending'",[text_field($b['id']??''),$i['id']]);if(!$s)fail('This suggestion has already been reviewed or changed.',409);
        if($decision!=='dismiss'){
            $child=one('SELECT * FROM budget_items WHERE id=? AND iteration_id=?',[$s['child_id'],$i['id']]);$parent=one('SELECT * FROM budget_items WHERE id=? AND iteration_id=?',[$s['parent_id'],$i['id']]);
            if(!$child||!$parent||$child['parent_id']||$child['relationship_locked'])fail('The quote relationship changed. Refresh to see its current state.',409);
            if(subquote_would_cycle(rows('SELECT id,parent_id FROM budget_items WHERE iteration_id=?',[$i['id']]),$child['id'],$parent['id']))fail('A quote cannot contain itself.');
            query("UPDATE budget_items SET parent_id=?,included=?,relationship_origin='manual',relationship_locked=1,relationship_evidence=? WHERE id=?",[$parent['id'],$decision==='included'?1:0,$s['evidence'],$child['id']]);
            query("UPDATE budget_link_suggestions SET status='dismissed' WHERE child_id=?",[$child['id']]);
        }else query("UPDATE budget_link_suggestions SET status='dismissed' WHERE id=?",[$s['id']]);
        audit($i['project_id'],$i['id'],$u['email'],'subquote_reviewed',$decision.': '.$s['evidence']);
    });json_response(['ok'=>true]);
}
if($action==='unlink_subquote'){
    $u=owner(true);$b=input();transaction(function()use($u,$b){
        $i=owned_iteration(text_field($b['iteration']??''),$u,true);$item=one('SELECT * FROM budget_items WHERE id=? AND iteration_id=?',[text_field($b['id']??''),$i['id']]);
        if(!$item||$item['relationship_origin']!=='auto')fail('This automatic link is no longer available.',409);
        query("UPDATE budget_items SET parent_id=NULL,included=0,relationship_origin='manual',relationship_locked=1,relationship_evidence='' WHERE id=?",[$item['id']]);
        query("UPDATE budget_link_suggestions SET status='dismissed' WHERE child_id=?",[$item['id']]);
        audit($i['project_id'],$i['id'],$u['email'],'subquote_unlinked',$item['label']);
    });json_response(['ok'=>true]);
}
if($action==='budget_choice'){
    $b=input();[$i,$actor,$designer]=access_iteration(text_field($b['iteration']??''),true);
    $result=transaction(function()use($b,$i,$actor,$designer){
        // Recheck authorization after acquiring the write lock (including revoked links).
        [$currentIteration]=access_iteration($i['id'],true);
        if(!empty($currentIteration['locked']))fail('This iteration is locked. Ask a studio admin to unlock it, or create a new iteration to make changes.',409);
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
