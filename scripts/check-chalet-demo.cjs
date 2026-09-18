// Opt-in acceptance check for the installed, local Haus Morgenlicht demo.
// Creates a short-lived browser session and removes it in finally; no emails or AI.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {execFileSync}=require('node:child_process');
const {randomBytes,createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const database=process.env.CHALET_DEMO_DATABASE,base=process.env.CHALET_DEMO_URL;
if(!database||!base)throw Error('Set CHALET_DEMO_DATABASE and CHALET_DEMO_URL to the local demo instance.');
const studio='85c6b0cceb613adb3b2c8e0db4f63d25',pid='200ba7b5da42242890fb71fcb885b4bf',iid='9ea54c52b372e121812304e10d4dd5f0';
const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
const py=code=>execFileSync('python3',['-c',code,database,hash,studio],{encoding:'utf8'});
(async()=>{
  let browser;
  py("import sqlite3,sys,time,secrets; c=sqlite3.connect(sys.argv[1]); u=c.execute('select user_id from projects where id=?',('200ba7b5da42242890fb71fcb885b4bf',)).fetchone()[0]; c.execute('insert into sessions(token_hash,user_id,csrf,expires_at,studio_id) values(?,?,?,?,?)',(sys.argv[2],u,secrets.token_hex(32),int(time.time())+900,sys.argv[3])); c.commit()");
  try{
    browser=await chromium.launch({headless:false,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--headless=new']});
    const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    await context.addCookies([{name:'studiodeck_session',value:token,url:base,httpOnly:true,sameSite:'Lax'}]);
    const page=await context.newPage(),errors=[];page.on('pageerror',err=>errors.push(err.message));
    await page.goto(`${base}/${studio}/projects/${pid}`);
    await page.getByRole('button',{name:'Preview presentation',exact:true}).waitFor();
    const data=await page.evaluate(async({pid,iid,studio})=>{
      const r=await fetch('/api.php?'+new URLSearchParams({action:'project',id:pid,iteration:iid}),{headers:{'X-Studio-ID':studio}});if(!r.ok)throw Error(await r.text());return r.json();
    },{pid,iid,studio});
    assert.equal(data.files.length,44);assert.equal(data.budget.length,21);
    const {budgetTotal,budgetLineTotal,budgetEnabled}=await import(path.resolve(__dirname,'../public/assets/budget.js'));
    // Preserve choices made by a person using the live demo during this check.
    assert.equal(data.total_cents,budgetTotal(data.budget));
    const baseline=data.budget.map(r=>({...r,selected:!Number(r.is_optional),range_percent:0}));
    assert.equal(budgetTotal(baseline),68750000);
    const all=data.budget.map(r=>({...r,selected:true,range_percent:100}));
    assert.equal(budgetTotal(all),75090000);
    assert.equal(budgetLineTotal(all.find(r=>r.label==='Conversion construction package'),all),24800000);
    assert.equal(budgetLineTotal(all.find(r=>r.label==='Optional garden-level wellness suite'),all),3480000);
    assert.equal(budgetTotal(baseline.map(r=>({...r,range_percent:100}))),70350000);
    assert.equal(budgetEnabled(baseline.find(r=>r.label==='Sauna cabin & heater package'),baseline),false);
    assert.equal(budgetEnabled(all.find(r=>r.label==='Sauna cabin & heater package'),all),true);
    const controls=data.budget.find(r=>r.label==='Electrical installation & controls');
    assert.ok(controls.included);const parent=data.budget.find(r=>r.id===controls.parent_id);assert.ok(parent.included&&parent.parent_id);
    const dir=path.resolve(__dirname,'../demos/haus-morgenlicht/checks');fs.mkdirSync(dir,{recursive:true});
    await page.waitForFunction(()=>document.querySelectorAll('.overview-grid .image-pending').length===0);
    await page.screenshot({path:path.join(dir,'studio-overview.png'),fullPage:true});
    await page.getByRole('button',{name:'Preview presentation',exact:true}).click();
    await page.locator('.cover-slide').waitFor();
    const {presentationSlides}=await import(path.resolve(__dirname,'../public/assets/slides.js'));
    const slides=presentationSlides(data);assert.ok(slides.length>=36);
    const additions=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../demos/haus-morgenlicht/additional-slides.json')));
    for(const addition of additions){const added=slides.find(s=>s.title===addition.title.replace(/\n/g,' '));assert.ok(added,'Added study: '+addition.key);assert.equal(added.type,addition.type);}
    assert.equal(slides.filter(s=>s.situation==='before').length,3);
    // Every native slide is reachable; all displayed images decode successfully.
    for(const slide of slides){
      await page.goto(`${base}/${studio}/slide/${slide.id}?project=${pid}&iteration=${iid}`);
      await page.locator('.presentation [aria-label="Slide navigation"]').waitFor().catch(async error=>{await page.screenshot({path:path.join(dir,'failed-slide.png')});throw Error(JSON.stringify({slide:slide.title,url:page.url(),errors,body:(await page.locator('body').innerText()).slice(0,1200)})+' '+error.message);});
      await page.waitForFunction(()=>document.querySelectorAll('.slide-area .image-pending').length===0);
      if(['moodboard','floorplan'].includes(slide.type))assert.equal(await page.locator('[data-action=enhance-slide]').count(),0,'No AI editing for '+slide.type);
      if(slide.type==='render')assert.equal(await page.locator('[data-action=enhance-slide]').count(),1,'Renders keep AI editing');
      if(slide.visual||slide.id==='intro')assert.ok(await page.locator('.slide-area img').count(),'Expected an image: '+slide.title);
      await page.waitForFunction(()=>[...document.querySelectorAll('.slide-area img')].every(im=>im.complete&&im.naturalWidth>0));
      const study=additions.find(s=>s.title.replace(/\n/g,' ')===slide.title);if(study)await page.screenshot({path:path.join(dir,study.key+'.png')});
      if(slide.type==='fullphoto'&&slide.title==='The mountains, invited inside.')await page.screenshot({path:path.join(dir,'living-room.png')});
      if(slide.type==='floorplan'&&slide.title.startsWith('Open the rooms'))await page.screenshot({path:path.join(dir,'proposed-plan.png')});
      if(slide.type==='fullphoto'&&slide.title.startsWith('A warm light'))await page.screenshot({path:path.join(dir,'winter.png')});
      if(slide.situation==='before'&&slide.type==='photo')await page.screenshot({path:path.join(dir,'before-'+slide.id+'.png')});
      if(slide.id==='budget'){
        await page.locator('.presentation-budget [data-budget-total]').waitFor();
        const main=data.budget.find(r=>r.label==='Conversion construction package'),stone=data.budget.find(r=>r.label==='Building services coordination');
        await page.locator(`[data-action="toggle-cost"][data-id="${main.id}"]`).click();
        await page.locator(`[data-action="toggle-cost"][data-id="${stone.id}"]`).click();
        await page.getByRole('heading',{name:'Electrical installation & controls',exact:false}).waitFor();
        await page.screenshot({path:path.join(dir,'interactive-budget.png'),fullPage:true});
      }
    }
    for(const f of data.files.filter(f=>/AB-260918|HT-260918|LT-260918|scope/.test(f.name))){
      const response=await context.request.get(`${base}/api.php?`+new URLSearchParams({action:'file',id:f.id,iteration:iid}),{headers:{'X-Studio-ID':studio}});
      assert.equal(response.status(),200);assert.ok((await response.body()).subarray(0,4).equals(Buffer.from('%PDF')));
    }
    assert.deepEqual(errors,[]);
    const report={nativeSlides:slides.length,files:data.files.length,budgetRows:data.budget.length,base:687500,premium:703500,allOptions:750900,savedSelectionTotal:data.total_cents/100,allImagesDecoded:true,nestedSupplierDownloads:true,browserErrors:errors};
    fs.writeFileSync(path.join(dir,'acceptance.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{
    if(browser)await browser.close();
    py("import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); c.execute('delete from sessions where token_hash=?',(sys.argv[2],)); c.commit()");
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
