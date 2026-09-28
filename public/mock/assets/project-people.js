import * as domView from "../../assets/render.js";
import {tr} from './i18n.js';
export function projectPeople({getData, api, openModal, closeModal, button, formFooter, esc, personAvatar, refresh, toast, addTeam}) {
  const labels = {
    get team() {
      return tr("team_members");
    },
    get clients() {
      return tr("clients");
    },
    get other() {
      return tr("other_people");
    }
  };
  const singular = {
    get team() {
      return tr("studio_team_member_2");
    },
    get clients() {
      return tr('studio_client_lower');
    },
    get other() {
      return tr('studio_person_lower');
    }
  };
  const canEdit = () => getData()?.can_edit !== false;
  function groups() {
    const d = getData();
    if (d.people) return d.people;
    const team = (d.team || d.members || []).map(p => ({
      ...p,
      key: p.id
    })), clients = (d.clients || (d.contacts || []).filter(p => p.role === 'Client')).map(p => ({
      ...p,
      key: p.email
    }));
    const known = new Set([...team, ...clients].map(p => p.email.toLowerCase()));
    return {
      team,
      clients,
      other: (d.contacts || []).filter(p => p.role !== 'Client' && !known.has(p.email.toLowerCase())).map(p => ({
        ...p,
        key: p.id
      }))
    };
  }
  const find = (group, key) => (groups()[group] || []).find(p => p.key === key);
  function page() {
    return domView.element("div", [{
      "class": "project-people"
    }], [domView.join(Object.entries(labels).map(([group, label]) => domView.element("section", [{
      "class": "people-section"
    }, {
      "aria-label": label
    }], [domView.element("div", [{
      "class": "section-title"
    }], [domView.element("div", [], [domView.element("h2", [], [label], false), domView.element("p", [{
      "class": "muted"
    }], [({
      get team() {
        return tr("studio_studio_members_who_can_edit_this_project");
      },
      get clients() {
        return tr("studio_people_you_share_presentations_with");
      },
      get other() {
        return tr("studio_project_contacts_such_as_subcontractors_adding_a_contact_does_not_grant_access");
      }
    })[group]], false)], false), canEdit() ? button(tr("studio_add"), 'add-project-person', 'small', domView.attributes([{
      "data-group": group
    }, {
      "aria-label": tr("studio_add_2", {
        v1: singular[group]
      })
    }]), 'plus') : ''], false), domView.element("div", [{
      "class": "people-list"
    }], [domView.join(groups()[group].map(p => domView.element("article", [{
      "class": "project-person"
    }], [personAvatar(p.profile, p.name), domView.element("div", [{
      "class": "project-person-info"
    }], [domView.element("h3", [], [p.name], false), p.role && group !== 'clients' ? domView.element("p", [{
      "class": "muted project-person-role"
    }], [p.role], false) : '', domView.element("div", [{
      "class": "person-contact-details"
    }], [domView.fragment([p.email ? domView.element("a", [{
      "href": domView.text(["mailto:", encodeURIComponent(p.email)])
    }], [p.email], false) : '', p.phone ? domView.element("a", [{
      "href": domView.text(["tel:", p.phone.replace(/[^\d+]/g, '')])
    }], [p.phone], false) : ''])], false)], false), canEdit() ? domView.element("div", [{
      "class": "person-actions"
    }], [domView.fragment([button(tr("edit"), 'edit-project-person', 'small ghost', domView.attributes([{
      "data-group": group
    }, {
      "data-key": p.key
    }, {
      "aria-label": tr("studio_edit", {
        v2: p.name
      })
    }]), 'edit'), button(tr("studio_remove_2"), 'remove-project-person', 'small ghost danger-text', domView.attributes([{
      "data-group": group
    }, {
      "data-key": p.key
    }, {
      "aria-label": tr("studio_remove_3", {
        v2: p.name
      })
    }]), 'minus')])], false) : ''], false)), '') || domView.element("p", [{
      "class": "people-empty muted"
    }], [tr("studio_no_yet", {
      v0: label.toLowerCase()
    })], false)], false)], false)), '')], false);
  }
  async function add(group) {
    if (!canEdit()) return;
    if (group === 'team') await addTeam(); else edit(group);
  }
  function edit(group, key = '') {
    if (!canEdit() || !labels[group]) return;
    const p = find(group, key);
    if (key && !p) return;
    if (group === 'team') {
      if (!p) return;
      openModal(tr("studio_edit_project_role"), domView.fragment([domView.element("p", [], [p.name], false), domView.element("form", [{
        "data-form": "project-person"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "group"
      }, {
        "value": "team"
      }], [], false), domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "key"
      }, {
        "value": key
      }], [], false), domView.element("label", [], [tr("studio_role_in_this_project"), domView.element("input", [{
        "name": "role"
      }, {
        "value": p.role || ''
      }, {
        "maxlength": "80"
      }, {
        "placeholder": tr("studio_for_example_project_architect")
      }], [], false)], false), formFooter(tr("studio_save_role"))], false)]));
      return;
    }
    openModal(domView.text(["", p ? tr("edit") : tr("studio_add"), " ", singular[group], ""]), domView.element("form", [{
      "data-form": "project-person"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "group"
    }, {
      "value": group
    }], [], false), domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "key"
    }, {
      "value": key
    }], [], false), domView.element("label", [], [tr("studio_name"), domView.element("input", [{
      "name": "name"
    }, {
      "value": p?.name || ''
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "100"
    }, {
      "autocomplete": "name"
    }], [], false)], false), domView.element("label", [], [tr("studio_email_2", {
      v3: group === 'other' ? domView.text([" ", tr("studio_optional"), ""]) : ''
    }), domView.element("input", [{
      "name": "email"
    }, {
      "type": "email"
    }, {
      "value": p?.email || ''
    }, domView.spread(group !== 'other' ? domView.attributes([{
      "required": domView.text([])
    }]) : ''), domView.spread(p && group !== 'other' ? domView.attributes([{
      "readonly": domView.text([])
    }]) : ''), {
      "maxlength": "254"
    }, {
      "autocomplete": "email"
    }], [], false)], false), domView.element("label", [], [tr("studio_phone_optional"), domView.element("input", [{
      "name": "phone"
    }, {
      "type": "tel"
    }, {
      "value": p?.phone || ''
    }, {
      "maxlength": "40"
    }, {
      "autocomplete": "tel"
    }], [], false)], false), group === 'other' ? domView.element("label", [], [tr("studio_role_optional"), domView.element("input", [{
      "name": "role"
    }, {
      "value": p?.role || ''
    }, {
      "maxlength": "80"
    }, {
      "placeholder": tr("studio_for_example_electrical_contractor")
    }], [], false)], false) : '', domView.element("p", [{
      "class": "form-hint"
    }], [group === 'clients' ? tr("studio_adding_a_client_does_not_send_an_invitation_choose_when_to_share_an_iteration") : tr("studio_this_person_will_not_receive_project_access_or_an_invitation")], false), formFooter(p ? tr("studio_save_details") : domView.concat(domView.text(["", tr("studio_add"), " "]), singular[group]))], false));
  }
  function remove(group, key) {
    if (!canEdit()) return;
    const p = find(group, key);
    if (!p) return;
    openModal(tr("studio_remove_4", {
      v0: singular[group]
    }), domView.fragment([domView.element("p", [], [domView.fragment([tr("studio_remove_2"), " "]), domView.element("strong", [], [p.name], false), domView.fragment([" ", tr("studio_from_this_project", {
      v1: group === 'clients' ? domView.text([" ", tr("studio_their_existing_presentation_links_for_this_project_will_stop_working"), ""]) : group === 'team' ? domView.text([" ", tr("studio_they_will_no_longer_be_able_to_edit_this_project"), ""]) : ''
    })])], false), domView.element("form", [{
      "data-form": "remove-project-person"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "group"
    }, {
      "value": group
    }], [], false), domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "key"
    }, {
      "value": key
    }], [], false), formFooter(domView.concat(domView.text(["", tr("studio_remove_2"), " "]), singular[group]), 'minus')], false)]));
  }
  async function submit(type, form) {
    await api(type === 'project-person' ? 'save_project_person' : 'remove_project_person', {
      ...Object.fromEntries(new FormData(form)),
      project_id: getData().project.id
    });
    closeModal();
    await refresh(true);
    toast(type === 'project-person' ? new FormData(form).get('group') === 'team' ? tr("studio_project_role_saved") : tr("studio_contact_details_saved") : tr("studio_person_removed_from_project"));
  }
  return {
    page,
    add,
    edit,
    remove,
    submit
  };
}
export function presentationPeople(data) {
  if (data.presentation_people) return data.presentation_people;
  if (data.people) return data.people;
  const team = data.team || data.members || [], clients = data.clients || (data.contacts || []).filter(p => p.role === 'Client');
  const known = new Set([...team, ...clients].map(p => (p.email || '').toLowerCase()).filter(Boolean));
  return {
    team,
    clients,
    other: (data.contacts || []).filter(p => p.role !== 'Client' && (!p.email || !known.has(p.email.toLowerCase())))
  };
}
