import {normalizeThreadType} from './communication-types.js';

// Slides and pins use the current iteration. The communication overview also
// includes shared history returned by the API, which enforces client access.
function sharedComments(data){
 const source=data?.communication?.comments||data?.comments||[];
 const privateRoots=new Set(source.filter(c=>c.audience==='studio').map(c=>c.parent_id||c.id));
 return source.filter(c=>!privateRoots.has(c.parent_id||c.id));
}
export function presentationComments(data){
 return sharedComments(data).filter(c=>c.iteration_id===data.iteration.id);
}
export function presentationQuestions(data){
 const ids=new Set(presentationComments(data).map(c=>c.id));
 return (data?.communication?.items||data?.open_questions||[]).filter(q=>
  q.iteration_id===data.iteration.id&&Number(q.published)&&!Number(q.dismissed)&&(!q.thread_id||ids.has(q.thread_id)));
}
function threadState(root,source){
 const work=(source.items||[]).filter(q=>q.thread_id===root.id&&!Number(q.dismissed)&&(Number(q.accepted)||Number(q.published)));
 const requests=(source.confirmations||[]).filter(r=>(r.parent_id||r.comment_id)===root.id);
 if(root.confirmation&&!requests.some(r=>r.comment_id===root.id))requests.push({...root.confirmation,comment_id:root.id});
 const pending=requests.filter(r=>r.status==='pending'),unfinished=work.filter(q=>!Number(q.resolved));
 const type=normalizeThreadType(root.thread_details?.type||(root.confirmation?'approval':'conversation'));
 const resolved=!!Number(root.answered)||type==='todo'&&!!root.thread_details?.resolved;
 const open=pending.length>0||unfinished.length>0||(root.presentation_is_open===undefined?!resolved&&!work.length&&!requests.length:!!root.presentation_is_open);
 const ownRequest=requests.find(r=>r.comment_id===root.id);
 const status=open?(pending.length?'awaiting_approval':unfinished.length&&type!=='todo'?'open_actions':type==='conversation'&&root.thread_details?.assignee?'waiting_reply':'open'):
  type==='approval'?(ownRequest?.status==='withdrawn'?'withdrawn':'confirmed'):type==='conversation'?'resolved':'completed';
 return {type,open,status,request:ownRequest||pending[0]};
}
export function presentationCommunication(data){
 if(!data?.communication)return null;
 const source=data.communication,iid=data.iteration.id;
 const iterations=(source.iterations||[]).filter(i=>i.id===iid||i.presentation_visible===true||i.presentation_visible===1);
 const allowed=new Set([iid,...iterations.map(i=>i.id)]);
 const comments=sharedComments(data).filter(c=>allowed.has(c.iteration_id));
 const ids=new Set(comments.map(c=>c.id));
 const scope=map=>Object.fromEntries(Object.entries(map||{}).filter(([id])=>allowed.has(id)));
 const items=(source.items||data.open_questions||[]).filter(q=>allowed.has(q.iteration_id)&&Number(q.published)&&!Number(q.dismissed)&&(!q.thread_id||ids.has(q.thread_id)));
 const hidden=new Set((data.slide_layout||[]).filter(s=>Number(s.hidden)||Number(s.deleted)).map(s=>s.slide_id));
 const slides=scope(source.public_iteration_slides||source.iteration_slides);
 if(slides[iid])slides[iid]=slides[iid].filter(s=>!hidden.has(s.id));
 const view={...source,items,guests:[],iterations,
  recipients:(source.recipients||[]).filter(p=>!p.invitable),
  iteration_recipients:Object.fromEntries(Object.entries(scope(source.iteration_recipients)).map(([id,people])=>[id,people.filter(p=>!p.invitable)])),
  iteration_files:scope(source.iteration_files),iteration_slides:slides,
  threads:(source.threads||[]).filter(t=>ids.has(t.id||t.comment_id)),
  confirmations:(source.confirmations||[]).filter(c=>ids.has(c.comment_id)),
  attachments:(source.attachments||[]).filter(a=>ids.has(a.comment_id))};
 view.comments=comments.map(c=>c.parent_id?c:{...c,is_open:threadState(c,view).open});
 return view;
}
export function presentationThreads(data){
 const source=presentationCommunication(data)||{comments:presentationComments(data),items:presentationQuestions(data),confirmations:[],threads:[],iterations:[],iteration_slides:{}};
 return source.comments.filter(c=>!c.parent_id).map(root=>{
  const state=threadState(root,source),details=root.thread_details||{},request=state.request;
  const people=source.iteration_recipients?.[root.iteration_id]||source.recipients||[];
  const person=state.type==='approval'?request?.recipient_name||request?.recipient:
   details.assignee_name||people.find(p=>p.email===details.assignee)?.name||details.assignee||request?.recipient_name||request?.recipient;
  const iteration=source.iterations.find(i=>i.id===root.iteration_id);
  const slide=source.iteration_slides?.[root.iteration_id]?.find(s=>s.id===root.slide);
  const last=source.comments.filter(c=>(c.parent_id||c.id)===root.id).at(-1)||root;
  return {...state,id:root.id,title:source.threads.find(t=>(t.id||t.comment_id)===root.id)?.title||root.body,
   person:person||'',iteration:iteration?.number||root.iteration_number||data.iteration.number,iteration_id:root.iteration_id,
   slide:slide?.title||'',updated_at:last.created_at||''};
 }).sort((a,b)=>b.updated_at.localeCompare(a.updated_at)||a.id.localeCompare(b.id));
}
