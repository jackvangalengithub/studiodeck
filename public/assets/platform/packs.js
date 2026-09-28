import {eq,and,oneOf,now,uuid} from './client.js';
import {unavailable} from './transport.js';
export function installPacks(c){
  const library=async()=>{if(!c.studioRecord)return {items:[],can_manage:false};const d=await c.graph([c.querySpec('items','studio_pack_items',and(eq('studio_id',c.studioRecord.id),eq('archived',false))),c.querySpec('versions','studio_pack_versions',oneOf('item_id','{{items.entities[].id}}'))]);return {can_manage:c.session?.studio?.role==='admin',items:d.items.map(item=>{const version=d.versions.filter(v=>v.item_id===item.id).sort((a,b)=>b.revision-a.revision)[0];return {...item,...version,id:item.id,version_id:version?.id};}).filter(i=>i.version_id)};};
  c.packMutations=async(iteration,project,versionIds)=>{
    if(!versionIds?.length)return [];
    const versions=await c.query('studio_pack_versions',oneOf('id',versionIds)),items=await c.query('studio_pack_items',oneOf('id',versions.map(v=>v.item_id))),calls=[];
    if(versions.length!==new Set(versionIds).size)throw Error('A starting-pack version is no longer available.');
    const tokens={studio_name:c.session.studio.name,project_name:project.name,project_location:project.location||'',designer_name:c.session.user.name,designer_email:c.identity.email};
    const expand=value=>String(value||'').replace(/\{\{(\w+)\}\}/g,(match,key)=>tokens[key]||match);
    for(const v of versions){const item=items.find(i=>i.id===v.item_id);if(!item||item.archived)throw Error('A starting-pack item has been archived.');
      if(item.kind==='document'||v.data_file_id)throw unavailable('pack_file_link','File-backed templates need platform file-sharing integration before they can be applied.');
      const title=expand(v.title),body=expand(v.body);let key;
      if(['intro','contacts'].includes(item.slide_type)){key=item.slide_type;calls.push(c.mutation('slide_content',{iteration_id:iteration,slide_id:key,title,description:body}));}
      else{key=uuid();calls.push(c.mutation('presentation_slides',{iteration_id:iteration,slide_key:key,type:item.slide_type||'text',manual:true,title,description:body,metadata:{},position:item.position||0,situation:'unknown'}));key='visual-'+key;}
      calls.push(c.mutation('iteration_pack_items',{iteration_id:iteration,item_id:item.id,version_id:v.id,slide_id:key,excluded:false,fingerprint:''}));
    }return calls;
  };
  Object.assign(c.operations,{
    studio_starting_pack:library,
    save_pack_item:async b=>{
      if(!c.studioRecord)throw Error('Complete studio setup first.');const id=b.id||uuid(),versions=b.id?await c.query('studio_pack_versions',eq('item_id',b.id)):[],latest=versions.sort((a,b)=>b.revision-a.revision)[0];
      if(b.base_version&&latest?.id!==b.base_version)throw Error('This template changed. Reopen it before saving.');
      await c.atomic([c.mutation('studio_pack_items',{id,studio_id:c.studioRecord.id,kind:b.kind||'slide',slide_type:b.slide_type||'text',position:Number(b.position||0),default_enabled:!!b.default_enabled,archived:false},b.id),c.mutation('studio_pack_versions',{item_id:id,revision:(latest?.revision||0)+1,title:b.title||'',body:b.body||'',data_file_id:latest?.data_file_id||null,name:latest?.name||'',mime:latest?.mime||'',created_at:now()})]);return {ok:true};
    },
    project_starting_pack:async b=>{const [lib,applied]=await Promise.all([library(),c.query('iteration_pack_items',eq('iteration_id',b.iteration))]);return {items:applied,snapshot:applied.map(i=>i.version_id).sort().join(','),available_slides:lib.items.filter(i=>i.kind==='slide'&&!applied.some(a=>a.item_id===i.id)).map(i=>({...i,preview_title:i.title}))};},
    add_project_pack_slide:async b=>{const iteration=(await c.query('iterations',eq('id',b.iteration)))[0];if(!iteration||iteration.locked)throw Error('Choose an editable iteration.');const project=(await c.query('projects',eq('id',iteration.project_id)))[0];await c.atomic(await c.packMutations(iteration.id,project,[b.version_id]));return {ok:true};},
    apply_project_pack:async b=>{const iteration=(await c.query('iterations',eq('id',b.iteration)))[0];if(!iteration||iteration.locked)throw Error('Choose an editable iteration.');const project=(await c.query('projects',eq('id',iteration.project_id)))[0];await c.atomic(await c.packMutations(iteration.id,project,b.versions||b.version_ids||[]));return {ok:true};},
  });
}
