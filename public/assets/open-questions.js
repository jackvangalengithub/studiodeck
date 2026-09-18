import {tr,dateLocale} from './i18n.js';
export function openQuestions({state,esc,button,openModal,closeModal,formFooter,api,refresh,toast,editable}){
  const labels={get answered(){return tr("answer_available");},get clarification(){return tr("needs_clarification");},get preference(){return tr("your_preference");}};
  const all=()=>state.data.open_questions||[];
  const find=id=>all().find(q=>q.id===id);
  const attrs=q=>`data-id="${esc(q.id)}"`;
  const sources=q=>(q.citations||[]).map(c=>`<div class="question-source"><q>${esc(c.quote)}</q>${button(esc(c.name)+(c.page?' · p. '+c.page:''),c.page?'legal-citation':'download','small ghost',`data-id="${esc(c.version_id)}" data-version="${esc(c.version_id)}" data-page="${Number(c.page)}"`)}</div>`).join('');
  function slide(def){
    const questions=all().filter(q=>!Number(q.dismissed)),working=(state.data.jobs||[]).some(j=>j.type==='open_questions'&&['queued','running'].includes(j.status)),failed=[...(state.data.jobs||[])].reverse().find(j=>j.type==='open_questions')?.status==='failed';
    return `<section class="open-questions-slide"><p class="slide-label">${tr("good_design_is_a_conversation")}</p><h1 class="slide-heading">${esc(def.title)}</h1><p class="slide-description">${esc(def.description||tr("a_few_things_to_clarify_before_we_move_forward"))}</p><div class="question-toolbar row wrap">${editable()?`${button(working?tr("preparing_questions"):tr("suggest_questions"),'suggest-open-questions','small',working?'disabled':'','spark')}${button(tr("add_question"),'edit-open-question','small','','plus')}<span class="muted">${tr("suggestions_stay_private_until_you_include_them")}</span>`:button(tr("add_your_question"),'add-client-question','small','','plus')}</div>${editable()&&failed?`<p class="notice">${tr("suggestions_could_not_be_prepared_try_suggest_questions_again_your_saved_questions_and_replies_are_safe")}</p>`:''}<div class="open-question-grid">${questions.map(q=>`<article class="open-question-card"><div class="row wrap"><span class="tag outline">${Number(q.resolved)?tr("resolved"):esc(labels[q.kind]||labels.clarification)}</span>${!Number(q.published)?`<span class="tag">${tr("private_draft")}</span>`:''}</div><h2>${esc(q.question)}</h2><p>${esc(q.reason)}</p>${q.stale?`<p class="question-review-note">${tr("project_details_have_changed_please_confirm_this_question_and_its_answer")}</p>`:''}${q.answer?`<details><summary>${tr("read_answer")}</summary><p class="question-answer">${esc(q.answer)}</p><small>${q.origin==='ai'?(Number(q.published)?tr("ai_draft_reviewed_by_the_designer"):tr("ai_suggested_answer_check_linked_sources")):q.origin==='designer'?tr("designer_answer"):tr("from_project_sources")}</small>${sources(q)}</details>`:''}<div class="row wrap question-actions">${button(q.replies?.length?`${tr("conversation")} ${q.replies.length}`:tr("discuss"),'discuss-open-question','small',attrs(q),'chat')}${editable()?`${button(Number(q.published)?tr("edit"):tr("review_include"),'edit-open-question','small ghost',attrs(q))}${button(tr("dismiss"),'change-open-question','small ghost',attrs(q)+' data-operation="dismiss"')}`:''}</div></article>`).join('')||`<p class="notice">${editable()?tr("questions_will_be_suggested_after_files_are_processed_you_can_also_add_one_yourself"):tr("anything_you_would_like_to_clarify_add_a_question_to_start_the_conversation")}</p>`}</div>${editable()&&all().some(q=>Number(q.dismissed))?`<details class="dismissed-questions"><summary>${tr("dismissed_questions")}</summary>${all().filter(q=>Number(q.dismissed)).map(q=>`<div class="row between"><p>${esc(q.question)}</p>${button(tr("restore"),'change-open-question','small ghost',attrs(q)+' data-operation="restore"')}</div>`).join('')}</details>`:''}</section>`;
  }
  function edit(id){
    if(!editable())return;
    const q=find(id)||{};
    openModal(q.id?tr("review_question"):tr("add_question"),`<form data-form="open-question"><input type="hidden" name="id" value="${esc(q.id||'')}"><label>${tr("question")}<input name="question" value="${esc(q.question||'')}" required maxlength="240"></label><label>${tr("state")}<select name="kind">${Object.entries(labels).map(([key,label])=>`<option value="${key}" ${(q.kind||'clarification')===key?'selected':''}>${label}</option>`).join('')}</select></label><label>${tr("why_this_matters")}<textarea name="reason" maxlength="600" rows="2">${esc(q.reason||'')}</textarea></label><label>${tr("answer")}<textarea name="answer" maxlength="1200" rows="4">${esc(q.answer||'')}</textarea></label><p class="form-hint">${tr("choose_answer_available_to_include_your_answer_check_the_sources_before_including_an_ai_draft")}</p>${q.stale?`<p class="notice">${tr("the_project_changed_since_this_question_was_prepared_review_the_current_documents_before_saving")}</p>`:''}${sources(q)}<label class="check-label"><input type="checkbox" name="published" ${Number(q.published)?'checked':''}>${tr("include_in_the_client_presentation")}</label>${formFooter(tr("save_question"))}</form>`);
  }
  function discuss(id){
    const q=find(id);if(!q)return;
    openModal(tr("let_s_clarify"),`<h3>${esc(q.question)}</h3>${q.answer?`<p class="question-answer">${esc(q.answer)}</p>${sources(q)}`:''}<div class="question-conversation">${(q.replies||[]).map(r=>`<article><small>${esc(r.author)} · ${esc(new Date(r.created_at).toLocaleString(dateLocale()))}</small><p>${esc(r.body)}</p></article>`).join('')||`<p class="muted">${tr("share_a_preference_answer_or_follow_up_question")}</p>`}</div>${editable()?button(Number(q.resolved)?tr("reopen_question"):tr("mark_resolved"),'change-open-question','small ghost',attrs(q)+` data-operation="${Number(q.resolved)?'reopen':'resolve'}"`):''}<form data-form="open-question-reply"><input type="hidden" name="id" value="${esc(q.id)}"><label>${tr("your_reply")}<textarea name="body" rows="3" maxlength="4000" required></textarea></label>${formFooter(tr("post_reply"))}</form>`);
  }
  function addClient(){openModal(tr("your_question"),`<form data-form="client-open-question"><label>${tr("what_would_you_like_to_clarify")}<textarea name="question" rows="3" maxlength="240" required></textarea></label>${formFooter(tr("add_question"))}</form>`);}
  async function action(action,el){
    if(action==='edit-open-question')edit(el.dataset.id);
    if(action==='discuss-open-question')discuss(el.dataset.id);
    if(action==='add-client-question')addClient();
    if(action==='suggest-open-questions'){await api('generate_open_questions',{iteration:state.data.iteration.id});await refresh(true);toast(tr("question_suggestions_queued"));}
    if(action==='change-open-question'){await api('save_open_question',{iteration:state.data.iteration.id,id:el.dataset.id,operation:el.dataset.operation});closeModal();await refresh(true);}
  }
  async function submit(type,data){
    const iteration=state.data.iteration.id;
    if(type==='open-question')await api('save_open_question',{...data,iteration,published:data.published==='on'});
    if(type==='open-question-reply')await api('reply_open_question',{...data,iteration});
    if(type==='client-open-question')await api('add_client_question',{...data,iteration});
    closeModal();await refresh(true);if(type==='open-question-reply')discuss(data.id);else toast(tr("question_saved"));
  }
  return {slide,action,submit};
}
