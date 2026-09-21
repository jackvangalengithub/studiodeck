/* Run against tests/fixtures/communication-server.py (isolated real API). */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.COMMUNICATION_BASE||'http://127.0.0.1:18517';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),client=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addCookies([{name:'studiodeck_session',value:'editor',url:base}]);await client.addCookies([{name:'studiodeck_session',value:'client',url:base}]);
 async function api(action,data,asClient=false){const ctx=asClient?client:context,headers=asClient?{'X-CSRF-Token':'csrf-client',Authorization:'Client client-share'}:{'X-CSRF-Token':'csrf-editor','X-Studio-Id':'studio-a'};const r=data?await ctx.request.post(base+'/api.php?action='+action,{headers,data}):await ctx.request.get(base+'/api.php?action='+action,{headers});assert.ok(r.ok(),await r.text());return r.json();}
 async function dashboard(){await page.goto(base+'/studio-a/attention');await page.locator('.attention-item').first().waitFor();}
 try{
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  await api('project_settings',{project_id:'shared',deadline:yesterday});
  await api('add_client_question',{iteration:'iteration-shared',question:'Which floor finish should we choose?'},true);
  const confirmation=await api('communication_post',{iteration:'iteration-shared',body:'Please approve the oak finish',recipient:'editor@example.test'},true);
  const feedback=await api('comment',{iteration:'iteration-shared',slide:'visual-slide-shared',body:'The kitchen needs more light'},true);
  const before=await api('attention');assert.equal(before.counts.feedback,2);
  await dashboard();await page.getByRole('heading',{name:'Needs attention',exact:true}).waitFor();
  assert.equal(await page.locator('.attention-item').count(),5);
  assert.equal((await api('attention')).counts.feedback,2);
  assert.equal(await page.locator('.attention-item').first().getAttribute('data-kind'),'deadlines');
  await page.locator('[data-action=attention-filter][data-kind=feedback]').click();await page.waitForURL(/kind=feedback/);
  await page.reload();await page.locator('.attention-item').first().waitFor();assert.equal(await page.locator('.attention-item').count(),2);
  await page.locator(`[data-action=attention-open][data-id="${feedback.id}"]`).click();await page.getByText('The kitchen needs more light',{exact:true}).waitFor();
  await page.waitForURL(/projects\/shared\?iteration=iteration-shared/);
  await dashboard();assert.equal((await api('attention')).counts.feedback,1);
  await page.locator(`[data-action=attention-open][data-kind=confirmations][data-id="${confirmation.id}"]`).click();
  await page.locator('[data-action=comm-confirm]').click();await page.getByText('Confirmation recorded.',{exact:true}).waitFor();
  await dashboard();assert.equal((await api('attention')).counts.confirmations,0);
  await page.locator('[data-action=attention-open][data-kind=questions]').click();await page.locator('.modal').getByText('Which floor finish should we choose?',{exact:true}).waitFor();
  await page.locator('[data-action=change-open-question][data-operation=resolve]').click();
  await dashboard();assert.equal((await api('attention')).counts.questions,0);
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('.attention-page').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:'/tmp/studiodeck-attention-mobile.png',fullPage:true,animations:'disabled'});
  await page.locator('[data-action=attention-filter][data-kind=questions]').click();await page.getByRole('heading',{name:'All caught up'}).waitFor();
  await page.locator('[data-action=attention-filter][data-kind=all]').click();
  await page.locator('[data-action=attention-open][data-kind=deadlines]').click();await page.getByRole('heading',{name:'Project shared',exact:true}).waitFor();
  assert.ok(page.url().includes('/projects/shared'));
  assert.deepEqual(errors,[]);console.log('PASS dashboard filters, reload, unread preservation, exact conversation/confirmation/question links, resolution and mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
