// Isolated browser review using the fixture exported by test_consistency.py.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(process.env.CONSISTENCY_BROWSER_EXPORT,'utf8'));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  fixture.session.studio.setup_completed_at=new Date().toISOString();
  const deck=fixture.deck;deck.jobs=[];deck.checks.available=true;
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/api.php'){
    const action=url.searchParams.get('action'),body=route.request().postDataJSON()||{};requests.push({action,body});let value={ok:true};
    if(action==='session')value=fixture.session;
    if(action==='project'||action==='deck')value=deck;
    if(action==='projects')value={projects:[]};
    if(action==='comments_feed')value={items:[],has_more:false,unread_count:0};
    if(action==='project_access')value={reason:'ready'};
    if(action==='review_consistency_finding')deck.checks.findings.find(f=>f.id===body.id).status=body.operation;
    if(action==='check_source_role'){deck.checks.roles[body.source_key]=body.role;deck.checks.run.stale=true;}
    if(action==='check_image')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5AAAAABJRU5ErkJggg==','base64')});
    if(['file','slide_image','studio_logo','project_cover'].includes(action))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
   }
   if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/auth/')){const file=path.join(root,'public',url.pathname);return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/svg+xml',body:fs.readFileSync(file)});}
   return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'public/index.html'))});
  });
  await page.goto('http://checks.test/studio-a/projects/shared?tab=checks&iteration=iteration-shared');
  await page.locator('.consistency-panel').waitFor();
  await page.locator('.check-finding').waitFor();
  assert.equal(await page.locator('.check-finding').count(),1);
  assert.match(await page.locator('.check-finding').innerText(),/Written requirement/);
  await page.locator('[data-action=check-evidence][data-evidence="1"]').click();
  await page.locator('.check-region').waitFor();
  assert.equal(await page.locator('.check-image img').count(),1);
  await page.keyboard.press('Escape');
  await page.locator('[data-action=check-review][data-operation=resolved]').click();
  await page.getByText('Reviewed findings (1)',{exact:true}).click();
  await page.locator('[data-action=check-review][data-operation=open]').click();
  await page.locator('[data-action=tab][data-tab=files]').click();
  await page.locator('.check-sources>summary').click();
  await page.locator('[data-action=check-role][data-key="file-shared:p:0"]').click();
  await page.locator('[name=role]').selectOption('inspiration');
  await page.locator('[data-form=check-role] [type=submit]').click();
  await page.locator('[data-action=tab][data-tab=comments]').click();
  if(!await page.locator('.comm-suggestions').evaluate(el=>el.open))await page.locator('.comm-suggestions>summary').click();
  await page.getByText('Sources or their roles changed. Run checks again to review the current design.',{exact:true}).waitFor();
  assert(requests.some(r=>r.action==='check_source_role'&&r.body.role==='inspiration'));
  await page.locator('[data-action=check-run]').first().click();
  assert.equal(requests.filter(r=>r.action==='run_consistency_checks').length,0);
  assert.match(await page.locator('.modal').textContent(),/There may be no inconsistencies/);
  await page.locator('[data-action=check-start]').click();
  await page.waitForFunction(()=>!document.querySelector('.modal'));
  assert(requests.some(r=>r.action==='run_consistency_checks'));
  await page.screenshot({path:'/tmp/studiodeck-consistency-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=1);
  assert(await page.locator('.consistency-panel').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:process.env.CONSISTENCY_SCREENSHOT||'/tmp/studiodeck-consistency-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS Communication suggestions, explanatory splash, evidence region, review actions, source-role correction, rerun and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
