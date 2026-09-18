const tabs=new Set(['overview','slides','files','budget','people','comments','activity']);
const viewPaths={'studio-users':'users','all-activity':'activity','all-comments':'comments',settings:'settings',profile:'profile',billing:'billing'};
export function readWorkspaceRoute(location){
    const parts=location.pathname.split('/').filter(Boolean).map(decodeURIComponent),q=new URLSearchParams(location.search);
    if(parts.length<2||parts[0]==='client')return null;
    const [studioId,section,key]=parts;
    if(section==='projects'&&parts.length<=3)return {studioId,view:key?'project':'projects',projectId:key||null,iteration:q.get('iteration'),tab:tabs.has(q.get('tab'))?q.get('tab'):'overview',search:q.get('search')||'',archived:q.get('archived')==='1'};
    if(section==='slide'&&parts.length===3)return {studioId,view:'slide',slide:key,projectId:q.get('project'),iteration:q.get('iteration')};
    const view=Object.keys(viewPaths).find(view=>viewPaths[view]===section);
    return view&&parts.length===2?{studioId,view}:null;
}
export function workspaceUrl({studioId,view,projectId,iteration,tab,slide,search,archived}){
    const root='/'+encodeURIComponent(studioId),q=new URLSearchParams();let path=root+'/projects';
    if(view==='project'&&projectId){path+='/'+encodeURIComponent(projectId);if(iteration)q.set('iteration',iteration);if(tab&&tab!=='overview')q.set('tab',tab);}
    else if(view==='slide'){path=root+'/slide/'+encodeURIComponent(slide);if(projectId)q.set('project',projectId);if(iteration)q.set('iteration',iteration);}
    else if(viewPaths[view])path=root+'/'+viewPaths[view];
    else{if(search)q.set('search',search);if(archived)q.set('archived','1');}
    return path+(q.size?'?'+q:'');
}
