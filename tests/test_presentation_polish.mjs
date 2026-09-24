/** Real browser UI with mocked API responses; no real project deletions.
 * node --test tests/test_presentation_polish.mjs
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

async function setup(t,{width=1440,mode='scroll',client=false}={}){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(6000);
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
 const studio={id:'polish-studio',name:'Test studio',role:'admin'},deck=structuredClone(template);deck.can_edit=!client;
 deck.iteration.locked=0;deck.capabilities={ai:true,mail:false};
 const file={...deck.files[0],id:'source-pdf',name:'Haus-Morgenlicht-Presentation.pdf',mime:'application/pdf',preview_url:null,url:null,pages:[{number:11,has_preview:true}],history:[{...deck.files[0],id:'source-pdf',name:'Haus-Morgenlicht-Presentation.pdf',mime:'application/pdf'}]};deck.files.push(file);
 deck.slides=[{id:'render',type:'render',source_version_id:file.id,title:'A quiet living room',page_number:11,image_number:0,situation:'concept',image_version_id:'variant-new',image_variants:[{id:'variant-new',summary:'Warmer light'},{id:'variant-old',summary:'Natural light'}]},
 {id:'full',type:'fullphoto',source_version_id:deck.files[0].id,title:'Leave room for the view.',situation:'concept'}];
 deck.slide_sections=[{slide_id:'visual-render',section:'designs'},{slide_id:'visual-full',section:'story'}];
 deck.comments=[{id:'comment-one',iteration_id:deck.iteration.id,slide:'visual-render',body:'Keep the warmer light',author:'client@example.test',created_at:'2026-09-24T12:00:00Z',answered:0}];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(url.pathname!=='/api.php')return route.continue();
  const action=url.searchParams.get('action'),data=route.request().postDataJSON();calls.push({action,data});let response;
  if(action==='session')response={user:{id:'test',name:'Designer'},csrf:'test',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:true,mail:false}};
  else if(action==='project_access')response={reason:'ready'};
  else if(action==='client_project')response={share_id:'test-share',project_id:deck.project.id};
  else if(action==='projects')response={projects:[{...deck.project,iteration:deck.iteration}]};
  else if(action==='project'||action==='deck')response=deck;
  else if(['slide_image','file','comment_preview','document_page'].includes(action))return route.fulfill({contentType:'image/webp',body:await readFile(resolve(root,'assets/interior.webp'))});
  else if(action==='project_starting_pack')response={slides:[],documents:[]};
  else if(action==='mention_people')response={people:[]};
  else if(action==='read_comments'||action==='view_event')response={ok:true};
  else{errors.push('Unexpected API action: '+action);return route.fulfill({status:500,json:{error:'Unexpected request'}});}
  return route.fulfill({json:response});
 });
 const url=client?`${base}/client/projects/${deck.project.id}?iteration=${deck.iteration.id}&slide=visual-render&view=${mode}`:`${base}/${studio.id}/slide/visual-render?project=${deck.project.id}&iteration=${deck.iteration.id}&view=${mode}`;
 await page.goto(url);await page.locator('.presentation').waitFor();return {page,calls,deck};
}
for(const mode of ['slides','scroll'])for(const width of [1440,390])test(`Presentation controls and stable pins: ${mode}, ${width}px`,async t=>{
 const {page}=await setup(t,{width,mode});
 const content=()=>mode==='scroll'?page.locator('[data-scroll-slide="visual-render"]'):page.locator('.slide-area');
 await content().locator('[data-image-variant]').waitFor();
 assert.ok(!(await content().innerText()).includes('Haus-Morgenlicht-Presentation.pdf'));
 assert.ok(!(await content().innerText()).includes('Detected type:'));
 assert.match(await page.locator('.preview-slide-metadata').innerText(),/Detected type:/);
 const version=content().locator('[data-image-variant]'),original=content().locator('[data-action=toggle-slide-original]');
 const v=await version.boundingBox(),o=await original.boundingBox();assert.equal(Math.round(v.height),Math.round(o.height));
 if(width===1440)assert.ok(Math.abs(v.y-o.y)<2,'Version selector aligns with adjacent controls');
 await version.selectOption('variant-old');await content().locator('[data-action=use-image-version]').waitFor();
 assert.equal(await content().locator('[data-image-variant]').inputValue(),'variant-old');
 if(mode==='slides')await page.locator('.presentation-sidebar-handle').hover();
 const nav=page.locator(mode==='scroll'?'.scroll-header':'.presentation-sidebar');
 assert.ok(Number.parseFloat(await page.locator('.presentation-mode-switch').evaluate(el=>getComputedStyle(el).borderRadius))<=7);
 await nav.locator('[data-action=originals]').click();await page.getByRole('dialog').waitFor();
 await page.getByRole('dialog').locator('.download-file-row').click();assert.equal(await page.locator('#modal-title').innerText(),'Sources');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 if(mode==='slides')await page.locator('.presentation-sidebar-handle').hover();
 await nav.locator('[data-action=feedback]').click();await page.getByRole('dialog').waitFor();
 assert.equal(await page.locator('[data-action=toggle-comment-answered]').innerText(),'Mark as answered');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 if(mode==='slides')await page.locator('.presentation-sidebar-handle').hover();
 await nav.locator('[data-section-menu=story]').click();
 await page.getByRole('menuitem',{name:/Leave room for the view/}).click();
 const full=mode==='scroll'?page.locator('[data-scroll-slide="visual-full"]'):page.locator('.slide-area');
 await full.locator('.full-photo-slide img').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.full-photo-slide img')].some(im=>im.naturalWidth>0));
 const toolbar=full.locator('.image-action-toolbar');await toolbar.scrollIntoViewIfNeeded();
 const arm=toolbar.locator('[data-action=annotation-arm]'),resolved=toolbar.locator('[data-action=annotation-resolved]'),ai=toolbar.locator('[data-action=enhance-slide]');
 if(width===1440){const a=await arm.boundingBox(),r=await resolved.boundingBox(),b=await ai.boundingBox();assert.ok(Math.abs(a.y-r.y)<2&&Math.abs(a.y-b.y)<2);}
 await arm.focus();const before=await full.locator('.full-photo-slide').boundingBox(),scroll=await page.evaluate(()=>scrollY);
 await arm.click();await toolbar.locator('[data-annotation-hint]').waitFor({state:'visible'});
 const after=await full.locator('.full-photo-slide').boundingBox();assert.ok(Math.abs(before.y-after.y)<2&&Math.abs(before.height-after.height)<2,'Pin instructions do not move or resize the image');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<2);
 await full.locator('.annotation-layer').press('Escape');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`presentation-${mode}-${width}.png`)});}
});
test('Client scroll navigation keeps editor labels private and header actions contextual',async t=>{
 const {page}=await setup(t,{client:true});
 assert.equal(await page.locator('.preview-bar,.preview-slide-metadata,.visual-labels').count(),0);
 await page.locator('.scroll-header [data-section-menu=story]').click();
 await page.getByRole('menuitem',{name:/Leave room for the view/}).click();
 await page.locator('.scroll-header [data-action=feedback]').click();assert.equal(await page.locator('[data-form=feedback] [name=slide]').inputValue(),'visual-full');
});
