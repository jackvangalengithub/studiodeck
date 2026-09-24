<?php
declare(strict_types=1);

// Show the full project directory; listing a contact never grants access.
function confirmation_recipients(array $i): array {
    $activeClients=array_column(rows('SELECT DISTINCT email FROM shares WHERE iteration_id=? AND revoked=0 AND expires_at>?',[$i['id'],time()]),'email');
    $user=current_session();$canInvite=$user&&!str_starts_with($_SERVER['HTTP_AUTHORIZATION']??'','Client ')&&project_member($i['project_id'],$user['user_id']);
    $people=[];
    foreach(project_directory($i['project_id']) as $group=>$members)foreach($members as $p){
        $email=strtolower(trim($p['email']??''));
        $available=$email!==''&&($group==='team'||($group==='clients'&&$i['status']==='shared'&&in_array($email,$activeClients,true)));
        $people[]=['email'=>$email,'name'=>$p['name'],'role'=>$p['role']??$group,'group'=>$group,'available'=>$available,'invitable'=>$canInvite&&$email!==''&&!$available,'unavailable_reason'=>$available?'':($email===''?'missing_email':'needs_access')];
    }
    return $people;
}
function communication_payload(array $i): array {
    return ['guests'=>rows('SELECT g.id,g.root_id,g.name,g.email,g.revoked,g.expires_at FROM conversation_grants g JOIN comments c ON c.id=g.root_id WHERE c.iteration_id=?',[$i['id']]),'recipients'=>confirmation_recipients($i),'actor'=>current_session()['email']??'',
        'threads'=>rows('SELECT t.comment_id AS id,t.title FROM communication_threads t JOIN comments c ON c.id=t.comment_id WHERE c.iteration_id=? ORDER BY c.created_at,c.rowid',[$i['id']]),
        'confirmations'=>rows('SELECT r.*,c.iteration_id,c.parent_id,c.slide,c.author,c.body,c.created_at FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id WHERE c.iteration_id=? ORDER BY c.created_at,c.rowid',[$i['id']]),
        'attachments'=>rows('SELECT a.comment_id,v.id,v.name,v.number,v.mime FROM comment_attachments a JOIN comments c ON c.id=a.comment_id JOIN file_versions v ON v.id=a.version_id WHERE c.iteration_id=?',[$i['id']])];
}
function confirmation_amount(mixed $value): ?int {
    if($value===null)return null;
    if(!is_string($value)||!preg_match('/^[+-]?\d{1,7}(?:[.,]\d{1,2})?$/D',trim($value)))fail('Enter a positive or negative budget change, with at most two decimals.');
    $s=str_replace(',','.',trim($value));$negative=str_starts_with($s,'-');$parts=explode('.',ltrim($s,'+-'));
    return ($negative?-1:1)*((int)$parts[0]*100+(int)str_pad($parts[1]??'',2,'0'));
}
function post_communication(array $b): array {
    return transaction(function()use($b){
        $scoped=text_field($b['conversation']??'',80);
        if($scoped){$g=conversation_access($scoped,true);$i=one('SELECT * FROM iterations WHERE id=?',[$g['iteration_id']]);$actor=authenticated_user(true)['email'];$isOwner=false;if(isset($b['iteration'])&&$b['iteration']!==$i['id'])fail('Conversation not found.',404);}
        else [$i,$actor,$isOwner]=access_iteration(text_field($b['iteration']??''),true);
        $checklistId=text_field($b['checklist_id']??'',80);
        if($checklistId){
            if(!$isOwner||$scoped)fail('Only the project team can link checklist approvals.',403);
            owned_iteration($i['id'],current_session(),true);
            $checklist=one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$checklistId]);
            if(!$checklist||(!$checklist['accepted']&&!$checklist['published'])||$checklist['dismissed'])fail('Checklist item not found.',404);
            if(empty($b['recipient']))fail('Choose a person to confirm this request.');
            if($checklist['confirmation_id']&&one("SELECT 1 FROM comment_confirmations WHERE comment_id=? AND status='pending'",[$checklist['confirmation_id']]))fail('This checklist item already has a pending confirmation.',409);
        }
        if(isset($checklist)){
            $root=ensure_checklist_thread($checklist,$actor);
            $b['related_thread_id']=$root;
        }
        $relatedId=text_field($b['related_thread_id']??'',80);
        $related=$relatedId?one('SELECT * FROM comments WHERE id=? AND iteration_id=? AND parent_id IS NULL',[$relatedId,$i['id']]):null;
        if($relatedId){
            if($scoped&&(isset($b['slide'])||isset($b['annotation'])))fail('Linked guest threads cannot add project feedback pins.',403);
            if(($scoped&&$relatedId!==$scoped)||!$related)fail('Related conversation not found.',404);
            communication_guard($related,$isOwner||!!$scoped);
            if(!empty($b['parent_id']))fail('Start a linked conversation instead of a reply.');
            $b['audience']=communication_audience($relatedId);
        }
        $body=text_field($b['body']??'',4000);if(!$body)fail('Write your message first.');
        $parentId=text_field($b['parent_id']??'',80);if($scoped&&!$relatedId){if(($parentId!==''&&$parentId!==$scoped)||array_key_exists('thread_title',$b))fail('Reply within the invited conversation.',403);$parentId=$scoped;}$parent=$parentId?one('SELECT * FROM comments WHERE id=? AND iteration_id=?',[$parentId,$i['id']]):null;
        if($parentId&&(!$parent||$parent['parent_id']))fail('Reply to an original comment in this iteration.',404);
        if($parent)communication_guard($parent,$isOwner||!!$scoped);
        $audience=$parent?communication_audience($parent['id']):text_field($b['audience']??'shared',20);
        if(!in_array($audience,['studio','shared'],true)||(!$isOwner&&$audience==='studio'))fail('Choose a valid conversation audience.',403);
        $threadTitle=array_key_exists('thread_title',$b)?text_field($b['thread_title'],160):null;
        if($threadTitle!==null&&(!$threadTitle||$parentId))fail('A new conversation needs a subject and cannot be a reply.');
        $version=text_field($b['version_id']??'',80);if($version&&($scoped?!in_array($version,conversation_versions($scoped),true):!isset(allowed_versions($i['id'])[$version])))fail('File not found in this iteration.',404);
        $rawType=text_field($b['thread_type']??$b['message_type']??(!empty($b['recipient'])||isset($b['amount'])?'approval':'conversation'),30);
        $type=communication_type($rawType);
        if($parentId&&($type!=='conversation'||isset($b['thread_type'])||!empty($b['recipient'])||isset($b['amount'])||!empty($b['assignee'])||!empty($b['due_date'])))fail('Replies are plain messages. Start a new linked thread for a separate request.');
        if(!in_array($type,['conversation','todo','approval'],true))fail('Choose a valid thread type.');
        $approval=$type==='approval';
        if(!$approval&&(!empty($b['recipient'])||isset($b['amount'])||$checklistId))fail('Only confirmation requests can request approval.');
        if($approval&&empty($b['recipient']))fail('Choose a person to confirm this request.');
        if($rawType==='price_adjustment'&&!isset($b['amount']))fail('Enter the budget change.');
        if((!$approval||$rawType==='confirmation')&&isset($b['amount']))fail('Choose Approval to include a budget adjustment.');
        $assignee=text_field($b['assignee']??'',254);$assigned=null;$due=text_field($b['due_date']??'',10);
        $work=$type==='todo'||($type==='conversation'&&($assignee!==''||$rawType==='question'));
        if(!$work&&($assignee||$due))fail('Assignments belong to conversations and to dos.');
        if($type==='todo'&&!$assignee)fail('Choose who is responsible for this to do.');
        if($due&&($type!=='todo'||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$due)||!checkdate((int)substr($due,5,2),(int)substr($due,8,2),(int)substr($due,0,4))))fail('Choose a valid due date.');
        if($work&&!empty($i['locked']))fail('This iteration is locked. Unlock it before adding work.',409);
        if($assignee){
            foreach($scoped?conversation_participants($scoped):confirmation_recipients($i) as $p)if($p['email']===$assignee&&($p['available']??true)&&($audience!=='studio'||($p['group']??'')==='team'))$assigned=$p;
            if(!$assigned)fail('Choose a responsible person with access to this conversation.');
        }
        $recipient=text_field($b['recipient']??'',254);$person=null;$amount=null;
        if(array_key_exists('recipient',$b)&&$recipient==='')fail('Choose a person to confirm this request.');
        if($recipient){
            foreach($scoped?array_map(fn($p)=>[...$p,'available'=>true,'invitable'=>false],conversation_participants($scoped)):confirmation_recipients($i) as $p)if($p['email']===$recipient)$person=$p;
            if($audience==='studio'&&($person['group']??'')!=='team')fail('Share this conversation before requesting a client or guest approval.');
            if(!$person||(!$person['available']&&!($isOwner&&!empty($person['invitable'])&&($b['invite']??false)===true))||$recipient===$actor)fail('Choose another person with access to this iteration.');
            $amount=confirmation_amount($b['amount']??null);
            if($amount!==null&&!empty($i['locked']))fail('This iteration is locked. Unlock it before requesting a budget change.',409);
        }elseif(isset($b['amount']))fail('A budget change needs a confirmation recipient.');
        $c=['id'=>id(),'iteration_id'=>$i['id'],'parent_id'=>$parentId?:null,'slide'=>$parent['slide']??text_field($b['slide']??'general',80),'author'=>$actor,'body'=>$body,'created_at'=>now()];$c['annotation']=$parent?null:comment_annotation($i,$c['slide'],$b['annotation']??null);insert('comments',$c);
        if(!$parentId)insert('communication_audiences',['root_id'=>$c['id'],'audience'=>$audience]);
        if($scoped&&$relatedId){
            foreach(array_unique([$actor,$recipient,$assignee]) as $email){
                $sourceGrant=one('SELECT g.*,? AS project_id FROM conversation_grants g WHERE root_id=? AND email=?',[$i['project_id'],$scoped,$email]);
                if(!$sourceGrant||!conversation_grant_valid($sourceGrant))continue;
                $grantId=id();insert('conversation_grants',['id'=>$grantId,'root_id'=>$c['id'],'email'=>$email,'name'=>$sourceGrant['name'],'invited_by'=>$actor,'created_at'=>now(),'expires_at'=>$sourceGrant['expires_at']]);
                insert('conversation_grant_sources',['grant_id'=>$grantId,'source_grant_id'=>$sourceGrant['id']]);
            }
        }
        if($threadTitle!==null)insert('communication_threads',['comment_id'=>$c['id'],'title'=>$threadTitle]);
        if($person&&!$person['available'])conversation_invite($i,$parentId?:$c['id'],$person,$actor);
        if($version)insert('comment_attachments',['comment_id'=>$c['id'],'version_id'=>$version]);
        if($person&&$approval)insert('comment_confirmations',['comment_id'=>$c['id'],'recipient'=>$recipient,'recipient_name'=>$person['name'],'amount_cents'=>$amount]);
        $qid=null;
        if($work){
            $qid=id();
            insert('open_questions',['id'=>$qid,'iteration_id'=>$i['id'],'question'=>preview_text($body,240),'kind'=>'clarification','item_type'=>$type==='todo'?'action':'question','responsible'=>$assigned['name']??'','source_comment_id'=>$c['id'],'origin'=>'conversation','accepted'=>1,'edited'=>1,'published'=>$audience==='shared'?1:0,'created_at'=>now()]);
            ensure_checklist_thread(one('SELECT * FROM open_questions WHERE iteration_id=? AND id=?',[$i['id'],$qid]),$actor);
        }
        if(!$parentId)insert('communication_topics',['root_id'=>$c['id'],'type'=>$type,'assignee'=>$assignee,'assignee_name'=>$assigned['name']??'','due_date'=>$due,'question_id'=>$qid,'related_root_id'=>$relatedId?:null]);
        if($checklistId)query('UPDATE open_questions SET confirmation_id=?,edited=1 WHERE iteration_id=? AND id=?',[$c['id'],$i['id'],$checklistId]);
        save_comment_mentions($i,$c,$b,(bool)$scoped);
        audit($i['project_id'],$i['id'],$actor,$person?'confirmation_requested':'change_requested',$body);
        queue_comment_notifications($i,$c);
        return ['id'=>$c['id']];
    });
}
function decide_confirmation(array $b): array {
    return transaction(function()use($b){
        $scoped=text_field($b['conversation']??'',80);
        if($scoped){$g=conversation_access($scoped,true);$i=one('SELECT * FROM iterations WHERE id=?',[$g['iteration_id']]);$actor=authenticated_user(true)['email'];$isOwner=false;if(isset($b['iteration'])&&$b['iteration']!==$i['id'])fail('Conversation not found.',404);}
        else [$i,$actor,$isOwner]=access_iteration(text_field($b['iteration']??''),true);
        $r=one('SELECT r.*,c.author,c.body FROM comment_confirmations r JOIN comments c ON c.id=r.comment_id WHERE r.comment_id=? AND c.iteration_id=?',[text_field($b['id']??'',80),$i['id']]);
        if(!$r)fail('Confirmation not found.',404);
        communication_guard(one('SELECT * FROM comments WHERE id=?',[$r['comment_id']]),$isOwner||!!$scoped);
        if($scoped&&!one('SELECT 1 FROM comments WHERE id=? AND (id=? OR parent_id=?)',[$r['comment_id'],$scoped,$scoped]))fail('Confirmation not found.',404);
        $decision=$b['decision']??'';if(!in_array($decision,['confirmed','withdrawn'],true))fail('Choose confirm or withdraw.');
        if(($decision==='confirmed'?$r['recipient']:$r['author'])!==$actor)fail('Only the requested person can confirm, and only the author can withdraw.',403);
        if($r['status']===$decision)return ['ok'=>true]; // A retried click never applies a cost twice.
        if($r['status']!=='pending')fail('This request has already been completed.',409);
        if($decision==='confirmed'&&$r['amount_cents']!==null){
            if(!empty($i['locked']))fail('This iteration is locked. Unlock it before confirming a budget change.',409);
            $bid=id();preg_match('/^.{0,300}/us',$r['body'],$label);insert('budget_items',['id'=>$bid,'iteration_id'=>$i['id'],'label'=>$label[0],'amount_cents'=>$r['amount_cents'],'kind'=>'quote','note'=>'Confirmed by '.$actor.' at '.now().' (including VAT).','relationship_locked'=>1,'relationship_origin'=>'manual']);
            insert('confirmation_budget_links',['budget_item_id'=>$bid,'comment_id'=>$r['comment_id']]);
        }
        if(one('SELECT 1 FROM communication_topics WHERE root_id=?',[$r['comment_id']]))query('UPDATE comments SET answered=1 WHERE id=?',[$r['comment_id']]);
        query('UPDATE comment_confirmations SET status=?,decided_by=?,decided_at=? WHERE comment_id=?',[$decision,$actor,now(),$r['comment_id']]);
        audit($i['project_id'],$i['id'],$actor,'confirmation_'.$decision,$r['body'].($r['amount_cents']!==null?' · Budget change '.number_format($r['amount_cents']/100,2,'.','').' EUR (including VAT)':''));
        return ['ok'=>true];
    });
}
function guard_confirmation_budget(string $bid): void {
    if($bid&&one('SELECT 1 FROM confirmation_budget_links WHERE budget_item_id=?',[$bid]))fail('Confirmed budget changes are preserved. Request another confirmation to adjust the amount.',409);
}
