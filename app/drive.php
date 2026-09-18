<?php
declare(strict_types=1);

const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.readonly';
const DRIVE_FOLDER='application/vnd.google-apps.folder';
function drive_owner(bool $write=false): array {
    $u=owner($write);if(empty($u['studio_id'])||!one('SELECT 1 FROM studio_members WHERE studio_id=? AND user_id=?',[$u['studio_id'],$u['user_id']]))fail('Join a studio before connecting Google Drive.',403);return $u;
}
function drive_configured(): bool {
    return env('GOOGLE_DRIVE_CLIENT_ID')!==''&&env('GOOGLE_DRIVE_CLIENT_SECRET')!==''&&strlen(base64_decode(env('GOOGLE_DRIVE_TOKEN_KEY'),true)?:'')===32;
}
function drive_require_config(): void {if(!drive_configured())fail('Google Drive needs a one-time setup by your Studiodeck administrator.',503);}
function drive_redirect_uri(): string {return base_url().'/api.php?action=drive_callback';}
function drive_encrypt(string $plain): string {
    $iv=random_bytes(12);$tag='';$cipher=openssl_encrypt($plain,'aes-256-gcm',base64_decode(env('GOOGLE_DRIVE_TOKEN_KEY'),true),OPENSSL_RAW_DATA,$iv,$tag);
    if($cipher===false)fail('Google Drive token storage is unavailable.',503);return base64_encode($iv.$tag.$cipher);
}
function drive_decrypt(string $cipher): string {
    $raw=base64_decode($cipher,true);if($raw===false||strlen($raw)<28)fail('Reconnect your Google Drive account.',409);
    $plain=openssl_decrypt(substr($raw,28),'aes-256-gcm',base64_decode(env('GOOGLE_DRIVE_TOKEN_KEY'),true),OPENSSL_RAW_DATA,substr($raw,0,12),substr($raw,12,16));
    if($plain===false)fail('Reconnect your Google Drive account.',409);return $plain;
}
// URLs are built by the server. No arbitrary download URL is ever accepted from a client.
function drive_http(string $method,string $url,array $headers=[],?array $form=null,int $limit=2097152): array {
    // Tests inject a transport in PHP before loading the API, never through a request or environment flag.
    if(isset($GLOBALS['drive_test_transport']))return ($GLOBALS['drive_test_transport'])($method,$url,$headers,$form,$limit);
    $stream=fopen('php://temp/maxmemory:2097152','w+');$tooLarge=false;$size=0;$location='';$ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_HTTPHEADER=>$headers,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>60,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_HEADERFUNCTION=>function($ch,$line)use(&$location){if(str_starts_with(strtolower($line),'location:'))$location=trim(substr($line,9));return strlen($line);},CURLOPT_WRITEFUNCTION=>function($ch,$chunk)use($stream,$limit,&$tooLarge,&$size){$size+=strlen($chunk);if($size>$limit){$tooLarge=true;return 0;}return fwrite($stream,$chunk);}]);
    if($form!==null)curl_setopt($ch,CURLOPT_POSTFIELDS,http_build_query($form));
    $ok=curl_exec($ch);$status=curl_getinfo($ch,CURLINFO_RESPONSE_CODE);curl_close($ch);rewind($stream);$body=stream_get_contents($stream);fclose($stream);
    if($tooLarge)fail('The Drive file exceeds the remaining upload limit. Use up to 100 MB per file and 120 MB per batch.',413);
    if($ok===false)fail('Google Drive could not be reached. Please try again.',502);
    return ['status'=>$status,'body'=>$body,'location'=>$location];
}
function drive_connection(array $u): array {
    drive_require_config();$c=one('SELECT * FROM drive_connections WHERE user_id=? AND studio_id=?',[$u['user_id'],$u['studio_id']]);if(!$c)fail('Connect your Google Drive account first.',409);return $c;
}
function drive_access(array $u,bool $force=false): array {
    $c=drive_connection($u);
    if(!$force&&$c['expires_at']>time()+60)return [$c,drive_decrypt($c['access_token'])];
    $r=drive_http('POST','https://oauth2.googleapis.com/token',[],['client_id'=>env('GOOGLE_DRIVE_CLIENT_ID'),'client_secret'=>env('GOOGLE_DRIVE_CLIENT_SECRET'),'refresh_token'=>drive_decrypt($c['refresh_token']),'grant_type'=>'refresh_token']);$t=json_decode($r['body'],true)?:[];
    if($r['status']!==200||empty($t['access_token'])){if(($t['error']??'')==='invalid_grant'){query('DELETE FROM drive_connections WHERE user_id=? AND studio_id=? AND generation=?',[$u['user_id'],$u['studio_id'],$c['generation']]);fail('Your Google Drive connection expired. Please connect again.',409);}fail('Google Drive could not refresh your connection. Please try again.',502);}
    $access=drive_encrypt($t['access_token']);$refresh=isset($t['refresh_token'])?drive_encrypt($t['refresh_token']):$c['refresh_token'];
    $saved=query('UPDATE drive_connections SET access_token=?,refresh_token=?,expires_at=? WHERE user_id=? AND studio_id=? AND generation=?',[$access,$refresh,time()+(int)($t['expires_in']??3600),$u['user_id'],$u['studio_id'],$c['generation']]);
    if(!$saved->rowCount())fail('Your Google Drive connection changed. Open Drive again.',409);return [$c,$t['access_token']];
}
function drive_api_request(array $u,string $path,array $params=[],int $limit=2097152): array {
    [$connection,$access]=drive_access($u);$url='https://www.googleapis.com/drive/v3/'.$path.($params?'?'.http_build_query($params):'');
    $r=drive_http('GET',$url,['Authorization: Bearer '.$access],null,$limit);
    if($r['status']===401){[, $access]=drive_access($u,true);$r=drive_http('GET',$url,['Authorization: Bearer '.$access],null,$limit);}
    for($n=0;in_array($r['status'],[301,302,303,307,308],true)&&$n<3;$n++){
        $next=$r['location']??'';$host=parse_url($next,PHP_URL_HOST);if(parse_url($next,PHP_URL_SCHEME)!=='https'||!is_string($host)||!($host==='www.googleapis.com'||str_ends_with($host,'.googleusercontent.com')))fail('Google Drive returned an unsupported download location.',502);
        $r=drive_http('GET',$next,$host==='www.googleapis.com'?['Authorization: Bearer '.$access]:[],null,$limit);
    }
    if($r['status']!==200){$error=json_decode($r['body'],true);$reason=$error['error']['errors'][0]['reason']??'';
        if($reason==='exportSizeLimitExceeded')fail('This Google document is too large to export. Download it from Drive and use From my computer.',413);
        if($r['status']===404)fail('This Drive file or folder is no longer available.',404);
        if($r['status']===401)fail('Reconnect your Google Drive account.',409);
        if($r['status']===403)fail('Google Drive does not allow access or download for this item. Check its sharing permissions or try again later.',403);
        fail('Google Drive could not complete this request. Please try again.',502);
    }
    return $r;
}
function drive_json(array $u,string $path,array $params=[]): array {$r=drive_api_request($u,$path,$params);$j=json_decode($r['body'],true);if(!is_array($j))fail('Google Drive returned an unreadable response.',502);return $j;}
function drive_id(mixed $value): string {$v=text_field($value,200);if(!preg_match('/^[a-zA-Z0-9_-]+$/D',$v))fail('Choose a valid Google Drive folder or file.');return $v;}
function drive_file(array $u,string $id): array {
    return drive_json($u,'files/'.rawurlencode($id),['supportsAllDrives'=>'true','fields'=>'id,name,mimeType,size,parents,driveId,trashed,capabilities(canDownload),modifiedTime']);
}
function drive_export(array $f): ?array {
    return match($f['mimeType']){
        'application/vnd.google-apps.document'=>['mime'=>'application/pdf','ext'=>'pdf'],
        'application/vnd.google-apps.presentation'=>['mime'=>'application/vnd.openxmlformats-officedocument.presentationml.presentation','ext'=>'pptx'],
        'application/vnd.google-apps.spreadsheet'=>['mime'=>'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','ext'=>'xlsx'],
        default=>null
    };
}
function drive_selectable(array $f): bool {
    return empty($f['trashed'])&&($f['capabilities']['canDownload']??true)&&($f['mimeType']!==DRIVE_FOLDER)&&(!str_starts_with($f['mimeType'],'application/vnd.google-apps.')?preg_match('/\.(pdf|pptx?|xlsx?|csv|jpe?g|png|webp)$/i',$f['name']):drive_export($f)!==null);
}
function drive_list(array $u,string $folder,string $page=''): array {
    $meta=drive_file($u,$folder);if($meta['mimeType']!==DRIVE_FOLDER||!empty($meta['trashed']))fail('Choose a Google Drive folder.');
    $params=['q'=>"'".drive_id($meta['id'])."' in parents and trashed = false",'spaces'=>'drive','pageSize'=>100,'orderBy'=>'folder,name_natural','supportsAllDrives'=>'true','includeItemsFromAllDrives'=>'true','fields'=>'nextPageToken,incompleteSearch,files(id,name,mimeType,size,capabilities(canDownload))'];
    if(!empty($meta['driveId'])){$params['corpora']='drive';$params['driveId']=$meta['driveId'];}
    if($page!=='')$params['pageToken']=$page;$result=drive_json($u,'files',$params);
    $items=[];foreach($result['files']??[] as $f){$isFolder=$f['mimeType']===DRIVE_FOLDER;$selectable=drive_selectable($f)&&((int)($f['size']??0)<=100*1024*1024);$items[]=['id'=>$f['id'],'name'=>$f['name'],'folder'=>$isFolder,'selectable'=>$selectable,'size'=>(int)($f['size']??0),'export'=>drive_export($f)['ext']??null];}
    return ['folder'=>['id'=>$meta['id'],'name'=>$folder==='root'?'My Drive':$meta['name']],'items'=>$items,'next_page'=>$result['nextPageToken']??'','incomplete'=>!empty($result['incompleteSearch'])];
}
function drive_import(array $u,array $b): array {
    $i=owned_iteration(text_field($b['iteration']??''),$u,true);$folder=drive_file($u,drive_id($b['folder']??''));if($folder['mimeType']!==DRIVE_FOLDER||!empty($folder['trashed']))fail('Choose a Google Drive folder.');
    $ids=$b['files']??[];if(!is_array($ids)||!array_is_list($ids)||!count($ids)||count($ids)>20)fail('Choose between 1 and 20 files.');
    $replace=text_field($b['replace_asset']??'');if($replace&&count($ids)!==1)fail('Choose one replacement file.');
    $category=text_field($b['category']??'');if(!in_array($category,['','legal'],true))fail('Unknown upload category.');
    $generation=drive_connection($u)['generation'];$prepared=[];$total=0;$names=[];$started=time();
    @set_time_limit(240);
    foreach(array_unique($ids) as $id){
        if(time()-$started>180)fail('The import is taking too long. Select fewer files and try again.',504);
        $f=drive_file($u,drive_id($id));if(!drive_selectable($f))fail('Choose supported files only. Folders and shortcuts cannot be imported.');
        if(!in_array($folder['id'],$f['parents']??[],true))fail('One of the selected files moved out of this folder. Refresh the folder and choose again.',409);
        if((int)($f['size']??0)>100*1024*1024)fail('“'.$f['name'].'” exceeds the 100 MB file limit.',413);
        $export=drive_export($f);$name=basename(str_replace('\\','/',text_field($f['name'],240)));if(preg_match('/[\x00-\x1f]/',$name))fail('Rename this file in Google Drive before importing.');
        if($export&&!str_ends_with(strtolower($name),'.'.$export['ext']))$name.='.'.$export['ext'];
        if(isset($names[$name]))fail('Two selected files have the same name. Import them separately or rename one in Google Drive.');$names[$name]=true;
        $path='files/'.rawurlencode($f['id']).($export?'/export':'');$params=$export?['mimeType'=>$export['mime']]:['alt'=>'media','supportsAllDrives'=>'true'];
        $raw=drive_api_request($u,$path,$params,min(100*1024*1024,120*1024*1024-$total))['body'];$total+=strlen($raw);
        if(strlen($raw)>100*1024*1024||$total>120*1024*1024)fail('Use up to 100 MB per file and 120 MB per batch.',413);
        $tmp=tempnam(sys_get_temp_dir(),'studiodeck-drive-');try{file_put_contents($tmp,$raw);$mime=validate_upload($name,$tmp);}finally{unlink($tmp);}
        $prepared[]=['name'=>$name,'mime'=>$mime,'data'=>$raw,'metadata'=>['google_drive'=>['file_id'=>$f['id'],'folder_id'=>$folder['id'],'modified_time'=>$f['modifiedTime']??'','imported_at'=>now()]]];
    }
    // Recheck the account and project after slow downloads; a disconnected or shared draft cannot be mutated.
    if(drive_connection($u)['generation']!==$generation)fail('Your Drive account changed during import. Open Drive again.',409);
    return save_project_uploads($prepared,$replace,$i,$u,$category,function()use($u,$generation){if(!one('SELECT 1 FROM drive_connections WHERE user_id=? AND studio_id=? AND generation=?',[$u['user_id'],$u['studio_id'],$generation]))fail('Your Drive connection changed during import. Connect again.',409);});
}
