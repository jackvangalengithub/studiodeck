import {setDomAttribute} from './dom.js';
import * as domView from "./render.js";
import {tr} from './i18n.js';
const esc = value => String(value ?? '');
export function presentationModeSwitch(mode) {
  return domView.element("div", [{
    "class": "presentation-mode-switch"
  }, {
    "role": "group"
  }, {
    "aria-label": tr('presentation_view')
  }], [domView.join(['slides', 'scroll'].map(view => domView.element("button", [{
    "type": "button"
  }, {
    "data-action": "presentation-mode"
  }, {
    "data-mode": view
  }, {
    "aria-pressed": mode === view
  }], [tr(domView.concat('presentation_view_', view))], false)), '')], false);
}
export function scrollPresentation({slides, groups, project, iteration, branding, preview, actions, navigation = '', content, footer}) {
  const chapters = Object.entries(groups).filter(([id]) => slides.some(slide => slide.section === id));
  return domView.element("div", [{
    "class": "presentation presentation-scroll"
  }, {
    "data-scroll-iteration": iteration
  }], ["\n  ", domView.element("header", [{
    "class": "scroll-header"
  }], [preview, domView.element("div", [{
    "class": "scroll-header-top"
  }], [domView.element("div", [{
    "class": "scroll-brand"
  }], [branding], false), domView.element("span", [{
    "class": "scroll-project-name"
  }], [project], false), presentationModeSwitch('scroll'), domView.element("div", [{
    "class": "scroll-header-actions"
  }], [actions], false)], false), "\n   ", domView.element("nav", [{
    "class": "scroll-chapters section-index"
  }, {
    "aria-label": tr('presentation_sections')
  }], [navigation], false), "\n   ", domView.element("div", [{
    "class": "scroll-progress"
  }, {
    "aria-hidden": "true"
  }], [domView.element("span", [], [], false)], false), "\n  "], false), "\n  ", domView.element("main", [{
    "id": "main"
  }, {
    "class": "scroll-story"
  }, {
    "tabindex": "-1"
  }], [domView.element("h1", [{
    "class": "sr-only"
  }], [project], false), domView.join(slides.map((slide, n) => {
    const chapterStart = n === 0 || slides[n - 1].section !== slide.section, chapter = chapters.findIndex(([id]) => id === slide.section);
    return domView.element("article", [{
      "class": domView.text(["scroll-section scroll-type-", slide.type])
    }, {
      "id": domView.text(["scroll-slide-", slide.id])
    }, {
      "data-scroll-slide": slide.id
    }, {
      "data-scroll-group": slide.section
    }, {
      "tabindex": "-1"
    }, {
      "aria-label": slide.title
    }], [domView.fragment(["\n    ", chapterStart ? domView.element("div", [{
      "class": "scroll-chapter-heading"
    }], [domView.element("span", [], [String(domView.concat(chapter, 1)).padStart(2, '0')], false), domView.element("h2", [], [groups[slide.section] || slide.section], false), domView.element("span", [{
      "class": "scroll-chapter-line"
    }], [], false)], false) : '', "\n    "]), domView.element("div", [{
      "class": "scroll-content"
    }], [content(slide.id)], false), domView.element("footer", [{
      "class": "scroll-section-footer"
    }], [domView.element("span", [{
      "class": "scroll-item-number"
    }], [domView.fragment([String(domView.concat(n, 1)).padStart(2, '0'), " / ", String(slides.length).padStart(2, '0')])], false), footer(slide)], false), "\n   "], false);
  }), '')], false), domView.element("footer", [{
    "class": "scroll-end"
  }], [domView.element("span", [], [project], false), domView.element("button", [{
    "type": "button"
  }, {
    "data-action": "scroll-top"
  }], [domView.fragment([tr('back_to_top'), " ↑"])], false), domView.element("small", [], [tr('presented_by_studiodeck')], false)], false), "\n "], false);
}
let events, resize, frame = 0;
export function stopScrollPresentation() {
  events?.abort();
  resize?.disconnect();
  cancelAnimationFrame(frame);
}
export function scrollPosition() {
  const page = document.querySelector('.presentation-scroll');
  if (!page) return null;
  const line = domView.concat(page.querySelector('.scroll-header')?.offsetHeight || 0, 12);
  const sections = [...page.querySelectorAll('[data-scroll-slide]')];
  const section = sections.find(el => el.getBoundingClientRect().bottom > line);
  return section ? {
    iteration: page.dataset.scrollIteration,
    id: section.dataset.scrollSlide,
    offset: section.getBoundingClientRect().top
  } : null;
}
export function scrollToSlide(id, {smooth = true, focus = false} = {}) {
  const section = document.getElementById(domView.concat('scroll-slide-', id));
  if (!section) return;
  section.scrollIntoView({
    block: 'start',
    behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'instant'
  });
  if (focus) section.focus({
    preventScroll: true
  });
}
export function mountScrollPresentation({selected, position, onActive, canTrack}) {
  stopScrollPresentation();
  const page = document.querySelector('.presentation-scroll');
  if (!page) return;
  events = new AbortController();
  const {signal} = events;
  const header = page.querySelector('.scroll-header'), sections = [...page.querySelectorAll('[data-scroll-slide]')];
  page.querySelectorAll('.scroll-content').forEach((content, n) => {
    content.querySelectorAll('h1').forEach(old => {
      const heading = document.createElement('h2');
      for (const attr of old.attributes) setDomAttribute(heading, attr.name, attr.value);
      heading.replaceChildren(...old.childNodes);
      old.replaceWith(heading);
    });
    const ids = new Map();
    content.querySelectorAll('[id]').forEach(el => {
      const id = el.id;
      el.id = domView.text(["scroll-", n, "-", id, ""]);
      ids.set(id, el.id);
    });
    content.querySelectorAll('[for],[aria-controls],[aria-describedby],[aria-labelledby]').forEach(el => {
      for (const attr of ['for', 'aria-controls', 'aria-describedby', 'aria-labelledby']) if (el.hasAttribute(attr)) setDomAttribute(el, attr, domView.join(el.getAttribute(attr).split(' ').map(id => ids.get(id) || id), ' '));
    });
  });
  const measure = () => page.style.setProperty('--scroll-header-height', domView.text(["", header.offsetHeight, "px"]));
  resize = new ResizeObserver(measure);
  resize.observe(header);
  measure();
  let activeGroup;
  const update = () => {
    frame = 0;
    if (!page.isConnected) return;
    const line = domView.concat(header.offsetHeight, Math.min(180, innerHeight * .2));
    let active = sections[0];
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) active = section; else break;
    }
    const group = active?.dataset.scrollGroup;
    page.querySelectorAll('.scroll-chapters [data-section]').forEach(button => {
      const current = button.dataset.section === group;
      button.classList.toggle('active', current);
      button.closest('.section-split')?.classList.toggle('active', current);
      if (current) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
    });
    if (group !== activeGroup) {
      const nav = page.querySelector('.scroll-chapters'), button = nav.querySelector('[aria-current]');
      if (button) {
        const outer = nav.getBoundingClientRect(), inner = button.getBoundingClientRect();
        if (inner.left < domView.concat(outer.left, 20)) nav.scrollLeft += inner.left - outer.left - 20; else if (inner.right > outer.right - 20) nav.scrollLeft += domView.concat(inner.right - outer.right, 20);
      }
      activeGroup = group;
    }
    const distance = document.documentElement.scrollHeight - innerHeight;
    page.querySelector('.scroll-progress span').style.transform = domView.text(["scaleX(", distance > 0 ? Math.min(1, Math.max(0, scrollY / distance)) : 1, ")"]);
    if (active && canTrack()) onActive(active.dataset.scrollSlide);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  window.addEventListener('scroll', schedule, {
    passive: true,
    signal
  });
  window.addEventListener('resize', schedule, {
    passive: true,
    signal
  });
  const previous = position?.iteration === page.dataset.scrollIteration && sections.find(el => el.dataset.scrollSlide === position.id);
  if (previous) window.scrollBy({
    top: previous.getBoundingClientRect().top - position.offset,
    behavior: 'instant'
  }); else if (selected && selected !== sections[0]?.dataset.scrollSlide) scrollToSlide(selected, {
    smooth: false
  }); else window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
  schedule();
}
