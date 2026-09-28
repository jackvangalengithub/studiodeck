import * as domView from "./render.js";
import {tr} from './i18n.js';
export function createSlideTypeFilter({types, openModal, closeModal, getSelected, onApply, onError}) {
  const currentTypes = () => typeof types === 'function' ? types() : types;
  let draft = null;
  const esc = value => String(value ?? '');
  const active = () => getSelected() !== null;
  const summary = selected => selected !== null ? tr('studio_of_types_selected', {
    v0: selected.length,
    v1: Object.keys(currentTypes()).length
  }) : tr('studio_all_slide_types_shown');
  function options() {
    return domView.element("fieldset", [{
      "class": "slide-type-options"
    }], [domView.element("legend", [{
      "class": "sr-only"
    }], [tr('studio_slide_types')], false), domView.join(Object.entries(currentTypes()).map(([type, label]) => domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "data-slide-type": type
    }, domView.spread(draft === null || draft.includes(type) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), domView.element("span", [], [label], false)], false)), '')], false);
  }
  function update() {
    const status = document.querySelector('[data-slide-filter-status]');
    if (status) status.textContent = summary(draft);
  }
  async function apply(value, button) {
    const modal = button?.closest('[role="dialog"]');
    if (button) button.disabled = true;
    try {
      if (await onApply(value) !== false && modal?.isConnected) closeModal();
    } catch (error) {
      onError(error);
    } finally {
      if (button) button.disabled = false;
    }
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-slide-filter-open]')) {
      draft = getSelected() === null ? null : [...getSelected()];
      openModal(tr('studio_filter_slide_types'), domView.fragment([domView.element("p", [], [tr('studio_choose_the_types_to_show_in_the_editor_your_presentation_stays_unchanged')], false), domView.element("div", [{
        "class": "row slide-filter-actions"
      }], [domView.element("button", [{
        "type": "button"
      }, {
        "class": "button small"
      }, {
        "data-slide-filter-select": "all"
      }], [tr('studio_select_all')], false), domView.element("button", [{
        "type": "button"
      }, {
        "class": "button small"
      }, {
        "data-slide-filter-select": "none"
      }], [tr('studio_clear_selection')], false)], false), options(), domView.element("p", [{
        "class": "form-hint"
      }, {
        "data-slide-filter-status": domView.text([])
      }, {
        "role": "status"
      }], [summary(draft)], false), domView.element("div", [{
        "class": "modal-footer"
      }], [domView.element("button", [{
        "type": "button"
      }, {
        "class": "button primary"
      }, {
        "data-slide-filter-apply": domView.text([])
      }], [tr('studio_done')], false)], false)]));
    }
    const select = e.target.closest('[data-slide-filter-select]');
    if (select) {
      draft = select.dataset.slideFilterSelect === 'all' ? null : [];
      const inputs = document.querySelectorAll('[data-slide-type]');
      if (inputs.length) {
        inputs.forEach(input => input.checked = draft === null);
        update();
      } else apply(draft, select);
    }
    const submit = e.target.closest('[data-slide-filter-apply]');
    if (submit) apply(draft === null ? null : [...draft], submit);
  });
  document.addEventListener('change', e => {
    if (!e.target.matches('[data-slide-type]')) return;
    draft = [...document.querySelectorAll('[data-slide-type]:checked')].map(input => input.dataset.slideType);
    if (draft.length === Object.keys(currentTypes()).length) draft = null;
    update();
  });
  return {
    button() {
      return domView.element("button", [{
        "type": "button"
      }, {
        "class": domView.text(["icon-button slide-type-filter ", active() ? 'is-active' : ''])
      }, {
        "data-slide-filter-open": domView.text([])
      }, {
        "aria-label": tr('studio_filter_slide_types_2', {
          v1: active() ? ' — active' : ''
        })
      }, {
        "title": active() ? summary(getSelected()) : tr('studio_filter_slide_types')
      }, {
        "aria-haspopup": "dialog"
      }], [domView.element("svg", [{
        "class": "icon"
      }, {
        "viewBox": "0 0 24 24"
      }, {
        "aria-hidden": "true"
      }], [domView.element("path", [{
        "d": "M3 4h18l-7 8v7l-4 2v-9z"
      }], [], true)], true), active() ? domView.element("span", [{
        "class": "slide-filter-dot"
      }, {
        "aria-hidden": "true"
      }], [], false) : ''], false);
    },
    empty() {
      return active() ? domView.element("p", [{
        "class": "notice"
      }], [domView.fragment([tr('studio_no_slides_match_these_types_in_this_group'), " "]), domView.element("button", [{
        "type": "button"
      }, {
        "class": "text-button"
      }, {
        "data-slide-filter-select": "all"
      }], [tr('studio_show_all_slide_types')], false)], false) : domView.element("p", [{
        "class": "notice"
      }], [tr('studio_no_slides_in_this_group_choose_all_slides_or_drag_slides_onto_the_group_label')], false);
    }
  };
}
