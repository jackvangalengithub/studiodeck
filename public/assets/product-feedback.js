import {safeUrl} from './dom.js';
import * as domView from "./render.js";
import {platformFetch} from './platform/files.js';
import {feedbackText as t, feedbackCategories, feedbackAreas, feedbackStatuses, feedbackPrompts} from './product-feedback-copy.js';
export function productFeedbackUi({state, api, esc, icon, openModal, closeModal, resourceHeaders, demo = false}) {
  let draft = null, identity = '', sending = false, reviewBusy = false, preview = '', inboxData = null, inboxRequest = 0;
  let filters = {
    search: '',
    category: '',
    area: '',
    status: '',
    impact: '',
    theme: '',
    offset: 0
  };
  const currentIdentity = () => domView.text(["", state.user?.id, ":", state.studio?.id, ""]);
  const button = (label, action, primary = false) => domView.element("button", [{
    "type": "button"
  }, {
    "class": domView.text(["button ", primary ? 'primary' : 'ghost'])
  }, {
    "data-pf": action
  }], [t(label)], false);
  const text = key => t(key);
  const select = (name, values, value, all = false) => domView.element("select", [{
    "name": name
  }], [domView.fragment([all ? domView.element("option", [{
    "value": domView.text([])
  }], [text('all')], false) : '', domView.join(values.map(v => domView.element("option", [{
    "value": v
  }, domView.spread(value === v ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [text(v)], false)), '')])], false);
  const field = (name, label, value, max) => domView.element("label", [], [text(label), domView.element("textarea", [{
    "name": name
  }, {
    "rows": name === 'goal' ? 2 : 3
  }, {
    "maxlength": max
  }, {
    "required": domView.text([])
  }], [value], false)], false);
  function screen() {
    if (state.settingsOpen) return 'settings';
    if (state.present) return 'presentation';
    return ({
      overview: 'projects',
      projects: 'projects',
      files: 'files',
      budget: 'budget',
      slides: 'presentation',
      presentation: 'presentation',
      comments: 'communication',
      'all-comments': 'communication',
      checks: 'communication',
      website: 'website',
      profile: 'settings',
      'studio-users': 'settings',
      billing: 'billing'
    })[state.tab] || 'other';
  }
  function reset() {
    if (preview) URL.revokeObjectURL(preview);
    preview = '';
    draft = null;
  }
  function open() {
    if (demo) {
      openModal(t('title'), domView.element("p", [], [text('demo')], false));
      return;
    }
    if (identity !== currentIdentity()) {
      reset();
      identity = currentIdentity();
    }
    if (!draft) draft = {
      step: 1,
      category: '',
      area: screen(),
      screen: screen(),
      goal: '',
      detail: '',
      impact: '',
      frequency: '',
      contact_allowed: false,
      screenshot: null,
      request_key: crypto.randomUUID()
    };
    show();
  }
  function mount(title, content, wide = false) {
    openModal(title, content, wide);
    const modal = document.querySelector('.modal');
    modal.classList.add(wide ? 'pf-inbox-dialog' : 'pf-dialog');
    return modal;
  }
  function progress() {
    return domView.element("div", [{
      "class": "pf-progress"
    }, {
      "aria-label": t('step', {
        step: draft.step
      })
    }], [domView.element("span", [{
      "aria-hidden": "true"
    }], [domView.join([1, 2, 3].map(n => domView.element("i", [{
      "class": n <= draft.step ? 'filled' : ''
    }], [], false)), '')], false), domView.element("small", [], [t('step', {
      step: draft.step
    })], false)], false);
  }
  function heading(title, intro = '') {
    return domView.fragment([domView.element("h3", [{
      "class": "pf-heading"
    }, {
      "tabindex": "-1"
    }], [text(title)], false), intro ? domView.element("p", [{
      "class": "pf-intro"
    }], [text(intro)], false) : '']);
  }
  function radio(name, value, label, hint = '') {
    return domView.element("label", [{
      "class": domView.text(["pf-choice ", name === 'category' ? 'pf-category' : ''])
    }], [domView.element("input", [{
      "type": "radio"
    }, {
      "name": name
    }, {
      "value": value
    }, domView.spread(draft[name] === value ? domView.attributes([{
      "checked": domView.text([])
    }]) : ''), {
      "required": domView.text([])
    }], [], false), domView.element("span", [], [domView.element("strong", [], [text(label)], false), hint ? domView.element("small", [], [text(hint)], false) : ''], false)], false);
  }
  function show() {
    let body = '';
    if (draft.step === 1) body = domView.fragment([heading('introTitle', 'intro'), domView.element("fieldset", [{
      "class": "pf-choices"
    }], [domView.element("legend", [], [text('choose')], false), domView.join(feedbackCategories.map(c => radio('category', c, c, c === 'other' ? '' : domView.concat(c, 'Hint'))), '')], false)]);
    if (draft.step === 2) {
      const [goal, detail] = feedbackPrompts(draft.category);
      body = domView.fragment([heading(domView.concat(draft.category, 'Title'), domView.concat(draft.category, 'Intro')), domView.element("label", [{
        "class": "pf-area"
      }], [domView.fragment([text('about'), select('area', feedbackAreas, draft.area)])], false), domView.fragment([field('goal', goal, draft.goal, 500), field('detail', detail, draft.detail, 1500)]), domView.element("p", [{
        "class": "pf-hint"
      }], [text('example')], false), domView.element("label", [{
        "class": "pf-upload"
      }], [text('screenshot'), domView.element("input", [{
        "type": "file"
      }, {
        "accept": "image/png,image/jpeg,image/webp"
      }, {
        "data-pf-file": domView.text([])
      }, {
        "aria-describedby": "pf-screenshot-hint"
      }], [], false)], false), domView.element("p", [{
        "class": "pf-hint"
      }, {
        "id": "pf-screenshot-hint"
      }], [text('screenshotHint')], false), domView.element("div", [{
        "data-pf-preview": domView.text([])
      }], [previewMarkup()], false)]);
    }
    if (draft.step === 3) body = domView.fragment([domView.fragment([heading(draft.category === 'positive' ? 'positiveFrequency' : 'impactTitle', draft.category === 'positive' ? 'positiveIntro' : 'impactIntro'), draft.category !== 'positive' ? domView.element("fieldset", [{
      "class": "pf-choices"
    }], [domView.element("legend", [{
      "class": "sr-only"
    }], [text('impactTitle')], false), domView.join(['minor', 'slows', 'blocked'].map(v => radio('impact', v, v)), '')], false) : '']), domView.element("fieldset", [{
      "class": "pf-choices pf-frequency"
    }], [domView.element("legend", [domView.spread(draft.category === 'positive' ? domView.attributes([{
      "class": "sr-only"
    }]) : '')], [text(draft.category === 'positive' ? 'positiveFrequency' : 'frequency')], false), domView.element("div", [], [domView.join(['first', 'sometimes', 'often'].map(v => radio('frequency', v, v)), '')], false)], false), domView.element("div", [{
      "class": "pf-contact"
    }], [domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "contact_allowed"
    }, domView.spread(draft.contact_allowed ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), text('contact')], false), domView.element("p", [{
      "class": "pf-hint"
    }], [text('contactHint')], false)], false), domView.element("p", [{
      "class": "pf-hint"
    }], [text('separate')], false), domView.element("p", [{
      "class": "pf-hint"
    }], [text('context')], false), domView.element("details", [{
      "class": "pf-context"
    }], [domView.element("summary", [], [text('contextDetails')], false), domView.element("dl", [], [domView.element("dt", [], [text('account')], false), domView.element("dd", [], [domView.fragment([state.user?.name, " (", state.user?.email, ")"])], false), domView.element("dt", [], [text('studio')], false), domView.element("dd", [], [state.studio?.name], false), domView.element("dt", [], [text('screen')], false), domView.element("dd", [], [text(draft.screen)], false), domView.element("dt", [], [text('version')], false), domView.element("dd", [], [state.capabilities?.app_version === 'unversioned' ? t('unversioned') : state.capabilities?.app_version || t('unversioned')], false)], false), domView.element("p", [], [text('privacy')], false)], false)]);
    const modal = mount(t('title'), domView.element("div", [{
      "class": "pf"
    }], [progress(), domView.element("form", [{
      "data-pf-form": domView.text([])
    }], [body, domView.element("p", [{
      "class": "pf-error"
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false), domView.element("div", [{
      "class": "pf-footer"
    }], [draft.step > 1 ? button('back', 'back') : domView.element("small", [], [text('minute')], false), domView.element("button", [{
      "type": "submit"
    }, {
      "class": "button primary"
    }], [text(draft.step === 3 ? 'send' : 'next')], false)], false)], false)], false));
    const form = modal.querySelector('form');
    if (draft.step === 2 && draft.screenshot) {
      const files = new DataTransfer();
      files.items.add(draft.screenshot);
      form.querySelector('[data-pf-file]').files = files.files;
    }
    form.addEventListener('input', remember);
    form.addEventListener('change', remember);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopPropagation();
      if (sending) return;
      remember();
      if (draft.step === 2 && (!draft.goal.trim() || !draft.detail.trim())) {
        error(t('required'));
        return;
      }
      if (draft.step < 3) {
        draft.step++;
        show();
        return;
      }
      await send(form);
    });
    modal.querySelector('[data-pf="back"]')?.addEventListener('click', () => {
      remember();
      draft.step--;
      show();
    });
    modal.querySelector('[data-pf-file]')?.addEventListener('change', event => {
      const file = event.target.files[0];
      if (!file) return;
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        event.target.value = '';
        error(t('screenshotError'));
        return;
      }
      if (preview) URL.revokeObjectURL(preview);
      draft.screenshot = file;
      preview = URL.createObjectURL(file);
      domView.mount(modal.querySelector('[data-pf-preview]'), previewMarkup());
      bindRemove(modal);
      error('');
    });
    bindRemove(modal);
    setTimeout(() => {
      if (modal.isConnected) modal.querySelector('.pf-heading')?.focus();
    }, 30);
  }
  function remember() {
    const form = document.querySelector('[data-pf-form]');
    if (!form || !draft) return;
    const values = new FormData(form);
    for (const name of ['category', 'area', 'goal', 'detail', 'impact', 'frequency']) if (values.has(name)) draft[name] = values.get(name);
    if (form.elements.contact_allowed) draft.contact_allowed = form.elements.contact_allowed.checked;
    if (draft.category === 'positive') draft.impact = '';
  }
  function previewMarkup() {
    return preview ? domView.element("div", [{
      "class": "pf-attachment"
    }], [domView.element("img", [{
      "src": preview
    }, {
      "alt": text('screenshotAlt')
    }], [], false), domView.element("span", [], [draft.screenshot.name], false), button('remove', 'remove')], false) : '';
  }
  function bindRemove(modal) {
    modal.querySelector('[data-pf="remove"]')?.addEventListener('click', () => {
      URL.revokeObjectURL(preview);
      preview = '';
      draft.screenshot = null;
      modal.querySelector('[data-pf-file]').value = '';
      domView.mount(modal.querySelector('[data-pf-preview]'), '');
    });
  }
  function error(message) {
    const el = document.querySelector('.pf-error');
    if (el) {
      el.textContent = message;
      el.hidden = !message;
    }
  }
  async function send(form) {
    sending = true;
    error('');
    form.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
    const submit = form.querySelector('[type="submit"]');
    submit.textContent = t('sending');
    try {
      const {step, screenshot, ...payload} = draft, body = new FormData();
      body.set('feedback', JSON.stringify(payload));
      if (screenshot) body.set('screenshot', screenshot);
      await api('product_feedback_submit', body);
      reset();
      const modal = mount(t('title'), domView.element("div", [{
        "class": "pf pf-thanks"
      }], [domView.element("span", [{
        "class": "pf-thanks-mark"
      }, {
        "aria-hidden": "true"
      }], [icon('check')], false), heading('thanksTitle', 'thanks'), domView.element("p", [{
        "class": "pf-hint"
      }], [text('promise')], false), domView.element("div", [{
        "class": "pf-footer"
      }], [button('done', 'done', true)], false)], false));
      modal.querySelector('[data-pf="done"]').addEventListener('click', () => closeModal());
    } catch (e) {
      error(domView.concat(t('failed'), e.status && e.status < 500 ? domView.concat(' ', e.message) : ''));
    } finally {
      sending = false;
      form.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = false);
      submit.textContent = t('send');
    }
  }
  function navigation() {
    if (demo) return '';
    return domView.fragment([domView.element("button", [{
      "class": "side-link pf-nav"
    }, {
      "data-action": "product-feedback"
    }, {
      "title": text('title')
    }, {
      "aria-label": text('title')
    }], [icon('heart'), domView.element("span", [{
      "class": "side-link-label"
    }], [text('title')], false)], false), state.user?.feedback_reviewer ? domView.element("button", [{
      "class": "side-link pf-nav"
    }, {
      "data-action": "product-feedback-inbox"
    }, {
      "title": text('inbox')
    }, {
      "aria-label": text('inbox')
    }], [icon('mail'), domView.element("span", [{
      "class": "side-link-label"
    }], [text('inbox')], false)], false) : '']);
  }
  async function inbox() {
    const request = ++inboxRequest;
    const modal = mount(t('inbox'), domView.element("div", [{
      "class": "pf"
    }, {
      "data-pf-inbox": domView.text([])
    }], [domView.element("p", [{
      "role": "status"
    }], [text('loading')], false)], false), true);
    try {
      const result = await api('product_feedback_inbox', filters);
      if (request !== inboxRequest || !modal.isConnected) return;
      inboxData = result;
      renderInbox();
    } catch (e) {
      if (request !== inboxRequest || !modal.isConnected) return;
      domView.mount(modal.querySelector('[data-pf-inbox]'), domView.fragment([domView.element("p", [{
        "role": "alert"
      }], [text('loadFailed')], false), button('retry', 'retry')]));
      modal.querySelector('[data-pf="retry"]').onclick = inbox;
    }
  }
  function renderInbox() {
    const d = inboxData;
    const modal = mount(t('inbox'), domView.element("div", [{
      "class": "pf"
    }, {
      "data-pf-inbox": domView.text([])
    }], [domView.element("p", [{
      "class": "pf-intro"
    }], [text('inboxIntro')], false), domView.element("form", [{
      "class": "pf-filters"
    }], [domView.element("label", [{
      "class": "pf-search"
    }], [text('search'), domView.element("input", [{
      "type": "search"
    }, {
      "name": "search"
    }, {
      "value": filters.search
    }, {
      "maxlength": "200"
    }], [], false)], false), domView.join(['category', 'area', 'status', 'impact'].map((name, n) => domView.element("label", [], [domView.fragment([text(name), select(name, [feedbackCategories, feedbackAreas, feedbackStatuses, ['minor', 'slows', 'blocked']][n], filters[name], true)])], false)), ''), domView.element("label", [], [text('theme'), domView.element("select", [{
      "name": "theme"
    }], [domView.element("option", [{
      "value": domView.text([])
    }], [text('all')], false), domView.join(d.themes.map(theme => domView.element("option", [domView.spread(filters.theme === theme.theme ? domView.attributes([{
      "selected": domView.text([])
    }]) : ''), {
      "value": theme.theme
    }], [theme.theme], false)), '')], false)], false), domView.element("button", [{
      "class": "button"
    }, {
      "type": "submit"
    }], [text('filter')], false)], false), domView.element("p", [{
      "class": "pf-counts"
    }], [t('counts', d.counts)], false), d.themes.length ? domView.element("details", [{
      "class": "pf-themes"
    }], [domView.element("summary", [], [text('themes')], false), domView.join(d.themes.map(theme => domView.element("button", [{
      "type": "button"
    }, {
      "data-pf-theme": theme.theme
    }], [domView.element("strong", [], [theme.theme], false), domView.element("small", [], [t('counts', theme)], false)], false)), '')], false) : '', domView.element("div", [{
      "class": "pf-reports"
    }], [domView.join(d.items.map(item => domView.element("button", [{
      "type": "button"
    }, {
      "class": "pf-report"
    }, {
      "data-pf-report": item.id
    }], [domView.element("span", [{
      "class": "row wrap"
    }], [domView.element("span", [{
      "class": "tag"
    }], [text(item.category)], false), domView.element("span", [{
      "class": "tag outline"
    }], [text(item.area)], false), domView.element("span", [{
      "class": "tag outline"
    }], [text(item.status)], false), item.impact === 'blocked' ? domView.element("span", [{
      "class": "tag pf-blocked"
    }], [text('blocked')], false) : ''], false), domView.element("strong", [], [item.goal], false), domView.element("span", [{
      "class": "pf-report-detail"
    }], [item.detail], false), domView.element("small", [], [domView.fragment([item.studio_name || '—', " · ", item.created_at.slice(0, 10), " · ", item.theme || t('unthemed')])], false)], false)), '') || domView.element("p", [], [text('empty')], false)], false), domView.element("div", [{
      "class": "pf-footer"
    }], [domView.fragment([filters.offset ? button('previous', 'previous') : domView.element("span", [], [], false), d.has_more ? button('nextPage', 'nextPage') : ''])], false)], false), true);
    modal.querySelector('form').onsubmit = event => {
      event.preventDefault();
      event.stopPropagation();
      filters = {
        ...filters,
        ...Object.fromEntries(new FormData(event.target)),
        offset: 0
      };
      inbox();
    };
    modal.querySelectorAll('[data-pf-report]').forEach(el => el.onclick = () => review(d.items.find(item => item.id === el.dataset.pfReport)));
    modal.querySelectorAll('[data-pf-theme]').forEach(el => el.onclick = () => {
      filters.theme = el.dataset.pfTheme;
      filters.offset = 0;
      inbox();
    });
    modal.querySelector('[data-pf="previous"]')?.addEventListener('click', () => {
      filters.offset = Math.max(0, filters.offset - 50);
      inbox();
    });
    modal.querySelector('[data-pf="nextPage"]')?.addEventListener('click', () => {
      filters.offset += 50;
      inbox();
    });
  }
  function review(item) {
    const [goal, detail] = feedbackPrompts(item.category);
    const modal = mount(t('inbox'), domView.element("div", [{
      "class": "pf"
    }], [button('backInbox', 'backInbox'), domView.element("div", [{
      "class": "row wrap pf-review-tags"
    }], [domView.element("span", [{
      "class": "tag"
    }], [text(item.category)], false), domView.element("span", [{
      "class": "tag"
    }], [text(item.area)], false), domView.element("span", [{
      "class": "tag"
    }], [text(item.frequency)], false), item.impact ? domView.element("span", [{
      "class": "tag"
    }], [text(item.impact)], false) : ''], false), domView.element("dl", [{
      "class": "pf-report-body"
    }], [domView.element("dt", [], [text(goal)], false), domView.element("dd", [], [item.goal], false), domView.element("dt", [], [text(detail)], false), domView.element("dd", [], [item.detail], false), domView.element("dt", [], [text('account')], false), domView.element("dd", [], [domView.fragment([item.user_name || '—', " · ", item.studio_name || '—'])], false), domView.element("dt", [], [text('screen')], false), domView.element("dd", [], [domView.fragment([text(item.screen), " · ", item.app_version])], false)], false), domView.element("p", [{
      "class": "pf-hint"
    }], [domView.fragment([text(item.contact_allowed ? 'followup' : 'noFollowup'), item.contact_email ? domView.fragment([" · ", domView.element("a", [{
      "href": domView.text(["mailto:", item.contact_email])
    }], [item.contact_email], false)]) : ''])], false), item.has_screenshot ? domView.element("div", [{
      "data-pf-image": domView.text([])
    }], [button('viewScreenshot', 'image')], false) : '', domView.element("form", [{
      "data-pf-review": domView.text([])
    }], [domView.element("label", [], [domView.fragment([text('status'), select('status', feedbackStatuses, item.status)])], false), domView.element("label", [], [text('theme'), domView.element("input", [{
      "name": "theme"
    }, {
      "value": item.theme
    }, {
      "maxlength": "120"
    }, {
      "list": "pf-theme-list"
    }], [], false), domView.element("datalist", [{
      "id": "pf-theme-list"
    }], [domView.join(inboxData.themes.map(theme => domView.element("option", [{
      "value": theme.theme
    }], [], false)), '')], false)], false), domView.element("p", [{
      "class": "pf-hint"
    }], [text('themeHint')], false), domView.element("label", [], [text('notes'), domView.element("textarea", [{
      "name": "notes"
    }, {
      "rows": "3"
    }, {
      "maxlength": "1500"
    }], [item.notes], false)], false), domView.element("p", [{
      "class": "pf-hint"
    }], [text('reviewHint')], false), domView.element("p", [{
      "class": "pf-error"
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false), domView.element("p", [{
      "data-pf-saved": domView.text([])
    }, {
      "role": "status"
    }], [], false), domView.element("div", [{
      "class": "pf-footer"
    }], [domView.element("button", [{
      "class": "button primary"
    }, {
      "type": "submit"
    }], [text('save')], false)], false)], false)], false), true);
    modal.querySelector('[data-pf="backInbox"]').onclick = inbox;
    modal.querySelector('[data-pf="image"]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const response = await platformFetch(new URLSearchParams({
          action: 'product_feedback_image',
          id: item.id
        }), {
          credentials: 'same-origin',
          headers: resourceHeaders()
        });
        if (!response.ok) throw Error();
        const blob = await response.blob();
        if (!modal.isConnected) return;
        const url = URL.createObjectURL(blob), image = new Image();
        image.alt = t('screenshotAlt');
        image.className = 'pf-full-screenshot';
        image.onload = image.onerror = () => URL.revokeObjectURL(url);
        image.src = safeUrl(url, 'src');
        modal.querySelector('[data-pf-image]').replaceChildren(image);
      } catch {
        if (modal.isConnected) {
          error(t('screenshotUnavailable'));
          button.disabled = false;
        }
      }
    });
    const form = modal.querySelector('form');
    form.onsubmit = async event => {
      event.preventDefault();
      event.stopPropagation();
      if (reviewBusy) return;
      const payload = {
        ...Object.fromEntries(new FormData(form)),
        id: item.id,
        updated_at: item.updated_at
      };
      reviewBusy = true;
      error('');
      modal.querySelector('[data-pf-saved]').textContent = '';
      modal.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
      const submit = form.querySelector('[type="submit"]');
      submit.textContent = t('saving');
      try {
        const result = await api('product_feedback_review', payload);
        Object.assign(item, payload, {
          updated_at: result.updated_at
        });
        modal.querySelector('[data-pf-saved]').textContent = t('saved');
      } catch (e) {
        error(e.message);
      } finally {
        reviewBusy = false;
        modal.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = false);
        submit.textContent = t('save');
      }
    };
  }
  return {
    open,
    inbox,
    navigation,
    busy: () => sending || reviewBusy
  };
}
