// Uses an exported isolated fixture; all network requests are served from local
// files or mocked data. Run with OPEN_QUESTIONS_BROWSER_EXPORT and PLAYWRIGHT_MODULE.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(process.env.OPEN_QUESTIONS_BROWSER_EXPORT,'utf8'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const deck=fixture.deck;deck.jobs=[];
  const question=deck.open_questions[0];question.reason='The kitchen quote needs a clear scope before the next decision.';
  deck.open_questions.push({...question,id:'preference',question:'Which kitchen finish would you prefer?',kind:'preference',published:1,replies:[]});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api.php'){
    const action=url.searchParams.get('action'),body=route.request().postDataJSON()||{};let value={ok:true};
    if(action==='session')value=fixture.session;
    if(action==='project'||action==='deck')value=deck;
    if(action==='projects')value={projects:[]};
    if(action==='save_open_question'){
     const q=deck.open_questions.find(q=>q.id===body.id);
     if(body.operation==='dismiss')q.dismissed=1;else Object.assign(q,body);
     value={id:q.id};
    }
    if(action==='reply_open_question')deck.open_questions.find(q=>q.id===body.id).replies.push({id:'reply',author:'client@example.test',body:body.body,created_at:new Date().toISOString()});
    if(['file','slide_image','studio_logo','project_cover'].includes(action))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   }
   if(url.pathname.startsWith('/assets/')){
    const file=path.join(root,'public',url.pathname);
    return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/svg+xml',body:fs.readFileSync(file)});
   }
   return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'public/index.html'))});
  });
  await page.goto('http://questions.test/studio-a/projects/shared?tab=slides&iteration=iteration-shared');
  await page.locator('[data-action=editor-section][data-section=questions]').click();
  assert.equal(await page.locator('.slide-editor-row').count(),1);
  await page.locator('[data-action=open-editor-slide][data-id=open-questions]').click();
  await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-action=jump-section][data-section=budget]').click();
  await page.locator('.presentation-budget').waitFor();
  await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-action=jump-section][data-section=questions]').click();
  await page.getByRole('button',{name:'Suggest questions',exact:true}).waitFor();
  await page.locator('.open-question-card').first().waitFor();
  assert.equal(await page.locator('.open-question-card').count(),2);
  await page.getByRole('button',{name:'Review & include',exact:true}).click();
  await page.locator('[name=kind]').selectOption('answered');
  await page.locator('[name=answer]').fill('Installation is included in the reviewed quote.');
  await page.locator('[name=published]').check();
  await page.getByRole('button',{name:'Save question',exact:true}).click();
  await page.locator('.modal').waitFor({state:'hidden'});
  await page.getByText('Read answer',{exact:true}).click();
  await page.getByText('Installation is included in the reviewed quote.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Discuss',exact:true}).first().click();
  await page.locator('[name=body]').fill('Could you confirm removal too? <script>alert(1)</script>');
  await page.getByRole('button',{name:'Post reply',exact:true}).click();
  await page.locator('.question-conversation article').waitFor();
  assert.match(await page.locator('.question-conversation').innerText(),/<script>alert/);
  assert.equal(await page.locator('.question-conversation script').count(),0);
  await page.locator('.modal [data-action=close-modal]').first().click();
  await page.screenshot({path:'/tmp/studiodeck-open-questions-desktop.png',fullPage:true});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow at ${width}px`);
  }
  await page.screenshot({path:'/tmp/studiodeck-open-questions-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Dismiss',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.open-question-card').length===1);
  assert.deepEqual(errors,[]);
  console.log('PASS question review, publication, answer expansion, replies, HTML escaping, dismissal and 320/390px layouts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
