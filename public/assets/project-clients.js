import * as domView from "./render.js";
import {tr} from './i18n.js';
export function projectClients({getData, api, openModal, button, formFooter, esc, refresh, toast}) {
  const clients = () => getData()?.clients ?? (getData()?.contacts || []).filter(c => c.role === 'Client');
  const canManage = () => getData() && getData().can_edit !== false;
  const member = email => clients().find(c => c.email === email);
  function summary() {
    return domView.element("div", [{
      "class": "project-team-inline project-clients-inline"
    }], [domView.element("span", [], [tr("studio_client_members")], false), domView.fragment([canManage() ? button(tr("studio_manage_clients"), 'project-clients', 'small', '', 'users') : '', domView.join(clients().map(c => domView.element("span", [{
      "class": "tag"
    }, {
      "title": c.email
    }], [c.name], false)), '') || domView.element("span", [{
      "class": "muted"
    }], [tr("studio_no_clients_yet")], false)])], false);
  }
  function open() {
    if (!canManage()) return;
    openModal(tr("studio_client_members"), domView.fragment([domView.element("p", [], [tr("studio_keep_the_project_s_client_list_here_choose_who_receives_each_iteration_when_you_send_it")], false), domView.join(clients().map(c => domView.element("div", [{
      "class": "history-item project-client-row"
    }], [domView.element("span", [], [domView.element("strong", [], [c.name], false), domView.element("small", [], [c.email], false)], false), domView.element("div", [{
      "class": "row"
    }], [domView.fragment([button(tr("edit"), 'edit-project-client', 'small', domView.attributes([{
      "data-email": c.email
    }, {
      "aria-label": domView.text(["Edit ", c.name])
    }])), button(tr("studio_remove_2"), 'remove-project-client', 'small danger-text', domView.attributes([{
      "data-email": c.email
    }, {
      "aria-label": domView.text(["Remove ", c.name])
    }]))])], false)], false)), '') || domView.element("p", [{
      "class": "notice"
    }], [tr("studio_no_client_members_yet_adding_a_client_does_not_send_an_invitation")], false), domView.element("div", [{
      "class": "modal-footer"
    }], [domView.fragment([button(tr("studio_done"), 'close-modal', 'ghost'), button(tr("studio_add_client"), 'edit-project-client', 'primary', '', 'plus')])], false)]));
  }
  function edit(email = '') {
    if (!canManage()) return;
    const c = member(email);
    openModal(c ? tr("studio_edit_client_member") : tr("studio_add_client_member"), domView.element("form", [{
      "data-form": "project-client"
    }], [domView.element("label", [], [tr("studio_name"), domView.element("input", [{
      "name": "name"
    }, {
      "value": c?.name || ''
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "100"
    }, {
      "autocomplete": "name"
    }], [], false)], false), domView.element("label", [], [tr("studio_email"), domView.element("input", [{
      "name": "email"
    }, {
      "type": "email"
    }, {
      "value": c?.email || ''
    }, domView.spread(c ? domView.attributes([{
      "readonly": domView.text([])
    }]) : ''), {
      "required": domView.text([])
    }, {
      "maxlength": "254"
    }, {
      "autocomplete": "email"
    }], [], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_you_choose_which_iterations_to_share_with_this_client")], false), formFooter(c ? tr("studio_save_client") : tr("studio_add_client"), 'users')], false));
  }
  function remove(email) {
    if (!canManage()) return;
    const c = member(email);
    if (!c) return;
    openModal(tr("studio_remove_client_member"), domView.fragment([domView.element("p", [], [domView.fragment([tr("studio_remove_2"), " "]), domView.element("strong", [], [c.name], false), domView.fragment([" ", tr("studio_from_this_project_their_access_to_all_its_shared_iterations_will_end_their_access_to_other_projects_")])], false), domView.element("form", [{
      "data-form": "remove-project-client"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "email"
    }, {
      "value": c.email
    }], [], false), formFooter(tr("studio_remove_client"), 'minus')], false)]));
  }
  async function submit(type, form) {
    const values = Object.fromEntries(new FormData(form));
    await api(type === 'project-client' ? 'save_project_client' : 'remove_project_client', {
      ...values,
      project_id: getData().project.id
    });
    await refresh();
    open();
    toast(type === 'project-client' ? tr("studio_client_member_saved") : tr("studio_client_removed_and_project_access_revoked"));
  }
  function picker() {
    return domView.element("div", [{
      "class": "client-selection-panel"
    }], [domView.element("div", [{
      "class": "row slide-filter-actions"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "class": "button small"
    }, {
      "data-client-select": "all"
    }], [tr("studio_select_all")], false), domView.element("button", [{
      "type": "button"
    }, {
      "class": "button small"
    }, {
      "data-client-select": "none"
    }], [tr("studio_clear_selection")], false), button(tr("studio_manage_clients"), 'project-clients', 'small ghost')], false), domView.element("fieldset", [{
      "class": "slide-type-options client-recipient-options"
    }], [domView.element("legend", [{
      "class": "sr-only"
    }], [tr("studio_clients_to_invite")], false), domView.join(clients().map(c => domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "client_email"
    }, {
      "value": c.email
    }, {
      "checked": domView.text([])
    }], [], false), domView.element("span", [], [domView.element("strong", [], [c.name], false), domView.element("small", [], [c.email], false)], false)], false)), '')], false), domView.element("p", [{
      "class": "form-hint"
    }, {
      "data-client-selection-error": domView.text([])
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false)], false);
  }
  function selected(form) {
    return new FormData(form).getAll('client_email');
  }
  function updateSelection(form) {
    if (!form) return;
    const count = selected(form).length;
    const error = form.querySelector('[data-client-selection-error]');
    if (error) {
      error.hidden = count <= 20;
      error.textContent = count > 20 ? tr("studio_choose_up_to_20_clients_per_send") : '';
    }
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = count === 0 || count > 20;
  }
  document.addEventListener('change', e => {
    if (e.target.matches('[name="client_email"]')) updateSelection(e.target.closest('form'));
  });
  document.addEventListener('click', e => {
    const control = e.target.closest('[data-client-select]');
    if (!control) return;
    const form = control.closest('form');
    form.querySelectorAll('[name="client_email"]').forEach(input => input.checked = control.dataset.clientSelect === 'all');
    updateSelection(form);
  });
  return {
    clients,
    summary,
    open,
    edit,
    remove,
    submit,
    picker,
    selected,
    updateSelection
  };
}
