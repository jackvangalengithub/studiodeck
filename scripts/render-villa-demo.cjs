// Render the generated source deck and fictional supplier PDFs with Playwright.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../demos/villa-auren');
(async()=>{
  const browser=await chromium.launch({headless:false,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--headless=new']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.goto(pathToFileURL(path.join(root,'index.html')).href);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(im=>im.decode()));});
    await page.emulateMedia({media:'print'});
    await page.pdf({path:path.join(root,'Villa-Auren-Presentation.pdf'),preferCSSPageSize:true,printBackground:true});
    fs.mkdirSync(path.join(root,'slides'),{recursive:true});
    const slides=await page.locator('.slide').all();
    const overflow=[];
    for(let i=0;i<slides.length;i++){
      const slide=slides[i];
      await slide.screenshot({path:path.join(root,'slides',`${String(i+1).padStart(2,'0')}.jpg`),type:'jpeg',quality:93});
      const bad=await slide.evaluate(el=>[...el.querySelectorAll('h1,p,li,table,.total,.cards,.timeline,.tree,.bigpoints')].filter(x=>x.getBoundingClientRect().bottom>el.getBoundingClientRect().bottom-42).map(x=>x.tagName+': '+x.textContent.slice(0,70)));
      if(bad.length)overflow.push({slide:i+1,bad});
    }
    // Exercise navigation in the standalone presentation.
    await page.emulateMedia({media:'screen'});
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.waitForFunction(n=>document.querySelector('#counter').textContent===`1 / ${n}`,slides.length);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(n=>document.querySelector('#counter').textContent===`2 / ${n}`,slides.length);
    const navigation=await page.locator('#counter').innerText();
    const files=['scope.html',...fs.readdirSync(path.join(root,'suppliers')).filter(x=>x.endsWith('.html')).map(x=>'suppliers/'+x)];
    for(const file of files){
      await page.goto(pathToFileURL(path.join(root,file)).href);
      await page.pdf({path:path.join(root,file.replace(/\.html$/,'.pdf')),preferCSSPageSize:true,printBackground:true});
    }
    fs.writeFileSync(path.join(root,'render-checks.json'),JSON.stringify({slides:slides.length,documents:files.length,overflow,errors,navigation},null,2));
    if(overflow.length||errors.length)throw Error(JSON.stringify({overflow,errors}));
    console.log(`Rendered ${slides.length} slides and ${files.length} PDFs; no overflow or browser errors. Navigation: ${navigation}`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
