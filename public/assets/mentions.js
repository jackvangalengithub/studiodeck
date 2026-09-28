import * as domView from "./render.js";
import {getLanguage} from './i18n.js';
const esc = value => String(value ?? '');
const quote = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pattern = labels => new RegExp(domView.concat(domView.concat('(?<![\\p{L}\\p{N}_@])@(', domView.join(labels.sort((a, b) => b.length - a.length).map(quote), '|')), ')(?![\\p{L}\\p{N}_@+-]|\\.[\\p{L}\\p{N}])'), 'gu');
const t = (en, nl) => getLanguage() === 'nl' ? nl : en;
const selections = new Map();
let contextFor = () => null;
export function mentionData(form) {
  const context = contextFor(form), body = form.elements.body?.value || '';
  if (!context) return [];
  return [...selections.get(JSON.stringify(context))?.values() || []].filter(m => pattern([m.label]).test(body));
}
export function mentionBody(body, mentions = []) {
  if (!mentions.length) return body;
  const byLabel = new Map(mentions.map(m => [m.label, m]));
  let html = '', last = 0;
  for (const match of String(body).matchAll(pattern([...byLabel.keys()]))) {
    const m = byLabel.get(match[1]);
    html = domView.concat(html, domView.concat(body.slice(last, match.index), domView.element("span", [{
      "class": "chat-mention"
    }, {
      "title": m.email
    }], [match[0]], false)));
    last = domView.concat(match.index, match[0].length);
  }
  return domView.concat(html, body.slice(last));
}
export function installMentions({context, load, actor}) {
  contextFor = context;
  let field = null, menu = null, items = [], selected = 0, match = null, request = 0, currentContext = null;
  const close = () => {
    request++;
    menu?.remove();
    menu = null;
    field?.setAttribute('aria-expanded', 'false');
    field?.removeAttribute('aria-activedescendant');
  };
  const position = () => {
    if (!menu) return;
    if (!field?.isConnected) {
      close();
      return;
    }
    const r = field.getBoundingClientRect(), width = Math.min(r.width, 380, innerWidth - 24);
    menu.style.width = domView.concat(width, 'px');
    menu.style.left = domView.concat(Math.max(12, Math.min(r.left, innerWidth - width - 12)), 'px');
    const h = menu.offsetHeight;
    menu.style.top = domView.concat(domView.concat(domView.concat(r.bottom, h), 8) > innerHeight && r.top > domView.concat(h, 8) ? Math.max(8, r.top - h - 4) : Math.min(domView.concat(r.bottom, 4), innerHeight - h - 8), 'px');
  };
  function draw() {
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'mention-picker';
      menu.className = 'mention-picker';
      menu.setAttribute('role', 'listbox');
      menu.setAttribute('aria-label', t('Mention someone', 'Iemand vermelden'));
      (field.closest('.modal') || document.body).append(menu);
    }
    domView.mount(menu, items.length ? domView.join(items.map((p, n) => domView.element("div", [{
      "role": "option"
    }, {
      "id": domView.text(["mention-option-", n])
    }, {
      "data-mention-index": n
    }, {
      "aria-selected": n === selected
    }, {
      "aria-disabled": !!p.disabled
    }], [domView.element("strong", [], [p.name || p.email], false), domView.element("small", [], [p.email], false), p.disabled ? domView.element("small", [], [!p.email ? t('Email address missing — add it in People', 'E-mailadres ontbreekt — voeg het toe bij Personen') : t('Ask the project team to invite this person', 'Vraag het projectteam om deze persoon uit te nodigen')], false) : p.invitable ? domView.element("small", [], [t('Invite to this conversation', 'Uitnodigen voor dit gesprek')], false) : ''], false)), '') : domView.element("div", [{
      "class": "mention-empty"
    }, {
      "role": "status"
    }], [t('No project participants match.', 'Geen betrokken personen gevonden.')], false));
    field.setAttribute('aria-expanded', 'true');
    field.setAttribute('aria-controls', 'mention-picker');
    if (selected >= 0) field.setAttribute('aria-activedescendant', domView.concat('mention-option-', selected)); else field.removeAttribute('aria-activedescendant');
    position();
    menu.querySelector('[aria-selected=true]')?.scrollIntoView({
      block: 'nearest'
    });
  }
  function choose(index) {
    const p = items[index];
    if (!p || p.disabled || !match || !field?.isConnected) return;
    const label = p.label, token = domView.concat(domView.concat('@', label), ' '), start = domView.concat(match.index, match[1].length), end = field.selectionStart;
    if (domView.concat(field.value.length - (end - start), token.length) > field.maxLength && field.maxLength > 0) return;
    const key = JSON.stringify(currentContext);
    if (!selections.has(key)) selections.set(key, new Map());
    selections.get(key).set(p.email, {
      email: p.email,
      label,
      ...p.invitable ? {
        invite: true
      } : {}
    });
    const target = field;
    target.setRangeText(token, start, end, 'end');
    close();
    target.focus();
    target.dispatchEvent(new Event('input', {
      bubbles: true
    }));
  }
  async function update(target) {
    if (!(target instanceof HTMLTextAreaElement) || target.name !== 'body') return;
    const ctx = context(target.form);
    if (!ctx) return;
    field = target;
    currentContext = ctx;
    hint(target);
    const found = (/(^|[\s(\[{])@([^\s@]*)$/).exec(target.value.slice(0, target.selectionStart));
    if (!found || target.selectionStart !== target.selectionEnd) {
      close();
      return;
    }
    match = found;
    const sequence = ++request, query = found[2].toLocaleLowerCase();
    try {
      const people = await load(ctx);
      if (sequence !== request || !target.isConnected || document.activeElement !== target) return;
      items = people.filter(p => (!p.email || p.email !== actor()) && domView.text(["", p.name, " ", p.email, ""]).toLocaleLowerCase().includes(query)).map(p => ({
        ...p,
        disabled: !p.email || p.available === false && !p.invitable,
        label: !p.name || people.filter(q => q.name === p.name).length > 1 ? p.email : p.name
      }));
      selected = items.findIndex(p => !p.disabled);
      draw();
    } catch {
      if (sequence === request) {
        close();
        const hint = target.parentElement.querySelector('.mention-hint');
        if (hint) hint.textContent = t('Could not load people. Type @ again to retry.', 'Personen laden mislukt. Typ opnieuw @ om het te proberen.');
      }
    }
  }
  function hint(target) {
    let el = target.parentElement.querySelector('.mention-hint');
    if (!el) {
      target.setAttribute('aria-autocomplete', 'list');
      el = document.createElement('small');
      el.className = 'form-hint mention-hint';
      el.id = domView.concat('mention-hint-', Math.random().toString(36).slice(2));
      target.after(el);
      target.setAttribute('aria-describedby', domView.join([target.getAttribute('aria-describedby'), el.id].filter(Boolean), ' '));
    }
    const invited = mentionData(target.form).filter(m => m.invite).map(m => m.label);
    el.textContent = invited.length ? t(domView.concat(domView.concat('Sending invites ', domView.join(invited, ', ')), ' to this conversation and its attachments, including earlier messages.'), domView.concat(domView.concat('Met verzenden nodig je ', domView.join(invited, ', ')), ' uit voor dit gesprek en de bijlagen, inclusief eerdere berichten.')) : t('Type @ to mention someone.', 'Typ @ om iemand te vermelden.');
  }
  document.addEventListener('focusin', e => {
    const target = e.target;
    if (target instanceof HTMLTextAreaElement && target.name === 'body' && context(target.form)) {
      hint(target);
    } else close();
  });
  document.addEventListener('input', e => update(e.target));
  document.addEventListener('click', e => {
    if (e.target === field) update(field); else if (!e.target.closest('.mention-picker')) close();
  });
  document.addEventListener('pointerdown', e => {
    const option = e.target.closest('[data-mention-index]');
    if (option) {
      e.preventDefault();
      choose(Number(option.dataset.mentionIndex));
    }
  }, true);
  document.addEventListener('keydown', e => {
    if (!menu || e.target !== field) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') close(); else if (e.key === 'Enter') {
        if (selected >= 0) choose(selected); else close();
      } else if (selected >= 0) {
        do {
          selected = domView.concat(domView.concat(selected, e.key === 'ArrowDown' ? 1 : -1), items.length) % items.length;
        } while (items[selected].disabled);
        draw();
      }
    } else if (e.key === 'Tab') close();
  }, true);
  document.addEventListener('scroll', position, true);
  window.addEventListener('resize', position);
  new MutationObserver(() => {
    if (menu && !field?.isConnected) close();
  }).observe(document.body, {
    childList: true,
    subtree: true
  });
}
