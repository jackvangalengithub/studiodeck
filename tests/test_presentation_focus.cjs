// Run against an isolated PHP server with log-only email; no AI generation occurs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
const base=process.env.STUDIODECK_TEST_URL,mailLog=process.env.STUDIODECK_TEST_MAIL_LOG;
if(!base||!mailLog)throw Error('Set isolated STUDIODECK_TEST_URL and STUDIODECK_TEST_MAIL_LOG.');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});let page;try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];if(process.env.STUDIODECK_TEST_WORKSPACE_ASSETS)for(const name of ['app.js','app.css'])await page.route('**/assets/'+name,route=>route.fulfill({path:process.env.STUDIODECK_TEST_WORKSPACE_ASSETS+'/'+name}));page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('input[name=email]').fill(`focus-${Date.now()}@example.test`);await page.getByRole('button',{name:'Email me a sign-in link'}).click();await page.waitForSelector('.login .notice');
 const token=fs.readFileSync(mailLog,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];await page.goto(base+'/#/login/'+token);await page.reload();await page.getByRole('button',{name:'Continue'}).click();await page.waitForSelector('#project-search');
 const made=await page.evaluate(async()=>{
  const s=await(await fetch('/api.php?action=session')).json(),headers={'Content-Type':'application/json','X-CSRF-Token':s.csrf};
  const post=async(action,body)=>{const r=await fetch('/api.php?action='+action,{method:'POST',headers,body:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json();};
  const p=await post('create_project',{name:'Presentation focus'});
  for(let n=0;n<25;n++)await post('save_budget',{iteration:p.iteration_id,label:'Cost '+n,kind:'estimate',price_type:'fixed',amount:'100'});
  for(let n=0;n<12;n++){const group=await post('add_slide_group',{iteration:p.iteration_id,label:'Project chapter '+n});await post('save_slide',{iteration:p.iteration_id,type:'text',title:'Chapter '+n,description:'A chapter with some text.',section:group.id});}
  const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;canvas.getContext('2d').fillRect(0,0,800,600);const blob=await new Promise(r=>canvas.toBlob(r));
  const form=new FormData();Object.entries({iteration:p.iteration_id,type:'render',title:'Concept render',section:'designs',situation:'concept'}).forEach(([k,v])=>form.set(k,v));form.set('image',blob,'photo.png');
  const response=await fetch('/api.php?action=save_slide',{method:'POST',headers:{'X-CSRF-Token':s.csrf},body:form});if(!response.ok)throw Error(await response.text());const slide=await response.json();return {...p,studio:s.studio.id,slide:slide.id};
 });
 // Enable only the image-editing UI; this test never submits an AI request.
 await page.route('**/api.php?action=project&**',async route=>{const response=await route.fetch(),data=await response.json();data.capabilities.ai=true;if(process.env.STUDIODECK_TEST_WORKSPACE_ASSETS)data.files.push(...['a','b'].map(id=>({id,name:id+'.csv',category:'budget',mime:'text/csv',size:20,pages:[],metadata:{}})));data.enhancements={remaining:10,limit:10,plan_type:'project_pass',reserved:0};await route.fulfill({response,json:data});});
 const project=`${base}/${made.studio}/projects/${made.project_id}`,slide=id=>`${base}/${made.studio}/slide/${id}?project=${made.project_id}&iteration=${made.iteration_id}`;
 await page.goto(project+'?tab=budget');await page.locator('[data-budget-total]').waitFor();assert.equal(await page.locator('.chat-panel').count(),0);if(process.env.STUDIODECK_TEST_WORKSPACE_ASSETS)assert.equal(await page.locator('[data-action=match-subquotes]').count(),1);
 const selectBox=await page.locator('#iteration-select').boundingBox(),plusBox=await page.locator('.iteration-controls [data-action=iteration]').boundingBox();assert.ok(Math.abs(selectBox.y+selectBox.height/2-plusBox.y-plusBox.height/2)<2);
 await page.goto(slide(made.slide));await page.locator('.presentation').waitFor();assert.equal(await page.locator('.preview-bar input,.preview-bar select').count(),0);assert.equal(await page.locator('#app [data-enhancement-allowance]:visible').count(),0);
 await page.locator('[data-action=enhance-slide]').click();await page.locator('.ai-preset-buttons').waitFor();
 const tops=await page.locator('.ai-preset-buttons button').evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().top)));assert.equal(new Set(tops).size,1,'Desktop image presets fit one row');
 if(await page.locator('.modal [data-enhancement-allowance]').count())assert.match(await page.locator('.modal [data-enhancement-allowance]').innerText(),/10 AI enhancements left/);
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.goto(slide('budget'));await page.locator('.chat-panel').waitFor();assert.equal(await page.locator('[data-action=match-subquotes]').count(),0);
 for(const scroll of [450,950]){
  await page.locator('.slide-area:not(.slide-outgoing)').evaluate((el,y)=>el.scrollTop=y,scroll);await page.waitForTimeout(80);
  const total=await page.locator('.budget-sticky-summary').boundingBox(),chat=await page.locator('.chat-panel').boundingBox();assert.ok(chat.y>=total.y+total.height+10,'Sticky chat stays below sticky total');
 }
 assert.equal(await page.locator('.presentation-footer').count(),0);
 await page.locator('.presentation-sidebar-handle').hover();const source=await page.locator('.presentation-sidebar [data-action=originals]').boundingBox(),comments=await page.locator('.comment-balloon').boundingBox();assert.ok(source.y+source.height<=comments.y);
 assert.equal(await page.evaluate(()=>document.documentElement.clientWidth),1440,'No presentation gutter');
 await page.screenshot({path:'/tmp/studiodeck-focus-budget.png'});
 await page.goto(slide('intro'));await page.locator('.presentation').waitFor();await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-action=toggle-fullscreen]').click();await page.locator('#main').focus();await page.mouse.move(800,600);await page.waitForFunction(()=>document.body.classList.contains('presentation-fullscreen'));
 const area=await page.locator('.slide-area:not(.slide-outgoing)').boundingBox();assert.ok(area.height>=990,'Fullscreen slide uses the full height');
 await page.waitForFunction(()=>document.body.classList.contains('presentation-controls-hidden'));await page.waitForTimeout(320);
 assert.equal(await page.locator('.presentation-chrome-top').count(),0);assert.equal(await page.locator('.presentation-footer').count(),0);
 const before=page.url();await page.keyboard.press('ArrowRight');await page.waitForFunction(before=>location.href!==before,before);assert.ok(await page.locator('body').evaluate(el=>el.classList.contains('presentation-controls-hidden')));
 const afterArea=await page.locator('.slide-area:not(.slide-outgoing)').boundingBox();assert.equal(afterArea.height,area.height);
 await page.mouse.move(300,300);await page.waitForFunction(()=>!document.body.classList.contains('presentation-controls-hidden'));await page.waitForTimeout(320);assert.ok(await page.locator('.presentation-sidebar-handle').isVisible());
 await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>document.body.classList.contains('presentation-controls-hidden'));
 await page.evaluate(()=>document.dispatchEvent(new Event('touchstart')));await page.waitForFunction(()=>!document.body.classList.contains('presentation-controls-hidden'));
 await page.waitForTimeout(330);await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-action=feedback]').click();await page.waitForTimeout(2400);assert.ok(!await page.locator('body').evaluate(el=>el.classList.contains('presentation-controls-hidden')),'Open dialogs remain usable');await page.keyboard.press('Escape');
 await page.waitForFunction(()=>document.body.classList.contains('presentation-controls-hidden'));await page.keyboard.press('Tab');assert.ok(!await page.locator('body').evaluate(el=>el.classList.contains('presentation-controls-hidden')),'Tab restores keyboard access');
 await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-action=jump-section][data-section=budget]').click();await page.locator('.presentation-budget').waitFor();await page.locator('.slide-outgoing').waitFor({state:'detached'});
 const chromeHeight=0;
 assert.ok((await page.locator('.presentation-budget .slide-heading').boundingBox()).y>chromeHeight+16,'Fullscreen heading clears the toolbar');
 await page.locator('.slide-area:not(.slide-outgoing)').evaluate(el=>el.scrollTop=900);
 await page.mouse.move(350,330);await page.waitForTimeout(350);
 const sticky=await page.locator('.budget-sticky-summary').boundingBox(),panel=await page.locator('.chat-panel').boundingBox();assert.ok(sticky.y>=chromeHeight,'Sticky budget stays within the slide');assert.ok(panel.y>=sticky.y+sticky.height+10,'Chat clears both sticky toolbar and total');
 await page.screenshot({path:'/tmp/studiodeck-navigation-fullscreen.png'});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('presentation-fullscreen'));assert.ok(await page.locator('.preview-bar').isVisible());
 await page.setViewportSize({width:390,height:844});
 const handle=page.locator('.presentation-sidebar-handle'),pin=page.locator('.presentation-sidebar-pin');
 await page.locator('#main').focus();await page.mouse.move(350,700);await page.waitForTimeout(300);
 assert.equal(await handle.getAttribute('aria-expanded'),'false');
 const initialArea=await page.locator('.slide-area:not(.slide-outgoing)').boundingBox();
 await handle.hover();await page.waitForTimeout(300);
 assert.deepEqual(await page.locator('.slide-area:not(.slide-outgoing)').boundingBox(),initialArea,'Hover overlays without moving the slide');
 const rail=page.locator('.presentation-sidebar-scroll');await rail.evaluate(el=>el.scrollTop=el.scrollHeight);
 assert.ok(await rail.evaluate(el=>el.scrollTop>0),'Groups scroll vertically');
 const nav=await page.locator('.presentation-slide-navigation').boundingBox();assert.ok(nav.y+nav.height<=844,'Slide controls remain visible');
 await pin.click();await page.mouse.move(350,700);
 const pinnedArea=await page.locator('.slide-area:not(.slide-outgoing)').boundingBox(),sidebar=await page.locator('.presentation-sidebar').boundingBox();
 assert.ok(Math.abs(pinnedArea.x-sidebar.width)<1,'Pinned sidebar reserves space');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);await page.screenshot({path:'/tmp/studiodeck-navigation-mobile.png'});
 await pin.click();await page.mouse.move(350,700);await page.waitForTimeout(300);assert.equal(await handle.getAttribute('aria-expanded'),'false');
 await page.setViewportSize({width:390,height:844});await page.goto(project+'?tab=budget');await page.locator('#iteration-select').waitFor();assert.equal(await page.locator('.chat-panel').count(),0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 assert.deepEqual(errors,[]);console.log('PASS admin/viewer controls, aligned iteration picker, one-row AI presets, sticky chat, fullscreen overlays, timeout, mouse/touch/Tab reveal, keyboard slide navigation, fullscreen text spacing, sidebar hover, vertical group overflow, pinned layout and no gutter.');
}catch(e){if(page)await page.screenshot({path:'/tmp/studiodeck-focus-failure.png'});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
