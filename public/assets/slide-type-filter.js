// Editor-only filters never change the saved deck or client presentation.
export function createSlideTypeFilter({types,openModal,render}){
 let selected=null,project=null;
 const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const active=()=>selected!==null;
 function options(){return `<fieldset class="slide-type-options"><legend class="sr-only">Slide types</legend>${Object.entries(types).map(([type,label])=>`<label class="check-label"><input type="checkbox" data-slide-type="${esc(type)}" ${!selected||selected.has(type)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</fieldset>`;}
 function summary(){return active()?`${selected.size} of ${Object.keys(types).length} types selected`:'All slide types shown';}
 function update(){render();const status=document.querySelector('[data-slide-filter-status]');if(status)status.textContent=summary();}
 document.addEventListener('click',e=>{
  if(e.target.closest('[data-slide-filter-open]'))openModal('Filter slide types',`<p>Choose the types to show in the editor. Your presentation stays unchanged.</p><div class="row slide-filter-actions"><button type="button" class="button small" data-slide-filter-select="all">Select all</button><button type="button" class="button small" data-slide-filter-select="none">Clear selection</button></div>${options()}<p class="form-hint" data-slide-filter-status role="status">${summary()}</p><div class="modal-footer"><button type="button" class="button primary" data-action="close-modal">Done</button></div>`);
  const select=e.target.closest('[data-slide-filter-select]');
  if(select){selected=select.dataset.slideFilterSelect==='all'?null:new Set();document.querySelectorAll('[data-slide-type]').forEach(input=>input.checked=!selected);update();}
 });
 document.addEventListener('change',e=>{
  const input=e.target.closest('[data-slide-type]');if(!input)return;
  if(!selected)selected=new Set(Object.keys(types));
  if(input.checked)selected.add(input.dataset.slideType);else selected.delete(input.dataset.slideType);
  if(selected.size===Object.keys(types).length)selected=null;
  update();
 });
 return {
  setProject(id){if(project!==id){project=id;selected=null;}},
  filter(slides){return selected?slides.filter(s=>selected.has(s.type)):slides;},
  button(){return `<button type="button" class="icon-button slide-type-filter ${active()?'is-active':''}" data-slide-filter-open aria-label="Filter slide types${active()?' — active':''}" title="${active()?summary():'Filter slide types'}" aria-haspopup="dialog"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18l-7 8v7l-4 2v-9z"/></svg>${active()?'<span class="slide-filter-dot" aria-hidden="true"></span>':''}</button>`;},
  empty(){return active()?'<p class="notice">No slides match these types in this group. <button type="button" class="text-button" data-slide-filter-select="all">Show all slide types</button></p>':'<p class="notice">No slides in this group. Choose All slides or drag slides onto the group label.</p>';}
 };
}
