import * as domView from "./render.js";
import {tr} from './i18n.js';
import {composerText, threadTypes} from './communication-composer.js';
import {presentationThreads} from './presentation-view.js';
export function openItemsUi({state, esc, icon, render}) {
  let scope = '', views = new Map();
  function resetScope() {
    const next = domView.concat(domView.concat(state.data.project.id, ':'), state.data.iteration.id);
    if (next !== scope) {
      scope = next;
      views = new Map();
    }
  }
  function row(item) {
    const personLabel = item.type === 'todo' ? composerText('Responsible') : composerText('Waiting for');
    const typeLabel = composerText(threadTypes.find(([type]) => type === item.type)?.[1] || 'Conversation');
    return domView.element("button", [{
      "type": "button"
    }, {
      "class": "open-items-row"
    }, {
      "data-action": "comm-open"
    }, {
      "data-id": item.id
    }, {
      "data-thread-type": item.type
    }], ["\n   ", domView.element("span", [{
      "class": "open-items-type"
    }], [domView.element("i", [{
      "aria-hidden": "true"
    }], [], false), typeLabel], false), "\n   ", domView.element("span", [{
      "class": "open-items-subject"
    }], [domView.element("strong", [], [item.title], false), domView.element("small", [], [domView.fragment([tr('iteration'), " ", item.iteration, item.slide ? domView.concat(' · ', item.slide) : ''])], false)], false), "\n   ", domView.element("span", [{
      "class": "open-items-person"
    }], [item.person ? domView.fragment([domView.element("small", [], [personLabel], false), domView.element("span", [], [item.person], false)]) : domView.element("span", [{
      "class": "muted"
    }], [tr('open_items_unassigned')], false)], false), "\n   ", domView.element("span", [{
      "class": domView.text(["open-items-status ", item.open ? '' : 'is-complete'])
    }], [tr(domView.concat('open_items_status_', item.status))], false), "\n   ", domView.element("span", [{
      "class": "open-items-arrow"
    }, {
      "aria-hidden": "true"
    }], [icon('right')], false), "\n  "], false);
  }
  function slide(def) {
    resetScope();
    const all = presentationThreads(state.data), view = views.get(def.id) || 'open';
    const open = all.filter(item => item.open), done = all.filter(item => !item.open), items = view === 'open' ? open : done;
    const tabs = [['open', tr('open_items_tab_open'), open.length], ['completed', tr('open_items_tab_completed'), done.length]];
    return domView.element("section", [{
      "class": "open-questions-slide open-items-slide"
    }, {
      "data-open-items-slide": def.id
    }], ["\n   ", domView.element("p", [{
      "class": "slide-label"
    }], [tr('checklist_eyebrow')], false), domView.element("h1", [{
      "class": "slide-heading"
    }], [def.title], false), "\n   ", domView.element("p", [{
      "class": "slide-description"
    }], [def.description || tr('open_items_intro')], false), "\n   ", domView.element("div", [{
      "class": "open-items-tabs"
    }, {
      "role": "tablist"
    }, {
      "aria-label": tr('open_items_tabs')
    }], [domView.join(tabs.map(([key, label, count]) => domView.element("button", [{
      "type": "button"
    }, {
      "role": "tab"
    }, {
      "id": domView.text(["open-items-", def.id, "-", key])
    }, {
      "aria-controls": domView.text(["open-items-", def.id, "-panel"])
    }, {
      "aria-selected": view === key
    }, {
      "tabindex": view === key ? 0 : -1
    }, {
      "data-action": "open-items-view"
    }, {
      "data-slide": def.id
    }, {
      "data-view": key
    }], [label, domView.element("span", [], [count], false)], false)), '')], false), "\n   ", domView.element("div", [{
      "class": "open-items-list"
    }, {
      "role": "tabpanel"
    }, {
      "id": domView.text(["open-items-", def.id, "-panel"])
    }, {
      "aria-labelledby": domView.text(["open-items-", def.id, "-", view])
    }, {
      "tabindex": "0"
    }], [domView.join(items.map(row), '') || domView.element("p", [{
      "class": "open-items-empty"
    }], [tr(view === 'open' ? 'open_items_empty' : 'open_items_completed_empty')], false)], false), "\n  "], false);
  }
  function select(el) {
    resetScope();
    const view = el.dataset.view === 'completed' ? 'completed' : 'open';
    views.set(el.dataset.slide, view);
    render();
    document.querySelector(domView.text(["[data-open-items-slide=\"", CSS.escape(el.dataset.slide), "\"] [data-view=\"", view, "\"]"]))?.focus({
      preventScroll: true
    });
  }
  document.addEventListener('keydown', event => {
    const tab = event.target.closest('[data-action="open-items-view"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const tabs = [...tab.parentElement.querySelectorAll('[role=tab]')];
    select(tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : domView.concat(tabs.indexOf(tab), 1) % tabs.length]);
  }, true);
  return {
    slide,
    select
  };
}
