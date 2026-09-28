import test,{before,after} from 'node:test';
import {matchesFilter} from './helpers/filter.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {schema} from '../public/assets/platform/schema.js';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const baseURL=process.env.STUDIODECK_TEST_URL||'http://localhost:8199';
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});});
after(async()=>browser?.close());
async function fixture(t,{withImages=false}={}){
 const page=await browser.newPage(),errors=[],requests=[],batches=[];page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});t.after(async()=>{if(await page.locator('.status-page').count())console.log('STATUS',await page.locator('.status-page').innerText());await page.close();assert.deepEqual(errors,[]);});
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
   const matches=matchesFilter;
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
 const {page,wireBatches,requests,controls}=await fixture(t,{withImages:true});
 let releaseImages;controls.imageGate=new Promise(resolve=>releaseImages=resolve);t.after(()=>releaseImages());
 await page.goto(baseURL+'/200/projects',{waitUntil:'domcontentloaded'});
 const cover=page.locator('[data-project-cover="p1"]');await cover.waitFor();
 assert.equal(new URL(await cover.getAttribute('src'),baseURL).searchParams.get('size'),'small');
 assert.equal(await cover.evaluate(im=>im.complete&&im.naturalWidth>0),false,'cover download does not block the project list');
 controls.imageGate=null;releaseImages();
 await page.locator('[data-project-cover="p1"]').evaluate(im=>im.decode());
 const complete=wireBatches.flat(2).filter(c=>c.relative_url==='200/projects:readView');assert.equal(complete.length,1);
 assert.equal(requests.filter(p=>p==='/200/userfiles/file0').length,1);
 assert.equal(wireBatches.length,2,'one bootstrap and one list batch');
});

test('presentation tab switches after one batch while images are still loading',async t=>{
 const {page,controls,wireBatches,requests}=await fixture(t,{withImages:true});
 await page.goto(baseURL+'/200/projects/p1');await page.locator('nav [data-tab="overview"].active').waitFor();
 const before=wireBatches.length;
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
 await page.locator('nav [data-tab="slides"].active').waitFor();
 assert.equal(wireBatches.length-before,1,'one data fetch for the entire tab');
 assert.equal(await page.locator('.slide-editor [data-image]').count(),0);
 const preview=page.locator('.slide-editor img[src$="/crop-file?size=small"]');
 await preview.scrollIntoViewIfNeeded();
 assert.equal(await preview.evaluate(im=>im.complete&&im.naturalWidth>0),false,'active tab does not wait for image bytes');
 const bounds=await preview.locator('..').boundingBox();
 controls.imageGate=null;releaseImages();
 await page.locator('.slide-editor img[src$="/crop-file?size=small"]').evaluate(im=>im.decode());
 const after=await preview.locator('..').boundingBox();
 assert.equal(after.width,bounds.width);assert.equal(after.height,bounds.height,'image arrival does not resize its container');
 assert.equal(requests.filter(path=>path==='/200/userfiles/crop-file').length,1,'no duplicate preload and image-element downloads');
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

test('project search refreshes from one server batch and survives reload and history',async t=>{
 const {page,tables,controls,wireBatches}=await fixture(t);
 tables.projects.push({id:'p2',studio_id:tables.projects[1].studio_id,name:'Archived garden',archived:true});
 await page.goto(baseURL+'/200/projects');await page.getByText('Garden project',{exact:true}).first().waitFor();
 let release;controls.batchGate=new Promise(resolve=>release=resolve);t.after(()=>release());
 const before=wireBatches.length;await page.locator('#project-search').fill('missing');await page.waitForTimeout(350);
 assert.equal(wireBatches.length-before,1);assert.equal(await page.getByText('Garden project',{exact:true}).count(),1,'old grid stays while loading');
 controls.batchGate=null;release();await page.getByText('Garden project',{exact:true}).waitFor({state:'detached'});
 assert.equal(new URL(page.url()).searchParams.get('search'),'missing');
 await page.reload();await page.locator('#project-search').waitFor();assert.equal(await page.locator('#project-search').inputValue(),'missing');assert.equal(await page.getByText('Garden project',{exact:true}).count(),0);
 await page.locator('#project-search').fill('garden');await page.getByText('Garden project',{exact:true}).first().waitFor();
 const start=wireBatches.length;await page.locator('#show-archived').check();await page.getByText('Archived garden',{exact:true}).first().waitFor();assert.equal(wireBatches.length-start,1);
 await page.reload();await page.getByText('Archived garden',{exact:true}).first().waitFor();assert.equal(await page.locator('#show-archived').isChecked(),true);
 await page.goBack();await page.getByText('Garden project',{exact:true}).first().waitFor();assert.equal(await page.locator('#show-archived').isChecked(),false);
});
test('file search and category filters use the server and restore from URL',async t=>{
 const {page,wireBatches}=await fixture(t,{withImages:true});
 await page.goto(baseURL+'/200/projects/p1?tab=files');await page.locator('#file-search').waitFor();
 const before=wireBatches.length;await page.locator('#file-search').fill('Image 4');await page.waitForTimeout(450);
 assert.equal(await page.locator('.file-group').count(),1);assert.equal(wireBatches.length-before,1);
 await page.reload();await page.locator('#file-search').waitFor();assert.equal(await page.locator('#file-search').inputValue(),'Image 4');assert.equal(await page.locator('.file-group').count(),1);
 await page.locator('[data-action="file-filter"]').click();await page.locator('[data-file-filter-select="none"]').click();await page.waitForTimeout(180);
 assert.equal(await page.locator('.file-group').count(),0);assert.equal(new URL(page.url()).searchParams.get('categories'),'');
 await page.reload();await page.locator('#file-search').waitFor();assert.equal(await page.locator('.file-group').count(),0);
});
test('slide filter remains local and its selection and layout survive refresh',async t=>{
 const {page,wireBatches}=await fixture(t,{withImages:true});
 await page.goto(baseURL+'/200/projects/p1?tab=slides');await page.locator('.slide-editor').waitFor();
 const before=wireBatches.length;await page.locator('[data-slide-filter-open]').click();await page.locator('[data-slide-filter-select="none"]').click();await page.locator('[data-slide-type="render"]').check();await page.locator('[data-slide-filter-apply]').click();
 assert.equal(wireBatches.length,before);assert.equal(await page.locator('.slide-editor-row').count(),6);
 await page.locator('[data-action="slide-view"][data-view="grid"]').click();await page.reload();await page.locator('.slide-editor.all-slides').waitFor();assert.equal(await page.locator('.slide-editor-row').count(),6);
 assert.equal(new URL(page.url()).searchParams.get('types'),'render');
});

test('late or failed searches preserve the newest successful grid',async t=>{
 const {page,controls,wireBatches}=await fixture(t);
 await page.goto(baseURL+'/200/projects');await page.getByText('Garden project',{exact:true}).first().waitFor();
 let release;controls.batchGate=new Promise(resolve=>release=resolve);t.after(()=>release());
 await page.locator('#project-search').fill('missing');await page.waitForTimeout(300);
 controls.batchGate=null;await page.locator('#project-search').fill('Garden');await page.waitForTimeout(350);release();await page.waitForTimeout(100);
 assert.equal(await page.getByText('Garden project',{exact:true}).count(),1);
 controls.failNext=true;const start=wireBatches.length;await page.locator('#project-search').fill('fail');await page.waitForTimeout(350);
 assert.equal(wireBatches.length-start,1);assert.equal(await page.getByText('Garden project',{exact:true}).count(),1);
});
test('member search requests a filtered directory and persists in the URL',async t=>{
 const {page,tables,wireBatches}=await fixture(t);
 tables.studio_members=[{id:'m1',studio_id:tables.projects[1].studio_id,user_id:'u1',role:'admin'}];
 await page.goto(baseURL+'/200/users');await page.locator('#studio-user-search').waitFor();
 const start=wireBatches.length;await page.locator('#studio-user-search').fill('nobody');await page.waitForTimeout(350);
 assert.equal(wireBatches.length-start,1);assert.equal(await page.locator('#studio-user-list .member-row').count(),0);
 await page.reload();await page.locator('#studio-user-search').waitFor();assert.equal(await page.locator('#studio-user-search').inputValue(),'nobody');
 assert.equal(await page.locator('#studio-user-list .member-row').count(),0);
});
test('communication search and types are sent in the batch and restored on refresh',async t=>{
 const {page,wireBatches}=await fixture(t);
 await page.goto(baseURL+'/200/projects/p1?tab=comments');await page.locator('[data-comm-search="project"]').waitFor();
 let start=wireBatches.length;await page.locator('[data-comm-search="project"]').fill('paint');await page.waitForTimeout(300);
 assert.equal(wireBatches.length-start,1);let call=wireBatches.at(-1).flat()[0];assert.equal(JSON.parse(call.body).feed.search,'paint');
 await page.reload();await page.locator('[data-comm-search="project"]').waitFor();assert.equal(await page.locator('[data-comm-search="project"]').inputValue(),'paint');
 call=wireBatches.at(-1).flat()[0];assert.equal(JSON.parse(call.body).feed.search,'paint');
 await page.goto(baseURL+'/200/comments?filter=attention&q=wood&threadTypes=todo&sort=oldest&offset=25');await page.locator('[data-comm-search="studio"]').waitFor();
 call=wireBatches.at(-1).flat()[0];const feed=JSON.parse(call.body).feed;assert.equal(feed.search,'wood');assert.equal(feed.filter,'attention');assert.equal(feed.types,'todo');assert.equal(feed.sort,'oldest');assert.equal(feed.offset,25);
});


test('presentation uses large variants and zoom resolves the same original file',async t=>{
 const {page,wireBatches}=await fixture(t,{withImages:true});
 await page.goto(baseURL+'/200/projects/p1');
 await page.locator('nav [data-tab="overview"].active').waitFor();
 assert.match(await page.locator('.cover-card img').getAttribute('src'),/size=large$/);
 assert.match(await page.locator('.slide-cards img').first().getAttribute('src'),/size=small$/);
 await page.locator('.slide-cards [data-action="open-editor-slide"]').first().click();
 await page.waitForSelector('.presenting');
 const photo=page.locator('.photo-magnify img').first();await photo.waitFor();
 const src=new URL(await photo.getAttribute('src'),baseURL);
 assert.equal(src.searchParams.get('size'),'large');
 const tip=page.locator('#overlay [data-action="close-modal"]');if(await tip.count())await tip.first().click();
 const batches=wireBatches.length;
 await photo.click();
 const zoom=page.locator('#photo-lightbox img').first();await zoom.waitFor();
 const original=new URL(await zoom.getAttribute('src'),baseURL);
 assert.equal(original.pathname,src.pathname);assert.equal(original.searchParams.has('size'),false);
 assert.equal(wireBatches.length,batches,'zoom requires no metadata fetch');
});

test('floorplan zoom upgrades the large preview to original bytes without another batch',async t=>{
 const {page,tables,wireBatches}=await fixture(t,{withImages:true});
 tables.presentation_slides[0].type='floorplan';
 await page.goto(baseURL+'/200/slide/visual-slide0?project=p1&iteration=i1');
 const photo=page.locator('.floorplan-image img');await photo.waitFor();
 const preview=new URL(await photo.getAttribute('src'),baseURL);assert.equal(preview.searchParams.get('size'),'large');
 const tip=page.locator('#overlay [data-action="close-modal"]');if(await tip.count())await tip.first().click();
 const batches=wireBatches.length;
 await page.locator('[data-plan-zoom=".25"]').click();
 const original=new URL(await photo.getAttribute('src'),baseURL);
 assert.equal(original.pathname,preview.pathname);assert.equal(original.searchParams.has('size'),false);
 assert.equal(wireBatches.length,batches);
});

test('extracted filenames remain plain text in shared modal titles',async t=>{
 const {page,tables}=await fixture(t,{withImages:true});
 const filename='<svg onload="window.__filenameXss=1"></svg> & "design".pdf';
 tables.file_versions.find(f=>f.id==='version4').name=filename;
 await page.goto(baseURL+'/200/projects/p1?tab=files');
 await page.locator('[data-action="toggle-extracted"][data-id="version4"]').click();
 await page.locator('[data-action="preview-extracted"][data-id="version4:1:page:0"]').first().click();
 const title=page.locator('#modal-title');await title.waitFor();
 assert.equal(await title.textContent(),filename.replace(/\.[^.]+$/,'')+'-page-001.jpg');
 assert.equal(await title.locator('svg,img,script').count(),0,'filename must not create HTML nodes');
 assert.equal(await page.evaluate(()=>window.__filenameXss),undefined,'filename must not run code');
});

for(const route of ['/200/comments?filter=all','/200/projects/p1?tab=comments'])test(`communication slide thumbnails use their batch metadata: ${route}`,async t=>{
 const {page,tables,wireBatches,requests}=await fixture(t,{withImages:true});
 tables.comments=[0,4,5].map((n,i)=>({id:'comment'+n,iteration_id:'i1',slide:'visual-slide'+n,parent_id:null,author:'jack@example.com',body:'Discuss picture '+n,answered:false,created_at:`2026-01-0${i+1}T12:00:00Z`}));
 tables.communication_threads=tables.comments.map(c=>({id:'thread'+c.id,comment_id:c.id,title:c.body}));
 tables.communication_audiences=tables.comments.map(c=>({id:'audience'+c.id,root_id:c.id,audience:'studio'}));
 await page.goto(baseURL+route);
 const preview=page.locator('[data-comment-preview="comment5"]');await preview.waitFor();
 assert.equal(await preview.getAttribute('src'),'/200/userfiles/variant-file?size=small');await preview.evaluate(im=>im.decode());
 if(route.includes('/comments?')){
  assert.equal(await page.locator('[data-comment-preview="comment0"]').getAttribute('src'),'/200/userfiles/file0?size=small');
  assert.equal(await page.locator('[data-comment-preview="comment4"]').getAttribute('src'),'/200/userfiles/crop-file?size=small');
 }else assert.equal(await page.locator('.comm-context').getAttribute('data-slide'),'visual-slide5');
 const count=wireBatches.length;await page.waitForTimeout(150);assert.equal(wireBatches.length,count);
 assert.equal(wireBatches.length,2,'bootstrap plus one communication view batch');
 assert.ok(requests.every(p=>!p.includes('comment_preview')&&!p.includes('platform-unavailable')&&p!=='/api.php'));
});
