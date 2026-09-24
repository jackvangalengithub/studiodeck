// Run against scripts/preview.mjs. Isolated API responses; no existing project data is changed.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const {readFile}=require('node:fs/promises');
const {resolve}=require('node:path');
const base=process.env.STUDIODECK_TEST_URL||'http://localhost:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base);
  const fixture=await page.evaluate(async()=>{const {demoRequest}=await import('/assets/demo.js');return {session:await demoRequest('session'),deck:await demoRequest('deck')};});
  const deck=fixture.deck;deck.comments=[];deck.can_edit=false;deck.profile={name:'Test client',language:'en'};
  deck.slides=[];deck.slide_layout=[];deck.slide_sections=[];deck.slide_groups={story:'The story',moodboards:'Materials',designs:'The designs',budget:'The investment',questions:'Questions',empty:'Empty chapter'};
  const types=['text','fullphoto','video','moodboard','photo','photo','floorplan','render','drawing'];
  for(const [n,type] of types.entries()){
   const id='reading-'+n,source='reading-source-'+n;
   deck.slides.push({id,type,manual:1,source_version_id:['text','video'].includes(type)?null:source,title:'Reading '+type+' '+n,description:'A considered space, with room for everyday life.',situation:'concept',page_number:0,image_number:0,metadata:type==='video'?{video:{provider:'youtube',id:'dQw4w9WgXcQ',start:0}}:{}});
   if(!['text','video'].includes(type))deck.files.push({...deck.files[0],id:source,asset_id:source,name:source+'.webp',url:null,preview_url:null,history:[]});
   deck.slide_sections.push({slide_id:'visual-'+id,section:n<3?'story':n===3?'moodboards':'designs'});
  }
  deck.slides.push({...deck.slides[0],id:'hidden-reading',title:'Hidden material'},{...deck.slides[0],id:'deleted-reading',title:'Deleted material'});
  deck.slide_layout.push({slide_id:'visual-hidden-reading',hidden:1},{slide_id:'visual-deleted-reading',deleted:1});
  deck.system_slides=[{id:'budget-copy',type:'budget'}];deck.slide_sections.push({slide_id:'budget-copy',section:'budget'});
  const html=await readFile(resolve('public/index.html'),'utf8'),photo=await readFile(resolve('public/assets/interior.webp'));
  const imageRequests=[],comments=[];
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(request.isNavigationRequest()&&request.resourceType()==='document')return route.fulfill({contentType:'text/html',body:html});
   if(url.pathname!=='/api.php')return route.continue();
   const action=url.searchParams.get('action'),body=request.method()==='POST'?request.postDataJSON():Object.fromEntries(url.searchParams);
   if(['slide_image','file','comment_preview'].includes(action)){imageRequests.push(body.slide_id||body.id);return route.fulfill({contentType:'image/webp',body:photo});}
   let result={ok:true};
   if(action==='session')result=fixture.session;
   else if(action==='client_project')result={share_id:'test-share',project_id:deck.project.id};
   else if(action==='deck'||action==='project')result=deck;
   else if(action==='project_access')result={reason:'ready'};
   else if(action==='projects')result={projects:[{...deck.project,iteration:deck.iteration,file_count:deck.files.length}]};
   else if(action==='comment'){const comment={...body,id:'test-comment-'+comments.length,author:'Test client',created_at:new Date().toISOString(),iteration_id:deck.iteration.id};comments.push(comment);deck.comments.push(comment);result={id:comment.id};}
   else if(action==='budget_choice'){Object.assign(deck.budget.find(row=>row.id===body.id),body);result={budget:deck.budget};}
   else if(action==='mention_people')result={people:[]};
   else if(action==='project_starting_pack')result={documents:[],slides:[]};
   else if(action==='budget_chat')result={answer:'The selected investment is shown above.',sources:[]};
   await route.fulfill({json:result});
  });
  const clientUrl=base+'/client/projects/'+deck.project.id+'?iteration='+deck.iteration.id+'&view=scroll';
  await page.goto(clientUrl);await page.locator('.presentation-scroll').waitFor();
  assert.equal(await page.locator('.scroll-header [data-mode=scroll]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-scroll-slide="visual-hidden-reading"],[data-scroll-slide="visual-deleted-reading"]').count(),0);
  assert.equal(await page.locator('.scroll-chapters [data-section=empty]').count(),0);
  assert.equal(await page.locator('#main h1').count(),1);
  const ids=await page.locator('[id]').evaluateAll(els=>els.map(el=>el.id));assert.equal(new Set(ids).size,ids.length,'Repeated budgets have unique DOM IDs');
  await page.waitForTimeout(200);assert.ok(!imageRequests.includes('reading-8'),'Distant authenticated images are not fetched on opening');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight>innerHeight*3));
  const section=id=>page.locator(`[data-scroll-slide="${id}"]`);
  const jump=async id=>{await section(id).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.waitForTimeout(100);};
  await jump('visual-reading-4');await section('visual-reading-4').locator('.visual-image-area img').waitFor();
  await section('visual-reading-4').locator('[data-action=magnify-photo]').click();assert.match(await page.locator('.photo-lightbox-header').innerText(),/Reading photo 4/);await page.keyboard.press('Escape');
  await section('visual-reading-4').locator('[data-action=annotation-arm]').click();
  await section('visual-reading-4').locator('.annotation-layer').press('ArrowLeft');await section('visual-reading-4').locator('.annotation-layer').press('Enter');
  assert.equal(await page.locator('[data-form=feedback] input[name=slide]').inputValue(),'visual-reading-4');
  await page.locator('[data-form=feedback] textarea').fill('Please keep this warm finish.');
  await page.locator('[data-form=feedback] button[type=submit]').click();await page.getByText('Please keep this warm finish.',{exact:true}).waitFor();
  assert.equal(comments.at(-1).slide,'visual-reading-4');assert.equal(comments.at(-1).annotation.source_version_id,'reading-source-4');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  assert.equal(await section('visual-reading-4').locator('.annotation-pin').count(),1);assert.equal(await section('visual-reading-5').locator('.annotation-pin').count(),0);
  await section('visual-reading-5').locator('.scroll-section-footer [data-action=feedback]').click();
  assert.equal(await page.locator('[data-form=feedback] input[name=slide]').inputValue(),'visual-reading-5');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await jump('visual-reading-5');await page.locator('.scroll-header [data-mode=slides]').click();await page.locator('.presentation:not(.presentation-scroll)').waitFor();assert.match(await page.locator('.slide-area .slide-heading').innerText(),/Reading photo 5/);
  if(await page.locator('.modal').count())await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-mode=scroll]').click();await page.locator('.presentation-scroll').waitFor();
  assert.ok(Math.abs((await section('visual-reading-5').boundingBox()).y)<300,'Switching back restores the same section');
  await page.reload();await page.locator('.presentation-scroll').waitFor();assert.ok(Math.abs((await section('visual-reading-5').boundingBox()).y)<300,'Client deep link restores mode and section');
  await page.locator('.scroll-chapters [data-section=budget]').click();await page.waitForTimeout(150);assert.equal(await page.locator('.scroll-chapters [data-section=budget]').getAttribute('aria-current'),'true');
  await section('budget').locator('[data-action=toggle-cost]').first().click();assert.ok(await section('budget').locator('.budget-children').count());
  const before=await page.evaluate(()=>scrollY);await section('budget').locator('[data-action=toggle-cost]').first().click();assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before)<3,'Budget expansion does not reset the page');
  const chat=section('budget').locator('[data-form=chat]');await chat.locator('input').fill('What is the investment?');await chat.locator('button').click();await section('budget').getByText('The selected investment is shown above.',{exact:true}).waitFor();assert.ok(await page.evaluate(()=>scrollY)>1000,'Chat updates preserve reading position');
  await jump('visual-reading-6');await section('visual-reading-6').locator('[data-plan-zoom=".25"]').click();assert.equal(await section('visual-reading-6').locator('output').innerText(),'125%');
  await page.locator('.scroll-header [data-action=toggle-fullscreen]').click();await page.waitForFunction(()=>document.body.classList.contains('presentation-fullscreen'));assert.equal(await page.locator('.scroll-header').isVisible(),true);await page.keyboard.press('Escape');
  await page.setViewportSize({width:390,height:844});await page.locator('.scroll-chapters [data-section-menu=moodboards]').click();await page.getByRole('menuitem').first().click();await page.waitForTimeout(150);assert.equal(await page.locator('.scroll-chapters [data-section=moodboards]').getAttribute('aria-current'),'true');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
  await section('visual-reading-3').locator('[data-action=magnify-photo]').click();assert.match(await page.locator('.photo-lightbox-header').innerText(),/Reading moodboard 3/);await page.keyboard.press('Escape');
  await page.screenshot({path:'/tmp/studiodeck-scroll-mobile.png'});
  await page.locator('.scroll-end [data-action=scroll-top]').click();await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>scrollY)<250);
  await page.screenshot({path:'/tmp/studiodeck-scroll-cover.png'});
  // Studio links use the same mode and anchor, including after reload.
  await page.setViewportSize({width:1440,height:1000});
  const studioUrl=base+'/demo/slide/visual-reading-7?project='+deck.project.id+'&iteration='+deck.iteration.id+'&view=scroll';
  await page.goto(studioUrl);await page.locator('.presentation-scroll').waitFor();
  assert.ok(Math.abs((await section('visual-reading-7').boundingBox()).y)<300,'Studio deep link restores its section');
  await page.reload();await page.locator('.presentation-scroll').waitFor();assert.ok(Math.abs((await section('visual-reading-7').boundingBox()).y)<300);
  await page.locator('.scroll-header [data-mode=slides]').click();await page.locator('.presentation:not(.presentation-scroll)').waitFor();
  await page.goBack();await page.locator('.presentation-scroll').waitFor();assert.ok(Math.abs((await section('visual-reading-7').boundingBox()).y)<300,'Back restores the previous mode');
  deck.project.theme={...deck.project.theme,mode:'dark',background:'#152235'};
  await page.goto(clientUrl);await page.locator('.presentation-scroll').waitFor();assert.equal(await page.locator('html').getAttribute('data-project-mode'),'dark');
  assert.equal(await page.locator('.scroll-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(21, 34, 53)');
  await page.screenshot({path:'/tmp/studiodeck-scroll-dark.png'});
  const visibleIds=await page.locator('[data-scroll-slide]').evaluateAll(els=>els.map(el=>el.dataset.scrollSlide));
  deck.slide_layout.push(...visibleIds.map(slide_id=>({slide_id,hidden:1})));
  await page.reload();await page.getByRole('heading',{name:'No visible slides'}).waitFor();assert.equal(await page.locator('[data-mode=slides]').count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS scrolling presentation: visibility, native scroll, lazy authenticated images, contextual comments/pins, zoom, switching, deep links, repeated budgets, chat, floorplans, fullscreen and mobile.');
 }catch(error){await page.screenshot({path:'/tmp/studiodeck-scroll-failure.png'});throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
