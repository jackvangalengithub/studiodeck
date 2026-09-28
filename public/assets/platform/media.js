// File metadata arrives with a view. Rendering resolves URLs locally, never by
// looking up each image through another data-API request.
export class MediaIndex {
  constructor(fileUrl){this.fileUrl=fileUrl;this.clear();}
  clear(){this.tables=new Map();this.covers=new Map();}
  remember(table,rows){let stored=this.tables.get(table);if(!stored){stored=new Map();this.tables.set(table,stored);}for(const row of rows)stored.set(row.id,{...stored.get(row.id),...row});}
  row(table,id){return this.tables.get(table)?.get(id);}
  find(table,test){return [...(this.tables.get(table)?.values()||[])].find(test);}
  fileId(p){
    if(p.file_id)return p.file_id;
    const preview=f=>f&&(f.preview_file_id||(f.mime?.startsWith('image/')?f.data_file_id:null));
    switch(p.action){
      case 'file':case 'conversation_file':{const f=this.row('file_versions',p.id);return p.preview?preview(f):f?.data_file_id;}
      case 'document_page':return Number(p.image)>0?this.find('document_images',r=>r.version_id===p.id&&Number(r.page_number)===Number(p.page)&&Number(r.number)===Number(p.image))?.data_file_id:this.find('document_pages',r=>r.version_id===p.id&&Number(r.number)===Number(p.page))?.preview_file_id;
      case 'slide_image':{
        if(p.image_version_id&&!p.original)return this.row('slide_image_versions',p.image_version_id)?.data_file_id;
        const key=String(p.slide_id||'').replace(/^visual-/,'');
        const s=this.find('presentation_slides',r=>r.iteration_id===p.iteration&&(r.slide_key===key||r.id===key));
        if(!s)return undefined;
        if(s.image_version_id&&!p.original)return this.row('slide_image_versions',s.image_version_id)?.data_file_id;
        if(Number(s.page_number)>0)return this.fileId({action:'document_page',id:s.source_version_id,page:s.page_number,image:s.image_number});
        return preview(this.row('file_versions',s.source_version_id));
      }
      case 'slide_media':return this.row('slide_media',p.media_id)?.data_file_id;
      case 'project_cover':case 'destination_cover':return this.covers.get(p.project_id);
      case 'project_testimonial_photo':return this.row('project_testimonials',p.id)?.data_file_id;
      case 'pack_file':return this.row('studio_pack_versions',p.version)?.data_file_id;
      case 'product_feedback_image':return this.find('product_feedback_images',r=>r.feedback_id===p.id)?.data_file_id;
      default:return undefined;
    }
  }
  url(p){const id=this.fileId(p);return id?this.fileUrl(id,p.size):'';}
  commentUrl(comment){
    const pin=comment.annotation;
    if(pin?.source_version_id||pin?.image_version_id){
      if(pin.image_version_id)return this.url({action:'slide_image',image_version_id:pin.image_version_id,size:'small'});
      if(Number(pin.page_number)>0)return this.url({action:'document_page',id:pin.source_version_id,page:pin.page_number,image:pin.image_number,size:'small'});
      return this.url({action:'file',id:pin.source_version_id,preview:1,size:'small'});
    }
    const source=String(comment.slide||'').match(/^source-(.+)-(\d+)$/);
    if(source)return this.url(Number(source[2])?{action:'document_page',id:source[1],page:source[2],size:'small'}:{action:'file',id:source[1],preview:1,size:'small'});
    return this.url({action:'slide_image',iteration:comment.iteration_id,slide_id:comment.slide,size:'small'});
  }
  cover(iteration,slides,links,selected){
    const candidates=slides.filter(s=>s.iteration_id===iteration&&['render','photo','moodboard','fullphoto','drawing','floorplan','other'].includes(s.type)&&!links.some(l=>l.iteration_id===iteration&&l.version_id===s.source_version_id&&l.category==='legal'));
    const rank=s=>s.type==='render'?0:s.type==='photo'?1:2;
    const selectedKey=String(selected||'').replace(/^visual-/,'');
    const chosen=candidates.find(s=>s.slide_key===selectedKey||s.id===selectedKey);
    const ordered=[...(chosen?[chosen]:[]),...candidates.filter(s=>['render','photo','moodboard','fullphoto'].includes(s.type)).sort((a,b)=>rank(a)-rank(b)||(a.position||0)-(b.position||0)||a.id.localeCompare(b.id))];
    for(const s of ordered){const fileId=this.fileId({action:'slide_image',iteration,slide_id:s.slide_key||s.id});if(fileId)return {slide:s,fileId,url:this.fileUrl(fileId,'small')};}
    // Older imports can contain linked image files before slide extraction.
    for(const link of links.filter(l=>l.iteration_id===iteration&&l.category!=='legal')){const f=this.row('file_versions',link.version_id);if(f?.mime?.startsWith('image/')){const fileId=f.preview_file_id||f.data_file_id;if(fileId)return {fileId,url:this.fileUrl(fileId,'small')};}}
    return null;
  }
}
