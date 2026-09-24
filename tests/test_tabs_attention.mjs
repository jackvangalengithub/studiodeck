/** Real browser UI with mocked API responses; no real project deletions.
 * node --test tests/test_tabs_attention.mjs
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

async function setup(t,{width=1440,view='slides'}={}){
 const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(5000);
 const errors=[],calls=[],control={hold:null,fail:false};page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{control.hold?.();await page.close();assert.deepEqual(errors,[]);});
 const studio={id:'tabs-studio',name:'Test studio',role:'admin'},deck=structuredClone(template);
 Object.assign(deck.project,{id:'project-a',name:'Haus Morgenlicht',can_edit:true});deck.can_edit=true;
 deck.iteration={...deck.iteration,project_id:'project-a',locked:0};deck.iterations=[deck.iteration];
 deck.slides=deck.files.filter(f=>f.mime.startsWith('image/')).map((f,n)=>({id:'image-'+n,source_version_id:f.id,type:n?'moodboard':'render',title:f.name}));
 deck.comments=[{id:'feedback-1',slide:'general',body:'Please review the warmer finish',author:'client@example.test',created_at:'2026-09-20T12:00:00Z'}];
 deck.communication={actor:'designer@example.test',recipients:[],threads:[],confirmations:[],attachments:[]};
 const events=Array.from({length:23},(_,n)=>({id:'event-'+n,actor:'Designer',type:'file_uploaded',detail:'Uploaded drawing '+n,created_at:'2026-09-20T12:00:00Z',project_id:'project-a',project_name:'Haus Morgenlicht',iteration_id:deck.iteration.id}));
 events[0]={...events[0],type:'question_answered',question_answer:{slide:'intro',slide_title:'Welcome home',question:'Which finish?',answer:'Natural oak.',status:'answered'}};
 const items=Array.from({length:14},(_,n)=>({kind:n%2?'questions':'feedback',id:n===0?'feedback-1':'item-'+n,title:'Review project detail '+n,project_id:'project-a',project_name:'Haus Morgenlicht',iteration_id:deck.iteration.id,iteration_number:2,unread_count:1}));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(url.pathname!=='/api.php')return route.continue();
  const action=url.searchParams.get('action'),data=route.request().postDataJSON();calls.push({action,data});let response;
  if(action==='session')response={user:{id:'test',name:'Designer'},csrf:'test',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:false,mail:false}};
  else if(action==='projects')response={projects:[{...deck.project,iteration:deck.iteration}]};
  else if(action==='project_access')response={reason:'ready'};
  else if(action==='project'){const n=Number(url.searchParams.get('events_page')||0);response={...deck,events:events.slice(n*20,n*20+20),events_pagination:{page:n,total:events.length}};}
  else if(action==='activity_feed')response={items:events,has_more:false};
  else if(action==='attention'){
   if(control.delay)await new Promise(resolve=>{control.hold=resolve;});control.hold=null;
   if(control.fail)return route.fulfill({status:500,json:{error:'Could not refresh attention.'}});
   const kind=url.searchParams.get('kind');response={items:items.filter(item=>kind==='all'||item.kind===kind),counts:{questions:7,confirmations:0,feedback:7,deadlines:0},total:14,today:'2026-09-24',has_more:false};
  }else if(action==='comment_preview')return route.fulfill({status:404,body:''});
  else if(action==='comments_feed')response={items:deck.comments.map(c=>({...c,project_id:'project-a',project_name:deck.project.name,iteration_id:deck.iteration.id,iteration_number:2,unread:true})),has_more:false};
  else if(action==='read_comments')response={ok:true};
  else{errors.push('Unexpected API action: '+action);return route.fulfill({status:500,json:{error:'Unexpected request'}});}
  return route.fulfill({json:response});
 });
 const url=view==='attention'?`${base}/${studio.id}/attention`:view==='all-activity'?`${base}/${studio.id}/activity`:view==='all-comments'?`${base}/${studio.id}/comments`:`${base}/${studio.id}/projects/project-a?tab=${view}`;
 await page.goto(url);await page.locator(view==='attention'?'.attention-item':view==='all-activity'?'.activity-item':view==='all-comments'?'[data-action=communication-filter]':'.tabs').first().waitFor({state:'visible'});
 return {page,calls,control};
}
for(const width of [1440,390,320])test(`Presentation and Files controls at ${width}px`,async t=>{
 const {page}=await setup(t,{width});
 assert.equal(await page.locator('[data-action=group-slides]').count(),0);
 for(const action of ['add-slide','slide-view'])for(const button of await page.locator(`.slide-editor-heading [data-action=${action}]`).all()){
  assert.equal(await button.innerText(),'');await button.hover();await page.locator('#icon-action-tooltip').waitFor();
  const rect=await page.locator('#icon-action-tooltip').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width);
 }
 for(const selector of ['[data-slide-filter-open]','.slide-drag-handle','.group-drag-handle','.editor-slide-actions [data-action=edit-slide]']){
  const control=page.locator(selector).first();await control.hover();await page.locator('#icon-action-tooltip').waitFor();assert.ok((await page.locator('#icon-action-tooltip').innerText()).length>0);
 }
 await page.keyboard.press('Escape');assert.equal(await page.locator('#icon-action-tooltip').count(),0);
 await page.locator('[data-action=slide-view][data-view=grid]').click();assert.equal(await page.locator('.slide-editor.all-slides').count(),1);
 assert.equal(await page.locator('[data-view=grid]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-action=tab][data-tab=files]').click();
 assert.equal(await page.locator('.filter-chips').count(),0);
 const search=await page.locator('#file-search').boundingBox(),filter=await page.locator('[data-action=file-filter]').boundingBox();assert.ok(Math.abs(search.y-filter.y)<3&&filter.x>search.x);
 const original=await page.locator('.file-group').count();await page.locator('[data-action=file-filter]').click();
 await page.locator('[name=file-category][value=moodboard]').check();await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.locator('.file-group').count(),1);
 assert.equal(await page.locator('.file-category-filter.is-active').count(),1);
 await page.locator('#file-search').fill('no matching file');assert.equal(await page.locator('.file-group').count(),0);
 await page.locator('#file-search').fill('');await page.locator('[data-action=file-filter]').click();await page.locator('[name=file-category][value=all]').check();await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.locator('.file-group').count(),original);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
test('Communication owns the Needs attention preset',async t=>{
 const {page,calls}=await setup(t,{view:'all-comments'});
 assert.equal(await page.locator('.sidebar [data-action=attention]').count(),0);
 await page.locator('[data-action=communication-filter][data-filter=attention]').click();
 await page.waitForURL(/comments\?filter=attention/);
 assert.equal(await page.getByRole('heading',{name:'Communication',exact:true}).count(),1);
 assert.equal(await page.locator('[data-attention-dashboard]').count(),0);
 await page.locator('[data-action=communication-filter][data-filter=all]').click();
 await page.waitForURL(/\/comments$/);
});
for(const width of [1440,390])test(`Project activity cards and pagination at ${width}px`,async t=>{
 const {page}=await setup(t,{width,view:'activity'});await page.locator('.activity-item').first().waitFor();
 assert.equal(await page.locator('.attention-list.activity-list .activity-item').count(),20);
 assert.match(await page.locator('.activity-question-answer').innerText(),/Which finish\?[\s\S]*Natural oak/);
 await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Page 2 of 2',{exact:true}).waitFor();assert.equal(await page.locator('.activity-item').count(),3);
 await page.locator('[data-action=activity-prev]').click();await page.getByText('Page 1 of 2',{exact:true}).waitFor();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`project-activity-${width}.png`),fullPage:true});}
 if(width<700)await page.locator('.mobile-menu').click();await page.locator('.sidebar [data-action=all-activity]').click();await page.locator('.project-activity-page h1').waitFor();assert.equal(await page.locator('.activity-item').count(),23);
 await page.locator('[data-action=activity-project]').first().click();await page.locator('.tabs').waitFor();assert.equal(await page.locator('.tab.active').innerText(),'Activity');
 if(width<700)await page.locator('.mobile-menu').click();await page.locator('.sidebar [data-action=all-comments]').click();await page.locator('[data-action=communication-filter]').first().waitFor();assert.equal(await page.locator('.tabs').count(),0);
});
