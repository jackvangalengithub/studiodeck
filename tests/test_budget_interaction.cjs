// Run against an isolated PHP server. No external playback or AI requests.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
const base=process.env.STUDIODECK_TEST_URL,mailLog=process.env.STUDIODECK_TEST_MAIL_LOG;
if(!base||!mailLog)throw Error('Set isolated STUDIODECK_TEST_URL and STUDIODECK_TEST_MAIL_LOG.');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});let page;try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('input[name=email]').fill(`budget-${Date.now()}@example.test`);await page.getByRole('button',{name:'Email me a sign-in link'}).click();await page.waitForSelector('.login .notice');
 const token=fs.readFileSync(mailLog,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];await page.goto(base+'/#/login/'+token);await page.reload();await page.getByRole('button',{name:'Continue'}).click();await page.waitForSelector('#project-search');
 const call=(action,data)=>page.evaluate(async({action,data})=>{const s=await(await fetch('/api.php?action=session')).json();const r=await fetch('/api.php?action='+action,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};},{action,data});
 const session=(await call('session')).data,made=(await call('create_project',{name:'Budget interactions'})).data,iid=made.iteration_id;
 const project=`${base}/${session.studio.id}/projects/${made.project_id}`;
 const setup=await page.evaluate(async({iid,pid})=>{
  const session=await(await fetch('/api.php?action=session')).json();
  const post=async body=>{const response=await fetch('/api.php?action=save_budget',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrf},body:JSON.stringify({iteration:iid,kind:'estimate',price_type:'fixed',amount:'100',...body})});if(!response.ok)throw Error(await response.text());};
  for(let n=0;n<24;n++)await post({label:`Cost ${String(n).padStart(2,'0')}`});
  const project=await(await fetch('/api.php?action=project&id='+pid)).json(),parent=project.budget[10];
  await post({label:'Nested quote',parent_id:parent.id});
  const updated=await(await fetch('/api.php?action=project&id='+pid)).json(),child=updated.budget.find(b=>b.label==='Nested quote');
  await post({label:'Optional detail',parent_id:child.id,is_optional:true});return {parent:parent.id,child:child.id};
 },{iid,pid:made.project_id});
 const slide=`${base}/${session.studio.id}/slide/budget?project=${made.project_id}&iteration=${iid}`;
 await page.goto(slide);await page.locator('.presentation-budget').waitFor();
 const hint=page.locator('.budget-interactive-notice');await hint.waitFor();assert.equal(await hint.innerText(),'This slide is interactive');assert.equal(await hint.getAttribute('role'),'status');
 await page.waitForTimeout(2200);assert.equal(await hint.count(),1);await hint.waitFor({state:'detached',timeout:1500});

 for(const width of [1440,390])for(const full of [false,true]){
  await page.setViewportSize({width,height:900});if(full){await page.locator('[data-action=toggle-fullscreen]').click();await page.waitForFunction(()=>document.body.classList.contains('presentation-fullscreen'));}
  const area=page.locator('.slide-area:not(.slide-outgoing)'),parent=page.locator(`[data-action="toggle-cost"][data-id="${setup.parent}"]`);
  await page.locator('[name=question]').fill('Keep this unfinished question');
  await area.evaluate((el,id)=>{const row=el.querySelector(`[data-budget-row="${id}"]`);el.scrollTop=row.offsetTop-el.offsetTop-260;},setup.parent);
  await parent.focus();await page.waitForTimeout(100);const before=await area.evaluate(el=>el.scrollTop);assert.ok(before>200);
  await page.keyboard.press('Enter');await page.waitForTimeout(100);
  assert.equal(await area.evaluate(el=>el.scrollTop),before,`${width}/${full}: expanding retains scroll`);assert.equal(await parent.getAttribute('aria-expanded'),'true');assert.ok(await parent.evaluate(el=>el===document.activeElement));assert.equal(await page.locator('[name=question]').inputValue(),'Keep this unfinished question');
  const child=page.locator(`[data-action="toggle-cost"][data-id="${setup.child}"]`);await child.focus();const nestedScroll=await area.evaluate(el=>el.scrollTop);await page.keyboard.press('Space');await page.waitForTimeout(100);assert.equal(await area.evaluate(el=>el.scrollTop),nestedScroll);assert.equal(await child.getAttribute('aria-expanded'),'true');assert.ok(await page.locator('.budget-row h3').filter({hasText:'Optional detail'}).isVisible());
  await child.press('Enter');await parent.focus();const collapse=await area.evaluate(el=>el.scrollTop);await parent.press('Enter');await page.waitForTimeout(100);assert.equal(await area.evaluate(el=>el.scrollTop),collapse);assert.equal(await parent.getAttribute('aria-expanded'),'false');
  if(full){await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('presentation-fullscreen'));}
 }
 // Navigating away and back does not repeat the hint during the same presentation.
 await page.locator('[data-action=jump-section][data-section=story]').click();await page.locator('[data-action=jump-section][data-section=budget]').click();await page.locator('.slide-outgoing').waitFor({state:'detached'});assert.equal(await hint.count(),0);
 // Leaving preview starts a fresh presentation session next time.
 await page.getByRole('button',{name:'Back to studio',exact:true}).click();assert.equal(await hint.count(),0);await page.getByRole('button',{name:'Preview',exact:true}).click();await page.locator('[data-action=jump-section][data-section=budget]').click();await hint.waitFor();
 await page.locator('[data-action=jump-section][data-section=story]').click();assert.equal(await hint.count(),0);await page.locator('[data-action=jump-section][data-section=budget]').click();assert.equal(await hint.count(),0);
 // Shared clients receive the same notice; fullscreen does not replay it.
 const shared=(await call('share',{iteration:iid,emails:['budget-client@example.test']})).data.links[0];await page.goto(`${base}/?slide=budget#/view/${shared.url.split('/#/view/')[1]}`);await hint.waitFor();await page.locator('[data-action=toggle-fullscreen]').click();await page.waitForFunction(()=>document.body.classList.contains('presentation-fullscreen'));assert.equal(await hint.count(),1);await hint.waitFor({state:'detached',timeout:3500});
 assert.deepEqual(errors,[]);console.log('PASS Budget expansion/collapse retains scroll, focus and question drafts, including nested rows, desktop/mobile and fullscreen; 3-second hint once per presentation for editors and clients.');
}catch(e){if(page)await page.screenshot({path:'/tmp/studiodeck-budget-interaction-failure.png'});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
