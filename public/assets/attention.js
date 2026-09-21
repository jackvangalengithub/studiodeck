import {tr,dateLocale} from './i18n.js';
const kinds=['questions','confirmations','feedback','deadlines'];
export function attentionUi({state,api,esc,button,icon,render,openItem}){
 let data=null,studio='',filter='all',busy=false,error='',request=0;
 const active=()=>state.tab==='attention'&&!state.present&&!state.client;
 async function load(kind=filter,more=false){
  if(!['all',...kinds].includes(kind))kind='all';
  const sid=state.studio?.id,seq=++request;
  if(studio!==sid||kind!==filter){data=null;studio=sid;filter=kind;more=false;}
  busy=true;error='';if(active())render();
  try{const result=await api('attention',{kind,offset:more?data?.next_offset||0:0});if(seq!==request||sid!==state.studio?.id)return;
   data={...result,items:more?[...(data?.items||[]),...result.items]:result.items};
  }catch(e){if(seq===request)error=e.message;}
  finally{if(seq===request){busy=false;if(active())render();}}
 }
 function page(){
  const current=studio===state.studio?.id?data:null;
  return `<section class="attention-page"><div class="section-title"><div><h1>${tr('needs_attention')}</h1><p class="muted">${tr('attention_intro')}</p></div>${button(tr('attention_refresh'),'attention-refresh','small',busy?'disabled':'','history')}</div>
   <div class="attention-filters" aria-label="${tr('attention_filter')}">${['all',...kinds].map(k=>`<button class="attention-filter ${filter===k?'selected':''}" data-action="attention-filter" data-kind="${k}" aria-pressed="${filter===k}" ${busy?'disabled':''}><span>${tr('attention_'+k)}</span><strong>${current?(k==='all'?current.total:current.counts[k]):'—'}</strong></button>`).join('')}</div>
   ${error?`<p class="notice form-error" role="alert">${esc(error)}</p>`:''}
   <div class="attention-list" aria-busy="${busy}">${current?.items.length?current.items.map(item=>row(item)).join(''):busy?`<p role="status">${tr('attention_loading')}</p>`:!error?`<div class="attention-empty">${icon('check')}<h2>${tr('attention_clear')}</h2><p>${tr(filter==='all'?'attention_clear_hint':'attention_filter_clear')}</p></div>`:''}</div>
   ${current?.has_more?`<div class="attention-more">${button(tr('attention_more'),'attention-more','',busy?'disabled':'')}</div>`:''}<p class="form-hint attention-scope">${tr('attention_scope')}</p></section>`;
 }
 function row(item){
  const date=item.deadline?new Intl.DateTimeFormat(dateLocale(),{day:'numeric',month:'short',year:'numeric'}).format(new Date(item.deadline+'T12:00:00')):'';
  const detail=item.kind==='deadlines'?`${tr(item.overdue?'attention_overdue':item.deadline===data.today?'attention_due_today':'attention_due')} · ${date}`:item.kind==='confirmations'?(item.assigned_to_me?tr('attention_your_confirmation'):tr('attention_waiting_for',{name:item.recipient_name})):item.kind==='feedback'?tr('attention_unread_count',{count:item.unread_count}):tr('attention_question_hint');
  return `<button class="attention-item" data-action="attention-open" data-kind="${item.kind}" data-id="${esc(item.id)}" data-project="${esc(item.project_id)}" data-iteration="${esc(item.iteration_id)}"><span class="attention-symbol ${item.overdue?'overdue':''}">${icon({questions:'help',confirmations:'check',feedback:'chat',deadlines:'clock'}[item.kind])}</span><span class="attention-copy"><span class="attention-meta">${esc(item.project_name)} · ${tr('iteration')} ${item.iteration_number}</span><strong>${esc(item.title)}</strong><span class="attention-detail ${item.overdue?'overdue':''}">${esc(detail)}</span></span><span class="attention-kind">${tr('attention_'+item.kind)}</span>${icon('right')}</button>`;
 }
 document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action^="attention-"]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();if(busy)return;
  const action=el.dataset.action;
  if(action==='attention-filter')await load(el.dataset.kind);
  if(action==='attention-refresh')await load();
  if(action==='attention-more')await load(filter,true);
  if(action==='attention-open'){busy=true;el.disabled=true;try{await openItem(el.dataset);}catch(e){error=e.message;state.tab='attention';state.present=false;render();}finally{busy=false;el.disabled=false;if(active())render();}}
 },true);
 return {load,page,filter:()=>filter};
}
