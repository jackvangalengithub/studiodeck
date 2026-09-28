import {workspaceUrl} from './routes.js';

// Only view operations belong here. Never add a mutation or arbitrary callback
// to the URL codec: a pasted link must not save, approve, delete or publish.
export const panelActions=Object.freeze({
 'profile':[], 'comm-open':['id'], 'comm-thread':['id'], 'comm-location':['id','project','iteration'],
 'comm-show':[], 'studio-checklist':[], 'comm-pending':[], 'project-pending':[],
 'comm-view':['view'], 'comm-budget':['id'], 'comm-budget-source':['id'],
 'comment-slide':['project','iteration','slide','id'],
 'preview-image':['id'], 'preview-csv':['id'], 'preview-extracted':['id'],
 'review-pages':['id','page'], 'history':['id'], 'originals':[], 'project-documents':[],
 'legal-citation':['version','page'], 'comm-evidence':['id','page','iteration'],
 'studio-budget':[], 'discuss-open-question':['id','iteration'], 'check-evidence':['id','version','page','evidence'],
 'website-tab':['tab'], 'website-file':['file'], 'website-source-scope':['scope'],
 'website-open-page':['id'], 'website-gallery':[], 'website-gallery-close':[],
 'website-filter-style':['style'], 'website-gallery-back':[], 'website-example':['template'],
 'website-pages':[], 'website-manage-projects':[], 'website-materials-tab':['tab'], 'website-images':[],
 'product-feedback-inbox':['theme','offset','status','category','search','area','impact'],
 'feedback-report':['id','theme','offset','status','category','search','area','impact'],
});
const panelFields=action=>[...panelActions[action],...(action.startsWith('website-')?['pageId','sourceScope','sourceFile','galleryStyle']:[])];
const pages=new Set(['projects','studio-users','all-comments','settings','billing','website']);
export const navigationActions=new Set([...Object.keys(panelActions),...pages,
 'open-project','preview-project','tab','project-clients','contacts','review-processed',
 'studio-communication','preview','open-editor-slide','go-slide','next-slide','prev-slide','jump-section',
 'editor-section','presentation-mode','scroll-top','exit-preview','switch-iteration','comm-back','comm-source',
 'destinations','destination-studio','destination-client','client-view','account-sign-in',
 'website-enter','website-leave','download','download-current','comm-download','pack-download','download-extracted',
 'billing-access-back','billing-access-read','communication-page','communication-filter']);

export function readPanel(location) {
 const q=new URLSearchParams(location.search),action=q.get('panel');
 if(!action)return null;
 if(!Object.hasOwn(panelActions,action))throw new Error('Unknown navigation destination.');
 let data;try {data=JSON.parse(q.get('selection')||'{}');}catch {throw new Error('Invalid navigation destination.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Invalid navigation destination.');
 const allowed=panelFields(action);
 if(Object.entries(data).some(([key,value])=>!allowed.includes(key)||typeof value!=='string'||value.length>2048))throw new Error('Invalid navigation selection.');
 return {action,data};
}
export function withPanel(path,panel) {
 const url=new URL(path,'https://studiodeck.invalid');url.searchParams.delete('panel');url.searchParams.delete('selection');
 if(panel){if(!Object.hasOwn(panelActions,panel.action))throw new Error('Unknown navigation destination.');url.searchParams.set('panel',panel.action);const data=Object.fromEntries(panelFields(panel.action).filter(k=>panel.data?.[k]!=null).map(k=>[k,String(panel.data[k])]));if(Object.keys(data).length)url.searchParams.set('selection',JSON.stringify(data));}
 return url.pathname+url.search+url.hash;
}
export function isPlainNavigation(event,link) {
 return !event.defaultPrevented&&event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&!link.hasAttribute('download')&&(!link.target||link.target==='_self')&&new URL(link.href,location.href).origin===location.origin;
}
let resolver=null;
export function configureNavigation(resolve) {resolver=resolve;}
export function navigationElement(tag,props) {
 if(tag!=='button'||!resolver||props.type==='submit')return {tag,props};
 const destination=resolver(props);
 if(!destination)return {tag,props};
 const {type,disabled,...rest}=props;
 if(disabled===true||disabled==='')return {tag,props};
 return {tag:'a',props:{...rest,href:destination.href,'data-navigation':destination.native?'native':destination.action||props['data-action'],...(destination.download?{download:destination.download}:{}),...(destination.data?{'data-navigation-selection':JSON.stringify(destination.data)}:{})}};
}
export function destinationFor(action,d,c) {
 if(!navigationActions.has(action))return null;
 const project=(tab=c.tab,changes={})=>workspaceUrl({...c.route,view:'project',projectId:c.projectId,iteration:c.iteration,tab,...changes});
 const slide=(id,changes={})=>c.client?c.clientUrl(id,changes.presentationMode||c.presentationMode):workspaceUrl({...c.route,view:'slide',projectId:c.projectId,iteration:c.iteration,slide:id,presentationMode:c.presentationMode,...changes});
 const at=index=>c.slides[Math.max(0,Math.min(index,c.slides.length-1))]?.id;
 const link=href=>href?{href}:null;
 const panel=(base=c.current)=>({href:withPanel(base,{action,data:d})});
 if(pages.has(action))return link(workspaceUrl({...c.route,view:action}));
 if(action==='profile')return c.client||c.destinations||c.present?panel():link(workspaceUrl({...c.route,view:'profile'}));
 if(action==='destinations')return link('/choose');
 if(action==='account-sign-in')return {href:'/login',native:true};
 if(action==='destination-studio')return link(workspaceUrl({studioId:d.id,view:d.project?'project':'projects',projectId:d.project}));
 if(action==='destination-client'||action==='client-view')return link('/client/projects/'+encodeURIComponent(d.id||c.projectId));
 if(action==='open-project')return link(project('overview',{projectId:d.id,iteration:null}));
 if(action==='preview-project')return link(project('slides',{projectId:d.id,iteration:null})+'&presentation=1');
 if(action==='tab')return link(project(d.tab));
 if(['project-clients','contacts'].includes(action))return link(project('people'));
 if(action==='review-processed')return link(project('files'));
 if(action==='studio-communication')return link(project('comments'));
 if(action==='preview')return link(c.slides.length?slide(at(0)):project('slides')+'&presentation=1');
 if(action==='open-editor-slide')return link(slide(d.id,{hiddenPreview:c.hiddenSlides?.has(d.id)}));
 if(action==='go-slide')return link(slide(at(Number(d.slide))));
 if(action==='next-slide'||action==='prev-slide')return link(slide(at(c.slide+(action==='next-slide'?1:-1))));
 if(action==='jump-section')return link(slide(c.slides.find(s=>s.section===d.section)?.id||at(0)));
 if(action==='editor-section')return link(project('slides',{slideGroup:d.section}));
 if(action==='presentation-mode')return link(slide(at(c.slide),{presentationMode:d.mode}));
 if(action==='scroll-top')return link(slide(at(0),{presentationMode:'scroll'}));
 if(action==='exit-preview')return link(project(c.tab));
 if(action==='switch-iteration')return link(project(c.tab,{iteration:d.id}));
 if(action==='comm-back')return link(slide(at(c.slide)));
 if(action==='comm-source')return link(slide(d.slide,{iteration:d.iteration}));
 if(action==='website-enter'||action==='website-leave')return link(workspaceUrl({...c.route,view:'website',websiteEditing:action==='website-enter'}));
 if(action==='communication-filter')return link(workspaceUrl({...c.route,view:'all-comments',communicationFilter:d.filter,communication:{...c.route.communication,filter:d.filter,offset:0}}));
 if(action==='website-gallery-close')return link(c.current);
 if(action==='communication-page'){const url=new URL(c.current,'https://studiodeck.invalid');url.searchParams.set('offset',String(Math.max(0,Number(d.offset)||0)));return link(url.pathname+url.search);}
 if(action==='billing-access-back')return link(workspaceUrl({...c.route,view:'projects'}));
 if(action==='billing-access-read')return link(project('overview',{projectId:d.id||d.project,iteration:null}));
 if(['download','download-current','comm-download','pack-download','download-extracted'].includes(action)){const file=c.download(action,d);return file?{href:file.url,native:true,download:file.name||true}:null;}
 if(action==='comm-location')return panel(project('comments',{projectId:d.project||c.projectId,iteration:d.iteration||c.iteration,communication:{filter:'all'}}));
 if(action==='comm-open'||action==='comm-thread')return panel(c.present||c.client?c.current:project('comments',{communication:{filter:'all'}}));
 if(Object.hasOwn(panelActions,action))return panel();
 return null;
}
