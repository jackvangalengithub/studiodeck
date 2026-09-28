import {safeUrl} from '../../assets/dom.js';
import * as domView from "../../assets/render.js";
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
  const priceText = (plan, projects = 0, seats = 0) => {
    const p = monthly(plan, projects, seats);
    return domView.concat(domView.join([p.base, p.projects, p.seats].filter((v, i) => i === 0 || v > 0).map(v => money(v)), ' + '), domView.concat(p.projects, p.seats) > 0 ? domView.concat(' = ', money(p.total)) : '');
  };
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
  let current = null, invoices = null, invoiceError = '', seen = new Set(), poll = null, checkoutNotice = '';
  async function load() {
    if (!admin()) throw Error(tr("studio_only_studio_admins_can_view_billing"));
    const sid = state.studio.id;
    current = await api('billing');
    if (state.studio.id !== sid) return;
    state.billing = current.summary;
    invoices = null;
    invoiceError = '';
    try {
      invoices = (await api('billing_invoices')).invoices;
    } catch (e) {
      invoiceError = e.message;
    }
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
    }], [domView.element("span", [], [domView.fragment([c[o.plan]?.name || o.plan, " · ", o.error || tr("studio_checkout_pending_access_changes_only_after_payment_is_confirmed")])], false), o.status === 'pending' ? domView.text(["", button(tr("studio_resume"), 'billing-resume', 'small', domView.attributes([{
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
    }], [domView.element("div", [{
      "class": "billing-package-group"
    }], [domView.element("h2", [], [tr("studio_choose_a_monthly_package")], false), domView.element("div", [{
      "class": "billing-plans"
    }], [domView.join(['solo', 'studio', 'practice'].map(key => {
      const p = c[key], selected = selectedPlan() === key, ep = selected ? Number(current.extra_projects) : 0, es = selected ? Number(current.extra_seats) : 0;
      return domView.element("article", [{
        "class": domView.text(["billing-plan ", selected ? 'is-selected' : ''])
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
      }], [priceText(p, ep, es), domView.element("small", [], [domView.fragment([" ", tr("studio_month_2")])], false)], false), domView.element("p", [], [tr('billing_capacity_counts', {
        members: domView.concat(p.seats, es),
        projects: domView.concat(p.projects, ep),
        count: domView.concat(p.seats, es)
      })], false), selected && (ep || es) ? domView.element("p", [{
        "class": "billing-addon-detail"
      }], [domView.join([ep ? tr('billing_extra_project_slots', {
        count: ep
      }) : '', es ? tr('billing_extra_member_slots', {
        count: es
      }) : ''].filter(Boolean), ' · ')], false) : '', domView.element("p", [{
        "class": "muted"
      }], [tr("studio_10_image_enhancements_per_project_per_calendar_month")], false), domView.element("div", [{
        "class": "billing-plan-actions"
      }], [selected ? domView.fragment([button(tr('studio_adjust_capacity'), 'billing-plan', 'small billing-adjust', domView.attributes([{
        "data-plan": key
      }])), domView.element("button", [{
        "type": "button"
      }, {
        "class": "button billing-current-button"
      }, {
        "disabled": domView.text([])
      }], [tr('studio_current_package')], false)]) : button(tr("studio_choose", {
        v0: p.name
      }), 'billing-plan', 'primary', domView.attributes([{
        "data-plan": key
      }, domView.spread(p.available ? '' : domView.attributes([{
        "disabled": domView.text([])
      }]))]))], false)], false);
    }), '')], false)], false), domView.element("div", [{
      "class": "billing-pass-group"
    }], [domView.element("h2", [], [tr('billing_or_buy_pass')], false), domView.element("article", [{
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
    }], [domView.fragment([button(tr('studio_buy_project_pass_19'), 'billing-new-pass', b.available_passes ? 'small' : 'primary', c.pass.available ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])), b.available_passes ? button(tr('billing_create_with_pass'), 'billing-use-pass', 'primary') : ''])], false)], false)], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_prices_exclude_vat_extra_active_projects_10_month_each_extra_practice_designers_20_month_each_add_on")], false), !c.pass.available ? domView.element("p", [{
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
  function banner() {
    const b = state.billing, a = state.data?.billing;
    if (!b) return '';
    let text = '';
    if (b.needs_onboarding) text = tr("studio_set_up_your_studio_to_start_your_7_day_trial"); else if (a?.archived) text = tr("studio_this_project_is_archived_and_read_only_reactivate_it_to_continue_working"); else if (b.status === 'past_due') text = tr("studio_your_renewal_payment_needs_attention_editing_pauses_three_days_after_your_paid_period_ends"); else if (a && !a.active) text = tr("studio_this_project_is_read_only", {
      v0: a.delete_after ? domView.text([" ", tr("studio_export_or_renew_before_2", {
        v0: date(a.delete_after)
      }), ""]) : ' Your files remain available to view and download.'
    }); else if (b.trial_ends_at && !b.subscription_active && b.usage.passes === 0) {
      const left = Math.ceil((Number(b.trial_ends_at) * 1000 - Date.now()) / 86400000);
      text = left > 0 ? tr("studio_day_left_in_your_trial_ends", {
        v0: left,
        v1: left === 1 ? '' : 's',
        v2: date(b.trial_ends_at)
      }) : tr("studio_your_trial_has_ended_choose_a_project_pass_or_subscription_to_keep_working");
    }
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
  function afterRender() {
    if (!state.billing || !admin() || state.present || state.tab === 'destinations' || isModalOpen() || state.tab === 'projects' && state.studioEmpty) return;
    const b = state.billing, key = domView.concat(domView.concat(state.studio.id, ':'), b.needs_onboarding ? 'setup' : b.trial_ends_at);
    if (seen.has(key) || sessionStorage.getItem(domView.concat('billing-notice:', key))) return;
    if (b.needs_onboarding) {
      seen.add(key);
      onboarding();
      return;
    }
    if (b.trial_ends_at && Number(b.trial_ends_at) * 1000 <= Date.now() && !b.subscription_active && b.usage.passes === 0) {
      seen.add(key);
      sessionStorage.setItem(domView.concat('billing-notice:', key), '1');
      openModal(tr("studio_your_trial_has_ended"), domView.fragment([domView.element("p", [], [domView.fragment([tr("studio_keep_working_on_your_project_with_a"), " "]), domView.element("strong", [], [tr("studio_19_project_pass")], false), domView.fragment([tr("studio_or_choose_a_monthly_package_from"), " "]), domView.element("strong", [], [tr("studio_39_month")], false), tr("studio_prices_exclude_vat")], false), domView.element("p", [], [tr("studio_your_work_is_safe_to_view_and_download_during_the_retention_period")], false), domView.element("div", [{
        "class": "modal-footer"
      }], [domView.fragment([button(tr("studio_continue_in_read_only_mode"), 'close-modal'), button(tr("studio_view_packages"), 'billing', 'primary')])], false)]));
    }
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
    if (a === 'billing-new-pass') {
      openModal(tr('studio_buy_a_project_pass'), domView.fragment([domView.element("p", [], [tr('billing_pass_purchase_first')], false), domView.element("p", [], [tr('billing_pass_activation')], false), domView.element("form", [{
        "data-form": "billing-checkout"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "plan"
      }, {
        "value": "pass"
      }], [], false), submit(tr('studio_continue_to_stripe'))], false)]));
      return true;
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
      const key = el.dataset.plan, p = current.catalog[key], ep = domView.concat(Number(current.extra_projects), el.dataset.addSlot ? 1 : 0), es = key === 'practice' ? Number(current.extra_seats) : 0;
      openModal(selectedPlan() === key ? tr('studio_adjust_capacity') : tr('studio_choose', {
        v0: p.name
      }), domView.fragment([domView.element("p", [], [tr('billing_included_capacity', {
        members: p.seats,
        projects: p.projects
      })], false), domView.element("p", [{
        "class": "form-hint"
      }], [tr('billing_members_counted', {
        used: current.summary.usage.seats
      })], false), domView.element("form", [{
        "data-form": "billing-plan"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "plan"
      }, {
        "value": key
      }], [], false), domView.element("label", [], [tr('studio_extra_active_projects_10_month_each'), domView.element("input", [{
        "name": "extra_projects"
      }, {
        "type": "number"
      }, {
        "min": "0"
      }, {
        "max": "500"
      }, {
        "step": "1"
      }, {
        "value": ep
      }, {
        "required": domView.text([])
      }], [], false)], false), domView.element("label", [], [tr('billing_team_capacity'), domView.element("input", [{
        "name": "team_capacity"
      }, {
        "type": "number"
      }, {
        "min": p.seats
      }, {
        "max": key === 'practice' ? domView.concat(p.seats, 100) : p.seats
      }, {
        "step": "1"
      }, {
        "value": domView.concat(p.seats, es)
      }, domView.spread(key === 'practice' ? domView.attributes([{
        "required": domView.text([])
      }]) : domView.attributes([{
        "readonly": domView.text([])
      }]))], [], false)], false), domView.element("p", [{
        "class": "form-hint"
      }], [tr(key === 'practice' ? 'billing_practice_members_hint' : 'billing_fixed_members_hint')], false), domView.element("output", [{
        "class": "billing-capacity-preview"
      }, {
        "data-capacity-preview": domView.text([])
      }], [capacityText(key, ep, es)], false), submit(selectedPlan() ? tr('studio_preview_change') : tr('studio_continue_to_stripe'))], false)]));
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
      const response = await fetch(domView.concat('/api.php?', new URLSearchParams({
        action: 'project_export',
        project_id: state.data.project.id
      })), {
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
    if (form?.dataset.form !== 'billing-plan') return;
    const key = form.elements.plan.value, p = current.catalog[key], projects = Number(form.elements.extra_projects.value), seats = Number(form.elements.team_capacity.value) - p.seats;
    if (Number.isInteger(projects) && projects >= 0 && Number.isInteger(seats) && seats >= 0) form.querySelector('[data-capacity-preview]').textContent = capacityText(key, projects, seats);
  }
  async function form(type, data) {
    if (!type.startsWith('billing-')) return false;
    if (type === 'billing-onboard') {
      applySession(await api('billing_onboard', data));
      closeModal();
      await resetStudio();
      toast(state.billing?.trial_active ? tr("studio_your_7_day_trial_has_started_create_your_first_project") : tr("studio_studio_ready_choose_a_package_in_billing"));
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
      if (current.summary.plan && !['canceled', 'incomplete_expired', 'none'].includes(current.summary.status)) {
        const q = await api('billing_change_preview', data);
        openModal(tr("studio_confirm_your_package_change"), domView.fragment([domView.element("p", [], [q.scheduled ? tr("studio_your_package_changes_on_no_charge_today", {
          v0: date(q.effective_at)
        }) : domView.fragment([domView.fragment([tr("studio_estimated_charge_now"), " "]), domView.element("strong", [], [money(q.amount, q.currency)], false), tr("studio_including_prorations_and_applicable_tax")])], false), domView.element("p", [], [tr("studio_new_recurring_package_month_excluding_vat", {
          v1: money(q.monthly_amount),
          v2: q.scheduled ? tr("studio_capacity_reductions_are_reserved_immediately_so_your_studio_fits_at_renewal") : tr("studio_new_capacity_becomes_available_after_successful_payment")
        })], false), domView.element("form", [{
          "data-form": "billing-change-confirm"
        }], [domView.element("input", [{
          "type": "hidden"
        }, {
          "name": "change_id"
        }, {
          "value": q.change_id
        }], [], false), submit(q.scheduled ? tr("studio_schedule_change") : tr("studio_confirm_and_pay"))], false)]));
      } else {
        const r = await api('billing_checkout', data);
        location.assign(safeUrl(r.url, 'href'));
      }
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
    badge,
    afterRender,
    action,
    form,
    returned,
    capacityChanged
  };
}
