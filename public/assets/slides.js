export const visualTypes={moodboard:'Moodboard',photo:'Photo',render:'3D render',drawing:'Drawing',floorplan:'Floorplan',other:'Image',fullphoto:'Full photo'};
export const situations={before:'Before · existing situation',concept:'Concept · proposed design',after:'After · completed project',reference:'Reference / inspiration',unknown:'Situation to review'};
export function visualSlides(data){
  const files=new Map((data.files||[]).map(f=>[f.id,f]));
  const records=data.slides?.length?data.slides:(data.files||[]).filter(f=>f.mime.startsWith('image/')).map(f=>({id:'legacy-'+f.id,source_version_id:f.id,type:f.category==='moodboard'?'moodboard':/render|3d/i.test(f.name)?'render':'photo',situation:'unknown',title:f.name,metadata:{confidence:'low'},legacy:true}));
  return records.flatMap(s=>{
    if(s.type==='text')return [{id:'visual-'+s.id,type:'text',title:s.title,description:s.description,icon:'file',record:s}];
    const f=files.get(s.source_version_id)||(Number(s.manual)&&s.source_version_id?{id:s.source_version_id,name:s.source_name||s.title,mime:s.source_mime||'image/jpeg'}:null);if(!f||f.category==='legal')return [];
    const type=visualTypes[s.type]?s.type:'other';
    return [{id:'visual-'+s.id,type,title:s.title||visualTypes[type],icon:type==='moodboard'?'leaf':['drawing','floorplan'].includes(type)?'file':'image',situation:situations[s.situation]?s.situation:'unknown',record:s,
      visual:{...f,slide_id:s.id,slide_image_version:s.image_version_id||'',page_number:s.page_number||0,image_number:s.image_number||0,has_preview:true,name:s.title||f.name,source_name:f.name,legacy:!!s.legacy}}];
  });
}
export function presentationSlides(data,{includeHidden=false}={}){
  const visuals=visualSlides(data),covered=new Set(visuals.filter(s=>s.visual).map(s=>s.visual.id));
  const documents=(data.files||[]).filter(f=>!covered.has(f.id)&&['drawings','presentation','moodboard'].includes(f.category)).flatMap(f=>{
    const pages=(f.pages||[]).filter(p=>p.has_preview&&p.include_in_presentation!==false);
    return (pages.length?pages:(f.pages?.length?[]:[null])).map(p=>({id:`source-${f.id}-${p?.number||0}`,type:'source',title:p?`${f.name} · Page ${p.number}`:f.name,icon:'file',visual:{...f,page_number:p?.number||0},sourceOnly:true}));
  });
  const all=[{id:'intro',type:'intro',title:'Welcome home',icon:'slide'},...visuals,...documents,
    {id:'changes',type:'changes',title:'What’s new',icon:'history'},
    {id:'budget',type:'budget',title:'The investment',icon:'budget'},
    {id:'contacts',type:'contacts',title:'Your project team',icon:'users'},
    {id:'summary',type:'summary',title:'Everything, together',icon:'download'}];
  const content=new Map((data.slide_content||[]).map(s=>[s.slide_id,s]));
  const sections=new Map((data.slide_sections||[]).map(s=>[s.slide_id,s.section]));
  const layout=new Map((data.slide_layout||[]).map(s=>[s.slide_id,s]));
  // A saved position orders slides within their group; groups define the journey.
  const groupOrder=new Map(Object.keys({...data.slide_groups,...slideSections}).map((section,index)=>[section,index]));
  return all.map((s,n)=>({...s,...content.get(s.id),customContent:content.has(s.id),section:groupOrder.has(sections.get(s.id))?sections.get(s.id):defaultSlideSection(s),hidden:!!Number(layout.get(s.id)?.hidden),deleted:!!Number(layout.get(s.id)?.deleted),sortPosition:layout.get(s.id)?.position??(100000+n)})).filter(s=>!s.deleted&&(includeHidden||!s.hidden)).sort((a,b)=>groupOrder.get(a.section)-groupOrder.get(b.section)||a.sortPosition-b.sortPosition);
}

export const slideSections={story:'The story',current:'The current situation',moodboards:'The moodboards',designs:'The designs',budget:'The budget'};
export function defaultSlideSection(slide){if(['fullphoto','text'].includes(slide.type))return 'story';if(slide.type==='budget')return 'budget';if(slide.situation==='before')return 'current';if(slide.type==='moodboard')return 'moodboards';if(slide.visual)return 'designs';return 'story';}
export function groupSlideOrder(slides,groups=slideSections){return [...new Set([...Object.keys(groups),...slides.map(s=>s.section)])].flatMap(section=>slides.filter(s=>s.section===section).map(s=>s.id));}
