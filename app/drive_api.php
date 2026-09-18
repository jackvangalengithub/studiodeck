<?php
if($action==='drive_status'){
    $u=drive_owner();$c=one('SELECT email FROM drive_connections WHERE user_id=? AND studio_id=?',[$u['user_id'],$u['studio_id']]);json_response(['configured'=>drive_configured(),'connected'=>(bool)$c,'email'=>$c['email']??'']);
}
if($action==='drive_connect'){
    $u=drive_owner(true);drive_require_config();$state=token();$verifier=token();
    transaction(function()use($u,$state,$verifier){query('DELETE FROM drive_oauth_states WHERE expires_at<? OR (user_id=? AND studio_id=?)',[time(),$u['user_id'],$u['studio_id']]);insert('drive_oauth_states',['state_hash'=>hash_token($state),'user_id'=>$u['user_id'],'studio_id'=>$u['studio_id'],'session_hash'=>$u['token_hash'],'verifier'=>drive_encrypt($verifier),'expires_at'=>time()+600]);});
    $params=['client_id'=>env('GOOGLE_DRIVE_CLIENT_ID'),'redirect_uri'=>drive_redirect_uri(),'response_type'=>'code','scope'=>DRIVE_SCOPE,'access_type'=>'offline','prompt'=>'consent select_account','state'=>$state,'code_challenge'=>rtrim(strtr(base64_encode(hash('sha256',$verifier,true)),'+/','-_'),'='),'code_challenge_method'=>'S256'];
    json_response(['url'=>'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query($params)]);
}
if($action==='drive_callback'){
    $u=owner();
    $ok=false;$message='';
    try{
        $u=owner();drive_require_config();$state=text_field($_GET['state']??'',128);
        $s=transaction(function()use($u,$state){$s=one('SELECT * FROM drive_oauth_states WHERE state_hash=? AND session_hash=? AND user_id=? AND expires_at>?',[hash_token($state),$u['token_hash'],$u['user_id'],time()]);if(!$s)fail('This connection request expired. Close this window and connect again.',409);return $s;});
        $u['studio_id']=$s['studio_id'];if(!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$u['studio_id'],$u['user_id']]))fail('You no longer belong to this studio.',403);
        if(isset($_GET['error']))fail('Google Drive connection was cancelled. You can try again whenever you’re ready.');
        $code=text_field($_GET['code']??'',4096);if(!$code)fail('Google did not return a connection code.');
        $r=drive_http('POST','https://oauth2.googleapis.com/token',[],['client_id'=>env('GOOGLE_DRIVE_CLIENT_ID'),'client_secret'=>env('GOOGLE_DRIVE_CLIENT_SECRET'),'redirect_uri'=>drive_redirect_uri(),'grant_type'=>'authorization_code','code'=>$code,'code_verifier'=>drive_decrypt($s['verifier'])]);$t=json_decode($r['body'],true)?:[];
        if($r['status']!==200||empty($t['access_token'])||empty($t['refresh_token']))fail('Google could not complete the connection. Close this window and connect again.',409);
        if(!in_array(DRIVE_SCOPE,explode(' ',$t['scope']??''),true))fail('Allow read-only Google Drive access to browse and import your files.',403);
        $account=drive_http('GET','https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',['Authorization: Bearer '.$t['access_token']]);$email=json_decode($account['body'],true)['user']['emailAddress']??'';
        transaction(function()use($u,$t,$email,$s){if(!one('SELECT 1 FROM drive_oauth_states WHERE state_hash=? AND session_hash=? AND expires_at>?',[$s['state_hash'],$u['token_hash'],time()]))fail('This connection request was cancelled or expired. Connect again.',409);query('DELETE FROM drive_oauth_states WHERE state_hash=?',[$s['state_hash']]);if(!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$u['studio_id'],$u['user_id']]))fail('Studio membership changed.',403);query('INSERT INTO drive_connections(user_id,studio_id,access_token,refresh_token,expires_at,email,generation) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,studio_id) DO UPDATE SET access_token=excluded.access_token,refresh_token=excluded.refresh_token,expires_at=excluded.expires_at,email=excluded.email,generation=excluded.generation',[$u['user_id'],$u['studio_id'],drive_encrypt($t['access_token']),drive_encrypt($t['refresh_token']),time()+(int)($t['expires_in']??3600),$email,id()]);});
        $ok=true;$message='Google Drive is connected. You can close this window and choose your files.';
    }catch(Throwable $e){if(isset($s))query('DELETE FROM drive_oauth_states WHERE state_hash=?',[$s['state_hash']]);$message=$e instanceof RuntimeException?$e->getMessage():'Google Drive could not connect. Close this window and try again.';}
    $nonce=base64_encode(random_bytes(18));header('Content-Type: text/html; charset=utf-8');header("Content-Security-Policy: default-src 'none'; script-src 'nonce-$nonce'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    $payload=json_encode(['type'=>'studiodeck-drive','ok'=>$ok,'message'=>$message],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT);$origin=json_encode(preg_replace('~^(https?://[^/]+).*$~','$1',base_url()));
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google Drive · Studiodeck</title><style>body{font:16px/1.6 system-ui;background:#f5f3ef;color:#45423e;max-width:440px;margin:12vh auto;padding:24px}button{padding:12px 20px;border-radius:12px;border:1px solid #aaa;background:white;cursor:pointer}</style><h1>'.($ok?'Connected':'Connection not completed').'</h1><p>'.htmlspecialchars($message,ENT_QUOTES).'</p><button id="close">Close window</button><script nonce="'.$nonce.'">if(window.opener)window.opener.postMessage('.$payload.','.$origin.');document.getElementById("close").onclick=()=>window.close();'.($ok?'if(window.opener)setTimeout(()=>window.close(),700);':'').'</script></html>';exit;
}
if($action==='drive_disconnect'){
    $u=drive_owner(true);transaction(function()use($u){query('DELETE FROM drive_connections WHERE user_id=? AND studio_id=?',[$u['user_id'],$u['studio_id']]);query('DELETE FROM drive_oauth_states WHERE user_id=? AND studio_id=?',[$u['user_id'],$u['studio_id']]);});json_response(['ok'=>true]);
}
if($action==='drive_list'){
    $u=drive_owner();$folder=drive_id($_GET['folder']??'root');json_response(drive_list($u,$folder,text_field($_GET['page']??'',2000)));
}
if($action==='drive_import'){
    $u=drive_owner(true);json_response(drive_import($u,input()),201);
}
