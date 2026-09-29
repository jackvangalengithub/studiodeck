import {schema} from './schema.js';
// Only the platform's data API is used here. UI operation names never go on the wire.
export class PlatformError extends Error {
  constructor(message,details={}){super(message);Object.assign(this,details);}
}
export const unavailable=(operation,reason)=>new PlatformError(reason||`“${operation}” needs platform integration before it can be used.`,{status:501,operation,code:'platform_capability_missing'});
export function assertResult(result){
  const body=result.body||{},errors=body.errors;
  if(result.code<200||result.code>=300||(errors&&Object.keys(errors).length)||body.error||body.other?.error)
    throw new PlatformError(body.message||body.other?.message||body.error||body.other?.error||(errors&&JSON.stringify(errors))||'The platform request failed.',{status:result.code,details:body});
  if(body.warnings?.length)throw new PlatformError('The platform rejected part of this request. Check field and filter permissions.',{status:422,warnings:body.warnings,mutationMayHaveSucceeded:true});
  return body;
}
export const rows=body=>(body.entities||[]).map(entity=>({...entity.data,id:entity.id??entity.data?.id,_platform:{tablename:entity.tablename,writablefields:entity.writablefields}}));
// The current platform PDO binder treats non-integers as strings, turning false
// into an invalid empty PostgreSQL boolean. Normalize filter literals only;
// mutation booleans retain their JSON type for the platform field converters.
const wireFilter=value=>Array.isArray(value)?value.map(wireFilter):typeof value==='boolean'?String(value):value;
// Generated JSON column converters currently expect JSON text. Encode only
// declared object fields on CRUD writes; action payloads keep their native types.
const wireMutation=(resource,params)=>{
  const fields=schema[resource.split('/')[0]];
  if(!fields)return params;
  return Object.fromEntries(Object.entries(params).map(([key,value])=>[key,fields[key]?.type==='object'&&value!==null&&typeof value==='object'?JSON.stringify(value):value]));
};
export async function sendPlatformBatch({studioId,tenant=studioId,calls,fetcher=fetch}){
  if(!tenant||tenant==='account')throw new PlatformError('Select a platform tenant first.',{status:400});
  const ids=new Set(),groups=[],byGroup=new Map();let readGroup=0;
  for(const call of calls){
    if(!/^\w+$/.test(call.id)||ids.has(call.id))throw Error('Invalid or duplicate batch request ID.');ids.add(call.id);
    if(!/^[a-z_]+(?::[A-Za-z_]+)?(?:\/[A-Za-z0-9_-]+)?$/.test(call.resource))throw Error('Invalid platform resource.');
    const method=call.method||'QUERY';if(!['QUERY','GET','POST','PATCH','DELETE'].includes(method))throw Error('Invalid platform method.');
    const read=['QUERY','GET'].includes(method);const key=call.group??(read?'reads'+readGroup:call.id);if(!read)readGroup++;
    if(!byGroup.has(key)){const group=[];groups.push(group);byGroup.set(key,group);}
    byGroup.get(key).push({id:call.id,requestingId:call.id,method,relative_url:`${tenant}/${call.resource}`,body:JSON.stringify(read&&call.params?.filter?{...call.params,filter:wireFilter(call.params.filter)}:['POST','PATCH'].includes(method)?wireMutation(call.resource,call.params||{}):call.params||{})});
  }
  const response=await fetcher(`/api/1.0/${encodeURIComponent(tenant)}/batch`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(groups)});
  let results;try{results=await response.json();}catch{throw new PlatformError('The platform returned an invalid response.',{status:response.status});}
  if(!response.ok)throw new PlatformError(results.message||results.error||'The platform is unavailable.',{status:response.status});
  if(!Array.isArray(results)||results.length!==calls.length)throw Error('Incomplete platform batch response.');
  const byId=new Map();for(const result of results){if(!result||!Number.isInteger(result.code)||result.body===null||typeof result.body!=='object'||!ids.has(String(result.responseid))||byId.has(String(result.responseid)))throw Error('Invalid platform response correlation.');byId.set(String(result.responseid),result);}
  return calls.map(call=>byId.get(call.id));
}
export function createRowQueue({transport=sendPlatformBatch}={}){
  let sequence=0;const queues=new Map(),pending=new Map(),epochs=new Map();
  function request({tenant,userId,resource,params={},method='QUERY'}){
    const scope=JSON.stringify([tenant,userId]),read=['QUERY','GET'].includes(method);
    if(!read)epochs.set(scope,(epochs.get(scope)||0)+1);
    const key=JSON.stringify([scope,epochs.get(scope)||0,resource,params]);if(read&&pending.has(key))return pending.get(key);
    let queue=queues.get(scope);if(!queue){queue={tenant,calls:[]};queues.set(scope,queue);setTimeout(()=>{queues.delete(scope);void flush(queue);},0);}
    const promise=new Promise((resolve,reject)=>queue.calls.push({id:'r'+(++sequence),resource,params:structuredClone(params),method,resolve,reject}));
    if(read){pending.set(key,promise);promise.finally(()=>{if(pending.get(key)===promise)pending.delete(key);}).catch(()=>{});}return promise;
  }
  async function flush(queue){for(let i=0;i<queue.calls.length;i+=100){const calls=queue.calls.slice(i,i+100);try{const results=await transport({tenant:queue.tenant,calls});results.forEach((r,n)=>{try{calls[n].resolve(assertResult(r));}catch(e){calls[n].reject(e);}});}catch(e){calls.forEach(c=>c.reject(e));}}}
  return {request};
}
