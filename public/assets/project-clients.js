import {tr} from './i18n.js';
export function projectClients({getData,api,openModal,button,formFooter,esc,refresh,toast}){
 const clients=()=>getData()?.clients??(getData()?.contacts||[]).filter(c=>c.role==='Client');
 const canManage=()=>getData()&&getData().can_edit!==false;
 const member=email=>clients().find(c=>c.email===email);
 function summary(){return `<div class="project-team-inline project-clients-inline"><span>${tr("studio_client_members")}</span>${canManage()?button(tr("studio_manage_clients"),'project-clients','small','','users'):''}${clients().map(c=>`<span class="tag" title="${esc(c.email)}">${esc(c.name)}</span>`).join('')||`<span class="muted">${tr("studio_no_clients_yet")}</span>`}</div>`;}
 function open(){
  if(!canManage())return;
  openModal(tr("studio_client_members"),`<p>${tr("studio_keep_the_project_s_client_list_here_choose_who_receives_each_iteration_when_you_send_it")}</p>${clients().map(c=>`<div class="history-item project-client-row"><span><strong>${esc(c.name)}</strong><small>${esc(c.email)}</small></span><div class="row">${button(tr("edit"),'edit-project-client','small',`data-email="${esc(c.email)}" aria-label="Edit ${esc(c.name)}"`)}${button(tr("studio_remove_2"),'remove-project-client','small danger-text',`data-email="${esc(c.email)}" aria-label="Remove ${esc(c.name)}"`)}</div></div>`).join('')||`<p class="notice">${tr("studio_no_client_members_yet_adding_a_client_does_not_send_an_invitation")}</p>`}<div class="modal-footer">${button(tr("studio_done"),'close-modal','ghost')}${button(tr("studio_add_client"),'edit-project-client','primary','','plus')}</div>`);
 }
 function edit(email=''){
  if(!canManage())return;
  const c=member(email);
  openModal(c?tr("studio_edit_client_member"):tr("studio_add_client_member"),`<form data-form="project-client"><label>${tr("studio_name")}<input name="name" value="${esc(c?.name||'')}" required maxlength="100" autocomplete="name"></label><label>${tr("studio_email")}<input name="email" type="email" value="${esc(c?.email||'')}" ${c?'readonly':''} required maxlength="254" autocomplete="email"></label><p class="form-hint">${tr("studio_you_choose_which_iterations_to_share_with_this_client")}</p>${formFooter(c?tr("studio_save_client"):tr("studio_add_client"),'users')}</form>`);
 }
 function remove(email){
  if(!canManage())return;const c=member(email);if(!c)return;
  openModal(tr("studio_remove_client_member"),`<p>${tr("studio_remove_2")} <strong>${esc(c.name)}</strong> ${tr("studio_from_this_project_their_access_to_all_its_shared_iterations_will_end_their_access_to_other_projects_")}</p><form data-form="remove-project-client"><input type="hidden" name="email" value="${esc(c.email)}">${formFooter(tr("studio_remove_client"),'minus')}</form>`);
 }
 async function submit(type,form){
  const values=Object.fromEntries(new FormData(form));
  await api(type==='project-client'?'save_project_client':'remove_project_client',{...values,project_id:getData().project.id});
  await refresh();open();toast(type==='project-client'?tr("studio_client_member_saved"):tr("studio_client_removed_and_project_access_revoked"));
 }
 function picker(){
  return `<div class="client-selection-panel"><div class="row slide-filter-actions"><button type="button" class="button small" data-client-select="all">${tr("studio_select_all")}</button><button type="button" class="button small" data-client-select="none">${tr("studio_clear_selection")}</button>${button(tr("studio_manage_clients"),'project-clients','small ghost')}</div><fieldset class="slide-type-options client-recipient-options"><legend class="sr-only">${tr("studio_clients_to_invite")}</legend>${clients().map(c=>`<label class="check-label"><input type="checkbox" name="client_email" value="${esc(c.email)}" checked><span><strong>${esc(c.name)}</strong><small>${esc(c.email)}</small></span></label>`).join('')}</fieldset><p class="form-hint" data-client-selection-error role="alert" hidden></p></div>`;
 }
 function selected(form){return new FormData(form).getAll('client_email');}
 function updateSelection(form){
  if(!form)return;const count=selected(form).length;
  const error=form.querySelector('[data-client-selection-error]');if(error){error.hidden=count<=20;error.textContent=count>20?tr("studio_choose_up_to_20_clients_per_send"):'';}
  const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=count===0||count>20;
 }
 document.addEventListener('change',e=>{if(e.target.matches('[name="client_email"]'))updateSelection(e.target.closest('form'));});
 document.addEventListener('click',e=>{const control=e.target.closest('[data-client-select]');if(!control)return;const form=control.closest('form');form.querySelectorAll('[name="client_email"]').forEach(input=>input.checked=control.dataset.clientSelect==='all');updateSelection(form);});
 return {clients,summary,open,edit,remove,submit,picker,selected,updateSelection};
}
