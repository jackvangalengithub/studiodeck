import {tr} from './i18n.js';
export function createSlideTypeFilter({types,openModal,render}){
 const currentTypes=()=>typeof types==='function'?types():types;
 let selected=null,project=null;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const active=()=>selected!==null;
 function options(){return `<fieldset class="slide-type-options"><legend class="sr-only">${tr("studio_slide_types")}</legend>${Object.entries(currentTypes()).map(([type,label])=>`<label class="check-label"><input type="checkbox" data-slide-type="${esc(type)}" ${!selected||selected.has(type)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</fieldset>`;}
 function summary(){return active()?tr("studio_of_types_selected",{v0:selected.size,v1:Object.keys(currentTypes()).length}):tr("studio_all_slide_types_shown");}
 function update(){render();const status=document.querySelector('[data-slide-filter-status]');if(status)status.textContent=summary();}
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-slide-filter-open]'))openModal(tr("studio_filter_slide_types"),`<p>${tr("studio_choose_the_types_to_show_in_the_editor_your_presentation_stays_unchanged")}</p><div class="row slide-filter-actions"><button type="button" class="button small" data-slide-filter-select="all">${tr("studio_select_all")}</button><button type="button" class="button small" data-slide-filter-select="none">${tr("studio_clear_selection")}</button></div>${options()}<p class="form-hint" data-slide-filter-status role="status">${summary()}</p><div class="modal-footer"><button type="button" class="button primary" data-action="close-modal">${tr("studio_done")}</button></div>`);
  const select=e.target.closest('[data-slide-filter-select]');
  if(select){selected=select.dataset.slideFilterSelect==='all'?null:new Set();document.querySelectorAll('[data-slide-type]').forEach(input=>input.checked=!selected);update();}
 });
 document.addEventListener('change',e=>{
  const input=e.target.closest('[data-slide-type]');if(!input)return;
  if(!selected)selected=new Set(Object.keys(currentTypes()));
  if(input.checked)selected.add(input.dataset.slideType);else selected.delete(input.dataset.slideType);
  if(selected.size===Object.keys(currentTypes()).length)selected=null;
  update();
 });
 return {
  setProject(id){if(project!==id){project=id;selected=null;}},
  filter(slides){return selected?slides.filter(s=>selected.has(s.type)):slides;},
  button(){return `<button type="button" class="icon-button slide-type-filter ${active()?'is-active':''}" data-slide-filter-open aria-label="${tr("studio_filter_slide_types_2",{v1:active()?' — active':''})}" title="${active()?summary():tr("studio_filter_slide_types")}" aria-haspopup="dialog"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>${active()?'<span class="slide-filter-dot" aria-hidden="true"></span>':''}</button>`;},
  empty(){return active()?`<p class="notice">${tr("studio_no_slides_match_these_types_in_this_group")} <button type="button" class="text-button" data-slide-filter-select="all">${tr("studio_show_all_slide_types")}</button></p>`:`<p class="notice">${tr("studio_no_slides_in_this_group_choose_all_slides_or_drag_slides_onto_the_group_label")}</p>`;}
 };
}
