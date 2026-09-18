// Real app UI with an isolated mock API. No email, invitations or project edits outside the fixture.
// PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_PATH=/path/to/chrome node --test tests/test_project_clients.mjs
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {demoRequest} from '../public/assets/demo.js';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const template=await demoRequest('project',{id:'van-galen'});
let server,browser,base;
before(async()=>{
 server=createServer(async(req,res)=>{
  try{
   const path=new URL(req.url,'http://localhost').pathname;
   const file=path.startsWith('/assets/')?resolve(root,'.'+path):resolve(root,'index.html');
   if(!file.startsWith(root)){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream');
   res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
 base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(done=>server.close(done));});

async function setup(t,{width=1440,empty=false,editable=true,rejectShare=false}={}){
 const page=await browser.newPage({viewport:{width,height:950}});page.setDefaultTimeout(6000);
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
 t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
 const studio={id:'client-test-studio',name:'Test studio',role:'member'};
 const deck={...structuredClone(template),project:{...template.project,id:'client-test-project',name:'Client selection',studio_id:studio.id},
  iteration:{...template.iteration,id:'client-test-iteration',project_id:'client-test-project',number:1,status:'draft'},
  clients:empty?[]:[{name:'Alice <A>',email:'alice@example.test'},{name:'Bob',email:'bob@example.test'}],
  can_edit:editable,members:[],files:[],slides:[],budget:[],comments:[],events:[],jobs:[],shares:[],contacts:[],
  slide_content:[],slide_layout:[],slide_sections:[],slide_groups:{story:'Story'},capabilities:{ai:false,mail:false}};
 deck.iterations=[deck.iteration];
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base){await route.abort();return;}
  if(url.pathname!=='/api.php'){await route.continue();return;}
  const action=url.searchParams.get('action'),data=route.request().postDataJSON();calls.push({action,data});
  let result,status=200;
  if(action==='session')result={user:{id:'editor',name:'Editor',email:'editor@example.test'},csrf:'test-csrf',studio,studios:[studio],capabilities:deck.capabilities};
  else if(action==='projects')result={projects:[{...deck.project,iteration:deck.iteration,can_edit:editable}]};
  else if(action==='project')result=deck;
  else if(action==='share'){
   if(rejectShare){status=409;result={error:'A selected client is no longer a member of this project. Refresh and choose again.'};}
   else {deck.iteration.status='shared';result={links:data.client_emails.map(email=>({id:email,email,sent:false,url:base+'/#/view/test-token'}))};}
  }else if(action==='save_project_client'){
   const old=deck.clients.find(c=>c.email===data.email);if(old)old.name=data.name;else deck.clients.push({name:data.name,email:data.email});result={clients:deck.clients};
  }else if(action==='remove_project_client'){deck.clients=deck.clients.filter(c=>c.email!==data.email);result={clients:deck.clients};}
  else if(action==='drive_status')result={configured:false,connected:false};
  else {errors.push('Unexpected API call: '+action);status=500;result={error:'Unexpected API call'};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto(`${base}/${studio.id}/projects/${deck.project.id}`);
 await page.locator('.project-clients-inline').waitFor();
 return {page,calls,deck};
}

for(const width of [1440,390])test(`All clients default selected; sends only checked recipients at ${width}px`,async t=>{
 const {page,calls}=await setup(t,{width});
 await page.locator('.project-head [data-action=share]').click();
 const form=page.locator('[data-form=share]');await form.waitFor();
 assert.equal(await form.locator('[name=client_email]:checked').count(),2);
 assert.equal(await form.locator('textarea[name=emails]').count(),0);
 assert.equal(await form.locator('a').count(),0,'Client names are escaped');
 const message=form.locator('[name=message]');await message.fill('Please review this iteration.');
 await form.getByRole('button',{name:'Clear selection',exact:true}).click();
 assert.ok(await form.locator('[type=submit]').isDisabled());
 await form.getByRole('button',{name:'Select all',exact:true}).click();
 assert.equal(await form.locator('[name=client_email]:checked').count(),2);
 await form.locator('[value="bob@example.test"]').uncheck();
 assert.ok(await form.locator('[type=submit]').isEnabled());
 assert.equal(await message.inputValue(),'Please review this iteration.');
 assert.ok(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 if(process.env.TEST_SCREENSHOT_DIR){
  await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});
  await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`client-selection-${width}.png`)});
 }
 await form.locator('[type=submit]').click();
 await page.locator('.link-result').waitFor();
 assert.equal(await page.locator('.link-result').count(),1);
 assert.deepEqual(calls.find(c=>c.action==='share').data,{iteration:'client-test-iteration',client_emails:['alice@example.test'],message:'Please review this iteration.'});
 await page.getByRole('button',{name:'Done',exact:true}).click();
 if(process.env.TEST_SCREENSHOT_DIR)await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`project-actions-${width}.png`)});
 await page.locator('.project-head [data-action=share]').click();
 assert.equal(await page.locator('[name=client_email]:checked').count(),2,'Every new send starts with the whole client list selected');
});

test('Client management is independent of sending and supports add, edit and removal',async t=>{
 const {page,calls}=await setup(t,{empty:true});
 await page.locator('.project-head [data-action=share]').click();
 assert.match(await page.getByRole('dialog').innerText(),/Add your clients first/);
 await page.getByRole('dialog').getByRole('button',{name:'Manage clients',exact:true}).click();
 await page.getByRole('button',{name:'Add client',exact:true}).click();
 let form=page.locator('[data-form=project-client]');
 await form.locator('[name=name]').fill('Chris');await form.locator('[name=email]').fill('chris@example.test');
 await form.locator('[type=submit]').click();await page.locator('.project-client-row').waitFor();
 assert.equal(calls.filter(c=>c.action==='share').length,0);
 await page.getByRole('button',{name:'Edit Chris',exact:true}).click();
 form=page.locator('[data-form=project-client]');assert.ok(await form.locator('[name=email]').evaluate(el=>el.readOnly));
 await form.locator('[name=name]').fill('Chris Updated');await form.locator('[type=submit]').click();
 await page.getByRole('button',{name:'Remove Chris Updated',exact:true}).click();
 const removal=page.locator('[data-form=remove-project-client]');await removal.waitFor();
 assert.match(await page.getByRole('dialog').innerText(),/access to all its shared iterations will end/);
 await removal.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(calls.filter(c=>c.action==='remove_project_client').length,0);
 await page.locator('[data-action=project-clients]').click();
 await page.getByRole('button',{name:'Remove Chris Updated',exact:true}).click();
 await page.locator('[data-form=remove-project-client] [type=submit]').click();
 await page.getByRole('dialog').getByText('No client members yet.',{exact:false}).waitFor();
 assert.deepEqual(calls.find(c=>c.action==='remove_project_client').data,{project_id:'client-test-project',email:'chris@example.test'});
});

test('Read-only viewers cannot manage clients or send invitations',async t=>{
 const {page}=await setup(t,{editable:false});
 assert.equal(await page.locator('[data-action=project-clients],[data-action=share]').count(),0);
 assert.match(await page.locator('.project-clients-inline').innerText(),/Alice <A>/);
});

test('A stale selection shows the server error and preserves the message',async t=>{
 const {page}=await setup(t,{rejectShare:true});
 await page.locator('.project-head [data-action=share]').click();
 const form=page.locator('[data-form=share]');await form.locator('[name=message]').fill('Keep this message');
 await form.locator('[type=submit]').click();await form.locator('.form-error').waitFor();
 assert.match(await form.locator('.form-error').innerText(),/no longer a member/);
 assert.equal(await form.locator('[name=message]').inputValue(),'Keep this message');
 assert.equal(await form.locator('[name=client_email]:checked').count(),2);
});
