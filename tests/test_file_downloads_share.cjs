// Run against an isolated app with a disposable SQLite database and log-only mail.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const base=process.env.STUDIODECK_TEST_URL,log=process.env.STUDIODECK_TEST_MAIL_LOG,db=process.env.STUDIODECK_TEST_DATABASE;
if(!base||!log||!db)throw Error('Set isolated STUDIODECK_TEST_URL, STUDIODECK_TEST_MAIL_LOG and STUDIODECK_TEST_DATABASE.');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:false,args:['--no-sandbox','--headless=new']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Optionally test the deployed frontend against this isolated API/database.
  if(process.env.STUDIODECK_TEST_FRONTEND_URL)await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.origin!==base||url.pathname==='/api.php'||!(url.pathname.startsWith('/assets/')||request.resourceType()==='document'))return route.continue();
   const response=await context.request.get(process.env.STUDIODECK_TEST_FRONTEND_URL+url.pathname+url.search);
   assert.ok(response.ok(),'Live frontend resource: '+url.pathname);await route.fulfill({response});
  });
  const request=async(action,data,headers={})=>{const r=data===undefined?await context.request.get(base+'/api.php?action='+action,{headers}):await context.request.post(base+'/api.php?action='+action,{data,headers});assert.ok(r.ok(),action+': '+await r.text());return r.json();};
  await request('request_login',{email:`downloads-${Date.now()}@example.test`});
  const token=fs.readFileSync(log,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];await request('consume_login',{token});
  let session=await request('session');if(!session.studio)session=await request('create_studio',{name:'File test studio'},{'X-CSRF-Token':session.csrf});
  const headers={'X-CSRF-Token':session.csrf,'X-Studio-Id':session.studio.id};
  const p=await request('create_project',{name:'File downloads test',emails:['client@example.test','second@example.test'],starting_pack:[]},headers);
  // Small source fixtures exercise the actual payload and download endpoint without processing jobs.
  execFileSync('python3',['-c',`import sqlite3,sys,uuid,hashlib,datetime
c=sqlite3.connect(sys.argv[1]);now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for name,mime in [('Zulu.pdf','application/pdf'),('Budget 10.csv','text/csv'),('Alpha.pdf','application/pdf'),('Garden.png','image/png'),('Budget 2.csv','text/csv')]:
 a=str(uuid.uuid4());v=str(uuid.uuid4());data=b'Fixture source file'
 c.execute('INSERT INTO assets(id,project_id,category,created_at) VALUES(?,?,?,?)',(a,sys.argv[2],'legal',now))
 c.execute('INSERT INTO file_versions(id,asset_id,number,name,mime,size,sha256,data,created_at) VALUES(?,?,?,?,?,?,?,?,?)',(v,a,1,name,mime,len(data),hashlib.sha256(data).hexdigest(),data,now))
 c.execute('INSERT INTO iteration_files VALUES(?,?,?,?)',(sys.argv[3],a,v,'legal'))
c.commit()`,db,p.project_id,p.iteration_id]);
  const root=`${base}/${session.studio.id}`,project=`${root}/projects/${p.project_id}`;
  execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.execute('INSERT INTO jobs(id,project_id,iteration_id,type,status,created_at) VALUES(?,?,?,?,?,?)',('pending-share-test',sys.argv[2],sys.argv[3],'ingest','queued','2026-09-18'));c.commit()`,db,p.project_id,p.iteration_id]);
  await page.goto(project);await page.locator('[data-action=share]').first().click();await page.getByRole('heading',{name:'Your files are still processing.'}).waitFor();assert.equal(await page.locator('[data-form=share]').count(),0);
  execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);c.execute("DELETE FROM jobs WHERE id='pending-share-test'");c.commit()`,db]);
  await page.goto(project);await page.locator('[data-action=share]').first().click();await page.locator('[data-form=share]').waitFor();
  assert.equal(await page.locator('[name=client_email]').count(),2);
  for(const checkbox of await page.locator('[name=client_email]').all())await checkbox.check();
  const sent=page.waitForResponse(r=>r.url().includes('action=share')&&r.request().method()==='POST');
  await page.locator('[data-form=share] button[type=submit]').click();assert.equal((await sent).status(),200);await page.locator('.link-result').first().waitFor();assert.equal(await page.locator('.link-result').count(),2);
  const url=await page.locator('.link-result input').first().inputValue();assert.ok(url.includes('/#/view/'));
  await page.getByRole('button',{name:'Done',exact:true}).click();await page.locator('[data-action=share]').first().click();await page.locator('[data-form=share]').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.goto(project+'?tab=files');await page.locator('.file-group').first().waitFor();assert.equal(await page.locator('.file-group .file-type-logo').count(),5);
  await page.goto(`${root}/slide/summary?project=${p.project_id}&iteration=${p.iteration_id}`);await page.locator('.summary-layout .download-list button').first().waitFor();
  const expected=['Budget 2.csv','Budget 10.csv','Alpha.pdf','Zulu.pdf','Garden.png'];
  const check=async(selector)=>{const rows=page.locator(selector+' button[data-action=history]');assert.equal(await rows.count(),5);assert.deepEqual(await rows.locator('.download-file-copy').evaluateAll(els=>els.map(e=>e.firstChild.textContent)),expected);assert.equal(await rows.locator('.file-type-logo').count(),5);};
  await check('.summary-layout .download-list');await page.screenshot({path:'/tmp/studiodeck-download-summary.png'});
  await page.locator('[data-action=originals]').click();await check('.modal .download-list');await page.screenshot({path:'/tmp/studiodeck-download-popup.png'});
  await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('.modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:'/tmp/studiodeck-download-mobile.png'});
  await page.locator('.modal [data-action=history]').first().click();assert.equal(await page.locator('.history-item .file-type-logo').count(),1);
  const download=page.waitForEvent('download');await page.locator('.modal [data-action=download]').click();assert.equal((await download).suggestedFilename(),'Budget 2.csv');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.locator('[data-action=project-documents]').click();await check('.modal .download-list');
  const client=await browser.newContext(),viewer=await client.newPage();viewer.on('pageerror',e=>errors.push(e.message));await viewer.goto(url);await viewer.locator('.presentation').waitFor();await client.close();
  assert.deepEqual(errors,[]);console.log('PASS share dialog, recipient defaults, sending/link creation, repeat sharing, client access, file-type/title sorting, badges, mobile layout and original download.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
