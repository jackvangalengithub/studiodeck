import {getLanguage,tr} from './i18n.js';

const words={
 'Search conversations':'Zoek gesprekken','Filter thread types':'Filter gesprekstypen','Choose which types appear in your communication list.':'Kies welke typen in je communicatielijst verschijnen.',
 'All thread types shown':'Alle gesprekstypen worden getoond','types selected':'typen geselecteerd','Thread types':'Gesprekstypen','Previous':'Vorige','Next':'Volgende','Page':'Pagina','of':'van','threads':'gesprekken',
 'No matching conversations':'Geen overeenkomende gesprekken','Try a different search or include more thread types.':'Probeer een andere zoekterm of selecteer meer gesprekstypen.','Clear search and filters':'Wis zoekopdracht en filters',
 'You’re all caught up':'Je bent helemaal bij','Nothing needs your attention right now. A little room to focus on what’s next.':'Op dit moment heeft niets je aandacht nodig. Even ruimte om je te richten op wat volgt.',
 'Nothing left open':'Er staat niets meer open','No open conversations, to dos or approvals in this view.':'Geen open gesprekken, taken of akkoordverzoeken in deze weergave.',
 'A little space for the next idea':'Ruimte voor het volgende idee','Conversations, to dos and approvals will find a home here.':'Gesprekken, taken en akkoordverzoeken krijgen hier een plek.',
 'View all conversations':'Bekijk alle gesprekken'
};
const text=s=>getLanguage()==='nl'?(words[s]||s):s;
const types=['conversation','todo','approval'];
const illustration=`<svg class="comm-empty-art" viewBox="0 0 260 170" fill="none" aria-hidden="true"><ellipse cx="132" cy="148" rx="84" ry="9" fill="currentColor" opacity=".045"/><circle cx="130" cy="80" r="65" fill="currentColor" opacity=".025"/><g transform="rotate(-10 72 83)"><rect x="25" y="40" width="98" height="76" rx="15" fill="var(--surface,#fff)" stroke="#3976a0" stroke-opacity=".25"/><rect x="39" y="54" width="24" height="6" rx="3" fill="#3976a0" opacity=".55"/><path d="M40 76h65M40 87h43" stroke="#3976a0" stroke-opacity=".2" stroke-width="5" stroke-linecap="round"/></g><g transform="rotate(10 184 80)"><rect x="148" y="39" width="81" height="86" rx="15" fill="var(--surface,#fff)" stroke="#96701f" stroke-opacity=".3"/><rect x="161" y="53" width="23" height="6" rx="3" fill="#96701f" opacity=".5"/><path d="M164 77h46M164 89h32" stroke="#96701f" stroke-opacity=".2" stroke-width="5" stroke-linecap="round"/></g><rect x="77" y="65" width="108" height="73" rx="16" fill="var(--surface,#fff)" stroke="#36795c" stroke-opacity=".3"/><path d="M104 137l-5 11 23-11" fill="var(--surface,#fff)"/><path d="M104 137l-5 11 23-11" stroke="#36795c" stroke-opacity=".3" stroke-linejoin="round"/><circle cx="111" cy="101" r="4" fill="#3976a0" opacity=".6"/><circle cx="131" cy="101" r="4" fill="#96701f" opacity=".6"/><circle cx="151" cy="101" r="4" fill="#36795c" opacity=".6"/><path d="M127 22v8M123 26h8M231 113v6M228 116h6" stroke="currentColor" opacity=".2" stroke-width="2" stroke-linecap="round"/></svg>`;

// One interaction pattern for both inboxes, matching the slide-type filter.
export function createCommunicationControls({id,esc,icon,typeLabel,openModal,onChange,onError,onViewAll}){
 let search='',selected=null,sort='newest',offset=0,timer;
 const limit=25;
 const active=()=>selected!==null;
 const summary=()=>active()?`${selected.size} / ${types.length} ${text('types selected')}`:text('All thread types shown');
 const owns=element=>element?.dataset.commOwner===id;
 function renderPreservingSearch(render){
  const input=document.activeElement,mine=input?.dataset.commSearch===id,start=mine?input.selectionStart:null,end=mine?input.selectionEnd:null;
  render();
  if(mine){const next=document.querySelector(`[data-comm-search="${id}"]`);next?.focus({preventScroll:true});if(start!==null)next?.setSelectionRange(start,end);}
 }
 async function update(reset=true){
  clearTimeout(timer);if(reset)offset=0;
  const status=document.querySelector(`[data-comm-filter-status="${id}"]`);if(status)status.textContent=summary();
  try{await onChange();}catch(error){onError(error.message);}
 }
 function filterModal(){
  openModal(text('Filter thread types'),`<p>${text('Choose which types appear in your communication list.')}</p><div class="row slide-filter-actions"><button type="button" class="button small" data-comm-owner="${id}" data-comm-select="all">${tr('studio_select_all')}</button><button type="button" class="button small" data-comm-owner="${id}" data-comm-select="none">${tr('studio_clear_selection')}</button></div><fieldset class="slide-type-options comm-filter-options"><legend class="sr-only">${text('Thread types')}</legend>${types.map(type=>`<label class="check-label" data-thread-type="${type}"><input type="checkbox" data-comm-owner="${id}" data-comm-type="${type}" ${!selected||selected.has(type)?'checked':''}><i class="comm-type-dot" aria-hidden="true"></i><span>${typeLabel(type)}</span></label>`).join('')}</fieldset><p class="form-hint" data-comm-filter-status="${id}" role="status">${summary()}</p><div class="modal-footer"><button type="button" class="button primary" data-action="close-modal">${tr('studio_done')}</button></div>`);
 }
 document.addEventListener('click',event=>{
  const el=event.target.closest('[data-comm-owner]');if(!owns(el))return;
  if(el.hasAttribute('data-comm-filter'))filterModal();
  if(el.hasAttribute('data-comm-select')){selected=el.dataset.commSelect==='all'?null:new Set();document.querySelectorAll(`[data-comm-owner="${id}"][data-comm-type]`).forEach(input=>input.checked=!selected);update();}
  if(el.hasAttribute('data-comm-sort')){sort=sort==='newest'?'oldest':'newest';update();}
  if(el.hasAttribute('data-comm-page')){offset=Math.max(0,Number(el.dataset.commPage)||0);update(false);}
  if(el.hasAttribute('data-comm-reset')){search='';selected=null;update();}
  if(el.hasAttribute('data-comm-show-all')){offset=0;Promise.resolve(onViewAll()).catch(error=>onError(error.message));}
 });
 document.addEventListener('change',event=>{
  const input=event.target;if(!owns(input)||!input.hasAttribute('data-comm-type'))return;
  if(!selected)selected=new Set(types);
  if(input.checked)selected.add(input.dataset.commType);else selected.delete(input.dataset.commType);
  if(selected.size===types.length)selected=null;
  update();
 });
 document.addEventListener('input',event=>{
  if(event.target.dataset.commSearch!==id)return;
  search=event.target.value;offset=0;clearTimeout(timer);timer=setTimeout(()=>update(),180);
 });
 return {
  get search(){return search.trim();},get sort(){return sort;},get offset(){return offset;},get limit(){return limit;},
  get params(){return {search:search.trim(),types:selected===null?'all':selected.size?[...selected].join(','):'none',sort,offset,limit};},
  accepts(type){return !selected||selected.has(type);},
  restore(params={}){clearTimeout(timer);search=params.search||'';selected=!params.types||params.types==='all'?null:new Set(params.types==='none'?[]:params.types.split(',').filter(t=>types.includes(t)));sort=params.sort==='oldest'?'oldest':'newest';offset=Math.max(0,Number(params.offset)||0);},
  reset(){clearTimeout(timer);search='';selected=null;sort='newest';offset=0;},
  selectTypes(values){selected=values.length===types.length?null:new Set(values);offset=0;},
  firstPage(){offset=0;},setOffset(value){offset=Math.max(0,value);},
  clamp(total){offset=Math.min(offset,Math.max(0,Math.ceil(total/limit)-1)*limit);},
  render:renderPreservingSearch,
  toolbar(){return `<div class="comm-list-tools"><label class="comm-search">${icon('search')}<input type="text" inputmode="search" maxlength="200" data-comm-search="${id}" value="${esc(search)}" placeholder="${text('Search conversations')}" aria-label="${text('Search conversations')}"></label><button type="button" class="icon-button slide-type-filter ${active()?'is-active':''}" data-comm-owner="${id}" data-comm-filter aria-label="${text('Filter thread types')}" title="${esc(summary())}" aria-haspopup="dialog">${icon('filter')}${active()?'<span class="slide-filter-dot" aria-hidden="true"></span>':''}</button><button type="button" class="button comm-sort" data-comm-owner="${id}" data-comm-sort title="${tr(sort==='newest'?'switch_sort_oldest':'switch_sort_newest')}">${icon(sort==='newest'?'down':'up')}<span>${tr(sort==='newest'?'newest_first':'oldest_first')}</span></button></div>`;},
  pagination(total){if(!total)return '';const page=Math.floor(offset/limit)+1,pages=Math.ceil(total/limit);return `<nav class="comm-pagination" aria-label="${text('Page')}"><span role="status">${offset+1}–${Math.min(offset+limit,total)} ${text('of')} ${total} ${text('threads')}</span>${pages>1?`<div><button type="button" class="button small" data-comm-owner="${id}" data-comm-page="${offset-limit}" ${offset===0?'disabled':''}>${icon('left')}${text('Previous')}</button><small>${text('Page')} ${page} ${text('of')} ${pages}</small><button type="button" class="button small" data-comm-owner="${id}" data-comm-page="${offset+limit}" ${page>=pages?'disabled':''}>${text('Next')}${icon('right')}</button></div>`:''}</nav>`;},
  empty(view,action=''){
   const filtered=search.trim()||active(),title=filtered?'No matching conversations':view==='attention'?'You’re all caught up':view==='open'?'Nothing left open':'A little space for the next idea',description=filtered?'Try a different search or include more thread types.':view==='attention'?'Nothing needs your attention right now. A little room to focus on what’s next.':view==='open'?'No open conversations, to dos or approvals in this view.':'Conversations, to dos and approvals will find a home here.';
   return `<section class="comm-empty-state">${illustration}<h2>${text(title)}</h2><p>${text(description)}</p>${filtered?`<button class="button small" type="button" data-comm-owner="${id}" data-comm-reset>${text('Clear search and filters')}</button>`:view!=='all'?`<button class="button small" type="button" data-comm-owner="${id}" data-comm-show-all>${text('View all conversations')}</button>`:action}</section>`;
  }
 };
}
