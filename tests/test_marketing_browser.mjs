import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MARKETING_TEST_URL||'http://127.0.0.1:4180';
const catalog=JSON.parse(fs.readFileSync(new URL('../public/assets/studio-types.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
 await page.goto(base,{waitUntil:'networkidle'});
 assert.equal(await page.locator('.audience-choice').count(),catalog.length);
 assert.equal(await page.locator('#navigation a[href="#ai-project-checks"],#navigation a[href="#client-communication"]').count(),0);
 const expectedEvidence={
  interior:['brushed brass','polished chrome','2400 mm','2200 mm','fitting included','fitting excluded'],
  landscape:['natural limestone','porcelain tiles','1200 mm','900 mm','drip irrigation included','drip irrigation excluded'],
  architecture:['RAL 7016 matt','RAL 9005 matt','3000 mm','2800 mm','installation included','installation excluded'],
  furniture:['solid oak','oak veneer on MDF','2400 mm','2200 mm','on-site fitting included','on-site fitting excluded'],
  events:['Beam 200','Beam 100','1800 mm','1500 mm','post-event dismantling included','post-event dismantling excluded'],
  signmaker:['matt black','gloss black','3000 mm','2800 mm','installation included','installation excluded']
 };

 assert.match(await page.locator('#project-checklist').innerText(),/you become the person who has to remember them all/);
 assert.equal(await page.locator('.checklist-example-row').count(),3);
 assert.match(await page.locator('#project-checklist').innerText(),/Marking work done never approves a cost change/);
 for(const profile of catalog){
  assert.deepEqual(fs.readFileSync(new URL('../www/assets/studio-types/'+profile.id+'.webp',import.meta.url)),fs.readFileSync(new URL('../public'+profile.image,import.meta.url)));
  const choice=page.locator('.audience-choice').filter({has:page.locator(`[value="${profile.id}"]`)});assert.equal(await choice.locator('strong').innerText(),profile.en.label);assert.equal(await choice.locator('small').innerText(),profile.en.description);
  await choice.click();assert(await choice.locator('input').isChecked());assert(new URL(page.url()).searchParams.get('audience')===profile.id);
  for(const selector of ['.hero-image','.motion-scene img','#demo-image','.power-deck-image img','.ai-visual img','.portfolio-example-projects img']){
   const images=page.locator(selector);for(const img of await images.all()){assert((await img.getAttribute('src')).endsWith('/'+profile.id+'.webp'));assert.equal(await img.getAttribute('alt'),profile.en.alt);}
  }
  assert.deepEqual(await page.locator('.ai-source-pair mark').allTextContents(),expectedEvidence[profile.id]);
  assert((await page.locator('.ai-evidence-demo').getAttribute('aria-label')).includes(profile.en.label.toLowerCase()));
  for(const selector of ['.checklist-example-suggestion p','#ai-checks-faq-example'])assert((await page.locator(selector).textContent()).includes(await page.locator('.ai-finding-reason').first().evaluate(el=>el.lastChild.textContent.trim())));
  if(profile.id!=='interior')assert(!/Bathroom|tap B-02|Signage specification/.test((await page.locator('.ai-finding').first().textContent())));
  assert.equal(await page.locator('#demo-title').innerText(),profile.en.projectTitle);assert.equal(await page.locator('.portfolio-example-body>h3').innerText(),profile.en.headline);
  if(profile.id==='signmaker'){
   assert.match(await page.locator('#hero-title').innerText(),/You make brands visible/);
   assert.match(await page.locator('.hero-description').innerText(),/storefront mockups, lettering designs, vehicle graphics/);
   assert.match(await page.locator('.communication-story .product-story-copy').innerText(),/lettering sizes, vinyl choices/);
   assert.equal(await page.locator('.story-approval h3').innerText(),'Matching vehicle graphics');
   assert.match(await page.locator('.portfolio-story .product-story-copy').innerText(),/storefront signs, window lettering and vehicle wraps/);
   assert.match(await page.locator('#panel-budget').textContent(),/Signs & lettering/);
   assert.match(await page.locator('#sample-comments').textContent(),/same design on our van/);
  }
  if(profile.id!=='interior')assert((await page.locator('#audience-status').innerText()).includes(profile.en.label.toLowerCase()));
 }
 console.log('PASS All audience choices match studio setup and update the hero, demo and portfolio');
 await page.reload({waitUntil:'networkidle'});assert(await page.locator('[name="audience"][value="signmaker"]').isChecked());assert((await page.locator('.story-approval h3').innerText()).includes('vehicle'));
 await page.goto(base+'/?audience=landscape#studio-website',{waitUntil:'networkidle'});assert(await page.locator('[name="audience"][value="landscape"]').isChecked());assert((await page.locator('.communication-story .product-story-copy').innerText()).includes('planting'));assert((await page.locator('.portfolio-story .product-story-copy').innerText()).includes('gardens'));
 await page.locator('[name="audience"][value="landscape"]').focus();await page.keyboard.press('ArrowRight');assert(await page.locator('[name="audience"][value="architecture"]').isChecked());
 await page.locator('#expand-demo').click();assert((await page.locator('#expanded-image').getAttribute('src')).endsWith('/architecture.webp'));assert((await page.locator('#expanded-image-credit').innerText()).includes('AI-generated'));await page.keyboard.press('Escape');
 await page.locator('#tab-feedback').click();await page.locator('#feedback-input').fill('Keep this sample feedback.');await page.locator('#feedback-form button').click();await page.locator('.audience-choice').filter({has:page.locator('[value="furniture"]')}).click();assert((await page.locator('#sample-comments').innerText()).includes('Keep this sample feedback.'));
 await page.locator('#tab-budget').click();assert((await page.locator('#panel-budget').innerText()).includes('Cabinetry & furniture'));await page.locator('#source-toggle').click();assert(await page.locator('#budget-source').isVisible());
 for(const [id,price] of [['solo','€59 / month'],['studio','€199 / month'],['practice','€499 / month'],['pass','€19.00 one-time']]){await page.locator(`[data-plan="${id}"]`).click();assert.equal(await page.locator('#summary-price').innerText(),price);await page.keyboard.press('Escape');}
 assert.equal(await page.locator('.website-addon').count(),0);assert.equal(await page.getByText('Studio website included',{exact:true}).count(),3);console.log('PASS URL persistence, keyboard selection, sample interactions and updated subscription prices');
 await page.locator('.ai-finding').nth(1).locator('summary').focus();await page.keyboard.press('Enter');assert(await page.locator('.ai-finding').nth(1).locator('.ai-source-pair').isVisible());
 await page.locator('.ai-finding').nth(2).locator('summary').click();
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});
  if(width>700){
   const tiles=await page.locator('.audience-choice').evaluateAll(items=>items.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,right:r.right,width:r.width};}));
   assert.equal(tiles.length,6);
   assert(tiles.every(tile=>Math.abs(tile.top-tiles[0].top)<1),`Six tiles must share one row at ${width}`);
   assert(tiles.every(tile=>tile.right<=width&&Math.abs(tile.width-tiles[0].width)<1),`Tiles must fit equally at ${width}`);
  }
  for(const profile of catalog){await page.locator('.audience-choice').filter({has:page.locator(`[value="${profile.id}"]`)}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${profile.id} overflows at ${width}`);}
 }
 assert.equal(await page.locator('.ai-finding[open]').count(),3);
 await page.setViewportSize({width:390,height:844});await page.locator('.menu-toggle').click();await page.locator('#navigation a[href="#pricing"]:not(.nav-cta)').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
 await page.locator('#project-checklist').screenshot({path:'/tmp/marketing-checklist-mobile.png'});await page.locator('#client-communication').screenshot({path:'/tmp/marketing-communication-mobile.png'});await page.locator('#studio-website').screenshot({path:'/tmp/marketing-portfolio-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?audience=landscape',{waitUntil:'networkidle'});await page.screenshot({path:'/tmp/marketing-audience-desktop.png'});await page.locator('#project-checklist').screenshot({path:'/tmp/marketing-checklist-desktop.png'});await page.locator('#client-communication').screenshot({path:'/tmp/marketing-communication-desktop.png'});await page.locator('#studio-website').screenshot({path:'/tmp/marketing-portfolio-desktop.png'});
 await page.locator('[data-demo-preset="pan-left"]').click();
 assert.match(await page.locator('#motion-example-prompt').inputValue(),/right to left/);
 await page.locator('#motion-example-prompt').fill('Keep the sunset light and move slowly.');
 await page.locator('[data-motion-demo-play]').click();
 assert.equal(await page.locator('#motion-example-prompt').inputValue(),'Keep the sunset light and move slowly.');
 await page.waitForFunction(()=>document.querySelector('.motion-scene img').getAnimations().some(a=>a.playState==='running'));
 await page.locator('.motion-scene img').evaluate(img=>img.getAnimations().forEach(a=>a.finish()));
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.motion-scene img')).transform==='none');
 assert.match(await page.locator('[data-motion-demo-status]').innerText(),/original photo/);
 await page.locator('#ai-movement').screenshot({path:'/tmp/marketing-motion-desktop.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-demo-preset="pull-back"]').click();
 assert.match(await page.locator('#motion-example-prompt').inputValue(),/pull the camera back/);
 assert.equal(await page.locator('.motion-scene img').evaluate(img=>img.getAnimations().length),0);
 await page.setViewportSize({width:390,height:844});await page.locator('#ai-movement').screenshot({path:'/tmp/marketing-motion-mobile.png'});
 console.log('PASS Motion presets, editable prompt, original-photo ending and reduced motion');
 assert.deepEqual(errors,[]);console.log('PASS All audiences fit mobile, tablet and desktop; resources and JavaScript load without errors');
}finally{await browser.close();}
