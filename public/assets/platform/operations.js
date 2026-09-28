import {eq,and,oneOf,now,uuid,contains} from './client.js';
import {unavailable,PlatformError} from './transport.js';
const pick=(value,keys)=>Object.fromEntries(keys.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));
const bool=v=>v===true||v===1||v==='1'||v==='on'||v==='true';
const cents=v=>{if(v===''||v==null)return null;const n=Number(String(v).replace(',','.'));if(!Number.isFinite(n))throw Error('Enter a valid price.');return Math.round(n*100);};
const text=(v,max=2000)=>String(v??'').trim().slice(0,max);
export function installOperations(c){
  const q=(...a)=>c.query(...a),write=(...a)=>c.write(...a),rm=(...a)=>c.remove(...a),upsert=(...a)=>c.upsert(...a);
  const person=()=> 'user:'+c.identity.email.toLowerCase();
  const slideFilter=key=>/^[0-9a-f-]{36}$/i.test(key)?['OR',eq('slide_key',key),eq('id',key)]:eq('slide_key',key);
  const first=async(table,filter)=>{const result=await q(table,filter);if(!result[0])throw new PlatformError('Record not found.',{status:404});return result[0];};
  const editable=async id=>{const iteration=await first('iterations',eq('id',id));if(iteration.locked)throw new PlatformError('This iteration is locked.',{status:409});return iteration;};
  const natural=async(table,filter,data)=>{const existing=await q(table,filter,['id']);return c.mutation(table,data,existing[0]?.id);};
  const slide=async(iteration,key)=>first('presentation_slides',and(eq('iteration_id',iteration),slideFilter(String(key).replace(/^visual-/,''))));
  c.operations={
    session:()=>c.bootstrap(),
    switch_studio:b=>c.bootstrap(b.studio_id,{refresh:true}),
    logout:async()=>{c.session=null;c.tenant=null;c.files.clear();globalThis.location?.assign('/logout');return {ok:true};},
    create_studio:async b=>{const form=document.createElement('form');form.method='POST';form.action='/administrations/create';const input=document.createElement('input');input.name='companyname';input.value=b.name;form.append(input);document.body.append(form);form.submit();return new Promise(()=>{});},
    destinations:async()=>{const session=await c.bootstrap();return {studios:session.studios,projects:[],conversations:[],platform_notice:'Shared destinations require client and guest tenant profiles.'};},
    profile:async()=>{const profile=(await q('person_profiles',eq('person_key',person())))[0]||{name:c.session?.user.name||c.identity.firstname};return {profile:{...profile,avatar:profile.avatar_file_id?c.fileUrl(profile.avatar_file_id):''}};},
    save_profile:async b=>{await upsert('person_profiles',eq('person_key',person()),{person_key:person(),...pick(b,['name','language','color']),...Object.fromEntries(['email_comments','email_mentions_only'].filter(k=>k in b).map(k=>[k,bool(b[k])]))});const result=await c.operations.profile();if(c.session){c.session.profile=result.profile;c.session.user.profile=result.profile;}return result;},
    complete_studio_setup:async b=>{const data={...pick(b,['name','language','business_type']),setup_completed_at:now()};if(c.studioRecord)await write('studios',data,c.studioRecord.id);else await write('studios',{...data,created_at:now(),theme:{}});return c.bootstrap(c.tenant,{refresh:true});},
    studio_theme:async b=>{if(!c.studioRecord)throw Error('Complete studio setup first.');let theme=b.theme||{};if(typeof theme==='string')theme=JSON.parse(theme);await write('studios',{theme,...pick(b,['name','language'])},c.studioRecord.id);c.session=null;return {studio_theme:theme};},
    projects:async b=>{
      const spec=(id,table,filter,fields,extra={})=>c.querySpec(id,table,filter,fields,{nperpage:1000,...extra});
      const search=text(b.search,500);
      const d=await c.graph([
        spec('projects','projects',and(eq('studio_id',c.studioRecord?.id??null),eq('archived',bool(b.archived)),contains(['name','location','description'],search))),
        spec('iterations','iterations',oneOf('project_id','{{projects.entities[].id}}'),['project_id','number','title','status','locked'],{orderBy:[{field:'iterations.number',direction:'desc'}]}),
        spec('pins','project_pins',eq('user_id',c.identity.user_id)),spec('members','project_members',oneOf('project_id','{{projects.entities[].id}}')),
        spec('covers','iteration_covers',oneOf('iteration_id','{{iterations.entities[].id}}'),['iteration_id','slide_id']),
        spec('slides','presentation_slides',oneOf('iteration_id','{{iterations.entities[].id}}'),['iteration_id','slide_key','type','source_version_id','page_number','image_number','image_version_id','position']),
        spec('links','iteration_files',oneOf('iteration_id','{{iterations.entities[].id}}'),['iteration_id','version_id','category']),
        spec('versions','file_versions',['OR',oneOf('id','{{links.entities[].version_id}}'),oneOf('id','{{slides.entities[].source_version_id}}')],['mime','data_file_id','preview_file_id']),
        spec('imageVersions','slide_image_versions',oneOf('id','{{slides.entities[].image_version_id}}'),['data_file_id']),
        spec('pages','document_pages',oneOf('version_id','{{slides.entities[].source_version_id}}'),['version_id','number','preview_file_id']),
        spec('images','document_images',oneOf('version_id','{{slides.entities[].source_version_id}}'),['version_id','page_number','number','data_file_id']),
      ],{completeScope:{studio_id:c.studioRecord?.id}});
      return {projects:d.projects.map(p=>{const iteration=d.iterations.find(i=>i.project_id===p.id),cover=iteration&&c.media.cover(iteration.id,d.slides,d.links,d.covers.find(r=>r.iteration_id===iteration.id)?.slide_id);c.media.covers.set(p.id,cover?.fileId||null);return {...p,iteration_id:iteration?.id,iteration,iteration_number:iteration?.number||0,status:iteration?.status||'draft',pinned:d.pins.some(r=>r.project_id===p.id),members:d.members.filter(r=>r.project_id===p.id).map(r=>({id:r.user_id,name:r.user_id===c.identity.user_id?c.session.user.name:'Project member'})),has_cover:!!cover,cover_key:cover?.fileId||'',cover_url:cover?.url||'',processing:false,can_edit:!!p._platform?.writablefields?.length};}),studio_empty:!search&&!bool(b.archived)&&d.projects.length===0};
    },
    studio_users:async b=>{
      const search=String(b.search||'').trim(),scope=eq('studio_id',c.studioRecord?.id??null);
      const specs=[c.querySpec('members','studio_members',scope,['user_id','role','display_name','phone'])];
      if(search)specs.push(c.querySpec('names','studio_members',and(scope,contains(['display_name'],search)),['user_id']));
      specs.push(c.querySpec('users','users',and(oneOf('id','{{members.entities[].user_id}}'),search?['OR',contains(['name','email'],search),oneOf('id','{{names.entities[].user_id}}')]:[]),['name','email']));
      const d=await c.graph(specs,{completeScope:{studio_id:c.studioRecord?.id,directory:true}});
      return {users:d.users.map(user=>{const member=d.members.find(m=>m.user_id===user.id);return {...user,name:member.display_name||user.name,role:member.role,phone:member.phone};}),total:d.members.length};
    },
    create_project:async b=>{
      if(!text(b.name,160))throw Error('Give your project a name.');
      if(!c.studioRecord)throw new PlatformError('Complete studio setup before creating a project.',{status:409});
      if(b.billing_intent||b.archive_project_id)throw unavailable('project_coverage','Creating a project with a billing purchase needs the Stripe integration.');
      const pid=uuid(),iid=uuid(),calls=[...await c.identityLink(),c.mutation('projects',{id:pid,name:text(b.name,160),description:text(b.description),location:text(b.location,160),visibility:b.visibility||'team',user_id:c.identity.user_id,studio_id:c.studioRecord.id,theme:{},created_at:now(),archived:false}),c.mutation('project_members',{project_id:pid,user_id:c.identity.user_id}),c.mutation('iterations',{id:iid,project_id:pid,number:1,title:'First concept',status:'draft',locked:false,theme:{},created_at:now()})];
      for(const email of [...new Set(b.emails||[])]){calls.push(c.mutation('project_client_members',{project_id:pid,email:email.toLowerCase(),name:email.split('@')[0],created_at:now()}));calls.push(c.mutation('contacts',{project_id:pid,email:email.toLowerCase(),name:email.split('@')[0],role:'Client',phone:''}));}
      calls.push(...await c.packMutations(iid,{name:b.name,location:b.location},b.starting_pack));await c.atomic(calls);return {project_id:pid,iteration_id:iid};
    },
    project:b=>c.project(b.id,b.iteration),
    deck:async b=>{const iteration=await first('iterations',eq('id',b.iteration||c.selected?.iteration));return c.project(iteration.project_id,iteration.id);},
    client_project:async()=>{throw unavailable('client_project','Client presentation access needs the platform client profile and shared-iteration row filters.');},
    project_settings:async b=>{const calls=[],data=pick(b,['name','location','description','visibility','language']);if('archived'in b)data.archived=bool(b.archived);if(Object.keys(data).length)calls.push(c.mutation('projects',data,b.project_id));if('deadline'in b||'tags'in b)calls.push(await natural('project_details',eq('project_id',b.project_id),{project_id:b.project_id,...pick(b,['deadline','tags'])}));await c.atomic(calls);return {ok:true};},
    pin_project:async b=>{const filter=and(eq('project_id',b.project_id),eq('user_id',c.identity.user_id));if(bool(b.pinned))await upsert('project_pins',filter,{project_id:b.project_id,user_id:c.identity.user_id});else for(const r of await q('project_pins',filter,['id']))await rm('project_pins',r.id);return {ok:true};},
    theme:async b=>{await editable(b.iteration);await write('iterations',{theme:b.theme},b.iteration);return {ok:true};},
    lock_iteration:async b=>{if(c.session?.studio?.role!=='admin')throw new PlatformError('Only studio admins can lock iterations.',{status:403});await write('iterations',{locked:bool(b.locked)},b.iteration);return {ok:true};},
    new_iteration:async b=>{
      const base=await first('iterations',eq('id',b.iteration)),all=await q('iterations',eq('project_id',base.project_id),['number']);const iid=uuid(),number=Math.max(...all.map(i=>i.number))+1;
      const tables=['iteration_files','presentation_slides','system_slides','slide_content','slide_layout','slide_sections','slide_groups','iteration_covers','iteration_pack_items','budget_items','open_questions','check_source_roles','check_source_cache','slide_image_history','budget_link_suggestions'];
      const sources=await Promise.all(tables.map(t=>q(t,eq('iteration_id',base.id))));const ids=new Map(sources.flat().map(r=>[r.id,uuid()]));const calls=[c.mutation('iterations',{id:iid,project_id:base.project_id,number,title:b.title||'Design development '+number,status:'draft',locked:false,theme:base.theme||{},created_at:now()})],relationships=[];
      // Copy all parents before FK-dependent rows and restore nested budget links last.
      for(const table of ['budget_items','open_questions',...tables.filter(t=>!['budget_items','open_questions'].includes(t))]){
        for(const row of sources[tables.indexOf(table)]){const {_platform,...copy}=row;copy.id=ids.get(row.id);copy.iteration_id=iid;
          if(table==='budget_items'&&copy.parent_id){relationships.push(c.mutation(table,{parent_id:ids.get(copy.parent_id)||null},copy.id));copy.parent_id=null;}
          if(table==='budget_link_suggestions'){copy.child_id=ids.get(copy.child_id);copy.parent_id=ids.get(copy.parent_id);}
          calls.push(c.mutation(table,copy));
        }
      }
      const budgetIds=sources[tables.indexOf('budget_items')].map(r=>r.id);
      for(const table of ['budget_choices','confirmation_budget_links'])for(const row of await q(table,oneOf('budget_item_id',budgetIds))){const {_platform,...copy}=row;copy.id=uuid();copy.budget_item_id=ids.get(copy.budget_item_id);calls.push(c.mutation(table,copy));}
      for(const question of sources[tables.indexOf('open_questions')])if((question.accepted||question.published)&&!question.dismissed){const root=uuid(),qid=ids.get(question.id);calls.push(c.mutation('comments',{id:root,iteration_id:iid,parent_id:null,author:c.identity.email,body:question.question,slide:'open-questions',answered:!!question.resolved,created_at:now()}),c.mutation('communication_threads',{comment_id:root,title:question.question}),c.mutation('communication_audiences',{root_id:root,audience:question.published?'shared':'studio'}),c.mutation('communication_topics',{root_id:root,question_id:qid,type:question.item_type==='action'?'todo':'conversation',assignee_name:question.responsible||''}),c.mutation('checklist_threads',{iteration_id:iid,question_id:qid,root_id:root}));}
      calls.push(...relationships);await c.atomic(calls);return {id:iid,notice:'Iteration copied. Automatic consistency checks are not yet connected on the platform.'};
    },
    category:async b=>{await editable(b.iteration);const links=await q('iteration_files',and(eq('iteration_id',b.iteration),['OR',eq('version_id',b.id||b.version_id),eq('asset_id',b.asset_id||b.id)]));await c.atomic(links.map(r=>c.mutation('iteration_files',{category:b.category},r.id)));return {ok:true};},
    save_contact:async b=>{await write('contacts',{project_id:b.project_id,...pick(b,['name','email','phone','role'])},b.id);return {ok:true};},
    save_project_client:async b=>{await upsert('project_client_members',and(eq('project_id',b.project_id),eq('email',text(b.email).toLowerCase())),{project_id:b.project_id,name:b.name||b.email,email:text(b.email).toLowerCase(),created_at:now()});return {ok:true};},
    remove_project_client:async()=>{throw unavailable('remove_project_client','Removing a client must also revoke its presentation and conversation grants. That platform workflow is not configured.');},
    save_project_person:async b=>{
      const group=b.group||b.kind;
      if(group==='team'){const user=await first('users',eq('id',b.key||b.user_id));await upsert('project_team_contacts',and(eq('project_id',b.project_id),eq('user_id',user.id)),{project_id:b.project_id,user_id:user.id,name:user.name,role:b.role||'',phone:b.phone||''});}
      else if(group==='clients'){await c.operations.save_project_client(b);await upsert('contacts',and(eq('project_id',b.project_id),eq('email',b.email)),{project_id:b.project_id,email:b.email,name:b.name,phone:b.phone||'',role:'Client'});}
      else await write('contacts',{project_id:b.project_id,...pick(b,['name','email','phone','role'])},b.key||b.id);
      return {ok:true};
    },
    remove_project_person:async b=>{const group=b.group||b.kind;if(group==='clients'||group==='client')return c.operations.remove_project_client(b);if(group==='team'){const members=await q('project_members',eq('project_id',b.project_id));if(members.length<=1)throw Error('A project must retain at least one team member.');const remove=members.find(m=>m.user_id===b.key);if(!remove)throw Error('Team member not found.');const details=await q('project_team_contacts',and(eq('project_id',b.project_id),eq('user_id',b.key)));await c.atomic([c.deletion('project_members',remove.id),...details.map(r=>c.deletion('project_team_contacts',r.id))]);}else await rm('contacts',b.key||b.id);return {ok:true};},
    project_testimonials:async b=>({testimonials:await q('project_testimonials',eq('project_id',b.project_id))}),
    project_testimonial_save:async b=>{await write('project_testimonials',{project_id:b.project_id,...pick(b,['name','title','content','video']),approved:bool(b.approved),updated_at:now()},b.id);return {ok:true};},
    project_testimonial_delete:async b=>{await rm('project_testimonials',b.id);return {ok:true};},
    save_budget:async b=>{
      await editable(b.iteration);if(!text(b.label))throw Error('Give the cost a name.');
      if(b.id&&(await q('confirmation_budget_links',eq('budget_item_id',b.id),['id'])).length)throw Error('A confirmed budget adjustment cannot be edited.');
      const range=b.price_type==='range',data={iteration_id:b.iteration,label:text(b.label,300),vendor:text(b.vendor,200),note:text(b.note),parent_id:b.parent_id||null,included:!!b.parent_id&&bool(b.included),is_optional:bool(b.is_optional),kind:b.price_type==='unknown'?'unknown':b.kind||'estimate',amount_cents:range||b.price_type==='unknown'?null:cents(b.amount),min_amount_cents:range?cents(b.min_amount):null,max_amount_cents:range?cents(b.max_amount):null,relationship_locked:true,relationship_origin:'manual',relationship_evidence:''};
      if(range&&(data.min_amount_cents==null||data.max_amount_cents==null||data.min_amount_cents<0||data.max_amount_cents<data.min_amount_cents))throw Error('Enter a valid budget range.');
      const items=await q('budget_items',eq('iteration_id',b.iteration),['parent_id']);let parent=data.parent_id;const seen=new Set([b.id]);while(parent){if(seen.has(parent))throw Error('A quote cannot contain itself.');seen.add(parent);const row=items.find(r=>r.id===parent);if(!row)throw Error('Parent quote not found.');parent=row.parent_id;}
      await write('budget_items',data,b.id);return {ok:true};
    },
    budget_choice:async b=>{const item=await first('budget_items',eq('id',b.id||b.budget_item_id));await editable(item.iteration_id);const value={budget_item_id:item.id,updated_at:now(),updated_by:c.identity.email};if('selected'in b){if(!item.is_optional)throw Error('This cost is not optional.');value.selected=bool(b.selected);}if('range_percent'in b){const n=Number(b.range_percent);if(!Number.isInteger(n)||n<0||n>100)throw Error('Choose a range from 0 to 100.');value.range_percent=n;}await upsert('budget_choices',eq('budget_item_id',item.id),value);return {ok:true};},
    set_project_cover:async b=>{await editable(b.iteration);await upsert('iteration_covers',eq('iteration_id',b.iteration),{iteration_id:b.iteration,slide_id:b.slide_id});return {ok:true};},
    slide_layout:async b=>{await editable(b.iteration);if(b.operation==='section'){await upsert('slide_sections',and(eq('iteration_id',b.iteration),eq('slide_id',b.slide_id)),{iteration_id:b.iteration,slide_id:b.slide_id,section:b.section});return {ok:true};}if(['hide','show'].includes(b.operation))b={...b,hidden:b.operation==='hide'};if(b.operation==='delete')b={...b,deleted:true};const rows=await q('slide_layout',eq('iteration_id',b.iteration)),calls=[];if(b.order)for(const [position,key] of b.order.entries())calls.push(c.mutation('slide_layout',{iteration_id:b.iteration,slide_id:key,position},rows.find(r=>r.slide_id===key)?.id));else{const key=b.slide_id||b.id;calls.push(c.mutation('slide_layout',{iteration_id:b.iteration,slide_id:key,...Object.fromEntries(['hidden','deleted'].filter(k=>k in b).map(k=>[k,bool(b[k])]))},rows.find(r=>r.slide_id===key)?.id));}await c.atomic(calls);return {ok:true};},
    add_system_slide:async b=>{await editable(b.iteration);const key='system-'+uuid();await write('system_slides',{iteration_id:b.iteration,slide_key:key,type:b.type});return {id:key};},
    add_slide_group:async b=>{await editable(b.iteration);const key='group-'+uuid(),groups=await q('slide_groups',eq('iteration_id',b.iteration));await write('slide_groups',{iteration_id:b.iteration,group_key:key,label:b.label||b.name,position:groups.length,deleted:false});return {id:key};},
    remove_slide_group:async b=>{await editable(b.iteration);const row=await first('slide_groups',and(eq('iteration_id',b.iteration),eq('group_key',b.id||b.group)));await write('slide_groups',{deleted:true},row.id);return {ok:true};},
    reorder_slide_groups:async b=>{await editable(b.iteration);const groups=await q('slide_groups',eq('iteration_id',b.iteration));await c.atomic((b.order||[]).map((key,position)=>{const row=groups.find(g=>g.group_key===key);if(!row)throw Error('Group not found.');return c.mutation('slide_groups',{position},row.id);}));return {ok:true};},
    save_slide:async b=>{
      await editable(b.iteration);const key=b.slide_id?.replace(/^visual-/,''),existing=key?(await q('presentation_slides',and(eq('iteration_id',b.iteration),slideFilter(key))))[0]:null;
      if(key&&!existing){await upsert('slide_content',and(eq('iteration_id',b.iteration),eq('slide_id',b.slide_id)),{iteration_id:b.iteration,slide_id:b.slide_id,title:b.title,description:b.description||''});return {id:b.slide_id};}
      const metadata={...(existing?.metadata||{}),...(b.metadata||{})};if(b.video_url){const url=new URL(b.video_url);if(!['www.youtube.com','youtube.com','youtu.be'].includes(url.hostname))throw Error('Use a YouTube link.');metadata.video={provider:'youtube',id:url.hostname==='youtu.be'?url.pathname.slice(1):url.searchParams.get('v'),url:url.href};}
      let source={};if(b.image_source?.startsWith('slide:')){const original=await slide(b.iteration,b.image_source.slice(6));source=pick(original,['source_version_id','page_number','image_number','image_version_id']);}else if(b.image_source?.startsWith('file:'))source={source_version_id:b.image_source.slice(5),page_number:0,image_number:0};
      const logical=existing?.slide_key||key||uuid(),calls=[c.mutation('presentation_slides',{iteration_id:b.iteration,slide_key:logical,title:text(b.title,160),description:text(b.description,1600),type:b.type||existing?.type||'text',situation:b.situation||existing?.situation||'unknown',metadata,...source,...(!existing?{manual:true,position:Date.now()}: {})},existing?.id)];
      if(b.section)calls.push(await natural('slide_sections',and(eq('iteration_id',b.iteration),eq('slide_id','visual-'+logical)),{iteration_id:b.iteration,slide_id:'visual-'+logical,section:b.section}));await c.atomic(calls);return {id:logical};
    },
    remove_avatar:async()=>{await upsert('person_profiles',eq('person_key',person()),{person_key:person(),avatar_file_id:null});return c.operations.profile();},
    remove_project_logo:async b=>{await c.atomic((await q('project_logos',eq('project_id',b.project_id))).map(r=>c.deletion('project_logos',r.id)));return {ok:true};},
    remove_studio_logo:async()=>{await c.atomic((await q('studio_logos',eq('studio_id',c.studioRecord.id))).map(r=>c.deletion('studio_logos',r.id)));return {ok:true};},
    save_slide_motion:async b=>{await editable(b.iteration);const row=await slide(b.iteration,b.slide_id),metadata={...row.metadata};if(b.mode==='none')delete metadata.motion;else if(b.mode==='simple'){if(!['pan-right','pan-left','zoom-in','zoom-out'].includes(b.movement)||![4,6,8,10,12].includes(Number(b.duration)))throw Error('Choose a valid movement and duration.');metadata.motion={mode:'simple',movement:b.movement,duration:Number(b.duration),source_key:[row.source_version_id||'',Number(row.page_number)||0,Number(row.image_number)||0,row.image_version_id||''].join(':')};}else throw unavailable('ai_motion_apply','Generated motion requires the platform motion pipeline.');await write('presentation_slides',{metadata},row.id);return {ok:true};},
    review_subquote:async b=>{await editable(b.iteration);const suggestion=await first('budget_link_suggestions',eq('id',b.id));if(suggestion.status!=='pending')throw Error('This suggestion has already changed.');const calls=[c.mutation('budget_link_suggestions',{status:'dismissed'},suggestion.id)];if(b.decision!=='dismiss'){if(!['included','extra'].includes(b.decision))throw Error('Choose how the quotes relate.');const child=await first('budget_items',eq('id',suggestion.child_id));if(child.parent_id||child.relationship_locked)throw Error('The quote relationship has changed.');if((await q('confirmation_budget_links',oneOf('budget_item_id',[child.id,suggestion.parent_id]))).length)throw Error('Confirmed budget adjustments cannot be relinked.');calls.push(c.mutation('budget_items',{parent_id:suggestion.parent_id,included:b.decision==='included',relationship_origin:'manual',relationship_locked:true,relationship_evidence:suggestion.evidence||''},child.id));}await c.atomic(calls);return {ok:true};},
    unlink_subquote:async b=>{await editable(b.iteration);const item=await first('budget_items',eq('id',b.id));if(item.relationship_origin!=='auto')throw Error('This automatic link has already changed.');await write('budget_items',{parent_id:null,included:false,relationship_origin:'manual',relationship_locked:true,relationship_evidence:''},item.id);return {ok:true};},
    select_slide_image:async b=>{await editable(b.iteration);const row=await slide(b.iteration,b.slide_id);await write('presentation_slides',{image_version_id:b.image_version_id||null},row.id);return {ok:true};},
    resolve_slide:async b=>{const s=await first('presentation_slides',and(eq('slide_key',b.slide.replace(/^visual-/,'')),b.iteration?eq('iteration_id',b.iteration):[]));const i=await first('iterations',eq('id',s.iteration_id));return {project_id:i.project_id,iteration_id:i.id};},
    document_page:async b=>{const p=await first('document_pages',and(eq('version_id',b.id),eq('number',Number(b.page))));return {...p,text:p.text||p.extracted_text||''};},
    save_open_question:async b=>{
      await editable(b.iteration);const id=b.id||uuid(),old=b.id?await first('open_questions',eq('id',b.id)):null,operation=b.operation||'save';let data={edited:true};
      if(operation==='accept')Object.assign(data,{accepted:true,dismissed:false});
      else if(['dismiss','restore','resolve','reopen'].includes(operation)){if(!old)throw Error('Question not found.');data[['dismiss','restore'].includes(operation)?'dismissed':'resolved']=['dismiss','resolve'].includes(operation);}
      else if(operation==='save'){if(!text(b.question))throw Error('Write a question first.');Object.assign(data,{iteration_id:b.iteration,...pick(b,['question','reason','answer','kind','item_type','responsible']),published:bool(b.published),accepted:true,...(!old?{id,question_key:uuid(),created_at:now(),origin:'designer',dismissed:false,resolved:false,citations:[]}: {})});}
      else throw Error('Unknown question operation.');
      const calls=[c.mutation('open_questions',data,old?.id)],saved={...old,...data},links=await q('checklist_threads',and(eq('iteration_id',b.iteration),eq('question_id',id)));
      if(!links.length&&(saved.accepted||saved.published)){const root=uuid();calls.push(c.mutation('comments',{id:root,iteration_id:b.iteration,author:c.identity.email,body:saved.question,slide:'open-questions',parent_id:null,answered:!!saved.resolved,created_at:now()}),c.mutation('communication_threads',{comment_id:root,title:saved.question}),c.mutation('communication_audiences',{root_id:root,audience:saved.published?'shared':'studio'}),c.mutation('communication_topics',{root_id:root,question_id:id,type:saved.item_type==='action'?'todo':'conversation',assignee_name:saved.responsible||''}),c.mutation('checklist_threads',{iteration_id:b.iteration,question_id:id,root_id:root}));}
      if(['resolve','reopen'].includes(operation))for(const link of links)calls.push(c.mutation('comments',{answered:operation==='resolve'},link.root_id));
      await c.atomic(calls);return {id};
    },
    add_client_question:async b=>{await editable(b.iteration);await write('open_questions',{iteration_id:b.iteration,question:b.question,question_key:uuid(),created_at:now(),origin:'client',published:true,dismissed:false});return {ok:true};},
    review_consistency_finding:async b=>{await write('consistency_findings',pick(b,['status']),b.id);return {ok:true};},
    check_source_role:async b=>{await editable(b.iteration);await upsert('check_source_roles',and(eq('iteration_id',b.iteration),eq('source_key',b.source_key)),{iteration_id:b.iteration,source_key:b.source_key,role:b.role});return {ok:true};},
    studio_starting_pack:async()=>{if(!c.studioRecord)return {items:[]};const d=await c.graph([c.querySpec('items','studio_pack_items',eq('studio_id',c.studioRecord.id)),c.querySpec('versions','studio_pack_versions',oneOf('item_id','{{items.entities[].id}}'))]);return {items:d.items.map(i=>({...i,versions:d.versions.filter(v=>v.item_id===i.id)}))};},
    project_starting_pack:b=>q('iteration_pack_items',eq('iteration_id',b.iteration)).then(items=>({items})),
    archive_pack_item:async b=>{await write('studio_pack_items',{archived:bool(b.archived??true)},b.id);return {ok:true};},
    save_pack_item:async b=>{if(!c.studioRecord)throw Error('Complete studio setup first.');await write('studio_pack_items',{studio_id:c.studioRecord.id,...pick(b,['kind','position','slide_type']),default_enabled:bool(b.default_enabled)},b.id);return {ok:true};},
    product_feedback_submit:async b=>{const result=await write('product_feedback',{...pick(b,['category','area','detail','goal','impact','frequency','screen','app_version','request_key']),user_id:c.identity.user_id,studio_id:c.studioRecord?.id,created_at:now(),updated_at:now(),status:'new',contact_allowed:bool(b.contact_allowed)});return {id:result.id};},
    product_feedback_inbox:()=>q('product_feedback').then(items=>({items})),
    product_feedback_review:async b=>{await write('product_feedback',{...pick(b,['status','theme','notes']),updated_at:now()},b.id);return {ok:true};},
    drive_status:async()=>({configured:false,connected:false,email:'',unavailable_reason:'The Drive connector is not configured on the platform.'}),
  };
  // These operations have side effects that cannot be reproduced by table writes.
  // Reject before writing any rows; never fall back to the old PHP API.
  const gaps={
    billing:'Stripe billing is not connected to the platform.',billing_invoices:'Stripe invoices are not connected to the platform.',project_access:'Project billing and coverage are not configured on the platform.',
    project_members:'The platform needs a tenant-member lookup before project membership can be edited.',
    share:'Presentation invitation delivery and client access profiles are not configured.',revoke_share:'Share revocation needs a platform workflow that also revokes derived conversation access.',conversation_revoke:'Derived conversation access revocation is not configured.',
    confirmation_decide:'Confirmation decisions and their protected budget adjustments need an atomic platform workflow.',
    prepare_delete_project:'Permanent deletion needs platform cleanup and confirmation integration.',delete_project:'Permanent deletion needs platform cleanup and confirmation integration.',
  };
  for(const [action,reason] of Object.entries(gaps))c.operations[action]=async()=>{throw unavailable(action,reason);};
}
