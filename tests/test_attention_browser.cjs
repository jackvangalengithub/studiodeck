/* Communication presets against the isolated real API fixture. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.COMMUNICATION_BASE||'http://127.0.0.1:18517';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addCookies([{name:'studiodeck_session',value:'editor',url:base}]);
 async function api(action,data){const headers={'X-CSRF-Token':'csrf-editor','X-Studio-Id':'studio-a'};const r=data?await context.request.post(base+'/api.php?action='+action,{headers,data}):await context.request.get(base+'/api.php?action='+action,{headers});assert.ok(r.ok(),await r.text());return r.json();}
 try{
  const finished=await api('communication_post',{iteration:'iteration-shared',thread_title:'Finished conversation',body:'All done'});
  await api('comment_answered',{iteration:'iteration-shared',id:finished.id,answered:true});
  const task=await api('communication_post',{iteration:'iteration-shared',thread_title:'Arrange samples',body:'Bring the oak samples',message_type:'todo',assignee:'editor@example.test'});
  await page.goto(base+'/studio-a/attention');
  await page.getByRole('heading',{name:'Communication',exact:true}).waitFor();
  await page.waitForURL(/\/comments\?filter=attention$/);
  assert.equal(await page.locator('.sidebar [data-action=attention]').count(),0);
  assert.equal(await page.locator('[data-attention-dashboard]').count(),0);
  const preset=page.locator('[data-action=communication-filter][data-filter=attention]');
  assert.equal(await preset.getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByRole('heading',{name:'Finished conversation',exact:true}).count(),0);
  assert(await page.getByRole('heading',{name:'Arrange samples',exact:true}).isVisible());
  await page.locator('[data-action=communication-filter][data-filter=all]').click();
  await page.waitForURL(/\/comments$/);
  assert(await page.getByRole('heading',{name:'Finished conversation',exact:true}).isVisible());
  await preset.click();await page.waitForURL(/filter=attention$/);await page.reload();await preset.waitFor();
  assert.equal(await preset.getAttribute('aria-pressed'),'true');
  await page.locator('[data-action=sort-comments]').click();
  await page.waitForFunction(()=>document.querySelector('[data-action=sort-comments]').textContent.includes('Oldest'));
  await page.locator(`[data-action=comm-location][data-id="${task.id}"]`).click();
  await page.locator('#comm-reply-form').waitFor();
  await page.locator('[data-action=comm-view][data-view=attention]').click();
  assert.equal(await page.locator('.comm-topic').filter({hasText:'Finished conversation'}).count(),0);
  await page.locator('.comm-topic').filter({hasText:'Arrange samples'}).click();
  await page.locator(`[data-action=comm-work][data-id="${task.id}"]`).click();
  await page.locator('.comm-topic').filter({hasText:'Arrange samples'}).waitFor({state:'detached'});
  await page.locator('.sidebar [data-action=all-comments]').click();
  await preset.waitFor();assert.equal(await page.getByRole('heading',{name:'Arrange samples',exact:true}).count(),0);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
  assert(await preset.isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);
  console.log('PASS Communication attention preset, old-link redirect, sidebar removal, reload, completion and mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
