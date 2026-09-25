/* Real API coverage for inbox search, checkbox filtering and subject pagination. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.COMMUNICATION_BASE||'http://127.0.0.1:18496';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies([{name:'studiodeck_session',value:'editor',url:base}]);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const screenshot=async name=>{if(process.env.COMMUNICATION_SCREENSHOTS)await page.screenshot({path:process.env.COMMUNICATION_SCREENSHOTS+'/'+name+'.png',fullPage:true});};
 const search=owner=>page.locator(`[data-comm-search="${owner}"]`);
 const pagination=()=>page.locator('.comm-pagination');
 async function waitCount(selector,count){await page.waitForFunction(({selector,count})=>document.querySelectorAll(selector).length===count,{selector,count});}
 async function filter(owner,selected){
  await page.locator(`[data-comm-owner="${owner}"][data-comm-filter]`).click();
  assert.equal(await page.locator('.comm-filter-options input').count(),3);
  await page.locator(`[data-comm-owner="${owner}"][data-comm-select="${selected==='all'?'all':'none'}"]`).click();
  if(selected!=='all')for(const type of selected)await page.locator(`[data-comm-owner="${owner}"][data-comm-type="${type}"]`).check();
  await page.locator('.modal [data-action=close-modal]').last().click();
 }
 try{
  await page.goto(base+'/studio-a/comments');await search('studio').waitFor();
  const ids=await page.evaluate(async()=>{
   const session=await(await fetch('/api.php?action=session')).json(),ids=[];
   async function post(body){const response=await fetch('/api.php?action=communication_post',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({iteration:'iteration-shared',...body})});if(!response.ok)throw Error(await response.text());return response.json();}
   for(let n=1;n<=53;n++){const type=['conversation','todo','approval'][(n-1)%3];const result=await post({thread_title:'Pagination '+String(n).padStart(2,'0'),thread_type:type,body:'Inbox control example '+n,audience:'shared',...(type==='todo'?{assignee:'editor@example.test'}:{}),...(type==='approval'?{recipient:'client@example.test'}:{})});ids.push(result.id);}
   await post({parent_id:ids.at(-1),body:'A unique phrase only in a reply: moonlit linen.'});
   return ids;
  });
  await page.reload();await search('studio').fill('Pagination');
  await page.waitForFunction(()=>document.querySelector('.comm-pagination')?.textContent.includes('of 53 threads'));
  assert.equal(await page.locator('.comm-feed-card').count(),25);assert.equal(await search('studio').inputValue(),'Pagination');assert(await search('studio').evaluate(el=>el===document.activeElement));
  assert.equal(await page.locator('[data-filter=open] .comm-view-count').innerText(),'53');
  assert.equal(await page.locator('[data-filter=attention] .comm-view-count').innerText(),'18');
  assert.equal(await page.locator('[data-filter=all] .comm-view-count').count(),0);
  assert(await page.locator('[data-filter=open]').evaluate(el=>el.getBoundingClientRect().height>=42));
  assert(!await page.getByText('Your assigned work, approvals awaiting you, and unread mentions or replies in threads you participate in.',{exact:true}).count());
  const firstIds=await page.locator('.comm-feed-card [data-action=comm-location]').evaluateAll(els=>els.map(el=>el.dataset.id));
  await page.locator('[data-comm-owner=studio][data-comm-page="25"]').click();await page.waitForFunction(()=>document.querySelector('.comm-pagination')?.textContent.includes('26–50'));
  const secondIds=await page.locator('.comm-feed-card [data-action=comm-location]').evaluateAll(els=>els.map(el=>el.dataset.id));assert.equal(firstIds.filter(id=>secondIds.includes(id)).length,0);
  await page.locator('[data-comm-owner=studio][data-comm-page="50"]').click();await waitCount('.comm-feed-card',3);assert(await page.locator('[data-comm-owner=studio][data-comm-page="75"]').isDisabled());
  await page.locator('[data-comm-owner=studio][data-comm-sort]').click();await waitCount('.comm-feed-card',25);assert.equal(await page.locator('.comm-feed-card h3').first().innerText(),'Pagination 01');assert.match(await pagination().innerText(),/1–25/);
  await filter('studio',['conversation','todo']);await page.waitForFunction(()=>document.querySelector('.comm-pagination')?.textContent.includes('of 36 threads'));assert.equal(await page.locator('.comm-feed-card[data-thread-type=approval]').count(),0);assert(await page.locator('[data-comm-owner=studio][data-comm-filter]').evaluate(el=>el.classList.contains('is-active')));
  await filter('studio',[]);await page.getByRole('heading',{name:'No matching conversations',exact:true}).waitFor();assert(await page.locator('.comm-empty-art').isVisible());assert.equal(await pagination().count(),0);await screenshot('empty-desktop');
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert(await page.locator('.comm-list-tools').evaluate(el=>{const [search,filter,sort]=[...el.children].map(el=>el.getBoundingClientRect());return filter.left>=search.right&&sort.left>=filter.right&&Math.abs(search.top-sort.top)<2;}));await screenshot('empty-mobile');
  await page.locator('[data-comm-owner=studio][data-comm-reset]').click();await search('studio').fill('moonlit linen');await waitCount('.comm-feed-card',1);assert.equal(await page.locator('.comm-feed-card [data-action=comm-location]').getAttribute('data-id'),ids.at(-1));
  await page.setViewportSize({width:1440,height:1000});await search('studio').fill('No such thread');await page.getByRole('heading',{name:'No matching conversations',exact:true}).waitFor();
  await search('studio').fill('Pagination');await waitCount('.comm-feed-card',25);await screenshot('results-desktop');
  await page.goto(base+'/studio-a/projects/shared?iteration=iteration-shared&tab=comments');await search('project').fill('Pagination');await page.waitForFunction(()=>document.querySelector('.comm-pagination')?.textContent.includes('of 53 threads'));await waitCount('.comm-topic',25);
  assert.equal(await page.locator('[data-view=open] .comm-view-count').innerText(),'53');
  assert.equal(await page.locator('[data-view=attention] .comm-view-count').innerText(),'18');
  assert.equal(await page.locator('[data-view=all] .comm-view-count').count(),0);
  await page.locator('[data-comm-owner=project][data-comm-page="25"]').click();assert.match(await pagination().innerText(),/26–50/);assert.equal(await page.locator('.comm-topic').count(),25);
  await page.locator('[data-comm-owner=project][data-comm-page="50"]').click();assert.equal(await page.locator('.comm-topic').count(),3);
  await filter('project',['approval']);assert.equal(await page.locator('.comm-topic').count(),17);assert.equal(await page.locator('.comm-topic:not([data-thread-type=approval])').count(),0);
  await filter('project','all');await page.locator('[data-comm-owner=project][data-comm-sort]').click();assert.equal(await page.locator('.comm-topic strong').first().innerText(),'Pagination 01');
  await search('project').fill('moonlit linen');await waitCount('.comm-topic',1);assert.equal(await page.locator('.comm-topic').getAttribute('data-id'),ids.at(-1));
  await search('project').fill('No such thread');await page.getByRole('heading',{name:'No matching conversations',exact:true}).waitFor();assert.equal(await page.locator('.comm-hub').count(),0);await screenshot('project-empty');
  await page.locator('[data-comm-owner=project][data-comm-reset]').click();await waitCount('.comm-topic',25);
  assert.deepEqual(errors,[]);console.log('PASS search across replies, multi-select filters, clear/reset, 25-thread pagination, sorting, illustrated empty states, keyboard focus and mobile alignment.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
