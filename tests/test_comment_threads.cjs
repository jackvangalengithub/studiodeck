// Isolated real API + browser checks. Use log-only mail and a disposable database.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const base=process.env.STUDIODECK_TEST_URL,log=process.env.STUDIODECK_TEST_MAIL_LOG,db=process.env.STUDIODECK_TEST_DATABASE;
if(!base||!log||!db)throw Error('Set isolated test URL, mail log and database.');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:false,args:['--no-sandbox','--headless=new']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const request=async(action,data,headers={},expected=200,client=context)=>{const r=data===undefined?await client.request.get(base+'/api.php?action='+action,{headers}):await client.request.post(base+'/api.php?action='+action,{data,headers});assert.equal(r.status(),expected,action+': '+await r.text());return r.json();};
  await request('request_login',{email:`threads-${Date.now()}@example.test`});const token=fs.readFileSync(log,'utf8').trim().split('\n').at(-1).split('/#/login/')[1];await request('consume_login',{token});
  let session=await request('session');if(!session.studio)session=await request('create_studio',{name:'Thread test studio'},{'X-CSRF-Token':session.csrf},201);
  const headers={'X-CSRF-Token':session.csrf,'X-Studio-Id':session.studio.id},api=(action,data,expected=200)=>request(action,data,headers,expected);
  const p=await api('create_project',{name:'Threaded conversations',emails:['thread-client@example.test'],starting_pack:[]},201),iid=p.iteration_id;
  const post=(body,extra={})=>api('comment',{iteration:iid,slide:'intro',body,...extra});
  const first=await post('First design question'),second=await post('Second design question'),reply=await post('First answer',{parent_id:first.id});
  await api('comment',{iteration:iid,slide:'intro',body:'Too deep',parent_id:reply.id},400);
  await api('comment',{iteration:iid,slide:'budget',body:'Wrong slide',parent_id:first.id},400);
  await api('comment',{iteration:iid,body:'Missing parent',parent_id:'not-a-comment'},404);
  const other=await api('create_project',{name:'Other iteration',starting_pack:[]},201);
  await api('comment',{iteration:other.iteration_id,slide:'intro',body:'Wrong iteration',parent_id:first.id},404);
  await request('comment',{iteration:iid,slide:'intro',body:'Missing CSRF',parent_id:first.id},{},403);
  const project=`${base}/${session.studio.id}/projects/${p.project_id}`,slide=`${base}/${session.studio.id}/slide/intro?project=${p.project_id}&iteration=${iid}`;
  await page.goto(slide);await page.locator('[data-action=feedback]').first().click();await page.locator('.comment-thread').first().waitFor();await page.getByRole('button',{name:'Sort: Newest first',exact:true}).click();
  assert.deepEqual(await page.locator('.modal .comment-thread').evaluateAll(els=>els.map(e=>e.dataset.threadId)),[first.id,second.id]);
  const thread=page.locator(`.modal [data-thread-id="${first.id}"]`);assert.equal(await thread.locator('.comment-reply').count(),1);assert.equal(await page.locator('.comment-reply [data-action=reply-comment]').count(),0);
  await thread.getByRole('button',{name:'Reply',exact:true}).click();await thread.locator('textarea').fill('A second answer from the studio');await thread.getByRole('button',{name:'Post reply',exact:true}).click();
  await page.getByText('A second answer from the studio',{exact:true}).waitFor();assert.deepEqual(await thread.locator('.comment-reply .comment-body').allTextContents(),['First answer','A second answer from the studio']);
  await page.locator('[data-form=feedback] textarea').fill('Third design question');await page.locator('[data-form=feedback] button[type=submit]').click();await page.getByText('Third design question',{exact:true}).waitFor();
  assert.equal(await page.locator('.modal .comment-thread').last().locator('.comment-card .comment-body').innerText(),'Third design question');
  await page.locator('.feedback-list').evaluate(e=>e.scrollTop=0);await page.screenshot({path:'/tmp/studiodeck-comment-threads-desktop.png'});
  await page.setViewportSize({width:390,height:844});await thread.getByRole('button',{name:'Reply',exact:true}).click();await page.screenshot({path:'/tmp/studiodeck-comment-threads-mobile.png'});assert.ok(await page.locator('.modal').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await thread.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await thread.locator('textarea').count(),0);
  await page.setViewportSize({width:1440,height:1000});await page.goto(project+'?tab=comments');await page.locator('.timeline .comment-thread').first().waitFor();const feedThread=page.locator(`.timeline [data-thread-id="${first.id}"]`);await feedThread.getByRole('button',{name:'Reply',exact:true}).click();await feedThread.locator('textarea').fill('Answer from the project feed');await feedThread.getByRole('button',{name:'Post reply',exact:true}).click();await page.getByText('Answer from the project feed',{exact:true}).waitFor();
  await page.goto(`${base}/${session.studio.id}/comments`);await page.locator('.timeline .comment-thread').first().waitFor();assert.equal(await page.locator('.comment-reply').count(),3);
  const shared=(await api('share',{iteration:iid,client_emails:['thread-client@example.test']})).links[0],client=await browser.newContext(),viewer=await client.newPage();viewer.on('pageerror',e=>errors.push(e.message));await viewer.goto(shared.url);await viewer.locator('[data-action=feedback]').first().click();const clientThread=viewer.locator(`[data-thread-id="${first.id}"]`);await clientThread.getByRole('button',{name:'Reply',exact:true}).click();await clientThread.locator('textarea').fill('Thank you, that works for us');await clientThread.getByRole('button',{name:'Post reply',exact:true}).click();await viewer.getByText('Thank you, that works for us',{exact:true}).waitFor();
  const deck=await api('project&id='+p.project_id),clientReply=deck.comments.find(c=>c.body==='Thank you, that works for us');assert.equal(clientReply.parent_id,first.id);assert.equal(clientReply.unread,true);await api('read_comments',{ids:[clientReply.id]});assert.equal((await api('project&id='+p.project_id)).comments.find(c=>c.id===clientReply.id).unread,false);
  execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);recipients=c.execute('SELECT email FROM email_outbox WHERE comment_id=?',(sys.argv[2],)).fetchall();assert recipients;assert all(r[0]!='thread-client@example.test' for r in recipients)`,db,clientReply.id]);
  const bearer={Authorization:'Bearer '+shared.url.split('/#/view/')[1]};
  await api('save_profile',{name:'Designer',email_comments:false});
  const quietReply=await request('comment',{iteration:iid,slide:'intro',parent_id:first.id,body:'Reply with email disabled'},bearer,200,client);
  execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);assert c.execute('SELECT count(*) FROM email_outbox WHERE comment_id=?',(sys.argv[2],)).fetchone()[0]==0`,db,quietReply.id]);
  await api('save_profile',{name:'Designer',email_comments:true});await request('comment',{iteration:other.iteration_id,slide:'intro',parent_id:first.id,body:'Access denied'},bearer,403,client);
  await api('revoke_share',{id:shared.id});await request('comment',{iteration:iid,slide:'intro',parent_id:first.id,body:'Revoked'},bearer,403,client);await client.close();
  // More than one page of roots, with a reply to a root on each page.
  execFileSync('python3',['-c',`import sqlite3,sys,uuid
c=sqlite3.connect(sys.argv[1]);iid=sys.argv[2]
for n in range(101):
 root=iid+'-page-root-'+str(n);c.execute('INSERT INTO comments(id,iteration_id,slide,author,body,created_at) VALUES(?,?,?,?,?,?)',(root,iid,'intro','test@example.test',str(n),'2020-01-01T00:00:00Z'))
 if n in [0,100]:c.execute('INSERT INTO comments(id,iteration_id,parent_id,slide,author,body,created_at) VALUES(?,?,?,?,?,?,?)',(iid+'-page-reply-'+str(n),iid,root,'intro','test@example.test','Reply','2021-01-01T00:00:00Z'))
c.commit()`,db,other.iteration_id]);
  const feed=await api('comments_feed&sort=oldest&project_id='+other.project_id);assert.equal(feed.items.length,101);assert.equal(feed.next_offset,100);assert.equal(feed.has_more,true);assert.equal(feed.items[1].parent_id,feed.items[0].id);
  const next=await api('comments_feed&sort=oldest&project_id='+other.project_id+'&offset='+feed.next_offset);assert.equal(next.items.length,2);assert.equal(next.has_more,false);assert.equal(next.items[1].parent_id,next.items[0].id);
  await page.goto(`${base}/${session.studio.id}/projects/${other.project_id}?tab=comments`);await page.locator('.comment-thread').first().waitFor();assert.equal(await page.locator('.comment-thread').count(),100);await page.getByRole('button',{name:'Load more',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.comment-thread').length===101);
  const last=page.locator('.comment-thread').last();await last.getByRole('button',{name:'Reply',exact:true}).click();await last.locator('textarea').fill('Reply on the second page');await last.getByRole('button',{name:'Post reply',exact:true}).click();await page.getByText('Reply on the second page',{exact:true}).waitFor();assert.equal(await page.locator('.comment-thread').count(),101);
  const deletion=await api('prepare_delete_project',{project_id:p.project_id});await api('delete_project',{project_id:p.project_id,confirmation:deletion.confirmation,name:'Threaded conversations',acknowledged:true});
  execFileSync('python3',['-c',`import sqlite3,sys
c=sqlite3.connect(sys.argv[1]);assert not c.execute('PRAGMA foreign_key_check').fetchall();assert c.execute('SELECT count(*) FROM comments WHERE iteration_id=?',(sys.argv[2],)).fetchone()[0]==0`,db,iid]);
  assert.deepEqual(errors,[]);console.log('PASS one-level replies, oldest-first ordering, client/studio replies, persistence, desktop/mobile, unread state, access boundaries, complete-thread pagination and deletion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
