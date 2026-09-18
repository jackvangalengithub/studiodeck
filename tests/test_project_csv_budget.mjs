/** File preview and sticky project budget checks with an isolated mocked API.
 * node --test tests/test_project_csv_budget.mjs
 * Requires Playwright/Chromium; optional PLAYWRIGHT_MODULE and CHROMIUM_PATH.
 */
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
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
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(done=>server.close(done));});

test('CSV and image previews and project budget totals work on desktop and mobile',async t=>{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
 const studio={id:'preview-studio',name:'Preview studio',role:'admin'},data=structuredClone(template);
 data.budget=Array.from({length:35},(_,i)=>({...data.budget[0],id:'cost-'+i,label:'Cost '+i,parent_id:null}));
 let csv='Name;Note;Price\r\nOak;"Quoted; value";12,50\r\nPine;"Line one\nLine two";25',fail=false,brokenImage=false;
 const imageData=await readFile(resolve(root,'assets/interior.webp'));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==base)return route.abort();
  if(url.pathname!=='/api.php')return route.continue();
  const action=url.searchParams.get('action');
  if(action==='file'){
   requests.push({id:url.searchParams.get('id'),iteration:url.searchParams.get('iteration'),studio:route.request().headers()['x-studio-id']});
   if(url.searchParams.get('id').startsWith('v-living'))return route.fulfill({status:fail?403:200,contentType:'image/webp',body:fail||brokenImage?'Unavailable':imageData});
   return route.fulfill({status:fail?403:200,contentType:'text/csv',body:fail?'Unavailable':csv});
  }
  let response;
  if(action==='session')response={user:{id:'test-user',name:'Test user'},csrf:'test-csrf',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:false,mail:false}};
  else if(action==='projects')response={projects:[{...data.project,iteration:data.iteration,can_edit:true}]};
  else if(action==='project')response=data;
  else if(action==='billing')response={};
  else if(action==='project_access')response={reason:'ready'};
  else throw Error('Unexpected API request: '+action);
  await route.fulfill({json:response});
 });
 const project=`${base}/${studio.id}/projects/${data.project.id}`;
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:844});
  await page.goto(project+'?tab=files');
  await page.getByRole('button',{name:'Preview CSV',exact:true}).click();
  await page.locator('.csv-preview-table').waitFor();
  assert.equal(await page.locator('.csv-preview-table tbody tr').count(),2);
  assert.equal(await page.locator('.csv-preview-table tbody tr').first().locator('td').nth(1).innerText(),'Quoted; value');
  assert.equal(await page.locator('.csv-preview-table tbody tr').nth(1).locator('td').nth(1).innerText(),'Line one\nLine two');
  assert.ok(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  assert.deepEqual(requests.at(-1),{id:'v-budget-2',iteration:data.iteration.id,studio:studio.id});
  await page.screenshot({path:`/tmp/studiodeck-csv-${width}.png`});
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.locator('[data-action="preview-image"][data-id="v-living-2"]').click();
  const image=page.locator('.image-preview-dialog img');await image.waitFor();
  assert.ok(await image.evaluate(el=>el.complete&&el.naturalWidth>0));
  assert.equal(await image.getAttribute('alt'),data.files.find(f=>f.id==='v-living-2').name);
  assert.deepEqual(requests.at(-1),{id:'v-living-2',iteration:data.iteration.id,studio:studio.id});
  assert.ok(await page.locator('.modal').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  const imageBox=await image.boundingBox();assert.ok(imageBox.width<=width&&imageBox.height<844);
  await page.screenshot({path:`/tmp/studiodeck-image-${width}.png`});
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.goto(project+'?tab=budget');
  await page.locator('.budget-sticky-summary').waitFor();
  await page.evaluate(()=>window.scrollTo(0,900));
  await page.waitForFunction(()=>window.scrollY>500);
  const summary=await page.locator('.budget-sticky-summary').boundingBox();
  assert.ok(Math.abs(summary.y)<2,'Budget summary stays at top of viewport');
  const total=await page.locator('[data-budget-total]').boundingBox();
  assert.ok(total.y>=0&&total.y+total.height<844,'Total remains visible');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`/tmp/studiodeck-sticky-budget-${width}.png`});
 }
 await page.goto(project+'?tab=files');
 await page.locator('[data-action="history"][data-id="v-living-2"]').click();
 await page.locator('.history-item').last().getByRole('button',{name:'Preview image',exact:true}).click();
 await page.locator('.image-preview-dialog img').waitFor();assert.equal(requests.at(-1).id,'v-living-1');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 brokenImage=true;await page.locator('[data-action="preview-image"][data-id="v-living-2"]').click();
 await page.getByText('This image preview is unavailable. Please try again.',{exact:true}).waitFor();
 assert.ok(await page.getByRole('dialog').getByRole('button',{name:'Download original',exact:true}).isVisible());
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();brokenImage=false;
 await page.locator('.file-group').filter({has:page.getByRole('button',{name:'Preview CSV',exact:true})}).getByRole('button',{name:'Version history',exact:true}).click();
 await page.locator('.history-item').last().getByRole('button',{name:'Preview CSV',exact:true}).click();
 await page.locator('.csv-preview-table').waitFor();assert.equal(requests.at(-1).id,'v-budget-1');
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 csv='';await page.getByRole('button',{name:'Preview CSV',exact:true}).click();
 await page.getByText('This CSV file is empty.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 fail=true;await page.getByRole('button',{name:'Preview CSV',exact:true}).click();
 await page.getByText('This CSV preview is unavailable. Please try again.',{exact:true}).waitFor();
 assert.ok(await page.getByRole('dialog').getByRole('button',{name:'Download original',exact:true}).isVisible());
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await page.locator('[data-action="preview-image"][data-id="v-living-2"]').click();
 await page.getByText('This image preview is unavailable. Please try again.',{exact:true}).waitFor();
});
