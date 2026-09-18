<?php
// Fake Google transport for isolated tests; never included by the application.
$GLOBALS['drive_test_transport']=function($method,$url,$headers,$form,$limit){
    $dir=getenv('DRIVE_FIXTURES');$control=json_decode(@file_get_contents($dir.'/control.json')?:'{}',true);$parts=parse_url($url);parse_str($parts['query']??'',$q);$path=$parts['path'];
    $json=fn($data,$status=200)=>['status'=>$status,'body'=>json_encode($data),'location'=>''];
    if($path==='/token'){
        if(($form['grant_type']??'')==='refresh_token'&&!empty($control['expired']))return $json(['error'=>'invalid_grant'],400);
        if(($form['grant_type']??'')==='authorization_code'&&($form['code']??'')!=='test-code')return $json(['error'=>'invalid_grant'],400);
        return $json(['access_token'=>'test-access-token','refresh_token'=>'test-refresh-token','scope'=>'https://www.googleapis.com/auth/drive.readonly','expires_in'=>3600]);
    }
    if(str_ends_with($path,'/about'))return $json(['user'=>['emailAddress'=>'drive-owner@example.test']]);
    $file=function($id){
        $folder='application/vnd.google-apps.folder';$files=[
            'root'=>['id'=>'root-id','name'=>'My Drive','mimeType'=>$folder],
            'root-id'=>['id'=>'root-id','name'=>'My Drive','mimeType'=>$folder],
            'villa'=>['id'=>'villa','name'=>'Villa documents','mimeType'=>$folder,'parents'=>['root-id']],
            'nested'=>['id'=>'nested','name'=>'Garden studies','mimeType'=>$folder,'parents'=>['villa']],
            'shared'=>['id'=>'shared','name'=>'Shared studio folder','mimeType'=>$folder,'driveId'=>'shared-drive'],
            'pdf'=>['id'=>'pdf','name'=>'Studio terms.pdf','mimeType'=>'application/pdf','size'=>1024,'parents'=>['villa'],'capabilities'=>['canDownload'=>true]],
            'doc'=>['id'=>'doc','name'=>'Client brief','mimeType'=>'application/vnd.google-apps.document','parents'=>['villa']],
            'sheet'=>['id'=>'sheet','name'=>'Project budget','mimeType'=>'application/vnd.google-apps.spreadsheet','parents'=>['villa']],
            'slides'=>['id'=>'slides','name'=>'Design story','mimeType'=>'application/vnd.google-apps.presentation','parents'=>['villa']],
            'restricted'=>['id'=>'restricted','name'=>'Private.pdf','mimeType'=>'application/pdf','parents'=>['villa'],'capabilities'=>['canDownload'=>false]],
            'shortcut'=>['id'=>'shortcut','name'=>'Shortcut','mimeType'=>'application/vnd.google-apps.shortcut','parents'=>['villa']],
            'unsupported'=>['id'=>'unsupported','name'=>'Notes.exe','mimeType'=>'application/octet-stream','parents'=>['villa']],
            'outside'=>['id'=>'outside','name'=>'Other.pdf','mimeType'=>'application/pdf','parents'=>['nested']],
            'broken'=>['id'=>'broken','name'=>'Broken.pdf','mimeType'=>'application/pdf','parents'=>['villa']],
            'spoof'=>['id'=>'spoof','name'=>'Spoof.pdf','mimeType'=>'application/pdf','parents'=>['villa']],
            'large'=>['id'=>'large','name'=>'Large.pdf','mimeType'=>'application/pdf','size'=>105906176,'parents'=>['villa']],
            'shared-pdf'=>['id'=>'shared-pdf','name'=>'Shared terms.pdf','mimeType'=>'application/pdf','parents'=>['shared']],
        ];return $files[$id]??null;
    };
    if($path==='/drive/v3/files'){
        if(($q['pageToken']??'')==='page-two')return $json(['files'=>[$file('doc')]]);
        if(str_contains($q['q'],"'root-id'"))return $json(['files'=>[$file('villa'),$file('shared')]]);
        if(str_contains($q['q'],"'shared'")){if(($q['corpora']??'')!=='drive'||($q['driveId']??'')!=='shared-drive')throw new RuntimeException('Shared-drive query missing corpus');return $json(['files'=>[$file('shared-pdf')]]);}
        if(str_contains($q['q'],"'nested'"))return $json(['files'=>[]]);
        return $json(['files'=>array_map($file,['nested','pdf','sheet','slides','restricted','shortcut','unsupported','large']),'nextPageToken'=>'page-two']);
    }
    if(preg_match('~/files/([^/]+)(/export)?$~',$path,$m)){
        $id=$m[1];$f=$file($id);if(!$f)return $json(['error'=>[]],404);
        if(isset($m[2])||($q['alt']??'')==='media'){
            if($id==='broken')return $json(['error'=>[]],503);
            if($id==='spoof')return ['status'=>200,'body'=>'This is not a PDF','location'=>''];
            if(!empty($control['lock_during_download']))query("UPDATE iterations SET locked=1 WHERE id=?",[$control['lock_during_download']]);
            if(!empty($control['disconnect_during_download']))query('DELETE FROM drive_connections');
            $extension=match($id){'sheet'=>'xlsx','slides'=>'pptx',default=>'pdf'};
            return ['status'=>200,'body'=>file_get_contents($dir.'/sample.'.$extension),'location'=>''];
        }
        return $json($f);
    }
    throw new RuntimeException('Unexpected test request: '.$path);
};
