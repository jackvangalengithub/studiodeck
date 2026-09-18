// Render and validate the Stillwater Garden deck, plans and fictional quotes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../demos/stillwater-garden');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
(async()=>{
 const browser=await chromium.launch({headless:false,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--headless=new']});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode()));});
  await page.emulateMedia({media:'print'});
  await page.pdf({path:path.join(root,manifest.pdf),preferCSSPageSize:true,printBackground:true});
  fs.mkdirSync(path.join(root,'slides'),{recursive:true});
  const slides=await page.locator('.slide').all(),overflow=[];
  for(let i=0;i<slides.length;i++){
   await slides[i].screenshot({path:path.join(root,'slides',`${String(i+1).padStart(2,'0')}.jpg`),type:'jpeg',quality:92});
   const bad=await slides[i].evaluate(el=>[...el.querySelectorAll('h1,p,li,table,.total,.cards,.timeline-grid,.tree,.points')].filter(x=>{const b=x.getBoundingClientRect(),p=el.getBoundingClientRect();return b.bottom>p.bottom-48||b.right>p.right+1;}).map(x=>x.tagName+': '+x.textContent.slice(0,70)));
   if(bad.length)overflow.push({slide:i+1,bad});
  }
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
  await page.waitForFunction(n=>document.querySelector('#counter').textContent===`1 / ${n}`,slides.length);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(n=>document.querySelector('#counter').textContent===`2 / ${n}`,slides.length);
  const navigation=await page.locator('#counter').innerText();
  for(const key of manifest.plans){
   const svg=fs.readFileSync(path.join(root,'assets',key+'.svg'),'utf8');
   const [,width,height]=svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
   await page.setViewportSize({width:1440,height:Math.round(1440*Number(height)/Number(width))});
   await page.goto(pathToFileURL(path.join(root,'assets',key+'.svg')).href);
   await page.locator('svg').screenshot({path:path.join(root,'assets',key+'.png')});
  }
  const docs=['scope.html',...manifest.quotes.map(q=>'suppliers/'+q.reference+'.html')];
  for(const file of docs){
   await page.goto(pathToFileURL(path.join(root,file)).href);
   await page.pdf({path:path.join(root,file.replace(/\.html$/,'.pdf')),preferCSSPageSize:true,printBackground:true});
  }
  const report={slides:slides.length,plans:manifest.plans.length,supplierQuotes:manifest.quotes.length,overflow,browserErrors:errors,navigation};
  fs.writeFileSync(path.join(root,'render-checks.json'),JSON.stringify(report,null,2));
  if(overflow.length||errors.length)throw Error(JSON.stringify(report));
  console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
