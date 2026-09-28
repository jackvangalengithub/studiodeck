import * as domView from "./render.js";
import {tr, dateLocale} from './i18n.js';
export function openQuestions({state, esc, button, openModal, closeModal, formFooter, api, refresh, toast, editable, requestApproval, openConversation}) {
  const labels = {
    get answered() {
      return tr('answer_available');
    },
    get clarification() {
      return tr('needs_clarification');
    },
    get preference() {
      return tr('your_preference');
    }
  };
  const all = () => state.data.communication?.items || state.data.open_questions || [];
  const find = id => all().find(q => q.id === id);
  const accepted = q => !!Number(q.accepted) || !!Number(q.published);
  const attrs = q => domView.attributes([{
    "data-id": q.id
  }]);
  const sources = q => domView.join((q.citations || []).map(c => domView.element("div", [{
    "class": "question-source"
  }], [domView.element("q", [], [c.quote], false), button(domView.concat(c.name, c.page ? domView.concat(' · p. ', c.page) : ''), c.page ? 'legal-citation' : 'download', 'small ghost', domView.attributes([{
    "data-id": c.version_id
  }, {
    "data-version": c.version_id
  }, {
    "data-page": Number(c.page)
  }]))], false)), '');
  const location = (record, label) => record ? button(tr(label), 'comm-location', 'small ghost', domView.attributes([{
    "data-id": record.comment_id || record.id
  }, {
    "data-project": state.data.project.id
  }, {
    "data-iteration": record.iteration_id
  }]), 'chat') : '';
  function links(q) {
    return domView.text(["", location(q.source_comment, 'checklist_source_comment'), "", q.confirmation ? domView.fragment([domView.element("span", [{
      "class": "tag outline"
    }], [tr(domView.concat('checklist_approval_', q.confirmation.status))], false), location(q.confirmation, 'checklist_view_approval')]) : '', ""]);
  }
  function row(q, suggestion = false, editor = false) {
    const done = !!Number(q.resolved), canEdit = editor && state.data.can_edit !== false && !state.client && !q.locked;
    return domView.element("article", [{
      "class": domView.text(["open-question-card checklist-row ", done ? 'is-done' : ''])
    }, {
      "data-checklist-id": q.id
    }], [!suggestion ? domView.element("button", [{
      "class": "checklist-check"
    }, {
      "data-action": "change-open-question"
    }, domView.spread(attrs(q)), {
      "data-operation": done ? 'reopen' : 'resolve'
    }, {
      "role": "checkbox"
    }, {
      "aria-checked": done
    }, {
      "aria-label": domView.concat(domView.concat(tr(done ? 'checklist_reopen' : 'checklist_done'), ': '), q.question)
    }, domView.spread(canEdit ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))], [done ? '✓' : ''], false) : '', domView.element("div", [{
      "class": "checklist-copy"
    }], [domView.element("div", [{
      "class": "row wrap"
    }], [domView.element("span", [{
      "class": "tag outline"
    }], [tr(q.item_type === 'action' ? 'checklist_action' : 'question')], false), domView.fragment([canEdit ? domView.element("span", [{
      "class": "tag"
    }], [tr(Number(q.published) ? 'checklist_shared' : 'checklist_private')], false) : '', q.responsible ? domView.element("span", [{
      "class": "checklist-responsible"
    }], [q.responsible], false) : '', q.confirmation ? domView.element("span", [{
      "class": "tag outline"
    }], [tr(domView.concat('checklist_approval_', q.confirmation.status))], false) : ''])], false), domView.element("h2", [], [q.question], false), domView.fragment([suggestion && q.reason ? domView.element("p", [], [q.reason], false) : '', q.stale ? domView.element("p", [{
      "class": "question-review-note"
    }], [tr('checklist_stale')], false) : '']), domView.element("div", [{
      "class": "row wrap question-actions"
    }], [domView.fragment([suggestion && canEdit ? domView.text(["", button(tr('checklist_accept'), 'change-open-question', 'small', domView.concat(attrs(q), domView.attributes([{
      "data-operation": "accept"
    }]))), "", button(tr('checklist_review'), 'edit-open-question', 'small ghost', attrs(q)), ""]) : button(q.replies?.length ? domView.text(["", tr('conversation'), " ", q.replies.length, ""]) : tr('checklist_details'), editor ? 'edit-open-question' : 'discuss-open-question', 'small ghost', attrs(q), 'chat'), canEdit ? domView.text(["", !suggestion ? button(tr('edit'), 'edit-open-question', 'small ghost', attrs(q)) : '', "", button(tr('dismiss'), 'change-open-question', 'small ghost', domView.concat(attrs(q), domView.attributes([{
      "data-operation": "dismiss"
    }]))), ""]) : ''])], false)], false)], false);
  }
  function manage() {
    if (state.client || !state.present) return;
    const items = all().filter(q => q.iteration_id === state.data.iteration.id), working = (state.data.jobs || []).some(j => j.type === 'consistency' && ['queued', 'running'].includes(j.status));
    openModal(tr('studio_manage_checklist'), domView.fragment([domView.element("p", [{
      "class": "notice"
    }], [tr('studio_editor_only')], false), domView.element("div", [{
      "class": "row wrap"
    }], [editable() ? domView.text(["", button(working ? tr('checklist_preparing') : tr('checklist_suggest'), 'suggest-open-questions', 'small', working ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '', 'spark'), "", button(tr('checklist_add'), 'edit-open-question', 'small', '', 'plus'), ""]) : ''], false), domView.element("div", [{
      "class": "checklist-list"
    }], [domView.join(items.filter(q => !Number(q.dismissed)).map(q => row(q, !accepted(q), true)), '')], false), items.some(q => Number(q.dismissed)) ? domView.element("details", [], [domView.element("summary", [], [tr('checklist_dismissed')], false), domView.join(items.filter(q => Number(q.dismissed)).map(q => domView.element("div", [{
      "class": "row between"
    }], [domView.element("p", [], [q.question], false), editable() ? button(tr('restore'), 'change-open-question', 'small ghost', domView.concat(attrs(q), domView.attributes([{
      "data-operation": "restore"
    }]))) : ''], false)), '')], false) : '']), true);
  }
  function edit(id, fromComment) {
    if (state.client || state.data.can_edit === false) return;
    const q = find(id) || (fromComment ? {
      question: fromComment.body.slice(0, 240),
      source_comment_id: fromComment.id,
      iteration_id: fromComment.iteration_id,
      item_type: 'action'
    } : {}), requests = state.data.communication?.confirmations || [];
    const linkedElsewhere = new Set(all().filter(item => item.id !== q.id).map(item => item.confirmation_id));
    const options = requests.filter(r => !linkedElsewhere.has(r.comment_id) && r.iteration_id === (q.iteration_id || state.data.iteration.id) && (!q.thread_id || (r.parent_id || r.comment_id) === q.thread_id));
    openModal(q.id ? tr('checklist_review') : tr('checklist_add'), domView.element("form", [{
      "data-form": "open-question"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "iteration"
    }, {
      "value": q.iteration_id || state.data.iteration.id
    }], [], false), domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "id"
    }, {
      "value": q.id || ''
    }], [], false), domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "source_comment_id"
    }, {
      "value": q.source_comment_id || ''
    }], [], false), domView.element("label", [], [tr('checklist_item'), domView.element("input", [{
      "name": "question"
    }, {
      "value": q.question || ''
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "240"
    }], [], false)], false), domView.element("label", [], [tr('checklist_type'), domView.element("select", [{
      "name": "item_type"
    }], [domView.element("option", [{
      "value": "question"
    }, domView.spread(q.item_type !== 'action' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [tr('question')], false), domView.element("option", [{
      "value": "action"
    }, domView.spread(q.item_type === 'action' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [tr('checklist_action')], false)], false)], false), domView.element("label", [], [tr('checklist_responsible'), domView.element("input", [{
      "name": "responsible"
    }, {
      "value": q.responsible || ''
    }, {
      "maxlength": "160"
    }, {
      "list": "checklist-people"
    }], [], false)], false), domView.element("datalist", [{
      "id": "checklist-people"
    }], [domView.join((state.data.communication?.recipients || []).map(p => domView.element("option", [{
      "value": p.name
    }], [], false)), '')], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr('checklist_responsible_hint')], false), domView.element("label", [], [tr('why_this_matters'), domView.element("textarea", [{
      "name": "reason"
    }, {
      "maxlength": "600"
    }, {
      "rows": "2"
    }], [q.reason || ''], false)], false), domView.element("label", [], [tr('checklist_answer_state'), domView.element("select", [{
      "name": "kind"
    }], [domView.join(Object.entries(labels).map(([key, label]) => domView.element("option", [{
      "value": key
    }, domView.spread((q.kind || 'clarification') === key ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [label], false)), '')], false)], false), domView.element("label", [], [tr('answer'), domView.element("textarea", [{
      "name": "answer"
    }, {
      "maxlength": "1200"
    }, {
      "rows": "3"
    }], [q.answer || ''], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr('checklist_answer_hint')], false), domView.fragment([q.stale ? domView.element("p", [{
      "class": "notice"
    }], [tr('the_project_changed_since_this_question_was_prepared_review_the_current_documents_before_saving')], false) : '', sources(q), q.source_comment_id || q.thread_id ? domView.element("p", [{
      "class": "notice"
    }], [tr('checklist_thread_visibility')], false) : '']), domView.element("label", [], [tr('checklist_link_approval'), domView.element("select", [{
      "name": "confirmation_id"
    }], [domView.element("option", [{
      "value": domView.text([])
    }], [tr('checklist_no_approval')], false), domView.fragment([q.confirmation_id && !options.some(r => r.comment_id === q.confirmation_id) ? domView.element("option", [{
      "value": q.confirmation_id
    }, {
      "selected": domView.text([])
    }], [tr('checklist_earlier_approval')], false) : '', domView.join(options.map(r => domView.element("option", [{
      "value": r.comment_id
    }, domView.spread(r.comment_id === q.confirmation_id ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [domView.fragment([r.body.slice(0, 90), " · ", tr(domView.concat('checklist_approval_', r.status))])], false)), '')])], false)], false), domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "published"
    }, domView.spread(Number(q.published) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), tr('include_in_the_client_presentation')], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr('checklist_save_hint')], false), formFooter(tr('checklist_save'))], false));
  }
  function discuss(id) {
    const q = find(id);
    if (!q) return;
    if (q.thread_id && openConversation) {
      openConversation(q.thread_id);
      return;
    }
    openModal(tr('checklist_details'), domView.fragment([domView.element("h3", [], [q.question], false), domView.fragment([q.responsible ? domView.element("p", [], [domView.fragment([tr('checklist_responsible'), ": ", q.responsible])], false) : '', q.reason ? domView.element("p", [], [q.reason], false) : '', q.stale ? domView.element("p", [{
      "class": "notice"
    }], [tr('checklist_stale')], false) : '', q.answer ? domView.element("p", [{
      "class": "question-answer"
    }], [q.answer], false) : '', sources(q)]), domView.element("div", [{
      "class": "row wrap"
    }], [links(q)], false), domView.element("div", [{
      "class": "question-conversation"
    }], [domView.join((q.replies || []).map(r => domView.element("article", [], [domView.element("small", [], [domView.fragment([r.author, " · ", new Date(r.created_at).toLocaleString(dateLocale())])], false), domView.element("p", [], [r.body], false)], false)), '') || domView.element("p", [{
      "class": "muted"
    }], [tr('share_a_preference_answer_or_follow_up_question')], false)], false), domView.fragment([editable() && !state.present ? domView.fragment([domView.element("div", [{
      "class": "row wrap"
    }], [domView.fragment([button(tr('edit'), 'edit-open-question', 'small ghost', attrs(q)), accepted(q) ? domView.text(["", button(tr(Number(q.resolved) ? 'checklist_reopen' : 'checklist_done'), 'change-open-question', 'small ghost', domView.concat(attrs(q), domView.attributes([{
      "data-operation": Number(q.resolved) ? 'reopen' : 'resolve'
    }]))), "", q.confirmation?.status !== 'pending' ? button(tr('checklist_request_approval'), 'checklist-request-approval', 'small', attrs(q)) : '', ""]) : button(tr('checklist_accept'), 'change-open-question', 'small', domView.concat(attrs(q), domView.attributes([{
      "data-operation": "accept"
    }])))])], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr('checklist_done_hint')], false)]) : '', state.client || state.data.can_edit !== false ? domView.element("form", [{
      "data-form": "open-question-reply"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "id"
    }, {
      "value": q.id
    }], [], false), domView.element("label", [], [tr('your_reply'), domView.element("textarea", [{
      "name": "body"
    }, {
      "rows": "3"
    }, {
      "maxlength": "4000"
    }, {
      "required": domView.text([])
    }], [], false)], false), formFooter(tr('post_reply'))], false) : ''])]));
  }
  function addClient() {
    openModal(tr('your_question'), domView.element("form", [{
      "data-form": "client-open-question"
    }], [domView.element("label", [], [tr('what_would_you_like_to_clarify'), domView.element("textarea", [{
      "name": "question"
    }, {
      "rows": "3"
    }, {
      "maxlength": "240"
    }, {
      "required": domView.text([])
    }], [], false)], false), formFooter(tr('add_question'))], false));
  }
  async function action(action, el) {
    if (action === 'edit-open-question') edit(el.dataset.id);
    if (action === 'checklist-from-comment') {
      const c = (state.data.communication?.comments || state.data.comments).find(c => c.id === el.dataset.id);
      if (c) edit(null, c);
    }
    if (action === 'checklist-request-approval') {
      const q = find(el.dataset.id);
      if (q && !state.client && !q.locked && state.data.can_edit !== false) requestApproval(q);
    }
    if (action === 'discuss-open-question') discuss(el.dataset.id);
    if (action === 'add-client-question') addClient();
    if (action === 'suggest-open-questions') {
      await api('generate_open_questions', {
        iteration: state.data.iteration.id
      });
      await refresh(true);
      toast(tr('checklist_queued'));
    }
    if (action === 'change-open-question') {
      await api('save_open_question', {
        iteration: find(el.dataset.id)?.iteration_id || state.data.iteration.id,
        id: el.dataset.id,
        operation: el.dataset.operation
      });
      closeModal();
      await refresh(true);
    }
  }
  async function submit(type, data) {
    const iteration = data.iteration || find(data.id)?.iteration_id || state.data.iteration.id;
    let result;
    if (type === 'open-question') result = await api('save_open_question', {
      ...data,
      iteration,
      published: data.published === 'on'
    });
    if (type === 'open-question-reply') await api('reply_open_question', {
      ...data,
      iteration
    });
    if (type === 'client-open-question') result = await api('add_client_question', {
      ...data,
      iteration
    });
    closeModal();
    await refresh(true);
    if (result?.id && find(result.id)?.thread_id) {
      openConversation(find(result.id).thread_id);
      return;
    }
    if (type === 'open-question-reply') discuss(data.id); else toast(tr('checklist_saved'));
  }
  return {
    discuss,
    manage,
    action,
    submit
  };
}
