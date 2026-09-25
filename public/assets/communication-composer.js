import {threadTypes,normalizeThreadType} from './communication-types.js';
export {threadTypes,normalizeThreadType} from './communication-types.js';
import {getLanguage} from './i18n.js';
const words={'Conversation':'Gesprek','Approval':'Goedkeuring','Start conversation':'Gesprek starten','Request approval':'Goedkeuring vragen','Waiting for':'Wachten op','Waiting for (optional)':'Wachten op (optioneel)','Include a budget adjustment':'Budgetaanpassing toevoegen','New message':'Nieuw bericht','Conversation type':'Gesprekstype','First message':'Eerste bericht',Discussion:'Bespreking','Thread type':'Gesprekstype','Start discussion':'Bespreking starten','Start question':'Vraag stellen','Create to do':'Taak aanmaken','Save thread':'Gesprek opslaan',Message:'Bericht',Question:'Vraag','To do':'Te doen',Confirmation:'Bevestiging','Price adjustment':'Prijsaanpassing','Message type':'Berichttype','Person to answer (optional)':'Wie kan antwoorden (optioneel)',Responsible:'Verantwoordelijke','Due date (optional)':'Uiterste datum (optioneel)','Choose a person':'Kies een persoon','No person selected':'Geen persoon geselecteerd','Confirm with':'Bevestiging vragen aan','Price change (€), including VAT':'Prijswijziging (€), inclusief btw','Enter the change, not the new total. Use + for extra cost or − for a reduction. The budget changes only after approval.':'Vul de wijziging in, niet het nieuwe totaal. Gebruik + voor extra kosten of − voor een verlaging. Het budget verandert pas na akkoord.','Invite to this conversation':'Uitnodigen voor dit gesprek','This invites the selected person to this conversation, including earlier messages and attachments.':'Hiermee nodig je deze persoon uit voor dit gesprek, inclusief eerdere berichten en bijlagen.','Send message':'Bericht versturen','Send question':'Vraag versturen','Add to do':'Taak toevoegen','Request confirmation':'Bevestiging vragen','Request price adjustment':'Prijsaanpassing vragen','Unlock this iteration to add work or change prices.':'Ontgrendel deze iteratie om werk of prijswijzigingen toe te voegen.'};
Object.assign(words,{'Mark as done':'Markeren als afgerond','Mark as open':'Markeren als open','Write a reply…':'Schrijf een reactie…','Audience':'Zichtbaar voor','Public with client':'Openbaar met klant','Private internal only':'Privé, alleen intern','Clients':'Klanten','Studio members':'Studioleden','Third party / other people':'Derden / overige personen'});
export const composerText=s=>getLanguage()==='nl'?(words[s]||s):s;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let completionId=0;
export function completionCheckbox({checked=false,label='',attributes='',disabled=false}={}){
 const description=escape(label||composerText(checked?'Mark as open':'Mark as done')),id=`comm-completion-tip-${++completionId}`;
 return `<span class="comm-completion-wrap" ${disabled?`tabindex="0" aria-label="${description}"`:''}><button type="button" class="comm-completion" role="checkbox" aria-checked="${!!checked}" aria-label="${description}" aria-describedby="${id}" ${disabled?'disabled':''} ${attributes}><span class="comm-completion-circle" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m6 16 6.5 6.5L26 9"/></svg></span></button><span class="comm-completion-tooltip" role="tooltip" id="${id}">${description}</span></span>`;
}
export function summaryPerson(label,name,detail=''){
 const initials=String(name||'').trim().split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]||'').join('').toUpperCase();
 return `<div class="comm-summary-person"><span class="comm-summary-avatar" aria-hidden="true">${escape(initials)}</span><p><span>${escape(label)}</span><strong>${escape(name)}</strong>${detail?`<small>${escape(detail)}</small>`:''}</p></div>`;
}
export function composerFields({people=[],actor='',locked=false,body='',id='',attachments='',details='',type='conversation',types=threadTypes,showBody=true,readonlyApproval=false}={}){
 const includeBudget=type==='price_adjustment';type=normalizeThreadType(type);
 const t=composerText,e=escape,options=(approval=false)=>{
  const available=people.filter(p=>p.email&&(!approval?p.available!==false:(p.email!==actor||readonlyApproval)&&(p.available!==false||p.invitable)));
  return [['clients','Clients'],['team','Studio members'],['other','Third party / other people']].map(([group,label])=>{
   const members=available.filter(p=>(p.group||'other')===group);
   return members.length?`<optgroup label="${e(t(label))}">${members.map(p=>`<option value="${e(p.email)}" data-group="${group}" data-invite="${!!p.invitable}">${e(p.name)}${approval&&p.invitable&&!readonlyApproval?' · '+t('Invite to this conversation'):''}</option>`).join('')}</optgroup>`:'';
  }).join('');
 };
 return `<div class="comm-typed-composer" data-thread-type="${e(type)}" data-locked="${locked}" data-approval-readonly="${readonlyApproval}"><input type="hidden" name="thread_type" value="${e(type)}"><div class="comm-choice-label">${t('Conversation type')}</div><div class="comm-type-tabs" role="radiogroup" aria-label="${t('Conversation type')}">${types.map(([key,label])=>`<button type="button" role="radio" data-compose-type="${key}" aria-checked="${key===type}" tabindex="${key===type?0:-1}" ${locked&&key==='todo'?'disabled':''}>${t(label)}</button>`).join('')}</div>${details}<div data-compose-fields="conversation todo" hidden><label><span data-assignee-label>${t('Responsible')}</span><select name="assignee" disabled><option value="">${t('No person selected')}</option>${options()}</select></label></div><div data-compose-fields="todo" hidden><label>${t('Due date (optional)')}<input type="date" name="due_date" disabled></label></div><div data-compose-fields="approval" hidden><label>${t('Confirm with')}<select name="recipient" required disabled><option value="">${t('Choose a person')}</option>${options(true)}</select></label><p class="notice" data-compose-invite hidden>${t('This invites the selected person to this conversation, including earlier messages and attachments.')}</p></div><div data-compose-fields="approval" hidden><label class="check-label comm-budget-toggle"><input type="checkbox" data-budget-toggle ${includeBudget?'checked':''} disabled>${t('Include a budget adjustment')}</label><div data-budget-fields hidden><label>${t('Price change (€), including VAT')}<input name="amount" inputmode="decimal" maxlength="12" placeholder="+1000 / -250" required disabled></label><p class="form-hint">${t('Enter the change, not the new total. Use + for extra cost or − for a reduction. The budget changes only after approval.')}</p></div></div>${locked?`<p class="form-hint">${t('Unlock this iteration to add work or change prices.')}</p>`:''}</div>${showBody?`<div class="comm-first-message"><label>${t('First message')}<textarea name="body" ${id?`id="${e(id)}"`:''} required maxlength="4000" rows="3">${e(body)}</textarea></label>${attachments}</div>`:''}`;
}
export function selectComposerType(box,type){
 if(!box||!threadTypes.some(([key])=>key===type))return;
 const tab=box.querySelector(`[data-compose-type="${type}"]`);if(!tab||tab.disabled)return;
 box.dataset.threadType=type;box.querySelector('[name=thread_type]').value=type;
 box.querySelectorAll('[data-compose-type]').forEach(b=>{b.setAttribute('aria-checked',String(b===tab));b.tabIndex=b===tab?0:-1;});
 box.querySelectorAll('[data-compose-fields]').forEach(panel=>{const active=panel.dataset.composeFields.split(' ').includes(type);panel.hidden=!active;panel.querySelectorAll('input,select').forEach(el=>el.disabled=!active||(box.dataset.approvalReadonly==='true'&&panel.dataset.composeFields==='approval'));});
 box.querySelector('[name=assignee]').required=type==='todo';box.querySelector('[data-assignee-label]').textContent=composerText(type==='todo'?'Responsible':'Waiting for (optional)');
 const form=box.closest('form'),submit=form?.querySelector('[type=submit]');if(submit)submit.textContent=form.dataset.editThread?composerText('Save thread'):composerText({conversation:'Start conversation',todo:'Create to do',approval:'Request approval'}[type]);
 updateComposerBudget(box);updateComposerAudience(form);
}
function updateComposerBudget(box){
 if(!box)return;const locked=box.dataset.locked==='true',readonly=box.dataset.approvalReadonly==='true',approval=box.dataset.threadType==='approval',toggle=box.querySelector('[data-budget-toggle]'),panel=box.querySelector('[data-budget-fields]'),amount=box.querySelector('[name=amount]');
 toggle.disabled=!approval||locked||readonly;panel.hidden=!approval||!toggle.checked||locked;amount.disabled=panel.hidden||readonly;amount.required=!amount.disabled;
 if(locked&&box.dataset.threadType==='conversation')box.querySelector('[name=assignee]').disabled=true;
}
export function updateComposerAudience(form){
 if(!form)return;const studio=form.elements.audience?.value==='studio';const shareHint=form.querySelector('[data-compose-share-history]');if(shareHint)shareHint.hidden=studio||form.dataset.originalAudience!=='studio';
 form.querySelectorAll('[name=recipient] option,[name=assignee] option').forEach(o=>{o.disabled=studio&&!!o.value&&o.dataset.group!=='team';if(o.disabled&&o.selected)o.closest('select').value='';});
 const box=form.querySelector('.comm-typed-composer'),select=form.elements.recipient,hint=box?.querySelector('[data-compose-invite]');if(hint)hint.hidden=select?.disabled||select?.selectedOptions[0]?.dataset.invite!=='true';
}
export function audienceSwitch(value='studio',fixed=false){
 return `<div class="comm-audience-field"><div class="comm-choice-label">${composerText('Audience')}</div><input type="hidden" name="audience" value="${value==='studio'?'studio':'shared'}"><div class="comm-audience-switch" role="radiogroup" aria-label="${composerText('Audience')}">${[['shared','Public with client'],['studio','Private internal only']].map(([key,label])=>`<button type="button" role="radio" data-compose-audience="${key}" aria-checked="${key===value}" tabindex="${key===value?0:-1}" ${fixed?'disabled':''}>${composerText(label)}</button>`).join('')}</div></div>`;
}
function selectComposerAudience(tab){
 if(tab.disabled)return;const form=tab.closest('form');form.elements.audience.value=tab.dataset.composeAudience;
 tab.parentElement.querySelectorAll('[data-compose-audience]').forEach(b=>{b.setAttribute('aria-checked',String(b===tab));b.tabIndex=b===tab?0:-1;});
 form.elements.audience.dispatchEvent(new Event('change',{bubbles:true}));
}
export function initComposers(container=document){container.querySelectorAll('.comm-typed-composer').forEach(box=>selectComposerType(box,box.dataset.threadType));}
document.addEventListener('click',e=>{const audience=e.target.closest('[data-compose-audience]');if(audience){e.preventDefault();selectComposerAudience(audience);return;}const tab=e.target.closest('[data-compose-type]');if(!tab)return;e.preventDefault();selectComposerType(tab.closest('.comm-typed-composer'),tab.dataset.composeType);});
document.addEventListener('keydown',e=>{const tab=e.target.closest('[data-compose-type],[data-compose-audience]');if(!tab||tab.disabled||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...tab.parentElement.querySelectorAll('button:not(:disabled)')],n=tabs.indexOf(tab),next=tabs[e.key==='Home'?0:e.key==='End'?tabs.length-1:(n+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+tabs.length)%tabs.length];next.click();next.focus();});
document.addEventListener('change',e=>{if(e.target.matches('[data-budget-toggle]'))updateComposerBudget(e.target.closest('.comm-typed-composer'));if(['audience','recipient'].includes(e.target.name))updateComposerAudience(e.target.closest('form'));});

export function plainMessageFields({body='',id='',attachments='',compact=false}={}){return `<label>${compact?`<span class="sr-only">${composerText('New message')}</span>`:composerText('New message')}<textarea name="body" ${id?`id="${escape(id)}"`:''} required maxlength="4000" rows="${compact?2:3}" ${compact?`placeholder="${composerText('Write a reply…')}"`: ''}>${escape(body)}</textarea></label>${attachments}`;}
