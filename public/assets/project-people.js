export function projectPeople({getData,api,openModal,closeModal,button,formFooter,esc,personAvatar,refresh,toast,addTeam}){
 const labels={team:'Team members',clients:'Clients',other:'Other people'};
 const singular={team:'team member',clients:'client',other:'person'};
 const canEdit=()=>getData()?.can_edit!==false;
 function groups(){
  const d=getData();if(d.people)return d.people;
  const team=(d.team||d.members||[]).map(p=>({...p,key:p.id})),clients=(d.clients||(d.contacts||[]).filter(p=>p.role==='Client')).map(p=>({...p,key:p.email}));
  const known=new Set([...team,...clients].map(p=>p.email.toLowerCase()));
  return {team,clients,other:(d.contacts||[]).filter(p=>p.role!=='Client'&&!known.has(p.email.toLowerCase())).map(p=>({...p,key:p.id}))};
 }
 const find=(group,key)=>(groups()[group]||[]).find(p=>p.key===key);
 function page(){return `<div class="project-people">${Object.entries(labels).map(([group,label])=>`<section class="people-section" aria-label="${label}"><div class="section-title"><div><h2>${label}</h2><p class="muted">${{team:'Studio members who can edit this project.',clients:'People you share presentations with.',other:'Project contacts, such as subcontractors. Adding a contact does not grant access.'}[group]}</p></div>${canEdit()?button('Add','add-project-person','small',`data-group="${group}" aria-label="Add ${singular[group]}"`,'plus'):''}</div><div class="people-list">${groups()[group].map(p=>`<article class="project-person">${personAvatar(p.profile,p.name)}<div class="project-person-info"><h3>${esc(p.name)}</h3>${p.role&&group!=='clients'?`<p class="muted project-person-role">${esc(p.role)}</p>`:''}<div class="person-contact-details">${p.email?`<a href="mailto:${esc(encodeURIComponent(p.email))}">${esc(p.email)}</a>`:''}${p.phone?`<a href="tel:${esc(p.phone.replace(/[^\d+]/g,''))}">${esc(p.phone)}</a>`:''}</div></div>${canEdit()?`<div class="person-actions">${button('Edit','edit-project-person','small ghost',`data-group="${group}" data-key="${esc(p.key)}" aria-label="Edit ${esc(p.name)}"`,'edit')}${button('Remove','remove-project-person','small ghost danger-text',`data-group="${group}" data-key="${esc(p.key)}" aria-label="Remove ${esc(p.name)}"`,'minus')}</div>`:''}</article>`).join('')||`<p class="people-empty muted">No ${label.toLowerCase()} yet.</p>`}</div></section>`).join('')}</div>`;}
 async function add(group){if(!canEdit())return;if(group==='team')await addTeam();else edit(group);}
 function edit(group,key=''){
  if(!canEdit()||!labels[group])return;const p=find(group,key);if(key&&!p)return;
  if(group==='team'){
   if(!p)return;
   openModal('Edit project role',`<p>${esc(p.name)}</p><form data-form="project-person"><input type="hidden" name="group" value="team"><input type="hidden" name="key" value="${esc(key)}"><label>Role in this project<input name="role" value="${esc(p.role||'')}" maxlength="80" placeholder="For example, project architect"></label>${formFooter('Save role')}</form>`);return;
  }
  openModal(`${p?'Edit':'Add'} ${singular[group]}`,`<form data-form="project-person"><input type="hidden" name="group" value="${group}"><input type="hidden" name="key" value="${esc(key)}"><label>Name<input name="name" value="${esc(p?.name||'')}" required maxlength="100" autocomplete="name"></label><label>Email${group==='other'?' (optional)':''}<input name="email" type="email" value="${esc(p?.email||'')}" ${group!=='other'?'required':''} ${p&&group!=='other'?'readonly':''} maxlength="254" autocomplete="email"></label><label>Phone (optional)<input name="phone" type="tel" value="${esc(p?.phone||'')}" maxlength="40" autocomplete="tel"></label>${group==='other'?`<label>Role (optional)<input name="role" value="${esc(p?.role||'')}" maxlength="80" placeholder="For example, electrical contractor"></label>`:''}<p class="form-hint">${group==='clients'?'Adding a client does not send an invitation. Choose when to share an iteration.':'This person will not receive project access or an invitation.'}</p>${formFooter(p?'Save details':'Add '+singular[group])}</form>`);
 }
 function remove(group,key){
  if(!canEdit())return;const p=find(group,key);if(!p)return;
  openModal(`Remove ${singular[group]}?`,`<p>Remove <strong>${esc(p.name)}</strong> from this project?${group==='clients'?' Their existing presentation links for this project will stop working.':group==='team'?' They will no longer be able to edit this project.':''}</p><form data-form="remove-project-person"><input type="hidden" name="group" value="${group}"><input type="hidden" name="key" value="${esc(key)}">${formFooter('Remove '+singular[group],'minus')}</form>`);
 }
 async function submit(type,form){await api(type==='project-person'?'save_project_person':'remove_project_person',{...Object.fromEntries(new FormData(form)),project_id:getData().project.id});closeModal();await refresh(true);toast(type==='project-person'?(new FormData(form).get('group')==='team'?'Project role saved.':'Contact details saved.'):'Person removed from project.');}
 return {page,add,edit,remove,submit};
}

export function presentationPeople(data){
 if(data.presentation_people)return data.presentation_people;
 if(data.people)return data.people;
 const team=data.team||data.members||[],clients=data.clients||(data.contacts||[]).filter(p=>p.role==='Client');
 const known=new Set([...team,...clients].map(p=>(p.email||'').toLowerCase()).filter(Boolean));
 return {team,clients,other:(data.contacts||[]).filter(p=>p.role!=='Client'&&(!p.email||!known.has(p.email.toLowerCase())))};
}
