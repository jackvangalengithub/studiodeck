export function matchesFilter(row,filter){
 if(!filter?.length)return true;
 if(filter[0]==='AND')return filter.slice(1).every(f=>matchesFilter(row,f));
 if(filter[0]==='OR')return filter.slice(1).some(f=>matchesFilter(row,f));
 const [field,op,value]=filter,actual=row[field];
 if(op==='IN')return (value||[]).includes(actual);
 if(op==='=')return actual===(typeof actual==='boolean'&&['true','false'].includes(value)?value==='true':value);
 if(op==='ilike'){
  if(actual==null)return false;
  let pattern='',escaped=false;
  for(const char of value){
   if(!escaped&&char==='\\'){escaped=true;continue;}
   pattern+=!escaped&&char==='%'?'.*':!escaped&&char==='_'?'.':char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');escaped=false;
  }
  return new RegExp('^'+pattern+'$','isu').test(actual);
 }
 throw Error('Unsupported fixture operator '+op);
}
