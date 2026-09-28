import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sendBatch,createDataLayer} from '../public/assets/data-layer.js';

test('platform framing and out-of-order response correlation',async()=>{
  const calls=[{id:'a',resource:'projects',params:{filter:['id','=','p'],selectList:['id','name']}},{id:'b',resource:'budget_items'}];
  const results=await sendBatch({studioId:'studio',csrf:'token',calls,fetcher:async(url,options)=>{
    assert.equal(url,'/api/1.0/studio/batch');assert.equal(options.headers['X-CSRF-Token'],undefined);
    const wire=JSON.parse(options.body);assert.equal(wire.length,1);
    assert.deepEqual(wire[0][0],{id:'a',method:'QUERY',relative_url:'studio/projects',body:JSON.stringify(calls[0].params),requestingId:'a'});
    return {ok:true,json:async()=>[{responseid:'b',code:403,body:{message:'Denied'}},{responseid:'a',code:200,body:{other:{}}}]};
  }});
  assert.deepEqual(results.map(r=>r.responseid),['a','b']);assert.equal(results[1].code,403);
});
test('reject incomplete, duplicate and unexpected response IDs',async()=>{
  for(const results of [[],[{responseid:'bad',code:200,body:{other:{}}}],[{responseid:'a',code:200,body:{other:{}}},{responseid:'a',code:200,body:{other:{}}}]]){
    await assert.rejects(sendBatch({studioId:'s',calls:[{id:'a',resource:'app:context'}],fetcher:async()=>({ok:true,json:async()=>results})}),/response/i);
  }
});
function fixture(){
  let ctx={userId:'u',studioId:'s',csrf:'t'};const batches=[];
  const layer=createDataLayer({context:()=>ctx,transport:args=>new Promise((resolve,reject)=>batches.push({args,resolve:()=>resolve(args.calls.map(call=>({code:200,body:{other:call.resource==='project:shell'?{project:{id:call.params.projectId},iteration:{id:'i'}}:{[call.resource.split(':')[1]]:true}}}))),reject}))});
  return {layer,batches,switchStudio(){ctx={...ctx,studioId:'other'};}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('app bootstrap runs once, including concurrent consumers',async()=>{
  const {layer,batches}=fixture(),a=layer.loadAppContext(),b=layer.loadAppContext();await tick();assert.equal(batches.length,1);batches[0].resolve();
  await Promise.all([a,b]);await layer.loadAppContext();assert.equal(batches.length,1);
});
test('one active-view batch, deduplication, resolved iteration caching, and refresh on revisit',async()=>{
  const {layer,batches}=fixture(),options={projectId:'p',view:'budget'};
  const a=layer.loadProjectView(options),b=layer.loadProjectView(options);await tick();
  assert.equal(batches.length,1);assert.deepEqual(batches[0].args.calls.map(c=>c.resource),['project:shell','project:jobs','project:budget']);
  batches[0].resolve();await Promise.all([a,b]);
  assert.equal(layer.peekProjectView({...options,iterationId:'i'}).budget,true);
  assert.equal(layer.peekProjectView({...options,view:'people'}),null);
  const next=layer.loadProjectView({...options,iterationId:'i'});await tick();assert.equal(batches.length,2);batches[1].resolve();await next;
});
test('studio switch and invalidation cannot restore an old snapshot',async()=>{
  for(const invalidate of [false,true]){
    const f=fixture(),options={projectId:'p',view:'people'},p=f.layer.loadProjectView(options);await tick();
    const check=assert.rejects(p,error=>error.superseded===true);
    if(invalidate)f.layer.invalidate({projectId:'p'});else f.switchStudio();
    f.batches[0].resolve();await check;assert.equal(f.layer.peekProjectView(options),null);
  }
});
test('failure is retryable and does not erase independent successful resources',async()=>{
  let attempts=0;const layer=createDataLayer({context:()=>({studioId:'s'}),transport:async({calls})=>calls.map(c=>({code:++attempts===1?503:200,body:attempts===1?{message:'Offline'}:{other:{loaded:true}}}))});
  await assert.rejects(layer.loadAppContext(),/Offline/);await tick();assert.deepEqual(await layer.loadAppContext(),{loaded:true});
});
test('invalidating an edited project drops its views but retains app context',async()=>{
 const {layer,batches}=fixture();layer.primeAppContext({user:{id:'u'}});
 const p=layer.loadProjectView({projectId:'p',view:'budget'});await tick();batches[0].resolve();await p;
 layer.invalidate({projectId:'p'});
 assert.equal(layer.peekProjectView({projectId:'p',iterationId:'i',view:'budget'}),null);
 assert.deepEqual(await layer.loadAppContext(),{user:{id:'u'}});assert.equal(batches.length,1);
});
