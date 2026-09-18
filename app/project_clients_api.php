<?php
if(in_array($action,['save_project_client','remove_project_client'],true)) {
    $u=owner(true);$b=input();
    transaction(function()use($u,$b,$action){
        $p=owned_project(text_field($b['project_id']??''),$u);$email=email_field($b['email']??'');
        if($action==='save_project_client') {
            $name=text_field($b['name']??'',100);if(!$name)fail('Enter the client’s name.');
            add_project_client($p['id'],$email,$name);
            query("UPDATE contacts SET name=? WHERE project_id=? AND role='Client' AND lower(email)=?",[$name,$p['id'],$email]);
        } else {
            if(!one('SELECT 1 FROM project_client_members WHERE project_id=? AND email=?',[$p['id'],$email]))fail('Client not found in this project.',404);
            query('DELETE FROM project_client_members WHERE project_id=? AND email=?',[$p['id'],$email]);
            query("DELETE FROM contacts WHERE project_id=? AND role='Client' AND lower(email)=?",[$p['id'],$email]);
            query('UPDATE shares SET revoked=1 WHERE email=? AND iteration_id IN (SELECT id FROM iterations WHERE project_id=?)',[$email,$p['id']]);
            query("UPDATE email_outbox SET status='cancelled' WHERE status='queued' AND share_id IN (SELECT s.id FROM shares s JOIN iterations i ON i.id=s.iteration_id WHERE i.project_id=? AND s.email=?)",[$p['id'],$email]);
        }
        $i=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$p['id']]);
        audit($p['id'],$i['id'],$u['email'],'project_clients_updated',($action==='save_project_client'?'Saved client: ':'Removed client: ').$email);
    });
    json_response(['clients'=>project_clients(text_field($b['project_id']))]);
}
