// Run against an isolated local app with log-only mail; creates fictional people.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const base=process.env.STUDIODECK_TEST_URL,log=process.env.STUDIODECK_TEST_MAIL_LOG;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 let page;
 try{
  page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const stamp=Date.now(),email=`people-${stamp}@example.test`,clientEmail=`homeowner-${stamp}@example.test`;
  const post=async(action,data,csrf='')=>{const r=await page.request.post(`${base}/api.php?action=${action}`,{data,headers:{'X-CSRF-Token':csrf}});const body=await r.json();assert.ok(r.ok(),`${action}: ${JSON.stringify(body)}`);return body;};
  await post('request_login',{email});const token=fs.readFileSync(log,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];
  await post('consume_login',{token});const session=await (await page.request.get(`${base}/api.php?action=session`)).json(),csrf=session.csrf;
  await post('save_studio_user',{email:`colleague-${stamp}@example.test`,name:'Studio colleague',role:'member'},csrf);
  const project=await post('create_project',{name:'People tab test',emails:[]},csrf);
  const url=`${base}/${session.studio.id}/projects/${project.project_id}?tab=people`;
  await page.goto(url);await page.locator('.project-people').waitFor();
  assert.equal(await page.locator('.project-team-inline,.project-clients-inline').count(),0);
  assert.equal(await page.locator('.people-section').count(),3);
  await page.getByRole('button',{name:'Add team member',exact:true}).click();await page.locator('#team-search').fill('colleague');await page.locator('.team-result').click();await page.getByRole('button',{name:'Save team',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});await page.locator('.project-person h3').filter({hasText:'Studio colleague'}).waitFor();assert.equal(new URL(page.url()).searchParams.get('tab'),'people');
  await page.getByRole('button',{name:'Edit Studio colleague',exact:true}).click();await page.locator('[name=phone]').fill('+31 20 5550123');await page.getByRole('button',{name:'Save details',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});await page.getByRole('link',{name:'+31 20 5550123',exact:true}).waitFor();
  await page.getByRole('button',{name:'Add client',exact:true}).click();await page.locator('[data-form=project-person] [name=name]').fill('Homeowner');await page.locator('[data-form=project-person] [name=email]').fill(clientEmail);await page.locator('[name=phone]').fill('+31 6 5550123');await page.getByRole('button',{name:'Add client',exact:true}).last().click();await page.locator('.modal').waitFor({state:'detached'});await page.locator('.project-person h3').filter({hasText:'Homeowner'}).waitFor();
  await page.getByRole('button',{name:'Add person',exact:true}).click();await page.locator('[data-form=project-person] [name=name]').fill('Local painter');await page.locator('[name=phone]').fill('020 5550124');await page.locator('[name=role]').fill('Painting contractor');await page.getByRole('button',{name:'Add person',exact:true}).last().click();await page.locator('.modal').waitFor({state:'detached'});
  await page.reload();await page.locator('.project-person h3').filter({hasText:'Local painter'}).waitFor();await page.getByRole('link',{name:'020 5550124',exact:true}).waitFor();
  let data=await (await page.request.get(`${base}/api.php?action=project&id=${project.project_id}`)).json();assert.equal(data.people.team.length,2);assert.equal(data.people.clients[0].phone,'+31 6 5550123');assert.equal(data.people.other.length,1);if(data.clients)assert.equal(data.clients[0].email,clientEmail);
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/studiodeck-project-people-mobile.png'});await page.setViewportSize({width:1440,height:1000});
  const shared=await post('share',{iteration:project.iteration_id,emails:[clientEmail]},csrf);const bearer=shared.links[0].url.split('/#/view/')[1];
  const deck=await (await page.request.get(`${base}/api.php?action=deck`,{headers:{Authorization:'Bearer '+bearer}})).json();assert.equal(deck.people,undefined);assert.equal(deck.clients,undefined);assert.equal(deck.team.find(p=>p.name==='Studio colleague').phone,'+31 20 5550123');
  await page.getByRole('button',{name:'Remove Homeowner',exact:true}).click();await page.locator('[data-form=remove-project-person] [type=submit]').click();await page.locator('.modal').waitFor({state:'detached'});await page.locator('.people-section[aria-label=Clients] .people-empty').waitFor();const revoked=await page.request.get(`${base}/api.php?action=deck`,{headers:{Authorization:'Bearer '+bearer}});assert.equal(revoked.status(),403);
  await page.getByRole('button',{name:'Remove Local painter',exact:true}).click();await page.locator('[data-form=remove-project-person] [type=submit]').click();await page.locator('.modal').waitFor({state:'detached'});await page.locator('.people-section[aria-label="Other people"] .people-empty').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS People groups, team selection, saved contact details, client integration, mobile layout, durable route, presentation privacy and client revocation.');
 }catch(error){if(page)await page.screenshot({path:'/tmp/studiodeck-project-people-failure.png'});throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
