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
  let summary={needs_onboarding:true,legacy_exempt:false,package:'7-day trial',trial_ends_at:null,trial_active:false,subscription_active:false,plan:null,status:'none',paid_until:0,cancel_at_period_end:false,limits:{seats:1,projects:1},usage:{seats:1,projects:0,passes:0}};
  const session=()=>({user:{id:'admin',name:'Designer',email:'designer@example.test'},csrf:'test',studio,studios:[studio],studio_theme:{palette:'warmgray',style:'editorial'},capabilities:{ai:false,mail:false},billing:summary});
  const coverage={source:'trial',active:false,expires_at:stamp-1,pass_expires_at:null,delete_after:null};
  const catalog=Object.fromEntries([['pass','Project Pass',1900,1,1],['extension','Pass extension',1500,1,1],['solo','Solo',3900,1,3],['studio','Studio',19900,5,15],['practice','Practice',39900,15,50]].map(([k,name,cents,seats,projects])=>[k,{name,cents,seats,projects,available:true}]));
  await page.route('**/api.php?**',async route=>{
    const url=new URL(route.request().url()),a=url.searchParams.get('action'),body=route.request().postDataJSON();calls.push({a,body});let result={ok:true};
    if(a==='session')result=session();
    if(a==='projects')result={projects:[],billing:summary};
    if(a==='project_access')result={project:{id:'project-1',name:'Garden project'},access:coverage,reason:'trial_expired',admin:true,can_manage:true,summary,full:false,consumes_slot:true,can_use_subscription:false,can_use_pass:false,can_buy_pass:true,has_pass:false,other_passes:false,archive_candidates:[]};
    if(a==='billing_onboard'){assert.equal(body.studio_name,'My studio');summary={...summary,needs_onboarding:false,trial_active:true,trial_ends_at:stamp+7*86400};result=session();}
    if(a==='billing')result={summary,catalog,projects:[{id:'project-1',name:'Garden project',coverage,has_pass:false}],orders:[],changes:[],extra_projects:summary.plan?2:0,extra_seats:0,has_customer:true};
    if(a==='billing_change_preview'){assert.equal(body.plan,'practice');assert.equal(body.extra_seats,2);assert.equal(Number(body.extra_projects),2);result={change_id:'change-1',amount:24000,currency:'eur',scheduled:false,monthly_amount:45900};}
    if(a==='billing_invoices')result={invoices:[{id:'inv_1',number:'SD-001',created:stamp,amount:1900,currency:'eur',status:'paid',url:'https://invoice.stripe.com/example',pdf:'https://pay.stripe.com/example.pdf'}]};
    if(a==='billing_checkout'){assert(!body.project_id,'Prepaid checkout must not need a project');assert.equal(body.plan,'pass');result={url:base+'/checkout-confirmed'};}
    await route.fulfill({contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto(base+'/test-studio/projects');await page.getByRole('heading',{name:'Your studio starts here'}).waitFor();
  await page.locator('[name=studio_name]').fill('My studio');await page.locator('[data-form=billing-onboard] button[type=submit]').click();
  await page.getByText('7 days left in your trial',{exact:false}).waitFor();assert(calls.some(x=>x.a==='billing_onboard'));
  await page.locator('.sidebar [data-action=billing]').click();await page.getByRole('heading',{name:'Billing',exact:true}).waitFor();
  assert.equal(await page.getByRole('heading',{name:'Project coverage'}).count(),0);await page.getByRole('heading',{name:'Or buy a project pass'}).waitFor();assert.equal(await page.locator('.billing-offers .billing-plan').count(),4);await page.getByText('SD-001',{exact:true}).waitFor();assert.equal(await page.locator('[data-action=billing-plan]').count(),3);
  summary={...summary,trial_active:false,plan:'studio',package:'Studio',status:'active',paid_until:stamp+30*86400,subscription_active:true,limits:{seats:5,projects:17},usage:{seats:5,projects:2,passes:0}};
  await page.reload();await page.locator('.billing-plan.is-selected').waitFor();
  assert.equal(await page.locator('.billing-plan.is-selected').count(),1);
  assert(await page.locator('.billing-current-button').isDisabled());
  assert.match(await page.locator('.billing-plan.is-selected .billing-price').innerText(),/199.*20.*219/);
  await page.locator('.billing-adjust').click();assert.equal(await page.locator('[name=team_capacity]').inputValue(),'5');assert(await page.locator('[name=team_capacity]').getAttribute('readonly')!==null);
  await page.locator('.modal [data-action=close-modal]').first().click();
  await page.locator('[data-action=billing-plan][data-plan=practice]').click();await page.locator('[name=team_capacity]').fill('17');
  assert.match(await page.locator('[data-capacity-preview]').innerText(),/17 team members.*52 active projects.*459/);
  await page.locator('[data-form=billing-plan] button[type=submit]').click();await page.locator('[data-form=billing-change-confirm]').waitFor();
  await page.locator('.modal [data-action=close-modal]').first().click();
  await page.screenshot({path:'/tmp/studiodeck-billing-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:'/tmp/studiodeck-billing-mobile.png',fullPage:true});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile page must not overflow horizontally');
  await page.getByRole('button',{name:'Buy Project Pass · €19',exact:true}).click();await page.getByRole('heading',{name:'Buy a Project Pass',exact:true}).waitFor();
  await page.getByRole('button',{name:'Continue to Stripe',exact:true}).click();await page.waitForURL('**/checkout-confirmed');
  // An expired trial offers a dismissible upgrade prompt, and still exposes Billing.
  summary={...summary,plan:null,status:'none',subscription_active:false,trial_active:false,trial_ends_at:stamp-1};await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/test-studio/projects');
  await page.getByRole('heading',{name:'Your trial has ended',exact:true}).waitFor();await page.getByRole('button',{name:'Continue in read-only mode',exact:true}).click();
  await page.getByRole('button',{name:'View packages',exact:true}).click();await page.getByRole('heading',{name:'Billing',exact:true}).waitFor();
  await page.goto(base+'/test-studio/projects/project-1');await page.getByRole('heading',{name:'Your trial has ended',exact:true}).waitFor();await page.getByRole('button',{name:'Open read-only',exact:true}).waitFor();await page.getByRole('button',{name:'Buy Project Pass · €19',exact:true}).click();await page.getByRole('heading',{name:'Buy a Project Pass',exact:true}).waitFor();assert(calls.some(x=>x.a==='project_access'));
  assert.deepEqual(errors,[]);console.log('PASS onboarding, trial banner, admin Billing, four offers, prepaid checkout, invoices, mobile layout, purchase handoff and dismissible expiry prompt');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
