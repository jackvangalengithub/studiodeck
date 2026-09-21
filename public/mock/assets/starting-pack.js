import {tr} from './i18n.js';
export function startingPack({api,state,esc,button,openModal,closeModal,refresh,toast}){
 let items=[],manage=false,selection=null;
 const label=i=>i.kind==='document'?tr("studio_reference_pdf"):({get intro(){return tr("studio_welcome_slide");},get contacts(){return tr("studio_contact_slide");},get text(){return tr("studio_text_slide");},get fullphoto(){return tr("studio_image_slide");}}[i.slide_type]||tr("studio_slide"));
 const fileLink=i=>i.name?button(esc(i.name),'pack-download','small ghost',`data-version="${esc(i.version_id)}" data-name="${esc(i.name)}"`):'';
 const footer=text=>`<div class="modal-footer">${button(tr("cancel"),'close-modal','ghost')}<button class="button primary" type="submit">${text}</button></div>`;
 async function library(){
  const r=await api('studio_starting_pack');items=r.items;manage=r.can_manage;
  openModal(tr("studio_your_studio_starting_pack"),`<p>${tr("studio_a_familiar_starting_point_for_every_project_slides_are_editable_copies_reference_pdfs_stay_available")}</p><p class="form-hint">${tr("studio_changes_here_apply_to_future_projects_existing_projects_keep_their_copies_and_can_add_missing_slides")}</p>${manage?`<div class="row pack-actions">${button(tr("studio_add_slide"),'pack-new-slide','primary')}${button(tr("studio_add_reference_pdf"),'pack-new-document')}${!items.length?button(tr("studio_use_example_slides"),'pack-examples','ghost'):''}</div>`:''}<div class="pack-list">${items.map(i=>`<article class="pack-item"><div><small>${tr("studio_version",{v0:label(i),v1:i.revision,v2:i.default_enabled?tr("studio_included_by_default"):tr("optional")})}</small><h3>${esc(i.title)}</h3><p class="pack-copy">${esc(i.body)}</p>${fileLink(i)}</div>${manage?`<div class="row">${button(tr("edit"),'pack-edit','small',`data-id="${esc(i.id)}"`)}${button(tr("studio_archive"),'pack-archive','small ghost',`data-id="${esc(i.id)}"`)}</div>`:''}</article>`).join('')||`<div class="notice">${tr("studio_start_with_a_welcome_your_process_and_studio_contact_details_add_your_terms_and_conditions_as_a_refe")}</div>`}</div>`,true);
 }
 function edit(id='',kind='slide'){
  const i=items.find(i=>i.id===id)||{kind,slide_type:'text',default_enabled:1,position:items.length*10};
  openModal(id?tr("studio_edit_studio_template"):tr("studio_add_to_your_starting_pack"),`<form data-form="pack-item"><input type="hidden" name="id" value="${esc(id)}"><input type="hidden" name="base_version" value="${esc(i.version_id||'')}"><input type="hidden" name="kind" value="${i.kind}">${i.kind==='slide'?`<label>${tr("studio_slide_type")}<select name="slide_type" ${id?'disabled':''}>${[['text',tr("studio_text_process")],['intro',tr("studio_welcome_replaces_opening_text")],['contacts',tr("studio_contact_replaces_contact_heading")],['fullphoto',tr("studio_image_with_caption")]].map(([v,t])=>`<option value="${v}" ${v===i.slide_type?'selected':''}>${t}</option>`).join('')}</select></label>`:''}<label>${tr("studio_title")}<input name="title" maxlength="160" value="${esc(i.title||'')}" required></label><label>${i.kind==='document'?tr("studio_description_optional"):tr("studio_slide_text")}<textarea name="body" rows="5" maxlength="1600">${esc(i.body||'')}</textarea></label>${i.kind==='slide'?`<p class="form-hint">${tr("studio_personalise_with_or_missing_details_stay_visible_for_you_to_edit_in_the_project")}</p>`:''}<label>${i.kind==='document'?tr("studio_reference_pdf"):tr("studio_image_only_for_image_slides")}<input name="file" type="file" accept="${i.kind==='document'?'.pdf':'.jpg,.jpeg,.png,.webp'}" ${i.kind==='document'&&!id?'required':''}></label>${fileLink(i)}<p class="form-hint">${tr("studio_up_to_20_mb_reference_pdfs_are_client_facing_add_only_documents_you_intend_to_share",{v12:id?tr("studio_leave_empty_to_keep_the_attached_file"):''})}</p><label>${tr("studio_order")}<input name="position" type="number" min="0" max="999" value="${i.position}"></label><label class="checkbox-label"><input type="checkbox" name="default_enabled" ${i.default_enabled?'checked':''}> ${tr("studio_include_in_new_projects_by_default")}</label>${footer(tr("studio_save_template"))}</form>`);
 }
 async function slidePicker(){
  const iteration=state.data.iteration.id,r=await api('project_starting_pack',{iteration});
  selection={iteration,snapshot:r.snapshot};
  const available=r.available_slides||[];
  return available.length?`<div class="pack-slide-picker"><p>${tr("studio_add_an_editable_copy_of_a_slide_this_project_does_not_have_yet")}</p><form data-form="pack-add-slide"><label>${tr("studio_studio_slide")}<select name="version_id" required>${available.map(i=>`<option value="${esc(i.version_id)}">${esc(i.preview_title)} · ${label(i)}</option>`).join('')}</select></label><p class="form-hint">${tr("studio_welcome_and_contact_templates_fill_the_default_opening_or_contact_text")}</p>${footer(tr("studio_add_template_slide"))}</form></div>`:'';
 }
 async function action(a,el){
  if(a==='pack-download'){const response=await fetch('api.php?'+new URLSearchParams({action:'pack_file',version:el.dataset.version}),{headers:{'X-Studio-ID':state.studio.id}});if(!response.ok)throw Error(tr("studio_this_template_file_is_unavailable"));const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=el.dataset.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(a==='pack-library')await library();
  if(a==='pack-new-slide')edit();
  if(a==='pack-new-document')edit('','document');
  if(a==='pack-edit')edit(el.dataset.id);
  if(a==='pack-archive'){const i=items.find(i=>i.id===el.dataset.id);openModal(tr("studio_archive_studio_template"),`<p>${tr("studio_remove_2")} <strong>${esc(i.title)}</strong> ${tr("studio_from_future_projects_existing_project_copies_stay_available")}</p><form data-form="pack-archive"><input type="hidden" name="id" value="${esc(i.id)}">${footer(tr("studio_archive_template"))}</form>`);}
  if(a==='pack-examples'){
   el.disabled=true;
   try{for(const [slide_type,title,body,position] of [['intro',tr("studio_welcome_to"),tr("studio_a_considered_design_journey_together_with"),0],['text',tr("studio_our_process"),tr("studio_discover_design_refine_we_ll_develop_your_ideas_together_and_use_this_presentation_to_review_the_des"),10],['contacts',tr("studio_let_s_talk"),tr("studio_your_designer"),90]])await api('save_pack_item',{kind:'slide',slide_type,title,body,position,default_enabled:true});await library();}finally{el.disabled=false;}
  }
 }
 async function submit(type,form){
  if(type==='pack-item'){const data=new FormData(form);if(!data.get('file')?.size)data.delete('file');await api('save_pack_item',data);await library();toast(tr("studio_studio_template_saved_existing_projects_keep_their_copies"));}
  if(type==='pack-archive'){await api('archive_pack_item',Object.fromEntries(new FormData(form)));await library();}
  if(type==='pack-add-slide'){await api('add_project_pack_slide',{...selection,version_id:new FormData(form).get('version_id')});closeModal();await refresh(true);toast(tr("studio_studio_slide_added"));}
 }
 function wizard(items,selected){return items.length?`<details class="pack-wizard"><summary>${tr("studio_studio_starting_pack_selected",{v0:selected.length})}</summary><p class="form-hint">${tr("studio_editable_slide_copies_and_client_reference_pdfs_choose_what_suits_this_project")}</p>${items.map(i=>`<label class="checkbox-label"><input type="checkbox" name="pack_version" value="${esc(i.version_id)}" ${selected.includes(i.version_id)?'checked':''}><span>${esc(i.title)}<small>${label(i)} · v${i.revision}</small></span></label>`).join('')}</details>`:'';}
 return {action,submit,wizard,slidePicker};
}
