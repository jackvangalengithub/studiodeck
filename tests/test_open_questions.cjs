// Uses an exported isolated fixture; all network requests are served from local
// files or mocked data. Run with OPEN_QUESTIONS_BROWSER_EXPORT and PLAYWRIGHT_MODULE.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(process.env.OPEN_QUESTIONS_BROWSER_EXPORT,'utf8'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
  fixture.session.studio.setup_completed_at=new Date().toISOString();
  const deck=fixture.deck;deck.jobs=[];let approvalRequest;
  // Exercise the retained historical-item interface; new threads use the real API browser suite.
  delete deck.communication.items;delete deck.communication.comments;
  for(const q of deck.open_questions)delete q.thread_id;
  deck.comments.push({id:'source-comment',iteration_id:deck.iteration.id,parent_id:null,slide:'general',author:'client@example.test',body:'Please get a lighter flooring sample.',created_at:new Date().toISOString()});
  const question=deck.open_questions[0];question.reason='The kitchen quote needs a clear scope before the next decision.';
  deck.open_questions.push({...question,id:'suggestion',question:'Order material samples',item_type:'action',accepted:0,published:0,replies:[]});
  deck.open_questions.push({...question,id:'preference',question:'Which kitchen finish would you prefer?',kind:'preference',published:1,replies:[]});
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api.php'){
    const action=url.searchParams.get('action'),body=route.request().postDataJSON()||{};let value={ok:true};
    if(action==='session')value=fixture.session;
    if(action==='project'||action==='deck')value=deck;
    if(action==='projects')value={projects:[]};
    if(action==='project_access')value={reason:'ready'};
    if(action==='save_open_question'){
     let q=deck.open_questions.find(q=>q.id===body.id);
     if(!q){q={id:'promoted-comment',replies:[],accepted:1,resolved:0,dismissed:0,citations:[],...body};q.id='promoted-comment';deck.open_questions.push(q);}
     if(body.operation==='dismiss')q.dismissed=1;else if(body.operation==='accept')q.accepted=1;else if(body.operation==='resolve')q.resolved=1;else if(body.operation==='reopen')q.resolved=0;else Object.assign(q,body,{id:q.id,accepted:1});
     value={id:q.id};
    }
    if(action==='communication_post'){
     approvalRequest=body;const q=deck.open_questions.find(q=>q.id===body.checklist_id);
     const c={id:'linked-request',iteration_id:deck.iteration.id,parent_id:null,slide:'general',author:'editor@example.test',body:body.body,created_at:new Date().toISOString()};
     const r={...c,comment_id:c.id,status:'pending',recipient:body.recipient,recipient_name:'Client',amount_cents:80000};
     deck.comments.push(c);deck.communication.confirmations.push(r);q.confirmation_id=c.id;q.confirmation=r;value={id:c.id};
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
  await page.waitForLoadState('networkidle');
  if(!await page.locator('[data-action=editor-section][data-section=questions]').count())throw Error(await page.locator('body').innerText());
  await page.locator('[data-action=editor-section][data-section=questions]').click();
  assert.equal(await page.locator('.slide-editor-row').count(),1);
  await page.locator('[data-action=open-editor-slide][data-id=open-questions]').click();
  await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-action=jump-section][data-section=budget]').click();
  await page.locator('.presentation-budget').waitFor();
  await page.locator('.presentation-sidebar-handle').hover();await page.locator('[data-action=jump-section][data-section=questions]').click();
  await page.getByRole('button',{name:'Suggest items',exact:true}).waitFor();
  await page.locator('.open-question-card').first().waitFor();
  assert.equal(await page.locator('.open-question-card').count(),3);
  assert.equal(await page.locator('.checklist-suggestions .open-question-card').count(),1);
  await page.getByRole('button',{name:'Accept',exact:true}).click();
  await page.locator('.checklist-suggestions').waitFor({state:'hidden'});
  assert.equal(deck.open_questions.find(q=>q.id==='suggestion').published,0);
  await page.getByRole('checkbox',{name:'Mark done: Order material samples',exact:true}).click();
  await page.locator('.checklist-completed summary').click();
  await page.getByRole('checkbox',{name:'Reopen item: Order material samples',exact:true}).click();
  await page.locator(`[data-checklist-id="${question.id}"] [data-action=edit-open-question]`).click();
  await page.locator('[name=item_type]').selectOption('action');
  await page.locator('[name=responsible]').fill('Jules');
  await page.locator('[name=kind]').selectOption('answered');
  await page.locator('[name=answer]').fill('Installation is included in the reviewed quote.');
  await page.locator('[name=published]').check();
  await page.getByRole('button',{name:'Save item',exact:true}).click();
  await page.locator('.modal').waitFor({state:'hidden'});
  await page.locator(`[data-checklist-id="${question.id}"] [data-action=discuss-open-question]`).click();
  await page.getByText('Installation is included in the reviewed quote.',{exact:true}).waitFor();
  await page.getByText('Responsible person (optional): Jules',{exact:true}).waitFor();
  await page.locator('[name=body]').fill('Could you confirm removal too? <script>alert(1)</script>');
  await page.getByRole('button',{name:'Post reply',exact:true}).click();
  await page.locator('.question-conversation article').waitFor();
  assert.match(await page.locator('.question-conversation').innerText(),/<script>alert/);
  assert.equal(await page.locator('.question-conversation script').count(),0);
  await page.getByRole('button',{name:'Request approval',exact:true}).click();
  assert.equal(await page.locator('[name=checklist_id]').inputValue(),question.id);
  await page.locator('#comm-confirmation-form [name=body]').fill('Confirm installation for an additional €800.');
  await page.locator('#comm-confirmation-form [name=recipient]').selectOption('client@example.test');
  await page.locator('#comm-has-cost').check();
  await page.locator('#comm-cost').fill('800');
  await page.getByRole('button',{name:'Send confirmation request',exact:true}).click();
  await page.locator('.modal').waitFor({state:'hidden'});
  assert.equal(approvalRequest.checklist_id,question.id);assert.equal(approvalRequest.parent_id,'');
  assert.equal(approvalRequest.amount,'800');
  await page.locator(`[data-checklist-id="${question.id}"]`).getByText('Awaiting approval',{exact:true}).waitFor();
  await page.locator(`[data-checklist-id="${question.id}"] [data-action=discuss-open-question]`).click();
  await page.getByRole('button',{name:'View approval',exact:true}).click();
  await page.getByRole('button',{name:'View checklist item',exact:true}).click();
  await page.locator('.modal h3').filter({hasText:question.question}).waitFor();
  await page.locator('.modal [data-action=close-modal]').first().click();
  await page.locator('[data-action=checklist-from-comment][data-id=source-comment]').click();
  assert.equal(await page.locator('[name=source_comment_id]').inputValue(),'source-comment');
  await page.locator('[name=question]').fill('Get a lighter flooring sample');
  await page.getByRole('button',{name:'Save item',exact:true}).click();
  await page.locator('.modal').waitFor({state:'hidden'});
  assert.equal(deck.open_questions.find(q=>q.id==='promoted-comment').published,false);
  await page.goto('http://questions.test/studio-a/projects/shared?tab=slides&iteration=iteration-shared');
  await page.locator('[data-action=editor-section][data-section=questions]').click();
  await page.locator('[data-action=open-editor-slide][data-id=open-questions]').click();
  await page.screenshot({path:'/tmp/studiodeck-open-questions-desktop.png',fullPage:true});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:900});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow at ${width}px`);
  }
  await page.screenshot({path:'/tmp/studiodeck-open-questions-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Dismiss',exact:true}).first().click();
  await page.waitForFunction(()=>document.querySelectorAll('.open-question-card').length===3);
  assert.deepEqual(errors,[]);
  console.log('PASS checklist acceptance, private defaults, completion, reopening, editing, publication, linked approval requests, comment promotion, answers, replies, escaping and mobile layouts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
