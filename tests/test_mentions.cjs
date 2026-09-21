/* Isolated communication fixture; emails are logged, never delivered. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.COMMUNICATION_BASE||'http://127.0.0.1:18496';
const mail=process.env.COMMUNICATION_MAIL_LOG||'/tmp/studiodeck-communication-browser/mail.jsonl';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 const errors=[];
 async function account(session){const ctx=await browser.newContext({viewport:{width:1440,height:1000}});if(session)await ctx.addCookies([{name:'studiodeck_session',value:session,url:base}]);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));return p;}
 async function api(page,action,body){return page.evaluate(async({action,body})=>{const session=await (await fetch('/api.php?action=session')).json();const r=await fetch('/api.php?action='+action,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-CSRF-Token':session.csrf}:{},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(await r.text());return r.json();},{action,body});}
 const page=await account('editor'),client=await account('client');
 try{
  await page.goto(base+'/studio-a/profile');
  await page.locator('[name=email_mentions_only]').selectOption('1');
  await page.locator('[data-form=profile] button[type=submit]').click();
  await page.getByText('Profile saved.',{exact:true}).waitFor();
  await page.reload();assert.equal(await page.locator('[name=email_mentions_only]').inputValue(),'1');
  assert.equal((await api(page,'profile')).profile.email_mentions_only,true);
  await client.goto(base+'/choose');await api(client,'save_profile',{name:'Client',email_comments:true,email_mentions_only:true});
  await page.goto(base+'/studio-a/projects/shared?iteration=iteration-shared&tab=comments');
  await page.waitForLoadState('networkidle');
  const input=page.locator('#comm-reply');await input.fill('@');
  await page.locator('#mention-picker [role=option]').last().waitFor();
  assert.equal(await page.locator('#mention-picker [role=option]').count(),4);
  assert.equal(await page.getByRole('option').filter({hasText:'Painter without email'}).getAttribute('aria-disabled'),'true');
  assert.match(await page.getByRole('option').filter({hasText:'Bakker Joinery'}).textContent(),/Invite to this conversation/);
  await input.fill('Hello @Cli');
  await page.getByRole('option',{name:'Client client@example.test'}).waitFor();
  assert.equal(await page.locator('#mention-picker [role=option]').count(),2);
  assert(!await page.locator('#mention-picker').getByText('Bakker Joinery').count());
  await input.press('ArrowDown');await input.press('ArrowUp');await input.press('Enter');
  assert.equal(await input.inputValue(),'Hello @Client ');
  await input.press('End');
  await input.type('please check <script>alert(1)</script>.');
  await page.locator('#comm-reply-form button[type=submit]').click();
  await page.locator('.chat-mention').filter({hasText:'@Client'}).waitFor();
  assert(await page.getByText('Hello @Client please check <script>alert(1)</script>.',{exact:true}).isVisible());
  const deck=await api(page,'project&id=shared&iteration=iteration-shared');
  const c=deck.comments.find(c=>c.body.startsWith('Hello @Client'));
  assert.deepEqual(c.mentions,[{email:'client@example.test',label:'Client'}]);

  // Moving a draft into the confirmation dialog preserves the selected identity.
  await input.fill('Could @Cli');await page.getByRole('option',{name:'Client client@example.test',exact:true}).click();
  await page.locator('[data-action=comm-ask]').click();
  assert.equal(await page.locator('#comm-confirmation-form [name=body]').inputValue(),'Could @Client ');
  await page.locator('#comm-confirmation-form button[type=submit]').click();
  await page.locator('.comm-confirmation .chat-mention').waitFor();

  // At a narrow viewport the picker stays within the screen; Escape closes only it.
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-action=comm-new]').click();
  await page.waitForFunction(()=>document.activeElement?.matches('.modal [data-action=close-modal]'));
  const modalInput=page.locator('#comm-thread-form [name=body]');await modalInput.fill('@');
  await page.locator('#mention-picker').waitFor();const bounds=await page.locator('#mention-picker').boundingBox();
  assert(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0&&bounds.y+bounds.height<=844);
  await modalInput.press('Escape');assert.equal(await page.locator('#mention-picker').count(),0);
  assert(await page.locator('#comm-thread-form').isVisible());
  await page.locator('[data-action=close-modal]').last().click();

  // Invite a guest, then exercise the same picker with their restricted account.
  await input.fill('Please join @Bak');
  await page.getByRole('option').filter({hasText:'Bakker Joinery'}).click();
  assert.match(await page.locator('#comm-reply-form .mention-hint').textContent(),/including earlier messages/);
  const sent=page.waitForResponse(r=>r.url().includes('action=communication_post')&&r.request().method()==='POST');
  await page.locator('#comm-reply-form button[type=submit]').click();
  const root=(await (await sent).json()).id;
  await page.locator('.comm-guests').filter({hasText:'Bakker Joinery'}).waitFor();
  let invitation;for(let n=0;n<80;n++){if(fs.existsSync(mail))invitation=fs.readFileSync(mail,'utf8').trim().split('\n').map(JSON.parse).findLast(m=>m.to==='trade@example.test');if(invitation)break;await new Promise(r=>setTimeout(r,150));}
  assert(invitation);const token=invitation.text.match(/#\/login\/([a-f0-9]{64})/)[1];
  const guest=await account();await guest.goto(base+'/login#/login/'+token);await guest.locator('#guest-reply').waitFor();
  const guestInput=guest.locator('#guest-reply textarea');await guestInput.fill('@');
  await guest.locator('#mention-picker [role=option]').waitFor();
  assert.equal(await guest.locator('#mention-picker [role=option]').count(),1);
  assert.match(await guest.locator('#mention-picker').textContent(),/editor@example.test/);
  await guestInput.press('Enter');await guestInput.type('please review.');
  await guest.locator('#guest-reply button[type=submit]').click();
  await guest.locator('.chat-mention').filter({hasText:'@editor'}).waitFor();
  assert.equal((await api(guest,'conversation&id='+root)).comments.at(-1).mentions[0].email,'editor@example.test');
  assert.deepEqual(errors,[]);
  console.log('Mentions browser checks passed: profile persistence, keyboard and pointer selection, escaping, confirmation drafts, mobile dialog and scoped guests.');
 }catch(error){await page.screenshot({path:'/tmp/studiodeck-communication-browser/mentions-failure.png',fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
