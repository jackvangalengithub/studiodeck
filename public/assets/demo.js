// In-memory, fictional pitch content. No client records or production credentials.
export const uid = () => [...crypto.getRandomValues(new Uint8Array(16))].map(v=>v.toString(16).padStart(2,'0')).join('');
const stamp = () => new Date().toISOString();
const theme={style:'Warm minimalism',font:'serif',colors:['#e9e3d7','#bc9f7c','#7d705c','#535e4c','#3b352f']};
const project={id:'van-galen',name:'Familie van Galen',location:'Werkhoven, Netherlands',description:'A considered home. Natural materials, soft light, and room for everyday life.',theme,created_at:'2026-09-01T09:00:00Z'};
const contacts=[{id:'c1',name:'Familie van Galen',role:'Client',email:'family@example.com',phone:''},{id:'c2',name:'Sophie de Vries',role:'Interior designer',email:'sophie@example.com',phone:''},{id:'c3',name:'Thomas van Dijk',role:'Architect',email:'thomas@example.com',phone:''}];
const f=(id,asset,name,category,mime,url,number=1)=>({id,asset_id:asset,name,category,mime,url,preview_url:url,has_preview:1,number,size:241800,metadata:{review_required:false,summary:'Fictional demonstration source'},created_at:'2026-09-17T08:30:00Z',history:[{id,name,number,url}]});
const files=[f('v-living-2','a-living','Living room — concept 02.webp','renders','image/webp','assets/interior.webp',2),f('v-mood','a-mood','Materials & mood.webp','moodboard','image/webp','assets/moodboard.webp'),f('v-plan','a-plan','Ground floor — concept plan.pdf','drawings','application/pdf','assets/concept-plan.pdf'),f('v-budget-2','a-budget','Project budget — revision 02.csv','budget','text/csv','assets/example-budget.csv',2)];
files[2].preview_url='assets/floorplan.svg';
files[3].preview_url=null;files[3].has_preview=0;
files[0].history.push({id:'v-living-1',name:'Living room — concept 01.webp',number:1,url:'assets/interior.webp'});
files[3].history.push({id:'v-budget-1',name:'Project budget — revision 01.csv',number:1,url:'assets/example-budget-v1.csv'});
const b=(id,label,vendor,amount,kind='quote',parent=null,included=0,note='')=>({id,label,vendor,amount_cents:amount,kind,parent_id:parent,included,note,source_version_id:'v-budget-2'});
const budget=[b('b1','Construction & installation','Van Dijk Bouw',5400000,'quote',null,0,'Total contractor quote. Includes the electrical and plumbing subquotes below. Demo amounts include 21% VAT.'),b('b2','Electrical installation','Licht & Lijn',950000,'quote','b1',1,'Included in Van Dijk Bouw’s total. Do not add again.'),b('b3','Plumbing & heating','Warmtewerk',720000,'quote','b1',1,'Included in the main contractor’s quote.'),b('b4','Kitchen & joinery','Atelier Oak',3200000,'quote',null,0,'Oak cabinetry, stone worktop and built-in appliances. Demo amount includes VAT.'),b('b5','Furniture & styling','Studio selection',1895000,'estimate'),b('b6','Lighting','Licht & Lijn',680000,'estimate'),b('b7','Flooring & finishes','Vloerwerk',1280000,'quote'),b('b8','Design & supervision','Your studio',390000,'quote'),b('b9','Window treatments','Vendor to be selected',null,'unknown',null,0,'Fabric and measurements to be confirmed.'),b('b10','Garden connection','Quote pending',null,'unknown',null,0,'External terrace and threshold detailing.')];
const events=[{id:'e1',actor:'Sophie de Vries',type:'file_uploaded',detail:'Updated the living room render',created_at:'2026-09-17T08:30:00Z'},{id:'e2',actor:'family@example.com',type:'change_requested',detail:'Could we explore a warmer finish for the kitchen?',created_at:'2026-09-16T14:20:00Z'},{id:'e3',actor:'family@example.com',type:'presentation_viewed',detail:'Viewed concept 01',created_at:'2026-09-15T18:42:00Z'},{id:'e4',actor:'Sophie de Vries',type:'presentation_sent',detail:'Shared concept 01 with the family',created_at:'2026-09-14T10:00:00Z'}];
const current={project,iteration:{id:'it-2',project_id:project.id,number:2,title:'Design development',status:'draft',theme:JSON.stringify(theme),created_at:'2026-09-17T08:00:00Z'},files,budget,contacts,comments:[{id:'cm1',slide:'renders',author:'family@example.com',body:'Could we explore a warmer finish for the kitchen?',created_at:'2026-09-16T14:20:00Z'}],events,shares:[],jobs:[],changes:[{type:'updated',name:'Living room render'},{type:'updated',name:'Kitchen & joinery budget'}],previous_total_cents:12480000,capabilities:{demo:true,ai:false,mail:false}};
const previous=structuredClone(current);previous.iteration={...previous.iteration,id:'it-1',number:1,title:'First concept',status:'shared',created_at:'2026-09-14T10:00:00Z'};previous.budget.find(x=>x.id==='b4').amount_cents-=365000;previous.files[0].id='v-living-1';previous.files[0].number=1;previous.files[0].name='Living room — concept 01.webp';previous.files[0].history=[previous.files[0].history[1]];previous.files[3].id='v-budget-1';previous.files[3].number=1;previous.files[3].url='assets/example-budget-v1.csv';previous.files[3].history=[previous.files[3].history[1]];previous.changes=[];previous.previous_total_cents=null;
const decks=new Map([['it-2',current],['it-1',previous]]);
let selected='it-2',studioTheme={palette:'sage',style:'modern'};
const total=items=>items.reduce((sum,x)=>sum+(!Number(x.included)?Number(x.amount_cents??0):0),0);
function enrich(d){d.total_cents=total(d.budget);d.iterations=[...decks.values()].filter(x=>x.project.id===d.project.id).map(x=>x.iteration).sort((a,b)=>b.number-a.number);return structuredClone(d);}
export function demoFile(id){for(const d of decks.values())for(const file of d.files){if(file.id===id)return file;const h=file.history.find(v=>v.id===id);if(h)return h;}return null;}
export async function demoRequest(action,body={}) {
  const iid=body.iteration||selected;let d=decks.get(iid)||decks.get(selected);
  if(action==='session')return {user:{name:'Sophie de Vries',email:'sophie@example.com'},csrf:'demo',studio_theme:studioTheme,capabilities:{demo:true,ai:false,mail:false}};
  if(action==='projects'){const map=new Map();for(const d of [...decks.values()].sort((a,b)=>a.iteration.number-b.iteration.number))map.set(d.project.id,{...d.project,iteration:d.iteration,file_count:d.files.length});return {projects:[...map.values()]};}
  if(action==='project'){d=body.iteration?decks.get(body.iteration):[...decks.values()].filter(x=>x.project.id===body.id).sort((a,b)=>b.iteration.number-a.iteration.number)[0];if(!d)throw Error('Project not found.');selected=d.iteration.id;return enrich(d);}
  if(action==='deck')return enrich(decks.get(body.iteration||selected));
  if(action==='create_project'){const pid=uid(),iid=uid();d={project:{...project,id:pid,name:body.name,location:body.location||'',description:body.description||'',theme:{},created_at:stamp()},iteration:{id:iid,project_id:pid,number:1,title:'First concept',status:'draft',created_at:stamp()},files:[],budget:[],contacts:[{id:uid(),name:'Sophie de Vries',role:'Interior designer',email:'sophie@example.com'},...body.emails.map(email=>({id:uid(),email,name:email.split('@')[0],role:'Client'}))],comments:[],events:[],shares:[],jobs:[],changes:[],previous_total_cents:null,capabilities:{demo:true,ai:false,mail:false}};decks.set(iid,d);selected=iid;return {project_id:pid,iteration_id:iid};}
  if(action==='new_iteration'){const copy=structuredClone(d),n=Math.max(...[...decks.values()].filter(x=>x.project.id===d.project.id).map(x=>x.iteration.number))+1;copy.iteration={...d.iteration,id:uid(),number:n,title:body.title||'Design development',status:'draft',created_at:stamp()};copy.previous_total_cents=total(d.budget);copy.changes=[];copy.shares=[];decks.set(copy.iteration.id,copy);selected=copy.iteration.id;return {id:selected};}
  if(action==='upload'){
    d=decks.get(body.get('iteration'));if(d.iteration.status!=='draft')throw Error('Create a new iteration to add files.');
    for(const file of body.getAll('files[]')){
      const allowed=/\.(pdf|pptx?|xlsx?|csv|jpe?g|png|webp)$/i;if(!allowed.test(file.name))throw Error('Please choose PDF, PowerPoint, Excel or image files.');if(file.size>30*1024*1024)throw Error('Files can be up to 30 MB.');
      const old=d.files.find(x=>x.asset_id===body.get('replace_asset')||x.name===file.name),name=file.name.toLowerCase();const category=/mood|material|styling/.test(name)?'moodboard':/budget|quote|offerte|\.xlsx?$|\.csv$/.test(name)?'budget':/plan|drawing|detail|tekening/.test(name)?'drawings':file.type.startsWith('image/')?'renders':/\.pptx?$/.test(name)?'presentation':'other';
      const url=URL.createObjectURL(file),entry=f(uid(),old?.asset_id||uid(),file.name,category,file.type,url,(old?.number||0)+1);entry.has_preview=file.type.startsWith('image/');entry.preview_url=entry.has_preview?url:null;entry.size=file.size;entry.metadata={review_required:true,warnings:file.type.startsWith('image/')?[]:['In this demo, document contents are not extracted. The PHP app processes this file with its worker.']};entry.history=[...entry.history,...old?.history||[]];
      if(old)d.files[d.files.indexOf(old)]=entry;else d.files.push(entry);d.changes.push({type:old?'updated':'added',name:file.name});d.events.unshift({id:uid(),actor:'You',type:'file_uploaded',detail:file.name,created_at:stamp()});
    }return {message:'Files added to this demo session. Document extraction runs in the PHP app.'};
  }
  if(action==='slide_layout'){
    if(d.iteration.status!=='draft')throw Error('Create a new iteration to edit slides.');
    d.slide_layout??=[];const row=id=>{let s=d.slide_layout.find(s=>s.slide_id===id);if(!s){s={slide_id:id,hidden:0,deleted:0,position:null};d.slide_layout.push(s);}return s;};
    if(body.operation==='reorder')body.order.forEach((id,n)=>row(id).position=n);
    else {const s=row(body.slide_id);if(['hide','show'].includes(body.operation))s.hidden=body.operation==='hide'?1:0;else s.deleted=body.operation==='delete'?1:0;}
    return {ok:true};
  }
  if(action==='studio_theme'){studioTheme=body.theme;return {studio_theme:studioTheme};}
  if(action==='category'){d.files.find(x=>x.asset_id===body.asset_id).category=body.category;return {ok:true};}
  if(action==='theme'){d.project.theme=body.theme;d.iteration.theme=JSON.stringify(body.theme);return {ok:true};}
  if(action==='save_budget'){const row={...body,id:body.id||uid(),amount_cents:body.kind==='unknown'||body.amount===''?null:Math.round(Number(body.amount)*100),included:body.parent_id&&body.included?1:0,parent_id:body.parent_id||null,source_version_id:null};const old=d.budget.find(x=>x.id===row.id);if(old)Object.assign(old,row);else d.budget.push(row);return {ok:true};}
  if(action==='save_contact'){d.contacts.push({...body,id:uid()});return {ok:true};}
  if(action==='comment'){d.comments.push({id:uid(),slide:body.slide,body:body.body,author:'Demo viewer',created_at:stamp()});d.events.unshift({id:uid(),actor:'Demo viewer',type:'change_requested',detail:body.body,created_at:stamp()});return {ok:true};}
  if(action==='view_event')return {ok:true};
  if(action==='share'){d.iteration.status='shared';return {links:body.emails.map(email=>({email,sent:false,url:location.origin+location.pathname+'#/view/demo',id:uid()}))};}
  if(action==='budget_chat'){
    const q=body.question.toLowerCase(),unknown=d.budget.filter(x=>x.amount_cents===null),included=d.budget.filter(x=>Number(x.included));let answer;
    if(/unknown|unspecified|missing|tbd|not included/.test(q))answer=unknown.length?'Still to be specified: '+unknown.map(x=>x.label).join(' and ')+'. These are excluded from the known total. Their final prices may change the project total; amounts already included in a parent quote are not added again.':'There are no recorded unknown costs. Check the source quotes for exclusions.';
    else if(/subquote|included|double|vendor|contractor/.test(q))answer=included.length?included.map(x=>x.label+' (€'+(x.amount_cents/100).toLocaleString('en-IE')+')').join(' and ')+' are already included in their parent quote. They are shown for transparency and are not added twice.':'No included subquotes are recorded.';
    else if(/kitchen/.test(q)){const k=d.budget.find(x=>/kitchen/i.test(x.label));answer=k?`${k.label} is €${(k.amount_cents/100).toLocaleString('en-IE')}, quoted by ${k.vendor}. ${k.note}`:'No separate kitchen cost is recorded.';}
    else if(/total|budget|cost|how much/.test(q))answer='The known total is €'+(total(d.budget)/100).toLocaleString('en-IE')+'. '+unknown.length+' costs are still unspecified. Vendor subquotes included in their parent quote are not added again.';
    else answer='This demo helper can explain the known total, kitchen quote, unknown costs and included subquotes. Connect AI in the PHP app for free-form questions grounded in your actual budget.';
    return {answer,mode:'budget_helper',sources:d.files.filter(x=>x.category==='budget').map(x=>x.id)};
  }
  if(action==='image_edit')throw Error('Image generation needs the AI connection in the PHP app. The original will be preserved and the result saved as another version.');
  if(action==='revoke_share')return {ok:true};
  if(action==='logout')return {ok:true};
  throw Error('This action is available in the PHP application.');
}
