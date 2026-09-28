import * as domView from "../../assets/render.js";
import {tr} from './i18n.js';
export function createSlideTypeFilter({types, openModal, render}) {
  const currentTypes = () => typeof types === 'function' ? types() : types;
  let selected = null, project = null;
  const esc = value => String(value ?? '');
  const active = () => selected !== null;
  function options() {
    return domView.element("fieldset", [{
      "class": "slide-type-options"
    }], [domView.element("legend", [{
      "class": "sr-only"
    }], [tr("studio_slide_types")], false), domView.join(Object.entries(currentTypes()).map(([type, label]) => domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "data-slide-type": type
    }, domView.spread(!selected || selected.has(type) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), domView.element("span", [], [label], false)], false)), '')], false);
  }
  function summary() {
    return active() ? tr("studio_of_types_selected", {
      v0: selected.size,
      v1: Object.keys(currentTypes()).length
    }) : tr("studio_all_slide_types_shown");
  }
  function update() {
    render();
    const status = document.querySelector('[data-slide-filter-status]');
    if (status) status.textContent = summary();
  }
  document.addEventListener('click', e => {
    if (e.target.closest('[data-slide-filter-open]')) openModal(tr("studio_filter_slide_types"), domView.fragment([domView.element("p", [], [tr("studio_choose_the_types_to_show_in_the_editor_your_presentation_stays_unchanged")], false), domView.element("div", [{
      "class": "row slide-filter-actions"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "class": "button small"
    }, {
      "data-slide-filter-select": "all"
    }], [tr("studio_select_all")], false), domView.element("button", [{
      "type": "button"
    }, {
      "class": "button small"
    }, {
      "data-slide-filter-select": "none"
    }], [tr("studio_clear_selection")], false)], false), options(), domView.element("p", [{
      "class": "form-hint"
    }, {
      "data-slide-filter-status": domView.text([])
    }, {
      "role": "status"
    }], [summary()], false), domView.element("div", [{
      "class": "modal-footer"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "class": "button primary"
    }, {
      "data-action": "close-modal"
    }], [tr("studio_done")], false)], false)]));
    const select = e.target.closest('[data-slide-filter-select]');
    if (select) {
      selected = select.dataset.slideFilterSelect === 'all' ? null : new Set();
      document.querySelectorAll('[data-slide-type]').forEach(input => input.checked = !selected);
      update();
    }
  });
  document.addEventListener('change', e => {
    const input = e.target.closest('[data-slide-type]');
    if (!input) return;
    if (!selected) selected = new Set(Object.keys(currentTypes()));
    if (input.checked) selected.add(input.dataset.slideType); else selected.delete(input.dataset.slideType);
    if (selected.size === Object.keys(currentTypes()).length) selected = null;
    update();
  });
  return {
    setProject(id) {
      if (project !== id) {
        project = id;
        selected = null;
      }
    },
    filter(slides) {
      return selected ? slides.filter(s => selected.has(s.type)) : slides;
    },
    button() {
      return domView.element("button", [{
        "type": "button"
      }, {
        "class": domView.text(["icon-button slide-type-filter ", active() ? 'is-active' : ''])
      }, {
        "data-slide-filter-open": domView.text([])
      }, {
        "aria-label": tr("studio_filter_slide_types_2", {
          v1: active() ? ' — active' : ''
        })
      }, {
        "title": active() ? summary() : tr("studio_filter_slide_types")
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
      }], [domView.fragment([tr("studio_no_slides_match_these_types_in_this_group"), " "]), domView.element("button", [{
        "type": "button"
      }, {
        "class": "text-button"
      }, {
        "data-slide-filter-select": "all"
      }], [tr("studio_show_all_slide_types")], false)], false) : domView.element("p", [{
        "class": "notice"
      }], [tr("studio_no_slides_in_this_group_choose_all_slides_or_drag_slides_onto_the_group_label")], false);
    }
  };
}
