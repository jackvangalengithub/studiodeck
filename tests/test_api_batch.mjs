import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiBatcher,jsonFormBody} from '../public/assets/api-batch.js';
import {sendBatch} from '../public/assets/data-layer.js';
const context={userId:'u',tenant:'200'};
const result=call=>({responseid:call.id,code:200,body:{other:{resource:call.resource}}});
test('concurrent reads coalesce and deduplicate using table resources',async()=>{
 const batches=[],client=createApiBatcher({transport:async batch=>{batches.push(batch);return batch.calls.map(result);}});
 const values=await Promise.all(['projects','person_profiles','projects'].map(resource=>client.request({...context,resource})));
 assert.equal(batches.length,1);assert.equal(batches[0].calls.length,2);assert.deepEqual(values.map(r=>r.other.resource),['projects','person_profiles','projects']);
});
test('writes are never deduplicated and reads after a write remain ordered',async()=>{
 const envelopes=[],client=createApiBatcher({transport:batch=>sendBatch({...batch,fetcher:async(url,options)=>{envelopes.push(JSON.parse(options.body));return {ok:true,json:async()=>batch.calls.map(result).reverse()};}})});
 await Promise.all([client.request({...context,resource:'projects'}),client.request({...context,resource:'project_pins',method:'POST'}),client.request({...context,resource:'project_pins',method:'POST'}),client.request({...context,resource:'projects'})]);
 assert.equal(envelopes.length,1);assert.deepEqual(envelopes[0].map(g=>g.map(c=>c.method)),[['QUERY'],['POST'],['POST'],['QUERY']]);
});
test('tenant and user scopes remain separate at enqueue time',async()=>{const batches=[],client=createApiBatcher({transport:async b=>{batches.push(b);return b.calls.map(result);}});await Promise.all([{}, {tenant:'201'}, {userId:'other'}].map(change=>client.request({...context,...change,resource:'person_profiles'})));assert.equal(batches.length,3);});
test('mutations are not retried and warnings do not become false success',async()=>{
 let attempts=0;const client=createApiBatcher({transport:async b=>{attempts++;return b.calls.map(c=>({...result(c),body:{warnings:[{field:'name',reason:'denied'}]}}));}});
 await assert.rejects(client.request({...context,resource:'projects/p',method:'PATCH'}),e=>e.warnings.length===1&&e.mutationMayHaveSucceeded);assert.equal(attempts,1);
 const offline=createApiBatcher({transport:async()=>{attempts++;throw Error('Offline');}});await assert.rejects(offline.request({...context,resource:'projects',method:'POST'}),/Offline/);assert.equal(attempts,2);
});
test('file-free forms become JSON; selected files are kept for dedicated upload handling',()=>{const body=new FormData();body.set('project_id','p');body.set('tags','one, two');assert.deepEqual(jsonFormBody('project_settings',body),{project_id:'p',tags:['one',' two']});body.set('logo',new Blob(['image']),'logo.png');assert.equal(jsonFormBody('project_settings',body),body);});

test('boolean filter literals survive platform string binding while mutation booleans retain their type',async()=>{
 const filter=['AND',['archived','=',false],['OR',['locked','=',true],['selected','IN',[false,true]]],['name','=','false'],['number','=',0],['parent_id','=',null],['project_id','IN','{{projects.entities[].id}}']];
 const calls=[{id:'read',resource:'projects',params:{filter}},{id:'write',resource:'projects/p',method:'PATCH',params:{archived:false,theme:{enabled:true}}}];
 let wire;
 await sendBatch({tenant:'200',calls,fetcher:async(url,options)=>{wire=JSON.parse(options.body).flat();return {ok:true,json:async()=>calls.map(result)};}});
 assert.deepEqual(JSON.parse(wire[0].body).filter,['AND',['archived','=','false'],['OR',['locked','=','true'],['selected','IN',['false','true']]],['name','=','false'],['number','=',0],['parent_id','=',null],['project_id','IN','{{projects.entities[].id}}']]);
 assert.deepEqual(JSON.parse(wire[1].body),{archived:false,theme:JSON.stringify(calls[1].params.theme)});
 assert.deepEqual(calls[1].params,{archived:false,theme:{enabled:true}});
 assert.equal(filter[1][2],false);
});
