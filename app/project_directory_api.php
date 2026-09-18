<?php
if(in_array($action,['save_project_person','remove_project_person'],true)){
    $u=owner(true);$b=input();
    transaction(function()use($u,$b,$action){
        $p=owned_project(text_field($b['project_id']??''),$u);$pid=$p['id'];
        $group=$b['group']??'';$key=text_field($b['key']??'',254);$remove=$action==='remove_project_person';
        if(!in_array($group,['team','clients','other'],true))fail('Choose a people group.');
        $people=project_directory($pid);$existing=null;
        foreach($people[$group] as $person)if($person['key']===$key)$existing=$person;
        if(($key!==''||$remove)&&!$existing)fail('This person is no longer in this project.',404);
        if(!$remove&&$group!=='team'){
            $name=text_field($b['name']??'',100);if(!$name)fail('Enter a name.');
            $phone=text_field($b['phone']??'',40);$raw=trim((string)($b['email']??''));
            $email=$raw!==''?email_field($raw):'';
            if($group!=='other'&&$email==='')fail('Enter an email address.');
        }
        if($group==='team'){
            if(!$existing)fail('Choose a studio member using Add team member.');
            if($remove){
                if(count($people['team'])<2)fail('Keep at least one project team member.');
                if($existing['id']===$u['user_id'])fail('Use the team selector to remove yourself from this project.');
                query('DELETE FROM project_members WHERE project_id=? AND user_id=?',[$pid,$key]);
                query('DELETE FROM project_team_contacts WHERE project_id=? AND user_id=?',[$pid,$key]);
                query("DELETE FROM contacts WHERE project_id=? AND role<>'Client' AND lower(email)=?",[$pid,strtolower($existing['email'])]);
            }else{
                if(array_intersect(['name','email','phone'],array_keys($b)))fail('Team member details are managed by studio admins. Only the project role can be changed here.');
                $role=text_field($b['role']??'',80);$name=$existing['name'];
                query('INSERT INTO project_team_contacts(project_id,user_id,role) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role',[$pid,$key,$role]);
            }
        }elseif($group==='clients'){
            if($remove){
                if(function_exists('project_clients'))query('DELETE FROM project_client_members WHERE project_id=? AND email=?',[$pid,$existing['email']]);
                query("DELETE FROM contacts WHERE project_id=? AND role='Client' AND lower(email)=?",[$pid,strtolower($existing['email'])]);
                query('UPDATE shares SET revoked=1 WHERE email=? AND iteration_id IN (SELECT id FROM iterations WHERE project_id=?)',[$existing['email'],$pid]);
                query("UPDATE email_outbox SET status='cancelled' WHERE status='queued' AND share_id IN (SELECT s.id FROM shares s JOIN iterations i ON i.id=s.iteration_id WHERE i.project_id=? AND s.email=?)",[$pid,$existing['email']]);
            }else{
                if($existing&&$email!==$existing['email'])fail('Remove this client and add their new email address to change access.');
                if(!$existing&&array_filter($people['clients'],fn($c)=>strtolower($c['email'])===$email))fail('This client is already listed. Edit their details instead.');
                if(function_exists('add_project_client'))add_project_client($pid,$email,$name);
                $contact=one("SELECT id FROM contacts WHERE project_id=? AND role='Client' AND lower(email)=?",[$pid,$email]);
                if($contact)query("UPDATE contacts SET name=?,phone=? WHERE project_id=? AND role='Client' AND lower(email)=?",[$name,$phone,$pid,$email]);
                else insert('contacts',['id'=>id(),'project_id'=>$pid,'name'=>$name,'email'=>$email,'phone'=>$phone,'role'=>'Client']);
            }
        }else{
            if($remove)query('DELETE FROM contacts WHERE project_id=? AND id=?',[$pid,$key]);
            else{
                foreach(array_merge($people['team'],$people['clients'],$people['other']) as $person)if($email!==''&&strtolower($person['email'])===$email&&($person['key']!==$key||!$existing))fail('This email is already listed in the project. Edit the existing person instead.');
                $role=text_field($b['role']??'',80)?:'Other involved person';if(strtolower($role)==='client')fail('Use the Clients group to add a client.');
                if($existing)query('UPDATE contacts SET name=?,email=?,phone=?,role=? WHERE project_id=? AND id=?',[$name,$email,$phone,$role,$pid,$key]);
                else insert('contacts',['id'=>id(),'project_id'=>$pid,'name'=>$name,'email'=>$email,'phone'=>$phone,'role'=>$role]);
            }
        }
        $iteration=one('SELECT id FROM iterations WHERE project_id=? ORDER BY number DESC LIMIT 1',[$pid]);
        audit($pid,$iteration['id'],$u['email'],'project_people_updated',($remove?'Removed ':'Saved ').($remove?$existing['name']:$name).' · '.$group);
    });
    json_response(['ok'=>true]);
}
