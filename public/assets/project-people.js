import {tr} from './i18n.js';
export function projectPeople({getData,api,openModal,closeModal,button,formFooter,esc,personAvatar,refresh,toast,addTeam}){
 const labels={get team(){return tr("team_members");},get clients(){return tr("clients");},get other(){return tr("other_people");}};
 const singular={get team(){return tr("studio_team_member_2");},get clients(){return tr('studio_client_lower');},get other(){return tr('studio_person_lower');}};
 const canEdit=()=>getData()?.can_edit!==false;
 function groups(){
  const d=getData();if(d.people)return d.people;
  const team=(d.team||d.members||[]).map(p=>({...p,key:p.id})),clients=(d.clients||(d.contacts||[]).filter(p=>p.role==='Client')).map(p=>({...p,key:p.email}));
  const known=new Set([...team,...clients].map(p=>p.email.toLowerCase()));
  return {team,clients,other:(d.contacts||[]).filter(p=>p.role!=='Client'&&!known.has(p.email.toLowerCase())).map(p=>({...p,key:p.id}))};
 }
 const find=(group,key)=>(groups()[group]||[]).find(p=>p.key===key);
 function page(){return `<div class="project-people">${Object.entries(labels).map(([group,label])=>`<section class="people-section" aria-label="${label}"><div class="section-title"><div><h2>${label}</h2><p class="muted">${{get team(){return tr("studio_studio_members_who_can_edit_this_project");},get clients(){return tr("studio_people_you_share_presentations_with");},get other(){return tr("studio_project_contacts_such_as_subcontractors_adding_a_contact_does_not_grant_access");}}[group]}</p></div>${canEdit()?button(tr("studio_add"),'add-project-person','small',`data-group="${group}" aria-label="${tr("studio_add_2",{v1:singular[group]})}"`,'plus'):''}</div><div class="people-list">${groups()[group].map(p=>`<article class="project-person">${personAvatar(p.profile,p.name)}<div class="project-person-info"><h3>${esc(p.name)}</h3>${p.role&&group!=='clients'?`<p class="muted project-person-role">${esc(p.role)}</p>`:''}<div class="person-contact-details">${p.email?`<a href="mailto:${esc(encodeURIComponent(p.email))}">${esc(p.email)}</a>`:''}${p.phone?`<a href="tel:${esc(p.phone.replace(/[^\d+]/g,''))}">${esc(p.phone)}</a>`:''}</div></div>${canEdit()?`<div class="person-actions">${button(tr("edit"),'edit-project-person','small ghost',`data-group="${group}" data-key="${esc(p.key)}" aria-label="${tr("studio_edit",{v2:esc(p.name)})}"`,'edit')}${button(tr("studio_remove_2"),'remove-project-person','small ghost danger-text',`data-group="${group}" data-key="${esc(p.key)}" aria-label="${tr("studio_remove_3",{v2:esc(p.name)})}"`,'minus')}</div>`:''}</article>`).join('')||`<p class="people-empty muted">${tr("studio_no_yet",{v0:label.toLowerCase()})}</p>`}</div></section>`).join('')}</div>`;}
 async function add(group){if(!canEdit())return;if(group==='team')await addTeam();else edit(group);}
 function edit(group,key=''){
  if(!canEdit()||!labels[group])return;const p=find(group,key);if(key&&!p)return;
  if(group==='team'){
   if(!p)return;
   openModal(tr("studio_edit_project_role"),`<p>${esc(p.name)}</p><form data-form="project-person"><input type="hidden" name="group" value="team"><input type="hidden" name="key" value="${esc(key)}"><label>${tr("studio_role_in_this_project")}<input name="role" value="${esc(p.role||'')}" maxlength="80" placeholder="${tr("studio_for_example_project_architect")}"></label>${formFooter(tr("studio_save_role"))}</form>`);return;
  }
  openModal(`${p?tr("edit"):tr("studio_add")} ${singular[group]}`,`<form data-form="project-person"><input type="hidden" name="group" value="${group}"><input type="hidden" name="key" value="${esc(key)}"><label>${tr("studio_name")}<input name="name" value="${esc(p?.name||'')}" required maxlength="100" autocomplete="name"></label><label>${tr("studio_email_2",{v3:group==='other'?` ${tr("studio_optional")}`:''})}<input name="email" type="email" value="${esc(p?.email||'')}" ${group!=='other'?'required':''} ${p&&group!=='other'?'readonly':''} maxlength="254" autocomplete="email"></label><label>${tr("studio_phone_optional")}<input name="phone" type="tel" value="${esc(p?.phone||'')}" maxlength="40" autocomplete="tel"></label>${group==='other'?`<label>${tr("studio_role_optional")}<input name="role" value="${esc(p?.role||'')}" maxlength="80" placeholder="${tr("studio_for_example_electrical_contractor")}"></label>`:''}<p class="form-hint">${group==='clients'?tr("studio_adding_a_client_does_not_send_an_invitation_choose_when_to_share_an_iteration"):tr("studio_this_person_will_not_receive_project_access_or_an_invitation")}</p>${formFooter(p?tr("studio_save_details"):`${tr("studio_add")} `+singular[group])}</form>`);
 }
 function remove(group,key){
  if(!canEdit())return;const p=find(group,key);if(!p)return;
  openModal(tr("studio_remove_4",{v0:singular[group]}),`<p>${tr("studio_remove_2")} <strong>${esc(p.name)}</strong> ${tr("studio_from_this_project",{v1:group==='clients'?` ${tr("studio_their_existing_presentation_links_for_this_project_will_stop_working")}`:group==='team'?` ${tr("studio_they_will_no_longer_be_able_to_edit_this_project")}`:''})}</p><form data-form="remove-project-person"><input type="hidden" name="group" value="${group}"><input type="hidden" name="key" value="${esc(key)}">${formFooter(`${tr("studio_remove_2")} `+singular[group],'minus')}</form>`);
 }
 async function submit(type,form){await api(type==='project-person'?'save_project_person':'remove_project_person',{...Object.fromEntries(new FormData(form)),project_id:getData().project.id});closeModal();await refresh(true);toast(type==='project-person'?(new FormData(form).get('group')==='team'?tr("studio_project_role_saved"):tr("studio_contact_details_saved")):tr("studio_person_removed_from_project"));}
 return {page,add,edit,remove,submit};
}

export function presentationPeople(data){
 if(data.presentation_people)return data.presentation_people;
 if(data.people)return data.people;
 const team=data.team||data.members||[],clients=data.clients||(data.contacts||[]).filter(p=>p.role==='Client');
 const known=new Set([...team,...clients].map(p=>(p.email||'').toLowerCase()).filter(Boolean));
 return {team,clients,other:(data.contacts||[]).filter(p=>p.role!=='Client'&&(!p.email||!known.has(p.email.toLowerCase())))};
}
