import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {schema} from '../public/assets/platform/schema.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseURL=process.env.STUDIODECK_TEST_URL||'http://localhost:8199';
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});});
after(async()=>browser?.close());
async function fixture(t,{withImages=false}={}){
 const page=await browser.newPage(),errors=[],requests=[],batches=[];page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
 const controls={batchGate:null,imageGate:null,failNext:false},wireBatches=[];
 const studioId='85c6b0cc-eb61-3adb-3b2c-8e0db4f63d25';
 const tables={users:[{id:'u1',name:'Jack',email:'jack@example.com'}],studios:[{id:'s0',name:'Other Studio'},{id:studioId,name:'Test Studio',theme:{},language:'en',setup_completed_at:'2026-01-01'}],projects:[{id:'p0',studio_id:'s0',name:'Other project',archived:false},{id:'p1',studio_id:studioId,name:'Garden project',archived:false,theme:{},visibility:'team',created_at:'2026-01-01'}],iterations:[{id:'i1',project_id:'p1',number:1,title:'First concept',status:'draft',locked:false,theme:{}}],project_members:[{id:'m1',project_id:'p1',user_id:'u1'}]};
 if(withImages){
  tables.iteration_files=Array.from({length:6},(_,n)=>({id:'link'+n,iteration_id:'i1',asset_id:'asset'+n,version_id:'version'+n,category:'renders'}));
  tables.file_versions=Array.from({length:6},(_,n)=>({id:'version'+n,asset_id:'asset'+n,name:'Image '+n,mime:n===4?'application/pdf':'image/png',data_file_id:'file'+n,preview_file_id:n===4?null:'file'+n,parent_id:n===5?'older':null,number:2,metadata:{}}));
  tables.file_versions.push({id:'older',asset_id:'asset5',name:'Previous',mime:'image/png',data_file_id:'old-file',parent_id:'oldest',number:1},{id:'oldest',asset_id:'asset5',name:'First',mime:'image/png',data_file_id:'oldest-file',number:0});
  tables.presentation_slides=Array.from({length:6},(_,n)=>({id:'row'+n,slide_key:'slide'+n,iteration_id:'i1',source_version_id:'version'+n,type:'render',situation:'concept',title:'Picture '+n,position:n,page_number:n===4?1:0,image_number:n===4?1:0,image_version_id:n===5?'variant':null,metadata:{}}));
  tables.iteration_covers=[{id:'cover',iteration_id:'i1',slide_id:'slide0'}];
  tables.document_pages=[{id:'page',version_id:'version4',number:1,preview_file_id:'page-file',metadata:{}}];
  tables.document_images=[{id:'crop',version_id:'version4',page_number:1,number:1,data_file_id:'crop-file',metadata:{}}];
  tables.slide_image_versions=[{id:'variant',source_version_id:'version5',data_file_id:'variant-file'}];
 }
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());requests.push(url.pathname);
  if(url.pathname==='/whoami')return route.fulfill({json:{user_id:'u1',email:'jack@example.com',firstname:'Jack',lastname:'',tenants:[{id:200,companyname:'Test Studio'}],profiles:['studioadmin']}});
  if(url.pathname.startsWith('/200/userfiles/')){if(controls.imageGate)await controls.imageGate;return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>'});}
  if(url.pathname.endsWith('/batch')){
   wireBatches.push(req.postDataJSON());
   if(controls.batchGate)await controls.batchGate;
   if(controls.failNext){controls.failNext=false;return route.fulfill({status:503,json:{message:'Temporarily unavailable'}});}
   const wire=req.postDataJSON().flat(),outer=wire[0],complete=outer?.relative_url==='200/projects:readView',calls=complete?JSON.parse(outer.body).queries.map(q=>({...q,requestingId:q.id,method:'QUERY',relative_url:'200/'+q.resource,body:JSON.stringify(q.params)})):wire,outputs={},results=[];batches.push(calls);
   const subst=v=>{if(Array.isArray(v))return v.map(subst);if(typeof v!=='string')return v;const m=v.match(/^\{\{(\w+)\.entities\[(\d*)\]\.(\w+)\}\}$/);return m?(m[2]===''?(outputs[m[1]]||[]).map(r=>r[m[3]]).filter(x=>x!=null):outputs[m[1]]?.[+m[2]]?.[m[3]]):v;};
   const matches=(r,f)=>!f?.length?true:f[0]==='AND'?f.slice(1).every(s=>matches(r,s)):f[0]==='OR'?f.slice(1).some(s=>matches(r,s)):f[1]==='IN'?(f[2]||[]).includes(r[f[0]]):r[f[0]]===(typeof r[f[0]]==='boolean'&&['true','false'].includes(f[2])?f[2]==='true':f[2]);
   for(const call of calls){const [,table,id]=call.relative_url.split('/'),body=JSON.parse(call.body);if(table==='users:ensureIdentity'){outputs[call.requestingId]=[{id:'u1'}];results.push({responseid:call.id,code:200,body:{entities:[{id:'u1',tablename:'users',data:{id:'u1'}}],other:{id:'u1'}}});continue;}if(!schema[table]){errors.push('Unknown resource '+call.relative_url);results.push({responseid:call.id,code:404,body:{message:'Unknown table'}});continue;}if(call.method==='QUERY'){
     for(const key of body.selectList)if(!schema[table][key])errors.push('Unknown field '+table+'.'+key);
     const found=(tables[table]||[]).filter(r=>matches(r,subst(body.filter)));outputs[call.requestingId]=found;results.push({responseid:call.id,code:200,body:{entities:found.map(r=>({id:r.id,tablename:table,data:r,writablefields:Object.keys(r)})),other:{nextPage:null}}});
    }else{if(call.method==='POST')(tables[table]??=[]).push(body);else if(call.method==='PATCH')Object.assign(tables[table].find(r=>r.id===id),body);else tables[table]=(tables[table]||[]).filter(r=>r.id!==id);results.push({responseid:call.id,code:call.method==='DELETE'?204:201,body:{id:body.id||id,errors:[]}});}
   }return route.fulfill({json:complete?[{responseid:outer.id,code:200,body:{other:{results}}}]:results.reverse()});
  }
  if(url.pathname==='/api.php'){errors.push('Legacy API request');return route.fulfill({status:410,json:{error:'Retired'}});}
  await route.continue();
 });return {page,batches,requests,tables,controls,wireBatches};
}
test('workspace and project tabs load from platform tables without inactive-tab reads',async t=>{
 const {page,batches,requests}=await fixture(t);await page.goto(baseURL+'/200/projects/p1');await page.getByRole('heading',{name:'Garden project',exact:true}).first().waitFor();
 assert.equal(requests.filter(r=>r==='/whoami').length,1);const first=batches.flat().map(c=>c.relative_url);assert.ok(first.includes('200/projects'));assert.ok(!first.includes('200/slide_content'));assert.ok(!first.includes('200/contacts'));
 for(const tab of ['files','budget','people','slides','comments']){await page.locator(`.project-tabs [data-tab="${tab}"],.tab-bar [data-tab="${tab}"],nav [data-tab="${tab}"]`).first().click();await page.waitForTimeout(200);assert.equal(await page.locator('[role=alert]').count(),0,tab+': '+await page.locator('[role=alert]').allTextContents());}
 assert.ok(batches.flat().some(c=>c.relative_url==='200/document_pages'));assert.ok(batches.flat().every(c=>!c.relative_url.includes(':')||c.relative_url==='200/users:ensureIdentity'));
});
test('pin writes use project_pins and a failed integration never calls legacy routes',async t=>{
 const {page,batches}=await fixture(t);await page.goto(baseURL+'/200/projects');await page.getByText('Garden project',{exact:true}).first().waitFor();assert.equal(await page.getByText('Other project',{exact:true}).count(),0);await page.locator('.project-tile-actions summary').first().click();await page.locator('[data-action="pin-project"]').first().click();await page.waitForTimeout(200);assert.ok(batches.flat().some(c=>c.relative_url==='200/project_pins'&&c.method==='POST'));
});
test('project wizard creates rows in one transaction and opens the new project',async t=>{
 const {page,batches}=await fixture(t);await page.goto(baseURL+'/200/projects');await page.getByText('Garden project',{exact:true}).first().waitFor();await page.locator('[data-action="new-project"]').first().click();await page.locator('[data-action="wizard-details"]').click();await page.locator('[data-form="new-project"] [name="name"]').fill('New garden');await page.locator('[data-form="new-project"] [type="submit"]').click();await page.locator('[data-form="new-project-files"] [value="skip"]').click();await page.getByRole('heading',{name:'New garden',exact:true}).first().waitFor();
 const writes=batches.find(batch=>batch.some(r=>r.relative_url==='200/projects'&&r.method==='POST'));assert.ok(writes);assert.ok(writes.some(r=>r.relative_url==='200/iterations'&&r.method==='POST'));assert.ok(writes.some(r=>r.relative_url==='200/project_members'&&r.method==='POST'));
});


test('overview covers load from the list batch without per-project metadata requests',async t=>{
 const {page,wireBatches,requests}=await fixture(t,{withImages:true});
 await page.goto(baseURL+'/200/projects');
 const cover=page.locator('[data-project-cover="p1"]');await cover.waitFor();
 assert.equal(await cover.evaluate(im=>im.complete&&im.naturalWidth>0),true);
 const complete=wireBatches.flat(2).filter(c=>c.relative_url==='200/projects:readView');assert.equal(complete.length,1);
 assert.equal(requests.filter(p=>p==='/200/userfiles/file0').length,1);
 assert.equal(wireBatches.length,2,'one bootstrap and one list batch');
});

test('presentation tab uses one batch, parallel media, and commits only after images are ready',async t=>{
 const {page,controls,wireBatches,requests}=await fixture(t,{withImages:true});
 await page.goto(baseURL+'/200/projects/p1');await page.locator('nav [data-tab="overview"].active').waitFor();
 const before=wireBatches.length,start= requests.length;
 let releaseBatch,releaseImages;
 controls.batchGate=new Promise(resolve=>releaseBatch=resolve);
 controls.imageGate=new Promise(resolve=>releaseImages=resolve);
 t.after(()=>{releaseBatch();releaseImages();});
 await page.locator('nav [data-tab="slides"]').click();
 await page.waitForTimeout(100);
 assert.equal(await page.locator('nav [data-tab="overview"].active').count(),1);
 assert.equal(await page.locator('.slide-editor').count(),0);
 assert.equal(await page.locator('.notice[role="status"]').count(),0);
 controls.batchGate=null;releaseBatch();
 await page.waitForTimeout(150);
 const downloads=requests.slice(start).filter(p=>p.startsWith('/200/userfiles/'));
 assert.ok(downloads.includes('/200/userfiles/crop-file'));
 assert.ok(downloads.includes('/200/userfiles/variant-file'),'both image requests start before either finishes');
 assert.equal(await page.locator('nav [data-tab="overview"].active').count(),1);
 controls.imageGate=null;releaseImages();
 await page.locator('nav [data-tab="slides"].active').waitFor();
 assert.equal(wireBatches.length-before,1,'one data fetch for the entire tab');
 assert.equal(await page.locator('.slide-editor [data-image]').count(),0);
 assert.equal(await page.locator('.slide-editor img').evaluateAll(images=>images.length===6&&images.every(im=>im.complete&&im.naturalWidth>0)),true);
 await page.waitForTimeout(200);assert.equal(wireBatches.length-before,1,'rendering performs no follow-up API lookups');
});

test('failed or superseded tabs retain the previous view until the selected view succeeds',async t=>{
 const {page,controls}=await fixture(t);
 await page.goto(baseURL+'/200/projects/p1');await page.locator('nav [data-tab="overview"].active').waitFor();
 controls.failNext=true;await page.locator('nav [data-tab="slides"]').click();await page.waitForTimeout(150);
 assert.equal(await page.locator('nav [data-tab="overview"].active').count(),1);
 let release;controls.batchGate=new Promise(resolve=>release=resolve);
 await page.locator('nav [data-tab="slides"]').click();await page.waitForTimeout(50);
 controls.batchGate=null;await page.locator('nav [data-tab="budget"]').click();await page.locator('nav [data-tab="budget"].active').waitFor();
 release();await page.waitForTimeout(200);
 assert.equal(await page.locator('nav [data-tab="budget"].active').count(),1);
});
