export {sendPlatformBatch as sendBatch} from './platform/transport.js';

export const viewResources=Object.freeze({
  overview:['shell','jobs','overview'],slides:['shell','jobs','slides'],files:['shell','jobs','files'],
  budget:['shell','jobs','budget'],people:['shell','jobs','people'],comments:['shell','jobs','communication'],
  checks:['shell','jobs','communication','files'],presentation:['presentation'],
});

// Keep snapshots separate from screen state: forms may edit their own copy.
export function createDataLayer({context, transport}) {
  const cache=new Map(),pending=new Map(),latest=new Map();let scope='',generation=0,sequence=0;
  function reset(){cache.clear();pending.clear();latest.clear();generation++;}
  function current(){const c=context(),next=JSON.stringify([c.userId,c.studioId]);if(next!==scope){reset();scope=next;}return c;}
  const key=(resource,params)=>JSON.stringify([resource,params]);
  async function resources(specs,{refresh=false}={}){
    const c=current(),epoch=generation,missing=[],flight=JSON.stringify(specs.map(s=>s.resource));
    const promises=specs.map(spec=>{
      const k=key(spec.resource,spec.params),pk=JSON.stringify([k,flight]);
      // A newly selected tab must not wait for the whole batch of an obsolete tab.
      if(pending.has(pk))return pending.get(pk);
      if(!refresh&&cache.has(k))return Promise.resolve(cache.get(k));
      let resolve,reject;const promise=new Promise((ok,no)=>{resolve=ok;reject=no;});
      const id=String(++sequence);latest.set(k,id);
      pending.set(pk,promise);missing.push({...spec,id,k,pk,promise,resolve,reject});return promise;
    });
    if(missing.length){
      Promise.resolve().then(()=>transport({...c,calls:missing})).then(results=>{
        current();
        if(epoch!==generation)throw Object.assign(Error('This data request was superseded.'),{superseded:true});
        results.forEach((result,index)=>{
          const entry=missing[index];
          const errors=result.body.errors;
          if(result.code<200||result.code>=300||(errors&&Object.keys(errors).length)){
            const error=Object.assign(Error(result.body.message||'Unable to load this view.'),{status:result.code});
            if([401,403,404].includes(result.code)){cache.delete(entry.k);}
            entry.reject(error);
          }else if(!result.body.other||typeof result.body.other!=='object'||Array.isArray(result.body.other))entry.reject(Error('Missing resource payload.'));
          else{const payload=structuredClone(result.body.other);if(latest.get(entry.k)===entry.id)cache.set(entry.k,payload);entry.resolve(payload);}
        });
      }).catch(error=>{if([401,403].includes(error.status))reset();missing.forEach(entry=>entry.reject(error));})
        .finally(()=>missing.forEach(entry=>{if(pending.get(entry.pk)===entry.promise)pending.delete(entry.pk);}));
    }
    return Promise.all(promises);
  }
  function specs({projectId,iterationId=null,view}){
    if(!viewResources[view])throw Error('Unknown project view.');
    return viewResources[view].map(name=>({resource:`project:${name}`,params:{projectId,iterationId}}));
  }
  function assemble(parts,view){return structuredClone(Object.assign({},...parts,{_loadedView:view}));}
  return {
    reset,
    primeAppContext(value){current();cache.set(key('app:context',{}),structuredClone(value));},
    async loadAppContext({refresh=false}={}){return structuredClone((await resources([{resource:'app:context',params:{}}],{refresh}))[0]);},
    async loadStatus(){return structuredClone((await resources([{resource:'app:status',params:{}}],{refresh:true}))[0]);},
    async loadProjectView(options){
      const requests=specs(options),parts=await resources(requests,{refresh:options.refresh!==false});
      const resolved=parts.find(part=>part.iteration)?.iteration.id;
      if(resolved&&!options.iterationId)requests.forEach((s,index)=>cache.set(key(s.resource,{...s.params,iterationId:resolved}),parts[index]));
      return assemble(parts,options.view);
    },
    peekProjectView(options){current();const parts=specs(options).map(s=>cache.get(key(s.resource,s.params)));return parts.every(Boolean)?assemble(parts,options.view):null;},
    async loadJobs({projectId,iterationId}){return structuredClone((await resources([{resource:'project:jobs',params:{projectId,iterationId}}],{refresh:true}))[0]);},
    invalidate({projectId,iterationId,resources: names}={}){
      // Detach in-flight reads so an older snapshot cannot refill an invalidated cache.
      generation++;pending.clear();
      for(const k of cache.keys()){
        const [resource,params]=JSON.parse(k);
        if((!projectId||params.projectId===projectId)&&(!iterationId||params.iterationId===iterationId||params.iterationId===null)&&(!names||names.includes(resource.split(':')[1])))cache.delete(k);
      }
    },
  };
}
