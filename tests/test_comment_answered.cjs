// Real API and browser checks against a disposable database with log-only email.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const base=process.env.STUDIODECK_TEST_URL,log=process.env.STUDIODECK_TEST_MAIL_LOG,db=process.env.STUDIODECK_TEST_DATABASE;
if(!base||!log||!db)throw Error('Set isolated test URL, mail log and database.');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:false,args:['--no-sandbox','--headless=new']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const request=async(client,action,data,headers={},expected=200)=>{const r=data===undefined?await client.request.get(base+'/api.php?action='+action,{headers}):await client.request.post(base+'/api.php?action='+action,{data,headers});assert.equal(r.status(),expected,action+': '+await r.text());return r.json();};
  const login=async(client,email)=>{await request(client,'request_login',{email});const token=fs.readFileSync(log,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];await request(client,'consume_login',{token});return request(client,'session');};
  let session=await login(context,`answered-${Date.now()}@example.test`);if(!session.studio)session=await request(context,'create_studio',{name:'Answered test studio'},{'X-CSRF-Token':session.csrf},201);
  const headers={'X-CSRF-Token':session.csrf,'X-Studio-Id':session.studio.id},api=(action,data,expected=200)=>request(context,action,data,headers,expected);
  const p=await api('create_project',{name:'Answered conversations',visibility:'public',emails:['answer-client@example.test'],starting_pack:[]},201),iid=p.iteration_id;
  const post=(body,extra={})=>api('comment',{iteration:iid,slide:'intro',body,...extra});
  const a=await post('Oldest topic'),b=await post('Middle topic'),c=await post('Newest topic'),r1=await post('Earlier reply',{parent_id:a.id}),r2=await post('Later reply',{parent_id:a.id});
  const status=(id,answered)=>api('comment_answered',{iteration:iid,id,answered});
  await status(a.id,true);
  let feed=await api('comments_feed&project_id='+p.project_id);assert.deepEqual(feed.items.map(c=>c.id),[c.id,b.id]);
  feed=await api('comments_feed&show_answered=1&project_id='+p.project_id);assert.deepEqual(feed.items.map(c=>c.id),[c.id,b.id,a.id,r2.id,r1.id]);
  feed=await api('comments_feed&sort=oldest&show_answered=1&project_id='+p.project_id);assert.deepEqual(feed.items.map(c=>c.id),[a.id,r1.id,r2.id,b.id,c.id]);
  await api('comment_answered',{iteration:iid,id:r1.id,answered:true},400);await api('comment_answered',{iteration:iid,id:a.id,answered:'yes'},400);
  await request(context,'comment_answered',{iteration:iid,id:a.id,answered:false},{},403);await api('comments_feed&sort=invalid',undefined,400);
  const other=await api('create_project',{name:'Answer pagination',starting_pack:[]},201);await api('comment_answered',{iteration:other.iteration_id,id:a.id,answered:true},404);
  const project=`${base}/${session.studio.id}/projects/${p.project_id}`,slide=`${base}/${session.studio.id}/slide/intro?project=${p.project_id}&iteration=${iid}`;
  await page.goto(project+'?tab=comments');await page.locator('.comment-thread').first().waitFor();const ids=()=>page.locator('.comment-thread').evaluateAll(els=>els.map(e=>e.dataset.threadId));
  assert.deepEqual(await ids(),[c.id,b.id]);assert.equal(await page.getByRole('switch',{name:'Show answered'}).getAttribute('aria-checked'),'false');
  await page.getByRole('switch',{name:'Show answered'}).click();await page.locator(`[data-thread-id="${a.id}"]`).waitFor();assert.equal(await page.locator('.comment-reply [data-action=toggle-comment-answered]').count(),0);
  const oldest=page.locator(`[data-thread-id="${a.id}"]`);assert.equal(await oldest.locator('[data-action=toggle-comment-answered]').getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Sort: Newest first',exact:true}).click();await page.getByRole('button',{name:'Sort: Oldest first',exact:true}).waitFor();assert.deepEqual(await ids(),[a.id,b.id,c.id]);
  await oldest.getByRole('button',{name:'Reply',exact:true}).click();await oldest.locator('textarea').fill('Unsent reply');await page.getByRole('button',{name:'Sort: Oldest first',exact:true}).click();await page.getByRole('button',{name:'Sort: Newest first',exact:true}).waitFor();assert.equal(await oldest.locator('textarea').inputValue(),'Unsent reply');await oldest.getByRole('button',{name:'Cancel',exact:true}).click();
  await oldest.getByRole('button',{name:'Mark as unanswered',exact:true}).click();await oldest.getByRole('button',{name:'Mark as answered',exact:true}).waitFor();
  await page.getByRole('switch',{name:'Show answered'}).click();await page.locator('.comment-thread').first().waitFor();
  await page.locator(`[data-thread-id="${b.id}"]`).getByRole('button',{name:'Mark as answered',exact:true}).click();await page.locator(`[data-thread-id="${b.id}"]`).waitFor({state:'detached'});assert.deepEqual(await ids(),[c.id,a.id]);
  await page.goto(`${base}/${session.studio.id}/comments`);await page.locator('.comment-thread').first().waitFor();assert.deepEqual(await ids(),[c.id,a.id]);await page.getByRole('switch',{name:'Show answered'}).click();await page.locator(`[data-thread-id="${b.id}"]`).waitFor();
  await page.goto(slide);await page.locator('[data-action=feedback]').first().click();await page.locator('.modal .comment-thread').first().waitFor();assert.deepEqual(await ids(),[c.id,a.id]);
  // A full navigation resets to the default view; controls still apply inside the popup.
  await page.locator('[data-form=feedback] textarea').fill('Unsent new comment');await page.getByRole('switch',{name:'Show answered'}).click();await page.locator(`[data-thread-id="${b.id}"]`).waitFor();await page.getByRole('button',{name:'Sort: Newest first',exact:true}).click();assert.deepEqual(await ids(),[a.id,b.id,c.id]);assert.equal(await page.locator('[data-form=feedback] textarea').inputValue(),'Unsent new comment');
  await page.locator(`[data-thread-id="${c.id}"]`).getByRole('button',{name:'Mark as answered',exact:true}).click();await page.locator(`[data-thread-id="${c.id}"] [aria-pressed=true]`).waitFor();
  await page.screenshot({path:'/tmp/studiodeck-answered-desktop.png'});await page.setViewportSize({width:390,height:844});assert.ok(await page.locator('.modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:'/tmp/studiodeck-answered-mobile.png'});
  const shared=(await api('share',{iteration:iid,client_emails:['answer-client@example.test']})).links[0],client=await browser.newContext(),viewer=await client.newPage();viewer.on('pageerror',e=>errors.push(e.message));await viewer.goto(shared.url);await viewer.locator('[data-action=feedback]').first().click();await viewer.locator('.comment-thread').first().waitFor();assert.equal(await viewer.locator('.comment-thread').count(),1);
  await viewer.getByRole('button',{name:'Mark as answered',exact:true}).click();await viewer.getByText('No unanswered comments.',{exact:false}).waitFor();await viewer.getByRole('switch',{name:'Show answered'}).click();assert.equal(await viewer.locator('.comment-thread').count(),3);await viewer.locator(`[data-thread-id="${a.id}"]`).getByRole('button',{name:'Mark as unanswered',exact:true}).click();await viewer.locator(`[data-thread-id="${a.id}"] [aria-pressed=false]`).waitFor();assert.equal(Number((await api('project&id='+p.project_id)).comments.find(x=>x.id===a.id).answered),0);
  const bearer={Authorization:'Bearer '+shared.url.split('/#/view/')[1]};await request(client,'comment_answered',{iteration:other.iteration_id,id:a.id,answered:true},bearer,403);await api('revoke_share',{id:shared.id});await request(client,'comment_answered',{iteration:iid,id:a.id,answered:true},bearer,403);await client.close();
  // A studio member with read-only project access can resolve, but cannot add comments.
  const email=`reader-${Date.now()}@example.test`;await api('save_studio_user',{email,name:'Read only designer'});const reader=await browser.newContext(),readerSession=await login(reader,email),readerHeaders={'X-CSRF-Token':readerSession.csrf,'X-Studio-Id':session.studio.id};
  const readProject=await request(reader,'project&id='+p.project_id,undefined,readerHeaders);assert.equal(readProject.can_edit,false);await request(reader,'comment_answered',{iteration:iid,id:a.id,answered:true},readerHeaders);await request(reader,'comment',{iteration:iid,slide:'intro',body:'Cannot edit'},readerHeaders,403);await reader.close();
  execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);iid=sys.argv[2]
for n in range(105):
 root=iid+'-'+str(n);c.execute('INSERT INTO comments(id,iteration_id,slide,author,body,created_at,answered) VALUES(?,?,?,?,?,?,?)',(root,iid,'intro','fixture@example.test',str(n),'2020-01-01T00:00:00Z',int(n<5)))
 if n in [5,104]:c.execute('INSERT INTO comments(id,iteration_id,parent_id,slide,author,body,created_at) VALUES(?,?,?,?,?,?,?)',(root+'-reply',iid,root,'intro','fixture@example.test','Reply','2021-01-01T00:00:00Z'))
c.commit()`,db,other.iteration_id]);
  const filtered=await api('comments_feed&project_id='+other.project_id);assert.equal(filtered.items.length,102);assert.equal(filtered.has_more,false);assert.equal(filtered.next_offset,100);assert.equal(filtered.items[0].body,'104');assert.equal(filtered.items[1].parent_id,filtered.items[0].id);assert.ok(filtered.items.every(c=>!c.answered));
  const all=await api('comments_feed&show_answered=1&project_id='+other.project_id);assert.equal(all.has_more,true);const more=await api('comments_feed&show_answered=1&project_id='+other.project_id+'&offset='+all.next_offset);assert.equal(more.items.length,5);assert.ok(more.items.every(c=>c.answered));
  assert.deepEqual(errors,[]);console.log('PASS answered/reopen by clients and viewers, permission boundaries, default filter, both sort directions, stable ties, pagination, all comment views, draft preservation and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
