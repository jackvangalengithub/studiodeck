// Run against scripts/preview.mjs (the browser-only demo).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.STUDIODECK_TEST_URL||'http://localhost:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  for(const path of ['/','/mock/']){
   const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+path);await page.locator(path==='/'?'[data-action=preview-project]':'[data-action=preview]').first().click();
   const deck=page.locator('.presentation'),sidebar=page.locator('.presentation-sidebar'),content=page.locator('.presentation-sidebar-content'),handle=page.locator('.presentation-sidebar-handle'),pin=page.locator('.presentation-sidebar-pin'),area=page.locator('.slide-area:not(.slide-outgoing)');
   await deck.waitFor();assert.equal(await handle.getAttribute('aria-expanded'),'false');assert.equal(await content.evaluate(el=>el.inert),true);
   const original=await area.boundingBox(),editor=await page.locator('.preview-bar').boundingBox();assert.equal(original.x,0);assert.equal(original.y,editor.y+editor.height,'Only the admin editor bar remains above the slide');assert.equal(await page.locator('.presentation-chrome-top,.presentation-top').count(),0);
   await handle.hover();await page.waitForTimeout(300);assert.equal(await handle.getAttribute('aria-expanded'),'true');assert.deepEqual(await area.boundingBox(),original,'Hover overlays the slide without resizing');
   assert.equal(await sidebar.locator('.presentation-brand,.presentation-identity').count(),2);
   for(const action of ['project-documents','originals','feedback','toggle-fullscreen'])assert.equal(await sidebar.locator(`[data-action=${action}]`).count(),1);
   for(const action of ['project-documents','originals','feedback']){
    await handle.hover();await sidebar.locator(`[data-action=${action}]`).click();await page.locator('.modal').waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
   }
   await page.mouse.move(900,600);await page.waitForTimeout(300);assert.equal(await handle.getAttribute('aria-expanded'),'false');
   await handle.hover();await pin.click();await page.mouse.move(900,600);
   const docked=await area.boundingBox(),panel=await sidebar.boundingBox();assert.ok(Math.abs(docked.x-panel.width)<1);assert.equal(docked.width,original.width-panel.width);assert.equal(await pin.getAttribute('aria-pressed'),'true');
   await page.screenshot({path:'/tmp/studiodeck-sidebar-desktop'+(path==='/'?'':'-mock')+'.png'});
   await sidebar.locator('[data-action=next-slide]').click();await page.locator('.slide-outgoing').waitFor({state:'detached'});assert.equal(await pin.getAttribute('aria-pressed'),'true');assert.equal((await area.boundingBox()).x,docked.x);
   await pin.click();await page.mouse.move(900,600);await page.waitForTimeout(300);assert.equal(await handle.getAttribute('aria-expanded'),'false');assert.equal((await area.boundingBox()).x,0);
   await handle.focus();await page.keyboard.press('Enter');assert.equal(await handle.getAttribute('aria-expanded'),'true');await page.waitForTimeout(300);await page.keyboard.press('Tab');assert.equal(await pin.evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await handle.getAttribute('aria-expanded'),'false');assert.equal(await handle.evaluate(el=>el===document.activeElement),true);
   await handle.hover();const foldout=page.locator('[data-section-menu]').first();if(await foldout.count()){
    await foldout.click();await page.locator('#section-slide-menu').waitFor();await page.locator('#section-slide-menu button').first().hover();assert.equal(await handle.getAttribute('aria-expanded'),'true');
    const menu=await page.locator('#section-slide-menu').boundingBox();assert.ok(menu.y+menu.height<=1000);await page.keyboard.press('Escape');
   }
   await page.locator('[data-action=toggle-fullscreen]').click();await page.waitForFunction(()=>document.body.classList.contains('presentation-fullscreen'));
   await page.locator('#main').focus();await page.mouse.move(900,600);await page.waitForFunction(()=>document.body.classList.contains('presentation-controls-hidden'));await page.waitForTimeout(320);
   assert.equal(await page.locator('.presentation-chrome-top').count(),0);assert.equal(await handle.isVisible(),true);assert.equal((await area.boundingBox()).y,0);assert.equal((await area.boundingBox()).height,1000);
   await handle.hover();await pin.click();assert.ok((await area.boundingBox()).x>0);await pin.click();
   await page.locator('#main').focus();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('presentation-fullscreen'));
   await page.setViewportSize({width:390,height:844});await page.locator('#main').focus();await page.mouse.move(350,700);await page.waitForTimeout(300);
   await handle.focus();await page.keyboard.press('Enter');await page.waitForTimeout(300);
   const rail=page.locator('.presentation-sidebar-scroll');await rail.evaluate(el=>el.scrollTop=el.scrollHeight);
   const nav=await page.locator('.presentation-slide-navigation').boundingBox();assert.ok(nav.y+nav.height<=844);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
   await pin.click();assert.ok((await area.boundingBox()).x>0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
   await page.setViewportSize({width:390,height:520});assert.ok(await rail.evaluate(el=>el.scrollHeight>el.clientHeight),'All sidebar controls scroll on short screens');assert.ok((await page.locator('.presentation-slide-navigation').boundingBox()).y<520);await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:'/tmp/studiodeck-sidebar-mobile'+(path==='/'?'':'-mock')+'.png'});
   assert.deepEqual(errors,[]);await page.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const page=await context.newPage();await page.goto(base);await page.locator('[data-action=preview-project]').first().tap();
  const handle=page.locator('.presentation-sidebar-handle');await handle.tap();assert.equal(await handle.getAttribute('aria-expanded'),'true');await page.touchscreen.tap(375,400);assert.equal(await handle.getAttribute('aria-expanded'),'false');await context.close();
  console.log('PASS presentation sidebar: all branding/actions in sidebar, admin-only top bar, working dialogs, collapsed default, hover overlay, pin layout and slide persistence, keyboard, menus, fullscreen, mobile and touch.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
