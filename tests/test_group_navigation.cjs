// Use an isolated test server with log-only email, as for test_question_activity.cjs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
const base=process.env.STUDIODECK_TEST_URL,mailLog=process.env.STUDIODECK_TEST_MAIL_LOG;
if(!base||!mailLog)throw Error('Set STUDIODECK_TEST_URL and STUDIODECK_TEST_MAIL_LOG for an isolated fixture.');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:false,args:['--no-sandbox','--headless=new']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('input[name=email]').fill(`ordering-${Date.now()}@example.test`);await page.getByRole('button',{name:'Email me a sign-in link'}).click();await page.waitForSelector('.login .notice');
 const token=fs.readFileSync(mailLog,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];await page.goto(base+'/#/login/'+token);await page.reload();await page.getByRole('button',{name:'Continue'}).click();await page.waitForSelector('#project-search');
 const made=await page.evaluate(async()=>{
  const s=await(await fetch('/api.php?action=session')).json();
  const post=async(action,body)=>{const r=await fetch('/api.php?action='+action,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':s.csrf},body:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json();};
  const p=await post('create_project',{name:'Grouped navigation test'}),iteration=p.iteration_id;
  await post('slide_layout',{iteration,operation:'section',slide_id:'contacts',section:'current'});
  await post('slide_layout',{iteration,operation:'section',slide_id:'summary',section:'designs'});
  await post('slide_layout',{iteration,operation:'reorder',order:['summary','intro','budget','contacts','changes']});
  await post('reorder_slide_groups',{iteration,order:['budget','story','current','designs','moodboards']});
  return {...p,studio:s.studio.id};
 });
 const slideUrl=id=>`${base}/${made.studio}/slide/${id}?project=${made.project_id}&iteration=${made.iteration_id}`;
 async function checkSlides(ids,sections,direction='ArrowRight'){
  for(let n=0;n<ids.length;n++){
   if(n)await page.keyboard.press(direction);
   await page.waitForURL(url=>url.pathname.endsWith('/slide/'+ids[n]));
   assert.equal(await page.locator('.presentation-section-index [aria-current=true]').getAttribute('data-section'),sections[n]);
   assert.deepEqual(await page.locator('.presentation-section-index [data-action=jump-section]').evaluateAll(els=>els.map(el=>el.dataset.section)),['budget','story','current','designs']);
  }
 }
 await page.goto(slideUrl('budget'));await page.locator('.presentation').waitFor();
 // A split group menu navigates directly, without arrow keys moving the deck behind it.
 const trigger=page.locator('[data-section-menu=story]');
 await trigger.click();assert.equal(await page.getByRole('menuitem').count(),2);
 assert.match(await page.getByRole('menuitem').first().innerText(),/^02/);
 await page.keyboard.press('ArrowDown');assert.ok(page.url().includes('/slide/budget'));
 await page.keyboard.press('Enter');await page.waitForURL(url=>url.pathname.endsWith('/slide/changes'));
 await trigger.click();await page.keyboard.press('Escape');assert.equal(await page.locator('#section-slide-menu').count(),0);
 await page.setViewportSize({width:390,height:844});await trigger.click();
 const menuBox=await page.locator('#section-slide-menu').boundingBox();assert.ok(menuBox.x>=0&&menuBox.x+menuBox.width<=390);
 await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:1000});
 await page.goto(slideUrl('budget'));await page.locator('.presentation').waitFor();
 const ids=['budget','intro','changes','contacts','summary'],groups=['budget','story','story','current','designs'];
 await checkSlides(ids,groups);await checkSlides([...ids].reverse(),[...groups].reverse(),'ArrowLeft');
 await page.getByRole('button',{name:'Back to studio',exact:true}).click();await page.locator('[data-action=tab][data-tab=slides]').click();
 assert.equal(await page.getByRole('button',{name:'Preview all',exact:true}).count(),0);
 assert.equal(await page.locator('[data-slide-section-select]').count(),0);
 assert.equal(await page.locator('[data-action=zoom-editor-slide]').count(),0);
 assert.equal(await page.locator('.iteration-controls [data-action=iteration]').count(),1);
 assert.equal((await page.locator('.editor-slide-actions').first().innerText()).trim(),'');
 assert.deepEqual(await page.locator('.slide-editor-row').evaluateAll(els=>els.map(el=>el.dataset.slideId)),ids);
 await page.locator('[data-drag-slide=changes]').focus();await page.keyboard.press('Space');await page.keyboard.press('ArrowUp');
 const saved=page.waitForResponse(r=>r.url().includes('action=slide_layout'));await page.keyboard.press('Enter');assert.equal((await saved).status(),200);
 await page.waitForFunction(()=>document.querySelectorAll('.slide-editor-row')[1]?.dataset.slideId==='changes');
 await page.goto(slideUrl('budget'));await page.reload();await page.locator('.presentation').waitFor();
 await checkSlides(['budget','changes','intro','contacts','summary'],groups);
 assert.deepEqual(errors,[]);console.log('PASS Arrow navigation follows persisted groups and within-group order; selector stays stable, editor reorder and reload agree.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
