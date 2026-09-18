// Run against the isolated security_browser_fixture.py server.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const fixture=JSON.parse(fs.readFileSync(process.env.STUDIODECK_SYSTEM_FIXTURE,'utf8'));
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:false,args:['--no-sandbox','--headless=new']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 assert.ok((await page.request.post(fixture.base+'/api.php?action=consume_login',{data:{token:fixture[process.env.STUDIODECK_TEST_TOKEN_KEY||'editorToken']}})).ok());
 await page.goto(fixture.base+'/studio-a/projects/own?tab=slides');
 await page.locator('[data-action=tab][data-tab=slides]').first().click();
 await page.locator('[data-action=add-slide]').click();
 assert.ok((await page.locator('.modal').boundingBox()).width>700);
 assert.equal(await page.getByRole('tab').count(),3);
 await page.locator('[data-form=slide-editor] [name=title]').fill('Keep my manual draft');
 await page.getByRole('tab',{name:'Add manually',exact:true}).press('End');
 assert.equal(await page.getByRole('tab',{name:'System slides',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('[data-action=add-system-slide]').count(),6);
 await page.screenshot({path:'/tmp/system-slides-desktop.png',fullPage:true});
 async function add(type){const response=page.waitForResponse(r=>r.url().includes('action=add_system_slide')&&r.request().method()==='POST');await page.locator(`[data-action=add-system-slide][data-type="${type}"]`).click();const r=await response;assert.equal(r.status(),201);const {id}=await r.json();await page.waitForFunction(type=>!document.querySelector(`[data-action=add-system-slide][data-type="${type}"]`).disabled,type);return id;}
 const first=await add('budget'),later=await add('budget');
 const others={};for(const type of ['intro','changes','open-questions','contacts','summary'])others[type]=await add(type);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.locator('.modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 await page.screenshot({path:'/tmp/system-slides-mobile.png',fullPage:true});
 await page.getByRole('tab',{name:'System slides',exact:true}).press('ArrowRight');
 assert.equal(await page.locator('[data-form=slide-editor] [name=title]').inputValue(),'Keep my manual draft');
 await page.locator('[data-action=close-modal]').first().click();
 await page.setViewportSize({width:1440,height:1000});
 await page.locator(`[data-action=edit-slide][data-id="${first}"]`).click();
 await page.locator('.modal [name=title]').fill('Shared live budget');
 await page.locator('.modal [name=description]').fill('Shared introduction');
 await page.locator('[data-form=slide-editor] button[type=submit]').click();
 await page.locator('.modal').waitFor({state:'hidden'});
 async function open(id){await page.locator(`[data-action=open-editor-slide][data-id="${id}"]`).click();await page.locator('.slide-heading').waitFor();}
 await open(first);assert.equal(await page.locator('.slide-heading').innerText(),'Shared live budget');
 const choice=page.locator('[data-budget-option="budget-own"]');
 const saved=page.waitForResponse(r=>r.url().includes('action=budget_choice'));await choice.check();assert.ok((await saved).ok());
 await page.locator('[data-action=exit-preview]').click();
 await open(later);assert.equal(await page.locator('.slide-heading').innerText(),'Shared live budget');assert.ok(await page.locator('[data-budget-option="budget-own"]').isChecked());assert.match(await page.locator('[data-budget-total]').innerText(),/100/);
 await page.reload();await page.locator('[data-budget-option="budget-own"]').waitFor();assert.ok(await page.locator('[data-budget-option="budget-own"]').isChecked());
 await page.locator('[data-action=exit-preview]').click();
 for(const [type,id] of Object.entries(others)){await open(id);assert.ok((await page.locator('.slide-heading').innerText()).trim());if(type==='intro')assert.equal(await page.locator('.cover-slide').count(),1);if(type==='open-questions')assert.equal(await page.locator('.open-questions-slide').count(),1);if(type==='summary')assert.match(await page.locator('.summary-stats').innerText(),/100/);await page.locator('[data-action=exit-preview]').click();}
 await page.locator(`[data-action=delete-slide][data-id="${first}"]`).click();await page.locator('[data-action=confirm-delete-slide]').click();await page.locator('.modal').waitFor({state:'hidden'});
 assert.equal(await page.locator(`[data-action=open-editor-slide][data-id="${first}"]`).count(),0);assert.equal(await page.locator(`[data-action=open-editor-slide][data-id="${later}"]`).count(),1);
 assert.deepEqual(errors,[]);
 console.log('PASS wider dialog, three keyboard-accessible tabs, all system types, repeated budget additions, shared title and budget choices across copies and reloads, independent deletion, mobile layout.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
