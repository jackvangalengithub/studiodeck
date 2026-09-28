import {safeUrl} from './dom.js';
import * as domView from "./render.js";
import {platformFetch} from './platform/files.js';
import {tr, getLanguage} from './i18n.js';
export function billingUi({state, api, esc, button, openModal, closeModal, render, applySession, resetStudio, toast, isModalOpen, resourceHeaders, resumeAccess = async () => false, hasIntent = () => false, purchaseStarted = () => {}, createProject = async () => {}}) {
  const date = t => t ? new Date(Number(t) * 1000).toLocaleString(getLanguage() === 'nl' ? 'nl-NL' : undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }) : '—';
  const money = (n, c = 'eur') => new Intl.NumberFormat(getLanguage() === 'nl' ? 'nl-NL' : undefined, {
    style: 'currency',
    currency: c.toUpperCase()
  }).format(n / 100);
  const monthly = (plan, projects = 0, seats = 0) => ({
    base: Number(plan.cents),
    projects: Number(projects) * 1000,
    seats: Number(seats) * 2000,
    total: domView.concat(domView.concat(Number(plan.cents), Number(projects) * 1000), Number(seats) * 2000)
  });
  const priceText = (plan, projects = 0, seats = 0) => money(monthly(plan, projects, seats).total);
  const selectedPlan = () => current?.summary.plan && !['canceled', 'incomplete_expired', 'none'].includes(current.summary.status) ? current.summary.plan : null;
  const source = s => ({
    get trial() {
      return tr("studio_trial");
    },
    get project_pass() {
      return tr("studio_project_pass");
    },
    get subscription() {
      return tr("studio_subscription");
    },
    get legacy() {
      return tr("studio_existing_studio");
    },
    get none() {
      return tr("studio_awaiting_purchase");
    }
  })[s] || s;
  const admin = () => state.studio?.role === 'admin';
  const submit = label => domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("cancel"), 'close-modal'), domView.element("button", [{
    "type": "submit"
  }, {
    "class": "button primary"
  }], [label], false)], false);
  let drafts = {}, current = null, invoices = null, invoiceError = '', poll = null, checkoutNotice = '';
  async function load() {
    if (!admin()) throw Error(tr("studio_only_studio_admins_can_view_billing"));
    const sid = state.studio.id;
    const [billingResult, invoiceResult] = await Promise.allSettled([api('billing'), api('billing_invoices')]);
    if (state.studio.id !== sid) return;
    if (billingResult.status === 'rejected') throw billingResult.reason;
    current = billingResult.value;
    state.billing = current.summary;
    drafts = {};
    invoices = null;
    invoiceError = '';
    if (invoiceResult.status === 'fulfilled') invoices = invoiceResult.value.invoices; else invoiceError = invoiceResult.reason.message;
  }
  async function open() {
    closeModal();
    state.settingsOpen = false;
    state.present = false;
    state.tab = 'billing';
    await load();
    render();
  }
  function page() {
    if (!admin()) return domView.element("p", [{
      "class": "notice"
    }], [tr("studio_only_studio_admins_can_view_billing")], false);
    if (!current) return domView.element("p", [{
      "role": "status"
    }], [tr("studio_loading_billing")], false);
    const b = current.summary, c = current.catalog;
    return domView.fragment([domView.element("div", [{
      "class": "project-head"
    }], [domView.element("h1", [], [tr("studio_billing_2")], false), domView.element("div", [{
      "class": "row billing-actions"
    }], [domView.fragment([button(tr("studio_refresh"), 'billing-refresh', '', '', 'history'), current.has_customer ? button(tr("studio_manage_payments"), 'billing-portal', 'primary', '', 'budget') : ''])], false)], false), domView.fragment(["\n      ", hasIntent() ? domView.element("div", [{
      "class": "notice billing-notice"
    }], [domView.element("span", [], [tr("studio_your_project_action_is_saved_after_payment_continue_to_recheck_access_and_available_slots")], false), button(tr("studio_continue_to_project"), 'billing-refresh', 'primary')], false) : '', "\n      ", checkoutNotice ? domView.element("p", [{
      "class": "notice"
    }, {
      "role": "status"
    }], [checkoutNotice], false) : '', "\n      ", b.legacy_exempt ? domView.element("p", [{
      "class": "notice"
    }], [tr('billing_legacy_access_explanation')], false) : '', "\n      ", b.status === 'past_due' ? domView.element("p", [{
      "class": "notice"
    }, {
      "role": "alert"
    }], [tr("studio_your_renewal_payment_needs_attention_editing_pauses_three_days_after_your_paid_period_ends_update_yo")], false) : '', "\n      ", domView.join(current.orders.filter(o => o.status === 'pending' || o.error).map(o => domView.element("div", [{
      "class": "notice billing-notice"
    }], [domView.element("span", [], [domView.fragment([c[o.plan]?.name || current.addons?.find(a => a.id === o.plan)?.name || o.plan, " · ", o.error || tr("studio_checkout_pending_access_changes_only_after_payment_is_confirmed")])], false), o.status === 'pending' ? domView.text(["", button(tr("studio_resume"), 'billing-resume', 'small', domView.attributes([{
      "data-id": o.id
    }])), "", button(tr("studio_cancel_checkout"), 'billing-cancel-checkout', 'small', domView.attributes([{
      "data-id": o.id
    }])), ""]) : ''], false)), ''), "\n      ", domView.join(current.changes.map(x => domView.element("div", [{
      "class": "notice billing-notice"
    }], [domView.element("span", [], [domView.fragment([c[x.plan].name, " · ", tr(domView.concat('billing_change_', x.status)), " · ", date(x.effective_at)])], false), x.status === 'scheduled' ? button(tr("studio_cancel_change"), 'billing-cancel-change', 'small', domView.attributes([{
      "data-id": x.id
    }])) : x.invoice_url ? domView.element("a", [{
      "class": "button small"
    }, {
      "href": x.invoice_url
    }, {
      "target": "_blank"
    }, {
      "rel": "noopener"
    }], [tr("studio_complete_payment")], false) : button(tr("studio_resume_change"), 'billing-confirm-change', 'small', domView.attributes([{
      "data-id": x.id
    }]))], false)), ''), "\n      "]), domView.element("section", [{
      "class": "billing-section"
    }], [domView.element("div", [{
      "class": "billing-offers"
    }], [domView.element("section", [{
      "class": "billing-pass-group billing-offer-group"
    }, {
      "aria-labelledby": "billing-pass-title"
    }], [domView.element("header", [{
      "class": "billing-group-heading"
    }], [domView.element("p", [{
      "class": "billing-eyebrow"
    }], [tr("billing_pass_eyebrow")], false), domView.element("h2", [{
      "id": "billing-pass-title"
    }], [tr("billing_pass_title")], false), domView.element("p", [{
      "class": "muted"
    }], [tr("billing_pass_description")], false)], false), domView.element("article", [{
      "class": "billing-plan billing-pass-card"
    }], [domView.element("h3", [], [tr('studio_project_pass')], false), domView.element("p", [{
      "class": "billing-price"
    }], [money(c.pass.cents ?? 1900), domView.element("small", [], [domView.fragment([" ", tr('billing_one_time')])], false)], false), domView.element("p", [], [tr('billing_pass_new_project')], false), domView.element("p", [{
      "class": "muted"
    }], [tr('billing_pass_activation')], false), domView.element("p", [{
      "class": "muted"
    }], [tr('billing_pass_images')], false), b.available_passes ? domView.element("p", [{
      "class": "notice"
    }], [tr('billing_available_passes', {
      count: b.available_passes
    })], false) : '', domView.element("div", [{
      "class": "billing-plan-actions"
    }], [domView.fragment([button(tr('billing_go_to_checkout'), 'billing-new-pass', b.available_passes ? 'small' : 'primary', c.pass.available ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]), 'cart'), b.available_passes ? button(tr('billing_create_with_pass'), 'billing-use-pass', 'primary') : ''])], false)], false)], false), domView.element("section", [{
      "class": "billing-package-group billing-offer-group"
    }, {
      "aria-labelledby": "billing-subscriptions-title"
    }], [domView.element("header", [{
      "class": "billing-group-heading"
    }], [domView.element("p", [{
      "class": "billing-eyebrow"
    }], [tr("billing_monthly_eyebrow")], false), domView.element("h2", [{
      "id": "billing-subscriptions-title"
    }], [tr("billing_subscriptions_title")], false), domView.element("p", [{
      "class": "muted"
    }], [tr("billing_subscriptions_description")], false)], false), domView.element("div", [{
      "class": "billing-plans"
    }], [domView.join(['solo', 'studio', 'practice'].map(key => {
      const p = c[key], selected = selectedPlan() === key, draft = planDraft(key);
      return domView.element("article", [{
        "class": domView.text(["billing-plan ", selected ? 'is-selected' : ''])
      }, {
        "data-package": key
      }, domView.spread(selected ? domView.attributes([{
        "aria-label": domView.text([tr('billing_selected_package', {
          plan: p.name
        })])
      }]) : '')], [domView.element("div", [{
        "class": "billing-plan-heading"
      }], [domView.element("h3", [], [p.name], false), selected ? domView.element("span", [{
        "class": "billing-selected-badge"
      }], [domView.fragment(["✓ ", tr('billing_selected')])], false) : ''], false), domView.element("p", [{
        "class": "billing-price"
      }, {
        "aria-live": "polite"
      }], [domView.element("span", [{
        "data-package-total": domView.text([])
      }], [priceText(p, draft.projects - p.projects, draft.seats - p.seats)], false), domView.element("small", [], [domView.fragment([" ", tr("studio_month_2")])], false)], false), domView.element("form", [{
        "data-form": "billing-plan-column"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "plan"
      }, {
        "value": key
      }], [], false), domView.element("div", [{
        "class": "billing-capacity-controls"
      }], [domView.fragment([capacityControl(key, 'projects', p.projects, draft.projects), key === 'solo' ? domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "seats"
      }, {
        "value": "1"
      }], [], false) : capacityControl(key, 'seats', p.seats, draft.seats)])], false)], false), domView.element("p", [{
        "class": "muted"
      }], [tr("studio_10_image_enhancements_per_project_per_calendar_month")], false), domView.element("p", [{
        "class": "muted"
      }], [tr("billing_website_included")], false), domView.element("div", [{
        "class": "billing-plan-actions"
      }], [selected ? domView.fragment([button(tr('studio_adjust_capacity'), 'billing-plan', 'small billing-adjust', domView.attributes([{
        "data-plan": key
      }])), domView.element("button", [{
        "type": "button"
      }, {
        "class": "button billing-current-button"
      }, {
        "disabled": domView.text([])
      }], [tr('studio_current_package')], false)]) : button(tr("billing_go_to_checkout"), 'billing-plan', 'primary', domView.attributes([{
        "data-plan": key
      }, domView.spread(p.available ? '' : domView.attributes([{
        "disabled": domView.text([])
      }]))]), 'cart')], false)], false);
    }), '')], false)], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr('billing_price_note')], false), !c.pass.available ? domView.element("p", [{
      "class": "notice"
    }], [tr("studio_checkout_will_be_available_once_the_studio_s_payment_connection_is_configured")], false) : ''], false), "\n      ", domView.element("section", [{
      "class": "billing-section"
    }], [domView.element("h2", [], [tr("studio_invoices")], false), invoiceError ? domView.element("p", [{
      "class": "notice"
    }], [invoiceError], false) : domView.element("div", [{
      "class": "billing-table-wrap"
    }], [domView.join((invoices || []).map(i => domView.element("tr", [], [domView.element("td", [], [date(i.created)], false), domView.element("td", [], [i.number || i.description], false), domView.element("td", [], [money(i.amount, i.currency)], false), domView.element("td", [], [i.status], false), domView.element("td", [], [domView.fragment([i.url ? domView.element("a", [{
      "href": i.url
    }, {
      "target": "_blank"
    }, {
      "rel": "noopener"
    }], [tr("studio_view_invoice")], false) : '', " ", i.pdf ? domView.element("a", [{
      "href": i.pdf
    }, {
      "target": "_blank"
    }, {
      "rel": "noopener"
    }], ["PDF"], false) : ''])], false)], false)), '') || domView.element("tr", [], [domView.element("td", [{
      "colspan": "5"
    }], [tr("studio_your_stripe_invoices_will_appear_here_after_your_first_purchase")], false)], false), domView.element("table", [{
      "class": "billing-table"
    }], [domView.element("thead", [], [domView.element("tr", [], [domView.element("th", [], [tr("studio_date")], false), domView.element("th", [], [tr("studio_invoice")], false), domView.element("th", [], [tr("studio_amount")], false), domView.element("th", [], [tr("studio_status")], false), domView.element("th", [], [tr("download")], false)], false)], false), domView.element("tbody", [], [], false)], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_showing_the_latest_24_invoices_older_invoices_are_available_through_manage_payments")], false)], false)]);
  }
  function planDraft(key) {
    const p = current.catalog[key], selected = selectedPlan() === key;
    return drafts[key] ??= {
      projects: domView.concat(Number(p.projects), selected ? Number(current.extra_projects || 0) : 0),
      seats: key === 'solo' ? 1 : Math.min(capacityMax(key, 'seats'), domView.concat(Number(p.seats), selected ? Number(current.extra_seats || 0) : 0))
    };
  }
  const capacityMax = (key, kind) => kind === 'seats' ? key === 'solo' ? 1 : key === 'studio' ? 14 : Infinity : Infinity;
  function capacityControl(key, kind, min, value) {
    const label = tr(kind === 'projects' ? 'billing_projects' : 'billing_people'), id = domView.text(["billing-", key, "-", kind, ""]), max = capacityMax(key, kind);
    return domView.element("div", [{
      "class": "billing-capacity-row"
    }], [domView.element("label", [{
      "for": id
    }], [label], false), domView.element("span", [{
      "class": "billing-stepper"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "data-action": "billing-capacity-step"
    }, {
      "data-plan": key
    }, {
      "data-kind": kind
    }, {
      "data-delta": "-1"
    }, {
      "aria-label": tr('billing_decrease', {
        name: label
      })
    }, domView.spread(value <= min ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], ["−"], false), domView.element("input", [{
      "id": id
    }, {
      "name": kind
    }, {
      "type": "number"
    }, {
      "min": min
    }, domView.spread(Number.isFinite(max) ? domView.text(["max=\"", max, "\""]) : ''), {
      "step": "1"
    }, {
      "value": value
    }, {
      "required": domView.text([])
    }], [], false), domView.element("button", [{
      "type": "button"
    }, {
      "data-action": "billing-capacity-step"
    }, {
      "data-plan": key
    }, {
      "data-kind": kind
    }, {
      "data-delta": "1"
    }, {
      "aria-label": tr('billing_increase', {
        name: label
      })
    }, domView.spread(value >= max ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], ["+"], false)], false)], false);
  }
  function trialBar() {
    const b = state.billing;
    if (!state.user || state.client || state.present || !b || b.needs_onboarding || b.legacy_exempt || b.subscription_active || !b.trial_ends_at || b.usage.passes > 0) return '';
    const days = Math.max(0, Math.ceil((Number(b.trial_ends_at) * 1000 - Date.now()) / 86400000));
    return domView.element("aside", [{
      "class": "billing-trial-bar"
    }, {
      "aria-label": tr('studio_trial')
    }], [domView.element("span", [{
      "role": "status"
    }], [days ? tr('billing_trial_days', {
      count: days
    }) : tr('billing_trial_ended')], false), admin() ? button(tr('billing_activate'), 'billing', 'small') : ''], false);
  }
  function banner() {
    const b = state.billing, a = state.data?.billing;
    if (!b) return '';
    let text = '';
    if (a?.archived) text = tr("studio_this_project_is_archived_and_read_only_reactivate_it_to_continue_working"); else if (b.status === 'past_due') text = tr("studio_your_renewal_payment_needs_attention_editing_pauses_three_days_after_your_paid_period_ends"); else if (a && !a.active && !(a.source === 'trial' && trialBar())) text = tr("studio_this_project_is_read_only", {
      v0: a.delete_after ? domView.text([" ", tr("studio_export_or_renew_before_2", {
        v0: date(a.delete_after)
      }), ""]) : ' Your files remain available to view and download.'
    });
    if (!text || state.tab === 'billing') return '';
    return domView.element("div", [{
      "class": "notice billing-notice"
    }, {
      "role": "status"
    }], [domView.element("span", [], [text], false), admin() ? button(b.needs_onboarding ? tr("studio_set_up_studio") : a && (a.archived || !a.active) ? tr("studio_review_project_access") : tr("studio_view_packages"), b.needs_onboarding ? 'billing-onboarding' : a && (a.archived || !a.active) ? 'billing-access-current' : 'billing', 'small') : domView.element("span", [], [tr("studio_contact_your_studio_admin")], false)], false);
  }
  function badge(a) {
    return a ? domView.element("span", [{
      "class": "tag"
    }], [domView.fragment([source(a.source), a.archived ? domView.text([" ", tr("studio_archived_2"), ""]) : a.active ? '' : a.source === 'project_pass' ? domView.text([" ", tr("studio_expired"), ""]) : a.source === 'subscription' ? domView.text([" ", tr("studio_payment_required"), ""]) : domView.text([" ", tr("studio_read_only_2"), ""])])], false) : '';
  }
  function onboarding() {
    openModal(tr("studio_your_studio_starts_here"), domView.fragment([domView.element("p", [], [tr("studio_try_one_real_project_for_7_days_no_card_required_includes_3_image_enhancements_30_uploads_250_mb_tot")], false), domView.element("form", [{
      "data-form": "billing-onboard"
    }], [domView.element("label", [], [tr("studio_your_name"), domView.element("input", [{
      "name": "name"
    }, {
      "value": state.user?.name || ''
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "100"
    }, {
      "autocomplete": "name"
    }], [], false)], false), domView.element("label", [], [tr("studio_studio_name"), domView.element("input", [{
      "name": "studio_name"
    }, {
      "value": state.studio?.name || ''
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "100"
    }, {
      "autocomplete": "organization"
    }], [], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_one_trial_per_account_if_you_have_already_used_yours_you_can_buy_a_pass_or_subscription_after_setup_")], false), submit(tr("studio_set_up_studio"))], false)]));
  }
  async function action(a, el) {
    if (!a.startsWith('billing')) return false;
    if (a === 'billing') {
      await open();
      return true;
    }
    if (a === 'billing-onboarding') {
      onboarding();
      return true;
    }
    if (a === 'billing-refresh') {
      await api('billing_refresh');
      await load();
      render();
      await resumeAccess();
      return true;
    }
    if (a === 'billing-portal') {
      const r = await api('billing_portal');
      location.assign(safeUrl(r.url, 'href'));
      return true;
    }
    if (a === 'billing-capacity-step') {
      const {plan: key, kind} = el.dataset, delta = Number(el.dataset.delta);
      if (!['solo', 'studio', 'practice'].includes(key) || !['projects', 'seats'].includes(kind) || ![-1, 1].includes(delta)) return true;
      const draft = planDraft(key);
      draft[kind] = Math.min(capacityMax(key, kind), Math.max(Number(current.catalog[key][kind]), domView.concat(draft[kind], delta)));
      const input = el.closest('form').elements[kind];
      input.value = draft[kind];
      capacityChanged(input.form);
      return true;
    }
    if (a === 'billing-new-pass') {
      return form('billing-checkout', {
        plan: 'pass'
      });
    }
    if (a === 'billing-use-pass') {
      await load();
      if (!current.summary.available_passes) throw Error(tr('billing_no_unused_pass'));
      closeModal();
      await createProject('pass');
      return true;
    }
    if (a === 'billing-pass') {
      const p = current.projects.find(p => p.id === el.dataset.id);
      openModal(el.dataset.plan === 'extension' ? tr("studio_more_time_for_your_project") : tr("studio_buy_a_project_pass"), domView.fragment([domView.element("p", [], [domView.element("strong", [], [p.name], false)], false), domView.element("p", [], [el.dataset.plan === 'extension' ? tr("studio_15_adds_another_150_days_from_the_later_of_your_current_expiry_and_payment_it_does_not_reset_the_10_") : tr("studio_19_covers_one_named_designer_this_project_and_150_days_from_payment_includes_10_image_enhancements_t")], false), domView.element("p", [], [tr("studio_prices_exclude_vat_no_automatic_renewal_this_purchase_selects_project_pass_coverage_for_this_project")], false), domView.element("form", [{
        "data-form": "billing-checkout"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "plan"
      }, {
        "value": el.dataset.plan
      }], [], false), domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "project_id"
      }, {
        "value": p.id
      }], [], false), submit(tr("studio_continue_to_stripe"))], false)]));
      return true;
    }
    if (a === 'billing-plan') {
      const key = el.dataset.plan, p = current.catalog[key], draft = planDraft(key), column = el.closest?.('[data-package]');
      if (column && !column.querySelector('form').reportValidity()) return true;
      const data = {
        plan: key,
        extra_projects: domView.concat(draft.projects - p.projects, el.dataset.addSlot ? 1 : 0),
        extra_seats: draft.seats - p.seats
      };
      if (selectedPlan() === key && data.extra_projects === Number(current.extra_projects || 0) && data.extra_seats === Number(current.extra_seats || 0)) {
        const result = await api('billing_portal');
        location.assign(safeUrl(result.url, 'href'));
        return true;
      }
      purchaseStarted(data);
      const result = await api(selectedPlan() ? 'billing_change_checkout' : 'billing_checkout', data);
      location.assign(safeUrl(result.url, 'href'));
      return true;
    }
    if (a === 'billing-coverage') {
      openModal(tr("studio_change_project_coverage"), domView.fragment([domView.element("p", [], [el.dataset.source === 'subscription' ? tr("studio_this_project_will_use_one_subscription_project_slot_when_active_any_existing_pass_keeps_its_original") : tr("studio_this_project_will_use_its_existing_pass_and_must_have_only_its_named_designer_historical_image_usage")], false), domView.element("form", [{
        "data-form": "billing-coverage"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "project_id"
      }, {
        "value": el.dataset.id
      }], [], false), domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "source"
      }, {
        "value": el.dataset.source
      }], [], false), submit(tr("studio_change_coverage"))], false)]));
      return true;
    }
    if (a === 'billing-cancel-checkout') {
      await api('billing_cancel_checkout', {
        order_id: el.dataset.id
      });
      await load();
      render();
      return true;
    }
    if (a === 'billing-resume') {
      const r = await api('billing_resume_checkout', {
        order_id: el.dataset.id
      });
      location.assign(safeUrl(r.url, 'href'));
      return true;
    }
    if (a === 'billing-cancel-change') {
      await api('billing_cancel_change', {
        change_id: el.dataset.id
      });
      await load();
      render();
      return true;
    }
    if (a === 'billing-confirm-change') {
      const r = await api('billing_change_confirm', {
        change_id: el.dataset.id
      });
      if (r.url) location.assign(safeUrl(r.url, 'href')); else {
        await load();
        render();
        await resumeAccess();
      }
      return true;
    }
    if (a === 'billing-export') {
      const response = await platformFetch(new URLSearchParams({
        action: 'project_export',
        project_id: state.data.project.id
      }), {
        credentials: 'same-origin',
        headers: resourceHeaders()
      });
      if (!response.ok) throw Error((await response.json()).error || tr("studio_export_failed"));
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.download = 'studiodeck-project.zip';
      link.href = safeUrl(url, 'href', link.download !== undefined && link.hasAttribute?.("download"));
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return true;
    }
    return false;
  }
  function capacityText(key, projects, seats) {
    const p = current.catalog[key];
    return domView.text(["", tr('billing_capacity_counts', {
      members: domView.concat(p.seats, seats),
      projects: domView.concat(p.projects, projects),
      count: domView.concat(p.seats, seats)
    }), " · ", priceText(p, projects, seats), " ", tr('studio_month_2'), ""]);
  }
  function capacityChanged(form) {
    if (form?.dataset.form === 'billing-plan-column') {
      const key = form.elements.plan.value, p = current.catalog[key], draft = planDraft(key);
      for (const kind of ['projects', 'seats']) {
        const input = form.elements[kind], value = Number(input.value);
        if (input.value === '' || !Number.isInteger(value) || value < Number(p[kind]) || value > capacityMax(key, kind)) return;
      }
      draft.projects = Number(form.elements.projects.value);
      draft.seats = Number(form.elements.seats.value);
      form.closest('[data-package]').querySelector('[data-package-total]').textContent = priceText(p, draft.projects - p.projects, draft.seats - p.seats);
      for (const kind of ['projects', 'seats']) {
        const decrease = form.querySelector(domView.text(["[data-kind=\"", kind, "\"][data-delta=\"-1\"]"])), increase = form.querySelector(domView.text(["[data-kind=\"", kind, "\"][data-delta=\"1\"]"]));
        if (decrease) decrease.disabled = draft[kind] <= Number(p[kind]);
        if (increase) increase.disabled = draft[kind] >= capacityMax(key, kind);
      }
      return;
    }
    if (form?.dataset.form !== 'billing-plan') return;
    const key = form.elements.plan.value, p = current.catalog[key], projects = Number(form.elements.extra_projects.value), seats = Number(form.elements.team_capacity.value) - p.seats;
    if (Number.isInteger(projects) && projects >= 0 && Number.isInteger(seats) && seats >= 0) form.querySelector('[data-capacity-preview]').textContent = capacityText(key, projects, seats);
  }
  async function form(type, data) {
    if (!type.startsWith('billing-')) return false;
    if (type === 'billing-plan-column') return action('billing-plan', {
      dataset: {
        plan: data.plan
      }
    });
    if (type === 'billing-onboard') {
      applySession(await api('billing_onboard', data));
      closeModal();
      await resetStudio();
      return true;
    }
    if (type === 'billing-checkout') {
      purchaseStarted(data);
      const r = await api('billing_checkout', data);
      location.assign(safeUrl(r.url, 'href'));
      return true;
    }
    if (type === 'billing-coverage') {
      await api('billing_coverage', data);
      closeModal();
      await load();
      render();
      return true;
    }
    if (type === 'billing-plan') {
      const p = current.catalog[data.plan];
      data = {
        ...data,
        extra_seats: data.team_capacity === undefined ? Number(data.extra_seats || 0) : Number(data.team_capacity) - p.seats
      };
      delete data.team_capacity;
      purchaseStarted(data);
      const result = await api(selectedPlan() ? 'billing_change_checkout' : 'billing_checkout', data);
      location.assign(safeUrl(result.url, 'href'));
      return true;
    }
    if (type === 'billing-change-confirm') {
      const r = await api('billing_change_confirm', data);
      if (r.url) location.assign(safeUrl(r.url, 'href')); else {
        closeModal();
        await load();
        render();
        toast(r.status === 'scheduled' ? tr("studio_package_change_scheduled") : tr("studio_package_updated"));
        if (r.status !== 'scheduled') await resumeAccess();
      }
      return true;
    }
    return false;
  }
  async function returned() {
    const params = new URLSearchParams(location.search);
    if (params.has('portal')) {
      history.replaceState(null, '', location.pathname);
      await api('billing_refresh');
      await load();
      render();
      await resumeAccess();
      return;
    }
    if (!params.has('checkout')) return;
    const outcome = params.get('checkout'), orderId = params.get('order');
    history.replaceState(null, '', location.pathname);
    clearTimeout(poll);
    if (!orderId) {
      await api('billing_refresh');
      await load();
      render();
      toast(tr("studio_checkout_cancelled_your_current_access_is_unchanged"));
      return;
    }
    checkoutNotice = tr('studio_confirming_your_payment');
    render();
    let attempts = 0;
    const refresh = async () => {
      try {
        await api('billing_refresh');
        await load();
        const order = current.orders.find(o => o.id === orderId);
        let done = true;
        if (order?.status === 'paid') {
          checkoutNotice = tr(order.plan === 'pass' && !order.project_id ? 'billing_pass_ready' : 'studio_payment_confirmed_your_access_is_ready');
        } else if (order?.status === 'failed') {
          checkoutNotice = tr('billing_payment_failed_access_explanation');
        } else if (['refunded', 'expired', 'cancelled'].includes(order?.status)) {
          checkoutNotice = tr('studio_payment_was_not_completed_or_was_refunded_review_your_project_access_or_choose_another_payment_optio');
        } else if (++attempts >= 6) {
          checkoutNotice = tr('studio_payment_is_still_processing_access_will_update_when_stripe_confirms_it');
        } else {
          done = false;
          checkoutNotice = tr(outcome === 'failed' ? 'billing_confirming_declined_payment' : 'studio_confirming_your_payment');
        }
        if (state.tab === 'billing') render();
        if (done) {
          toast(checkoutNotice);
          if (order?.status === 'paid') await resumeAccess();
        } else poll = setTimeout(refresh, 6000);
      } catch (e) {
        checkoutNotice = e.message;
        if (state.tab === 'billing') render();
        toast(e.message);
      }
    };
    await refresh();
  }
  return {
    load,
    open,
    page,
    banner,
    trialBar,
    badge,
    action,
    form,
    returned,
    capacityChanged
  };
}
