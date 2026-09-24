// Focused regression checks for error safety and recovery, without a database.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {errorPage} from '../public/auth/error-page.js';
const hostile='<script>alert("unsafe")</script>';
const html=errorPage({status:404,message:hostile},{signedIn:true,email:'<img src=x onerror=alert(1)>'});
assert.ok(html.includes('&lt;script&gt;'));
assert.ok(!html.includes('<script>'));
assert.ok(!html.includes('<img'));
assert.ok(html.includes('href="/choose"'));
assert.ok(html.includes('href="/login?returnTo=%2Fchoose"'));
for(const status of [0,500,502,503]){
 const page=errorPage({status,message:'private database failure'});
 assert.ok(!page.includes('private database'));
 assert.ok(page.includes('data-error-retry'));
}
assert.ok(errorPage({status:401}).includes('Let’s get you signed in.'));
assert.ok(errorPage({status:400},{kind:'expired'}).includes('Get a new sign-in link'));
assert.ok(errorPage({status:404},{language:'nl'}).includes('Deze ruimte is niet beschikbaar.'));
for(const status of [400,401,403,404,500,503]){
 const page=execFileSync(process.env.PHP_BIN||'php',['-r',`require 'app/error_page.php'; render_error_page(${status}, '<script>private database failure</script>', ['signed_in'=>true,'email'=>'<img src=x>']);`],{encoding:'utf8'});
 assert.ok(page.includes('<main class="status-page"'));
 assert.ok(page.includes('<style>'));
 assert.ok(!page.includes('<img'));
 assert.ok(!page.includes('<script>'));
 if(status>=500)assert.ok(!page.includes('private database'));
 else if(status!==401)assert.ok(page.includes('&lt;script&gt;'));
}
console.log('PASS Error documents escape content, hide server diagnostics, render independently and offer appropriate recovery.');
