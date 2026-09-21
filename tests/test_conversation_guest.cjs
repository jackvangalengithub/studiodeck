const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.COMMUNICATION_BASE||'http://127.0.0.1:18496';
const mail=process.env.COMMUNICATION_MAIL_LOG||'/tmp/studiodeck-communication-browser/mail.jsonl';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const errors=[];
 try{
  const studio=await browser.newContext({viewport:{width:1440,height:1000}});await studio.addCookies([{name:'studiodeck_session',value:'editor',url:base}]);
  const page=await studio.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/studio-a/projects/shared?iteration=iteration-shared&tab=comments');
  await page.locator('[data-action=comm-new]').click();await page.locator('[name=thread_title]').fill('Joinery finish');
  await page.locator('#comm-thread-form [name=body]').fill('Discuss this finish with the joiner.');await page.locator('#comm-thread-form button[type=submit]').click();
  await page.getByRole('heading',{name:'Joinery finish',exact:true}).waitFor();
  await page.locator('#comm-reply').fill('Please confirm the stronger finish for 125.50 extra.');
  await page.locator('[data-action=comm-ask]').click();await page.locator('#comm-confirmation-form [name=recipient]').selectOption('trade@example.test');
  assert(await page.locator('#comm-invite-hint').isVisible());assert.match(await page.locator('#comm-invite-hint').textContent(),/including earlier messages/);
  await page.locator('#comm-has-cost').check();await page.locator('#comm-cost').fill('125.50');
  await page.locator('#comm-confirmation-form summary').click();await page.locator('#comm-confirmation-form [name=version_id]').selectOption('file-shared');
  await page.locator('#comm-confirmation-form button[type=submit]').click();await page.getByText('Request sent.',{exact:true}).waitFor();
  const invited=page.locator('.comm-guests');await invited.waitFor();assert.match(await invited.textContent(),/Bakker Joinery/);
  let message;for(let n=0;n<60;n++){if(fs.existsSync(mail)){message=fs.readFileSync(mail,'utf8').trim().split('\n').map(JSON.parse).findLast(m=>m.to==='trade@example.test');if(message)break;}await new Promise(r=>setTimeout(r,250));}
  assert(message,'Invitation email was queued and logged');const token=message.text.match(/#\/login\/([a-f0-9]{64})/)[1];
  const guest=await browser.newContext({viewport:{width:1200,height:900}}),gp=await guest.newPage();gp.on('pageerror',e=>errors.push(e.message));
  await gp.goto(base+'/login#/login/'+token);await gp.locator('#guest-reply').waitFor();
  assert.match(gp.url(),/\/conversations\//);
  assert.equal(await gp.getByRole('heading',{name:'Joinery finish',exact:true}).count(),1);
  assert(await gp.getByText('Discuss this finish with the joiner.',{exact:true}).isVisible());
  assert(!await gp.getByText('SECRET-shared',{exact:true}).count());
  const card=gp.locator('.comm-confirmation').filter({hasText:'Please confirm the stronger finish'});
  const download=gp.waitForEvent('download');await card.locator('.comm-attachment').click();assert.equal((await download).suggestedFilename(),'file-shared.png');
  await card.locator('[data-confirm]').click();await gp.getByText('Confirmation recorded.',{exact:true}).waitFor();
  assert.match(await card.textContent(),/Confirmed by Bakker Joinery/);
  await gp.locator('#guest-reply textarea').fill('Confirmed; we can start on Monday.');await gp.locator('#guest-reply [type=submit]').click();
  await gp.getByText('Confirmed; we can start on Monday.',{exact:true}).waitFor();
  await gp.locator('[data-ask]').click();await gp.locator('#guest-request [name=body]').fill('Please confirm access to the site.');await gp.locator('#guest-request [type=submit]').click();await gp.getByText('Request sent.',{exact:true}).waitFor();
  const url=gp.url();for(const width of [1200,390,320]){await gp.setViewportSize({width,height:1000});assert(await gp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Guest overflow '+width);}
  await gp.screenshot({path:'/tmp/studiodeck-communication-browser/guest-mobile.png',fullPage:true});
  await gp.goto(base+'/choose');await gp.getByRole('link').filter({hasText:'Joinery finish'}).click();await gp.locator('#guest-reply').waitFor();
  await page.reload();await page.locator('.comm-topic').filter({hasText:'Joinery finish'}).click();
  assert(await page.getByText('Confirmed; we can start on Monday.',{exact:true}).isVisible());
  await page.locator('.comm-guests [data-action=comm-revoke]').click();await page.locator('[data-action=comm-do-revoke]').click();await page.getByText('Access removed.',{exact:true}).waitFor();
  const revoked=await guest.request.get(url);assert.equal(revoked.status(),404);
  const forbidden=await guest.request.get(base+'/api.php?action=project&id=shared');assert([401,403,404].includes(forbidden.status()));
  assert.deepEqual(errors,[]);
  console.log('PASS real email invitation, restricted guest page, attachment download, approval, reverse request, mobile, destinations and revocation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
