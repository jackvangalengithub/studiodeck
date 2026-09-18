// Fully fictional API fixtures; no account, email, or external service is used.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {demoRequest} from '../public/assets/demo.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const loginCopy={};for(const language of ['en','nl']){const php=await readFile(new URL('../app/languages/'+language+'.php',import.meta.url),'utf8');loginCopy[language]=Object.fromEntries(Object.entries(JSON.parse(php.split("<<<'JSON'\n")[1].split('\nJSON,')[0])).filter(([key])=>key.startsWith('login_')));}
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname,file=path.startsWith('/assets/')||path.startsWith('/auth/')?resolve(root,'.'+path):resolve(root,path==='/login'?'auth/login.html':'index.html');
 if(!file.startsWith(root))throw Error();
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream');
 if(path==='/login'){let html=await readFile(file,'utf8');html=html.replace('{{login_translations}}',JSON.stringify(loginCopy));html=html.replace(/\{\{(login_\w+)\}\}/g,(_,key)=>loginCopy.en[key]);res.end(html);}else res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
 const page=await browser.newPage({reducedMotion:'reduce',viewport:{width:1360,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const deck=await demoRequest('project',{id:'van-galen'});
 Object.assign(deck,{slides:[],slide_content:[],slide_layout:[],slide_sections:[],slide_groups:{story:'The story',budget:'The budget',questions:'Open questions'},can_edit:true,branding:{},profile:{name:'Client',language:'',email_comments:true},open_questions:[{id:'q1',question:'Keep this English question?',kind:'clarification',published:1,replies:[]}]});
 Object.assign(deck.project,{language:'',studio_language:'nl'});
 deck.budget[0].is_optional=1;
 const studio={id:'studio-a',name:'Language studio',role:'admin',language:'nl'};
 const session={user:{id:'user',name:'Client',profile:deck.profile},csrf:'fixture',studio,studios:[studio],studio_theme:{},capabilities:{ai:false,mail:false}};
 const saved=[];
 await page.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin!==base){await route.abort();return;}
  if(url.pathname!=='/api.php'){await route.continue();return;}
  const action=url.searchParams.get('action');let body={};if(request.method()==='POST'&&request.headers()['content-type']?.includes('json'))body=request.postDataJSON();
  const replies={project_access:{reason:'ready'},project_starting_pack:{snapshot:'test',available_slides:[]},session,project:deck,deck,projects:{projects:[]},profile:{profile:deck.profile},client_project:{share_id:'share',project_id:deck.project.id},read_comments:{ok:true},view_event:{ok:true}};
  if(action==='save_profile'){Object.assign(deck.profile,body);saved.push([action,body]);replies[action]={profile:deck.profile};}
  if(action==='studio_theme'){studio.language=body.language;deck.project.studio_language=body.language;saved.push([action,body]);replies[action]={studio_theme:{}};}
  if(action==='save_slide'){
   const fields=Object.fromEntries([...request.postData().matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)].map(m=>[m[1],m[2]]));
   assert.equal(fields.type,'text');assert.equal(fields.title,'Keep <my> English title');assert.equal(fields.description,'My own design notes.');
   deck.slides.push({id:'manual-text',manual:1,type:fields.type,title:fields.title,description:fields.description,section:fields.section,position:999,metadata:{}});
   saved.push([action,fields]);replies[action]={id:'manual-text'};
  }
  if(action==='project_settings'){
   const lang=request.postData().match(/name="language"\r\n\r\n([^\r]*)/)?.[1];assert.notEqual(lang,undefined);deck.project.language=lang;saved.push([action,{language:lang}]);replies[action]={ok:true};
  }
  if(!(action in replies)){errors.push('Unexpected API request: '+action);await route.fulfill({status:500,json:{error:action}});return;}
  await route.fulfill({json:replies[action]});
 });
 await page.goto(base+'/login');assert.equal(await page.locator('select').count(),0);assert.equal(await page.locator('h1').innerText(),'Welcome to Studiodeck.');
 await page.evaluate(()=>localStorage.setItem('studiodeck.loginLanguage','nl'));await page.reload();assert.equal(await page.locator('h1').innerText(),'Welkom bij Studiodeck.');
 const clientUrl=`${base}/client/projects/van-galen`;
 await page.goto(clientUrl);await page.locator('.presentation').waitFor();
 assert.equal(await page.locator('html').getAttribute('lang'),'nl');
 assert.equal(await page.locator('.slide-heading').innerText(),'Een plek om\nthuis te komen.');
 assert.ok(await page.getByRole('button',{name:'Projectdocumenten',exact:true}).isVisible());
 assert.ok(await page.getByRole('button',{name:/^Het verhaal/}).isVisible());
 assert.ok((await page.locator('.slide-description').innerText()).includes('A considered home.'));
 await page.getByRole('button',{name:/^De begroting/}).click();
 assert.equal(await page.locator('.slide-heading').innerText(),'De investering');
 assert.ok(await page.getByText('Deze optie opnemen in mijn budget').isVisible());
 assert.match(await page.locator('[data-budget-total]').innerText(),/\./);
 await page.getByRole('button',{name:'Je account'}).click();await page.getByRole('button',{name:'Je profiel',exact:true}).click();
 await page.locator('[name=language]').selectOption('en');await page.getByRole('button',{name:'Profiel opslaan'}).click();
 await page.waitForFunction(()=>document.documentElement.lang==='en');
 assert.equal(await page.locator('.slide-heading').innerText(),'The investment');
 await page.getByRole('button',{name:'Close dialog'}).click();await page.reload();await page.locator('.presentation').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 // Project English overrides studio Dutch when the user inherits.
 deck.profile.language='';deck.project.language='en';await page.goto(clientUrl);await page.locator('.presentation').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 // A project's studio controls client language even with a different active studio.
 deck.project.language='';studio.language='en';await page.reload();await page.locator('.presentation').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'nl');
 await page.getByRole('button',{name:/^Openstaande vragen/}).click();assert.ok(await page.getByRole('heading',{name:'Keep this English question?'}).isVisible());
 await page.getByRole('button',{name:'Voeg je vraag toe'}).click();assert.ok(await page.getByLabel('Wat wil je verduidelijken?').isVisible());await page.getByRole('button',{name:'Venster sluiten'}).click();
 await page.locator('.comment-balloon').click();assert.ok(await page.getByLabel('Schrijf een reactie').isVisible());await page.getByRole('button',{name:'Venster sluiten'}).click();
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Je account'}).click();await page.getByRole('button',{name:'Je profiel',exact:true}).click();
 await page.getByLabel('Jouw taal').waitFor();assert.ok(await page.getByLabel('Jouw taal').isVisible());assert.ok(await page.locator('.modal').evaluate(el=>el.getBoundingClientRect().right<=innerWidth));
 await page.screenshot({path:'/tmp/studiodeck-dutch-profile.png'});
 // Studio and project settings submit and persist language, including reset to inheritance.
 await page.setViewportSize({width:1360,height:950});await page.goto(`${base}/studio-a/settings`);await page.locator('[data-form=studio-theme]').waitFor();
 await page.locator('[data-form=studio-theme] [name=language]').selectOption('nl');await page.getByRole('button',{name:'Save studio settings'}).click();await page.locator('.modal').waitFor({state:'hidden'});
 assert.equal(saved.at(-1)[1].language,'nl');
 await page.goto(`${base}/studio-a/projects/van-galen`);await page.getByRole('button',{name:'Projectinstellingen',exact:true}).click();
 await page.locator('[data-form=project-settings] [name=language]').selectOption('en');await page.getByRole('button',{name:'Instellingen opslaan',exact:true}).click();await page.locator('.modal').waitFor({state:'hidden'});
 assert.equal(saved.at(-1)[1].language,'en');
 // The workspace follows studio/personal preferences, even for an English presentation.
 assert.equal(await page.locator('html').getAttribute('lang'),'nl');
 assert.equal(await page.locator('.project-head h1').innerText(),deck.project.name);
 assert.ok(await page.getByRole('button',{name:'Alle projecten',exact:true}).isVisible());
 await page.locator('.tabs [data-tab=slides]').click();
 assert.ok(await page.getByRole('heading',{name:'De presentatie voor je opdrachtgever'}).isVisible());
 await page.locator('[data-slide-filter-open]').click();
 assert.ok(await page.getByRole('heading',{name:'Diatypen filteren'}).isVisible());
 assert.ok(await page.getByText('Tekst',{exact:true}).isVisible());
 await page.locator('.modal [data-action=close-modal]').first().click();
 await page.locator('[data-action=add-slide]').click();
 assert.equal(await page.locator('.modal h2').innerText(),'Dia toevoegen');
 assert.ok(await page.locator('[data-form=slide-editor] [name=type] option[value=text]').innerText()==='Tekst');
 await page.locator('[data-form=slide-editor] [name=type]').selectOption('text');
 await page.locator('[data-form=slide-editor] [name=title]').fill('Keep <my> English title');
 await page.locator('[data-form=slide-editor] [name=description]').fill('My own design notes.');
 await page.locator('[data-form=slide-editor] button[type=submit]').click();await page.locator('.modal').waitFor({state:'hidden'});
 assert.equal(saved.at(-1)[0],'save_slide');
 assert.ok(await page.getByRole('heading',{name:'Keep <my> English title',exact:true}).isVisible());
 assert.equal(await page.locator('my').count(),0);
 await page.locator('.tabs [data-tab=files]').click();assert.ok(await page.getByRole('button',{name:'Bestanden uploaden',exact:true}).isVisible());
 await page.locator('.tabs [data-tab=people]').click();assert.ok(await page.getByRole('heading',{name:'Teamleden',exact:true}).isVisible());
 await page.locator('[data-action=profile]').click();await page.locator('[name=language]').selectOption('en');await page.locator('[data-form=profile] button[type=submit]').click();
 await page.waitForFunction(()=>document.documentElement.lang==='en');
 assert.ok(await page.getByRole('button',{name:'All projects',exact:true}).isVisible());
 await page.reload();await page.locator('[data-form=profile]').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 await page.locator('[name=language]').selectOption('');await page.locator('[data-form=profile] button[type=submit]').click();
 await page.waitForFunction(()=>document.documentElement.lang==='nl');
 await page.goto(`${base}/studio-a/projects/van-galen`);await page.locator('.tabs [data-tab=slides]').click();await page.locator('[data-slide-filter-open]').click();assert.ok(await page.getByText('Tekst',{exact:true}).isVisible());await page.locator('.modal [data-action=close-modal]').first().click();
 await page.screenshot({path:'/tmp/studiodeck-dutch-editor.png'});
 await page.goto(clientUrl);await page.locator('.presentation').waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');
 assert.deepEqual(errors,[]);console.log('PASS Dutch workspace/editor, live language changes, personal overrides, client views, inheritance, user override, reloads, studio/project settings, content preservation, mobile profile.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
