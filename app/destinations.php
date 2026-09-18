<?php
declare(strict_types=1);
// An invitation grants client access only to its explicitly shared iteration.
function account_client_share(array $user,string $project='',string $iteration='',string $share=''): array {
    $where="s.email=? AND s.revoked=0 AND s.expires_at>? AND p.archived=0 AND i.status='shared'";
    $params=[$user['email'],time()];
    foreach(['p.id'=>$project,'i.id'=>$iteration,'s.id'=>$share] as $column=>$value)if($value!==''){$where.=" AND $column=?";$params[]=$value;}
    $found=one("SELECT s.*,i.project_id FROM shares s JOIN iterations i ON i.id=s.iteration_id JOIN projects p ON p.id=i.project_id WHERE $where ORDER BY i.number DESC,s.created_at DESC,s.id LIMIT 1",$params);
    if(!$found)fail('This shared project is no longer available to your account.',404);
    return $found;
}
function account_destinations(array $user): array {
    $studios=user_studios($user['user_id']);
    foreach($studios as &$studio){$logo=one('SELECT data FROM studio_logos WHERE studio_id=?',[$studio['id']]);$studio['logo']=$logo?'data:image/png;base64,'.base64_encode($logo['data']):null;unset($studio['theme']);}unset($studio);
    $projects=rows("SELECT p.id,p.name,p.studio_id,st.name AS studio_name,i.id AS iteration_id,i.number AS iteration_number,i.title AS iteration_title,
      EXISTS(SELECT 1 FROM studio_members m WHERE m.studio_id=p.studio_id AND m.user_id=? AND (p.visibility='public' OR EXISTS(SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.user_id=m.user_id))) AS studio_access
      FROM projects p JOIN studios st ON st.id=p.studio_id JOIN iterations i ON i.id=(SELECT si.id FROM iterations si WHERE si.project_id=p.id AND si.status='shared' AND EXISTS(SELECT 1 FROM shares s WHERE s.iteration_id=si.id AND s.email=? AND s.revoked=0 AND s.expires_at>?) ORDER BY si.number DESC LIMIT 1)
      WHERE p.archived=0 ORDER BY st.name,p.name,p.id",[$user['user_id'],$user['email'],time()]);
    foreach($projects as &$project){
        $logo=one('SELECT data FROM studio_logos WHERE studio_id=?',[$project['studio_id']]);$project['studio_logo']=$logo?'data:image/png;base64,'.base64_encode($logo['data']):null;
        $project['has_cover']=(bool)project_cover($project['iteration_id']);$project['studio_access']=(bool)$project['studio_access'];
    }unset($project);
    return ['studios'=>$studios,'projects'=>$projects];
}
function claim_client_profile(string $email): void {
    $old='client:'.$email;$key='user:'.$email;
    query('INSERT OR IGNORE INTO person_profiles(person_key,name,color,email_comments,avatar) SELECT ?,name,color,email_comments,avatar FROM person_profiles WHERE person_key=?',[$key,$old]);
    // Reserve the account profile on first sign-in so later anonymous link edits cannot replace it.
    query('INSERT OR IGNORE INTO person_profiles(person_key) VALUES(?)',[$key]);
    query('INSERT OR IGNORE INTO comment_reads(comment_id,person_key,read_at) SELECT comment_id,?,read_at FROM comment_reads WHERE person_key=?',[$key,$old]);
}
