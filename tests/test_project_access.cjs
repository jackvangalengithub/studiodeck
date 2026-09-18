// Exercise the real access dialog in a browser; all billing responses are fictional.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const server=http.createServer(async(req,res)=>{try{res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/html');res.end(req.url.endsWith('.js')?await fs.readFile(path.join(__dirname,'../public',req.url)):'<main id="modal"></main>');}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(async()=>{
   const {projectAccessUi}=await import('/assets/project-access.js');
   const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const button=(label,a,kind='',extra='')=>`<button data-action="${a}" ${extra}>${label}</button>`;
   window.calls=[];window.opened=[];window.billingCalls=[];window.state={user:{id:'admin'},studio:{id:'studio',role:'admin'}};
   window.decision={project:{id:'p',name:'Garden <project>'},access:{source:'trial',active:false,archived:false},reason:'trial_expired',admin:true,can_manage:true,summary:{subscription_active:false,status:'none',usage:{projects:0},limits:{projects:1}},full:false,consumes_slot:true,can_use_subscription:false,can_use_pass:false,can_buy_pass:true,has_pass:false,other_passes:true,archive_candidates:[]};
   window.ui=projectAccessUi({state,api:async(a,b)=>{calls.push({a,b});if(a==='project_activate'&&window.failActivate)throw Error('The last slot was taken.');return structuredClone(decision);},esc,button,openModal:(title,body)=>document.querySelector('#modal').innerHTML=`<h1>${title}</h1>${body}`,closeModal:()=>document.querySelector('#modal').innerHTML='',toast:()=>{},billing:{load:async()=>{},open:async()=>billingCalls.push({a:'open'}),action:async(a,el)=>billingCalls.push({a,d:el.dataset})},openProject:async(pid,options)=>opened.push({pid,options}),newProject:async archive=>opened.push({newProject:true,archive}),back:async()=>{}});
   document.addEventListener('click',e=>{const el=e.target.closest('[data-action]');if(el)ui.action(el.dataset.action,el).catch(e=>{throw e;});});
   await ui.gate('p','open',{preview:true,iteration:'i',slide:'budget'});
  });
  await page.getByRole('heading',{name:'Your trial has ended'}).waitFor();await page.getByText('A pass on another project cannot be transferred to this one.').waitFor();
  await page.getByRole('button',{name:'Open read-only',exact:true}).click();assert.equal(await page.evaluate(()=>opened[0].options.preview),true);
  await page.evaluate(async()=>{decision.admin=false;await ui.gate('p');});
  await page.getByText('Contact your studio admin to purchase access or change coverage.').waitFor();assert.equal(await page.locator('[data-action=billing-access-buy]').count(),0);
  await page.evaluate(async()=>{decision.admin=true;decision.reason='archived';decision.access={source:'subscription',active:true,archived:true};decision.summary={subscription_active:true,status:'active',plan:'solo',usage:{projects:3},limits:{projects:3}};decision.full=true;decision.can_use_subscription=true;decision.archive_candidates=[{id:'other',name:'Old project'}];await ui.gate('p','reactivate');});
  await page.getByText('Existing active projects remain usable.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Reactivate with current coverage'}).count(),0);
  await page.getByRole('button',{name:'Review archive and continue'}).click();await page.getByText('Subscription slots: 3 → 3 / 3.',{exact:false}).waitFor();
  await page.evaluate(()=>window.failActivate=true);await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.getByText('The last slot was taken.',{exact:true}).waitFor();
  assert.deepEqual(await page.evaluate(()=>calls.find(c=>c.a==='project_activate').b),{project_id:'p',source:'subscription',archive_project_id:'other'});
  await page.getByRole('button',{name:'Add a slot · €10/month'}).click();assert.deepEqual(await page.evaluate(()=>billingCalls.at(-1)),{a:'billing-plan',d:{plan:'solo',addSlot:'1'}});
  await page.evaluate(async()=>{failActivate=false;decision.full=false;decision.summary.limits.projects=4;await ui.resume();});
  await page.getByRole('heading',{name:'Confirm project access'}).waitFor();await page.getByText('Subscription slots: 3 → 4 / 4.',{exact:false}).waitFor();await page.getByRole('button',{name:'Confirm',exact:true}).click();
  await page.waitForFunction(()=>opened.length===2);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  await page.evaluate(async()=>{decision.reason='pass_expired';decision.access={source:'project_pass',active:false,archived:false,expires_at:1};decision.has_pass=true;decision.full=false;await ui.gate('p');});
  await page.getByRole('button',{name:'Extend 150 days · €15'}).click();assert.equal(await page.evaluate(()=>billingCalls.at(-1).d.plan),'extension');
  await page.evaluate(async()=>{await ui.resume();});await page.getByRole('heading',{name:'Your Project Pass has expired'}).waitFor();
  // Confirmed payment permits resumption; a client-side pending intent alone does not.
  await page.evaluate(async()=>{decision.reason='ready';decision.access.active=true;await ui.resume();});await page.waitForFunction(()=>opened.length===3);
  assert.deepEqual(errors,[]);console.log('PASS access reasons, read-only preview, member controls, capacity choices, explicit slot swap, stale capacity, purchase intent and verified resumption');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
