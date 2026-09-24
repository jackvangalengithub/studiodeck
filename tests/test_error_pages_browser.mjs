import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import {demoRequest} from '../public/assets/demo.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('public'),errors=[];
const copy={};for(const language of ['en','nl']){const source=await readFile(`app/languages/${language}.php`,'utf8');copy[language]=JSON.parse(source.split("<<<'JSON'\n")[1].split('\nJSON,')[0]);}
const css=await readFile('public/auth/error-page.css','utf8');
const document=execFileSync(process.env.PHP_BIN||'php',['-r',"require 'app/error_page.php'; render_error_page(404, 'This shared project is no longer available to your account.', ['signed_in'=>true,'email'=>'client@example.com']);"],{encoding:'utf8'});
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/server-error'){
  res.writeHead(404,{'Content-Type':'text/html','Content-Security-Policy':`default-src 'none'; style-src 'sha256-${createHash('sha256').update(css).digest('base64')}'; base-uri 'none'; frame-ancestors 'none'`});res.end(document);return;
 }
 if(url.pathname==='/login'){
  let html=await readFile(root+'/auth/login.html','utf8');html=html.replace('{{login_translations}}',JSON.stringify(copy));html=html.replace(/\{\{(login_\w+)\}\}/g,(_,key)=>copy.en[key]);
  res.writeHead(200,{'Content-Type':'text/html','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'"});res.end(html);return;
 }
 const file=resolve(root,'.'+(url.pathname.startsWith('/client/')||url.pathname==='/choose'||url.pathname.startsWith('/conversations/')?'/index.html':url.pathname));
 if(!file.startsWith(root+'/')){res.writeHead(404);res.end();return;}
 let body=await readFile(file);if(url.pathname.startsWith('/conversations/'))body=body.toString().replace('src="assets/app.js"','src="assets/conversation.js"');
 res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream'});res.end(body);
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.text().includes('Content Security Policy'))errors.push(m.text());});
 await page.goto(base+'/server-error');
 assert.equal(await page.locator('.status-page').evaluate(el=>getComputedStyle(el).display),'flex');
 await page.screenshot({path:'/tmp/studiodeck-error-desktop.png'});
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No overflow at ${width}px`);
  assert.ok(await page.getByRole('link',{name:'Your workspaces & projects'}).isVisible());
 }
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/studiodeck-error-mobile.png'});
 const session=await demoRequest('session');let failures=0;
 await page.route('**/api.php?*',route=>{
  const action=new URL(route.request().url()).searchParams.get('action');
  if(action==='session')return route.fulfill({json:session});
  if(action==='destinations')return route.fulfill({json:{studios:[],projects:[],conversations:[]}});
  failures++;return route.fulfill({status:404,json:{error:'This shared project is no longer available to your account.'}});
 });
 await page.goto(base+'/client/projects/missing');await page.locator('.status-page').waitFor();
 assert.match(await page.locator('h1').innerText(),/This space/);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'status-title');
 await page.getByRole('link',{name:'Your workspaces & projects'}).click();await page.locator('.destination-shell').waitFor();
 await page.goto(base+'/conversations/missing');await page.locator('.status-page').waitFor();assert.match(await page.locator('.status-description').innerText(),/no longer available/);
 await page.unroute('**/api.php?*');
 let requests=0;await page.route('**/api.php?*',route=>{requests++;return route.fulfill({status:503,json:{error:'private diagnostic'}});});
 await page.goto(base+'/client/projects/missing');await page.locator('.status-page').waitFor();
 assert.ok(!(await page.locator('body').innerText()).includes('private diagnostic'));
 const before=requests;await page.getByRole('button',{name:'Try again'}).click();await page.waitForFunction(()=>document.querySelector('.status-page'));assert.ok(requests>before);
 await page.unroute('**/api.php?*');
 await page.route('**/api.php?*',route=>route.fulfill({status:403,json:{error:'This sign-in link is expired or has already been used.'}}));
 await page.goto(base+'/login#/login/'+'a'.repeat(64));await page.locator('.status-page').waitFor();
 assert.match(await page.locator('h1').innerText(),/A fresh link/);
 assert.equal(await page.locator('.status-page').evaluate(el=>getComputedStyle(el).maxWidth),'none');
 await page.getByRole('link',{name:'Get a new sign-in link'}).click();await page.locator('#email').waitFor();
 assert.ok(await page.locator('#email').isVisible());
 assert.ok(failures>=2);assert.deepEqual(errors,[]);
 console.log('PASS Server/CSP rendering, 320–1440px layouts, application and conversation errors, retry, project navigation, focus and expired-link recovery.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
