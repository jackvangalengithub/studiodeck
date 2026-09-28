import test from 'node:test';
import assert from 'node:assert/strict';
import {PlatformClient} from '../public/assets/platform/client.js';
import {sendPlatformBatch,createRowQueue} from '../public/assets/platform/transport.js';
import {schema} from '../public/assets/platform/schema.js';
const fixture={users:[{id:'u1',email:'jack@example.com',name:'Jack'}],projects:[{id:'p1',name:'Garden',studio_id:'s1',user_id:'u1',archived:false,theme:{}}],iterations:[{id:'i1',project_id:'p1',number:1,locked:false,theme:{},status:'draft'}],project_members:[{id:'m1',project_id:'p1',user_id:'u1'}],studios:[{id:'s1',name:'Studio',theme:{},setup_completed_at:'2026-01-01'}],budget_items:[{id:'b1',iteration_id:'i1',label:'Design',amount_cents:10000,is_optional:false,included:false}],iteration_files:[],presentation_slides:[]};
function fakeClient(seed=fixture,options={}){
 const tables=structuredClone(seed),batches=[];
 const transport=async({calls,tenant})=>{
  assert.equal(tenant,'200');const complete=calls[0]?.resource==='projects:readView',outer=calls[0];if(complete)calls=outer.params.queries;batches.push(structuredClone(calls.map(({resolve,reject,...call})=>call)));const outputs={};
  const resolve=v=>{if(Array.isArray(v))return v.map(resolve);if(typeof v!=='string')return v;const m=v.match(/^\{\{(\w+)\.entities\[(\d*)\]\.(\w+)\}\}$/);return m?(m[2]===''?(outputs[m[1]]||[]).map(r=>r[m[3]]):outputs[m[1]]?.[+m[2]]?.[m[3]]):v;};
  const matches=(row,f)=>{if(!f?.length)return true;if(f[0]==='AND')return f.slice(1).every(s=>matches(row,s));if(f[0]==='OR')return f.slice(1).some(s=>matches(row,s));const [field,op,value]=f;if(op==='IN')return value.includes(row[field]);if(op==='=')return row[field]===value;throw Error('Unsupported fixture operator '+op);};
  const results=calls.map(call=>{
   if(call.resource==='users:ensureIdentity'){
    assert.equal(call.method,'POST');assert.deepEqual(call.params,{});
    if(!(tables.users||[]).some(r=>r.id==='u1'))(tables.users??=[]).push({id:'u1',email:'jack@example.com',name:'Jack'});
    outputs[call.id]=[{id:'u1'}];
    return {responseid:call.id,code:200,body:{entities:[{id:'u1',tablename:'users',data:{id:'u1'}}],other:{id:'u1'}}};
   }
   const [table,id]=call.resource.split('/');assert.ok(schema[table],table);
   if(!call.method||call.method==='QUERY'){
    for(const f of call.params.selectList)assert.ok(schema[table][f],table+'.'+f);
    let found=(tables[table]||[]).filter(r=>matches(r,resolve(call.params.filter)));
    for(const {field,direction} of [...call.params.orderBy||[]].reverse()){const key=field.split('.').at(-1);found.sort((a,b)=>(a[key]<b[key]?-1:a[key]>b[key]?1:0)*(direction==='desc'?-1:1));}
    const size=(complete?Math.max(1,found.length):Math.min(call.params.nperpage,2)),offset=(call.params.page-1)*size,part=found.slice(offset,offset+size);outputs[call.id]=part;
    return {responseid:call.id,code:200,body:{entities:part.map(r=>({id:r.id,tablename:table,data:Object.fromEntries(call.params.selectList.filter(f=>f in r).map(f=>[f,r[f]])),writablefields:call.params.selectList})),other:{nextPage:offset+size<found.length?call.params.page+1:null,itemsPerPage:size}}};
   }
   for(const f of Object.keys(call.params||{}))assert.ok(schema[table][f],table+'.'+f);
   if(call.method==='POST'){(tables[table]??=[]).push(call.params);return {responseid:call.id,code:201,body:{id:call.params.id,errors:[]}};}
   if(call.method==='PATCH'){Object.assign(tables[table].find(r=>r.id===id),call.params);return {responseid:call.id,code:201,body:{id,errors:[]}};}
   tables[table]=tables[table].filter(r=>r.id!==id);return {responseid:call.id,code:204,body:[]};
  });
  return complete?[{responseid:outer.id,code:200,body:{other:{results}}}]:results;
 };
 const c=new PlatformClient({studioMappings:{},...options,transport,fetcher:async path=>{assert.equal(path,'/whoami');return {ok:true,json:async()=>({user_id:'u1',email:'jack@example.com',firstname:'Jack',lastname:'',tenants:[{id:200,companyname:'Studio'}],profiles:['studioadmin']})};}});
 return {c,batches,tables};
}
test('bootstrap is cached and uses platform identity plus tenant-local studio metadata',async()=>{const {c,batches}=fakeClient();const s=await c.bootstrap('200');assert.equal(s.studio.id,'200');assert.equal(s.studio.record_id,'s1');assert.equal(s.user.id,'u1');await c.bootstrap();assert.equal(batches.length,1);assert.ok(batches[0].every(call=>!['projects','users','studio_members'].includes(call.resource)));});
test('all project views use valid selected fields and only their required tables',async()=>{for(const view of ['overview','slides','files','budget','people','communication','presentation']){const {c,batches}=fakeClient();await c.bootstrap('200');batches.length=0;const d=await c.project('p1',null,[view]);assert.equal(d.project.name,'Garden');assert.equal(d.iteration.id,'i1');if(view==='budget')assert.equal(d.total_cents,10000);if(view==='people')assert.ok(!batches[0].some(q=>q.resource==='budget_items'));if(view==='overview')assert.ok(!batches[0].some(q=>q.resource==='slide_content'));assert.equal(batches.length,1,view);}});
test('complete project views do not paginate their dependencies in the browser',async()=>{const {c,batches}=fakeClient({...fixture,iteration_files:[1,2,3].map(n=>({id:'l'+n,iteration_id:'i1',version_id:'v'+n})),file_versions:[1,2,3].map(n=>({id:'v'+n,name:'File '+n,mime:'image/png'}))});await c.bootstrap('200');batches.length=0;const d=await c.project('p1','i1',['files']);assert.equal(d.files.length,3);assert.equal(batches.length,1);});
test('project creation posts project, membership, iteration in one atomic group with shared IDs',async()=>{const {c,batches}=fakeClient();await c.bootstrap('200');batches.length=0;const r=await c.request('create_project',{name:'New project'});const writes=batches.at(-1);assert.deepEqual(writes.map(r=>r.resource),['users:ensureIdentity','projects','project_members','iterations']);assert.equal(new Set(writes.map(r=>r.group)).size,1);assert.equal(writes[3].params.project_id,r.project_id);assert.equal(writes[1].params.user_id,'u1');assert.equal(writes[1].params.studio_id,'s1');});
test('unsupported workflow fails before performing writes',async()=>{const {c,batches}=fakeClient();await c.bootstrap('200');batches.length=0;await assert.rejects(c.request('billing_checkout',{}),e=>e.status===501);await assert.rejects(c.request('confirmation_decide',{}),e=>e.status===501);assert.equal(batches.length,0);});
test('batch wire uses platform endpoints, methods, string bodies and response IDs',async()=>{const calls=[{id:'p',resource:'projects',params:{selectList:['id','name'],filter:['name','ilike','%garden%'],page:1,nperpage:20}},{id:'update',resource:'projects/p1',method:'PATCH',params:{name:'New'}}];const results=await sendPlatformBatch({tenant:'200',calls,fetcher:async(url,options)=>{assert.equal(url,'/api/1.0/200/batch');assert.equal(options.headers.Authorization,undefined);const wire=JSON.parse(options.body).flat();assert.equal(wire[0].requestingId,'p');assert.equal(wire[0].relative_url,'200/projects');assert.equal(wire[1].method,'PATCH');assert.deepEqual(JSON.parse(wire[0].body),calls[0].params);return {ok:true,json:async()=>[{responseid:'update',code:201,body:{id:'p1'}},{responseid:'p',code:200,body:{entities:[]}}]};}});assert.equal(results[0].responseid,'p');});
test('queue deduplicates reads, preserves mutations and propagates per-request errors',async()=>{let calls;const queue=createRowQueue({transport:async a=>{calls=a.calls;return calls.map(c=>({responseid:c.id,code:c.method==='PATCH'?403:200,body:c.method==='PATCH'?{message:'Denied'}:{entities:[]}}));}});const args={tenant:'200',userId:'u',resource:'projects',params:{selectList:['id']}};const a=queue.request(args),b=queue.request(args);assert.equal(a,b);const denied=queue.request({...args,resource:'projects/p',method:'PATCH'});await a;await assert.rejects(denied,/Denied/);assert.equal(calls.length,2);});
test('missing local identity is linked at bootstrap and rechecked in the project transaction',async()=>{const {c,batches,tables}=fakeClient({...fixture,users:[]});await c.bootstrap('200');assert.equal(tables.users[0].id,'u1');await c.request('create_project',{name:'First project'});const writes=batches.at(-1);assert.equal(writes[0].resource,'users:ensureIdentity');assert.deepEqual(writes[0].params,{});assert.equal(writes[1].params.user_id,'u1');assert.equal(new Set(writes.map(c=>c.group)).size,1);});
test('budget saves preserve integer cents and enforce ranges before writing',async()=>{const {c,tables,batches}=fakeClient();await c.bootstrap('200');await c.request('save_budget',{iteration:'i1',label:'Lighting',price_type:'range',min_amount:'125,50',max_amount:'250.00',is_optional:true});const cost=tables.budget_items.find(b=>b.label==='Lighting');assert.equal(cost.min_amount_cents,12550);assert.equal(cost.max_amount_cents,25000);assert.equal(cost.amount_cents,null);const count=tables.budget_items.length;await assert.rejects(c.request('save_budget',{iteration:'i1',label:'Invalid',price_type:'range',min_amount:'500',max_amount:'100'}));assert.equal(tables.budget_items.length,count);});
test('slide visibility maps operation names onto partial row updates',async()=>{const {c,tables}=fakeClient();await c.bootstrap('200');await c.request('slide_layout',{iteration:'i1',operation:'hide',slide_id:'intro'});assert.equal(tables.slide_layout[0].hidden,true);await c.request('slide_layout',{iteration:'i1',operation:'show',slide_id:'intro'});assert.equal(tables.slide_layout.length,1);assert.equal(tables.slide_layout[0].hidden,false);});
test('starting-pack text templates create versioned rows and editable project copies',async()=>{const {c,tables}=fakeClient();await c.bootstrap('200');await c.request('save_pack_item',{kind:'slide',slide_type:'text',title:'Welcome {{project_name}}',body:'By {{studio_name}}',default_enabled:true});const {items}=await c.request('studio_starting_pack');assert.equal(items.length,1);const created=await c.request('create_project',{name:'Oak',starting_pack:[items[0].version_id]});const slide=tables.presentation_slides.find(s=>s.iteration_id===created.iteration_id);assert.equal(slide.title,'Welcome Oak');assert.equal(slide.description,'By Studio');});
test('iteration copy keeps choices and creates new checklist threads without reusing old roots',async()=>{const {c,tables}=fakeClient({...fixture,budget_choices:[{id:'bc1',budget_item_id:'b1',selected:true,range_percent:50}],open_questions:[{id:'q1',question_key:'stable-question',iteration_id:'i1',question:'Which finish?',accepted:true,published:false,resolved:false}],checklist_threads:[{id:'ct1',iteration_id:'i1',question_id:'q1',root_id:'old-root'}]});await c.bootstrap('200');const result=await c.request('new_iteration',{iteration:'i1'});const item=tables.budget_items.find(i=>i.iteration_id===result.id);assert.ok(item);assert.ok(tables.budget_choices.some(choice=>choice.budget_item_id===item.id&&choice.range_percent===50));const thread=tables.checklist_threads.find(t=>t.iteration_id===result.id);assert.ok(thread);assert.notEqual(thread.root_id,'old-root');assert.ok(tables.comments.some(comment=>comment.id===thread.root_id&&comment.iteration_id===result.id));});

test('explicit studio mapping scopes metadata, branding, project reads and creation',async()=>{
 const {c,batches}=fakeClient({...fixture,
  studios:[{id:'s0',name:'Other studio'},...fixture.studios],
  studio_logos:[{id:'logo0',studio_id:'s0',data_file_id:'other-logo'},{id:'logo1',studio_id:'s1',data_file_id:'our-logo'}],
  projects:[...fixture.projects,{id:'p0',studio_id:'s0',name:'Other project',archived:false}],
 },{studioMappings:{200:'s1'}});
 const session=await c.bootstrap('200');
 assert.equal(session.studio.record_id,'s1');assert.equal(session.studio.name,'Studio');
 assert.equal(session.studio.logo,'/200/userfiles/our-logo');
 assert.equal(batches.length,1);assert.deepEqual(batches[0].find(c=>c.resource==='studios').params.filter,['id','=','s1']);
 const {projects}=await c.request('projects',{});assert.deepEqual(projects.map(p=>p.id),['p1']);
 await assert.rejects(c.project('p0',null,['overview']),e=>e.status===404);
 const created=await c.request('create_project',{name:'Mapped project'});
 assert.equal(batches.at(-1).find(call=>call.resource==='projects').params.studio_id,'s1');assert.ok(created.project_id);
});
test('missing configured studio fails without selecting another record or writing',async()=>{
 const {c,batches}=fakeClient(fixture,{studioMappings:{200:'missing'}});
 await assert.rejects(c.bootstrap('200'),e=>e.status===409&&/missing or inaccessible/.test(e.message));
 assert.equal(c.session,null);assert.ok(batches.flat().every(call=>!call.method||call.resource==='users:ensureIdentity'));
});
test('multiple studios still require an explicit mapping',async()=>{
 const {c}=fakeClient({...fixture,studios:[...fixture.studios,{id:'s2',name:'Other studio'}]});
 await assert.rejects(c.bootstrap('200'),e=>e.status===409&&/platform\/config.js/.test(e.message));
});

test('project list resolves selected generated covers and original page crops in its single view batch',async()=>{
 const {c,batches}=fakeClient({...fixture,
  iteration_files:[{id:'link',iteration_id:'i1',asset_id:'asset',version_id:'source',category:'renders'}],
  file_versions:[{id:'source',asset_id:'asset',mime:'application/pdf',data_file_id:'pdf'}],
  presentation_slides:[{id:'row',slide_key:'slide',iteration_id:'i1',type:'render',position:0,source_version_id:'source',page_number:2,image_number:3,image_version_id:'edited'}],
  iteration_covers:[{id:'cover',iteration_id:'i1',slide_id:'slide'}],
  document_pages:[{id:'page',version_id:'source',number:2,preview_file_id:'page-file'}],
  document_images:[{id:'crop',version_id:'source',page_number:2,number:3,data_file_id:'crop-file'}],
  slide_image_versions:[{id:'edited',source_version_id:'source',data_file_id:'edited-file'}],
 });
 await c.bootstrap('200');batches.length=0;const {projects}=await c.request('projects',{});
 assert.equal(batches.length,1);assert.equal(projects[0].has_cover,true);assert.equal(projects[0].cover_url,'/200/userfiles/edited-file');
 assert.equal(c.media.url({action:'project_cover',project_id:'p1'}),'/200/userfiles/edited-file');
 assert.equal(c.media.url({action:'slide_image',iteration:'i1',slide_id:'slide',original:1}),'/200/userfiles/crop-file');
 assert.equal(c.media.url({action:'document_page',id:'source',page:2}),'/200/userfiles/page-file');
 assert.equal(batches.length,1,'URL resolution performs no requests');
});

test('multi-generation file history and all image variants arrive in the initial presentation batch',async()=>{
 const {c,batches}=fakeClient({...fixture,
  iteration_files:[{id:'link',iteration_id:'i1',asset_id:'asset',version_id:'v3',category:'renders'}],
  file_versions:[1,2,3].map(n=>({id:'v'+n,asset_id:'asset',parent_id:n>1?'v'+(n-1):null,mime:'image/png',name:'Version '+n,data_file_id:'file'+n})),
  presentation_slides:[{id:'row',slide_key:'slide',iteration_id:'i1',type:'render',source_version_id:'v3',image_version_id:'edited'}],
  slide_image_versions:[{id:'edited',source_version_id:'v3',data_file_id:'edited-file'},{id:'previous-edit',source_version_id:'v3',data_file_id:'previous-file'}],
 });
 await c.bootstrap('200');batches.length=0;const data=await c.project('p1','i1',['presentation']);
 assert.equal(batches.length,1);assert.deepEqual(data.files[0].history.map(f=>f.id),['v3','v2','v1']);
 assert.equal(c.media.url({action:'slide_image',image_version_id:'previous-edit'}),'/200/userfiles/previous-file');
 assert.equal(c.media.url({action:'file',id:'v1'}),'/200/userfiles/file1');
 assert.equal(batches.length,1);
});
