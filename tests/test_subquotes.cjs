// Uses an isolated fixture exported by test_subquotes_api.py; API responses are mocked.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
const fixture=JSON.parse(fs.readFileSync(process.env.STUDIODECK_TEST_EXPORT,'utf8'));
const base=process.env.STUDIODECK_TEST_URL||'http://127.0.0.1:8198';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],actions=[];let deck=fixture.deck;
 deck.subquote_check={result:'{"status":"checked"}',warning:'',checked_at:new Date().toISOString()};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api.php?**',async route=>{
  const a=new URL(route.request().url()).searchParams.get('action');actions.push(a);let value={ok:true};
  if(a==='session')value=fixture.session;
  if(a==='project'||a==='deck')value=deck;
  if(a==='projects')value={projects:[]};
  if(a==='review_subquote'){const b=route.request().postDataJSON(),s=deck.subquote_suggestions.find(x=>x.id===b.id),r=deck.budget.find(x=>x.id===s.child_id);r.parent_id=s.parent_id;r.included=b.decision==='included'?1:0;r.relationship_origin='manual';r.relationship_locked=1;deck.subquote_suggestions=[];deck.total_cents=5000000;}
  if(a==='unlink_subquote'){const b=route.request().postDataJSON(),r=deck.budget.find(x=>x.id===b.id);r.parent_id=null;r.included=0;r.relationship_origin='manual';r.relationship_locked=1;r.relationship_evidence='';deck.total_cents=5800000;}
  if(a==='match_subquotes')value={id:'mock-job'};
  return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
 });
 await page.goto(base+'/#/preview/'+deck.iteration.id);await page.waitForSelector('.presentation');
 for(let n=0;n<8&&!await page.locator('[data-action=match-subquotes]').count();n++)await page.locator('.presentation-footer [data-action=next-slide]').click();
 await page.waitForSelector('.subquote-review article');
 assert.match(await page.locator('.subquote-review article').innerText(),/Irrigation → Main contract/);
 await page.getByText('Why these may belong together',{exact:true}).click();
 assert.match(await page.locator('.subquote-evidence').innerText(),/main.csv/);
 await page.screenshot({path:'/tmp/studiodeck-subquotes-desktop.png',fullPage:true});
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No overflow at ${width}px`);}
 await page.screenshot({path:'/tmp/studiodeck-subquotes-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Included in parent total',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.subquote-review article'));
 assert.equal(deck.subquote_suggestions.length,0);assert.match(await page.locator('[data-budget-total]').innerText(),/50[.,]000/);
 await page.setViewportSize({width:1440,height:1100});
 const parent=deck.budget.find(x=>x.source_key==='main'),garden=deck.budget.find(x=>x.source_key==='garden');
 await page.locator(`[data-action=toggle-cost][data-id="${parent.id}"]`).click();
 await page.locator(`.budget-source[data-id="${garden.id}"]`).click();
 await page.locator('.modal .subquote-review summary').click();
 assert.match(await page.locator('.modal .subquote-evidence').innerText(),/GW-1234/);
 await page.getByRole('button',{name:'Undo automatic link',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('.modal'));
 assert.equal(garden.parent_id,null);assert.match(await page.locator('[data-budget-total]').innerText(),/58[.,]000/);
 await page.getByRole('button',{name:'Check subquotes',exact:true}).click();assert.ok(actions.includes('match_subquotes'));
 deck.can_edit=false;deck.iteration.status='shared';delete deck.subquote_suggestions;delete deck.subquote_check;
 await page.goto(base+'/?slide=budget#/view/test-share');await page.waitForSelector('[data-budget-total]');
 assert.equal(await page.locator('[data-action=match-subquotes],[data-action=review-subquote],[data-action=unlink-subquote]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS review evidence, accept, total updates, undo, recheck, client controls and 320/390px layouts');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
