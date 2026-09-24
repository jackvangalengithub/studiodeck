/* Run against tests/fixtures/communication-server.py (isolated real API). */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.COMMUNICATION_BASE||'http://127.0.0.1:18517';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1400,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addCookies([{name:'studiodeck_session',value:'editor',url:base}]);
 const route=base+'/studio-a/slide/visual-slide-shared?project=shared&iteration=iteration-shared';
 const close=()=>page.locator('[data-action=comm-source]').click();
 try{
  await page.goto(route);
  await page.locator('[data-action=toggle-slide-original]').click();
  await page.locator('.annotation-layer').waitFor();
  await page.waitForFunction(()=>document.querySelector('.annotation-host img')?.naturalWidth>0);
  await page.locator('[data-action=annotation-arm]').click();
  await page.locator('.annotation-layer').press('ArrowLeft');await page.locator('.annotation-layer').press('Enter');
  await page.locator('#comm-thread-form [name=thread_title]').fill('Kitchen materials');
  await page.locator('#comm-thread-form textarea').fill('Pinned kitchen feedback');
  await page.locator('[data-compose-type=todo]').click();
  await page.locator('#comm-thread-form [name=assignee]').selectOption('editor@example.test');
  assert.equal(await page.locator('.comm-pin-preview img').count(),1);
  await page.locator('#comm-thread-form button[type=submit]').click();
  await page.getByText('Pinned kitchen feedback',{exact:true}).waitFor();await close();
  assert.equal(await page.locator('.annotation-pin').count(),1);
  await page.locator('.annotation-pin').click();
  await page.locator('#comm-reply').fill('Oak is available');await page.locator('#comm-reply-form button[type=submit]').click();
  await page.getByText('Oak is available',{exact:true}).waitFor();
  await page.locator('[data-action=comm-work]').click();await page.getByRole('button',{name:'Reopen',exact:true}).waitFor();await close();
  assert.equal(await page.locator('.annotation-pin').count(),0);
  await page.locator('[data-action=annotation-resolved]').click();await page.locator('.annotation-pin.resolved').waitFor();
  await page.locator('.annotation-pin').click();await page.locator('[data-action=comm-work]').click();await page.getByRole('button',{name:'Mark complete',exact:true}).waitFor();await close();
  await page.reload();await page.locator('[data-action=toggle-slide-original]').click();await page.locator('.annotation-pin').waitFor();
  await page.locator('[data-action=toggle-slide-original]').click();assert.equal(await page.locator('.annotation-pin').count(),0);
  const session=await (await context.request.get(base+'/api.php?action=session')).json();
  const saved=await context.request.post(base+'/api.php?action=save_slide',{headers:{'X-CSRF-Token':session.csrf,'X-Studio-Id':'studio-a'},data:{iteration:'iteration-shared',slide_id:'slide-shared',type:'floorplan',title:'Kitchen plan',description:'',situation:'concept'}});assert.equal(saved.status(),200,await saved.text());
  await page.reload();await page.locator('[data-action=toggle-slide-original]').click();await page.locator('.annotation-pin').waitFor();
  await page.locator('[data-plan-zoom=".25"]').click();await page.locator('[data-plan-zoom=".25"]').click();
  await page.locator('[data-action=annotation-arm]').click();for(let n=0;n<20;n++)await page.locator('.annotation-layer').press('ArrowRight');await page.locator('.annotation-layer').press('Enter');
  await page.locator('#comm-thread-form [name=thread_title]').fill('Floorplan detail');await page.locator('#comm-thread-form textarea').fill('Floorplan pin');await page.locator('#comm-thread-form button[type=submit]').click();await page.getByText('Floorplan pin',{exact:true}).waitFor();await close();
  await page.setViewportSize({width:390,height:844});await page.locator('.annotation-pin').last().click();await close();
  assert.ok(await page.locator('.presentation').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:'/tmp/studiodeck-annotations-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS pins, replies, resolution, version isolation, reload, keyboard placement, floorplan zoom and mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
