import * as domView from "./render.js";
import {tr, getLanguage} from './i18n.js';
export function projectAccessUi({state, api, esc, button, openModal, closeModal, toast, billing, openProject, newProject, back}) {
  let context = null, busy = false;
  const key = () => domView.text(["project-intent:", state.user?.id, ":", state.studio?.id, ""]);
  const date = t => new Date(t * 1000).toLocaleDateString(getLanguage() === 'nl' ? 'nl-NL' : undefined);
  function save(intent) {
    sessionStorage.setItem(key(), JSON.stringify({
      ...intent,
      at: Date.now()
    }));
  }
  function pending() {
    try {
      const p = JSON.parse(sessionStorage.getItem(key()));
      return p && Date.now() - p.at < 86400000 ? p : null;
    } catch {
      return null;
    }
  }
  function clear() {
    sessionStorage.removeItem(key());
  }
  const footer = () => domView.element("div", [{
    "class": "modal-footer"
  }], [domView.fragment([button(tr("studio_back_to_projects"), 'billing-access-back'), context?.pid ? button(tr("studio_open_read_only"), 'billing-access-read') : ''])], false);
  async function gate(pid = '', intent = 'open', options = {}) {
    const d = await api('project_access', {
      project_id: pid
    });
    if (d.summary) state.billing = d.summary;
    if (pid && intent === 'open' && d.reason === 'trial_expired') return true;
    if (d.reason === 'ready' && intent !== 'reactivate') return true;
    context = {
      pid,
      intent,
      options,
      d
    };
    show();
    return false;
  }
  function show(message = '') {
    const {d, pid} = context, a = d.access, b = d.summary;
    const titles = {
      get archived() {
        return tr("studio_reactivate_this_project");
      },
      get capacity() {
        return tr("studio_your_active_project_slots_are_full");
      },
      get trial_expired() {
        return tr("studio_review_project_access");
      },
      get pass_expired() {
        return tr("studio_your_project_pass_has_expired");
      },
      get subscription_ended() {
        return tr("studio_your_subscription_has_ended");
      },
      get payment_required() {
        return tr("studio_update_your_payment_to_continue");
      },
      get uncovered() {
        return tr("studio_choose_access_for_this_project");
      },
      get trial_used() {
        return tr("studio_your_active_project_slots_are_full");
      },
      get named_designer() {
        return tr("studio_this_pass_covers_another_designer");
      }
    };
    let body = domView.fragment([message ? domView.element("p", [{
      "class": "notice"
    }, {
      "role": "alert"
    }], [message], false) : '', domView.element("p", [], [domView.element("strong", [], [d.project?.name || tr("studio_new_project")], false)], false)]);
    if (a?.archived) body = domView.concat(body, domView.element("p", [], [tr("studio_archived_projects_are_read_only_reactivating_restores_editing_and_collaboration_archiving_does_not_p")], false));
    if (d.reason === 'named_designer') body = domView.concat(body, domView.element("p", [], [tr("studio_only_this_pass_s_named_designer_can_edit_a_studio_admin_can_move_the_project_to_a_subscription_for_t")], false));
    if (d.other_passes && !a?.active) body = domView.concat(body, domView.element("p", [], [tr("studio_a_pass_on_another_project_cannot_be_transferred_to_this_one")], false));
    if (a?.source === 'project_pass' && a.expires_at) body = domView.concat(body, domView.element("p", [], [tr("studio_pass", {
      v0: a.active ? 'valid until' : 'ended',
      v1: date(a.expires_at)
    })], false));
    if (b.status === 'past_due') body = domView.concat(body, domView.element("p", [], [tr("studio_your_renewal_payment_needs_attention_editing_pauses_three_days_after_the_paid_period_ends")], false));
    if (b.subscription_active) body = domView.concat(body, domView.element("p", [], [domView.element("strong", [], [domView.fragment([b.usage.projects, " / ", b.limits.projects ?? 'unlimited'])], false), domView.fragment([" ", tr("studio_active_subscription_projects", {
      v2: d.full ? tr("studio_existing_active_projects_remain_usable_this_project_needs_a_free_slot") : tr("studio_pass_projects_do_not_use_subscription_slots")
    })])], false));
    if (d.can_manage && a?.archived && a.active && (a.source !== 'subscription' || !d.full)) body = domView.concat(body, button(tr("studio_reactivate_with_current_coverage"), 'billing-access-activate', 'primary', domView.attributes([{
      "data-source": a.source
    }])));
    if (d.admin) {
      if (pid && !d.can_manage) body = domView.concat(body, domView.element("p", [], [tr("studio_only_project_team_members_can_reactivate_this_project_you_can_manage_its_billing_here")], false));
      const actions = [];
      if (pid && d.can_manage && d.can_use_subscription && !d.full && (!a.active || a.source !== 'subscription')) actions.push( button(tr("studio_use_subscription_slot"), 'billing-access-activate', 'primary', domView.attributes([{
        "data-source": "subscription"
      }])));
      if (pid && d.can_manage && d.can_use_pass && a.source !== 'project_pass') actions.push( button(tr("studio_use_existing_pass"), 'billing-access-activate', '', domView.attributes([{
        "data-source": "project_pass"
      }])));
      if (d.can_buy_pass) actions.push( button(d.has_pass ? tr("studio_extend_150_days_15") : tr("studio_buy_project_pass_19"), 'billing-access-buy', '', domView.attributes([{
        "data-kind": "pass"
      }]))); else actions.push( domView.element("p", [], [tr("studio_a_pass_requires_one_named_designer_use_a_subscription_for_this_project_s_team")], false));
      if (b.subscription_active && d.full) actions.push( button(tr("studio_add_a_slot_10_month"), 'billing-access-buy', '', domView.attributes([{
        "data-kind": "slot"
      }])));
      actions.push( button(b.subscription_active ? tr("studio_review_subscription_plans") : tr("studio_choose_a_subscription"), 'billing-access-buy', '', domView.attributes([{
        "data-kind": "subscription"
      }])));
      if (b.status === 'past_due') actions.push( button(tr("studio_update_payment_method"), 'billing-access-buy', '', domView.attributes([{
        "data-kind": "portal"
      }])));
      body = domView.concat(body, domView.element("div", [{class:"row wrap"}], actions));
      if (d.archive_candidates.length) body = domView.concat(body, domView.fragment([domView.element("label", [], [tr("studio_or_archive_a_project_to_free_its_slot"), domView.element("select", [{
        "id": "access-archive"
      }], [domView.join(d.archive_candidates.map(p => domView.element("option", [{
        "value": p.id
      }], [p.name], false)), '')], false)], false), button(tr("studio_review_archive_and_continue"), 'billing-access-archive')]));
      body = domView.concat(body, domView.element("p", [{
        "class": "form-hint"
      }], [tr("studio_prices_exclude_vat_purchases_require_confirmation_through_stripe_a_pass_covers_one_named_designer_fo")], false));
    } else body = domView.concat(body, domView.element("p", [], [tr("studio_contact_your_studio_admin_to_purchase_access_or_change_coverage")], false));
    if (pid) body = domView.concat(body, domView.element("p", [], [tr("studio_private_viewing_and_downloads_remain_available_during_retention_editing_uploads_ai_and_client_collab", {
      v0: a.delete_after ? domView.text([" ", tr("studio_export_or_renew_before_2", {
        v0: date(a.delete_after)
      }), ""]) : ''
    })], false));
    openModal(titles[d.reason] || tr("studio_project_access"), domView.concat(body, footer()));
  }
  function confirm(source, archive = '') {
    const {d} = context, b = d.summary;
    const before = b.usage.projects, after = domView.concat(before - (archive ? 1 : 0), source === 'subscription' && d.consumes_slot ? 1 : 0) - (source !== 'subscription' && d.access?.source === 'subscription' && !d.access.archived ? 1 : 0);
    const other = d.archive_candidates.find(p => p.id === archive);
    openModal(tr("studio_confirm_project_access"), domView.fragment([domView.element("p", [], [domView.fragment([other ? domView.fragment([domView.fragment([tr("studio_archive"), " "]), domView.element("strong", [], [other.name], false), domView.fragment([" ", tr("studio_and"), " "])]) : '', context.pid ? domView.fragment([domView.fragment([tr("studio_activate"), " "]), domView.element("strong", [], [d.project.name], false)]) : tr("studio_continue_creating_your_project"), "."])], false), domView.element("p", [], [source === 'subscription' ? tr("studio_subscription_slots", {
      v0: before,
      v1: after,
      v2: b.limits.projects ?? 'unlimited'
    }) : tr("studio_uses_existing_coverage_no_new_payment")], false), domView.element("p", [], [tr("studio_any_existing_pass_keeps_its_original_expiry", {
      v3: !context.pid ? tr("studio_archiving_happens_only_when_you_finish_creating_the_new_project") : ''
    })], false), domView.element("div", [{
      "class": "modal-footer"
    }], [domView.fragment([button(tr("studio_back"), 'billing-access-review'), button(tr("studio_confirm"), 'billing-access-confirm', 'primary', domView.attributes([{
      "data-source": source
    }, {
      "data-archive": archive
    }]))])], false)]));
  }
  async function resume() {
    const p = pending();
    if (!p) return false;
    const d = await api('project_access', {
      project_id: p.pid
    });
    context = {
      ...p,
      d
    };
    if (!p.pid) {
      if (d.reason === 'ready' && (p.source !== 'project_pass' || d.summary.available_passes > 0)) {
        clear();
        closeModal();
        await newProject('', p.source === 'project_pass' ? 'pass' : '');
      } else show(tr("studio_payment_and_capacity_have_been_rechecked_choose_how_to_continue"));
      return true;
    }
    if (d.reason === 'ready' && p.intent !== 'reactivate') {
      clear();
      closeModal();
      await openProject(p.pid, p.options);
      return true;
    }
    if (p.source && d.can_manage && (p.source === 'subscription' && d.can_use_subscription && !d.full || p.source === 'project_pass' && d.can_use_pass)) {
      confirm(p.source);
      return true;
    }
    show(d.full ? tr("studio_your_payment_was_checked_but_the_available_slot_has_already_been_taken_choose_another_option") : tr("studio_your_access_has_been_rechecked_complete_any_outstanding_payment_or_choose_an_available_option"));
    return true;
  }
  async function action(a, el) {
    if (!a.startsWith('billing-access-')) return false;
    if (a === 'billing-access-current') {
      await gate(state.data.project.id, 'reactivate');
      return true;
    }
    if (a === 'billing-access-back') {
      clear();
      closeModal();
      await back();
      return true;
    }
    if (a === 'billing-access-read') {
      const c = context;
      clear();
      closeModal();
      await openProject(c.pid, {
        ...c.options,
        readOnly: true
      });
      return true;
    }
    if (a === 'billing-access-review') {
      await gate(context.pid, context.intent, context.options);
      return true;
    }
    if (a === 'billing-access-activate') {
      confirm(el.dataset.source);
      return true;
    }
    if (a === 'billing-access-archive') {
      confirm('subscription', document.querySelector('#access-archive').value);
      return true;
    }
    if (a === 'billing-access-confirm') {
      if (busy) return true;
      busy = true;
      try {
        if (!context.pid) {
          clear();
          closeModal();
          await newProject(el.dataset.archive);
        } else {
          await api('project_activate', {
            project_id: context.pid,
            source: el.dataset.source,
            archive_project_id: el.dataset.archive
          });
          clear();
          closeModal();
          await openProject(context.pid, context.options);
        }
      } catch (e) {
        context.d = await api('project_access', {
          project_id: context.pid
        });
        show(e.message);
      } finally {
        busy = false;
      }
      return true;
    }
    if (a === 'billing-access-buy') {
      const kind = el.dataset.kind;
      save({
        pid: context.pid,
        intent: context.intent,
        options: context.options,
        source: kind === 'pass' ? 'project_pass' : kind === 'portal' ? context.d.access?.source : 'subscription'
      });
      await billing.load();
      if (kind === 'pass') await billing.action(context.pid ? 'billing-pass' : 'billing-new-pass', {
        dataset: {
          id: context.pid,
          plan: context.d.has_pass ? 'extension' : 'pass'
        }
      }); else if (kind === 'portal') await billing.action('billing-portal', el); else if (kind === 'slot') await billing.action('billing-plan', {
        dataset: {
          plan: context.d.summary.plan,
          addSlot: '1'
        }
      }); else await billing.open();
      return true;
    }
    return true;
  }
  function purchaseStarted(data) {
    const p = data.plan === 'pass' && !data.project_id ? {
      pid: '',
      intent: 'create',
      options: {}
    } : pending();
    if (p) save({
      ...p,
      pid: data.project_id || p.pid,
      source: ['pass', 'extension'].includes(data.plan) ? 'project_pass' : 'subscription'
    });
  }
  return {
    gate,
    action,
    resume,
    clear,
    purchaseStarted,
    hasIntent: () => !!pending()
  };
}
