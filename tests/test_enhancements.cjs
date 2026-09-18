// Browser checks use an exported test_enhancements.py fixture and mocked API responses.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
const fixture=JSON.parse(fs.readFileSync(process.env.STUDIODECK_TEST_EXPORT,'utf8'));
const base=process.env.STUDIODECK_TEST_URL||'http://127.0.0.1:8198';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];
  let deck=fixture.deck;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api.php?**',async route=>{
   const url=new URL(route.request().url()),action=url.searchParams.get('action');requests.push({action,url:url.toString()});
   let value={ok:true};
   if(action==='session')value=fixture.session;
   if(action==='project'||action==='deck')value=deck;
   if(action==='projects')value={projects:[]};
   if(action==='select_slide_image'){const b=route.request().postDataJSON();deck.slides.find(s=>s.id===b.slide_id).image_version_id=b.image_version_id;}
   if(['slide_image','file','document_page'].includes(action))return route.fulfill({contentType:'image/png',body:Buffer.from(fixture.png,'base64')});
   return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  });
  async function open(){await page.goto(base+'/#/preview/'+deck.iteration.id);await page.waitForSelector('.presentation');for(let n=0;n<8&&!await page.locator('[data-image-variant]').count();n++)await page.locator('.presentation-footer [data-action=next-slide]').click();await page.waitForSelector('[data-image-variant]');}
  await open();
  const picker=page.locator('#app [data-image-variant]');
  assert.equal(await picker.locator('option').count(),5);
  assert.match(await page.locator('[data-enhancement-allowance]').first().innerText(),/0 AI enhancements left/);
  assert.equal(await page.locator('[data-action=enhance-slide]').isDisabled(),true);
  const original=deck.slides[0].image_version_id,older=deck.slides[0].image_variants.at(-1).id;
  await picker.selectOption(older);
  await page.waitForSelector('.comparison-generated img');
  assert.ok(requests.some(r=>r.action==='slide_image'&&r.url.includes('image_version_id='+older)));
  assert.equal(await page.locator('.comparison-original img').count(),1);
  await page.getByRole('button',{name:'Use this version',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-action=use-image-version]'));
  assert.equal(deck.slides[0].image_version_id,older);
  assert.equal(deck.enhancements.remaining,0);
  await page.locator('[data-action=toggle-slide-original]').click();
  assert.equal(await page.locator('.image-comparison').count(),0);
  await page.locator('[data-action=toggle-slide-comparison]').click();
  await page.locator('[data-action=magnify-photo]').click();
  await page.locator('#photo-lightbox [data-image-variant]').selectOption(original);
  assert.equal(await page.locator('#photo-lightbox [data-image-variant]').inputValue(),original);
  await page.locator('[data-action=close-photo]').click();
  await page.screenshot({path:'/tmp/studiodeck-enhancements-desktop.png'});
  for(const width of [390,320]){
   await page.setViewportSize({width,height:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`No horizontal overflow at ${width}px`);
   const bounds=await picker.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width+1,`Picker fits at ${width}px`);
  }
  await page.screenshot({path:'/tmp/studiodeck-enhancements-mobile.png'});
  deck.enhancements={plan_type:'monthly',limit:10,used:5,remaining:5,reserved:0,resets_at:'2030-03-01T00:00:00Z'};
  await page.setViewportSize({width:1440,height:1100});await open();
  await page.locator('[data-action=enhance-slide]').click();
  assert.match(await page.locator('.modal [data-enhancement-allowance]').innerText(),/5 AI enhancements left/);
  assert.equal(await page.locator('[data-enhancement-submit]').isEnabled(),true);
  await page.locator('[data-action=close-modal]').first().click();
  deck.slides[0].type='fullphoto';await open();
  assert.equal(await page.locator('.full-photo-versions [data-image-variant]').count(),1);
  // Client browsing keeps the picker and removes designer mutation/allowance controls.
  delete deck.enhancements;deck.can_edit=false;deck.iteration.status='shared';
  await page.goto(base+'/?slide=visual-slide#/view/test-share');await page.waitForSelector('[data-image-variant]');
  await picker.selectOption(older);
  assert.equal(await page.locator('[data-action=enhance-slide],[data-action=use-image-version]').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS saved-version picker, original comparison, draft selection at cap, lightbox, monthly counter, full-photo and client views, mobile widths 320/390');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
