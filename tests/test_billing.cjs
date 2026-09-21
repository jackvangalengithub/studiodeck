// Browser acceptance checks with fictional API responses; no Stripe calls or payments.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../public');
 const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;const asset=pathname.startsWith('/assets/')?pathname:'/index.html';const file=path.join(root,asset);res.setHeader('Content-Type',asset.endsWith('.js')?'text/javascript':asset.endsWith('.css')?'text/css':'text/html');res.end(await fs.readFile(file));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  const stamp=Math.floor(Date.now()/1000),studio={id:'test-studio',name:'Test studio',role:'admin'};
  let summary={needs_onboarding:false,legacy_exempt:false,package:'7-day trial',trial_ends_at:stamp+5*86400,trial_active:true,subscription_active:false,plan:null,status:'none',paid_until:0,cancel_at_period_end:false,limits:{seats:1,projects:1},usage:{seats:1,projects:0,passes:0}};
  const session=()=>({user:{id:'admin',name:'Designer',email:'designer@example.test'},csrf:'test',studio,studios:[studio],studio_theme:{palette:'warmgray',style:'editorial'},capabilities:{ai:false,mail:false},billing:summary});
  let websiteIncluded=false;let addon={id:'website',name:'Website',price:3900,currency:'EUR',active:false,until:0,status:'none',local:false,available:true,has_subscription:false};
  const coverage={source:'trial',active:false,expires_at:stamp-1,pass_expires_at:null,delete_after:null};
  const catalog=Object.fromEntries([['pass','Project Pass',1900,1,1],['extension','Pass extension',1500,1,1],['solo','Solo',3900,1,3],['studio','Studio',19900,5,15],['practice','Practice',39900,15,50]].map(([k,name,cents,seats,projects])=>[k,{name,cents,seats,projects,available:true}]));
  await page.route('**/api.php?**',async route=>{
    const url=new URL(route.request().url()),a=url.searchParams.get('action'),body=route.request().postDataJSON();calls.push({a,body});let result={ok:true};
    if(a==='session')result=session();
    if(a==='projects')result={projects:[],billing:summary};
    if(a==='project_access')result={project:{id:'project-1',name:'Garden project'},access:coverage,reason:'trial_expired',admin:true,can_manage:true,summary,full:false,consumes_slot:true,can_use_subscription:false,can_use_pass:false,can_buy_pass:true,has_pass:false,other_passes:false,archive_candidates:[]};
    if(a==='billing_onboard'){assert.equal(body.studio_name,'My studio');summary={...summary,needs_onboarding:false,trial_active:true,trial_ends_at:stamp+7*86400};result=session();}
    if(a==='billing')result={summary,catalog,website_included:websiteIncluded,addons:[addon],projects:[{id:'project-1',name:'Garden project',coverage,has_pass:false}],orders:[],changes:[],extra_projects:summary.plan?2:0,extra_seats:0,has_customer:true};
    if(a==='billing_change_checkout'){websiteIncluded=!!body.website;result={url:base+'/test-studio/billing?stripe_updated=1'};}
    if(a==='billing_portal')result={url:base+'/test-studio/billing?stripe_portal=1'};
    if(a==='billing_invoices')result={invoices:[{id:'inv_1',number:'SD-001',created:stamp,amount:1900,currency:'eur',status:'paid',url:'https://invoice.stripe.com/example',pdf:'https://pay.stripe.com/example.pdf'}]};
    if(a==='website_checkout'){assert.deepEqual(body,{});addon={...addon,active:true,status:'active',has_subscription:true,until:stamp+30*86400};result={url:base+'/test-studio/billing?addon_test=activated'};}
    if(a==='billing_checkout'){assert(!body.project_id,'Prepaid checkout must not need a project');result={url:body.plan==='pass'?base+'/checkout-confirmed':base+'/test-studio/billing?stripe_checkout=1'};}
    await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto(base+'/test-studio/projects');await page.locator('.billing-trial-bar').getByText('5 days left in your trial').waitFor();
  assert.equal(await page.locator('.modal').count(),0);const bar=await page.locator('.billing-trial-bar').boundingBox();assert.equal(bar.x,0);assert.equal(bar.y,0);assert.equal(bar.width,await page.evaluate(()=>window.innerWidth));assert.equal(bar.height,44);
  assert((await page.locator('.sidebar').boundingBox()).y>=44);
  await page.locator('.billing-trial-bar [data-action=billing]').click();await page.getByRole('heading',{name:'Billing',exact:true}).waitFor();assert.equal(await page.locator('.billing-trial-bar').count(),1);
  assert.equal(await page.getByRole('heading',{name:'Project coverage'}).count(),0);await page.getByRole('heading',{name:'One project at a time'}).waitFor();assert.equal(await page.locator('.billing-offers > :first-child').getAttribute('class'),'billing-pass-group billing-offer-group');assert.equal(await page.locator('.billing-package-group .billing-plan').count(),3);assert.equal(await page.locator('.billing-pass-group .billing-plan').count(),1);assert.equal(await page.locator('.billing-package-group [role=switch]').count(),3);assert.equal(await page.locator('.billing-pass-group [role=switch]').count(),0);assert.equal(await page.locator('.billing-offers .billing-plan').count(),4);await page.getByText('SD-001',{exact:true}).waitFor();assert.equal(await page.locator('[data-action=billing-plan]').count(),3);
  await page.locator('[data-package=solo]').getByRole('switch',{name:'Website',exact:true}).click();await page.locator('[data-package=solo] [data-action=billing-plan]').click();await page.waitForURL('**/billing?stripe_checkout=1');assert.equal(calls.find(c=>c.a==='billing_checkout').body.website,true);assert.equal(await page.locator('.modal').count(),0);
  summary={...summary,trial_active:false,plan:'studio',package:'Studio',status:'active',paid_until:stamp+30*86400,subscription_active:true,limits:{seats:5,projects:17},usage:{seats:5,projects:2,passes:0}};
  await page.reload();await page.locator('.billing-plan.is-selected').waitFor();assert.equal(await page.locator('.billing-trial-bar').count(),0);
  assert.equal(await page.locator('.billing-plan.is-selected').count(),1);
  assert(await page.locator('.billing-current-button').isDisabled());
  assert.match(await page.locator('.billing-plan.is-selected .billing-price').innerText(),/219/);
  await page.locator('.billing-adjust').click();await page.waitForURL('**/billing?stripe_portal=1');assert.equal(await page.locator('.modal').count(),0);
  const practice=page.locator('[data-package=practice]');await practice.locator('[name=projects]').fill('52');await practice.locator('[name=seats]').fill('17');assert.match(await practice.locator('.billing-price').innerText(),/459/);
  await practice.locator('[data-action=billing-plan]').click();await page.waitForURL('**/billing?stripe_updated=1');assert.equal(await page.locator('.modal').count(),0);
  assert.deepEqual(calls.find(c=>c.a==='billing_change_checkout').body,{plan:'practice',extra_projects:2,extra_seats:2,website:false});
  await page.screenshot({path:'/tmp/studiodeck-billing-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:'/tmp/studiodeck-billing-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile page must not overflow horizontally');
  const solo=page.locator('[data-package=solo]');
  assert(await solo.getByRole('button',{name:'Decrease Projects',exact:true}).isDisabled());
  assert(await solo.getByRole('button',{name:'Decrease People',exact:true}).isDisabled());
  await solo.getByRole('button',{name:'Increase Projects',exact:true}).click();await solo.getByRole('button',{name:'Increase People',exact:true}).click();
  assert.equal(await solo.locator('[name=projects]').inputValue(),'4');assert.equal(await solo.locator('[name=seats]').inputValue(),'2');assert.match(await solo.locator('.billing-price').innerText(),/69/);
  await solo.locator('[data-action=billing-plan]').click();await page.waitForURL('**/billing?stripe_updated=1');await page.waitForFunction(()=>document.querySelector('[data-package=solo] [name=projects]')?.value==='3');assert.deepEqual(calls.filter(c=>c.a==='billing_change_checkout').at(-1).body,{plan:'solo',extra_projects:1,extra_seats:1,website:false});assert.equal(await page.locator('.modal').count(),0);
  await solo.locator('[name=projects]').fill('504');await solo.locator('[name=seats]').fill('102');assert.match(await solo.locator('.billing-price').innerText(),/7,069/);
  assert.equal(await solo.locator('[name=projects]').getAttribute('max'),null);assert.equal(await solo.locator('[name=seats]').getAttribute('max'),null);
  await solo.locator('[name=projects]').fill('2');await solo.locator('[data-action=billing-plan]').click();assert.equal(await page.locator('.modal').count(),0,'Below-minimum values must not proceed');
  await solo.locator('[name=projects]').fill('3');await solo.locator('[name=seats]').fill('1');
  assert.equal(await page.getByRole('switch',{name:'Google Ads campaign'}).count(),0);
  for(const name of ['Website']){
    const toggle=solo.getByRole('switch',{name,exact:true});await toggle.click();assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.equal(await solo.locator('[data-package-total]').innerText(),'€78.00');
    await solo.getByRole('button',{name:'Increase Projects',exact:true}).click();assert.equal(await solo.locator('[data-package-total]').innerText(),'€88.00');await solo.getByRole('button',{name:'Decrease Projects',exact:true}).click();
    await toggle.focus();await page.keyboard.press('Space');assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.equal(await solo.locator('[data-package-total]').innerText(),'€39.00');
  }
  const studioCard=page.locator('[data-package=studio]');await studioCard.getByRole('switch',{name:'Website',exact:true}).click();assert.equal(await studioCard.locator('[data-package-total]').innerText(),'€258.00');await studioCard.locator('.billing-adjust').click();await page.waitForFunction(()=>document.querySelector('[data-package=studio] [role=switch]')?.getAttribute('aria-checked')==='true'&&document.querySelector('[data-package=solo] [role=switch]')?.getAttribute('aria-checked')==='true');assert.equal(calls.filter(c=>c.a==='billing_change_checkout').at(-1).body.website,true);
  await studioCard.getByRole('switch',{name:'Website',exact:true}).click();await studioCard.locator('.billing-adjust').click();await page.waitForFunction(()=>document.querySelector('[data-package=solo] [role=switch]')?.getAttribute('aria-checked')==='false');assert.equal(calls.filter(c=>c.a==='billing_change_checkout').at(-1).body.website,false);
  assert(!calls.some(x=>x.a==='website_checkout'),'Bundled Website uses the package payment');assert.match(await solo.locator('.billing-price').innerText(),/39/);
  await page.locator('.billing-pass-card').getByRole('button',{name:'Go to checkout',exact:true}).click();await page.waitForURL('**/checkout-confirmed');
  // Expiry stays in the top bar without automatically interrupting the workspace.
  summary={...summary,plan:null,status:'none',subscription_active:false,trial_active:false,trial_ends_at:stamp-1};await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/test-studio/projects');
  await page.locator('.billing-trial-bar').getByText('Your trial has ended',{exact:true}).waitFor();assert.equal(await page.locator('.modal').count(),0);
  await page.locator('.billing-trial-bar [data-action=billing]').click();await page.getByRole('heading',{name:'Billing',exact:true}).waitFor();
  assert(!calls.some(c=>['billing_change_preview','billing_change_confirm'].includes(c.a)));assert.deepEqual(errors,[]);console.log('PASS fixed trial bar, direct Stripe redirects, capacity controls, Website pricing, mobile layout and expiry without automatic popups');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
