const readCommunication=q=>({filter:['all','attention'].includes(q.get('filter'))?q.get('filter'):'open',search:q.get('q')||'',types:q.get('threadTypes')??'all',sort:q.get('sort')==='oldest'?'oldest':'newest',offset:Math.max(0,Number(q.get('offset'))||0)});
const tabs=new Set(['overview','slides','files','checks','budget','people','comments']);
const viewPaths={'studio-users':'users','all-comments':'comments',settings:'settings',profile:'profile',billing:'billing',website:'website'};
export function readWorkspaceRoute(location){
    const parts=location.pathname.split('/').filter(Boolean).map(decodeURIComponent),q=new URLSearchParams(location.search);
    if(parts.length<2||parts[0]==='client')return null;
    const [studioId,section,key]=parts;
    if(section==='projects'&&parts.length<=3)return {studioId,view:key?'project':'projects',projectId:key||null,...(q.get('presentation')==='1'?{presentation:true}:{}),iteration:q.get('iteration'),tab:q.get('tab')==='checks'?'comments':tabs.has(q.get('tab'))?q.get('tab'):'overview',search:q.get('search')||'',archived:q.get('archived')==='1',...(q.has('types')?{slideTypes:[...new Set(q.get('types').split(',').filter(Boolean))]}:{}),...(q.get('layout')==='grid'?{slideView:'grid'}:{}),...(q.get('group')?{slideGroup:q.get('group')}:{}),...(q.has('fileSearch')?{fileSearch:q.get('fileSearch')}:{}),...(q.has('categories')?{fileCategories:q.get('categories').split(',').filter(Boolean)}:{}),...(q.get('tab')==='comments'?{communication:readCommunication(q)}:{})};
    if(section==='slide'&&parts.length===3)return {studioId,view:'slide',slide:key,...(q.get('preview')==='hidden'?{includeHidden:true}:{}),projectId:q.get('project'),iteration:q.get('iteration'),...(q.get('view')==='scroll'?{presentationMode:'scroll'}:{})};
    if(section==='attention'&&parts.length===2)return {studioId,view:'all-comments',filter:'attention'};
    const view=Object.keys(viewPaths).find(view=>viewPaths[view]===section);
    return view&&parts.length===2?{studioId,view,...(view==='website'?{editing:q.get('edit')==='1'}:view==='all-comments'?{filter:['all','attention'].includes(q.get('filter'))?q.get('filter'):'open',...(q.has('q')||q.has('threadTypes')||q.has('sort')||q.has('offset')?{communication:readCommunication(q)}:{})}:view==='studio-users'&&q.has('search')?{userSearch:q.get('search')}:{})}:null;
}
export function workspaceUrl({studioId,view,projectId,iteration,tab,slide,search,archived,websiteEditing,communicationFilter,presentationMode,slideTypes,slideView,slideGroup,fileSearch,fileCategories,userSearch,communication,hiddenPreview}){
    const root='/'+encodeURIComponent(studioId),q=new URLSearchParams();let path=root+'/projects';
    if(view==='project'&&projectId){path+='/'+encodeURIComponent(projectId);if(iteration)q.set('iteration',iteration);if(tab&&tab!=='overview')q.set('tab',tab);if(Array.isArray(slideTypes))q.set('types',[...slideTypes].sort().join(','));if(slideView==='grid')q.set('layout','grid');if(slideGroup)q.set('group',slideGroup);if(fileSearch)q.set('fileSearch',fileSearch);if(Array.isArray(fileCategories))q.set('categories',[...fileCategories].sort().join(','));}
    else if(view==='slide'){path=root+'/slide/'+encodeURIComponent(slide);if(projectId)q.set('project',projectId);if(iteration)q.set('iteration',iteration);if(presentationMode==='scroll')q.set('view','scroll');if(hiddenPreview)q.set('preview','hidden');}
    else if(viewPaths[view]){path=root+'/'+viewPaths[view];if(view==='website'&&websiteEditing)q.set('edit','1');if(view==='all-comments'&&['all','attention'].includes(communicationFilter))q.set('filter',communicationFilter);}
    else{if(search)q.set('search',search);if(archived)q.set('archived','1');}
    if(view==='studio-users'&&userSearch)q.set('search',userSearch);
    if(communication&&(view==='all-comments'||view==='project'&&tab==='comments')){if(communication.filter&&communication.filter!=='open')q.set('filter',communication.filter);if(communication.search)q.set('q',communication.search);if(communication.types&&communication.types!=='all')q.set('threadTypes',communication.types);if(communication.sort==='oldest')q.set('sort','oldest');if(communication.offset)q.set('offset',communication.offset);}
    return path+(q.size?'?'+q:'');
}
