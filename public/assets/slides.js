import {tr} from './i18n.js';
export const visualTypes={get moodboard(){return tr("moodboard");},get photo(){return tr("photo");},get render(){return tr("3d_render");},get drawing(){return tr("drawing");},get floorplan(){return tr("floorplan");},get other(){return tr("image");},get fullphoto(){return tr("full_photo");}};
// Code-defined type capabilities; keep in sync with SLIDE_TYPE_CAPABILITIES in app/slides.php.
export const slideTypeCapabilities=Object.freeze(Object.fromEntries(Object.entries({
  moodboard:false,photo:true,render:true,drawing:true,floorplan:false,other:true,fullphoto:true,
}).map(([type,ai_edit])=>[type,Object.freeze({ai_edit})])));
export const canAiEditSlide=type=>slideTypeCapabilities[type]?.ai_edit===true;
export const situations={get before(){return tr("before_existing_situation");},get concept(){return tr("concept_proposed_design");},get after(){return tr("after_completed_project");},get reference(){return tr("reference_inspiration");},get unknown(){return tr("situation_to_review");}};
export function visualSlides(data){
  const files=new Map((data.files||[]).map(f=>[f.id,f]));
  const records=data.slides?.length?data.slides:(data.files||[]).filter(f=>f.mime.startsWith('image/')).map(f=>({id:'legacy-'+f.id,source_version_id:f.id,type:f.category==='moodboard'?'moodboard':/render|3d/i.test(f.name)?'render':'photo',situation:'unknown',title:f.name,metadata:{confidence:'low'},legacy:true}));
  return records.flatMap(s=>{
    if(s.type==='video')return [{id:'visual-'+s.id,type:'video',title:s.title,description:s.description,icon:'play',record:s}];
    if(s.type==='text')return [{id:'visual-'+s.id,type:'text',title:s.title,description:s.description,icon:'file',record:s}];
    const f=files.get(s.source_version_id)||(Number(s.manual)&&s.source_version_id?{id:s.source_version_id,name:s.source_name||s.title,mime:s.source_mime||'image/jpeg'}:null);if(!f||f.category==='legal')return [];
    const type=visualTypes[s.type]?s.type:'other';
    return [{id:'visual-'+s.id,type,title:s.title||visualTypes[type],icon:type==='moodboard'?'leaf':['drawing','floorplan'].includes(type)?'file':'image',situation:situations[s.situation]?s.situation:'unknown',record:s,
      visual:{...f,slide_id:s.id,slide_image_version:s.image_version_id||'',page_number:s.page_number||0,image_number:s.image_number||0,has_preview:true,name:s.title||f.name,source_name:f.name,legacy:!!s.legacy}}];
  });
}
export function systemSlides(){
  return [{id:'intro',type:'intro',get title(){return tr("welcome_home");},icon:'slide'},
    {id:'changes',type:'changes',get title(){return tr("what_s_new");},icon:'history'},
    {id:'budget',type:'budget',get title(){return tr("the_investment");},icon:'budget'},
    {id:'open-questions',type:'open-questions',get title(){return tr("open_questions");},icon:'chat'},
    {id:'contacts',type:'contacts',get title(){return tr("your_project_team");},icon:'users'},
    {id:'summary',type:'summary',get title(){return tr("everything_together");},icon:'download'}].map(s=>({...s,systemType:s.type}));
}
export function presentationSlides(data,{includeHidden=false,includeDeleted=false}={}){
  const visuals=visualSlides(data),covered=new Set(visuals.filter(s=>s.visual).map(s=>s.visual.id));
  const documents=(data.files||[]).filter(f=>!covered.has(f.id)&&['drawings','presentation','moodboard'].includes(f.category)).flatMap(f=>{
    const pages=(f.pages||[]).filter(p=>p.has_preview&&p.include_in_presentation!==false);
    return (pages.length?pages:(f.pages?.length?[]:[null])).map(p=>({id:`source-${f.id}-${p?.number||0}`,type:'source',title:p?`${f.name}${tr('file_page',{page:p.number})}`:f.name,icon:'file',visual:{...f,page_number:p?.number||0},sourceOnly:true}));
  });
  const builtins=systemSlides(),byType=new Map(builtins.map(s=>[s.type,s]));
  const copies=(data.system_slides||[]).filter(s=>byType.has(s.type)).map(s=>({...byType.get(s.type),id:s.id}));
  const all=[builtins[0],...visuals,...documents,...builtins.slice(1),...copies];
  const content=new Map((data.slide_content||[]).map(s=>[s.slide_id,s]));
  const sections=new Map((data.slide_sections||[]).map(s=>[s.slide_id,s.section]));
  const layout=new Map((data.slide_layout||[]).map(s=>[s.slide_id,s]));
  // A saved position orders slides within their group; groups define the journey.
  const groupOrder=new Map(Object.keys(data.slide_groups||slideSections).map((section,index)=>[section,index]));
  return all.map((s,n)=>({...s,...content.get(s.systemType||s.id),customContent:content.has(s.systemType||s.id),section:groupOrder.has(sections.get(s.id))?sections.get(s.id):groupOrder.has(defaultSlideSection(s))?defaultSlideSection(s):groupOrder.keys().next().value,hidden:!!Number(layout.get(s.id)?.hidden),deleted:!!Number(layout.get(s.id)?.deleted),sortPosition:layout.get(s.id)?.position??(100000+n)})).filter(s=>(includeDeleted||!s.deleted)&&(includeHidden||!s.hidden)).sort((a,b)=>groupOrder.get(a.section)-groupOrder.get(b.section)||a.sortPosition-b.sortPosition);
}

export const slideSections={get story(){return tr("the_story");},get current(){return tr("the_current_situation");},get moodboards(){return tr("the_moodboards");},get designs(){return tr("the_designs");},get budget(){return tr("the_budget");},get questions(){return tr("open_questions");}};
export function defaultSlideSection(slide){if(['fullphoto','text','video'].includes(slide.type))return 'story';if(slide.type==='budget')return 'budget';if(slide.type==='open-questions')return 'questions';if(slide.situation==='before')return 'current';if(slide.type==='moodboard')return 'moodboards';if(slide.visual)return 'designs';return 'story';}
export function groupSlideOrder(slides,groups=slideSections){return [...new Set([...Object.keys(groups),...slides.map(s=>s.section)])].flatMap(section=>slides.filter(s=>s.section===section).map(s=>s.id));}
