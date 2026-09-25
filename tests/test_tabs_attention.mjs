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

async function setup(t,{width=1440,view='slides',failedJobs=false}={}){
 const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(5000);
 const errors=[],calls=[],control={hold:null,fail:false};page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{control.hold?.();await page.close();assert.deepEqual(errors,[]);});
 const studio={id:'tabs-studio',name:'Test studio',role:'admin'},deck=structuredClone(template);
 Object.assign(deck.project,{id:'project-a',name:'Haus Morgenlicht',can_edit:true});deck.can_edit=true;
 deck.iteration={...deck.iteration,project_id:'project-a',locked:0};deck.iterations=[deck.iteration];
 deck.slides=deck.files.filter(f=>f.mime.startsWith('image/')).map((f,n)=>({id:'image-'+n,source_version_id:f.id,type:n?'moodboard':'render',title:f.name}));
 deck.comments=[{id:'feedback-1',slide:'general',body:'Please review the warmer finish',author:'client@example.test',created_at:'2026-09-20T12:00:00Z'}];
 if(failedJobs)deck.jobs=[{id:'failed-file',type:'ingest',name:'Kitchen specification.pdf',status:'failed',error:'Could not extract this document.'},{id:'failed-video',type:'slide_video',name:'Living room preview',slide_id:'image-0',status:'failed',error:'The video request could not finish.'}];
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
  else if(action==='project'||action==='activity_feed'){
   const project=action==='project',get=key=>url.searchParams.get((project?'events_':'')+key)||'';
   const search=get('search').toLowerCase();
   let filtered=events.filter(e=>(!search||JSON.stringify(e).toLowerCase().includes(search))&&(!get('type')||e.type===get('type'))&&(!get('actor')||e.actor===get('actor'))&&(!get('project')||e.project_id===get('project'))&&(!get('from')||e.created_at.slice(0,10)>=get('from'))&&(!get('to')||e.created_at.slice(0,10)<=get('to')));
   if(get('sort')==='oldest')filtered.reverse();
   const facets={types:['file_uploaded','question_answered'],actors:['Designer'],projects:[{id:'project-a',name:'Haus Morgenlicht'}]};
   if(control.activityDelay&&search===control.activityDelay)await new Promise(resolve=>{control.hold=resolve;});
   if(project){const n=Math.min(Number(get('page')||0),Math.max(0,Math.ceil(filtered.length/20)-1));response={...deck,events:filtered.slice(n*20,n*20+20),events_facets:facets,events_pagination:{page:n,total:filtered.length}};}
   else response={items:filtered,facets,total:filtered.length,has_more:false};
  }
  else if(action==='match_subquotes'){if(control.subquoteFail)return route.fulfill({status:500,json:{error:'Could not start the quote check.'}});deck.jobs=[{id:'subquote-check',type:'subquote_match',status:'queued'}];response={id:'subquote-check'};}
  else if(action==='dismiss_job'||action==='restore_job'){if(control.dismissFail)return route.fulfill({status:500,json:{error:'Could not dismiss this item.'}});deck.jobs.find(j=>j.id===data.id).dismissed_at=action==='restore_job'?null:'2026-09-25T12:00:00Z';response={ok:true};}
  else if(action==='attention'){
   if(control.delay)await new Promise(resolve=>{control.hold=resolve;});control.hold=null;
   if(control.fail)return route.fulfill({status:500,json:{error:'Could not refresh attention.'}});
   const kind=url.searchParams.get('kind');response={items:items.filter(item=>kind==='all'||item.kind===kind),counts:{questions:7,confirmations:0,feedback:7,deadlines:0},total:14,today:'2026-09-24',has_more:false};
  }else if(action==='comment_preview')return route.fulfill({status:404,body:''});
  else if(action==='comments_feed')response={items:deck.comments.map(c=>({...c,project_id:'project-a',project_name:deck.project.name,iteration_id:deck.iteration.id,iteration_number:2,unread:true})),has_more:false};
  else if(['read_comments','view_event'].includes(action))response={ok:true};
  else{errors.push('Unexpected API action: '+action);return route.fulfill({status:500,json:{error:'Unexpected request'}});}
  return route.fulfill({json:response});
 });
 const url=view==='attention'?`${base}/${studio.id}/attention`:view==='all-activity'?`${base}/${studio.id}/activity`:view==='all-comments'?`${base}/${studio.id}/comments`:`${base}/${studio.id}/projects/project-a?tab=${view}`;
 await page.goto(url);await page.locator(view==='attention'?'.attention-item':view==='all-activity'?'.activity-item':view==='all-comments'?'[data-action=communication-filter]':'.tabs').first().waitFor({state:'visible'});
 return {page,calls,control,deck};
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
 assert.equal(await page.locator('.modal input[type=radio]').count(),0);
 assert.equal(await page.locator('[name=file-category]:checked').count(),7);
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();
 assert.equal(await page.locator('.file-group').count(),0);
 await page.locator('[name=file-category][value=moodboard]').check();
 await page.locator('[name=file-category][value=renders]').check();
 assert.equal(await page.locator('[data-file-filter-status]').innerText(),'2 of 7 categories selected');
 assert.equal(await page.locator('.file-group').count(),template.files.filter(f=>['moodboard','renders'].includes(f.category)).length);
 assert.equal(await page.locator('.file-category-filter').evaluate(el=>getComputedStyle(el).animationName),'slide-filter-pulse');
 await page.locator('[name=file-category][value=renders]').uncheck();
 await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.locator('.file-group').count(),1);
 assert.equal(await page.locator('.file-category-filter.is-active').count(),1);
 await page.locator('#file-search').fill('no matching file');assert.equal(await page.locator('.file-group').count(),0);
 await page.locator('#file-search').fill('');await page.locator('[data-action=file-filter]').click();
 assert.equal(await page.locator('[name=file-category]:checked').count(),1);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.file-category-filter').evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.ok(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.getByRole('button',{name:'Select all',exact:true}).click();
 assert.equal(await page.locator('[name=file-category]:checked').count(),7);
 assert.equal(await page.locator('.file-category-filter.is-active').count(),0);
 await page.getByRole('button',{name:'Done',exact:true}).click();assert.equal(await page.locator('.file-group').count(),original);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
for(const width of [1440,390])test(`People labels, budget navigation and tab actions at ${width}px`,async t=>{
 const {page,deck}=await setup(t,{width,view:'people'});
 for(const [group,label] of [['team','Add team member'],['clients','Add client'],['other','Add person']]){
  const button=page.locator(`[data-action=add-project-person][data-group="${group}"]`);
  assert.equal(await button.innerText(),label);
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 deck.budget=Array.from({length:20},(_,n)=>({id:'cost-'+n,label:'Cost '+n,amount_cents:10000,parent_id:null,included:0,kind:'estimate',vendor:'Contractor'}));
 deck.budget.push({id:'nested',label:'Nested cost',parent_id:'cost-10',amount_cents:5000,included:0},{id:'nested-deep',label:'Nested detail',parent_id:'nested',amount_cents:2500,included:0},{id:'included',label:'Included cost',parent_id:'cost-10',amount_cents:1500,included:1},{id:'unselected',label:'Unselected cost',amount_cents:5000,is_optional:1,selected:0});
 deck.files[0].category='budget';deck.files.push({...deck.files[0],id:'extra-quote',category:'budget'});
 await page.reload();await page.locator('[data-action=tab][data-tab=budget]').click();
 assert.equal(await page.locator('[data-action=budget-jump]').count(),22);
 assert.equal(await page.locator('[data-budget-chart]').getAttribute('aria-hidden'),null);
 const style=el=>{const s=getComputedStyle(el);return [s.height,s.fontSize,s.padding,s.borderRadius,s.backgroundColor,s.color];};
 const primary=await page.locator('.project-tab-actions [data-action=add-cost]').evaluate(style);
 const secondary=await page.locator('.project-tab-actions [data-action=match-subquotes]').evaluate(style);
 await page.evaluate(()=>{window.budgetFlashes=[];document.addEventListener('animationstart',event=>{if(event.animationName==='budget-jump-flash')window.budgetFlashes.push({id:event.target.closest('[data-budget-row]').dataset.budgetRow,scrollY});});});
 await page.locator('[data-action=budget-jump][data-id=cost-18]').click();
 await page.locator('[data-budget-row=cost-18]>.budget-jump-highlight').waitFor();
 const position=await page.evaluate(()=>scrollY);assert.ok(position>400);
 await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>scrollY),position);
 assert.equal(await page.locator('[data-budget-row=cost-18]').evaluate(el=>el===document.activeElement),true);
 await page.locator('[data-budget-row=cost-18]>.budget-jump-highlight').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.budgetFlashes.filter(f=>f.id==='cost-18').length),1);
 await page.locator('[data-action=budget-jump][data-id=nested-deep]').click();
 await page.locator('[data-budget-row=nested-deep]>.budget-jump-highlight').waitFor();
 for(const id of ['cost-10','nested'])assert.equal(await page.locator(`[data-action=toggle-cost][data-id="${id}"]`).getAttribute('aria-expanded'),'true');
 assert.ok(await page.locator('[data-budget-row=nested-deep]').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.budget-sticky-summary').getBoundingClientRect().bottom));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('[data-action=budget-jump][data-id=cost-1]').focus();await page.keyboard.press('Enter');
 await page.locator('[data-budget-row=cost-1]>.budget-jump-highlight').waitFor();
 assert.equal(await page.locator('[data-budget-row=cost-1]>.budget-line').evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.locator('[data-action=tab][data-tab=comments]').click();
 assert.deepEqual(await page.locator('.project-tab-actions [data-action=comm-new]').evaluate(style),primary);
 assert.deepEqual(await page.locator('.project-tab-actions [data-action=check-run]').evaluate(style),secondary);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto(`${base}/tabs-studio/slide/budget?project=project-a&iteration=${deck.iteration.id}`);
 await page.locator('.presentation-budget').waitFor();
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.chat-form input').fill('Keep my unfinished budget question');
 await page.locator('[data-action=budget-jump][data-id=nested-deep]').click();
 await page.locator('[data-budget-row=nested-deep]>.budget-jump-highlight').waitFor();
 assert.equal(await page.locator('.chat-form input').inputValue(),'Keep my unfinished budget question');
 assert.ok(await page.locator('.slide-area').evaluate(el=>el.scrollTop>100));
 assert.ok(await page.locator('[data-budget-row=nested-deep]').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.budget-sticky-summary').getBoundingClientRect().bottom));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`/tmp/studiodeck-budget-jump-${width}.png`});
});
for(const width of [1440,390])test(`Subquote introduction and explicit start at ${width}px`,async t=>{
 const {page,deck,calls,control}=await setup(t,{width,view:'budget'});
 deck.jobs=[];deck.capabilities.ai=true;
 deck.files[0].category='budget';deck.files.push({...deck.files[0],id:'second-quote',category:'budget'});
 await page.reload();
 const open=page.getByRole('button',{name:'Check subquotes',exact:true});
 await open.click();
 await page.getByRole('heading',{name:'See how your quotes fit together',exact:true}).waitFor();
 assert.equal(calls.filter(c=>c.action==='match_subquotes').length,0);
 await page.waitForFunction(()=>document.querySelector('.subquote-check-art')?.naturalWidth>0);
 assert.match(await page.locator('.subquote-check-details').innerText(),/linked automatically/);
 assert.ok(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:`/tmp/studiodeck-subquote-intro-${width}.png`});
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(calls.filter(c=>c.action==='match_subquotes').length,0);
 await open.click();control.subquoteFail=true;
 await page.getByRole('button',{name:'Start checking',exact:true}).click();
 await page.locator('[data-subquote-check-error]').waitFor({state:'visible'});
 assert.equal(await page.locator('[data-subquote-check-error]').innerText(),'Could not start the quote check.');
 assert.equal(await page.getByRole('button',{name:'Start checking',exact:true}).isEnabled(),true);
 control.subquoteFail=false;
 await page.getByRole('button',{name:'Start checking',exact:true}).evaluate(el=>{el.click();el.click();});
 await page.locator('.modal').waitFor({state:'detached'});
 assert.equal(calls.filter(c=>c.action==='match_subquotes').length,2);
 assert.equal(calls.filter(c=>c.action==='match_subquotes').at(-1).data.iteration,deck.iteration.id);
 await page.locator('[data-action=tab][data-tab=people]').click();
 await page.locator('.project-people').waitFor();
});
test('Communication owns the Needs attention preset',async t=>{
 const {page,calls}=await setup(t,{view:'all-comments'});
 assert.equal(await page.locator('.sidebar [data-action=attention]').count(),0);
 await page.locator('[data-action=communication-filter][data-filter=attention]').click();
 await page.waitForURL(/comments\?filter=attention/);
 assert.equal(await page.getByRole('heading',{name:'Communication',exact:true}).count(),1);
 assert.equal(await page.locator('[data-attention-dashboard]').count(),0);
 await page.locator('[data-action=communication-filter][data-filter=all]').click();
 await page.waitForURL(/\/comments\?filter=all$/);
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

for(const view of ['activity','all-activity'])for(const width of [1440,390])test(`Activity search, filters and sorting in ${view} at ${width}px`,async t=>{
 const {page,control}=await setup(t,{width,view}),search=page.getByRole('textbox',{name:'Search activity'});
 if(view==='activity'){await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByText('Page 2 of 2',{exact:true}).waitFor();}
 await search.fill('Natural oak');await page.waitForFunction(()=>document.querySelectorAll('.activity-item').length===1);
 assert.match(await page.locator('.activity-item').innerText(),/Natural oak/);assert.equal(await search.inputValue(),'Natural oak');assert(await search.evaluate(e=>e===document.activeElement));
 await search.fill('');await page.getByRole('button',{name:'Filter activity',exact:true}).click();await page.locator('[data-activity-form]').evaluate(form=>{for(const field of form.querySelectorAll('select,input'))field.value='';});await page.getByRole('button',{name:'Apply filters'}).click();await page.waitForFunction(()=>document.querySelectorAll('.activity-item').length>1);
 await page.getByLabel('Sort activity').selectOption('oldest');await page.waitForFunction(()=>document.querySelector('.activity-copy>p')?.textContent==='Uploaded drawing 22');
 await page.getByRole('button',{name:'Filter activity',exact:true}).click();
 const form=page.locator('[data-activity-form]');await form.getByLabel('Activity type').selectOption('question_answered');await form.getByLabel('Person',{exact:true}).selectOption('Designer');
 if(view==='all-activity')await form.getByLabel('Project',{exact:true}).selectOption('project-a');
 await form.getByLabel('From',{exact:true}).fill('2026-09-20');await form.getByLabel('Through',{exact:true}).fill('2026-09-20');
 if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`activity-filters-${view}-${width}.png`)});}
 await form.getByRole('button',{name:'Apply filters'}).click();await page.waitForFunction(()=>document.querySelectorAll('.activity-item').length===1);
 assert.equal(await page.locator('.activity-filter.is-active').count(),1);assert.match(await page.locator('.activity-filter-summary').innerText(),/question answered/);
 await search.fill('no results');await page.getByRole('heading',{name:'No matching activity'}).waitFor();
 await search.fill('');await page.getByRole('button',{name:'Filter activity',exact:true}).click();await page.locator('[data-activity-form]').evaluate(form=>{for(const field of form.querySelectorAll('select,input'))field.value='';});await page.getByRole('button',{name:'Apply filters'}).click();await page.waitForFunction(()=>document.querySelectorAll('.activity-item').length>1);
 // A slower search must not overwrite the later one.
 control.activityDelay='drawing 1';await search.fill('drawing 1');await page.waitForTimeout(350);await search.fill('drawing 22');await page.waitForFunction(()=>document.querySelectorAll('.activity-item').length===1);control.hold?.();control.hold=null;await page.waitForTimeout(100);
 assert.match(await page.locator('.activity-item').innerText(),/Uploaded drawing 22/);
 await search.fill('');await page.getByRole('button',{name:'Filter activity',exact:true}).click();await page.locator('[data-activity-form]').evaluate(form=>{for(const field of form.querySelectorAll('select,input'))field.value='';});await page.getByRole('button',{name:'Apply filters'}).click();await page.waitForFunction(()=>document.querySelectorAll('.activity-item').length>1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`activity-tools-${view}-${width}.png`),fullPage:true});
});

for(const width of [1440,390])test(`Dismiss failed file processing items at ${width}px`,async t=>{
 const {page,calls,control}=await setup(t,{width,view:'overview',failedJobs:true});
 await page.locator('[data-action=job-status]').click();await page.getByRole('dialog',{name:'A closer look at your files.'}).waitFor();
 assert.equal(await page.locator('[data-action=dismiss-job]').count(),2);
 assert.equal(await page.locator('[data-action=retry-job]').count(),1);
 if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`file-dismiss-${width}.png`)});}
 control.dismissFail=true;await page.locator('[data-action=dismiss-job][data-id=failed-file]').click();await page.getByText('Could not dismiss this item.',{exact:true}).waitFor();assert.equal(await page.locator('[data-action=dismiss-job]').count(),2);assert.equal(await page.locator('[data-action=dismiss-job][data-id=failed-file]').isEnabled(),true);control.dismissFail=false;
 await page.locator('[data-action=dismiss-job][data-id=failed-file]').click();await page.locator('[data-action=dismiss-job][data-id=failed-file]').waitFor({state:'hidden'});assert.equal(await page.locator('[data-action=dismiss-job]').count(),1);
 await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();await page.reload();await page.locator('[data-action=job-status]').click();assert.equal(await page.locator('[data-action=dismiss-job]').count(),1);
 await page.locator('[data-action=dismiss-job]').click();await page.getByText('No files need attention.',{exact:true}).waitFor();assert.equal(await page.locator('[data-action=job-status]:not([data-view=dismissed])').count(),0);
 await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();await page.reload();await page.locator('.tabs').waitFor();assert.equal(await page.locator('[data-action=job-status]:not([data-view=dismissed])').count(),0);
 assert.equal(await page.getByRole('button',{name:'View dismissed items',exact:true}).count(),0);
 await page.locator('[data-action=tab][data-tab=files]').click();
 await page.getByRole('button',{name:'View dismissed items',exact:true}).click();
 assert.equal(await page.locator('[data-action=job-status-tab][data-view=dismissed]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('[data-action=restore-job]').count(),2);assert.equal(await page.locator('[data-action=retry-job]').count(),0);
 if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`file-dismissed-${width}.png`)});
 await page.locator('[data-action=restore-job][data-id=failed-file]').click();await page.locator('[data-action=restore-job][data-id=failed-file]').waitFor({state:'hidden'});assert.equal(await page.locator('[data-action=restore-job]').count(),1);
 await page.locator('[data-action=job-status-tab][data-view=dismissed]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-action=job-status-tab][data-view=open]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('[data-action=dismiss-job][data-id=failed-file]').count(),1);
 await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();await page.locator('.tabs [data-action=tab][data-tab=overview]').click();await page.locator('.tabs .active[data-tab=overview]').waitFor();await page.reload();await page.locator('[data-action=job-status]').click();assert.equal(await page.locator('[data-action=dismiss-job][data-id=failed-file]').count(),1);
 await page.locator('[data-action=job-status-tab][data-view=dismissed]').click();assert.equal(await page.locator('[data-action=restore-job][data-id=failed-video]').count(),1);await page.locator('[data-action=restore-job][data-id=failed-video]').click();await page.getByText('No dismissed items.',{exact:true}).waitFor();
 assert.deepEqual(calls.filter(c=>c.action==='restore_job').map(c=>c.data.id),['failed-file','failed-video']);
 assert.deepEqual(calls.filter(c=>c.action==='dismiss_job').map(c=>c.data.id),['failed-file','failed-file','failed-video']);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
