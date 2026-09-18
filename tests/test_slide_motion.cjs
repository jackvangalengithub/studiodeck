// Real CSS and animation module, with deterministic slide fixtures and no API calls.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('assert/strict');
const base=process.env.STUDIODECK_TEST_URL;
if(!base)throw Error('Set STUDIODECK_TEST_URL to an isolated server.');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(base+'/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="stylesheet" href="/assets/app.css"></head><body class="presenting"><div id="app"></div></body></html>'}));
 await page.goto(base);await page.evaluate(async()=>{
  const {animateSlideChange,cancelSlideMotion}=await import('/assets/slide-motion.js');
  const content={
   text:'<section class="manual-text-slide"><h1 class="slide-heading">A quiet room</h1><p>Some text beneath the heading.</p></section>',
   photo:'<section class="full-photo-slide"><div class="full-photo-copy"><h1>A full photo title</h1><p>Keep this text in place.</p></div></section>',
   budget:'<section class="presentation-budget"><h1 class="slide-heading">Budget</h1><div class="budget-sticky-summary"><h2>Known total</h2><strong>€25,000</strong></div><div class="chat-body" style="height:100px;overflow:auto">'+Array.from({length:20},(_,n)=>`<p>Message ${n}</p>`).join('')+'</div>'+Array.from({length:25},(_,n)=>`<div style="height:90px">Cost ${n}</div>`).join('')+'</section>'
  };
  window.renderFixture=(kind,height=117)=>{document.querySelector('#app').innerHTML=`<div class="presentation" style="--presentation-toolbar-height:${height}px"><div class="presentation-chrome-top" style="height:${height}px"></div><main class="slide-area" tabindex="-1">${content[kind]}</main></div>`;};
  window.measureSlide=el=>({top:el.getBoundingClientRect().top,height:el.getBoundingClientRect().height,heading:el.querySelector('h1').getBoundingClientRect().top,border:getComputedStyle(el).borderTopWidth,padding:getComputedStyle(el).paddingTop,scroll:el.scrollTop,nested:el.querySelector('.chat-body')?.scrollTop||0});
  window.transitionFixture=(direction=1)=>{
   const before=measureSlide(document.querySelector('.presentation .slide-area'));
   animateSlideChange(()=>renderFixture('text',163),direction);
   const copy=document.querySelector('.slide-outgoing');
   return {before,copy:copy?measureSlide(copy):null,incoming:measureSlide(document.querySelector('.presentation .slide-area:not(.slide-outgoing)'))};
  };
  window.cancelFixture=cancelSlideMotion;
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft')window.lastTransition=transitionFixture(e.key==='ArrowLeft'?-1:1);});
 });
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});for(const fullscreen of [false,true])for(const kind of ['text','photo','budget']){
  await page.evaluate(({fullscreen,kind})=>{cancelFixture();document.body.classList.toggle('presentation-fullscreen',fullscreen);document.body.classList.toggle('presentation-controls-hidden',fullscreen);renderFixture(kind);if(kind==='budget'){document.querySelector('.slide-area').scrollTop=480;document.querySelector('.chat-body').scrollTop=90;}},{fullscreen,kind});
  await page.keyboard.press('ArrowRight');const snapshot=await page.evaluate(()=>lastTransition);
  assert.ok(snapshot.copy,`${kind} has an outgoing slide`);
  for(const key of ['top','height','heading','border','padding','scroll','nested'])assert.equal(snapshot.copy[key],snapshot.before[key],`${width}px ${fullscreen?'fullscreen':'normal'} ${kind}: outgoing ${key} must not jump`);
  const positions=await page.evaluate(async()=>{const result=[];for(let n=0;n<25;n++){await new Promise(requestAnimationFrame);result.push(measureSlide(document.querySelector('.presentation .slide-area:not(.slide-outgoing)')).heading);}return result;});
  assert.ok(positions.every(y=>Math.abs(y-snapshot.incoming.heading)<.1),`${kind}: incoming text must stay at its initial vertical position`);
  assert.equal(await page.locator('.slide-outgoing').count(),0);
 }}
 await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowLeft');assert.ok(await page.locator('.slide-outgoing').count()<=1);await page.waitForTimeout(400);assert.equal(await page.locator('.slide-outgoing').count(),0);
 await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.press('ArrowRight');assert.equal(await page.locator('.slide-outgoing').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS No outgoing/incoming vertical jumps: desktop/mobile, fullscreen/normal, text/full-photo/scrolled budget, nested scroll, rapid arrows and reduced motion.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
