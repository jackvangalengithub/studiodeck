import * as domView from "./render.js";
import {getLanguage, tr} from './i18n.js';
const words = {
  'Search conversations': 'Zoek gesprekken',
  'Filter thread types': 'Filter gesprekstypen',
  'Choose which types appear in your communication list.': 'Kies welke typen in je communicatielijst verschijnen.',
  'All thread types shown': 'Alle gesprekstypen worden getoond',
  'types selected': 'typen geselecteerd',
  'Thread types': 'Gesprekstypen',
  'Previous': 'Vorige',
  'Next': 'Volgende',
  'Page': 'Pagina',
  'of': 'van',
  'threads': 'gesprekken',
  'No matching conversations': 'Geen overeenkomende gesprekken',
  'Try a different search or include more thread types.': 'Probeer een andere zoekterm of selecteer meer gesprekstypen.',
  'Clear search and filters': 'Wis zoekopdracht en filters',
  'You’re all caught up': 'Je bent helemaal bij',
  'Nothing needs your attention right now. A little room to focus on what’s next.': 'Op dit moment heeft niets je aandacht nodig. Even ruimte om je te richten op wat volgt.',
  'Nothing left open': 'Er staat niets meer open',
  'No open conversations, to dos or approvals in this view.': 'Geen open gesprekken, taken of akkoordverzoeken in deze weergave.',
  'A little space for the next idea': 'Ruimte voor het volgende idee',
  'Conversations, to dos and approvals will find a home here.': 'Gesprekken, taken en akkoordverzoeken krijgen hier een plek.',
  'View all conversations': 'Bekijk alle gesprekken'
};
const text = s => getLanguage() === 'nl' ? words[s] || s : s;
const types = ['conversation', 'todo', 'approval'];
const illustration = domView.element("svg", [{
  "class": "comm-empty-art"
}, {
  "viewBox": "0 0 260 170"
}, {
  "fill": "none"
}, {
  "aria-hidden": "true"
}], [domView.element("ellipse", [{
  "cx": "132"
}, {
  "cy": "148"
}, {
  "rx": "84"
}, {
  "ry": "9"
}, {
  "fill": "currentColor"
}, {
  "opacity": ".045"
}], [], true), domView.element("circle", [{
  "cx": "130"
}, {
  "cy": "80"
}, {
  "r": "65"
}, {
  "fill": "currentColor"
}, {
  "opacity": ".025"
}], [], true), domView.element("g", [{
  "transform": "rotate(-10 72 83)"
}], [domView.element("rect", [{
  "x": "25"
}, {
  "y": "40"
}, {
  "width": "98"
}, {
  "height": "76"
}, {
  "rx": "15"
}, {
  "fill": "var(--surface,#fff)"
}, {
  "stroke": "#3976a0"
}, {
  "stroke-opacity": ".25"
}], [], true), domView.element("rect", [{
  "x": "39"
}, {
  "y": "54"
}, {
  "width": "24"
}, {
  "height": "6"
}, {
  "rx": "3"
}, {
  "fill": "#3976a0"
}, {
  "opacity": ".55"
}], [], true), domView.element("path", [{
  "d": "M40 76h65M40 87h43"
}, {
  "stroke": "#3976a0"
}, {
  "stroke-opacity": ".2"
}, {
  "stroke-width": "5"
}, {
  "stroke-linecap": "round"
}], [], true)], true), domView.element("g", [{
  "transform": "rotate(10 184 80)"
}], [domView.element("rect", [{
  "x": "148"
}, {
  "y": "39"
}, {
  "width": "81"
}, {
  "height": "86"
}, {
  "rx": "15"
}, {
  "fill": "var(--surface,#fff)"
}, {
  "stroke": "#96701f"
}, {
  "stroke-opacity": ".3"
}], [], true), domView.element("rect", [{
  "x": "161"
}, {
  "y": "53"
}, {
  "width": "23"
}, {
  "height": "6"
}, {
  "rx": "3"
}, {
  "fill": "#96701f"
}, {
  "opacity": ".5"
}], [], true), domView.element("path", [{
  "d": "M164 77h46M164 89h32"
}, {
  "stroke": "#96701f"
}, {
  "stroke-opacity": ".2"
}, {
  "stroke-width": "5"
}, {
  "stroke-linecap": "round"
}], [], true)], true), domView.element("rect", [{
  "x": "77"
}, {
  "y": "65"
}, {
  "width": "108"
}, {
  "height": "73"
}, {
  "rx": "16"
}, {
  "fill": "var(--surface,#fff)"
}, {
  "stroke": "#36795c"
}, {
  "stroke-opacity": ".3"
}], [], true), domView.element("path", [{
  "d": "M104 137l-5 11 23-11"
}, {
  "fill": "var(--surface,#fff)"
}], [], true), domView.element("path", [{
  "d": "M104 137l-5 11 23-11"
}, {
  "stroke": "#36795c"
}, {
  "stroke-opacity": ".3"
}, {
  "stroke-linejoin": "round"
}], [], true), domView.element("circle", [{
  "cx": "111"
}, {
  "cy": "101"
}, {
  "r": "4"
}, {
  "fill": "#3976a0"
}, {
  "opacity": ".6"
}], [], true), domView.element("circle", [{
  "cx": "131"
}, {
  "cy": "101"
}, {
  "r": "4"
}, {
  "fill": "#96701f"
}, {
  "opacity": ".6"
}], [], true), domView.element("circle", [{
  "cx": "151"
}, {
  "cy": "101"
}, {
  "r": "4"
}, {
  "fill": "#36795c"
}, {
  "opacity": ".6"
}], [], true), domView.element("path", [{
  "d": "M127 22v8M123 26h8M231 113v6M228 116h6"
}, {
  "stroke": "currentColor"
}, {
  "opacity": ".2"
}, {
  "stroke-width": "2"
}, {
  "stroke-linecap": "round"
}], [], true)], true);
export function createCommunicationControls({id, esc, icon, typeLabel, openModal, onChange, onError, onViewAll}) {
  let search = '', selected = null, sort = 'newest', offset = 0, timer;
  const limit = 25;
  const active = () => selected !== null;
  const summary = () => active() ? domView.text(["", selected.size, " / ", types.length, " ", text('types selected'), ""]) : text('All thread types shown');
  const owns = element => element?.dataset.commOwner === id;
  function renderPreservingSearch(render) {
    const input = document.activeElement, mine = input?.dataset.commSearch === id, start = mine ? input.selectionStart : null, end = mine ? input.selectionEnd : null;
    render();
    if (mine) {
      const next = document.querySelector(domView.text(["[data-comm-search=\"", id, "\"]"]));
      next?.focus({
        preventScroll: true
      });
      if (start !== null) next?.setSelectionRange(start, end);
    }
  }
  async function update(reset = true) {
    clearTimeout(timer);
    if (reset) offset = 0;
    const status = document.querySelector(domView.text(["[data-comm-filter-status=\"", id, "\"]"]));
    if (status) status.textContent = summary();
    try {
      await onChange();
    } catch (error) {
      onError(error.message);
    }
  }
  function filterModal() {
    openModal(text('Filter thread types'), domView.fragment([domView.element("p", [], [text('Choose which types appear in your communication list.')], false), domView.element("div", [{
      "class": "row slide-filter-actions"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "class": "button small"
    }, {
      "data-comm-owner": id
    }, {
      "data-comm-select": "all"
    }], [tr('studio_select_all')], false), domView.element("button", [{
      "type": "button"
    }, {
      "class": "button small"
    }, {
      "data-comm-owner": id
    }, {
      "data-comm-select": "none"
    }], [tr('studio_clear_selection')], false)], false), domView.element("fieldset", [{
      "class": "slide-type-options comm-filter-options"
    }], [domView.element("legend", [{
      "class": "sr-only"
    }], [text('Thread types')], false), domView.join(types.map(type => domView.element("label", [{
      "class": "check-label"
    }, {
      "data-thread-type": type
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "data-comm-owner": id
    }, {
      "data-comm-type": type
    }, domView.spread(!selected || selected.has(type) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), domView.element("i", [{
      "class": "comm-type-dot"
    }, {
      "aria-hidden": "true"
    }], [], false), domView.element("span", [], [typeLabel(type)], false)], false)), '')], false), domView.element("p", [{
      "class": "form-hint"
    }, {
      "data-comm-filter-status": id
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
    }], [tr('studio_done')], false)], false)]));
  }
  document.addEventListener('click', event => {
    const el = event.target.closest('[data-comm-owner]');
    if (!owns(el)) return;
    if (el.hasAttribute('data-comm-filter')) filterModal();
    if (el.hasAttribute('data-comm-select')) {
      selected = el.dataset.commSelect === 'all' ? null : new Set();
      document.querySelectorAll(domView.text(["[data-comm-owner=\"", id, "\"][data-comm-type]"])).forEach(input => input.checked = !selected);
      update();
    }
    if (el.hasAttribute('data-comm-sort')) {
      sort = sort === 'newest' ? 'oldest' : 'newest';
      update();
    }
    if (el.hasAttribute('data-comm-page')) {
      offset = Math.max(0, Number(el.dataset.commPage) || 0);
      update(false);
    }
    if (el.hasAttribute('data-comm-reset')) {
      search = '';
      selected = null;
      update();
    }
    if (el.hasAttribute('data-comm-show-all')) {
      offset = 0;
      Promise.resolve(onViewAll()).catch(error => onError(error.message));
    }
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (!owns(input) || !input.hasAttribute('data-comm-type')) return;
    if (!selected) selected = new Set(types);
    if (input.checked) selected.add(input.dataset.commType); else selected.delete(input.dataset.commType);
    if (selected.size === types.length) selected = null;
    update();
  });
  document.addEventListener('input', event => {
    if (event.target.dataset.commSearch !== id) return;
    search = event.target.value;
    offset = 0;
    clearTimeout(timer);
    timer = setTimeout(() => update(), 180);
  });
  return {
    get search() {
      return search.trim();
    },
    get sort() {
      return sort;
    },
    get offset() {
      return offset;
    },
    get limit() {
      return limit;
    },
    get params() {
      return {
        search: search.trim(),
        types: selected === null ? 'all' : selected.size ? domView.join([...selected], ',') : 'none',
        sort,
        offset,
        limit
      };
    },
    accepts(type) {
      return !selected || selected.has(type);
    },
    restore(params = {}) {
      clearTimeout(timer);
      search = params.search || '';
      selected = !params.types || params.types === 'all' ? null : new Set(params.types === 'none' ? [] : params.types.split(',').filter(t => types.includes(t)));
      sort = params.sort === 'oldest' ? 'oldest' : 'newest';
      offset = Math.max(0, Number(params.offset) || 0);
    },
    reset() {
      clearTimeout(timer);
      search = '';
      selected = null;
      sort = 'newest';
      offset = 0;
    },
    selectTypes(values) {
      selected = values.length === types.length ? null : new Set(values);
      offset = 0;
    },
    firstPage() {
      offset = 0;
    },
    setOffset(value) {
      offset = Math.max(0, value);
    },
    clamp(total) {
      offset = Math.min(offset, Math.max(0, Math.ceil(total / limit) - 1) * limit);
    },
    render: renderPreservingSearch,
    toolbar() {
      return domView.element("div", [{
        "class": "comm-list-tools"
      }], [domView.element("label", [{
        "class": "comm-search"
      }], [icon('search'), domView.element("input", [{
        "type": "text"
      }, {
        "inputmode": "search"
      }, {
        "maxlength": "200"
      }, {
        "data-comm-search": id
      }, {
        "value": search
      }, {
        "placeholder": text('Search conversations')
      }, {
        "aria-label": text('Search conversations')
      }], [], false)], false), domView.element("button", [{
        "type": "button"
      }, {
        "class": domView.text(["icon-button slide-type-filter ", active() ? 'is-active' : ''])
      }, {
        "data-comm-owner": id
      }, {
        "data-comm-filter": domView.text([])
      }, {
        "aria-label": text('Filter thread types')
      }, {
        "title": summary()
      }, {
        "aria-haspopup": "dialog"
      }], [domView.fragment([icon('filter'), active() ? domView.element("span", [{
        "class": "slide-filter-dot"
      }, {
        "aria-hidden": "true"
      }], [], false) : ''])], false), domView.element("button", [{
        "type": "button"
      }, {
        "class": "button comm-sort"
      }, {
        "data-comm-owner": id
      }, {
        "data-comm-sort": domView.text([])
      }, {
        "title": tr(sort === 'newest' ? 'switch_sort_oldest' : 'switch_sort_newest')
      }], [icon(sort === 'newest' ? 'down' : 'up'), domView.element("span", [], [tr(sort === 'newest' ? 'newest_first' : 'oldest_first')], false)], false)], false);
    },
    pagination(total) {
      if (!total) return '';
      const page = domView.concat(Math.floor(offset / limit), 1), pages = Math.ceil(total / limit);
      return domView.element("nav", [{
        "class": "comm-pagination"
      }, {
        "aria-label": text('Page')
      }], [domView.element("span", [{
        "role": "status"
      }], [domView.fragment([domView.concat(offset, 1), "–", Math.min(domView.concat(offset, limit), total), " ", text('of'), " ", total, " ", text('threads')])], false), pages > 1 ? domView.element("div", [], [domView.element("button", [{
        "type": "button"
      }, {
        "class": "button small"
      }, {
        "data-comm-owner": id
      }, {
        "data-comm-page": offset - limit
      }, domView.spread(offset === 0 ? domView.attributes([{
        "disabled": domView.text([])
      }]) : '')], [domView.fragment([icon('left'), text('Previous')])], false), domView.element("small", [], [domView.fragment([text('Page'), " ", page, " ", text('of'), " ", pages])], false), domView.element("button", [{
        "type": "button"
      }, {
        "class": "button small"
      }, {
        "data-comm-owner": id
      }, {
        "data-comm-page": domView.concat(offset, limit)
      }, domView.spread(page >= pages ? domView.attributes([{
        "disabled": domView.text([])
      }]) : '')], [domView.fragment([text('Next'), icon('right')])], false)], false) : ''], false);
    },
    empty(view, action = '') {
      const filtered = search.trim() || active(), title = filtered ? 'No matching conversations' : view === 'attention' ? 'You’re all caught up' : view === 'open' ? 'Nothing left open' : 'A little space for the next idea', description = filtered ? 'Try a different search or include more thread types.' : view === 'attention' ? 'Nothing needs your attention right now. A little room to focus on what’s next.' : view === 'open' ? 'No open conversations, to dos or approvals in this view.' : 'Conversations, to dos and approvals will find a home here.';
      return domView.element("section", [{
        "class": "comm-empty-state"
      }], [illustration, domView.element("h2", [], [text(title)], false), domView.element("p", [], [text(description)], false), filtered ? domView.element("button", [{
        "class": "button small"
      }, {
        "type": "button"
      }, {
        "data-comm-owner": id
      }, {
        "data-comm-reset": domView.text([])
      }], [text('Clear search and filters')], false) : view !== 'all' ? domView.element("button", [{
        "class": "button small"
      }, {
        "type": "button"
      }, {
        "data-comm-owner": id
      }, {
        "data-comm-show-all": domView.text([])
      }], [text('View all conversations')], false) : action], false);
    }
  };
}
