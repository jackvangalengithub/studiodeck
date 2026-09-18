// Real HTTP/browser check using tests/security_browser_fixture.py.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const directory=process.env.SECURITY_BROWSER_EXPORT||'/tmp/studiodeck-security-browser';
(async()=>{
 const fixture=JSON.parse(fs.readFileSync(directory+'/fixture.json','utf8'));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const context=await browser.newContext(),page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(fixture.base+'/studio-a/projects/own');
  assert.equal(new URL(page.url()).pathname,'/login');
  assert.equal(await page.locator('select').count(),0);
  assert.equal((await context.request.get(fixture.base+'/assets/app.js')).status(),401);
  await page.goto('about:blank');
  await page.goto(fixture.base+'/login#/login/'+fixture.editorToken);
  await page.waitForURL('**/studio-a/projects**').catch(async error=>{throw Error(`${error.message}\nURL: ${page.url()}\n${await page.locator('body').innerText()}\n${errors.join('\n')}`);});
  await page.locator('.project-tile').first().waitFor();
  assert.equal((await context.request.get(fixture.base+'/assets/app.js')).status(),200);
  assert.equal((await context.request.get(fixture.base+'/studio-a/projects/private')).status(),404);
  assert.equal((await context.request.get(fixture.base+'/studio-b/settings')).status(),403);
  await page.goto(fixture.base+'/studio-a/projects/own');
  await page.getByRole('heading',{name:'Project own',exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'Project own',exact:true}).waitFor();
  const multiContext=await browser.newContext(),multi=await multiContext.newPage();
  multi.on('pageerror',error=>errors.push(error.message));
  await multi.goto(fixture.base+'/#/login/'+fixture.multiToken);
  await multi.waitForURL('**/choose');
  await multi.locator('.destination-shell').waitFor();
  assert.equal(await multi.locator('.destination-studio').count(),2);
  const directContext=await browser.newContext(),direct=await directContext.newPage();
  direct.on('pageerror',error=>errors.push(error.message));
  await direct.goto(fixture.base+'/login?returnTo='+encodeURIComponent('/studio-a/projects/own')+'#/login/'+fixture.directToken);
  await direct.waitForURL('**/studio-a/projects/own**');
  await direct.getByRole('heading',{name:'Project own',exact:true}).waitFor();
  const failedContext=await browser.newContext(),failed=await failedContext.newPage();
  failed.on('pageerror',error=>errors.push(error.message));
  for(const token of [fixture.expiredToken,fixture.editorToken]){
   await failed.goto('about:blank');
   await failed.goto(fixture.base+'/login#/login/'+token);
   await failed.getByRole('status').filter({hasText:'This sign-in link is expired or has already been used.'}).waitFor();
   assert.equal(new URL(failed.url()).hash,'');
   assert.ok(await failed.getByRole('link',{name:'Request a new sign-in link'}).isVisible());
  }
  await failed.getByRole('link',{name:'Request a new sign-in link'}).click();
  await failed.getByLabel('Your email address').fill('editor@example.test');
  await failed.getByRole('button',{name:'Email me a sign-in link'}).click();
  await failed.getByRole('status').filter({hasText:/Check your email for your sign-in link\.|Local development: the sign-in link is in storage\/mail\.log\./}).waitFor();
  const clientContext=await browser.newContext(),client=await clientContext.newPage();
  client.on('pageerror',error=>errors.push(error.message));
  await client.goto(fixture.base+'/#/login/'+fixture.clientToken);
  await client.waitForURL('**/client/projects/own**');
  await client.locator('.presentation').waitFor();
  await client.reload();await client.locator('.presentation').waitFor();
  const session=await (await clientContext.request.get(fixture.base+'/api.php?action=session')).json();
  assert.deepEqual(session.studios,[]);
  assert.equal((await clientContext.request.get(fixture.base+'/api.php?action=projects')).status(),403);
  assert.equal((await clientContext.request.get(fixture.base+'/studio-a/projects/own')).status(),403);
  const replay=await clientContext.request.post(fixture.base+'/api.php?action=consume_login',{data:{token:fixture.clientToken}});
  assert.equal(replay.status(),403);
  await clientContext.request.post(fixture.base+'/api.php?action=logout',{data:{},headers:{'X-CSRF-Token':session.csrf}});
  await client.reload();assert.equal(new URL(client.url()).pathname,'/login');
  assert.equal((await clientContext.request.get(fixture.base+'/assets/app.js')).status(),401);
  assert.deepEqual(errors,[]);
  console.log('PASS Real browser: automatic login, single/multiple destinations, direct links, expired/reused links, email requests, no language picker, studio/client navigation, tenant denial, logout and protected assets.');
 }finally{await browser.close();fs.writeFileSync(directory+'/done','done');}
})().catch(error=>{console.error(error);process.exitCode=1;fs.writeFileSync(directory+'/done','done');});
