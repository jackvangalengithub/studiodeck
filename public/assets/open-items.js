import {tr} from './i18n.js';
import {composerText,threadTypes} from './communication-composer.js';
import {presentationThreads} from './presentation-view.js';

export function openItemsUi({state,esc,icon,render}){
 let scope='',views=new Map();
 function resetScope(){const next=state.data.project.id+':'+state.data.iteration.id;if(next!==scope){scope=next;views=new Map();}}
 function row(item){
  const personLabel=item.type==='todo'?composerText('Responsible'):composerText('Waiting for');
  const typeLabel=composerText(threadTypes.find(([type])=>type===item.type)?.[1]||'Conversation');
  return `<button type="button" class="open-items-row" data-action="comm-open" data-id="${esc(item.id)}" data-thread-type="${esc(item.type)}">
   <span class="open-items-type"><i aria-hidden="true"></i>${esc(typeLabel)}</span>
   <span class="open-items-subject"><strong>${esc(item.title)}</strong><small>${tr('iteration')} ${esc(item.iteration)}${item.slide?' · '+esc(item.slide):''}</small></span>
   <span class="open-items-person">${item.person?`<small>${esc(personLabel)}</small><span>${esc(item.person)}</span>`:`<span class="muted">${tr('open_items_unassigned')}</span>`}</span>
   <span class="open-items-status ${item.open?'':'is-complete'}">${tr('open_items_status_'+item.status)}</span>
   <span class="open-items-arrow" aria-hidden="true">${icon('right')}</span>
  </button>`;
 }
 function slide(def){
  resetScope();const all=presentationThreads(state.data),view=views.get(def.id)||'open';
  const open=all.filter(item=>item.open),done=all.filter(item=>!item.open),items=view==='open'?open:done;
  const tabs=[['open',tr('open_items_tab_open'),open.length],['completed',tr('open_items_tab_completed'),done.length]];
  return `<section class="open-questions-slide open-items-slide" data-open-items-slide="${esc(def.id)}">
   <p class="slide-label">${tr('checklist_eyebrow')}</p><h1 class="slide-heading">${esc(def.title)}</h1>
   <p class="slide-description">${esc(def.description||tr('open_items_intro'))}</p>
   <div class="open-items-tabs" role="tablist" aria-label="${tr('open_items_tabs')}">${tabs.map(([key,label,count])=>`<button type="button" role="tab" id="open-items-${esc(def.id)}-${key}" aria-controls="open-items-${esc(def.id)}-panel" aria-selected="${view===key}" tabindex="${view===key?0:-1}" data-action="open-items-view" data-slide="${esc(def.id)}" data-view="${key}">${label}<span>${count}</span></button>`).join('')}</div>
   <div class="open-items-list" role="tabpanel" id="open-items-${esc(def.id)}-panel" aria-labelledby="open-items-${esc(def.id)}-${view}" tabindex="0">${items.map(row).join('')||`<p class="open-items-empty">${tr(view==='open'?'open_items_empty':'open_items_completed_empty')}</p>`}</div>
  </section>`;
 }
 function select(el){resetScope();const view=el.dataset.view==='completed'?'completed':'open';views.set(el.dataset.slide,view);render();document.querySelector(`[data-open-items-slide="${CSS.escape(el.dataset.slide)}"] [data-view="${view}"]`)?.focus({preventScroll:true});}
 document.addEventListener('keydown',event=>{
  const tab=event.target.closest('[data-action="open-items-view"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopImmediatePropagation();
  const tabs=[...tab.parentElement.querySelectorAll('[role=tab]')];select(tabs[event.key==='Home'?0:event.key==='End'?tabs.length-1:(tabs.indexOf(tab)+1)%tabs.length]);
 },true);
 return {slide,select};
}
