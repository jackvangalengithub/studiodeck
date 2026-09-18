// Run against an isolated PHP server. No external playback or AI requests.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
const base=process.env.STUDIODECK_TEST_URL,mailLog=process.env.STUDIODECK_TEST_MAIL_LOG;
if(!base||!mailLog)throw Error('Set isolated STUDIODECK_TEST_URL and STUDIODECK_TEST_MAIL_LOG.');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});let page;try{
 page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('input[name=email]').fill(`filter-${Date.now()}@example.test`);await page.getByRole('button',{name:'Email me a sign-in link'}).click();await page.waitForSelector('.login .notice');
 const token=fs.readFileSync(mailLog,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];await page.goto(base+'/#/login/'+token);await page.reload();await page.getByRole('button',{name:'Continue'}).click();await page.waitForSelector('#project-search');
 const call=(action,data)=>page.evaluate(async({action,data})=>{const s=await(await fetch('/api.php?action=session')).json();const r=await fetch('/api.php?action='+action,{method:data?'POST':'GET',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};},{action,data});
 const session=(await call('session')).data,made=(await call('create_project',{name:'Filtered presentation'})).data,iid=made.iteration_id;
 const project=`${base}/${session.studio.id}/projects/${made.project_id}`;
 await call('save_slide',{iteration:iid,type:'text',title:'Design notes',description:'Some details',section:'designs'});
 await call('save_slide',{iteration:iid,type:'video',title:'Design film',video_url:'https://youtu.be/M7lc1UVf-VE',section:'story'});
 await page.goto(project+'?tab=slides');await page.locator('.slide-editor-row').first().waitFor();const total=await page.locator('.slide-editor-row').count();assert.equal(total,7);
 await page.locator('[data-slide-filter-open]').click();assert.equal(await page.locator('[data-slide-type]').count(),16);
 await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.equal(await page.locator('.slide-editor-row').count(),0);assert.ok(await page.locator('.slide-type-filter.is-active').count());
 for(const type of ['text','video','budget'])await page.locator(`[data-slide-type="${type}"]`).check();
 assert.equal(await page.locator('.slide-editor-row').count(),3);assert.equal(await page.locator('[data-slide-filter-status]').innerText(),'3 of 16 types selected');
 assert.equal(await page.locator('.slide-type-filter').evaluate(el=>getComputedStyle(el).animationName),'slide-filter-pulse');
 await page.getByRole('button',{name:'Done',exact:true}).click();
 await page.locator('[data-action=editor-section][data-section=designs]').click();assert.equal(await page.locator('.slide-editor-row').count(),1);assert.match(await page.locator('.slide-editor-row').innerText(),/Design notes/);
 await page.locator('[data-action=slide-view][data-view=grid]').click();assert.equal(await page.locator('.all-slides .slide-editor-row').count(),1);
 // Opening a filtered card still uses the complete deck.
 await page.locator('[data-action=open-editor-slide]').click();await page.locator('.presentation').waitFor();assert.match(await page.locator('.slide-counter').innerText(),/07$/);
 await page.getByRole('button',{name:'Back to studio',exact:true}).click();assert.equal(await page.locator('.slide-editor-row').count(),1);
 await page.locator('[data-slide-filter-open]').click();assert.equal(await page.locator('[data-slide-type]:checked').count(),3);await page.getByRole('button',{name:'Select all',exact:true}).click();assert.equal(await page.locator('.slide-type-filter.is-active').count(),0);await page.getByRole('button',{name:'Done',exact:true}).click();await page.locator('[data-action=editor-section][data-section=""]').click();assert.equal(await page.locator('.slide-editor-row').count(),7);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-slide-filter-open]').click();await page.locator('[data-slide-type=photo]').uncheck();await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.slide-type-filter').evaluate(el=>getComputedStyle(el).animationName),'none');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.getByRole('button',{name:'Done',exact:true}).click();
 const another=(await call('create_project',{name:'Another project'})).data;await page.goto(`${base}/${session.studio.id}/projects/${another.project_id}?tab=slides`);await page.locator('.slide-editor-row').first().waitFor();assert.equal(await page.locator('.slide-type-filter.is-active').count(),0);assert.equal(await page.locator('.slide-editor-row').count(),6);
 assert.deepEqual(errors,[]);console.log('PASS Multiple type selection, empty/reset, group intersection, list/grid, unfiltered presentation, retained selection, mobile and reduced motion.');
}catch(e){if(page)await page.screenshot({path:'/tmp/studiodeck-filter-failure.png'});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
