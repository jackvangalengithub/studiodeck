<?php
declare(strict_types=1);

const PRODUCT_FEEDBACK_CATEGORIES = ['broken','friction','missing','positive','other'];
const PRODUCT_FEEDBACK_AREAS = ['projects','files','budget','presentation','communication','website','settings','billing','other'];
const PRODUCT_FEEDBACK_STATUSES = ['new','reviewing','clarification','planned','shipped','not_pursuing'];

function product_feedback_reviewer(array $user): bool {
    $emails=array_filter(array_map(fn($email)=>strtolower(trim($email)),explode(',',env('PRODUCT_FEEDBACK_TEAM_EMAILS'))));
    return in_array(strtolower($user['email']??''),$emails,true);
}
function require_product_feedback_reviewer(bool $write=false): array {
    $user=authenticated_user($write);
    if(!product_feedback_reviewer($user))fail('This inbox is only available to the Studiodeck team.',403);
    return $user;
}
function product_feedback_choice(mixed $value,array $choices): string {
    if(!is_string($value)||!in_array($value,$choices,true))fail('Choose a valid feedback option.');
    return $value;
}
function product_feedback_screenshot(): ?string {
    $file=$_FILES['screenshot']??null;
    if(!$file||($file['error']??null)===UPLOAD_ERR_NO_FILE)return null;
    if(!is_int($file['error']??null)||$file['error']!==UPLOAD_ERR_OK)fail('Your screenshot did not upload. Please try again.');
    if(!is_uploaded_file($file['tmp_name'])||filesize($file['tmp_name'])>5*1024*1024)fail('Choose a screenshot smaller than 5 MB.');
    $bytes=file_get_contents($file['tmp_name']);$info=@getimagesizefromstring($bytes);
    if(!$info||!in_array($info['mime'],['image/png','image/jpeg','image/webp'],true)||$info[0]>6000||$info[1]>6000||$info[0]*$info[1]>16000000)fail('Choose a PNG, JPEG or WebP screenshot up to 16 megapixels (6,000 pixels per side).');
    $source=@imagecreatefromstring($bytes);if(!$source)fail('This screenshot could not be read.');
    // Re-encode to remove metadata and avoid retaining arbitrary uploaded bytes.
    $scale=min(1,2400/max($info[0],$info[1]));$image=imagecreatetruecolor(max(1,(int)round($info[0]*$scale)),max(1,(int)round($info[1]*$scale)));
    imagefill($image,0,0,imagecolorallocate($image,255,255,255));
    imagecopyresampled($image,$source,0,0,0,0,imagesx($image),imagesy($image),$info[0],$info[1]);
    ob_start();imagejpeg($image,null,88);$data=ob_get_clean();imagedestroy($image);imagedestroy($source);
    if(!$data)fail('This screenshot could not be saved.');
    return $data;
}
function product_feedback_submit(array $u,array $b): array {
    $key=text_field($b['request_key']??'',80);
    if(!preg_match('/^[a-zA-Z0-9-]{16,80}$/D',$key))fail('Please reopen the feedback form and try again.');
    if($existing=one('SELECT id FROM product_feedback WHERE user_id=? AND request_key=?',[$u['user_id'],$key]))return $existing;
    $category=product_feedback_choice($b['category']??null,PRODUCT_FEEDBACK_CATEGORIES);
    $area=product_feedback_choice($b['area']??null,PRODUCT_FEEDBACK_AREAS);
    $screen=product_feedback_choice($b['screen']??null,PRODUCT_FEEDBACK_AREAS);
    $goal=text_field($b['goal']??'',2000);$detail=text_field($b['detail']??'',6000);
    if($goal===''||$detail==='')fail('Please tell us a little about your experience in both fields.');
    $impact=product_feedback_choice($b['impact']??'', $category==='positive'?['']:['minor','slows','blocked']);
    $frequency=product_feedback_choice($b['frequency']??null,['first','sometimes','often']);
    if(!is_bool($b['contact_allowed']??null))fail('Choose whether we may contact you.');
    $image=product_feedback_screenshot();
    rate_limit('product-feedback:'.$u['user_id'],20,3600);
    return transaction(function()use($u,$b,$key,$category,$area,$screen,$goal,$detail,$impact,$frequency,$image){
        if($existing=one('SELECT id FROM product_feedback WHERE user_id=? AND request_key=?',[$u['user_id'],$key]))return $existing;
        $id=id();
        insert('product_feedback',['id'=>$id,'user_id'=>$u['user_id'],'studio_id'=>$u['studio_id'],'request_key'=>$key,'category'=>$category,'area'=>$area,'goal'=>$goal,'detail'=>$detail,'impact'=>$impact,'frequency'=>$frequency,'contact_allowed'=>(int)$b['contact_allowed'],'screen'=>$screen,'app_version'=>substr(env('APP_VERSION','unversioned'),0,120),'created_at'=>now(),'updated_at'=>now()]);
        if($image!==null)insert('product_feedback_images',['feedback_id'=>$id,'data'=>$image,'mime'=>'image/jpeg']);
        $recipient=product_feedback_notification_email();
        if($recipient!=='')insert('product_feedback_outbox',['feedback_id'=>$id,'email'=>$recipient]);
        return ['id'=>$id];
    });
}

function product_feedback_notification_email(): string {
    $email=strtolower(trim(env('PRODUCT_FEEDBACK_NOTIFY_EMAIL')));
    return filter_var($email,FILTER_VALIDATE_EMAIL)?$email:'';
}

function product_feedback_notification(array $report): array {
    $categories=['broken'=>'Something is not working','friction'=>'Too much effort','missing'=>'Missing functionality','positive'=>'Working well','other'=>'Something else'];
    $areas=['projects'=>'Projects','files'=>'Files','budget'=>'Budget','presentation'=>'Presentation','communication'=>'Communication','website'=>'Website','settings'=>'Settings','billing'=>'Billing','other'=>'Other'];
    $impact=['minor'=>'Small inconvenience','slows'=>'Slows me down; a workaround exists','blocked'=>'Cannot finish the task'];
    $frequency=['first'=>'First time','sometimes'=>'Sometimes','often'=>'Often'];
    $prompts=[
        'broken'=>['What were you trying to get done?','What happened instead?'],
        'friction'=>['What were you trying to get done?','Which part took more effort than it should?'],
        'missing'=>['What would you like to accomplish?','How do you handle this today?'],
        'positive'=>['What worked well for you?','What did it help you achieve?'],
        'other'=>['What would you like to tell us?','How does this affect your experience?'],
    ];
    [$goal,$detail]=$prompts[$report['category']];
    $subject='[Studiodeck feedback] '.$areas[$report['area']].' - '.$categories[$report['category']];
    $body="Someone took a moment to help us make Studiodeck better.\n\n".
        'Type: '.$categories[$report['category']]."\nArea: ".$areas[$report['area']].
        "\nFrom: ".($report['user_name']?:'Former account')."\nStudio: ".($report['studio_name']?:'Former studio').
        "\nSubmitted: ".$report['created_at']."\n\n".$goal."\n".$report['goal']."\n\n".$detail."\n".$report['detail'];
    if($report['impact']!=='')$body.="\n\nImpact: ".$impact[$report['impact']];
    $body.="\nFrequency: ".$frequency[$report['frequency']];
    $body.="\n\n".($report['contact_allowed']&&$report['user_email']?'Open to a follow-up email: '.$report['user_email']:'No follow-up email permission.');
    if($report['has_screenshot'])$body.="\n\nA screenshot is available in the private product feedback inbox.";
    $body.="\n\nScreen: ".$areas[$report['screen']]."\nApp version: ".$report['app_version'].
        "\nReport ID: ".$report['id']."\n\nOpen Studiodeck and choose Product feedback inbox to review this report.";
    $html=email_template(null,'New product feedback',$body,base_url().'/','Open Studiodeck',
        'You are receiving this because this mailbox is configured for Studiodeck product feedback.');
    return ['subject'=>$subject,'body'=>$body."\n".base_url().'/','html'=>$html];
}

// Separate from project mail: a transport failure never loses or blocks feedback.
function dispatch_product_feedback_email(?callable $send=null): bool {
    $job=transaction(function(){
        query("UPDATE product_feedback_outbox SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END WHERE status='sending' AND next_attempt<?",[time()-300]);
        $job=one("SELECT * FROM product_feedback_outbox WHERE status='queued' AND next_attempt<=? ORDER BY rowid LIMIT 1",[time()]);
        if($job)query("UPDATE product_feedback_outbox SET status='sending',attempts=attempts+1,next_attempt=? WHERE feedback_id=?",[time(),$job['feedback_id']]);
        return $job;
    });
    if(!$job)return false;
    try{
        // A changed/disabled recipient must not leak queued reports to the old address.
        if($job['email']!==product_feedback_notification_email()){
            query("UPDATE product_feedback_outbox SET status='cancelled' WHERE feedback_id=?",[$job['feedback_id']]);return true;
        }
        $report=one('SELECT f.*,u.name AS user_name,u.email AS user_email,s.name AS studio_name,EXISTS(SELECT 1 FROM product_feedback_images i WHERE i.feedback_id=f.id) AS has_screenshot FROM product_feedback f LEFT JOIN users u ON u.id=f.user_id LEFT JOIN studios s ON s.id=f.studio_id WHERE f.id=?',[$job['feedback_id']]);
        $message=product_feedback_notification($report);
        $sent=($send??'send_email')($job['email'],$message['subject'],$message['body'],$message['html']);
        if(!$sent&&($send!==null||env('MAIL_TRANSPORT','log')==='mail'))throw new RuntimeException('The mail transport did not accept this email.');
        query('UPDATE product_feedback_outbox SET status=?,error=? WHERE feedback_id=?',[$sent?'sent':'logged','',$job['feedback_id']]);
    }catch(Throwable $e){
        query('UPDATE product_feedback_outbox SET status=?,next_attempt=?,error=? WHERE feedback_id=?',[$job['attempts']+1>=3?'failed':'queued',time()+300,'Feedback notification delivery failed.',$job['feedback_id']]);
    }
    return true;
}
function product_feedback_inbox(array $b): array {
    $where=[];$params=[];
    foreach(['category'=>PRODUCT_FEEDBACK_CATEGORIES,'area'=>PRODUCT_FEEDBACK_AREAS,'status'=>PRODUCT_FEEDBACK_STATUSES,'impact'=>['minor','slows','blocked']] as $field=>$choices){
        if(($b[$field]??'')!==''){$where[]='f.'.$field.'=?';$params[]=product_feedback_choice($b[$field],$choices);}
    }
    if(($b['theme']??'')!==''){$where[]='f.theme=?';$params[]=text_field($b['theme'],120);}
    $search=text_field($b['search']??'',200);
    if($search!==''){$where[]="(instr(lower(f.goal),lower(?))>0 OR instr(lower(f.detail),lower(?))>0 OR instr(lower(f.theme),lower(?))>0)";array_push($params,$search,$search,$search);}
    $clause=$where?' WHERE '.implode(' AND ',$where):'';
    $offset=filter_var($b['offset']??0,FILTER_VALIDATE_INT,['options'=>['min_range'=>0,'max_range'=>1000000]]);if($offset===false)fail('Choose a valid inbox page.');
    $count=one('SELECT COUNT(*) AS reports,COUNT(DISTINCT user_id) AS users,COUNT(DISTINCT studio_id) AS studios FROM product_feedback f'.$clause,$params);
    $items=rows("SELECT f.*,u.name AS user_name,CASE WHEN f.contact_allowed=1 THEN u.email ELSE NULL END AS contact_email,s.name AS studio_name,EXISTS(SELECT 1 FROM product_feedback_images i WHERE i.feedback_id=f.id) AS has_screenshot FROM product_feedback f LEFT JOIN users u ON u.id=f.user_id LEFT JOIN studios s ON s.id=f.studio_id".$clause.' ORDER BY f.created_at DESC,f.id DESC LIMIT 50 OFFSET '.(int)$offset,$params);
    foreach($items as &$item)unset($item['request_key']);unset($item);
    $themes=rows("SELECT theme,COUNT(*) AS reports,COUNT(DISTINCT user_id) AS users,COUNT(DISTINCT studio_id) AS studios FROM product_feedback WHERE theme<>'' GROUP BY theme ORDER BY studios DESC,reports DESC,theme");
    return ['items'=>$items,'counts'=>$count,'themes'=>$themes,'has_more'=>$offset+count($items)<(int)$count['reports']];
}
