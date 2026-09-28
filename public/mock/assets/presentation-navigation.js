import * as domView from "../../assets/render.js";
import {tr} from './i18n.js';
let observer, events, pinned = false, opened = false;
export function presentationSidebar(groups, controls, {branding, identity, actions}) {
  return domView.element("aside", [{
    "class": "presentation-sidebar"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "presentation-sidebar-handle"
  }, {
    "aria-label": tr('show_presentation_navigation')
  }, {
    "aria-controls": "presentation-sidebar-content"
  }, {
    "aria-expanded": "false"
  }], [domView.element("span", [], [], false)], false), domView.element("div", [{
    "class": "presentation-sidebar-content"
  }, {
    "id": "presentation-sidebar-content"
  }], [domView.element("div", [{
    "class": "presentation-sidebar-heading"
  }], [branding, domView.element("button", [{
    "type": "button"
  }, {
    "class": "icon-button presentation-sidebar-pin"
  }, {
    "aria-label": tr('pin_presentation_navigation')
  }, {
    "aria-pressed": "false"
  }], [domView.element("svg", [{
    "class": "icon"
  }, {
    "viewBox": "0 0 24 24"
  }, {
    "fill": "none"
  }, {
    "stroke": "currentColor"
  }, {
    "stroke-width": "1.6"
  }, {
    "aria-hidden": "true"
  }], [domView.element("path", [{
    "d": "m9 3 6 0-1 6 4 4v2H6v-2l4-4-1-6ZM12 15v7"
  }], [], true)], true)], false)], false), domView.element("div", [{
    "class": "presentation-sidebar-scroll"
  }], [identity, domView.element("div", [{
    "class": "presentation-sidebar-actions"
  }], [actions], false), domView.element("strong", [{
    "class": "presentation-sidebar-section-label"
  }], [tr('presentation_sections')], false), domView.element("nav", [{
    "class": "section-index presentation-section-index"
  }, {
    "aria-label": tr('presentation_sections')
  }], [groups], false)], false), domView.element("div", [{
    "class": "presentation-slide-navigation"
  }, {
    "aria-label": tr('slide_navigation')
  }], [controls], false)], false)], false);
}
function syncSidebar(presentation) {
  const sidebar = presentation.querySelector('.presentation-sidebar'), content = sidebar.querySelector('.presentation-sidebar-content'), handle = sidebar.querySelector('.presentation-sidebar-handle'), pin = sidebar.querySelector('.presentation-sidebar-pin'), rail = sidebar.querySelector('.presentation-sidebar-scroll');
  const signal = events.signal;
  const update = () => {
    const visible = pinned || opened;
    presentation.classList.toggle('navigation-pinned', pinned);
    sidebar.classList.toggle('is-open', visible);
    content.inert = !visible;
    content.setAttribute('aria-hidden', String(!visible));
    handle.setAttribute('aria-expanded', String(visible));
    handle.setAttribute('aria-label', tr(visible ? 'hide_presentation_navigation' : 'show_presentation_navigation'));
    pin.setAttribute('aria-pressed', String(pinned));
    pin.title = tr(pinned ? 'unpin_presentation_navigation' : 'pin_presentation_navigation');
    pin.setAttribute('aria-label', pin.title);
  };
  sidebar.addEventListener('presentation-navigation-guide', event => {
    opened = event.detail;
    update();
  }, {
    signal
  });
  const close = () => {
    if (sidebar.contains(document.activeElement) && document.activeElement.matches(':focus-visible') || document.querySelector('#section-slide-menu') || sidebar.querySelector('[aria-describedby="app-tour-instruction"]')) return;
    opened = false;
    update();
  };
  sidebar.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') {
      opened = true;
      update();
    }
  }, {
    signal
  });
  sidebar.addEventListener('pointerleave', close, {
    signal
  });
  sidebar.addEventListener('focusout', event => {
    if (!sidebar.contains(event.relatedTarget)) setTimeout(() => {
      if (sidebar.isConnected) close();
    }, 0);
  }, {
    signal
  });
  document.addEventListener('pointermove', event => {
    if (opened && !sidebar.contains(event.target)) close();
  }, {
    signal,
    passive: true
  });
  handle.addEventListener('click', () => {
    opened = !opened;
    update();
  }, {
    signal
  });
  pin.addEventListener('click', () => {
    pinned = !pinned;
    opened = true;
    update();
  }, {
    signal
  });
  document.addEventListener('pointerdown', event => {
    if (!sidebar.contains(event.target) && !event.target.closest('#section-slide-menu')) {
      if (sidebar.contains(document.activeElement)) document.activeElement.blur();
      opened = false;
      update();
    }
  }, {
    signal
  });
  sidebar.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !pinned) {
      event.preventDefault();
      event.stopPropagation();
      opened = false;
      handle.focus();
      update();
    }
  }, {
    signal
  });
  const preview = presentation.querySelector('.preview-bar');
  const measure = () => presentation.style.setProperty('--presentation-sidebar-top', domView.text(["", preview?.offsetHeight || 0, "px"]));
  observer = new ResizeObserver(measure);
  if (preview) observer.observe(preview);
  update();
  measure();
  const active = rail.querySelector('[aria-current="true"]');
  if (active) {
    const row = active.closest('.section-split') || active;
    rail.scrollTop = Math.max(0, domView.concat(row.offsetTop, row.offsetHeight) - rail.offsetTop - rail.clientHeight);
  }
}
export function syncPresentationNavigation() {
  observer?.disconnect();
  events?.abort();
  events = new AbortController();
  const deck = document.querySelector('.presentation');
  if (deck?.querySelector('.presentation-sidebar')) {
    syncSidebar(deck);
    return;
  }
  opened = false;
  const presentation = document.querySelector('.presentation'), chrome = presentation?.querySelector('.presentation-chrome-top') || document.querySelector('.editor-section-index'), rail = chrome?.querySelector('.presentation-section-index,.editor-group-list');
  if (!rail) return;
  const back = chrome.querySelector('[data-group-scroll="-1"]'), forward = chrome.querySelector('[data-group-scroll="1"]');
  const update = () => {
    const overflow = rail.scrollWidth > domView.concat(rail.clientWidth, 2);
    back.hidden = !overflow || rail.scrollLeft <= 2;
    forward.hidden = !overflow || domView.concat(rail.scrollLeft, rail.clientWidth) >= rail.scrollWidth - 2;
    presentation?.style.setProperty('--presentation-toolbar-height', domView.text(["", chrome.offsetHeight, "px"]));
  };
  const revealActive = () => {
    const selected = rail.querySelector('[aria-current="true"]');
    if (!selected) return;
    const target = selected.closest('.section-split,.slide-group') || selected, r = rail.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (b.left < domView.concat(r.left, 22)) rail.scrollLeft -= domView.concat(r.left, 22) - b.left; else if (b.right > r.right - 22) rail.scrollLeft += b.right - (r.right - 22);
  };
  for (const button of [back, forward]) button.addEventListener('click', () => rail.scrollBy({
    left: Number(button.dataset.groupScroll) * Math.max(100, rail.clientWidth * .7),
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  }));
  rail.addEventListener('scroll', update, {
    passive: true
  });
  rail.addEventListener('focusin', event => {
    const b = event.target.getBoundingClientRect(), r = rail.getBoundingClientRect();
    if (b.left < domView.concat(r.left, 22)) rail.scrollLeft -= domView.concat(r.left, 22) - b.left; else if (b.right > r.right - 22) rail.scrollLeft += domView.concat(b.right - r.right, 22);
  });
  observer = new ResizeObserver(() => {
    revealActive();
    update();
  });
  observer.observe(chrome);
  observer.observe(rail);
  revealActive();
  update();
}
