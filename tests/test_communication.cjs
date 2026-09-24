/* Thread purposes and plain replies against the disposable real API fixture. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const base=process.env.COMMUNICATION_BASE||'http://127.0.0.1:18496';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox']});
 const errors=[];
 async function account(session){const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('studiodeck.clientPresentationHelp.hidden','1'));await context.addCookies([{name:'studiodeck_session',value:session,url:base}]);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page;}
 const page=await account('editor'),client=await account('client');
 async function topic(p,title){await p.locator('[data-action=comm-view][data-view=all]').click();await p.locator('.comm-topic').filter({hasText:title}).click();}
 async function clientHub(){await client.goto(base+'/client/projects/shared?iteration=iteration-shared');await client.locator('.presentation-sidebar-handle').hover();await client.locator('[data-action=comm-show]').first().click();}
 try{
  await page.goto(base+'/studio-a/projects/shared?iteration=iteration-shared&tab=comments');await page.locator('#comm-reply').waitFor();
  assert.equal(await page.locator('.comm-view-tabs button').count(),2);
  assert.equal(await page.locator('#comm-reply-form [data-compose-type]').count(),0);
  await page.locator('[data-action=comm-new]').click();
  const fresh=page.locator('#comm-thread-form');assert.equal(await fresh.locator('[data-compose-type]').count(),3);
  await fresh.locator('[name=thread_title]').fill('Correct the cabinet finish');
  await fresh.locator('[name=body]').fill('These fronts should be oak, as specified.');
  await fresh.locator('.comm-attach-details summary').click();await fresh.locator('[name=version_id]').selectOption('file-shared');
  for(const type of ['todo','approval','conversation'])await fresh.locator('[data-compose-type='+type+']').click();
  assert.equal(await fresh.locator('[name=body]').inputValue(),'These fronts should be oak, as specified.');
  assert.equal(await fresh.locator('[name=version_id]').inputValue(),'file-shared');await fresh.locator('[name=assignee]').selectOption('editor@example.test');
  await fresh.locator('[type=submit]').click();await page.getByRole('heading',{name:'Correct the cabinet finish',exact:true}).waitFor();
  const root=await page.locator('.comm-topic.selected').getAttribute('data-id');
  assert.equal(await page.locator('.comm-thread-details').getAttribute('data-thread-type'),'conversation');
  assert.equal(await page.locator('.comm-messages .comm-type-label').count(),0);
  await page.locator('[data-action=comm-edit-thread]').click();
  const edit=page.locator('#comm-edit-thread-form');await edit.locator('[data-compose-type=todo]').click();await edit.locator('[name=assignee]').selectOption('editor@example.test');await edit.locator('[name=due_date]').fill('2026-10-12');await edit.locator('[type=submit]').click();
  await page.waitForFunction(()=>document.querySelector('.comm-thread-details')?.dataset.threadType==='todo');
  assert.match(await page.locator('.comm-thread-details').innerText(),/2026-10-12/);
  await page.locator('.comm-thread-history summary').click();assert.match(await page.locator('.comm-thread-history').innerText(),/Conversation → To do/);
  await page.locator('#comm-reply').fill('The supplier can replace them next Tuesday.');await page.locator('#comm-reply-form [type=submit]').click();await page.getByText('The supplier can replace them next Tuesday.',{exact:true}).waitFor();
  assert.match(await page.locator('.comm-message').first().innerText(),/The supplier can replace them next Tuesday/);assert(await page.evaluate(()=>document.querySelector('#comm-reply-form').compareDocumentPosition(document.querySelector('.comm-messages'))&Node.DOCUMENT_POSITION_FOLLOWING));
  await clientHub();assert.equal(await client.getByRole('heading',{name:'Correct the cabinet finish',exact:true}).count(),0);
  await page.locator('[data-action=comm-share]').click();await page.locator('[data-action=comm-do-share]').click();
  await page.locator('[data-action=comm-linked]').click();await fresh.locator('[name=thread_title]').fill('Oak price approval');await fresh.locator('[name=body]').fill('Approve the oak upgrade for 450 euro.');await fresh.locator('[data-compose-type=approval]').click();await fresh.locator('[name=recipient]').selectOption('client@example.test');await fresh.locator('[data-budget-toggle]').check();await fresh.locator('[name=amount]').fill('450');await fresh.locator('[type=submit]').click();
  await page.getByRole('heading',{name:'Oak price approval',exact:true}).waitFor();
  assert.equal(await page.locator('.comm-thread-details').getAttribute('data-thread-type'),'approval');
  assert.equal(await page.locator('[data-action=comm-edit-thread]').count(),0);
  assert.equal(await page.locator('.comm-messages .comm-confirmation').count(),0);
  await clientHub();await topic(client,'Oak price approval');await client.locator('[data-action=comm-confirm]').click();await client.getByText('Confirmation recorded.',{exact:true}).waitFor();
  await page.reload();await topic(page,'Correct the cabinet finish');
  assert.equal(await page.locator('[data-action=comm-work][data-resolved=true]').count(),1);
  await page.locator('[data-action=comm-work]').click();await page.locator('[data-action=comm-work][data-resolved=false]').waitFor();
  await page.locator('.comm-linked [data-action=comm-open]').click();assert.match(await page.locator('.comm-confirmation').innerText(),/Confirmed by/);
  await topic(page,'Correct the cabinet finish');await page.locator('[data-action=comm-work]').click();
  const next=await page.evaluate(async()=>{const session=await(await fetch('/api.php?action=session')).json();return(await fetch('/api.php?action=new_iteration',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({iteration:'iteration-shared'})})).json();});
  await page.goto(base+'/studio-a/projects/shared?iteration='+next.id+'&tab=comments');await topic(page,'Correct the cabinet finish');assert.equal(await page.locator('.comm-topic.selected').getAttribute('data-id'),root);
  await page.locator('[data-action=comm-linked]').click();assert.equal(await fresh.getAttribute('data-iteration'),'iteration-shared');await fresh.locator('[name=thread_title]').fill('Delivery planning');await fresh.locator('[name=body]').fill('Arrange access on Tuesday.');await fresh.locator('[type=submit]').click();await page.getByRole('heading',{name:'Delivery planning',exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('#comm-reply-form [data-compose-type]').count(),0);
  if(process.env.COMMUNICATION_SCREENSHOT)await page.screenshot({path:process.env.COMMUNICATION_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS thread picker, plain replies, conversion history, linked approvals, privacy, iteration continuity and mobile.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
