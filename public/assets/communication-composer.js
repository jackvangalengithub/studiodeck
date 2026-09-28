import * as domView from "./render.js";
import {threadTypes, normalizeThreadType} from './communication-types.js';
export {threadTypes, normalizeThreadType} from './communication-types.js';
import {getLanguage} from './i18n.js';
import {syncPersonPickers} from './person-picker.js';
const words = {
  'Conversation': 'Gesprek',
  'Approval': 'Goedkeuring',
  'Start conversation': 'Gesprek starten',
  'Request approval': 'Goedkeuring vragen',
  'Waiting for': 'Wachten op',
  'Waiting for (optional)': 'Wachten op (optioneel)',
  'Include a budget adjustment': 'Budgetaanpassing toevoegen',
  'New message': 'Nieuw bericht',
  'Conversation type': 'Gesprekstype',
  'First message': 'Eerste bericht',
  Discussion: 'Bespreking',
  'Thread type': 'Gesprekstype',
  'Start discussion': 'Bespreking starten',
  'Start question': 'Vraag stellen',
  'Create to do': 'Taak aanmaken',
  'Save thread': 'Gesprek opslaan',
  Message: 'Bericht',
  Question: 'Vraag',
  'To do': 'Te doen',
  Confirmation: 'Bevestiging',
  'Price adjustment': 'Prijsaanpassing',
  'Message type': 'Berichttype',
  'Person to answer (optional)': 'Wie kan antwoorden (optioneel)',
  Responsible: 'Verantwoordelijke',
  'Due date (optional)': 'Uiterste datum (optioneel)',
  'Choose a person': 'Kies een persoon',
  'No person selected': 'Geen persoon geselecteerd',
  'Confirm with': 'Bevestiging vragen aan',
  'Price change (€), including VAT': 'Prijswijziging (€), inclusief btw',
  'Enter the change, not the new total. Use + for extra cost or − for a reduction. The budget changes only after approval.': 'Vul de wijziging in, niet het nieuwe totaal. Gebruik + voor extra kosten of − voor een verlaging. Het budget verandert pas na akkoord.',
  'Invite to this conversation': 'Uitnodigen voor dit gesprek',
  'This invites the selected person to this conversation, including earlier messages and attachments.': 'Hiermee nodig je deze persoon uit voor dit gesprek, inclusief eerdere berichten en bijlagen.',
  'Send message': 'Bericht versturen',
  'Send question': 'Vraag versturen',
  'Add to do': 'Taak toevoegen',
  'Request confirmation': 'Bevestiging vragen',
  'Request price adjustment': 'Prijsaanpassing vragen',
  'Unlock this iteration to add work or change prices.': 'Ontgrendel deze iteratie om werk of prijswijzigingen toe te voegen.'
};
Object.assign(words, {
  'Assigned to': 'Toegewezen aan',
  'Approval from': 'Goedkeuring van',
  'Waiting for someone': 'Wachten op iemand',
  'Mark as done': 'Markeren als afgerond',
  'Mark as open': 'Markeren als open',
  'Write a reply…': 'Schrijf een reactie…',
  'Audience': 'Zichtbaar voor',
  'Public with client': 'Openbaar met klant',
  'Private internal only': 'Privé, alleen intern',
  'Clients': 'Klanten',
  'Studio members': 'Studioleden',
  'Third party / other people': 'Derden / overige personen'
});
export const composerText = s => getLanguage() === 'nl' ? words[s] || s : s;
const escape = value => String(value ?? '');
let completionId = 0;
export function completionCheckbox({checked = false, label = '', attributes = '', disabled = false} = {}) {
  const description = escape(label || composerText(checked ? 'Mark as open' : 'Mark as done')), id = domView.text(["comm-completion-tip-", ++completionId, ""]);
  return domView.element("span", [{
    "class": "comm-completion-wrap"
  }, domView.spread(disabled ? domView.attributes([{
    "tabindex": "0"
  }, {
    "aria-label": description
  }]) : '')], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "comm-completion"
  }, {
    "role": "checkbox"
  }, {
    "aria-checked": !!checked
  }, {
    "aria-label": description
  }, {
    "aria-describedby": id
  }, domView.spread(disabled ? domView.attributes([{
    "disabled": domView.text([])
  }]) : ''), domView.spread(attributes)], [domView.element("span", [{
    "class": "comm-completion-circle"
  }, {
    "aria-hidden": "true"
  }], [domView.element("svg", [{
    "viewBox": "0 0 32 32"
  }], [domView.element("path", [{
    "d": "m6 16 6.5 6.5L26 9"
  }], [], true)], true)], false)], false), domView.element("span", [{
    "class": "comm-completion-tooltip"
  }, {
    "role": "tooltip"
  }, {
    "id": id
  }], [description], false)], false);
}
export function summaryPerson(label, name, detail = '') {
  const initials = domView.join(String(name || '').trim().split(/\s+/).slice(0, 2).map(part => Array.from(part)[0] || ''), '').toUpperCase();
  return domView.element("div", [{
    "class": "comm-summary-person"
  }], [domView.element("span", [{
    "class": "comm-summary-avatar"
  }, {
    "aria-hidden": "true"
  }], [escape(initials)], false), domView.element("p", [], [domView.element("span", [], [escape(label)], false), domView.element("strong", [], [escape(name)], false), detail ? domView.element("small", [], [escape(detail)], false) : ''], false)], false);
}
export function composerFields({people = [], actor = '', locked = false, body = '', id = '', attachments = '', details = '', type = 'conversation', types = threadTypes, showBody = true, readonlyApproval = false} = {}) {
  const includeBudget = type === 'price_adjustment';
  type = normalizeThreadType(type);
  const t = composerText, e = escape, options = (approval = false) => {
    const available = people.filter(p => p.email && (!approval ? p.available !== false : (p.email !== actor || readonlyApproval) && (p.available !== false || p.invitable)));
    return domView.join([['clients', 'Clients'], ['team', 'Studio members'], ['other', 'Third party / other people']].map(([group, label]) => {
      const members = available.filter(p => (p.group || 'other') === group);
      return members.length ? domView.element("optgroup", [{
        "label": e(t(label))
      }], [domView.join(members.map(p => domView.element("option", [{
        "value": e(p.email)
      }, {
        "data-name": e(p.name || p.email)
      }, {
        "data-group": group
      }, {
        "data-invite": !!p.invitable
      }], [domView.fragment([e(p.name), approval && p.invitable && !readonlyApproval ? domView.concat(' · ', t('Invite to this conversation')) : ''])], false)), '')], false) : '';
    }), '');
  };
  return domView.fragment([domView.element("div", [{
    "class": "comm-typed-composer"
  }, {
    "data-thread-type": e(type)
  }, {
    "data-locked": locked
  }, {
    "data-approval-readonly": readonlyApproval
  }], [domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "thread_type"
  }, {
    "value": e(type)
  }], [], false), domView.element("div", [{
    "class": "comm-choice-label"
  }], [t('Conversation type')], false), domView.element("div", [{
    "class": "comm-type-tabs"
  }, {
    "role": "radiogroup"
  }, {
    "aria-label": t('Conversation type')
  }], [domView.join(types.map(([key, label]) => domView.element("button", [{
    "type": "button"
  }, {
    "role": "radio"
  }, {
    "data-compose-type": key
  }, {
    "aria-checked": key === type
  }, {
    "tabindex": key === type ? 0 : -1
  }, domView.spread(locked && key === 'todo' ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')], [t(label)], false)), '')], false), details, domView.element("button", [{
    "type": "button"
  }, {
    "class": "comm-waiting-action"
  }, {
    "data-compose-waiting": domView.text([])
  }, {
    "hidden": domView.text([])
  }], [domView.fragment(["+ ", t('Waiting for someone')])], false), domView.element("div", [{
    "data-compose-fields": "conversation todo"
  }, {
    "data-compose-assignee": domView.text([])
  }, {
    "hidden": domView.text([])
  }], [domView.element("div", [{
    "class": "comm-person-field"
  }, {
    "data-person-picker": domView.text([])
  }], [domView.element("span", [{
    "class": "comm-person-label"
  }, {
    "data-person-label": domView.text([])
  }, {
    "data-assignee-label": domView.text([])
  }], [t('Assigned to')], false), domView.element("select", [{
    "name": "assignee"
  }, {
    "aria-label": t('Assigned to')
  }, {
    "disabled": domView.text([])
  }], [domView.element("option", [{
    "value": domView.text([])
  }], [t('No person selected')], false), options()], false)], false)], false), domView.element("div", [{
    "data-compose-fields": "todo"
  }, {
    "hidden": domView.text([])
  }], [domView.element("label", [], [t('Due date (optional)'), domView.element("input", [{
    "type": "date"
  }, {
    "name": "due_date"
  }, {
    "disabled": domView.text([])
  }], [], false)], false)], false), domView.element("div", [{
    "data-compose-fields": "approval"
  }, {
    "hidden": domView.text([])
  }], [domView.element("div", [{
    "class": "comm-person-field"
  }, {
    "data-person-picker": domView.text([])
  }], [domView.element("span", [{
    "class": "comm-person-label"
  }, {
    "data-person-label": domView.text([])
  }], [t('Approval from')], false), domView.element("select", [{
    "name": "recipient"
  }, {
    "aria-label": t('Approval from')
  }, {
    "required": domView.text([])
  }, {
    "disabled": domView.text([])
  }], [domView.element("option", [{
    "value": domView.text([])
  }], [t('Choose a person')], false), options(true)], false)], false), domView.element("p", [{
    "class": "notice"
  }, {
    "data-compose-invite": domView.text([])
  }, {
    "hidden": domView.text([])
  }], [t('This invites the selected person to this conversation, including earlier messages and attachments.')], false)], false), domView.element("div", [{
    "data-compose-fields": "approval"
  }, {
    "hidden": domView.text([])
  }], [domView.element("label", [{
    "class": "check-label comm-budget-toggle"
  }], [domView.element("input", [{
    "type": "checkbox"
  }, {
    "data-budget-toggle": domView.text([])
  }, domView.spread(includeBudget ? domView.attributes([{
    "checked": domView.text([])
  }]) : ''), {
    "disabled": domView.text([])
  }], [], false), t('Include a budget adjustment')], false), domView.element("div", [{
    "data-budget-fields": domView.text([])
  }, {
    "hidden": domView.text([])
  }], [domView.element("label", [], [t('Price change (€), including VAT'), domView.element("input", [{
    "name": "amount"
  }, {
    "inputmode": "decimal"
  }, {
    "maxlength": "12"
  }, {
    "placeholder": "+1000 / -250"
  }, {
    "required": domView.text([])
  }, {
    "disabled": domView.text([])
  }], [], false)], false), domView.element("p", [{
    "class": "form-hint"
  }], [t('Enter the change, not the new total. Use + for extra cost or − for a reduction. The budget changes only after approval.')], false)], false)], false), locked ? domView.element("p", [{
    "class": "form-hint"
  }], [t('Unlock this iteration to add work or change prices.')], false) : ''], false), showBody ? domView.element("div", [{
    "class": "comm-first-message"
  }], [domView.element("label", [], [t('First message'), domView.element("textarea", [{
    "name": "body"
  }, domView.spread(id ? domView.attributes([{
    "id": e(id)
  }]) : ''), {
    "required": domView.text([])
  }, {
    "maxlength": "4000"
  }, {
    "rows": "3"
  }], [e(body)], false)], false), attachments], false) : '']);
}
export function selectComposerType(box, type) {
  if (!box || !threadTypes.some(([key]) => key === type)) return;
  const tab = box.querySelector(domView.text(["[data-compose-type=\"", type, "\"]"]));
  if (!tab || tab.disabled) return;
  box.dataset.threadType = type;
  box.querySelector('[name=thread_type]').value = type;
  box.querySelectorAll('[data-compose-type]').forEach(b => {
    b.setAttribute('aria-checked', String(b === tab));
    b.tabIndex = b === tab ? 0 : -1;
  });
  box.querySelectorAll('[data-compose-fields]').forEach(panel => {
    const active = panel.dataset.composeFields.split(' ').includes(type);
    panel.hidden = !active;
    panel.querySelectorAll('input,select').forEach(el => el.disabled = !active || box.dataset.approvalReadonly === 'true' && panel.dataset.composeFields === 'approval');
  });
  box.querySelector('[name=assignee]').required = type === 'todo';
  box.querySelector('[data-assignee-label]').textContent = composerText(type === 'todo' ? 'Assigned to' : 'Waiting for');
  box.querySelector('[name=assignee]').setAttribute('aria-label', composerText(type === 'todo' ? 'Assigned to' : 'Waiting for'));
  const form = box.closest('form'), submit = form?.querySelector('[type=submit]');
  if (submit) submit.textContent = form.dataset.editThread ? composerText('Save thread') : composerText(({
    conversation: 'Start conversation',
    todo: 'Create to do',
    approval: 'Request approval'
  })[type]);
  updateComposerBudget(box);
  updateComposerAudience(form);
}
function updateComposerBudget(box) {
  if (!box) return;
  const locked = box.dataset.locked === 'true', readonly = box.dataset.approvalReadonly === 'true', approval = box.dataset.threadType === 'approval', toggle = box.querySelector('[data-budget-toggle]'), panel = box.querySelector('[data-budget-fields]'), amount = box.querySelector('[name=amount]');
  toggle.disabled = !approval || locked || readonly;
  panel.hidden = !approval || !toggle.checked || locked;
  amount.disabled = panel.hidden || readonly;
  amount.required = !amount.disabled;
  if (locked && box.dataset.threadType === 'conversation') box.querySelector('[name=assignee]').disabled = true;
}
function updateComposerPeople(box) {
  if (!box) return;
  const conversation = box.dataset.threadType === 'conversation', assignee = box.querySelector('[name=assignee]'), waiting = box.querySelector('[data-compose-waiting]');
  const showWaiting = !!assignee.value || box.dataset.waiting === 'true';
  waiting.hidden = !conversation || showWaiting || box.dataset.locked === 'true';
  box.querySelector('[data-compose-assignee]').hidden = !(box.dataset.threadType === 'todo' || conversation && showWaiting);
  syncPersonPickers(box);
}
export function updateComposerAudience(form) {
  if (!form) return;
  const studio = form.elements.audience?.value === 'studio';
  const shareHint = form.querySelector('[data-compose-share-history]');
  if (shareHint) shareHint.hidden = studio || form.dataset.originalAudience !== 'studio';
  form.querySelectorAll('[name=recipient] option,[name=assignee] option').forEach(o => {
    o.disabled = studio && !!o.value && o.dataset.group !== 'team';
    if (o.disabled && o.selected) o.closest('select').value = '';
  });
  const box = form.querySelector('.comm-typed-composer'), select = form.elements.recipient, hint = box?.querySelector('[data-compose-invite]');
  if (hint) hint.hidden = select?.disabled || select?.selectedOptions[0]?.dataset.invite !== 'true';
  updateComposerPeople(box);
}
export function audienceSwitch(value = 'studio', fixed = false) {
  return domView.element("div", [{
    "class": "comm-audience-field"
  }], [domView.element("div", [{
    "class": "comm-choice-label"
  }], [composerText('Audience')], false), domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "audience"
  }, {
    "value": value === 'studio' ? 'studio' : 'shared'
  }], [], false), domView.element("div", [{
    "class": "comm-audience-switch"
  }, {
    "role": "radiogroup"
  }, {
    "aria-label": composerText('Audience')
  }], [domView.join([['shared', 'Public with client'], ['studio', 'Private internal only']].map(([key, label]) => domView.element("button", [{
    "type": "button"
  }, {
    "role": "radio"
  }, {
    "data-compose-audience": key
  }, {
    "aria-checked": key === value
  }, {
    "tabindex": key === value ? 0 : -1
  }, domView.spread(fixed ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')], [composerText(label)], false)), '')], false)], false);
}
function selectComposerAudience(tab) {
  if (tab.disabled) return;
  const form = tab.closest('form');
  form.elements.audience.value = tab.dataset.composeAudience;
  tab.parentElement.querySelectorAll('[data-compose-audience]').forEach(b => {
    b.setAttribute('aria-checked', String(b === tab));
    b.tabIndex = b === tab ? 0 : -1;
  });
  form.elements.audience.dispatchEvent(new Event('change', {
    bubbles: true
  }));
}
export function initComposers(container = document) {
  container.querySelectorAll('.comm-typed-composer').forEach(box => selectComposerType(box, box.dataset.threadType));
}
document.addEventListener('click', e => {
  const waiting = e.target.closest('[data-compose-waiting]');
  if (waiting) {
    const box = waiting.closest('.comm-typed-composer');
    box.dataset.waiting = 'true';
    updateComposerPeople(box);
    box.querySelector('[data-compose-assignee] [data-person-chip]').click();
    return;
  }
  const audience = e.target.closest('[data-compose-audience]');
  if (audience) {
    e.preventDefault();
    selectComposerAudience(audience);
    return;
  }
  const tab = e.target.closest('[data-compose-type]');
  if (!tab) return;
  e.preventDefault();
  selectComposerType(tab.closest('.comm-typed-composer'), tab.dataset.composeType);
});
document.addEventListener('keydown', e => {
  const tab = e.target.closest('[data-compose-type],[data-compose-audience]');
  if (!tab || tab.disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const tabs = [...tab.parentElement.querySelectorAll('button:not(:disabled)')], n = tabs.indexOf(tab), next = tabs[e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : domView.concat(domView.concat(n, ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1), tabs.length) % tabs.length];
  next.click();
  next.focus();
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-budget-toggle]')) updateComposerBudget(e.target.closest('.comm-typed-composer'));
  const box = e.target.closest('.comm-typed-composer');
  if (box && e.target.name === 'assignee' && !e.target.value) delete box.dataset.waiting;
  if (['audience', 'recipient', 'assignee'].includes(e.target.name)) updateComposerAudience(e.target.closest('form'));
});
export function plainMessageFields({body = '', id = '', attachments = '', compact = false} = {}) {
  return domView.fragment([domView.element("label", [], [compact ? domView.element("span", [{
    "class": "sr-only"
  }], [composerText('New message')], false) : composerText('New message'), domView.element("textarea", [{
    "name": "body"
  }, domView.spread(id ? domView.attributes([{
    "id": escape(id)
  }]) : ''), {
    "required": domView.text([])
  }, {
    "maxlength": "4000"
  }, {
    "rows": compact ? 2 : 3
  }, domView.spread(compact ? domView.attributes([{
    "placeholder": composerText('Write a reply…')
  }]) : '')], [escape(body)], false)], false), attachments]);
}
