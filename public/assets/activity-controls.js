import {getLanguage,tr} from './i18n.js';

const nl={
 'Search activity':'Zoek activiteit','Filter activity':'Activiteit filteren','Activity type':'Activiteitstype','All types':'Alle typen','Person':'Persoon','Everyone':'Iedereen','Project':'Project','All projects':'Alle projecten','From':'Van','Through':'Tot en met','Apply filters':'Filters toepassen','No matching activity':'Geen overeenkomende activiteit','Try another search or adjust your filters.':'Probeer een andere zoekterm of pas je filters aan.','The end date must be on or after the start date.':'De einddatum moet op of na de begindatum liggen.','Sort activity':'Activiteit sorteren','Active filters':'Actieve filters'
};
const t=s=>getLanguage()==='nl'?(nl[s]||s):s;
const defaults=()=>({search:'',type:'',actor:'',project:'',from:'',to:'',sort:'newest'});

export function createActivityControls({id,esc,icon,openModal,closeModal,onChange,onError,studio=false}){
 let values=defaults(),facets={},timer,scope='';
 const owns=el=>el?.dataset.activityOwner===id;
 const filtered=()=>Object.entries(values).some(([k,v])=>k!=='sort'&&v);
 const filters=()=>['type','actor','project','from','to'].filter(k=>values[k]);
 async function update(){clearTimeout(timer);try{await onChange();}catch(error){onError(error.message);}}
 function select(name,label,all,options){
  return `<label>${t(label)}<select name="${name}" aria-label="${t(label)}"><option value="">${t(all)}</option>${options.map(([value,text])=>`<option value="${esc(value)}" ${values[name]===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
 }
 function filterModal(){
  openModal(t('Filter activity'),`<form data-activity-form="${id}">${select('type','Activity type','All types',(facets.types||[]).map(s=>[s,s.replaceAll('_',' ')]))}${select('actor','Person','Everyone',(facets.actors||[]).map(s=>[s,s]))}${studio?select('project','Project','All projects',(facets.projects||[]).map(p=>[p.id,p.name])):''}<div class="activity-date-fields"><label>${t('From')}<input type="date" name="from" value="${esc(values.from)}"></label><label>${t('Through')}<input type="date" name="to" value="${esc(values.to)}"></label></div><p class="form-error" data-activity-error role="alert" hidden></p><div class="modal-footer"><button type="button" class="button ghost" data-action="close-modal">${tr('cancel')}</button><button type="submit" class="button primary">${t('Apply filters')}</button></div></form>`);
 }
 document.addEventListener('click',event=>{
  const el=event.target.closest('[data-activity-owner]');if(!owns(el))return;
  if(el.hasAttribute('data-activity-filter'))filterModal();
 });
 document.addEventListener('submit',event=>{
  const form=event.target;if(form.dataset.activityForm!==id)return;event.preventDefault();
  const next={...values,...Object.fromEntries(new FormData(form))};
  if(next.from&&next.to&&next.from>next.to){const error=form.querySelector('[data-activity-error]');error.textContent=t('The end date must be on or after the start date.');error.hidden=false;return;}
  values=next;closeModal();update();
 });
 document.addEventListener('input',event=>{
  if(event.target.dataset.activitySearch!==id)return;
  values.search=event.target.value;clearTimeout(timer);timer=setTimeout(update,220);
 });
 document.addEventListener('change',event=>{
  if(!owns(event.target)||!event.target.hasAttribute('data-activity-sort'))return;
  values.sort=event.target.value;update();
 });
 return {
  get params(){return {...values,search:values.search.trim()};},
  get projectParams(){return Object.fromEntries(Object.entries(this.params).map(([k,v])=>['events_'+k,v]));},
  bind(key){if(key!==scope){scope=key;this.reset();}},
  reset(){clearTimeout(timer);values=defaults();facets={};},
  setFacets(next){facets=next||{};},
  render(render){
   const el=document.activeElement,mine=el?.dataset.activitySearch===id,start=mine?el.selectionStart:null,end=mine?el.selectionEnd:null;
   render();if(mine){const input=document.querySelector(`[data-activity-search="${id}"]`);input?.focus({preventScroll:true});if(start!==null)input?.setSelectionRange(start,end);}
  },
  toolbar(){
   const labels=filters().map(k=>k==='type'?values[k].replaceAll('_',' '):k==='project'?(facets.projects||[]).find(p=>p.id===values[k])?.name||values[k]:k==='from'||k==='to'?`${t(k==='from'?'From':'Through')} ${values[k]}`:values[k]);
   return `<div class="activity-tools"><label class="search activity-search">${icon('search')}<input type="text" inputmode="search" maxlength="200" data-activity-search="${id}" value="${esc(values.search)}" placeholder="${t('Search activity')}" aria-label="${t('Search activity')}"></label><button type="button" class="icon-button activity-filter ${filters().length?'is-active':''}" data-activity-owner="${id}" data-activity-filter aria-label="${t('Filter activity')}" title="${t('Filter activity')}" aria-haspopup="dialog">${icon('filter')}${filters().length?'<span class="slide-filter-dot" aria-hidden="true"></span>':''}</button><select class="activity-sort" data-activity-owner="${id}" data-activity-sort aria-label="${t('Sort activity')}">${['newest','oldest'].map(s=>`<option value="${s}" ${values.sort===s?'selected':''}>${tr(s==='newest'?'newest_first':'oldest_first')}</option>`).join('')}</select></div>${filters().length?`<div class="activity-filter-summary"><span aria-label="${t('Active filters')}">${esc(labels.join(' · '))}</span></div>`:''}`;
  },
  empty(){return `<div class="attention-empty">${icon('history')}<h2>${filtered()?t('No matching activity'):tr('studio_nothing_here_yet')}</h2><p>${filtered()?t('Try another search or adjust your filters.'):tr('studio_client_views_downloads_shared_iterations_and_feedback_will_appear_here')}</p></div>`;}
 };
}
