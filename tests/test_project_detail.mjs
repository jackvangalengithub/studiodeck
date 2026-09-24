/** Real browser UI with mocked API responses; no real project deletions.
 * node --test tests/test_project_detail.mjs
 * Requires Playwright/Chromium; optional PLAYWRIGHT_MODULE and CHROMIUM_PATH.
 */
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {demoRequest} from '../public/assets/demo.js';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const template=await demoRequest('project',{id:'van-galen'});
let server,browser,base;
before(async()=>{
    server=createServer(async(req,res)=>{
        try{
            const path=new URL(req.url,'http://localhost').pathname;
            const file=(path.startsWith('/assets/')||path.startsWith('/auth/'))?resolve(root,'.'+path):resolve(root,'index.html');
            if(!file.startsWith(root)){res.writeHead(404);res.end();return;}
            res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream');
            res.end(await readFile(file));
        }catch{res.writeHead(404);res.end();}
    });
    await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
    base=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(done=>server.close(done));});

async function setup(t,{width=1440,locked=false,pending=true,canEdit=true}={}){
 const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(5000);
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
 const studio={id:'detail-studio',name:'Test studio',role:'admin'};
 const deck=structuredClone(template);Object.assign(deck.project,{id:'project-a',name:'Haus Morgenlicht',location:'Tyrolean Alps, Austria · fictional conversion',can_edit:canEdit});
 Object.assign(deck.iteration,{project_id:'project-a',status:'shared',title:'Design development 3',locked:Number(locked)});
 deck.can_edit=canEdit;deck.slides=deck.files.filter(f=>f.mime.startsWith('image/')).map((f,n)=>({id:'image-'+n,source_version_id:f.id,type:n?'moodboard':'render',title:f.name}));
 deck.cover_slide_id='image-0';deck.clients=[{id:'client',name:'Anna & Lukas Leitner',email:'clients@example.test'}];
 deck.communication={actor:'test@example.test',recipients:[],threads:[],confirmations:pending?[{comment_id:'pending-1',status:'pending'}]:[]};
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort();
  if(url.pathname!=='/api.php')return route.continue();
  const action=url.searchParams.get('action'),data=route.request().postDataJSON();calls.push({action,data});let response;
  if(action==='session')response={user:{id:'test',name:'Test user'},csrf:'test',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:false,mail:false}};
  else if(action==='project_access')response={reason:'ready'};
  else if(action==='projects')response={projects:[{...deck.project,iteration:deck.iteration,cover_key:deck.iteration.id+':'+deck.cover_slide_id}]};
  else if(action==='project')response=deck;
  else if(action==='set_project_cover'){deck.cover_slide_id=data.slide_id;response={ok:true};}
  else if(action==='theme'){deck.iteration.theme=JSON.stringify(data.theme);response={ok:true};}
  else if(action==='project_cover'){const file=deck.files[deck.cover_slide_id==='image-1'?1:0];return route.fulfill({contentType:'image/webp',body:await readFile(resolve(root,file.preview_url))});}
  else{errors.push('Unexpected action: '+action);return route.fulfill({status:500,json:{error:'Unexpected request'}});}
  return route.fulfill({json:response});
 });
 await page.goto(`${base}/${studio.id}/projects/project-a`);await page.locator('.cover-card').waitFor();return {page,calls,deck};
}
for(const width of [1440,390,320])test(`Decluttered detail and image picker at ${width}px`,async t=>{
 const {page,calls,deck}=await setup(t,{width});
 assert.equal(await page.locator('.project-head .project-sub,[data-action=manage-links],.cover-dots').count(),0);
 for(const action of ['project-settings','theme','preview']){
  const control=page.locator(`.project-actions [data-action=${action}]`);assert.equal(await control.locator('svg').count(),1);assert.equal(await control.innerText(),'');
  await control.hover();const tip=control.locator('..').getByRole('tooltip');assert.equal(await tip.isVisible(),true);const bounds=await tip.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
 }
 for(const action of ['lock-iteration','iteration']){const control=page.locator(`.iteration-controls [data-action=${action}]`);await control.focus();assert.equal(await control.locator('..').getByRole('tooltip').isVisible(),true);}
 assert.equal(await page.locator('.review-step.is-done').count(),4);
 assert.equal(await page.locator('.has-pending-confirmations').count(),1);
 assert.ok(!(await page.locator('.review-panel').innerText()).includes('See it exactly'));
 assert.ok(!(await page.locator('.cover-meta').innerText()).includes('Design development'));
 await page.locator('.client-mini').click();await page.locator('.project-people').waitFor();
 await page.getByRole('button',{name:'Overview',exact:true}).click();
 await page.locator('.project-actions [data-action=theme]').click();assert.equal(await page.locator('[name=style]').count(),0);
 assert.ok(!(await page.getByRole('dialog').innerText()).includes('Design direction'));
 const oldStyle=JSON.parse(deck.iteration.theme).style;
 await page.getByRole('button',{name:'Apply to presentation',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(calls.find(c=>c.action==='theme').data.theme.style,oldStyle);
 await page.getByRole('button',{name:'Choose project cover',exact:true}).click();
 assert.equal(await page.locator('.project-cover-option').count(),2);
 await page.locator('[data-action=select-project-cover][data-slide=image-1]').click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(calls.find(c=>c.action==='set_project_cover').data.slide_id,'image-1');
 await page.waitForFunction(()=>document.querySelector('.cover-card>img')?.src.includes('moodboard.webp'));
 await page.reload();await page.waitForFunction(()=>document.querySelector('.cover-card>img')?.src.includes('moodboard.webp'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`project-detail-${width}.png`),fullPage:true});}
 // On mobile the sidebar must first be opened.
 if(width<700)await page.locator('.mobile-menu').click();
 await page.getByRole('button',{name:'All projects',exact:true}).click();
 assert.match(await page.locator('[data-project-cover]').getAttribute('data-cover-key'),/image-1$/);
 await page.waitForFunction(()=>document.querySelector('[data-project-cover]')?.naturalWidth>0);
});
test('Cover editing respects locked and read-only states; pulse respects reduced motion',async t=>{
 const {page}=await setup(t,{locked:true,pending:false});
 assert.equal(await page.locator('[data-action=choose-project-cover],.has-pending-confirmations').count(),0);
 const {page:reader}=await setup(t,{canEdit:false});assert.equal(await reader.locator('[data-action=choose-project-cover]').count(),0);
 await reader.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await reader.locator('.has-pending-confirmations').evaluate(el=>getComputedStyle(el).animationName),'none');
});
