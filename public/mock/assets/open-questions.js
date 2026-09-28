import * as domView from "../../assets/render.js";
import {tr, dateLocale} from './i18n.js';
export function openQuestions({state, esc, button, openModal, closeModal, formFooter, api, refresh, toast, editable}) {
  const labels = {
    get answered() {
      return tr("answer_available");
    },
    get clarification() {
      return tr("needs_clarification");
    },
    get preference() {
      return tr("your_preference");
    }
  };
  const all = () => state.data.open_questions || [];
  const find = id => all().find(q => q.id === id);
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
  function slide(def) {
    const questions = all().filter(q => !Number(q.dismissed)), working = (state.data.jobs || []).some(j => j.type === 'open_questions' && ['queued', 'running'].includes(j.status)), failed = [...state.data.jobs || []].reverse().find(j => j.type === 'open_questions')?.status === 'failed';
    return domView.element("section", [{
      "class": "open-questions-slide"
    }], [domView.element("p", [{
      "class": "slide-label"
    }], [tr("good_design_is_a_conversation")], false), domView.element("h1", [{
      "class": "slide-heading"
    }], [def.title], false), domView.element("p", [{
      "class": "slide-description"
    }], [def.description || tr("a_few_things_to_clarify_before_we_move_forward")], false), domView.element("div", [{
      "class": "question-toolbar row wrap"
    }], [editable() ? domView.fragment([domView.fragment([button(working ? tr("preparing_questions") : tr("suggest_questions"), 'suggest-open-questions', 'small', working ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '', 'spark'), button(tr("add_question"), 'edit-open-question', 'small', '', 'plus')]), domView.element("span", [{
      "class": "muted"
    }], [tr("suggestions_stay_private_until_you_include_them")], false)]) : button(tr("add_your_question"), 'add-client-question', 'small', '', 'plus')], false), editable() && failed ? domView.element("p", [{
      "class": "notice"
    }], [tr("suggestions_could_not_be_prepared_try_suggest_questions_again_your_saved_questions_and_replies_are_safe")], false) : '', domView.element("div", [{
      "class": "open-question-grid"
    }], [domView.join(questions.map(q => domView.element("article", [{
      "class": "open-question-card"
    }], [domView.element("div", [{
      "class": "row wrap"
    }], [domView.element("span", [{
      "class": "tag outline"
    }], [Number(q.resolved) ? tr("resolved") : labels[q.kind] || labels.clarification], false), !Number(q.published) ? domView.element("span", [{
      "class": "tag"
    }], [tr("private_draft")], false) : ''], false), domView.element("h2", [], [q.question], false), domView.element("p", [], [q.reason], false), domView.fragment([q.stale ? domView.element("p", [{
      "class": "question-review-note"
    }], [tr("project_details_have_changed_please_confirm_this_question_and_its_answer")], false) : '', q.answer ? domView.element("details", [], [domView.element("summary", [], [tr("read_answer")], false), domView.element("p", [{
      "class": "question-answer"
    }], [q.answer], false), domView.element("small", [], [q.origin === 'ai' ? Number(q.published) ? tr("ai_draft_reviewed_by_the_designer") : tr("ai_suggested_answer_check_linked_sources") : q.origin === 'designer' ? tr("designer_answer") : tr("from_project_sources")], false), sources(q)], false) : '']), domView.element("div", [{
      "class": "row wrap question-actions"
    }], [domView.fragment([button(q.replies?.length ? domView.text(["", tr("conversation"), " ", q.replies.length, ""]) : tr("discuss"), 'discuss-open-question', 'small', attrs(q), 'chat'), editable() ? domView.text(["", button(Number(q.published) ? tr("edit") : tr("review_include"), 'edit-open-question', 'small ghost', attrs(q)), "", button(tr("dismiss"), 'change-open-question', 'small ghost', domView.concat(attrs(q), domView.attributes([{
      "data-operation": "dismiss"
    }]))), ""]) : ''])], false)], false)), '') || domView.element("p", [{
      "class": "notice"
    }], [editable() ? tr("questions_will_be_suggested_after_files_are_processed_you_can_also_add_one_yourself") : tr("anything_you_would_like_to_clarify_add_a_question_to_start_the_conversation")], false)], false), editable() && all().some(q => Number(q.dismissed)) ? domView.element("details", [{
      "class": "dismissed-questions"
    }], [domView.element("summary", [], [tr("dismissed_questions")], false), domView.join(all().filter(q => Number(q.dismissed)).map(q => domView.element("div", [{
      "class": "row between"
    }], [domView.element("p", [], [q.question], false), button(tr("restore"), 'change-open-question', 'small ghost', domView.concat(attrs(q), domView.attributes([{
      "data-operation": "restore"
    }])))], false)), '')], false) : ''], false);
  }
  function edit(id) {
    if (!editable()) return;
    const q = find(id) || ({});
    openModal(q.id ? tr("review_question") : tr("add_question"), domView.element("form", [{
      "data-form": "open-question"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "id"
    }, {
      "value": q.id || ''
    }], [], false), domView.element("label", [], [tr("question"), domView.element("input", [{
      "name": "question"
    }, {
      "value": q.question || ''
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "240"
    }], [], false)], false), domView.element("label", [], [tr("state"), domView.element("select", [{
      "name": "kind"
    }], [domView.join(Object.entries(labels).map(([key, label]) => domView.element("option", [{
      "value": key
    }, domView.spread((q.kind || 'clarification') === key ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [label], false)), '')], false)], false), domView.element("label", [], [tr("why_this_matters"), domView.element("textarea", [{
      "name": "reason"
    }, {
      "maxlength": "600"
    }, {
      "rows": "2"
    }], [q.reason || ''], false)], false), domView.element("label", [], [tr("answer"), domView.element("textarea", [{
      "name": "answer"
    }, {
      "maxlength": "1200"
    }, {
      "rows": "4"
    }], [q.answer || ''], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("choose_answer_available_to_include_your_answer_check_the_sources_before_including_an_ai_draft")], false), domView.fragment([q.stale ? domView.element("p", [{
      "class": "notice"
    }], [tr("the_project_changed_since_this_question_was_prepared_review_the_current_documents_before_saving")], false) : '', sources(q)]), domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "published"
    }, domView.spread(Number(q.published) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), tr("include_in_the_client_presentation")], false), formFooter(tr("save_question"))], false));
  }
  function discuss(id) {
    const q = find(id);
    if (!q) return;
    openModal(tr("let_s_clarify"), domView.fragment([domView.element("h3", [], [q.question], false), q.answer ? domView.fragment([domView.element("p", [{
      "class": "question-answer"
    }], [q.answer], false), sources(q)]) : '', domView.element("div", [{
      "class": "question-conversation"
    }], [domView.join((q.replies || []).map(r => domView.element("article", [], [domView.element("small", [], [domView.fragment([r.author, " · ", new Date(r.created_at).toLocaleString(dateLocale())])], false), domView.element("p", [], [r.body], false)], false)), '') || domView.element("p", [{
      "class": "muted"
    }], [tr("share_a_preference_answer_or_follow_up_question")], false)], false), editable() ? button(Number(q.resolved) ? tr("reopen_question") : tr("mark_resolved"), 'change-open-question', 'small ghost', domView.concat(attrs(q), domView.attributes([{
      "data-operation": Number(q.resolved) ? 'reopen' : 'resolve'
    }]))) : '', domView.element("form", [{
      "data-form": "open-question-reply"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "id"
    }, {
      "value": q.id
    }], [], false), domView.element("label", [], [tr("your_reply"), domView.element("textarea", [{
      "name": "body"
    }, {
      "rows": "3"
    }, {
      "maxlength": "4000"
    }, {
      "required": domView.text([])
    }], [], false)], false), formFooter(tr("post_reply"))], false)]));
  }
  function addClient() {
    openModal(tr("your_question"), domView.element("form", [{
      "data-form": "client-open-question"
    }], [domView.element("label", [], [tr("what_would_you_like_to_clarify"), domView.element("textarea", [{
      "name": "question"
    }, {
      "rows": "3"
    }, {
      "maxlength": "240"
    }, {
      "required": domView.text([])
    }], [], false)], false), formFooter(tr("add_question"))], false));
  }
  async function action(action, el) {
    if (action === 'edit-open-question') edit(el.dataset.id);
    if (action === 'discuss-open-question') discuss(el.dataset.id);
    if (action === 'add-client-question') addClient();
    if (action === 'suggest-open-questions') {
      await api('generate_open_questions', {
        iteration: state.data.iteration.id
      });
      await refresh(true);
      toast(tr("question_suggestions_queued"));
    }
    if (action === 'change-open-question') {
      await api('save_open_question', {
        iteration: state.data.iteration.id,
        id: el.dataset.id,
        operation: el.dataset.operation
      });
      closeModal();
      await refresh(true);
    }
  }
  async function submit(type, data) {
    const iteration = state.data.iteration.id;
    if (type === 'open-question') await api('save_open_question', {
      ...data,
      iteration,
      published: data.published === 'on'
    });
    if (type === 'open-question-reply') await api('reply_open_question', {
      ...data,
      iteration
    });
    if (type === 'client-open-question') await api('add_client_question', {
      ...data,
      iteration
    });
    closeModal();
    await refresh(true);
    if (type === 'open-question-reply') discuss(data.id); else toast(tr("question_saved"));
  }
  return {
    slide,
    action,
    submit
  };
}
