// Actual workspace UI with an isolated fixture and mocked API responses.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const fixture=JSON.parse(fs.readFileSync(process.env.PRODUCT_FEEDBACK_EXPORT,'utf8'));
const output=process.env.PRODUCT_FEEDBACK_SCREENSHOTS||'/tmp';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5AAAAABJRU5ErkJggg==','base64');

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1080}}),errors=[],submissions=[],reviews=[];
  let failSubmission=true,inboxFailure=false,holdSubmission=null;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api.php'){
    const action=url.searchParams.get('action');let value={ok:true};
    if(action==='session')value=fixture.session;
    if(action==='projects')value={projects:[]};
    if(action==='comments_feed')value={items:[],has_more:false,unread_count:0};
    if(action==='product_feedback_submit'){
     const raw=route.request().postData();
     const payload=JSON.parse(raw.match(/name="feedback"\r\n\r\n([^\r]+)/)[1]);
     submissions.push({payload,raw});
     if(holdSubmission)await holdSubmission;
     if(failSubmission){failSubmission=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Temporary failure'})});}
     value={id:'saved-feedback'};
    }
    if(action==='product_feedback_inbox'){
     if(inboxFailure){inboxFailure=false;return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Temporary failure"}'});}
     value=fixture.inbox;
    }
    if(action==='product_feedback_review'){reviews.push(route.request().postDataJSON());value={ok:true,updated_at:'next-version'};}
    if(['studio_logo','project_cover'].includes(action))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   }
   if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/auth/')){
    const file=path.join(root,'public',url.pathname);
    const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.ttf')?'font/ttf':'image/svg+xml';
    return route.fulfill({contentType:mime,body:fs.readFileSync(file)});
   }
   return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'public/index.html'))});
  });
  const open=async()=>page.locator('[data-action="product-feedback"]').click();
  const next=async()=>page.locator('[data-pf-form] [type=submit]').click();
  const shot=async name=>page.screenshot({path:path.join(output,'product-feedback-'+name+'.png'),fullPage:true});
  await page.goto('http://localhost/studio-a/projects');
  await open();
  assert.equal(await page.locator('.pf-progress').innerText(),'Step 1 of 3');
  await next();assert.equal(await page.locator('[name=goal]').count(),0);
  await page.locator('[name=category][value=friction]').check();
  await shot('step-1');await next();
  await page.locator('[name=area]').selectOption('budget');
  await page.locator('[name=goal]').fill('Prepare <client> budget');
  await page.locator('[name=detail]').fill('I have to retype every line.');
  await page.locator('[data-pf-file]').setInputFiles({name:'screen.png',mimeType:'image/png',buffer:png});
  await page.locator('.pf-attachment img').waitFor();
  await page.locator('[data-pf=back]').click();await next();
  assert.equal(await page.locator('[name=goal]').inputValue(),'Prepare <client> budget');
  assert.equal(await page.locator('.pf-attachment img').count(),1);
  await page.keyboard.press('Escape');await open();
  assert.equal(await page.locator('[name=detail]').inputValue(),'I have to retype every line.');
  await shot('step-2');await next();
  await page.locator('[name=impact][value=slows]').check();
  await page.locator('[name=frequency][value=often]').check();
  assert.equal(await page.locator('[name=contact_allowed]').isChecked(),false);
  await page.locator('.pf-context summary').click();
  assert.match(await page.locator('.pf-context').innerText(),/feedback-test/);
  await shot('step-3');
  await next();await page.locator('.pf-error:not([hidden])').waitFor();
  assert.equal(await page.locator('[name=impact][value=slows]').isChecked(),true);
  await next();await page.getByText('Thank you for taking a moment.',{exact:true}).waitFor();
  assert.equal(submissions.length,2);assert.equal(submissions[0].payload.request_key,submissions[1].payload.request_key);
  assert.equal(submissions[1].payload.area,'budget');assert.equal(submissions[1].payload.screen,'projects');
  assert.equal(submissions[1].payload.contact_allowed,false);assert.match(submissions[1].raw,/filename="screen.png"/);
  await shot('thanks');await page.locator('[data-pf=done]').click();
  // Every branch gets the correct prompts; positive reports have no negative impact question.
  const categories={broken:'What happened instead?',missing:'How do you handle this today?',positive:'What did it help you achieve?',other:'How does this affect your experience?'};
  for(const [category,prompt] of Object.entries(categories)){
   await open();await page.locator(`[name=category][value=${category}]`).check();await next();
   await page.getByText(prompt,{exact:true}).waitFor();
   await page.locator('[name=goal]').fill('A useful experience');await page.locator('[name=detail]').fill('Here is what happened.');await next();
   if(category==='positive'){assert.equal(await page.locator('[name=impact]').count(),0);await page.locator('[name=contact_allowed]').check();}
   else await page.locator('[name=impact][value=minor]').check();
   await page.locator('[name=frequency][value=first]').check();await next();
   await page.locator('.pf-thanks').waitFor();await page.locator('[data-pf=done]').click();
  }
  assert.equal(submissions.find(s=>s.payload.category==='positive').payload.impact,'');
  assert.equal(submissions.find(s=>s.payload.category==='positive').payload.contact_allowed,true);
  // Inbox failures are recoverable; report content remains text, and triage is editable.
  inboxFailure=true;fixture.inbox.items[0].goal='<img src=x onerror=alert(1)> Budget handoff';
  await page.locator('[data-action=product-feedback-inbox]').click();await page.locator('[data-pf=retry]').click();
  await page.locator('.pf-report').first().waitFor();assert.equal(await page.locator('.pf-report img').count(),0);
  await shot('inbox');await page.locator('.pf-report').first().click();
  await page.locator('[name=status]').selectOption('planned');await page.locator('[name=theme]').fill('Budget handoff');
  await page.locator('[name=notes]').fill('Explore editable export.');await page.locator('[data-pf-review] [type=submit]').click();
  await page.getByText('Review saved.',{exact:true}).waitFor();assert.equal(reviews[0].theme,'Budget handoff');
  await page.keyboard.press('Escape');
  // Mobile: sidebar entry, screenshot preview, all steps and footer stay inside the viewport.
  await page.setViewportSize({width:390,height:844});await page.locator('[data-action=menu]').click();await open();
  await page.locator('[name=category][value=missing]').check();await shot('mobile-1');await next();
  await page.locator('[name=goal]').fill('Export an editable budget');await page.locator('[name=detail]').fill('I copy the numbers manually.');
  await shot('mobile-2');await next();await page.locator('[name=impact][value=blocked]').check();await page.locator('[name=frequency][value=often]').check();
  assert(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert(await page.locator('.modal').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await shot('mobile-3');
  // A pending submission cannot be closed or sent twice.
  let release;holdSubmission=new Promise(resolve=>release=resolve);await next();
  await page.waitForFunction(()=>document.querySelector('[data-pf-form] [type=submit]').disabled);
  await page.keyboard.press('Escape');assert.equal(await page.locator('[data-pf-form]').count(),1);
  release();holdSubmission=null;await page.locator('.pf-thanks').waitFor();await page.locator('[data-pf=done]').click();
  // Dutch copy follows the existing account language preference.
  fixture.session.user.profile.language='nl';fixture.session.studio.language='nl';
  await page.reload();await page.locator('[data-action=menu]').click();await open();
  await page.getByText('Een beetje beter, met jouw hulp.',{exact:true}).waitFor();await shot('mobile-nl');
  assert.deepEqual(errors,[]);
  console.log('PASS: all branches, validation, draft preservation, attachments, retry deduplication, triage, access entry points, mobile, pending submission and Dutch copy.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
