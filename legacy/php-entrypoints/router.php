<?php
declare(strict_types=1);
// Temporary, self-contained product concept. No application session or data access.
$mockPath=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'/');
if($mockPath==='/mock'||str_starts_with($mockPath,'/mock/')){
    $mockFiles=['/mock'=>'index.html','/mock/'=>'index.html','/mock/index.html'=>'index.html','/mock/mock.css'=>'mock.css','/mock/mock.js'=>'mock.js'];
    header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
    header('X-Robots-Tag: noindex, nofollow');header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'");
    $mockFile=$mockFiles[$mockPath]??null;
    if(!$mockFile&&preg_match('~^/mock/assets/[a-zA-Z0-9_./-]+\.(?:js|css|svg|webp|png|jpg|csv|pdf|woff2|vtt)$~D',$mockPath)&&!str_contains($mockPath,'..'))$mockFile=substr($mockPath,6);
    $mockReal=$mockFile?realpath(__DIR__.'/mock/'.$mockFile):false;
    if($mockReal&&!str_starts_with($mockReal,__DIR__.'/mock/'))$mockFile=null;
    if(!$mockFile||!is_file(__DIR__.'/mock/'.$mockFile)){http_response_code(404);header('Content-Type: text/plain; charset=utf-8');echo 'Not found.';return;}
    $mockTypes=['html'=>'text/html; charset=utf-8','css'=>'text/css; charset=utf-8','js'=>'text/javascript; charset=utf-8','webp'=>'image/webp','ttf'=>'font/ttf','svg'=>'image/svg+xml','png'=>'image/png','jpg'=>'image/jpeg','csv'=>'text/csv; charset=utf-8','pdf'=>'application/pdf','woff2'=>'font/woff2','vtt'=>'text/vtt; charset=utf-8'];
    header('Content-Type: '.$mockTypes[pathinfo($mockFile,PATHINFO_EXTENSION)]);
    readfile(__DIR__.'/mock/'.$mockFile);return;
}
// Platform mode is the sole live application transport. The fictional mock stays local.
require_once __DIR__.'/../app/platform_gateway.php';
serve_platform_gateway(rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'/'));
