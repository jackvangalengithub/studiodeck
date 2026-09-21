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
 for(const profile of catalog){
  assert.deepEqual(fs.readFileSync(new URL('../www/assets/studio-types/'+profile.id+'.webp',import.meta.url)),fs.readFileSync(new URL('../public'+profile.image,import.meta.url)));
  const choice=page.locator('.audience-choice').filter({has:page.locator(`[value="${profile.id}"]`)});assert.equal(await choice.locator('strong').innerText(),profile.en.label);assert.equal(await choice.locator('small').innerText(),profile.en.description);
  await choice.click();assert(await choice.locator('input').isChecked());assert(new URL(page.url()).searchParams.get('audience')===profile.id);
  for(const selector of ['.hero-image','#demo-image','.power-deck-image img','.ai-visual img','.portfolio-example-projects img']){
   const images=page.locator(selector);for(const img of await images.all()){assert((await img.getAttribute('src')).endsWith('/'+profile.id+'.webp'));assert.equal(await img.getAttribute('alt'),profile.en.alt);}
  }
  assert.equal(await page.locator('#demo-title').innerText(),profile.en.projectTitle);assert.equal(await page.locator('.portfolio-example-body>h3').innerText(),profile.en.headline);
  if(profile.id!=='interior')assert((await page.locator('#audience-status').innerText()).includes(profile.en.label.toLowerCase()));
 }
 console.log('PASS All five audience choices match studio setup and update the hero, demo and portfolio');
 await page.reload({waitUntil:'networkidle'});assert(await page.locator('[name="audience"][value="events"]').isChecked());assert((await page.locator('.story-approval h3').innerText()).includes('lighting'));
 await page.goto(base+'/?audience=landscape#studio-website',{waitUntil:'networkidle'});assert(await page.locator('[name="audience"][value="landscape"]').isChecked());assert((await page.locator('.communication-story .product-story-copy').innerText()).includes('planting'));assert((await page.locator('.portfolio-story .product-story-copy').innerText()).includes('gardens'));
 await page.locator('[name="audience"][value="landscape"]').focus();await page.keyboard.press('ArrowRight');assert(await page.locator('[name="audience"][value="architecture"]').isChecked());
 await page.locator('#expand-demo').click();assert((await page.locator('#expanded-image').getAttribute('src')).endsWith('/architecture.webp'));assert((await page.locator('#expanded-image-credit').innerText()).includes('AI-generated'));await page.keyboard.press('Escape');
 await page.locator('#tab-feedback').click();await page.locator('#feedback-input').fill('Keep this sample feedback.');await page.locator('#feedback-form button').click();await page.locator('.audience-choice').filter({has:page.locator('[value="furniture"]')}).click();assert((await page.locator('#sample-comments').innerText()).includes('Keep this sample feedback.'));
 await page.locator('#tab-budget').click();assert((await page.locator('#panel-budget').innerText()).includes('Cabinetry & furniture'));await page.locator('#source-toggle').click();assert(await page.locator('#budget-source').isVisible());
 for(const [id,price] of [['solo','€39 / month'],['studio','€199 / month'],['practice','€399 / month'],['pass','€19.00 one-time']]){await page.locator(`[data-plan="${id}"]`).click();assert.equal(await page.locator('#summary-price').innerText(),price);await page.keyboard.press('Escape');}
 assert((await page.locator('.website-addon .pass-price').innerText()).includes('€39'));console.log('PASS URL persistence, keyboard selection, sample interactions and existing prices');
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:1000});
  for(const profile of catalog){await page.locator('.audience-choice').filter({has:page.locator(`[value="${profile.id}"]`)}).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${profile.id} overflows at ${width}`);}
 }
 await page.setViewportSize({width:390,height:844});await page.locator('.menu-toggle').click();await page.locator('#navigation a[href="#client-communication"]').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
 await page.locator('#client-communication').screenshot({path:'/tmp/marketing-communication-mobile.png'});await page.locator('#studio-website').screenshot({path:'/tmp/marketing-portfolio-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/?audience=landscape',{waitUntil:'networkidle'});await page.screenshot({path:'/tmp/marketing-audience-desktop.png'});await page.locator('#client-communication').screenshot({path:'/tmp/marketing-communication-desktop.png'});await page.locator('#studio-website').screenshot({path:'/tmp/marketing-portfolio-desktop.png'});
 assert.deepEqual(errors,[]);console.log('PASS All audiences fit mobile, tablet and desktop; resources and JavaScript load without errors');
}finally{await browser.close();}
