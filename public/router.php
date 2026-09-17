<?php
// Development router. Production: use public/ as the web server document root.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/api.php') { require __DIR__.'/api.php';return; }
if($path==='/' || $path==='/index.html' || preg_match('~^/[A-Za-z0-9_-]+/(?:projects(?:/[A-Za-z0-9_-]+)?|slide/[A-Za-z0-9_-]+|users|activity|comments|settings)/?$~',$path)) { readfile(__DIR__.'/index.html');return; }
$file=realpath(__DIR__.$path);
if($file && str_starts_with($file,__DIR__.'/assets/') && is_file($file))return false;
http_response_code(404);echo 'Not found';
