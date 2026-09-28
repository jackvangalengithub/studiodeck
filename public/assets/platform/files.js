import {platform,eq,and} from './client.js';
import {uploadSelectionError} from '../upload-limits.js';
import {unavailable,PlatformError} from './transport.js';
const values=params=>params instanceof URLSearchParams?Object.fromEntries(params):params;
export function platformUrl(params){const p=values(params);const cached=platform.media.url(p);if(cached)return cached;if(p.action==='studio_logo')return platform.session?.studio?.logo||'';const f=platform.files.get(p.id);if(f&&(p.action==='file'||p.action==='conversation_file'))return platform.fileUrl(p.preview&&f.preview_file_id?f.preview_file_id:f.data_file_id);return '/platform-unavailable/'+encodeURIComponent(p.action||'file');}
export async function platformFetch(params,options={}){
  const p=values(params);let fileId=platform.media.fileId(p);
  if(fileId)return platform.fetcher(platform.fileUrl(fileId),{...options,headers:{},credentials:'same-origin'});
  if(p.cached_only)throw new PlatformError('This view has no preview for this image.',{status:404});
  const lookup=async(table,filter,field)=>{const rows=await platform.query(table,filter,[field]);return rows[0]?.[field];};
  if(!fileId)switch(p.action){
    case 'file':case 'conversation_file':{const f=(await platform.query('file_versions',eq('id',p.id),['data_file_id','preview_file_id']))[0];fileId=p.preview?(f?.preview_file_id||f?.data_file_id):f?.data_file_id;break;}
    case 'document_page':fileId=p.image?await lookup('document_images',and(eq('version_id',p.id),eq('page_number',Number(p.page)),eq('number',Number(p.image))),'data_file_id'):await lookup('document_pages',and(eq('version_id',p.id),eq('number',Number(p.page))),'preview_file_id');break;
    case 'slide_media':fileId=await lookup('slide_media',eq('id',p.media_id),'data_file_id');break;
    case 'slide_image':{
      if(p.image_version_id&&!p.original)fileId=await lookup('slide_image_versions',eq('id',p.image_version_id),'data_file_id');
      else{const s=(await platform.query('presentation_slides',and(eq('iteration_id',p.iteration),eq('slide_key',p.slide_id.replace(/^visual-/,'')))))[0];if(!s)break;if(s.image_version_id&&!p.original)fileId=await lookup('slide_image_versions',eq('id',s.image_version_id),'data_file_id');else if(s.page_number)return platformFetch({action:'document_page',id:s.source_version_id,page:s.page_number,image:s.image_number},options);else return platformFetch({action:'file',id:s.source_version_id,preview:1},options);}break;
    }
    case 'studio_logo':fileId=await lookup('studio_logos',eq('studio_id',platform.studioRecord?.id),'data_file_id');break;
    case 'product_feedback_image':fileId=await lookup('product_feedback_images',eq('feedback_id',p.id),'data_file_id');break;
    case 'project_testimonial_photo':fileId=await lookup('project_testimonials',eq('id',p.id),'data_file_id');break;
    case 'pack_file':fileId=await lookup('studio_pack_versions',eq('id',p.version),'data_file_id');break;
    case 'project_cover':case 'destination_cover':{const iterations=await platform.query('iterations',eq('project_id',p.project_id),['id','number'],{orderBy:[{field:'iterations.number',direction:'desc'}]});const iteration=p.iteration||iterations[0]?.id;const cover=(await platform.query('iteration_covers',eq('iteration_id',iteration),['slide_id']))[0];if(cover)return platformFetch({action:'slide_image',iteration,slide_id:cover.slide_id},options);break;}
    default:throw unavailable(p.action);
  }
  if(!fileId)throw new PlatformError('This file or preview is not available on the platform.',{status:404});
  return platform.fetcher(platform.fileUrl(fileId),{...options,headers:{},credentials:'same-origin'});
}
export async function uploadPlatformFiles(client,form){
  const files=[...form.values()].filter(v=>v instanceof Blob&&v.size&&v.name);
  if(!files.length)throw Error('Choose a file.');const error=uploadSelectionError(files);if(error)throw Error(error);const replace=form.get('replace_asset');if(replace&&files.length!==1)throw Error('Replace one file at a time.');
  const iteration=(await client.query('iterations',eq('id',form.get('iteration'))))[0];if(!iteration||iteration.locked)throw Error('Choose an editable iteration.');
  const base64=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
  const attachments=await Promise.all(files.map(async f=>({filename:f.name,mimetype:f.type||'application/octet-stream',content_base64:await base64(f)})));
  const response=await client.direct(`/${client.tenant}/userfiles`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attachments})});
  if(response.rejected?.length)throw new PlatformError('Some files were rejected by the platform. No project links were created; successful uploads remain private.',{status:422,details:response.rejected});
  const calls=[],ids=[];
  const current=replace?(await client.query('iteration_files',and(eq('iteration_id',iteration.id),eq('asset_id',replace))))[0]:null;
  const previous=current?(await client.query('file_versions',eq('id',current.version_id),['number']))[0]:null;
  for(const [index,attachment] of response.attachments.entries()){
    const asset=replace||crypto.randomUUID(),version=crypto.randomUUID(),category=form.get('category')||'other';ids.push(version);
    if(!replace)calls.push(client.mutation('assets',{id:asset,project_id:iteration.project_id,category,created_at:new Date().toISOString()}));
    calls.push(client.mutation('file_versions',{id:version,asset_id:asset,parent_id:current?.version_id||null,number:(previous?.number||0)+1,name:attachment.filename,mime:attachment.mimetype,size:attachment.size,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await files[index].arrayBuffer()))).map(b=>b.toString(16).padStart(2,'0')).join(''),data_file_id:attachment.file_id,metadata:{},created_at:new Date().toISOString()}));
    calls.push(client.mutation('iteration_files',{iteration_id:iteration.id,asset_id:asset,version_id:version,category},current?.id));
  }
  await client.atomic(calls);return {ids,uploaded:ids.length,processing:false,notice:'Files are stored. Team/client file sharing and automatic processing still need platform integration.'};
}
export async function uploadDecoration(client,action,form){
  const file=[...form.values()].find(v=>v instanceof Blob&&v.size&&v.name);if(!file)throw Error('Choose an image.');const error=uploadSelectionError([file]);if(error)throw Error(error);
  if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Choose a PNG, JPEG or WebP image.');
  const content_base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
  const result=await client.direct(`/${client.tenant}/userfiles`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({attachments:[{filename:file.name,mimetype:file.type,content_base64}]})});
  const stored=result.attachments?.[0];if(!stored||result.rejected?.length)throw Error('The platform could not store this image.');
  if(action==='upload_avatar'){const key='user:'+client.identity.email.toLowerCase();await client.upsert('person_profiles',eq('person_key',key),{person_key:key,avatar_file_id:stored.file_id});client.session=null;return client.operations.profile();}
  const project=action==='upload_project_logo',table=project?'project_logos':'studio_logos',field=project?'project_id':'studio_id',id=project?form.get('project_id'):client.studioRecord.id;
  await client.upsert(table,eq(field,id),{[field]:id,data_file_id:stored.file_id,mime:stored.mimetype});client.session=null;return {ok:true,notice:'Image saved. Sharing it with other users still needs platform file-permission integration.'};
}
