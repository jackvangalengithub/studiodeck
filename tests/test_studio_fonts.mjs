// Fictional studio API; no external services or account changes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,extname} from 'node:path';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('public');
const server=createServer(async(req,res)=>{
 try{
  const path=new URL(req.url,'http://localhost').pathname;
  const file=path.startsWith('/assets/')?resolve(root,'.'+path):resolve(root,'index.html');
  if(!file.startsWith(root+'/'))throw Error('Invalid path');
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],saved=[];
 const studio={id:'font-studio',name:'Font studio',role:'admin',language:'en',business_type:'interior',setup_completed_at:'2026-09-21T12:00:00Z'};
 let theme={palette:'warmgray',style:'editorial',font:'serif'};
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api.php?**',async route=>{
  const action=new URL(route.request().url()).searchParams.get('action');let result;
  if(action==='session')result={user:{id:'admin',name:'Designer'},csrf:'test',studio,studios:[studio],studio_theme:theme,capabilities:{}};
  else if(action==='projects')result={projects:[]};
  else if(action==='studio_theme'){const body=route.request().postDataJSON();saved.push(body);theme=body.theme;result={studio_theme:theme};}
  else throw Error('Unexpected API call: '+action);
  await route.fulfill({json:result});
 });
 const settings=async()=>{await page.goto(base+'/font-studio/settings');await page.locator('[data-form=studio-theme]').waitFor();};
 const headingFont=()=>page.locator('h1').first().evaluate(el=>getComputedStyle(el).fontFamily);
 await settings();assert(await page.getByRole('radio',{name:/Classic serif/}).isChecked());
 assert.equal(await page.locator('[name=font]').count(),2);assert.match(await headingFont(),/Georgia/);
 await page.getByRole('radio',{name:/Modern sans/}).check();
 await page.getByRole('button',{name:'Save studio settings',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(saved.at(-1).theme.font,'sans');assert.match(await headingFont(),/DM Sans/);
 await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.fonts.check('24px "DM Sans"')));
 await page.reload();await page.locator('h1').waitFor();assert.match(await headingFont(),/DM Sans/);
 await settings();assert(await page.getByRole('radio',{name:/Modern sans/}).isChecked());
 assert.match(await page.locator('#modal-title').evaluate(el=>getComputedStyle(el).fontFamily),/DM Sans/);
 await page.getByRole('radio',{name:/Classic serif/}).check();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(saved.length,1);assert.match(await headingFont(),/DM Sans/);
 await page.setViewportSize({width:390,height:844});await settings();
 assert(await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;}));
 await page.locator('.studio-font-options').screenshot({path:'/tmp/studiodeck-font-options-mobile.png'});
 await page.getByRole('radio',{name:/Classic serif/}).focus();await page.keyboard.press('Space');
 await page.getByRole('button',{name:'Save studio settings',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
 assert.equal(saved.at(-1).theme.font,'serif');assert.match(await headingFont(),/Georgia/);
 studio.language='nl';await settings();assert(await page.getByText('Letterstijl',{exact:true}).isVisible());assert(await page.getByRole('radio',{name:/Modern zonder schreef/}).isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS Both heading fonts, persistence, modal typography, cancel, keyboard selection, mobile layout and Dutch labels');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
