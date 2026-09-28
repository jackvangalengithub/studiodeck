import {tr} from './i18n.js';
export function createSlideTypeFilter({types,openModal,closeModal,getSelected,onApply,onError}){
 const currentTypes=()=>typeof types==='function'?types():types;
 let draft=null;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const active=()=>getSelected()!==null;
 const summary=selected=>selected!==null?tr('studio_of_types_selected',{v0:selected.length,v1:Object.keys(currentTypes()).length}):tr('studio_all_slide_types_shown');
 function options(){return `<fieldset class="slide-type-options"><legend class="sr-only">${tr('studio_slide_types')}</legend>${Object.entries(currentTypes()).map(([type,label])=>`<label class="check-label"><input type="checkbox" data-slide-type="${esc(type)}" ${draft===null||draft.includes(type)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</fieldset>`;}
 function update(){const status=document.querySelector('[data-slide-filter-status]');if(status)status.textContent=summary(draft);}
 async function apply(value,button){
  const modal=button?.closest('[role="dialog"]');
  if(button)button.disabled=true;
  try{if(await onApply(value)!==false&&modal?.isConnected)closeModal();}catch(error){onError(error);}finally{if(button)button.disabled=false;}
 }
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-slide-filter-open]')){
   draft=getSelected()===null?null:[...getSelected()];
   openModal(tr('studio_filter_slide_types'),`<p>${tr('studio_choose_the_types_to_show_in_the_editor_your_presentation_stays_unchanged')}</p><div class="row slide-filter-actions"><button type="button" class="button small" data-slide-filter-select="all">${tr('studio_select_all')}</button><button type="button" class="button small" data-slide-filter-select="none">${tr('studio_clear_selection')}</button></div>${options()}<p class="form-hint" data-slide-filter-status role="status">${summary(draft)}</p><div class="modal-footer"><button type="button" class="button primary" data-slide-filter-apply>${tr('studio_done')}</button></div>`);
  }
  const select=e.target.closest('[data-slide-filter-select]');
  if(select){
   draft=select.dataset.slideFilterSelect==='all'?null:[];
   const inputs=document.querySelectorAll('[data-slide-type]');
   if(inputs.length){inputs.forEach(input=>input.checked=draft===null);update();}else apply(draft,select);
  }
  const submit=e.target.closest('[data-slide-filter-apply]');if(submit)apply(draft===null?null:[...draft],submit);
 });
 document.addEventListener('change',e=>{
  if(!e.target.matches('[data-slide-type]'))return;
  draft=[...document.querySelectorAll('[data-slide-type]:checked')].map(input=>input.dataset.slideType);
  if(draft.length===Object.keys(currentTypes()).length)draft=null;
  update();
 });
 return {
  button(){return `<button type="button" class="icon-button slide-type-filter ${active()?'is-active':''}" data-slide-filter-open aria-label="${tr('studio_filter_slide_types_2',{v1:active()?' — active':''})}" title="${active()?summary(getSelected()):tr('studio_filter_slide_types')}" aria-haspopup="dialog"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>${active()?'<span class="slide-filter-dot" aria-hidden="true"></span>':''}</button>`;},
  empty(){return active()?`<p class="notice">${tr('studio_no_slides_match_these_types_in_this_group')} <button type="button" class="text-button" data-slide-filter-select="all">${tr('studio_show_all_slide_types')}</button></p>`:`<p class="notice">${tr('studio_no_slides_in_this_group_choose_all_slides_or_drag_slides_onto_the_group_label')}</p>`;}
 };
}
