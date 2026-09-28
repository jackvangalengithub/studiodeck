import {safeUrl} from './dom.js';
import * as domView from "./render.js";
import {platformFetch} from './platform/files.js';
import {tr} from './i18n.js';
export function startingPack({api, state, esc, button, openModal, closeModal, refresh, toast}) {
  let items = [], manage = false, selection = null;
  const label = i => i.kind === 'document' ? tr("studio_reference_pdf") : ({
    get intro() {
      return tr("studio_welcome_slide");
    },
    get contacts() {
      return tr("studio_contact_slide");
    },
    get text() {
      return tr("studio_text_slide");
    },
    get fullphoto() {
      return tr("studio_image_slide");
    }
  })[i.slide_type] || tr("studio_slide");
  const fileLink = i => i.name ? button(i.name, 'pack-download', 'small ghost', domView.attributes([{
    "data-version": i.version_id
  }, {
    "data-name": i.name
  }])) : '';
  const footer = text => domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("cancel"), 'close-modal', 'ghost'), domView.element("button", [{
    "class": "button primary"
  }, {
    "type": "submit"
  }], [text], false)], false);
  async function library() {
    const r = await api('studio_starting_pack');
    items = r.items;
    manage = r.can_manage;
    openModal(tr("studio_your_studio_starting_pack"), domView.fragment([domView.element("p", [], [tr("studio_a_familiar_starting_point_for_every_project_slides_are_editable_copies_reference_pdfs_stay_available")], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_changes_here_apply_to_future_projects_existing_projects_keep_their_copies_and_can_add_missing_slides")], false), manage ? domView.element("div", [{
      "class": "row pack-actions"
    }], [domView.fragment([button(tr("studio_add_slide"), 'pack-new-slide', 'primary'), button(tr("studio_add_reference_pdf"), 'pack-new-document'), !items.length ? button(tr("studio_use_example_slides"), 'pack-examples', 'ghost') : ''])], false) : '', domView.element("div", [{
      "class": "pack-list"
    }], [domView.join(items.map(i => domView.element("article", [{
      "class": "pack-item"
    }], [domView.element("div", [], [domView.element("small", [], [tr("studio_version", {
      v0: label(i),
      v1: i.revision,
      v2: i.default_enabled ? tr("studio_included_by_default") : tr("optional")
    })], false), domView.element("h3", [], [i.title], false), domView.element("p", [{
      "class": "pack-copy"
    }], [i.body], false), fileLink(i)], false), manage ? domView.element("div", [{
      "class": "row"
    }], [domView.fragment([button(tr("edit"), 'pack-edit', 'small', domView.attributes([{
      "data-id": i.id
    }])), button(tr("studio_archive"), 'pack-archive', 'small ghost', domView.attributes([{
      "data-id": i.id
    }]))])], false) : ''], false)), '') || domView.element("div", [{
      "class": "notice"
    }], [tr("studio_start_with_a_welcome_your_process_and_studio_contact_details_add_your_terms_and_conditions_as_a_refe")], false)], false)]), true);
  }
  function edit(id = '', kind = 'slide') {
    const i = items.find(i => i.id === id) || ({
      kind,
      slide_type: 'text',
      default_enabled: 1,
      position: items.length * 10
    });
    openModal(id ? tr("studio_edit_studio_template") : tr("studio_add_to_your_starting_pack"), domView.element("form", [{
      "data-form": "pack-item"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "id"
    }, {
      "value": id
    }], [], false), domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "base_version"
    }, {
      "value": i.version_id || ''
    }], [], false), domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "kind"
    }, {
      "value": i.kind
    }], [], false), i.kind === 'slide' ? domView.element("label", [], [tr("studio_slide_type"), domView.element("select", [{
      "name": "slide_type"
    }, domView.spread(id ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], [domView.join([['text', tr("studio_text_process")], ['intro', tr("studio_welcome_replaces_opening_text")], ['contacts', tr("studio_contact_replaces_contact_heading")], ['fullphoto', tr("studio_image_with_caption")]].map(([v, t]) => domView.element("option", [{
      "value": v
    }, domView.spread(v === i.slide_type ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [t], false)), '')], false)], false) : '', domView.element("label", [], [tr("studio_title"), domView.element("input", [{
      "name": "title"
    }, {
      "maxlength": "160"
    }, {
      "value": i.title || ''
    }, {
      "required": domView.text([])
    }], [], false)], false), domView.element("label", [], [i.kind === 'document' ? tr("studio_description_optional") : tr("studio_slide_text"), domView.element("textarea", [{
      "name": "body"
    }, {
      "rows": "5"
    }, {
      "maxlength": "1600"
    }], [i.body || ''], false)], false), i.kind === 'slide' ? domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_personalise_with_or_missing_details_stay_visible_for_you_to_edit_in_the_project")], false) : '', domView.element("label", [], [i.kind === 'document' ? tr("studio_reference_pdf") : tr("studio_image_only_for_image_slides"), domView.element("input", [{
      "name": "file"
    }, {
      "type": "file"
    }, {
      "accept": i.kind === 'document' ? '.pdf' : '.jpg,.jpeg,.png,.webp'
    }, domView.spread(i.kind === 'document' && !id ? domView.attributes([{
      "required": domView.text([])
    }]) : '')], [], false)], false), fileLink(i), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_up_to_20_mb_reference_pdfs_are_client_facing_add_only_documents_you_intend_to_share", {
      v12: id ? tr("studio_leave_empty_to_keep_the_attached_file") : ''
    })], false), domView.element("label", [], [tr("studio_order"), domView.element("input", [{
      "name": "position"
    }, {
      "type": "number"
    }, {
      "min": "0"
    }, {
      "max": "999"
    }, {
      "value": i.position
    }], [], false)], false), domView.element("label", [{
      "class": "checkbox-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "default_enabled"
    }, domView.spread(i.default_enabled ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), domView.fragment([" ", tr("studio_include_in_new_projects_by_default")])], false), footer(tr("studio_save_template"))], false));
  }
  async function slidePicker() {
    const iteration = state.data.iteration.id, r = await api('project_starting_pack', {
      iteration
    });
    selection = {
      iteration,
      snapshot: r.snapshot
    };
    const available = r.available_slides || [];
    return available.length ? domView.element("div", [{
      "class": "pack-slide-picker"
    }], [domView.element("p", [], [tr("studio_add_an_editable_copy_of_a_slide_this_project_does_not_have_yet")], false), domView.element("form", [{
      "data-form": "pack-add-slide"
    }], [domView.element("label", [], [tr("studio_studio_slide"), domView.element("select", [{
      "name": "version_id"
    }, {
      "required": domView.text([])
    }], [domView.join(available.map(i => domView.element("option", [{
      "value": i.version_id
    }], [domView.fragment([i.preview_title, " · ", label(i)])], false)), '')], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_welcome_and_contact_templates_fill_the_default_opening_or_contact_text")], false), footer(tr("studio_add_template_slide"))], false)], false) : '';
  }
  async function action(a, el) {
    if (a === 'pack-download') {
      const response = await platformFetch(new URLSearchParams({
        action: 'pack_file',
        version: el.dataset.version
      }), {
        headers: {
          'X-Studio-ID': state.studio.id
        }
      });
      if (!response.ok) throw Error(tr("studio_this_template_file_is_unavailable"));
      const url = URL.createObjectURL(await response.blob()), link = document.createElement('a');
      link.download = el.dataset.name;
      link.href = safeUrl(url, 'href', link.download !== undefined && link.hasAttribute?.("download"));
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    if (a === 'pack-library') await library();
    if (a === 'pack-new-slide') edit();
    if (a === 'pack-new-document') edit('', 'document');
    if (a === 'pack-edit') edit(el.dataset.id);
    if (a === 'pack-archive') {
      const i = items.find(i => i.id === el.dataset.id);
      openModal(tr("studio_archive_studio_template"), domView.fragment([domView.element("p", [], [domView.fragment([tr("studio_remove_2"), " "]), domView.element("strong", [], [i.title], false), domView.fragment([" ", tr("studio_from_future_projects_existing_project_copies_stay_available")])], false), domView.element("form", [{
        "data-form": "pack-archive"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "id"
      }, {
        "value": i.id
      }], [], false), footer(tr("studio_archive_template"))], false)]));
    }
    if (a === 'pack-examples') {
      el.disabled = true;
      try {
        for (const [slide_type, title, body, position] of [['intro', tr("studio_welcome_to"), tr("studio_a_considered_design_journey_together_with"), 0], ['text', tr("studio_our_process"), tr("studio_discover_design_refine_we_ll_develop_your_ideas_together_and_use_this_presentation_to_review_the_des"), 10], ['contacts', tr("studio_let_s_talk"), tr("studio_your_designer"), 90]]) await api('save_pack_item', {
          kind: 'slide',
          slide_type,
          title,
          body,
          position,
          default_enabled: true
        });
        await library();
      } finally {
        el.disabled = false;
      }
    }
  }
  async function submit(type, form) {
    if (type === 'pack-item') {
      const data = new FormData(form);
      if (!data.get('file')?.size) data.delete('file');
      await api('save_pack_item', data);
      await library();
      toast(tr("studio_studio_template_saved_existing_projects_keep_their_copies"));
    }
    if (type === 'pack-archive') {
      await api('archive_pack_item', Object.fromEntries(new FormData(form)));
      await library();
    }
    if (type === 'pack-add-slide') {
      await api('add_project_pack_slide', {
        ...selection,
        version_id: new FormData(form).get('version_id')
      });
      closeModal();
      await refresh(true);
      toast(tr("studio_studio_slide_added"));
    }
  }
  function wizard(items, selected) {
    return items.length ? domView.element("details", [{
      "class": "pack-wizard"
    }], [domView.element("summary", [], [tr("studio_studio_starting_pack_selected", {
      v0: selected.length
    })], false), domView.element("p", [{
      "class": "form-hint"
    }], [tr("studio_editable_slide_copies_and_client_reference_pdfs_choose_what_suits_this_project")], false), domView.join(items.map(i => domView.element("label", [{
      "class": "checkbox-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "pack_version"
    }, {
      "value": i.version_id
    }, domView.spread(selected.includes(i.version_id) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), domView.element("span", [], [i.title, domView.element("small", [], [domView.fragment([label(i), " · v", i.revision])], false)], false)], false)), '')], false) : '';
  }
  return {
    action,
    submit,
    wizard,
    slidePicker
  };
}
