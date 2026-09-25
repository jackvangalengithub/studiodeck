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
import {presentationSlides} from '../public/assets/slides.js';

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

async function setup(t,{width=1440,mode='scroll',client=false,configure=()=>{},slide='visual-render',failUndoOnce=false}={}){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});page.setDefaultTimeout(6000);
 await page.addInitScript(()=>localStorage.setItem('studiodeck.clientPresentationHelp.hidden','1'));const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
 const studio={id:'polish-studio',name:'Test studio',role:'admin'},deck=structuredClone(template);deck.can_edit=!client;
 deck.iteration.locked=0;deck.capabilities={ai:true,mail:false};
 const file={...deck.files[0],id:'source-pdf',name:'Haus-Morgenlicht-Presentation.pdf',mime:'application/pdf',preview_url:null,url:null,pages:[{number:11,has_preview:true}],history:[{...deck.files[0],id:'source-pdf',name:'Haus-Morgenlicht-Presentation.pdf',mime:'application/pdf'}]};deck.files.push(file);
 deck.slides=[{id:'render',type:'render',source_version_id:file.id,title:'A quiet living room',page_number:11,image_number:0,situation:'concept',image_version_id:'variant-new',image_variants:[{id:'variant-new',summary:'Warmer light'},{id:'variant-old',summary:'Natural light'}]},
 {id:'full',type:'fullphoto',source_version_id:deck.files[0].id,title:'Leave room for the view.',situation:'concept'}];
 deck.slide_sections=[{slide_id:'visual-render',section:'designs'},{slide_id:'visual-full',section:'story'}];
 deck.comments=[{id:'comment-one',iteration_id:deck.iteration.id,slide:'visual-render',body:'Keep the warmer light',author:'client@example.test',created_at:'2026-09-24T12:00:00Z',answered:0}];
 configure(deck,client);
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==base)return route.abort();if(url.pathname!=='/api.php')return route.continue();
  const action=url.searchParams.get('action'),data=route.request().postDataJSON();calls.push({action,data});let response;
  if(action==='session')response={user:{id:'test',name:'Designer',profile:{language:'nl'}},csrf:'test',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:true,mail:false}};
  else if(action==='project_access')response={reason:'ready'};
  else if(action==='client_project')response={share_id:'test-share',project_id:deck.project.id};
  else if(action==='projects')response={projects:[{...deck.project,iteration:deck.iteration}]};
  else if(action==='project'||action==='deck')response=deck;
  else if(['slide_image','file','comment_preview','document_page'].includes(action))return route.fulfill({contentType:'image/webp',body:await readFile(resolve(root,'assets/interior.webp'))});
  else if(action==='project_starting_pack')response={slides:[],documents:[]};
  else if(action==='mention_people')response={people:[]};
  else if(action==='slide_layout'){
   if(data.operation==='show'&&failUndoOnce){failUndoOnce=false;return route.fulfill({status:500,json:{error:'Please try again.'}});}
   deck.slide_layout??=[];let layout=deck.slide_layout.find(s=>s.slide_id===data.slide_id);
   if(!layout){layout={slide_id:data.slide_id};deck.slide_layout.push(layout);}
   layout.hidden=data.operation==='hide'?1:0;response={ok:true};
  }
  else if(action==='select_slide_image'){deck.slides.find(s=>s.id===data.slide_id).image_version_id=data.image_version_id;response={ok:true};}
  else if(action==='comment_answered'){
   const c=deck.communication.comments.find(c=>c.id===data.id);c.answered=data.answered?1:0;c.presentation_is_open=!data.answered;response={ok:true};
  }
  else if(action==='confirmation_decide'){
   const r=deck.communication.confirmations.find(r=>r.comment_id===data.id);r.status=data.decision;
   const c=deck.communication.comments.find(c=>c.id===data.id);c.confirmation.status=data.decision;response={ok:true};
  }
  else if(action==='read_comments'||action==='view_event')response={ok:true};
  else{errors.push('Unexpected API action: '+action);return route.fulfill({status:500,json:{error:'Unexpected request'}});}
  return route.fulfill({json:response});
 });
 const url=client?`${base}/client/projects/${deck.project.id}?iteration=${deck.iteration.id}&slide=${slide}&view=${mode}`:`${base}/${studio.id}/slide/${slide}?project=${deck.project.id}&iteration=${deck.iteration.id}&view=${mode}`;
 await page.goto(url);await page.locator('.presentation').waitFor();return {page,calls,deck};
}
for(const mode of ['slides','scroll'])for(const width of [1440,390])test(`Presentation controls and stable pins: ${mode}, ${width}px`,async t=>{
 const {page,deck,calls}=await setup(t,{width,mode});
 const content=()=>mode==='scroll'?page.locator('[data-scroll-slide="visual-render"]'):page.locator('.slide-area');
 await content().locator('.visual-image-area').waitFor();
 assert.equal(await content().locator('[data-image-variant],[data-action=enhance-slide],[data-action=photo-motion]').count(),0);
 assert.equal(await page.locator('[data-action=toggle-studio-tools]').count(),0);
 assert.equal(await page.locator('.preview-toolbar button').count(),10);
 assert.equal(await page.locator('.preview-slide-metadata').count(),0);
 await content().locator('.visual-image-area img').waitFor();
 const beforeImage=await content().locator('.visual-image-area img').getAttribute('src');
 assert.equal(await page.locator('.preview-toolbar button').allTextContents().then(labels=>labels.join('').trim()),'');
 if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`studio-tools-${mode}-${width}.png`)});}
 await page.locator('[data-action=review-image-versions]').click();
 await page.getByRole('dialog').locator('[data-image-variant]').selectOption('variant-old');
 await page.getByRole('dialog').locator('[data-action=use-image-version]').waitFor();
 assert.equal(await page.getByRole('dialog').locator('[data-image-variant]').inputValue(),'variant-old');
 assert.equal(await content().locator('.visual-image-area img').getAttribute('src'),beforeImage,'Unsaved versions do not change presentation content');
 await page.getByRole('dialog').locator('[data-action=use-image-version]').click();
 assert.equal(deck.slides[0].image_version_id,'variant-old');
 assert.ok(calls.some(c=>c.action==='select_slide_image'&&c.data.image_version_id==='variant-old'));
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
 const arm=toolbar.locator('[data-action=annotation-arm]'),resolved=toolbar.locator('[data-action=annotation-resolved]');
 if(width===1440){const a=await arm.boundingBox(),r=await resolved.boundingBox();assert.ok(Math.abs(a.y-r.y)<2);}
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

function parityDeck(deck,client){
 deck.project.language='en';deck.profile={language:'nl'};
 deck.slides.push({id:'hidden',type:'text',title:'Internal hidden slide',description:'Private design notes',manual:1});
 deck.slide_layout=[...(deck.slide_layout||[]),{slide_id:'visual-hidden',hidden:1}];
 deck.jobs=client?[]:[{id:'job',slide_id:'render',type:'slide_image_edit',status:'running'}];
 const comment=(id,audience,body,parent_id=null)=>({id,parent_id,audience,body,iteration_id:deck.iteration.id,iteration_number:1,slide:'visual-render',author:'someone@example.test',created_at:'2026-09-24T12:00:00Z',answered:0,is_open:true,thread_details:parent_id?null:{type:'conversation'},annotation:parent_id?null:{source_version_id:'source-pdf',page_number:11,image_number:0,image_version_id:'variant-new',x:.4,y:.4}});
 const comments=[comment('shared','shared','Shared design question'),comment('private','studio','Confidential studio thread'),comment('private-reply',undefined,'Confidential reply','private')];
 const q=(id,published,thread_id)=>({id,published,thread_id,iteration_id:deck.iteration.id,accepted:1,dismissed:0,resolved:0,question:published?'Published checklist question':'Unpublished studio question',item_type:'question',replies:[],citations:[]});
 const items=[q('public-q',1,'shared'),q('private-q',0,'private')];
 deck.comments=client?comments.filter(c=>c.id==='shared'):comments;
 deck.open_questions=client?items.filter(q=>q.published):items;
 deck.communication={actor:client?'client@example.test':'designer@example.test',comments:deck.comments,items:deck.open_questions,confirmations:[],attachments:[],guests:[],threads:[{id:'shared',title:'Shared design question'},{id:'private',title:'Confidential studio thread'}],recipients:[],iterations:[deck.iteration],iteration_files:{},iteration_slides:{[deck.iteration.id]:[{id:'visual-render',title:'A quiet living room'},{id:'visual-hidden',title:'Internal hidden slide'}]}};
}
for(const mode of ['slides','scroll'])test(`Studio and client share presentation content: ${mode}`,async t=>{
 const studio=await setup(t,{mode,configure:parityDeck}),client=await setup(t,{mode,client:true,configure:parityDeck});
 const content=page=>mode==='slides'?page.locator('.slide-area'):page.locator('.scroll-story');
 assert.equal(await studio.page.locator('html').getAttribute('lang'),'en');
 assert.equal(await client.page.locator('html').getAttribute('lang'),'en');
 await client.page.waitForFunction(()=>document.querySelector('[data-pin-id="shared"]'));
 assert.equal(await content(studio.page).innerText(),await content(client.page).innerText());
 for(const {page} of [studio,client]){
  assert.equal(await content(page).locator('.image-working,[data-image-variant],[data-action=edit-slide],[data-action=enhance-slide]').count(),0);
  assert.equal(await page.locator('[data-scroll-slide="visual-hidden"],[data-pin-id="private"]').count(),0);
  await page.waitForFunction(()=>document.querySelector('[data-pin-id="shared"]'));
  assert.equal(await page.locator('[data-pin-id="shared"]').count(),1);
 }
 const sharedBefore=await content(studio.page).innerText();
 await studio.page.waitForFunction(()=>document.querySelector('[data-pin-id="shared"]'));
 assert.equal(await content(studio.page).innerText(),sharedBefore,'Tools do not change slide content');
 await studio.page.locator('[data-action=review-image-versions]').click();
 await studio.page.locator('[data-image-variant]').selectOption('variant-old');
 assert.equal(await studio.page.locator('[data-action=use-image-version]').count(),0,'Cannot publish while an image job is running');
 await studio.page.locator('[data-action=close-modal]').first().click();
 for(const {page} of [studio,client]){
  if(mode==='slides')await page.locator('.presentation-sidebar-handle').hover();
  await page.locator(mode==='slides'?'.presentation-sidebar [data-action=comm-show]':'.scroll-header [data-action=comm-show]').click();
  await page.locator('.comm-client-page').waitFor();
  assert.equal(await page.locator('.comm-topic').count(),1);
  assert.ok(!(await page.locator('.comm-client-page').innerText()).includes('Confidential'));
  assert.equal(await page.locator('[data-action=check-run]').count(),0);
  await page.locator('[data-action=comm-new]').click();
  assert.equal(await page.locator('[name=audience]').inputValue(),'shared');
  assert.equal(await page.locator('[name=slide] option[value="visual-hidden"]').count(),0);
  await page.locator('[data-action=close-modal]').first().click();
  await page.locator('[data-action=comm-back]').click();
 }
});
for(const mode of ['slides','scroll'])test(`Open items use the shared communication view: ${mode}`,async t=>{
 const studio=await setup(t,{mode,slide:'open-questions',configure:parityDeck}),client=await setup(t,{mode,slide:'open-questions',client:true,configure:parityDeck});
 const checklist=page=>page.locator('.open-questions-slide');
 assert.equal(await checklist(studio.page).innerText(),await checklist(client.page).innerText());
 assert.equal(await checklist(studio.page).locator('[data-checklist-id="private-q"]').count(),0);
 assert.equal(await checklist(studio.page).locator('[data-action=edit-open-question],[data-action=suggest-open-questions]').count(),0);
 await studio.page.locator('[data-action=studio-checklist]').click();
 await studio.page.locator('.comm-client-page').waitFor();
 assert.ok(!(await studio.page.locator('.comm-client-page').innerText()).includes('Unpublished studio question'));
 await studio.page.locator('[data-action=comm-back]').click();
 assert.equal(await checklist(studio.page).innerText(),await checklist(client.page).innerText());
});

test('Studio tools respect read-only access',async t=>{
 const {page}=await setup(t,{mode:'slides',configure:deck=>{deck.can_edit=false;}});
 assert.equal(await page.locator('.preview-toolbar button:disabled').count(),7);
 for(const action of ['edit-slide','delete-slide','visibility-slide','enhance-slide','photo-motion'])assert.ok(await page.locator(`[data-action=${action}]`).isDisabled());
 await page.locator('[data-action=review-image-versions]').click();
 await page.locator('[data-image-variant]').selectOption('variant-old');
 assert.equal(await page.locator('[data-action=use-image-version]').count(),0);
});
test('Budget changes are available only in the studio editor panel',async t=>{
 const {page}=await setup(t,{mode:'slides',slide:'budget',configure:parityDeck});
 await page.locator('[data-action=studio-budget]').click();
 await page.getByRole('dialog').locator('[data-action=add-cost]').waitFor();
 assert.ok(await page.getByRole('dialog').locator('[data-action=edit-cost]').count()>0);
 assert.equal(await page.locator('.slide-area [data-action=edit-cost],.slide-area [data-action=add-cost]').count(),0);
});
test('Hidden slides require an explicit editor preview',async t=>{
 const {page}=await setup(t,{mode:'slides',configure:parityDeck});
 await page.locator('[data-action=exit-preview]').click();
 await page.locator('[data-action=open-editor-slide][data-id="visual-hidden"]').click();
 await page.locator('.slide-hidden-overlay').waitFor();
 assert.equal(await page.locator('.preview-toolbar button').count(),10);
 assert.ok(!(new URL(page.url()).pathname).includes('/slide/visual-hidden'));
 await page.locator('[data-action=exit-preview]').click();
 await page.locator('[data-action=preview]').first().click();
 assert.equal(await page.locator('.slide-hidden-overlay').count(),0);
 assert.ok(!(await page.locator('.slide-area').innerText()).includes('Private design notes'));
 assert.equal(await page.locator('[data-action=toggle-studio-tools]').count(),0);
 assert.equal(await page.locator('.preview-toolbar button').count(),10);
});

for(const mode of ['slides','scroll'])for(const width of [1440,390])test(`Toolbar icons and positions stay fixed across slide types: ${mode}, ${width}px`,async t=>{
 const {page}=await setup(t,{mode,width});
 const toolbar=page.locator('.preview-toolbar');
 const snapshot=()=>toolbar.locator('button').evaluateAll(buttons=>buttons.map(b=>({action:b.dataset.action,icon:b.innerHTML,x:Math.round(b.getBoundingClientRect().x),y:Math.round(b.getBoundingClientRect().y),width:b.offsetWidth,height:b.offsetHeight})));
 const before=await snapshot(),height=await page.locator('.preview-bar').evaluate(el=>el.offsetHeight);
 const actions=before.map(b=>b.action);
 assert.equal(actions.length,10);
 for(const action of ['studio-budget','studio-checklist'])assert.ok(await toolbar.locator(`[data-action=${action}]`).isDisabled());
 assert.ok(await toolbar.locator('[data-action=review-image-versions]').isEnabled());
 if(mode==='scroll')await toolbar.evaluate(el=>{window.originalToolbarButtons=[...el.querySelectorAll('button')];});
 const nav=page.locator(mode==='scroll'?'.scroll-header':'.presentation-sidebar');
 for(const [section,enabled] of [['budget','studio-budget'],['questions','studio-checklist'],['story',null]]){
  if(mode==='slides')await page.locator('.presentation-sidebar-handle').hover();
  await nav.locator(`[data-section="${section}"]`).click();
  if(enabled)await page.waitForFunction(action=>!document.querySelector(`.preview-toolbar [data-action="${action}"]`).disabled,enabled);
  else await page.waitForFunction(()=>document.querySelector('.preview-toolbar [data-action="studio-checklist"]').disabled);
  assert.deepEqual(await snapshot(),before);
  assert.equal(await page.locator('.preview-bar').evaluate(el=>el.offsetHeight),height);
  for(const action of ['review-image-versions','enhance-slide','photo-motion'])assert.ok(await toolbar.locator(`[data-action=${action}]`).isDisabled());
  assert.ok(await toolbar.locator('[data-action=review-image-versions]').locator('..').getAttribute('data-tooltip'));
  if(mode==='scroll')assert.ok(await toolbar.evaluate(el=>[...el.querySelectorAll('button')].every((button,index)=>button===window.originalToolbarButtons[index])));
 }
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});

for(const mode of ['slides','scroll'])for(const width of [1440,390])test(`Black tooltips and hide undo work in presentation: ${mode}, ${width}px`,async t=>{
 const {page,deck,calls}=await setup(t,{mode,width});
 const toolbar=page.locator('.preview-toolbar'),tooltip=page.locator('#preview-tool-tooltip');
 await toolbar.locator('[data-action=visibility-slide]').hover();
 await tooltip.waitFor({state:'visible'});
 assert.equal(await tooltip.innerText(),'Hide');
 assert.equal(await tooltip.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(32, 32, 30)');
 assert.equal(await toolbar.locator('[data-action=visibility-slide]').getAttribute('title'),null);
 const disabled=toolbar.locator('[data-action=studio-budget]').locator('..');
 await disabled.hover();assert.match(await tooltip.innerText(),/Manage budget.*Not available/);
 await disabled.focus();assert.equal(await disabled.getAttribute('aria-describedby'),'preview-tool-tooltip');
 assert.ok(await tooltip.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
 await page.keyboard.press('Escape');await tooltip.waitFor({state:'hidden'});
 assert.equal(await page.locator('.presentation').count(),1,'Escape dismisses the tooltip without exiting');
 await toolbar.locator('[data-action=visibility-slide]').click();
 await page.locator('#toast.show .toast-action').waitFor();
 assert.match(await page.locator('#toast').innerText(),/A quiet living room.*hidden/);
 assert.equal(deck.slide_layout.find(s=>s.slide_id==='visual-render').hidden,1);
 assert.notEqual(await toolbar.locator('[data-action=visibility-slide]').getAttribute('data-id'),'visual-render');
 if(process.env.TEST_SCREENSHOT_DIR){await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`hide-undo-${mode}-${width}.png`)});}
 await page.locator('#toast .toast-action').click();
 await page.waitForFunction(()=>document.querySelector('.preview-toolbar [data-action=visibility-slide]')?.dataset.id==='visual-render');
 assert.equal(deck.slide_layout.find(s=>s.slide_id==='visual-render').hidden,0);
 assert.equal(await page.locator('#toast.show').count(),0);
 assert.ok(await page.locator('#toast').evaluate(el=>el.inert));
 assert.deepEqual(calls.filter(c=>c.action==='slide_layout').map(c=>c.data.operation),['hide','show']);
 assert.equal(await toolbar.locator('button').count(),10);
});
test('Undo can restore the last visible slide and retry a failed request',async t=>{
 const {page,deck}=await setup(t,{mode:'slides',failUndoOnce:true,configure:deck=>{
  deck.slide_layout=presentationSlides(deck).filter(s=>s.id!=='visual-render').map(s=>({slide_id:s.id,hidden:1}));
 }});
 await page.locator('.preview-toolbar [data-action=visibility-slide]').click();
 await page.locator('#toast.show .toast-action').waitFor();
 assert.equal(await page.locator('.preview-toolbar').count(),0);
 await page.locator('#toast .toast-action').click();
 await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Please try again.'));
 assert.equal(deck.slide_layout.find(s=>s.slide_id==='visual-render').hidden,1);
 assert.ok(await page.locator('#toast .toast-action').isEnabled());
 await page.locator('#toast .toast-action').click();
 await page.locator('.preview-toolbar').waitFor();
 assert.equal(deck.slide_layout.find(s=>s.slide_id==='visual-render').hidden,0);
});

function openItemsDeck(deck,client){
 parityDeck(deck,client);
 const iid=deck.iteration.id,old='older-shared',draft='unpublished-iteration';
 const root=(id,title,type='conversation',extra={})=>({id,body:title,iteration_id:iid,iteration_number:2,slide:'general',audience:'shared',created_at:'2026-09-25T12:00:00Z',answered:0,author:'designer@example.test',thread_details:{type},...extra});
 const comments=[root('discussion','Choose the kitchen finish'),
  root('old-task','Order the flooring sample','todo',{iteration_id:old,iteration_number:1,slide:'old-slide',thread_details:{type:'todo',assignee:'client@example.test',assignee_name:'Alex Client',question_id:'task-item',resolved:false}}),
  root('approval','Approve the lighting plan','approval'),root('resolved','Kitchen layout agreed','conversation',{answered:1}),
  root('approved','Flooring quote approved','approval'),root('withdrawn','Superseded upholstery quote','approval'),
  root('blocked','Final layout decision','conversation',{answered:1}),
  root('child-approval','Confirm the last detail','approval',{parent_id:'blocked'}),
  root('private-root','Secret studio planning','conversation',{audience:'studio'}),
  root('draft-root','Unpublished next concept','conversation',{iteration_id:draft})];
 const approvals=[['approval','pending'],['approved','confirmed'],['withdrawn','withdrawn'],['child-approval','pending']].map(([id,status])=>{
  const c=comments.find(c=>c.id===id),r={comment_id:id,iteration_id:c.iteration_id,parent_id:c.parent_id||null,status,recipient:'client@example.test',recipient_name:'Alex Client',amount_cents:null,author:c.author,body:c.body,created_at:c.created_at};c.confirmation=r;return r;
 });
 deck.communication={actor:client?'client@example.test':'designer@example.test',comments:client?comments.filter(c=>!['private-root','draft-root'].includes(c.id)):comments,
  threads:comments.filter(c=>!c.parent_id).map(c=>({id:c.id,title:c.body})),confirmations:approvals,attachments:[],guests:[],
  items:[{id:'task-item',thread_id:'old-task',iteration_id:old,published:1,accepted:1,resolved:0,question:'Order the flooring sample'}],
  iterations:[{...deck.iteration,number:2,presentation_visible:true},{id:old,number:1,locked:0,status:'shared',presentation_visible:true,share_id:'old-share'},...(!client?[{id:draft,number:3,status:'draft',presentation_visible:false}]:[])],
  recipients:[{email:'client@example.test',name:'Alex Client',group:'clients',available:true}],
  iteration_recipients:{[old]:[{email:'client@example.test',name:'Alex Client',group:'clients',available:true}]},iteration_files:{},
  iteration_slides:{[old]:[{id:'old-slide',title:'Original flooring concept'}]},public_iteration_slides:{[old]:[{id:'old-slide',title:'Original flooring concept'}]}};
 deck.comments=deck.communication.comments.filter(c=>c.iteration_id===iid);
}
for(const mode of ['slides','scroll'])for(const width of [1440,390])test(`Open items show project threads, preserve origins, and update after completion: ${mode}, ${width}px`,async t=>{
 const studio=await setup(t,{mode,width,slide:'open-questions',configure:openItemsDeck});
 const client=await setup(t,{mode,width,client:true,slide:'open-questions',configure:openItemsDeck});
 const {page}=studio,slide=page.locator('.open-items-slide');
 assert.equal(await slide.innerText(),await client.page.locator('.open-items-slide').innerText());
 assert.equal(await slide.locator('.open-items-row').count(),4);
 assert.equal(await slide.locator('[data-id=child-approval],[data-id=private-root],[data-id=draft-root]').count(),0);
 assert.match(await slide.locator('[data-id=old-task]').innerText(),/Iteration 1.*Original flooring concept/);
 assert.match(await slide.locator('[data-id=blocked]').innerText(),/Awaiting approval/);
 assert.match(await slide.locator('[data-view=completed]').innerText(),/Completed.*3/s);
 if(process.env.TEST_SCREENSHOT_DIR){await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`open-items-${mode}-${width}.png`)});}
 await slide.locator('[data-id=old-task]').click();
 await page.locator('.comm-client-page').waitFor();
 assert.equal(await page.locator('[data-action=comm-source]').getAttribute('data-iteration'),'older-shared');
 assert.equal(await page.locator('[data-action=comm-source]').getAttribute('data-slide'),'old-slide');
 await page.locator('[data-action=comm-back]').click();
 await slide.locator('[data-view=completed]').click();
 assert.equal(await slide.locator('.open-items-row').count(),3);
 assert.match(await slide.locator('[data-id=withdrawn]').innerText(),/Withdrawn/);
 await slide.locator('[data-view=completed]').press('ArrowLeft');
 assert.equal(await slide.locator('[data-view=open]').getAttribute('aria-selected'),'true');
 await slide.locator('[data-id=discussion]').click();
 await page.locator('[data-action=comm-answered]').click();
 await page.waitForFunction(()=>document.querySelector('[data-action=comm-answered]')?.getAttribute('aria-checked')==='true');
 await page.locator('[data-action=comm-back]').click();
 assert.equal(await slide.locator('[data-id=discussion]').count(),0);
 await slide.locator('[data-view=completed]').click();
 assert.equal(await slide.locator('[data-id=discussion]').count(),1);
 await slide.locator('[data-id=discussion]').click();
 await page.locator('[data-action=comm-back]').click();
 assert.equal(await slide.locator('[data-view=completed]').getAttribute('aria-selected'),'true','Back retains the chosen tab');
 const clientSlide=client.page.locator('.open-items-slide');
 await clientSlide.locator('[data-id=approval]').click();
 await client.page.locator('[data-action=comm-confirm][data-id=approval]').click();
 await client.page.waitForFunction(()=>document.querySelector('[data-action=comm-confirm][data-id=approval]')?.getAttribute('aria-checked')==='true');
 await client.page.locator('[data-action=comm-back]').click();
 assert.equal(await clientSlide.locator('[data-id=approval]').count(),0);
 await clientSlide.locator('[data-view=completed]').click();
 assert.match(await clientSlide.locator('[data-id=approval]').innerText(),/Confirmed/);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
});
test('Repeated Open items slides have independent accessible tabs',async t=>{
 const {page}=await setup(t,{mode:'scroll',slide:'open-questions',configure:(deck,client)=>{openItemsDeck(deck,client);deck.system_slides=[{id:'open-items-copy',type:'open-questions'}];}});
 const original=page.locator('[data-open-items-slide="open-questions"]'),copy=page.locator('[data-open-items-slide="open-items-copy"]');
 await copy.locator('[data-view=completed]').click();
 assert.equal(await original.locator('[data-view=open]').getAttribute('aria-selected'),'true');
 assert.equal(await copy.locator('[data-view=completed]').getAttribute('aria-selected'),'true');
 assert.ok(await page.evaluate(()=>[...document.querySelectorAll('.open-items-tabs [role=tab]')].every(tab=>!!document.getElementById(tab.getAttribute('aria-controls')))));
});
