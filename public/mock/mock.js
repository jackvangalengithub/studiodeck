import {safeUrl} from '../assets/dom.js';
import * as domView from "../assets/render.js";
import {syncMockAdditions} from './assets/demo.js';
export function createMockFeatures({state, render, openModal, closeModal, toast, button, icon, esc, personAvatar, api, refresh, slideDefs, startPresentation}) {
  const storageKey = 'studiodeck-communication-mock-v4';
  const people = {
    studio: {
      name: 'Sophie van Dijk',
      role: 'Designer',
      budget: true
    },
    client: {
      name: 'Emma de Vries',
      role: 'Client',
      budget: true
    },
    trade: {
      name: 'Thomas Bakker',
      role: 'Bakker Joinery',
      budget: false
    }
  };
  const seed = () => ({
    role: 'studio',
    messages: [],
    uploads: [],
    legacy: [],
    topics: [],
    completed: {},
    requests: [{
      id: 'paint',
      thread: 'paint',
      text: 'Please confirm the more durable, washable paint for the hallway. It will cost €1,000 extra.',
      from: 'studio',
      to: 'client',
      amount: 100000,
      status: 'pending',
      created: '2026-09-19T09:30:00Z',
      project: 'van-galen',
      iteration: 'it-2',
      attachment: null
    }, {
      id: 'installation',
      thread: 'kitchen',
      text: 'Can you confirm that removing the old cabinets is included in the installation?',
      from: 'client',
      to: 'studio',
      amount: null,
      status: 'pending',
      created: '2026-09-19T09:45:00Z',
      project: 'van-galen',
      iteration: 'it-2',
      attachment: null
    }, {
      id: 'colour',
      thread: 'paint',
      text: 'Please confirm RAL 9010 with a matt finish for the hallway walls.',
      from: 'studio',
      to: 'client',
      amount: null,
      status: 'confirmed',
      created: '2026-09-18T13:00:00Z',
      confirmedAt: '2026-09-18T14:32:00Z',
      project: 'van-galen',
      iteration: 'it-2',
      attachment: null
    }]
  });
  let demo = seed();
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey));
    if (stored && Array.isArray(stored.requests) && Array.isArray(stored.uploads)) demo = {
      ...demo,
      ...stored
    };
  } catch {}
  delete demo.events;
  if (!people[demo.role]) demo.role = 'studio';
  let thread = demo.ui?.thread || 'kitchen', view = demo.ui?.view || 'all', pendingOnly = demo.ui?.pendingOnly || false, who = demo.ui?.who || 'everyone', drafts = {}, replyTo = null, requestDraft = null, highlight = null;
  const $ = selector => document.querySelector(selector);
  const btn = (label, action, kind = '', extra = '', ico = '') => button(label, domView.concat('mock-', action), kind, extra, ico);
  const uid = () => crypto.randomUUID();
  const save = () => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(demo));
      return true;
    } catch {
      toast('This browser’s demo storage is full. Your changes remain available until you reload.');
      return false;
    }
  };
  const money = cents => new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: cents % 100 ? 2 : 0
  }).format(Math.abs(cents) / 100);
  const signed = cents => domView.concat(cents > 0 ? '+ ' : cents < 0 ? '− ' : '', money(cents));
  const time = value => new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
  const avatar = role => personAvatar({}, people[role]?.name || role);
  const currentProject = () => state.data?.project.id || 'van-galen';
  const projectRequests = () => demo.requests.filter(r => r.project === currentProject());
  const allowedThread = id => !(id === 'internal' || demo.topics.find(t => t.id === id)?.private) || demo.role === 'studio';
  const visibleRequests = () => projectRequests().filter(r => allowedThread(r.thread));
  const pendingCount = () => visibleRequests().filter(r => r.status === 'pending').length;
  const uploadFiles = () => demo.uploads.map(f => ({
    id: f.id,
    asset_id: f.id,
    iteration_id: f.iteration,
    project_id: f.project,
    name: f.name,
    number: 1,
    mime: f.mime,
    size: f.size,
    url: f.data,
    preview_url: f.mime.startsWith('image/') ? f.data : null,
    has_preview: f.mime.startsWith('image/'),
    category: 'other',
    metadata: {
      summary: 'Attached in Communication (local demo)'
    },
    history: [{
      id: f.id,
      name: f.name,
      number: 1,
      url: f.data
    }]
  }));
  const budgetRows = () => demo.requests.filter(r => r.status === 'confirmed' && r.amount !== null).map(r => ({
    id: domView.concat('confirmation-', r.id),
    iteration_id: r.iteration,
    mock_confirmation_id: r.id,
    label: r.text.replace(/^please confirm\s+(the\s+)?/i, '').slice(0, 140),
    vendor: 'Confirmed project change',
    amount_cents: r.amount,
    kind: 'quote',
    parent_id: null,
    included: 0,
    source_version_id: null,
    note: domView.text(["Confirmed by ", people[r.to].name, " on ", time(r.confirmedAt), ". Linked to the original message in Communication."])
  }));
  function beforeRequest(action, body) {
    syncMockAdditions(budgetRows(), uploadFiles(), demo.legacy);
    if (action === 'comment') body._mock_author = people[demo.role].name;
  }
  function enrich(result, action) {
    if (['project', 'deck'].includes(action)) {
      result.slides ??= [];
      result.slide_content ??= [];
      result.open_questions ??= [];
      result.members = [{
        id: 'sophie',
        name: people.studio.name,
        email: 'sophie@example.test',
        role: 'Project designer',
        profile: {
          name: people.studio.name
        }
      }];
      for (const comment of result.comments || []) {
        const id = domView.concat(domView.concat(result.project.id, ':'), comment.id);
        const existing = demo.legacy.find(c => c.key === id);
        const copy = {
          ...comment,
          key: id,
          project: result.project.id,
          iteration: comment.iteration_id || result.iteration.id
        };
        if (existing) Object.assign(existing, copy); else demo.legacy.push(copy);
      }
      save();
    }
    return result;
  }
  const tabs = ['overview', 'slides', 'files', 'budget', 'people', 'comments', 'projects'];
  function readTab() {
    const hash = location.hash.slice(1);
    return ['approvals', 'documents', 'communication'].includes(hash) ? 'comments' : tabs.includes(hash) ? hash : 'comments';
  }
  function syncUrl(replace = false) {
    const path = domView.concat('/mock#', state.present ? 'presentation' : state.tab);
    if (domView.concat(location.pathname, location.hash) !== path) history[replace ? 'replaceState' : 'pushState'](null, '', path);
  }
  function restoreRoute() {
    state.present = false;
    state.client = false;
    state.tab = readTab();
    render();
  }
  function go(tab) {
    closeModal();
    state.present = false;
    state.client = false;
    state.tab = tab;
    render();
    window.scrollTo({
      top: 0,
      behavior: 'instant'
    });
  }
  function toolbar() {
    return domView.element("div", [{
      "class": "mock-toolbar"
    }], [domView.element("span", [{
      "class": "mock-demo-label"
    }], ["Communication prototype"], false), domView.element("div", [{
      "class": "row"
    }], [domView.element("label", [{
      "class": "mock-perspective"
    }], ["View as", domView.element("select", [{
      "id": "mock-role"
    }, {
      "aria-label": "Demo perspective"
    }], [domView.join(Object.entries(people).map(([r, p]) => domView.element("option", [{
      "value": r
    }, domView.spread(demo.role === r ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [domView.fragment([p.name.split(' ')[0], " · ", p.role])], false)), '')], false)], false), btn('Reset', 'reset', 'small ghost', '', 'history')], false)], false);
  }
  function overviewPanel() {
    return domView.element("div", [{
      "class": "mock-overview-note"
    }], [domView.element("div", [], [icon('chat'), domView.element("span", [], [domView.element("strong", [], ["Keep the conversation together"], false), domView.element("small", [], [domView.fragment([pendingCount(), " confirmations waiting · Comments and replies in one place"])], false)], false)], false), btn('Communication', 'communication', 'small', '', 'arrow')], false);
  }
  const typeNames = {
    conversation: 'Conversation',
    todo: 'To do',
    approval: 'Approval'
  };
  function topics() {
    const base = [{
      id: 'kitchen',
      type: 'conversation',
      title: 'Kitchen installation',
      body: 'Let’s agree on the installation sequence before we book the team. Can the cabinets go in before the stone is delivered?',
      person: 'trade',
      detail: 'Shared with client'
    }, {
      id: 'internal',
      type: 'todo',
      title: 'Review the material samples',
      body: 'Compare the oak and limestone samples in daylight, then choose the combination for the kitchen.',
      person: 'studio',
      private: true,
      detail: 'Due Fri, 25 Sep'
    }, {
      id: 'paint',
      type: 'approval',
      title: 'Washable paint for the hallway',
      body: 'Use the more durable, washable finish for the hallway walls. The colour stays RAL 9010, as agreed.',
      person: 'client',
      detail: '+ €1,000',
      amount: 100000
    }];
    const roots = demo.legacy.filter(c => c.project === currentProject() && !c.parent_id);
    return [...base, ...demo.topics.filter(t => t.project === currentProject()), ...roots.map(c => ({
      id: domView.concat('comment-', c.id),
      type: 'conversation',
      title: c.slide_title || 'Design feedback',
      body: c.body,
      person: legacyRole(c.author),
      detail: 'Shared with client',
      source: c
    }))].filter(t => allowedThread(t.id));
  }
  const isDone = topic => !!demo.completed[domView.concat(domView.concat(currentProject(), ':'), topic.id)];
  function topicFor(id) {
    return topics().find(t => t.id === id) || topics()[0];
  }
  function legacyRole(author) {
    return (/emma|family/i).test(author) ? 'client' : (/thomas/i).test(author) ? 'trade' : 'studio';
  }
  function entries(id) {
    const seeded = id === 'paint' ? [{
      id: 'paint-intro',
      role: 'client',
      text: 'The hallway gets a lot of use. Could we choose something that is easier to clean?',
      created: '2026-09-19T08:10:00Z'
    }, {
      id: 'paint-answer',
      role: 'studio',
      text: 'Yes. We can keep the colour we agreed and choose a more durable, washable paint.',
      created: '2026-09-19T08:30:00Z'
    }] : id === 'kitchen' ? [{
      id: 'kitchen-intro',
      role: 'trade',
      text: 'We’re checking the installation details before ordering. Happy to clarify anything here.',
      created: '2026-09-19T08:15:00Z'
    }] : id === 'internal' ? [{
      id: 'internal-intro',
      role: 'studio',
      text: 'Let’s review the oak and limestone samples together on Friday.',
      created: '2026-09-19T08:00:00Z'
    }] : [];
    if (id.startsWith('comment-')) {
      const root = id.slice(8);
      for (const c of demo.legacy.filter(c => c.project === currentProject() && (c.id === root || c.parent_id === root))) seeded.push({
        id: domView.concat('legacy-', c.id),
        role: legacyRole(c.author),
        author: c.profile?.name || c.author,
        text: c.body,
        created: c.created_at,
        legacy: true
      });
    }
    return [...seeded, ...demo.messages.filter(m => m.project === currentProject() && m.thread === id), ...projectRequests().filter(r => r.thread === id).map(r => ({
      ...r,
      confirmation: true
    }))].sort((a, b) => new Date(a.created) - new Date(b.created));
  }
  function fileSnapshot(file) {
    return {
      id: file.id,
      name: file.name,
      number: file.number || 1,
      mime: file.mime,
      url: demo.uploads.some(u => u.id === file.id) ? null : file.url,
      uploadId: demo.uploads.some(u => u.id === file.id) ? file.id : null
    };
  }
  const attachmentUrl = a => a?.uploadId ? demo.uploads.find(f => f.id === a.uploadId)?.data : a?.url;
  function attachmentHtml(attachment, owner) {
    if (!attachment) return '';
    const upload = demo.uploads.find(u => u.id === attachment.uploadId);
    const processing = upload && Date.now() < upload.readyAt;
    return domView.element("button", [{
      "class": "mock-attachment"
    }, {
      "data-action": "mock-file"
    }, {
      "data-owner": owner
    }], [icon('file'), domView.element("span", [], [domView.fragment([attachment.name, " "]), domView.element("small", [], [domView.fragment(["V", attachment.number, processing ? ' · Preparing preview…' : ''])], false)], false), icon('eye')], false);
  }
  function confirmationCard(r, compact = false) {
    const confirmed = r.status === 'confirmed', withdrawn = r.status === 'withdrawn', mine = r.to === demo.role;
    return domView.element("article", [{
      "class": domView.text(["mock-confirmation ", confirmed ? 'is-confirmed' : '', " ", withdrawn ? 'is-withdrawn' : '', " ", highlight === r.id ? 'is-highlighted' : ''])
    }, {
      "data-confirmation": r.id
    }], [domView.element("div", [{
      "class": "mock-confirmation-top"
    }], [domView.element("span", [{
      "class": domView.text(["mock-status ", confirmed ? 'done' : withdrawn ? 'closed' : 'pending'])
    }], [domView.fragment([icon(confirmed ? 'check' : withdrawn ? 'close' : 'clock'), confirmed ? 'Confirmed' : withdrawn ? 'Withdrawn' : 'Pending confirmation'])], false), domView.element("small", [], [domView.fragment([people[r.from].name.split(' ')[0], " → ", people[r.to].name, compact ? domView.concat(' · ', topicFor(r.thread).title) : ''])], false)], false), domView.element("p", [], [r.text], false), domView.fragment([attachmentHtml(r.attachment, r.id), r.amount !== null ? domView.element("div", [{
      "class": "mock-budget-change"
    }], [icon('budget'), domView.element("span", [], ["Budget change ", domView.element("strong", [], [signed(r.amount)], false), " ", domView.element("small", [], ["including VAT"], false)], false)], false) : '']), domView.element("div", [{
      "class": "mock-confirmation-bottom"
    }], [domView.fragment([confirmed ? domView.fragment([domView.element("span", [{
      "class": "mock-confirmed-by"
    }], [domView.fragment([icon('check'), " ", people[r.to].name, " confirmed · ", time(r.confirmedAt)])], false), r.amount !== null ? btn('Added to budget', 'budget-link', 'small ghost', domView.attributes([{
      "data-id": r.id
    }]), 'arrow') : '']) : withdrawn ? domView.element("small", [{
      "class": "muted"
    }], [domView.fragment(["Withdrawn by ", people[r.from].name, " · ", time(r.withdrawnAt)])], false) : domView.text(["", mine ? btn(r.amount !== null ? domView.concat('Confirm change · ', signed(r.amount)) : 'Confirm', 'confirm', 'primary small', domView.attributes([{
      "data-id": r.id
    }]), 'check') : domView.element("small", [{
      "class": "muted"
    }], [domView.fragment(["Waiting for ", people[r.to].name.split(' ')[0]])], false), "", btn('Reply', 'reply-to', 'small ghost', domView.attributes([{
      "data-id": r.id
    }]), 'chat'), "", r.from === demo.role ? btn('Withdraw', 'withdraw', 'small ghost', domView.attributes([{
      "data-id": r.id
    }])) : '', ""]), compact ? btn('Open conversation', 'open-request', 'small ghost', domView.attributes([{
      "data-id": r.id
    }]), 'arrow') : ''])], false)], false);
  }
  function messageCard(m) {
    const role = people[m.role || m.from] ? m.role || m.from : 'studio', author = m.legacy && m.author && !m.author.includes('@') ? m.author : people[role].name;
    return domView.element("article", [{
      "class": "mock-message"
    }, {
      "data-message": m.id
    }], [domView.element("div", [{
      "class": "comment-author"
    }], [avatar(role), domView.element("div", [], [domView.element("strong", [], [author], false), domView.element("time", [{
      "datetime": m.created
    }], [time(m.created)], false)], false)], false), domView.element("div", [{
      "class": "mock-message-body"
    }], [domView.element("p", [], [m.text], false), attachmentHtml(m.attachment, m.id)], false)], false);
  }
  function threadSummary(topic) {
    const done = isDone(topic), label = done ? 'Mark as open' : 'Mark as done', person = people[topic.person || 'studio'];
    const personLabel = ({
      conversation: 'Waiting for',
      todo: 'Responsible',
      approval: 'Confirm with'
    })[topic.type];
    return domView.element("header", [{
      "class": "mock-thread-summary"
    }, {
      "data-thread-type": topic.type
    }, {
      "data-done": done
    }], ["\n      ", domView.element("div", [{
      "class": "mock-summary-main"
    }], [domView.element("div", [{
      "class": "mock-summary-copy"
    }], [domView.element("div", [{
      "class": "mock-summary-eyebrow"
    }], [domView.element("span", [], [typeNames[topic.type]], false), domView.element("span", [{
      "class": "mock-summary-state"
    }], [domView.fragment([done ? 'Done' : 'Open', topic.private ? ' · Internal' : ''])], false)], false), domView.element("h2", [], [topic.title], false), domView.element("p", [], [topic.body], false)], false), "\n      ", domView.element("span", [{
      "class": "mock-complete-wrap"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "class": "mock-complete"
    }, {
      "role": "checkbox"
    }, {
      "aria-checked": done
    }, {
      "aria-label": label
    }, {
      "aria-describedby": "mock-complete-tooltip"
    }, {
      "data-action": "mock-complete"
    }, {
      "data-thread": topic.id
    }], [domView.element("svg", [{
      "viewBox": "0 0 32 32"
    }, {
      "aria-hidden": "true"
    }], [domView.element("path", [{
      "d": "m6 16 6.5 6.5L26 9"
    }], [], true)], true)], false), domView.element("span", [{
      "class": "mock-complete-tooltip"
    }, {
      "role": "tooltip"
    }, {
      "id": "mock-complete-tooltip"
    }], [label], false)], false)], false), "\n      ", domView.element("div", [{
      "class": "mock-summary-footer"
    }], [domView.element("div", [{
      "class": "mock-summary-person"
    }], [avatar(topic.person || 'studio'), domView.element("span", [], [domView.element("small", [], [personLabel], false), domView.element("strong", [], [person.name], false)], false)], false), domView.element("div", [{
      "class": "mock-summary-detail"
    }], [domView.element("strong", [], [topic.detail || 'Shared with client'], false), topic.amount !== undefined ? domView.element("small", [], ["Budget change · incl. VAT"], false) : ''], false)], false), "\n    "], false);
  }
  function sourceContext(topic) {
    if (!topic.source) return '';
    const def = findSource(topic.source);
    return domView.element("button", [{
      "class": "mock-context"
    }, {
      "data-action": "mock-source"
    }, {
      "data-thread": topic.id
    }], [domView.element("img", [{
      "src": def?.visual?.url || 'assets/interior.webp'
    }, {
      "alt": "Original commented design"
    }], [], false), domView.element("span", [], [domView.element("strong", [], [def?.title || 'Original design slide'], false), domView.element("small", [], ["Comments and replies from the presentation"], false)], false), icon('arrow')], false);
  }
  function findSource(c) {
    return slideDefs().find(s => s.id === c.slide || s.record?.id === c.slide) || slideDefs().find(s => s.visual && ['photo', 'render'].includes(s.type));
  }
  function communication() {
    if (!['all', 'open', 'done'].includes(view)) view = 'all';
    const all = topics(), list = all.filter(t => view === 'all' || isDone(t) === (view === 'done'));
    if (!list.some(t => t.id === thread)) thread = list[0]?.id || '';
    const topic = list.find(t => t.id === thread);
    const heading = domView.fragment([domView.element("div", [{
      "class": "mock-conversation-heading"
    }], [domView.element("h2", [], ["Communication"], false), btn('New conversation', 'new-topic', 'primary', '', 'plus')], false), domView.element("div", [{
      "class": "mock-inbox-tabs"
    }, {
      "role": "group"
    }, {
      "aria-label": "Filter conversations"
    }], [domView.join([['all', 'All'], ['open', 'Open'], ['done', 'Done']].map(([key, label]) => domView.element("button", [{
      "type": "button"
    }, {
      "data-action": "mock-view"
    }, {
      "data-view": key
    }, {
      "aria-pressed": view === key
    }], [label, domView.element("span", [], [all.filter(t => key === 'all' || isDone(t) === (key === 'done')).length], false)], false)), '')], false)]);
    const listHtml = domView.element("aside", [{
      "class": "mock-topic-list"
    }, {
      "aria-label": "Conversation threads"
    }], [domView.join(list.map(t => domView.element("button", [{
      "type": "button"
    }, {
      "class": domView.text(["mock-topic ", t.id === thread ? domView.attributes([{
        "selected": domView.text([])
      }]) : ''])
    }, {
      "data-action": "mock-thread"
    }, {
      "data-thread": t.id
    }, {
      "aria-pressed": t.id === thread
    }], [domView.element("span", [{
      "class": "mock-topic-title"
    }], [domView.element("strong", [], [t.title], false), isDone(t) ? domView.element("span", [{
      "class": "mock-topic-done"
    }, {
      "aria-label": "Done"
    }], [icon('check')], false) : ''], false), domView.element("p", [], [t.body], false), domView.element("span", [{
      "class": "mock-topic-meta"
    }], [typeNames[t.type], domView.element("span", [{
      "aria-hidden": "true"
    }], ["·"], false), t.private ? 'Internal' : 'With client'], false)], false)), '') || domView.element("p", [{
      "class": "mock-list-empty"
    }], ["No conversations here yet."], false)], false);
    const messages = topic ? entries(thread).filter(m => m.id !== 'paint' && m.text !== topic.body && !(topic.source && m.id === domView.concat('legacy-', topic.source.id))).reverse() : [];
    return domView.element("div", [{
      "class": "mock-conversation-view"
    }], [heading, domView.element("div", [{
      "class": "mock-hub"
    }], [listHtml, domView.element("section", [{
      "class": "mock-thread"
    }, {
      "aria-label": "Selected conversation"
    }], [topic ? domView.fragment([domView.fragment([threadSummary(topic), sourceContext(topic)]), domView.element("form", [{
      "id": "mock-reply-form"
    }, {
      "class": "mock-composer"
    }], [domView.element("label", [{
      "for": "mock-reply"
    }, {
      "class": "sr-only"
    }], [domView.fragment(["Reply to ", topic.title])], false), domView.element("textarea", [{
      "id": "mock-reply"
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "1500"
    }, {
      "rows": "2"
    }, {
      "placeholder": "Write a reply…"
    }], [drafts[thread] || ''], false), domView.element("div", [{
      "class": "mock-compose-actions"
    }], [domView.element("small", [], [topic.private ? 'Only visible to the studio' : 'Shared with everyone in this conversation'], false), domView.element("button", [{
      "class": "button primary"
    }, {
      "type": "submit"
    }], [domView.fragment(["Send ", icon('send')])], false)], false)], false), domView.element("div", [{
      "class": "mock-messages"
    }], [domView.join(messages.map(messageCard), '') || domView.element("p", [{
      "class": "mock-no-replies"
    }], ["No replies yet. Start the conversation."], false)], false)]) : domView.element("div", [{
      "class": "mock-empty-thread"
    }], ["No conversations to show."], false)], false)], false)], false);
  }
  function newTopic() {
    openModal('New conversation', domView.element("form", [{
      "id": "mock-new-topic"
    }], [domView.element("label", [], ["Type", domView.element("select", [{
      "name": "type"
    }], [domView.join(Object.entries(typeNames).map(([value, label]) => domView.element("option", [{
      "value": value
    }], [label], false)), '')], false)], false), domView.element("label", [], ["Subject", domView.element("input", [{
      "name": "title"
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "160"
    }], [], false)], false), domView.element("label", [], ["Message", domView.element("textarea", [{
      "name": "body"
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "1500"
    }, {
      "rows": "3"
    }], [], false)], false), domView.element("label", [], ["Person", domView.element("select", [{
      "name": "person"
    }], [domView.element("optgroup", [{
      "label": "Clients"
    }], [domView.element("option", [{
      "value": "client"
    }], ["Emma de Vries"], false)], false), domView.element("optgroup", [{
      "label": "Studio members"
    }], [domView.element("option", [{
      "value": "studio"
    }], ["Sophie van Dijk"], false)], false), domView.element("optgroup", [{
      "label": "Third party / other people"
    }], [domView.element("option", [{
      "value": "trade"
    }], ["Thomas Bakker"], false)], false)], false)], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button('Cancel', 'close-modal', 'ghost'), domView.element("button", [{
      "type": "submit"
    }, {
      "class": "button primary"
    }], ["Start conversation"], false)], false)], false));
  }
  function recipients(amount) {
    return Object.entries(people).filter(([role, p]) => role !== demo.role && (requestDraft.thread !== 'internal' || role === 'studio') && (amount === null || p.budget));
  }
  function requestPopup(text = '') {
    if (thread === 'internal') {
      toast('This demo’s internal thread has only Sophie. Choose a shared conversation to ask another person.');
      return;
    }
    requestDraft = {
      thread,
      text,
      attachment: null
    };
    openModal('Ask for confirmation', domView.element("form", [{
      "id": "mock-confirmation-form"
    }], [domView.element("label", [{
      "for": "mock-request-text"
    }], ["Message", domView.element("textarea", [{
      "id": "mock-request-text"
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "1500"
    }, {
      "rows": "3"
    }, {
      "placeholder": "Please confirm the paint colour for the hallway…"
    }], [text], false)], false), domView.element("label", [{
      "for": "mock-recipient"
    }], ["Confirm with", domView.element("select", [{
      "id": "mock-recipient"
    }, {
      "required": domView.text([])
    }], [domView.join(recipients(null).map(([r, p]) => domView.element("option", [{
      "value": r
    }, domView.spread(r === (demo.role === 'client' ? 'studio' : 'client') ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [domView.fragment([p.name, " · ", p.role])], false)), '')], false)], false), domView.element("details", [{
      "class": "mock-attach-details"
    }], [domView.element("summary", [], [domView.fragment([icon('file'), "Attach a file "]), domView.element("span", [{
      "class": "muted"
    }], ["optional"], false)], false), domView.element("div", [{
      "class": "mock-attach-fields"
    }], [domView.element("label", [{
      "for": "mock-existing-file"
    }], ["Choose a project file", domView.element("select", [{
      "id": "mock-existing-file"
    }], [domView.element("option", [{
      "value": domView.text([])
    }], ["No file attached"], false), domView.join((state.data.files || []).map(f => domView.element("option", [{
      "value": f.id
    }], [domView.fragment([f.name, " · V", f.number || 1])], false)), '')], false)], false), domView.element("label", [{
      "class": "mock-upload-label"
    }, {
      "for": "mock-upload"
    }], [domView.fragment([icon('upload'), " Or upload and link a file"]), domView.element("input", [{
      "id": "mock-upload"
    }, {
      "type": "file"
    }, {
      "accept": ".pdf,.png,.jpg,.jpeg,.webp"
    }], [], false)], false), domView.element("small", [{
      "class": "form-hint"
    }], ["Images or PDF, up to 2 MB. Preview preparation is simulated; files stay in this demo."], false), domView.element("div", [{
      "id": "mock-upload-status"
    }, {
      "role": "status"
    }], [], false)], false)], false), domView.element("div", [{
      "class": "mock-cost-option"
    }], [domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "id": "mock-has-cost"
    }, {
      "type": "checkbox"
    }], [], false), "Include a budget change"], false), domView.element("div", [{
      "id": "mock-cost-fields"
    }, {
      "hidden": domView.text([])
    }], [domView.element("div", [{
      "class": "mock-cost-label"
    }], [domView.element("label", [{
      "for": "mock-cost"
    }], ["Budget change (€) · including VAT"], false), domView.element("span", [{
      "class": "mock-tooltip-wrap"
    }], [domView.element("button", [{
      "class": "mock-help"
    }, {
      "type": "button"
    }, {
      "aria-label": "About positive and negative budget changes"
    }, {
      "aria-describedby": "mock-cost-help"
    }], [icon('help')], false), domView.element("span", [{
      "id": "mock-cost-help"
    }, {
      "class": "mock-tooltip"
    }, {
      "role": "tooltip"
    }], ["Use a positive amount for extra cost (1000), or a negative amount for a cheaper option (−250). Enter the change, not the new total."], false)], false)], false), domView.element("input", [{
      "id": "mock-cost"
    }, {
      "type": "text"
    }, {
      "inputmode": "decimal"
    }, {
      "placeholder": "e.g. 1000 or -250"
    }, {
      "maxlength": "12"
    }, {
      "aria-describedby": "mock-cost-help"
    }], [], false), domView.element("small", [{
      "class": "form-hint"
    }], ["Added to the budget only after confirmation."], false)], false)], false), domView.element("p", [{
      "id": "mock-request-error"
    }, {
      "class": "form-error"
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button('Cancel', 'close-modal', 'ghost'), domView.element("button", [{
      "type": "submit"
    }, {
      "id": "mock-send-request"
    }, {
      "class": "button primary"
    }], [domView.fragment(["Send confirmation request ", icon('send')])], false)], false)], false));
  }
  function parseAmount(value) {
    const s = value.trim().replace(/[−–]/g, '-').replace(',', '.');
    if (!(/^[+-]?\d{1,7}(\.\d{1,2})?$/).test(s)) return null;
    const negative = s[0] === '-';
    const [whole, frac = ''] = s.replace(/^[+-]/, '').split('.');
    return (negative ? -1 : 1) * domView.concat(Number(whole) * 100, Number(frac.padEnd(2, '0')));
  }
  function amountFields() {
    const enabled = $('#mock-has-cost').checked;
    $('#mock-cost-fields').hidden = !enabled;
    $('#mock-cost').required = enabled;
    const selected = $('#mock-recipient').value;
    domView.mount($('#mock-recipient'), domView.join(recipients(enabled ? 0 : null).map(([r, p]) => domView.element("option", [{
      "value": r
    }, domView.spread(r === selected ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [domView.fragment([p.name, " · ", p.role])], false)), ''));
    if (enabled) $('#mock-cost').focus();
  }
  function afterRender() {
    demo.ui = {
      thread,
      view,
      pendingOnly,
      who
    };
    save();
    const top = $('.demo-indicator');
    if (top) {
      domView.mount(top, domView.concat('Concept demo ', icon('help')));
      top.dataset.action = 'mock-about';
    }
    const nav = $('.tabs'), active = nav?.querySelector('.tab.active');
    if (active) {
      const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect();
      if (a.left < n.left || a.right > n.right) nav.scrollLeft += a.left - n.left - 16;
    }
    const threadList = $('.mock-topic-list'), selectedThread = threadList?.querySelector('.selected');
    if (threadList && selectedThread && threadList.scrollWidth > threadList.clientWidth) {
      const list = threadList.getBoundingClientRect(), item = selectedThread.getBoundingClientRect();
      if (item.left < list.left || item.right > list.right) threadList.scrollLeft += item.left - list.left - (list.width - item.width) / 2;
    }
    const globalComments = $('[data-action="all-comments"] .side-link-label');
    if (globalComments) globalComments.textContent = 'Communication';
    for (const r of projectRequests().filter(r => r.status === 'confirmed' && r.amount !== null)) {
      const row = document.querySelector(domView.text(["[data-budget-row=\"confirmation-", CSS.escape(r.id), "\"]"]));
      if (row && !row.querySelector('[data-action="mock-open-request"]')) domView.insert(row, 'beforeend', domView.element("div", [{
        "class": "mock-budget-source"
      }], [domView.fragment([icon('check'), " Confirmed by ", people[r.to].name, " ", btn('View confirmation', 'open-request', 'small ghost', domView.attributes([{
        "data-id": r.id
      }]), 'arrow')])], false));
    }
    if (highlight) {
      const card = document.querySelector(domView.text(["[data-confirmation=\"", CSS.escape(highlight), "\"]"]));
      if (card) requestAnimationFrame(() => card.scrollIntoView({
        block: 'center',
        behavior: 'instant'
      }));
    }
  }
  function openRequest(id) {
    const r = projectRequests().find(r => r.id === id && allowedThread(r.thread));
    if (!r) return;
    thread = r.thread;
    view = 'all';
    highlight = id;
    go('comments');
  }
  function previewAttachment(owner) {
    const item = [...demo.requests, ...demo.messages].find(m => m.id === owner);
    const a = item?.attachment;
    if (!a) return;
    const url = attachmentUrl(a);
    openModal(a.name, domView.fragment([a.mime?.startsWith('image/') && url ? domView.element("img", [{
      "class": "mock-modal-image"
    }, {
      "src": url
    }, {
      "alt": a.name
    }], [], false) : domView.element("div", [{
      "class": "mock-document-preview"
    }], [icon('file'), domView.element("strong", [], [a.name], false), domView.element("p", [], [domView.fragment(["Linked original · Version ", a.number])], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], ["This exact file version stays attached to the message."], false), url ? domView.element("div", [{
      "class": "modal-footer"
    }], [domView.element("a", [{
      "class": "button primary"
    }, {
      "href": url
    }, {
      "download": a.name
    }], [domView.fragment([icon('download'), "Download original"])], false)], false) : domView.element("p", [{
      "class": "notice"
    }], ["This temporary file is no longer available in this browser session."], false)]));
  }
  async function handleUpload(input) {
    const file = input.files?.[0];
    if (!file) return;
    const status = $('#mock-upload-status'), submit = $('#mock-send-request');
    if (file.size > 2 * 1024 * 1024 || !(/\.(pdf|png|jpe?g|webp)$/i).test(file.name)) {
      status.textContent = 'Choose an image or PDF up to 2 MB.';
      input.value = '';
      return;
    }
    if (domView.concat(demo.uploads.reduce((sum, f) => domView.concat(sum, f.size), 0), file.size) > 3 * 1024 * 1024) {
      status.textContent = 'This demo stores up to 3 MB of attachments. Reset it or choose a project file.';
      return;
    }
    const draft = requestDraft;
    submit.disabled = true;
    status.textContent = 'Adding file…';
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const upload = {
        id: domView.concat('mock-upload-', uid()),
        project: currentProject(),
        iteration: state.data.iteration.id,
        name: file.name,
        mime: file.type || ((/\.pdf$/i).test(file.name) ? 'application/pdf' : domView.concat('image/', file.name.split('.').pop())),
        size: file.size,
        data,
        readyAt: domView.concat(Date.now(), 1600)
      };
      demo.uploads.push(upload);
      save();
      syncMockAdditions([], uploadFiles());
      const f = uploadFiles().find(f => f.id === upload.id);
      if (!state.data.files.some(existing => existing.id === f.id)) state.data.files.push(f);
      if (requestDraft === draft && $('#mock-confirmation-form')) {
        const select = $('#mock-existing-file');
        select.add(new Option(domView.concat(file.name, ' · V1'), f.id));
        select.value = f.id;
        requestDraft.attachment = fileSnapshot(f);
        status.textContent = 'Linked · preparing preview…';
      }
      setTimeout(() => {
        if (requestDraft === draft && $('#mock-upload-status')) $('#mock-upload-status').textContent = 'Linked · demo preview ready';
        document.querySelectorAll('.mock-attachment small').forEach(el => {
          el.textContent = el.textContent.replace(' · Preparing preview…', '');
        });
      }, 1700);
    } catch {
      if (status.isConnected) status.textContent = 'Could not read this file. Please try another.';
    } finally {
      if (submit.isConnected) submit.disabled = false;
    }
  }
  async function confirmRequest(id) {
    const r = projectRequests().find(r => r.id === id);
    if (!r || r.status !== 'pending' || r.to !== demo.role || !allowedThread(r.thread)) return;
    if (r.amount !== null && !people[demo.role].budget) return;
    r.status = 'confirmed';
    r.confirmedAt = new Date().toISOString();
    save();
    beforeRequest('project', {});
    highlight = r.id;
    await refresh(true);
    toast(r.amount !== null ? domView.text(["Confirmed. ", signed(r.amount), " added to the budget."]) : 'Confirmation recorded.');
  }
  document.addEventListener('click', async e => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    let action = target.dataset.action;
    if (['cost', 'edit-cost'].includes(action) && target.dataset.id?.startsWith('confirmation-')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openRequest(target.dataset.id.slice(13));
      return;
    }
    if (action === 'all-comments' && state.data) {
      e.preventDefault();
      e.stopImmediatePropagation();
      go('comments');
      return;
    }
    if (!action.startsWith('mock-')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    action = action.slice(5);
    try {
      if (action === 'new-topic') newTopic();
      if (action === 'complete') {
        const topic = topics().find(t => t.id === target.dataset.thread);
        if (!topic) return;
        demo.completed[domView.concat(domView.concat(currentProject(), ':'), topic.id)] = !isDone(topic);
        save();
        render();
        document.querySelector('[data-action="mock-complete"]')?.focus({
          preventScroll: true
        });
      }
      if (action === 'communication') {
        view = 'all';
        highlight = null;
        go('comments');
      }
      if (action === 'thread') {
        thread = target.dataset.thread;
        replyTo = null;
        highlight = null;
        render();
      }
      if (action === 'view') {
        view = target.dataset.view;
        highlight = null;
        render();
      }
      if (action === 'ask') requestPopup(drafts[thread] || '');
      if (action === 'ask-existing') {
        const m = entries(thread).find(m => m.id === target.dataset.message);
        if (m) requestPopup(m.text);
      }
      if (action === 'confirm') await confirmRequest(target.dataset.id);
      if (action === 'open-request') openRequest(target.dataset.id);
      if (action === 'reply-to') {
        const r = projectRequests().find(r => r.id === target.dataset.id);
        if (r) {
          thread = r.thread;
          view = 'all';
          replyTo = r.id;
          highlight = null;
          go('comments');
          $('#mock-reply')?.focus();
        }
      }
      if (action === 'cancel-reply') {
        replyTo = null;
        render();
      }
      if (action === 'withdraw') {
        const r = projectRequests().find(r => r.id === target.dataset.id);
        if (r && r.from === demo.role && r.status === 'pending') {
          openModal('Withdraw this request?', domView.fragment([domView.element("p", [], [r.text], false), domView.element("p", [{
            "class": "form-hint"
          }], ["It will remain in the conversation as withdrawn. The budget will not change."], false), domView.element("div", [{
            "class": "modal-footer"
          }], [domView.fragment([button('Keep request', 'close-modal', 'ghost'), btn('Withdraw request', 'confirm-withdraw', 'primary', domView.attributes([{
            "data-id": r.id
          }]))])], false)]));
        }
      }
      if (action === 'confirm-withdraw') {
        const r = projectRequests().find(r => r.id === target.dataset.id);
        if (r && r.status === 'pending' && r.from === demo.role) {
          r.status = 'withdrawn';
          r.withdrawnAt = new Date().toISOString();
          save();
          closeModal();
          render();
        }
      }
      if (action === 'file') previewAttachment(target.dataset.owner);
      if (action === 'source') {
        const topic = topicFor(target.dataset.thread), def = findSource(topic.source);
        if (def) startPresentation(slideDefs().findIndex(s => s.id === def.id));
      }
      if (action === 'budget-link') {
        highlight = null;
        go('budget');
        const row = document.querySelector(domView.text(["[data-budget-row=\"confirmation-", CSS.escape(target.dataset.id), "\"]"]));
        row?.scrollIntoView({
          block: 'center'
        });
      }
      if (action === 'reset') openModal('Reset the mock?', domView.fragment([domView.element("p", [], ["Clear the demo replies, uploaded files, confirmations, and budget changes."], false), domView.element("div", [{
        "class": "modal-footer"
      }], [domView.fragment([button('Cancel', 'close-modal', 'ghost'), btn('Reset demo', 'confirm-reset', 'primary', '', 'history')])], false)]));
      if (action === 'confirm-reset') {
        sessionStorage.removeItem(storageKey);
        location.assign(safeUrl('/mock#comments', 'href'));
        location.reload();
      }
      if (action === 'about') openModal('Communication prototype', domView.fragment([domView.element("p", [], ["Explore Conversation, To do and Approval. The round checkmark toggles between open and done."], false), domView.element("p", [{
        "class": "notice"
      }], ["All changes stay in this browser tab."], false)]));
    } catch (error) {
      toast(error.message || 'This demo action could not be completed.');
    }
  }, true);
  document.addEventListener('input', e => {
    if (e.target.id === 'mock-reply') drafts[thread] = e.target.value;
  }, true);
  document.addEventListener('change', e => {
    if (e.target.id === 'mock-role') {
      demo.role = e.target.value;
      highlight = null;
      if (!allowedThread(thread)) thread = 'paint';
      save();
      render();
    }
    if (e.target.id === 'mock-pending-only') {
      pendingOnly = e.target.checked;
      render();
    }
    if (e.target.id === 'mock-who') {
      who = e.target.value;
      render();
    }
    if (e.target.id === 'mock-has-cost') amountFields();
    if (e.target.id === 'mock-existing-file') {
      const f = state.data.files.find(f => f.id === e.target.value);
      requestDraft.attachment = f ? fileSnapshot(f) : null;
    }
    if (e.target.id === 'mock-upload') handleUpload(e.target);
  }, true);
  document.addEventListener('submit', async e => {
    if (!e.target.id.startsWith('mock-')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      if (e.target.id === 'mock-new-topic') {
        const values = Object.fromEntries(new FormData(e.target));
        if (!values.title.trim() || !values.body.trim() || !typeNames[values.type]) return;
        const topic = {
          id: uid(),
          project: currentProject(),
          type: values.type,
          title: values.title.trim(),
          body: values.body.trim(),
          person: values.person,
          detail: 'Shared with client'
        };
        demo.topics.push(topic);
        thread = topic.id;
        view = 'all';
        save();
        closeModal();
        render();
        return;
      }
      if (e.target.id === 'mock-reply-form') {
        const text = $('#mock-reply').value.trim();
        if (!text) return;
        const topic = topicFor(thread), root = topic.source;
        if (root && (state.data.comments || []).some(c => c.id === root.id)) {
          await api('comment', {
            iteration: state.data.iteration.id,
            slide: root.slide,
            parent_id: root.id,
            body: text
          });
        } else demo.messages.push({
          id: uid(),
          thread,
          project: currentProject(),
          role: demo.role,
          text,
          created: new Date().toISOString(),
          replyTo
        });
        drafts[thread] = '';
        replyTo = null;
        highlight = null;
        save();
        await refresh(true);
        render();
        $('#mock-reply')?.focus();
        toast('Reply posted.');
      }
      if (e.target.id === 'mock-confirmation-form') {
        const text = $('#mock-request-text').value.trim(), to = $('#mock-recipient').value, hasCost = $('#mock-has-cost').checked, amount = hasCost ? parseAmount($('#mock-cost').value) : null;
        if (hasCost && amount === null) {
          $('#mock-request-error').hidden = false;
          $('#mock-request-error').textContent = 'Enter an amount such as 1000, -250, or -250.50.';
          $('#mock-cost').focus();
          return;
        }
        if (!text || !people[to] || to === demo.role || hasCost && !people[to].budget) return;
        const r = {
          id: uid(),
          thread: requestDraft.thread,
          text,
          from: demo.role,
          to,
          amount,
          status: 'pending',
          created: new Date().toISOString(),
          project: currentProject(),
          iteration: state.data.iteration.id,
          attachment: requestDraft.attachment
        };
        demo.requests.push(r);
        save();
        drafts[thread] = '';
        thread = r.thread;
        highlight = r.id;
        view = 'all';
        requestDraft = null;
        closeModal();
        render();
        toast('Confirmation requested.');
      }
    } catch (error) {
      toast(error.message || 'Could not save this demo message.');
    }
  }, true);
  return {
    beforeRequest,
    enrich,
    toolbar,
    overviewPanel,
    communication,
    afterRender,
    readTab,
    syncUrl,
    restoreRoute,
    pendingCount
  };
}
