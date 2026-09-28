import {systemSlides} from '../slides.js';
import {schema} from './schema.js';
import {MediaIndex} from './media.js';
import {studioMappings as configuredStudioMappings} from './config.js';
import {PlatformError,unavailable,assertResult,rows,sendPlatformBatch,createRowQueue} from './transport.js';
import {budgetAmount,budgetLineTotal,budgetTotal} from '../budget.js';
import {installOperations} from './operations.js';
import {installCommunication} from './communication.js';
import {installPacks} from './packs.js';
export const eq=(field,value)=>[field,'=',value];
export const contains=(fields,value)=>{const text=String(value??'').trim().slice(0,500),pattern='%'+text.replace(/[\\%_]/g,'\\$&')+'%';return text?['OR',...fields.map(field=>[field,'ilike',pattern])]:[];};
export const oneOf=(field,values)=>[field,'IN',values];
export const and=(...filters)=>['AND',...filters.filter(f=>f?.length)];
export const uuid=()=>crypto.randomUUID();
export const now=()=>new Date().toISOString();
const object=value=>{if(typeof value==='string'){try{return JSON.parse(value);}catch{return {};}}return value||{};};
export class PlatformClient {
  constructor({fetcher=(...args)=>fetch(...args),transport,studioMappings}={}){
    this.fetcher=fetcher;this.transport=transport||((args)=>sendPlatformBatch({...args,fetcher:this.fetcher}));this.queue=createRowQueue({transport:this.transport});this.tenant=null;this.session=null;this.files=new Map();this.media=new MediaIndex((id,size)=>this.fileUrl(id,false,size));this.selected=null;
    this.studioMappings=studioMappings??configuredStudioMappings;
    installOperations(this);installCommunication(this);installPacks(this);
  }
  context(){if(!this.tenant)throw new PlatformError('Select a platform workspace first.',{status:400});return {tenant:this.tenant,userId:this.identity?.user_id};}
  fields(table,fields){if(!schema[table])throw Error(`Unknown platform table: ${table}`);const selected=fields||Object.keys(schema[table]).filter(f=>!['extracted_text','token_hash'].includes(f)&&!f.endsWith('_enc'));for(const field of selected)if(!schema[table][field])throw Error(`Unknown field ${table}.${field}`);return [...new Set(['id',...selected])];}
  querySpec(id,table,filter=[],fields,extra={}){return {id,resource:table,params:{selectList:this.fields(table,fields),filter,page:1,nperpage:100,orderBy:[{field:table+'.id',direction:'asc'}],...extra}};}
  async query(table,filter=[],fields,extra={},scope=this.context()){
    const params=this.querySpec('q',table,filter,fields,extra).params;let all=[],page=1;
    for(;;){const body=await this.queue.request({...scope,resource:table,params:{...params,page}}),part=rows(body);all.push(...part);this.media.remember(table,part);if(!this.more(body,part.length,params.nperpage))return all;if(!part.length)throw Error('Platform pagination did not advance.');page++;if(page>10000)throw Error('Platform query exceeded the pagination limit.');}
  }
  more(body,length,size){return body.other&&'nextPage'in body.other?body.other.nextPage!==null:body.other?.hasmore??(length>=size);}
  async graph(specs,{completeScope}={}){
    const scope=this.context();
    let results,feed;
    if(completeScope){
      const body=assertResult((await this.transport({...scope,calls:[{id:'view',resource:'projects:readView',method:'QUERY',params:{...completeScope,queries:specs}}]}))[0]);
      feed=body.other?.feed;
      const returned=body.other?.results,ids=new Set(specs.map(s=>s.id));
      if(!Array.isArray(returned)||returned.length!==specs.length||new Set(returned.map(r=>r.responseid)).size!==specs.length||returned.some(r=>!ids.has(r.responseid)))throw Error('Incomplete project view response.');
      const byId=new Map(returned.map(r=>[r.responseid,r]));results=specs.map(s=>byId.get(s.id));
      if(results.some(r=>r.body?.other?.nextPage!==null))throw Error('Project view pagination must be completed by the server.');
    }else results=await this.transport({...scope,calls:specs});
    if(this.tenant!==scope.tenant)throw Object.assign(Error('This data request was superseded.'),{superseded:true});
    const data=feed?{_feed:feed}:{},expanded=new Set();
    for(let n=0;n<specs.length;n++){
      const spec=specs[n],body=assertResult(results[n]);
      if(spec.resource.includes(':')){data[spec.id]=rows(body);continue;}
      let part=rows(body);
      const parents=[...JSON.stringify(spec.params.filter).matchAll(/\{\{(\w+)\./g)].map(m=>m[1]);
      const substitute=value=>{
        if(Array.isArray(value))return value.map(substitute);
        if(typeof value!=='string')return value;
        const match=value.match(/^\{\{(\w+)\.entities\[(\d*)\]\.(\w+)\}\}$/);if(!match)return value;
        const source=data[match[1]]||[];return match[2]===''?source.map(row=>row[match[3]]).filter(v=>v!=null):source[Number(match[2])]?.[match[3]]??null;
      };
      if(parents.some(p=>expanded.has(p))){part=await this.query(spec.resource,substitute(spec.params.filter),spec.params.selectList,{...spec.params,filter:substitute(spec.params.filter)},scope);expanded.add(spec.id);}
      else if(this.more(body,part.length,spec.params.nperpage)){
        let page=2;expanded.add(spec.id);
        for(;;){const next=await this.queue.request({...scope,resource:spec.resource,params:{...spec.params,filter:substitute(spec.params.filter),page}}),chunk=rows(next);part.push(...chunk);if(!this.more(next,chunk.length,spec.params.nperpage))break;if(!chunk.length||page++>10000)throw Error('Invalid platform pagination.');}
      }
      data[spec.id]=part;this.media.remember(spec.resource,part);
    }return data;
  }
  async write(table,data,id){
    this.fields(table,Object.keys(data));
    return this.queue.request({...this.context(),resource:table+(id?'/'+encodeURIComponent(id):''),method:id?'PATCH':'POST',params:id?data:{id:uuid(),...data}});
  }
  async remove(table,id){return this.queue.request({...this.context(),resource:table+'/'+encodeURIComponent(id),method:'DELETE'});}
  mutation(table,data,id){this.fields(table,Object.keys(data));return {id:'w'+uuid().replaceAll('-',''),resource:table+(id?'/'+id:''),method:id?'PATCH':'POST',params:id?data:{id:uuid(),...data},group:'transaction'};}
  deletion(table,id){return {id:'d'+uuid().replaceAll('-',''),resource:table+'/'+id,method:'DELETE',params:{},group:'transaction'};}
  async atomic(calls){if(!calls.length)return [];if(calls.length>100)throw unavailable('large_transaction','This change exceeds the supported client transaction size. Split it into smaller changes.');return (await this.transport({...this.context(),calls})).map(assertResult);}
  async identityLink(){return [{id:'identity',resource:'users:ensureIdentity',method:'POST',params:{},group:'transaction'}];}
  async upsert(table,filter,data){const existing=await this.query(table,filter,['id']);if(existing.length>1)throw Error(`Multiple ${table} rows match this change.`);return this.write(table,data,existing[0]?.id);}
  async direct(path,options={}){const response=await this.fetcher(path,{credentials:'same-origin',...options});let result;try{result=await response.json();}catch{throw new PlatformError('The platform returned an unexpected response.',{status:response.status});}if(!response.ok)throw new PlatformError(result.message||result.error||'Platform request failed.',{status:response.status});return result;}
  async bootstrap(tenant,{refresh=false}={}){
    if(this.pendingWrites&&tenant&&String(tenant)!==this.tenant)throw new PlatformError('Wait for the current save before switching workspace.',{status:409});
    if(this.session&&!refresh&&(!tenant||String(tenant)===this.tenant))return structuredClone(this.session);
    this.identity=await this.direct('/whoami');
    if(!this.identity.user_id){this.tenant=null;return {user:null,studios:[],capabilities:{platform:true}};}
    const tenants=this.identity.tenants||[];
    const route=globalThis.location?.pathname.split('/')[1];
    const chosen=tenants.find(t=>String(t.id)===String(tenant||route)||t.slug===(tenant||route))||(!tenant?tenants[0]:null);
    if(tenant&&!chosen)throw new PlatformError('This account cannot access that platform workspace. Old studio URLs must be replaced with platform tenant URLs.',{status:403});
    this.tenant=chosen?String(chosen.id):null;this.files.clear();this.media.clear();this.selected=null;
    const user={id:this.identity.user_id,email:this.identity.email,name:[this.identity.firstname,this.identity.lastname].filter(Boolean).join(' ')};
    const profiles=this.identity.profiles||[]; // /whoami profiles are for the first tenant only.
    const role=chosen&&String(chosen.id)===String(tenants[0]?.id)&&profiles.some(p=>['studioadmin','studio_owner','studio_admin'].includes(p))?'admin':'member';
    const mappedStudio=chosen?this.studioMappings[String(chosen.id)]:null;
    let record=null,profile={},preference={},logos=[];
    if(chosen){const data=await this.graph([
      {id:'identity',resource:'users:ensureIdentity',method:'POST',params:{}},
      this.querySpec('studios','studios',mappedStudio?eq('id',mappedStudio):[],['name','language','theme','business_type','setup_completed_at']),
      this.querySpec('profile','person_profiles',eq('person_key','user:'+user.email.toLowerCase())),
      this.querySpec('preferences','studio_preferences',eq('user_id','{{identity.entities[0].id}}')),
      this.querySpec('logos','studio_logos',oneOf('studio_id','{{studios.entities[].id}}'),['studio_id','data_file_id','mime']),
    ]);
      if(data.studios.length>1)throw new PlatformError('This tenant contains multiple studio records. Configure its studio ID in public/assets/platform/config.js.',{status:409});
      if(mappedStudio&&!data.studios.length)throw new PlatformError('The configured studio record is missing or inaccessible. Check public/assets/platform/config.js.',{status:409});
      record=data.studios[0]||null;profile=data.profile[0]||{};preference=data.preferences[0]||{};logos=data.logos.filter(logo=>logo.studio_id===record?.id);
    }
    profile={...profile,avatar:profile.avatar_file_id?this.fileUrl(profile.avatar_file_id):''};user.profile=profile;this.studioRecord=record;
    const studio=chosen?{...record,id:String(chosen.id),record_id:record?.id,name:record?.name||chosen.companyname,role,setup_completed_at:record?.setup_completed_at??null,has_logo:logos.length>0,logo:logos[0]?this.fileUrl(logos[0].data_file_id):''}:null;
    this.session={user,studio,studios:tenants.map(t=>({id:String(t.id),name:t.companyname,role:String(t.id)===String(chosen?.id)?role:'member'})),profile,studio_theme:object(preference.theme||record?.theme),csrf:null,unread_count:0,capabilities:{platform:true,batch_reads:true,batch_json:true,communication:true},billing:null};
    return structuredClone(this.session);
  }
  fileUrl(id,download=false,size=''){if(size&&!['small','large'].includes(size))throw new Error('Unknown image size');return id&&this.tenant?`/${encodeURIComponent(this.tenant)}/userfiles/${encodeURIComponent(id)}${download?'/download':size?'?size='+size:''}`:'';}
  async request(action,params={}){const op=this.operations[action];if(!op)throw unavailable(action);const read=['session','switch_studio','create_studio','logout','projects','project','deck','destinations','profile','document_page','project_testimonials','studio_starting_pack','project_starting_pack','comments_feed','attention','mention_people','drive_status'].includes(action);if(!read)this.pendingWrites=(this.pendingWrites||0)+1;try{return await op(params);}finally{if(!read)this.pendingWrites--;}}
  async resources({calls}){
    const projectCalls=calls.filter(c=>c.resource.startsWith('project:'));let view=null;
    if(projectCalls.length){const {projectId,iterationId,...filters}=projectCalls[0].params;view=await this.project(projectId,iterationId,projectCalls.map(c=>c.resource.split(':')[1]),filters);}
    return Promise.all(calls.map(async c=>({responseid:c.id,code:200,body:{other:c.resource==='app:context'?await this.bootstrap():c.resource==='app:status'?await this.status():view}})));
  }
  async status(){const key='user:'+this.identity.email.toLowerCase();const d=await this.graph([this.querySpec('comments','comments',[],['author']),this.querySpec('reads','comment_reads',eq('person_key',key),['comment_id'])]);return {unread_count:d.comments.filter(r=>r.author!==this.identity.email&&!d.reads.some(read=>read.comment_id===r.id)).length};}
  async project(projectId,iterationId,names=['presentation'],{fileSearch='',fileCategories=null,communication=null}={}){
    const scope=this.context();const presentation=names.includes('presentation'),wanted=name=>presentation||names.includes(name),specs=[];
    const add=(id,table,filter,fields,extra)=>specs.push(this.querySpec(id,table,filter,fields,{nperpage:1000,...extra}));
    const iterationRef=iterationId||'{{iterations.entities[0].id}}',i=()=>eq('iteration_id',iterationRef),p=()=>eq('project_id',projectId);
    add('project','projects',and(eq('id',projectId),eq('studio_id',this.studioRecord?.id??null)));add('details','project_details',p());
    add('iterations','iterations',p(),undefined,{orderBy:[{field:'iterations.number',direction:'desc'},{field:'iterations.id',direction:'asc'}]});
    add('members','project_members',p());
    const needFiles=wanted('slides')||wanted('files')||wanted('budget')||wanted('overview')||wanted('communication');
    const needBudget=wanted('slides')||wanted('budget')||wanted('overview'),overviewOnly=!presentation&&names.includes('overview');
    const hasSlides=wanted('slides')||wanted('files')||wanted('overview');
    const fileView=!presentation&&names.includes('files');
    if(needFiles)add('links','iteration_files',and(i(),fileView&&Array.isArray(fileCategories)?oneOf('category',fileCategories):[]));
    if(wanted('slides')||wanted('files')||wanted('overview')){
      add('slides','presentation_slides',i(),overviewOnly?['iteration_id','slide_key','title','type','source_version_id','page_number','image_number','image_version_id','position']:undefined);add('layout','slide_layout',i());add('covers','iteration_covers',i());
      if(wanted('slides')){add('content','slide_content',i());add('sections','slide_sections',i());add('groups','slide_groups',i());add('system','system_slides',i());add('media','slide_media',p(),['data_file_id','project_id']);}
    }
    if(needFiles)add('versions','file_versions',and(hasSlides&&!fileView?['OR',oneOf('id','{{links.entities[].version_id}}'),oneOf('id','{{slides.entities[].source_version_id}}')]:oneOf('id','{{links.entities[].version_id}}'),fileView?contains(['name'],fileSearch):[]),overviewOnly?['name','mime','preview_file_id','data_file_id']:undefined);
    if(hasSlides){
      add('pages','document_pages',oneOf('version_id','{{versions.entities[].id}}'),['version_id','number','metadata','preview_file_id']);
      add('images','document_images',oneOf('version_id','{{versions.entities[].id}}'),['version_id','page_number','number','data_file_id','metadata']);
      add('imageVersions','slide_image_versions',['OR',oneOf('id','{{slides.entities[].image_version_id}}'),oneOf('source_version_id','{{versions.entities[].id}}')]);
    }
    if(needFiles&&!overviewOnly)add('history','file_versions',oneOf('asset_id','{{links.entities[].asset_id}}'));
    if(needBudget){add('budget','budget_items',i(),overviewOnly?['parent_id','included','is_optional','amount_cents','min_amount_cents','max_amount_cents']:undefined);add('choices','budget_choices',oneOf('budget_item_id','{{budget.entities[].id}}'));}
    if(wanted('budget')){add('suggestions','budget_link_suggestions',i());add('budgetChecks','budget_match_checks',i());}
    if(wanted('people')||wanted('overview')||wanted('communication')){add('clients','project_client_members',p());if(wanted('people')||wanted('communication')){add('contacts','contacts',p());add('team','project_team_contacts',p());add('memberUsers','users',oneOf('id','{{members.entities[].user_id}}'),['name','email']);add('shares','shares',i());add('testimonials','project_testimonials',p());}}
    if(wanted('communication'))this.communicationSpecs(add,iterationRef,communication?.selected);
    const d=await this.graph(specs,{completeScope:{project_id:projectId,...(!presentation&&wanted('communication')?{feed:communication||{}}:{})}}),project=d.project[0];if(this.tenant!==scope.tenant)throw Object.assign(Error('This data request was superseded.'),{superseded:true});if(!project)throw new PlatformError('Project not found.',{status:404});
    const iteration=iterationId?d.iterations.find(r=>r.id===iterationId):d.iterations[0];if(!iteration)throw new PlatformError('Iteration not found.',{status:404});
    const ancestors=new Map([...(d.history||[]),...(d.versions||[])].map(v=>[v.id,v]));
    const result={project:{...project,...d.details[0],id:project.id,theme:object(iteration.theme||project.theme)},iteration,iterations:d.iterations,
      can_edit:!!project._platform?.writablefields?.length&&d.members.some(m=>m.user_id===this.identity.user_id),members:d.members.map(m=>({id:m.user_id})),jobs:[],branding:{name:this.session?.studio?.name||'',logo:this.session?.studio?.logo||'',theme:this.session?.studio_theme||{}},billing:null,enhancements:{available:0},motion_allowance:{available:0}};
    if(d.versions){result.files=d.links.map(link=>{const version=d.versions.find(v=>v.id===link.version_id);if(!version)return null;const file={...version,category:link.category,asset_id:link.asset_id,metadata:object(version.metadata),has_preview:!!version.preview_file_id,url:this.fileUrl(version.data_file_id),preview_url:this.fileUrl(version.preview_file_id),history:[],pages:(d.pages||[]).filter(p=>p.version_id===version.id).map(p=>({...p,has_preview:!!p.preview_file_id,metadata:object(p.metadata),images:(d.images||[]).filter(image=>image.version_id===p.version_id&&image.page_number===p.number)}))};this.files.set(version.id,file);const seen=new Set();for(let v=version;v&&!seen.has(v.id);v=ancestors.get(v.parent_id)){seen.add(v.id);file.history.push({...v});}return file;}).filter(Boolean);result.file_count=result.files.length;}
    if(d.slides){result.slides=d.slides.map(s=>({...s,id:s.slide_key||s.id,_row_id:s.id,metadata:object(s.metadata),preview_url:this.media.url({action:'slide_image',iteration:iteration.id,slide_id:s.slide_key||s.id})}));result.slide_layout=d.layout||[];result.cover_slide_id=d.covers[0]?.slide_id||null;}
    if(d.content){result.slide_content=d.content;result.slide_sections=d.sections;const defaults={story:'The story',current:'The current situation',moodboards:'The moodboards',designs:'The designs',budget:'The budget',questions:'Checklist'};const ordered=Object.fromEntries(d.groups.sort((a,b)=>a.position-b.position).map(g=>[g.group_key,g.label]));result.slide_groups=ordered.story?{...ordered,...Object.fromEntries(Object.entries(defaults).filter(([k])=>!(k in ordered)))}:{...defaults,...ordered};for(const g of d.groups)if(g.deleted)delete result.slide_groups[g.group_key];result.system_slides=d.system.map(s=>({...s,id:s.slide_key||s.id,_row_id:s.id}));}
    if(d.budget){result.budget=d.budget.map(b=>{const c=d.choices.find(c=>c.budget_item_id===b.id);return {...b,selected:!b.is_optional||!!c?.selected,range_percent:Number(c?.range_percent||0)};});for(const b of result.budget){b.effective_amount_cents=budgetAmount(b);b.line_total_cents=budgetLineTotal(b,result.budget);}Object.assign(result,{total_cents:budgetTotal(result.budget),budget_min_cents:budgetTotal(result.budget,0),budget_max_cents:budgetTotal(result.budget,100),subquote_check:d.budgetChecks?.[0]||null,subquote_suggestions:d.suggestions||[]});}
    if(d.clients){result.clients=d.clients;result.contacts=d.contacts||[];result.team=(d.memberUsers||[]).map(user=>({...user,...(d.team||[]).find(t=>t.user_id===user.id),id:user.id,user_id:user.id}));result.people={team:result.team.map(r=>({...r,key:r.user_id||r.id,email:r.email||'',profile:{name:r.name}})),clients:d.clients.map(r=>({...r,key:r.email,profile:{name:r.name}})),other:result.contacts.filter(r=>r.role!=='Client'&&!d.clients.some(p=>p.email===r.email)).map(r=>({...r,key:r.id,profile:{name:r.name}}))};result.shares=d.shares||[];result.testimonials=d.testimonials||[];result.presentation_people=result.people;}
    if(d.comments){Object.assign(result,this.assembleCommunication(d,iteration,project));result.communication.recipients=Object.entries(result.people||{}).flatMap(([group,people])=>people.filter(p=>p.email).map(p=>({...p,group:group==='clients'?'client':group,available:group==='team',invitable:false})));result.communication.iteration_files={[iteration.id]:result.files||[]};}
    if(wanted('overview')){const visible=(result.slides||[]).filter(s=>!d.layout?.some(l=>l.slide_id==='visual-'+s.id&&(l.hidden||l.deleted)));const visual=s=>({id:s.source_version_id,name:s.title,slide_id:s.id,page_number:s.page_number,image_number:s.image_number,slide_image_version:s.image_version_id,iteration_id:iteration.id,preview_url:s.preview_url});result.overview={file_count:result.file_count||0,slide_count:visible.length+6,cover:visible.length?visual(visible.find(s=>s.id===result.cover_slide_id)||visible[0]):null,previews:visible.slice(0,4).map(s=>({id:'visual-'+s.id,title:s.title,visual:visual(s)})),client_count:d.clients?.length||0,client_name:d.clients?.[0]?.name||'',pending_confirmation_count:0};}
    if(presentation){result.changes=[];result.previous_total_cents=null;result.capabilities=this.session?.capabilities;}return result;
  }
  communicationSpecs(add,iteration,selected=null){
    if(selected)add('selectedComment','comments',and(eq('iteration_id',iteration),eq('id',selected)),['parent_id']);
    const threadIds=selected?[selected,'{{selectedComment.entities[0].parent_id}}']:null;
    add('comments','comments',and(eq('iteration_id',iteration),selected?['OR',oneOf('id',threadIds),oneOf('parent_id',threadIds)]:[]));add('threads','communication_threads',oneOf('comment_id','{{comments.entities[].id}}'));add('audiences','communication_audiences',oneOf('root_id','{{comments.entities[].id}}'));add('topics','communication_topics',oneOf('root_id','{{comments.entities[].id}}'));
    add('attachments','comment_attachments',oneOf('comment_id','{{comments.entities[].id}}'));add('mentions','comment_mentions',oneOf('comment_id','{{comments.entities[].id}}'));add('reads','comment_reads',and(oneOf('comment_id','{{comments.entities[].id}}'),eq('person_key','user:'+this.identity.email.toLowerCase())));add('confirmations','comment_confirmations',oneOf('comment_id','{{comments.entities[].id}}'));add('questions','open_questions',eq('iteration_id',iteration));add('findings','consistency_findings',eq('iteration_id',iteration));add('runs','consistency_runs',eq('iteration_id',iteration));
    // Resolve every preview in this same view request. Keep history metadata for
    // annotations pinned to an earlier source/image version.
    const scope=iteration?eq('iteration_id',iteration):oneOf('iteration_id','{{comments.entities[].iteration_id}}');
    add('previewLinks','iteration_files',scope,['iteration_id','asset_id','version_id']);
    add('previewSlides','presentation_slides',scope,['iteration_id','slide_key','title','type','source_version_id','page_number','image_number','image_version_id']);
    add('previewVersions','file_versions',['OR',oneOf('id','{{previewSlides.entities[].source_version_id}}'),oneOf('id','{{previewLinks.entities[].version_id}}'),oneOf('asset_id','{{previewLinks.entities[].asset_id}}')],['mime','data_file_id','preview_file_id']);
    add('previewPages','document_pages',oneOf('version_id','{{previewVersions.entities[].id}}'),['version_id','number','preview_file_id']);
    add('previewImages','document_images',oneOf('version_id','{{previewVersions.entities[].id}}'),['version_id','page_number','number','data_file_id']);
    add('previewImageVersions','slide_image_versions',['OR',oneOf('id','{{previewSlides.entities[].image_version_id}}'),oneOf('source_version_id','{{previewVersions.entities[].id}}')],['source_version_id','data_file_id']);
    add('previewLayout','slide_layout',scope,['iteration_id','slide_id','hidden','deleted']);
    add('previewContent','slide_content',scope,['iteration_id','slide_id','title']);
    add('previewSystem','system_slides',scope,['iteration_id','slide_key','type']);

  }
  assembleCommunication(d,iteration,project){
    const iterations=d.iterations||[iteration],builtins=systemSlides();
    const iterationSlides=Object.fromEntries(iterations.map(i=>{
      const slides=[...builtins,...(d.previewSystem||[]).filter(s=>s.iteration_id===i.id).map(s=>({...builtins.find(b=>b.type===s.type),id:s.slide_key||s.id})),...(d.previewSlides||[]).filter(s=>s.iteration_id===i.id).map(s=>({id:'visual-'+(s.slide_key||s.id),title:s.title,type:s.type}))];
      return [i.id,slides.filter(s=>!(d.previewLayout||[]).some(l=>l.iteration_id===i.id&&l.slide_id===s.id&&Number(l.deleted))).map(s=>({...s,title:(d.previewContent||[]).find(c=>c.iteration_id===i.id&&c.slide_id===(s.systemType||s.id))?.title||s.title}))];
    }));
    const publicSlides=Object.fromEntries(Object.entries(iterationSlides).map(([iid,slides])=>[iid,slides.filter(s=>!(d.previewLayout||[]).some(l=>l.iteration_id===iid&&l.slide_id===s.id&&Number(l.hidden)))]));
    const comments=d.comments.map(c=>{
      const root=c.parent_id||c.id,topic=d.topics.find(t=>t.root_id===root),thread=d.threads.find(t=>t.comment_id===root),sourceIteration=iterations.find(i=>i.id===c.iteration_id),sourceProject=(d.projects||[project]).find(p=>p.id===sourceIteration?.project_id)||project;
      const source=iterationSlides[c.iteration_id]?.find(s=>s.id===c.slide),annotation=object(c.annotation);
      return {...c,project_id:c.project_id||sourceIteration?.project_id||project.id,project_name:c.project_name||sourceProject?.name,iteration_number:c.iteration_number||sourceIteration?.number,slide_title:c.slide_title||source?.title,preview_url:this.media.commentUrl({...c,annotation}),name:c.author,unread:c.unread??(c.author!==this.identity.email&&!d.reads.some(r=>r.comment_id===c.id)),confirmation:d.confirmations.find(r=>r.comment_id===c.id),annotation,mentions:d.mentions.filter(m=>m.comment_id===c.id),audience:d.audiences.find(a=>a.root_id===root)?.audience||'studio',thread_details:topic?{...topic,title:thread?.title}:null,attachments:d.attachments.filter(a=>a.comment_id===c.id)};
    });
    const communication={...d._feed,enabled:true,actor:this.identity.email,comments,items:d.questions,confirmations:d.confirmations,attachments:d.attachments,iterations,people:[],recipients:[],threads:d.threads,iteration_files:{},iteration_slides:iterationSlides,public_iteration_slides:publicSlides,project_id:project.id};
    return {comments,open_questions:d.questions,communication,checks:{findings:d.findings,runs:d.runs,sources:[]},confirmations:d.confirmations};
  }
}
export const platform=new PlatformClient();
