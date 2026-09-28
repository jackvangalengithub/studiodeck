import {safeUrl} from './dom.js';
import * as domView from "./render.js";
import {summaryPerson, completionCheckbox, audienceSwitch, plainMessageFields, composerFields, initComposers, composerText, threadTypes} from './communication-composer.js';
import {mountErrorPage} from '../auth/error-page.js';
import {installMentions, mentionData, mentionBody} from './mentions.js';
import {setLanguage, getLanguage} from './i18n.js';
import {applyStudioTheme} from './studio.js';
import {platform} from './platform/client.js';
const root = location.pathname.split('/')[2];
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '');
const nl = {
  'Conversation': 'Gesprek',
  'Your shared conversations': 'Je gedeelde gesprekken',
  'You have access to this conversation and its attachments.': 'Je hebt toegang tot dit gesprek en de bijlagen.',
  'Message': 'Bericht',
  'Post reply': 'Reactie plaatsen',
  'Ask for confirmation': 'Om bevestiging vragen',
  'Confirm with': 'Bevestiging vragen aan',
  'Include a budget change': 'Budgetwijziging toevoegen',
  'Budget change (€) · including VAT': 'Budgetwijziging (€) · inclusief btw',
  'Use a positive amount for extra cost (1000), or a negative amount for a cheaper option (−250). Enter the change, not the new total.': 'Gebruik een positief bedrag voor extra kosten (1000), of een negatief bedrag voor een goedkopere optie (−250). Vul de wijziging in, niet het nieuwe totaal.',
  'Added to the budget only after confirmation.': 'Wordt pas na bevestiging aan het budget toegevoegd.',
  'Pending confirmation': 'Wacht op bevestiging',
  'Confirmed': 'Bevestigd',
  'Withdrawn': 'Ingetrokken',
  'Confirm': 'Bevestigen',
  'Withdraw': 'Intrekken',
  'Withdraw this request?': 'Dit verzoek intrekken?',
  'The message stays visible as withdrawn.': 'Het bericht blijft zichtbaar als ingetrokken.',
  'Cancel': 'Annuleren',
  'Send confirmation request': 'Verstuur bevestigingsverzoek',
  'including VAT': 'inclusief btw',
  'Budget change': 'Budgetwijziging',
  'Confirmed by': 'Bevestigd door',
  'Waiting for': 'Wacht op',
  'Link an attachment from this conversation': 'Koppel een bijlage uit dit gesprek',
  'No attachment': 'Geen bijlage',
  'Reply posted.': 'Reactie geplaatst.',
  'Request sent.': 'Verzoek verstuurd.',
  'Confirmation recorded.': 'Bevestiging vastgelegd.',
  'Request withdrawn.': 'Verzoek ingetrokken.',
  'Close dialog': 'Venster sluiten',
  'Download': 'Downloaden'
};
Object.assign(nl, {
  'Started by': 'Gestart door',
  'Shared': 'Gedeeld',
  'New linked thread': 'Nieuw gekoppeld gesprek',
  'Subject': 'Onderwerp',
  'This creates a separate thread with its own status. Only existing participants can be selected.': 'Dit maakt een apart gesprek met een eigen status. Je kunt alleen bestaande deelnemers kiezen.',
  'Reopen': 'Heropenen',
  'Mark complete': 'Markeer als afgerond',
  'Resolved': 'Opgelost',
  'Mark resolved': 'Markeer als opgelost',
  'Open': 'Open',
  'Requested by': 'Aangevraagd door',
  'Open action': 'Open actie',
  'Completed': 'Afgerond'
});
const t = s => getLanguage() === 'nl' ? nl[s] || s : s;
let csrf = '', data = null, busy = false, draft = '', lastFocus = null, sessionUser = '', batchJson = false;
installMentions({
  actor: () => data?.actor,
  context: form => ['guest-reply', 'guest-request'].includes(form?.id) ? {
    conversation: root
  } : null,
  load: context => api('mention_people', null, context)
});
const money = n => domView.concat(n > 0 ? '+ ' : n < 0 ? '− ' : '', new Intl.NumberFormat(getLanguage() === 'nl' ? 'nl-NL' : 'en-IE', {
  style: 'currency',
  currency: 'EUR'
}).format(Math.abs(n) / 100));
const time = s => new Date(s).toLocaleString(getLanguage() === 'nl' ? 'nl-NL' : 'en-GB');
const person = email => data.recipients.find(p => p.email === email)?.name || data.comments.find(c => c.author === email)?.name || email;
async function api(action, body = null, query = {}) {
  return platform.request(action, body || query);
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('show');
  setTimeout(() => $('#toast').classList.remove('show'), 5000);
}
function close() {
  const back = lastFocus;
  $('#overlay').replaceChildren();
  document.body.style.overflow = '';
  back?.isConnected && back.focus();
}
function modal(title, body) {
  lastFocus = document.activeElement;
  domView.mount($('#overlay'), domView.element("div", [{
    "class": "modal-backdrop"
  }], [domView.element("section", [{
    "class": "modal"
  }, {
    "role": "dialog"
  }, {
    "aria-modal": "true"
  }, {
    "aria-labelledby": "guest-modal-title"
  }], [domView.element("header", [{
    "class": "modal-header"
  }], [domView.element("h2", [{
    "id": "guest-modal-title"
  }], [t(title)], false), domView.element("button", [{
    "type": "button"
  }, {
    "data-close": domView.text([])
  }, {
    "aria-label": t('Close dialog')
  }], ["×"], false)], false), domView.element("div", [{
    "class": "modal-body"
  }], [body], false)], false)], false));
  document.body.style.overflow = 'hidden';
  $('#overlay input, #overlay textarea, #overlay button')?.focus();
}
function attachment(c) {
  return domView.join(data.attachments.filter(a => a.comment_id === c.id).map(a => domView.element("a", [{
    "class": "comm-attachment"
  }, {
    "href": a.url || ''
  }, {
    "download": domView.text([])
  }], [domView.fragment([a.name, " · V", a.number, " "]), domView.element("small", [], [t('Download')], false)], false)), '');
}
function message(c) {
  const r = data.confirmations.find(r => r.comment_id === c.id);
  if (!r || c.thread_details) return domView.element("article", [{
    "class": "comm-message"
  }], [domView.element("div", [{
    "class": "comment-author"
  }], [domView.element("small", [], [domView.element("strong", [], [c.name], false), domView.fragment([" · ", time(c.created_at)])], false)], false), domView.element("div", [{
    "class": "comm-message-body"
  }], [domView.element("p", [], [mentionBody(c.body, c.mentions)], false), attachment(c)], false)], false);
  const done = r.status !== 'pending';
  return domView.element("article", [{
    "class": domView.text(["comm-confirmation is-", r.status])
  }, {
    "data-confirmation": c.id
  }], [domView.element("div", [{
    "class": "comm-confirmation-top"
  }], [domView.element("span", [{
    "class": domView.text(["comm-status ", r.status === 'confirmed' ? 'done' : done ? 'closed' : 'pending'])
  }], [t(r.status === 'confirmed' ? 'Confirmed' : done ? 'Withdrawn' : 'Pending confirmation')], false), domView.element("small", [], [domView.fragment([c.name, " → ", r.recipient_name])], false)], false), domView.fragment([c.header ? '' : domView.fragment([domView.element("p", [], [mentionBody(c.body, c.mentions)], false), attachment(c)]), r.amount_cents !== null ? domView.element("div", [{
    "class": "comm-budget-change"
  }], [domView.fragment([t('Budget change'), " "]), domView.element("strong", [], [money(r.amount_cents)], false), domView.element("small", [], [t('including VAT')], false)], false) : '']), domView.element("div", [{
    "class": "comm-confirmation-bottom"
  }], [done ? domView.element("small", [], [domView.fragment([t(r.status === 'confirmed' ? 'Confirmed by' : 'Withdrawn'), " ", person(r.decided_by), " · ", time(r.decided_at)])], false) : domView.text(["", r.recipient === data.actor ? domView.element("button", [{
    "class": "button primary small"
  }, {
    "data-confirm": c.id
  }, domView.spread(data.locked && r.amount_cents !== null ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')], [domView.fragment([t('Confirm'), r.amount_cents !== null ? domView.concat(' · ', money(r.amount_cents)) : ''])], false) : domView.element("small", [], [domView.fragment([t('Waiting for'), " ", r.recipient_name])], false), "", c.author === data.actor ? domView.element("button", [{
    "class": "button small ghost"
  }, {
    "data-withdraw": c.id
  }], [t('Withdraw')], false) : '', ""])], false)], false);
}
function render() {
  const first = data.comments.find(c => c.id === root), details = first?.thread_details, request = data.confirmations.find(r => r.comment_id === root);
  const typeLabel = composerText(threadTypes.find(([key]) => key === (details?.type || (request ? 'approval' : 'conversation')))?.[1] || 'Conversation');
  const canComplete = details?.question_id && !data.locked && (first.author === data.actor || details.assignee === data.actor);
  const status = request ? request.status === 'confirmed' ? 'Confirmed' : request.status === 'withdrawn' ? 'Withdrawn' : 'Pending confirmation' : details?.resolved ? details.type === 'conversation' ? 'Resolved' : 'Completed' : 'Open';
  const statusClass = request ? request.status === 'confirmed' ? 'done' : request.status === 'withdrawn' ? 'closed' : 'pending' : details?.resolved ? 'done' : 'pending';
  const canConfirm = request?.status === 'pending' && request.recipient === data.actor && !(data.locked && request.amount_cents !== null);
  const completion = request ? completionCheckbox({
    checked: request.status === 'confirmed',
    disabled: !canConfirm,
    label: canConfirm ? domView.concat(t('Confirm'), request.amount_cents !== null ? domView.concat(' · ', money(request.amount_cents)) : '') : request.status === 'pending' ? domView.concat(domView.concat(t('Waiting for'), ' '), request.recipient_name) : t(request.status === 'confirmed' ? 'Confirmed' : 'Withdrawn'),
    attributes: domView.attributes([{
      "data-confirm": root
    }])
  }) : completionCheckbox({
    checked: !!details?.resolved,
    disabled: !canComplete,
    attributes: domView.attributes([{
      "data-work": root
    }, {
      "data-resolved": !details?.resolved
    }])
  });
  const personName = request ? request.status === 'withdrawn' ? person(first.author) : request.recipient_name : details?.assignee_name || first.name;
  const personLabel = request ? t(request.status === 'confirmed' ? 'Confirmed by' : request.status === 'withdrawn' ? 'Requested by' : 'Confirm with') : details?.assignee_name ? composerText(details.type === 'conversation' ? 'Waiting for' : 'Responsible') : t('Started by');
  const meta = domView.concat(summaryPerson(personLabel, personName, request?.decided_at ? time(request.decided_at) : ''), domView.element("div", [{
    "class": "comm-summary-detail"
  }], [domView.fragment([details?.due_date ? domView.element("p", [], [domView.element("span", [], [composerText('Due date (optional)').replace(' (optional)', '').replace(' (optioneel)', '')], false), domView.element("strong", [], [details.due_date], false)], false) : '', request?.amount_cents !== null && request?.amount_cents !== undefined ? domView.element("p", [{
    "class": "comm-summary-amount"
  }], [domView.element("strong", [], [money(request.amount_cents)], false), domView.element("small", [], [domView.fragment([t('Budget change'), " · ", t('including VAT')])], false)], false) : ''])], false));
  const header = domView.element("div", [{
    "class": "comm-thread-details"
  }, {
    "data-thread-type": details?.type || (request ? 'approval' : 'conversation')
  }], [domView.element("article", [{
    "class": domView.text(["comm-thread-summary", request ? domView.concat(' comm-confirmation is-', request.status) : ''])
  }, domView.spread(request ? domView.attributes([{
    "data-confirmation": root
  }]) : '')], [domView.element("div", [{
    "class": "comm-summary-main"
  }], [domView.element("div", [{
    "class": "comm-summary-copy"
  }], [domView.element("div", [{
    "class": "comm-summary-eyebrow"
  }], [domView.element("span", [{
    "class": "comm-type-label"
  }], [typeLabel], false), domView.element("span", [{
    "class": domView.text(["comm-status ", statusClass])
  }], [t(status)], false)], false), domView.element("div", [{
    "class": "comm-summary-title"
  }], [domView.element("h2", [], [data.title], false)], false), domView.element("div", [{
    "class": "comm-summary-body"
  }], [domView.element("p", [], [mentionBody(first.body, first.mentions)], false), domView.element("small", [{
    "class": "comm-summary-attribution"
  }], [domView.fragment([first.name, " · ", time(first.created_at)])], false), attachment(first)], false)], false), completion], false), domView.element("div", [{
    "class": "comm-summary-meta"
  }], [meta], false)], false), domView.element("div", [{
    "class": "comm-summary-actions"
  }], [request?.status === 'pending' && first.author === data.actor ? domView.element("button", [{
    "class": "button small ghost"
  }, {
    "data-withdraw": root
  }], [t('Withdraw')], false) : '', domView.element("button", [{
    "class": "button small ghost"
  }, {
    "data-new-thread": domView.text([])
  }], [t('New linked thread')], false)], false), (data.linked_threads || []).length ? domView.element("div", [{
    "class": "comm-linked"
  }], [domView.join(data.linked_threads.map(link => domView.element("a", [{
    "class": "button small ghost"
  }, {
    "href": domView.text(["/conversations/", encodeURIComponent(link.id)])
  }], [link.title], false)), '')], false) : ''], false);
  domView.mount($('#app'), domView.element("main", [{
    "id": "main"
  }, {
    "class": "main-content comm-client-page comm-guest-page"
  }], [domView.element("div", [{
    "class": "section-title"
  }], [domView.element("h1", [], [data.project_name], false), domView.element("a", [{
    "class": "button small"
  }, {
    "href": "/choose"
  }], [t('Your shared conversations')], false)], false), domView.element("section", [{
    "class": "comm-thread"
  }], [domView.element("header", [{
    "class": "comm-thread-head"
  }], [header], false), domView.element("form", [{
    "id": "guest-reply"
  }, {
    "class": "comm-composer"
  }], [plainMessageFields({
    body: draft,
    id: 'guest-message',
    compact: true,
    attachments: domView.element("label", [], [t('Link an attachment from this conversation'), domView.element("select", [{
      "name": "version_id"
    }], [domView.element("option", [{
      "value": domView.text([])
    }], [t('No attachment')], false), domView.join([...new Map(data.attachments.map(a => [a.id, a])).values()].map(a => domView.element("option", [{
      "value": a.id
    }], [domView.fragment([a.name, " · V", a.number])], false)), '')], false)], false)
  }), domView.element("div", [{
    "class": "comm-compose-actions"
  }], [domView.element("button", [{
    "type": "submit"
  }, {
    "class": "button primary"
  }], [composerText('Send message')], false)], false)], false), domView.element("div", [{
    "class": "comm-messages"
  }], [domView.join(data.comments.filter(c => c.id !== root).reverse().map(message), '')], false)], false)], false));
}
async function refresh() {
  const updated = await api('conversation', null, {
    id: root
  });
  data = updated;
  setLanguage(data.language);
  render();
}
document.addEventListener('input', e => {
  if (e.target.matches('#guest-reply [name=body]')) draft = e.target.value;
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !busy) close();
  if (e.key === 'Tab' && $('.modal')) {
    const items = [...$('.modal').querySelectorAll('button:not(:disabled),input:not(:disabled),textarea,select,a[href]')].filter(x => x.getClientRects().length);
    if (e.shiftKey && document.activeElement === items[0]) {
      e.preventDefault();
      items.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
      e.preventDefault();
      items[0].focus();
    }
  }
});
document.addEventListener('click', async e => {
  const el = e.target.closest('button');
  if (!el || busy) return;
  if (el.dataset.work) {
    busy = true;
    try {
      await api('communication_work_decide', {
        conversation: root,
        id: el.dataset.work,
        resolved: el.dataset.resolved === 'true'
      });
      await refresh();
    } catch (error) {
      toast(error.message);
    } finally {
      busy = false;
    }
    return;
  }
  if (el.hasAttribute('data-new-thread')) {
    modal('New linked thread', domView.fragment([domView.element("p", [], [t('This creates a separate thread with its own status. Only existing participants can be selected.')], false), domView.element("form", [{
      "id": "guest-request"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "related_thread_id"
    }, {
      "value": root
    }], [], false), composerFields({
      people: data.recipients,
      actor: data.actor,
      locked: data.locked,
      details: domView.fragment([domView.element("label", [], [t('Subject'), domView.element("input", [{
        "name": "thread_title"
      }, {
        "required": domView.text([])
      }, {
        "maxlength": "160"
      }], [], false)], false), audienceSwitch('shared', true)])
    }), domView.element("p", [{
      "data-error": domView.text([])
    }, {
      "role": "alert"
    }], [], false), domView.element("button", [{
      "type": "submit"
    }, {
      "class": "button primary"
    }], [composerText('Start conversation')], false)], false)]));
    initComposers(document.querySelector('.modal'));
    return;
  }
  if (el.hasAttribute('data-close')) {
    close();
    return;
  }
  if (el.dataset.withdraw) {
    modal('Withdraw this request?', domView.fragment([domView.element("p", [], [t('The message stays visible as withdrawn.')], false), domView.element("div", [{
      "class": "modal-footer"
    }], [domView.element("button", [{
      "class": "button"
    }, {
      "data-close": domView.text([])
    }], [t('Cancel')], false), domView.element("button", [{
      "class": "button primary"
    }, {
      "data-withdraw-final": el.dataset.withdraw
    }], [t('Withdraw')], false)], false)]));
    return;
  }
  const id = el.dataset.confirm || el.dataset.withdrawFinal;
  if (!id) return;
  busy = true;
  el.disabled = true;
  try {
    await api('confirmation_decide', {
      conversation: root,
      id,
      decision: el.dataset.confirm ? 'confirmed' : 'withdrawn'
    });
    close();
    await refresh();
    toast(t(el.dataset.confirm ? 'Confirmation recorded.' : 'Request withdrawn.'));
  } catch (error) {
    toast(error.message);
  } finally {
    busy = false;
    el.disabled = false;
  }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (busy) return;
  const form = e.target;
  if (!['guest-reply', 'guest-request'].includes(form.id)) return;
  busy = true;
  const submit = form.querySelector('[type=submit]');
  submit.disabled = true;
  try {
    const result = await api('communication_post', {
      ...Object.fromEntries(new FormData(form)),
      mentions: mentionData(form),
      conversation: root
    });
    if (form.id === 'guest-request') {
      location.assign(safeUrl(domView.concat('/conversations/', encodeURIComponent(result.id)), 'href'));
      return;
    }
    draft = '';
    close();
    await refresh();
    toast(t(form.id === 'guest-request' ? 'Request sent.' : 'Reply posted.'));
  } catch (error) {
    const target = form.querySelector('[data-error]');
    if (target) target.textContent = error.message; else toast(error.message);
  } finally {
    busy = false;
    submit.disabled = false;
  }
});
function showError(error) {
  data = null;
  mountErrorPage($('#app'), error, {
    language: getLanguage(),
    signedIn: true
  });
}
applyStudioTheme({}, true);
try {
  const session = await api('session');
  csrf = session.csrf;
  sessionUser = session.user?.id;
  batchJson = !!session.capabilities?.batch_json;
  await refresh();
} catch (error) {
  showError(error);
}
setInterval(() => {
  if (data && !busy && !document.hidden && !$('.modal') && !document.activeElement?.closest('form')) refresh().catch(showError);
}, 15000);
