<?php
declare(strict_types=1);

function directory_profile(string $email,string $name): array {
    $account=$email!==''&&one('SELECT 1 FROM users WHERE email=?',[$email]);
    return array_intersect_key(profile_for(person_key($email,(bool)$account),$name),array_flip(['name','avatar']));
}

function project_directory(string $pid): array {
    $team=project_people($pid);
    $contacts=rows('SELECT * FROM contacts WHERE project_id=? ORDER BY name COLLATE NOCASE,rowid',[$pid]);
    $clients=function_exists('project_clients')?project_clients($pid):array_values(array_filter($contacts,fn($c)=>$c['role']==='Client'));
    $known=[];
    foreach($team as &$person){$person['key']=$person['id'];$known[strtolower($person['email'])]=true;}unset($person);
    foreach($clients as &$person){
        $person['key']=strtolower($person['email']);$person['phone']=$person['phone']??'';
        foreach($contacts as $contact)if($contact['role']==='Client'&&strtolower($contact['email'])===$person['key'])$person['phone']=$contact['phone'];
        $person['profile']=directory_profile($person['email'],$person['name']);$known[$person['key']]=true;
    }unset($person);
    $other=[];
    foreach($contacts as $contact){
        if($contact['role']==='Client'||($contact['email']!==''&&isset($known[strtolower($contact['email'])])))continue;
        $contact['key']=$contact['id'];$contact['profile']=directory_profile($contact['email'],$contact['name']);$other[]=$contact;
    }
    return ['team'=>$team,'clients'=>$clients,'other'=>$other];
}
