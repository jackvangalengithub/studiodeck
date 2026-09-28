import * as domView from "./render.js";
import {studioBusiness} from './studio-business.js';
import {getLanguage} from './i18n.js';
import {onboardingText as t} from './onboarding-copy.js';
export function onboardingUi({state, esc, icon, button, openModal, closeModal, render, startProject, upload, preview, share, onError}) {
  let tourFrame = null, tourFocus = null;
  const key = () => domView.text(["studiodeck.onboarding.v1:", state.user?.id || state.user?.email || 'demo', ":", state.studio?.id || 'demo', ""]);
  const read = (storage, suffix, fallback = {}) => {
    try {
      return JSON.parse(window[storage].getItem(domView.concat(key(), suffix))) || fallback;
    } catch {
      return fallback;
    }
  };
  const write = (storage, suffix, value) => {
    try {
      window[storage].setItem(domView.concat(key(), suffix), JSON.stringify(value));
    } catch {}
  };
  const prefs = () => read('localStorage', ':progress');
  function remember(patch) {
    write('localStorage', ':progress', {
      ...prefs(),
      ...patch
    });
  }
  const createButton = () => button(t(state.studioEmpty ? 'create' : 'startProject'), 'onboarding-create', 'primary', '', 'arrow');
  function welcome() {
    const business = studioBusiness(state.studio?.business_type);
    const name = (state.user?.profile?.name || state.user?.name || '').trim().split(/\s+/)[0];
    return domView.element("section", [{
      "class": "onboarding-welcome"
    }, {
      "aria-labelledby": "welcome-title"
    }], ["\n      ", domView.element("div", [{
      "class": "onboarding-hero"
    }], [domView.element("div", [{
      "class": "onboarding-copy"
    }], ["\n        ", domView.element("p", [{
      "class": "onboarding-eyebrow"
    }], [name ? t('hello', {
      name: name
    }) : t('welcome')], false), "\n        ", domView.element("h1", [{
      "id": "welcome-title"
    }], [t('title')], false), domView.element("p", [{
      "class": "onboarding-intro"
    }], [business.welcomeIntro], false), "\n        ", domView.element("div", [{
      "class": "onboarding-actions"
    }], [domView.fragment([createButton(), button(t('example'), 'onboarding-example', 'onboarding-secondary', '', 'compass')])], false), "\n        ", domView.element("p", [{
      "class": "onboarding-reassurance"
    }], [t('reassurance')], false), "\n      "], false), domView.element("button", [{
      "class": "onboarding-film"
    }, {
      "data-action": "onboarding-video"
    }, {
      "aria-label": t('play')
    }], ["\n        ", domView.element("img", [{
      "src": business.image
    }, {
      "alt": business.alt
    }, {
      "fetchpriority": "high"
    }], [], false), "\n        ", domView.element("span", [{
      "class": "onboarding-film-top"
    }], [domView.element("span", [], [domView.fragment(["STUDIODECK / ", getLanguage() === 'nl' ? 'EEN EERSTE BLIK' : 'A FIRST LOOK'])], false), domView.element("span", [], [t('duration')], false)], false), "\n        ", domView.element("span", [{
      "class": "onboarding-film-play"
    }], [icon('play')], false), "\n        ", domView.element("span", [{
      "class": "onboarding-film-caption"
    }], [domView.element("strong", [], [t('watch')], false), domView.element("span", [], [t('watchSub')], false)], false), "\n      "], false)], false), "\n    "], false);
  }
  function help() {
    openModal(t('help'), domView.fragment([domView.element("p", [], [t('helpIntro')], false), domView.element("div", [{
      "class": "onboarding-help-actions"
    }], [domView.fragment([button(t('watch'), 'onboarding-video', '', '', 'play'), button(t('example'), 'onboarding-example', '', '', 'compass')])], false)]), true);
  }
  function video() {
    remember({
      learned: true
    });
    openModal(t('tour'), domView.fragment([domView.element("div", [{
      "class": "onboarding-video"
    }], [domView.element("video", [{
      "controls": domView.text([])
    }, {
      "playsinline": domView.text([])
    }, {
      "preload": "metadata"
    }, {
      "poster": "assets/onboarding/poster.jpg"
    }, {
      "aria-label": t('tour')
    }], [domView.element("source", [{
      "src": domView.text(["assets/onboarding/", getLanguage() === 'nl' ? 'tour-nl' : 'tour', ".webm"])
    }, {
      "type": "video/webm"
    }], [], false), domView.element("track", [{
      "kind": "captions"
    }, {
      "src": domView.text(["assets/onboarding/tour-", getLanguage(), ".vtt"])
    }, {
      "srclang": getLanguage()
    }, {
      "label": getLanguage() === 'nl' ? 'Nederlands' : 'English'
    }, {
      "default": domView.text([])
    }], [], false)], false), domView.element("p", [{
      "data-video-error": domView.text([])
    }, {
      "role": "status"
    }, {
      "hidden": domView.text([])
    }], [t('videoError')], false)], false), "\n      ", domView.element("p", [{
      "class": "onboarding-audio-note"
    }], [t('audioNote')], false), "\n      ", domView.element("details", [{
      "class": "onboarding-transcript"
    }], [domView.element("summary", [], [t('transcript')], false), domView.join([1, 2, 3, 4, 5].map(n => domView.element("p", [], [t(domView.concat('transcript', n))], false)), '')], false), "\n      ", domView.element("div", [{
      "class": "modal-footer onboarding-footer"
    }], [domView.fragment([button(t('example'), 'onboarding-example', 'ghost', '', 'compass'), createButton()])], false)]), true);
    const player = document.querySelector('.onboarding-video video');
    player.querySelector('source').addEventListener('error', () => {
      document.querySelector('[data-video-error]')?.removeAttribute('hidden');
    });
    player.addEventListener('error', () => {
      document.querySelector('[data-video-error]')?.removeAttribute('hidden');
    });
    player.play().catch(() => {});
  }
  function closeTour(create = false) {
    if (!tourFrame) return;
    tourFrame.remove();
    tourFrame = null;
    document.querySelector('#app').inert = false;
    document.querySelector('#overlay').inert = false;
    document.body.style.overflow = '';
    tourFocus?.focus();
    if (create) startProject().catch(onError);
  }
  function openAppTour() {
    closeModal();
    if (tourFrame) return;
    remember({
      learned: true
    });
    tourFocus = document.activeElement;
    tourFrame = document.createElement('section');
    tourFrame.className = 'guided-app-tour';
    tourFrame.setAttribute('role', 'dialog');
    tourFrame.setAttribute('aria-modal', 'true');
    tourFrame.setAttribute('aria-label', t('appTour'));
    domView.mount(tourFrame, domView.fragment([domView.element("header", [], [domView.element("div", [], [domView.element("strong", [], [t('appTour')], false), domView.element("small", [], [t('tourSample')], false)], false), domView.element("button", [{
      "type": "button"
    }, {
      "class": "button small"
    }, {
      "data-tour-exit": domView.text([])
    }], [t('tourExit')], false)], false), domView.element("iframe", [{
      "title": t('appTour')
    }, {
      "sandbox": "allow-scripts allow-forms"
    }, {
      "src": domView.text(["/index.html?app-tour=1&language=", getLanguage()])
    }], [], false)]));
    tourFrame.querySelector('[data-tour-exit]').addEventListener('click', () => closeTour());
    document.body.append(tourFrame);
    document.querySelector('#app').inert = true;
    document.querySelector('#overlay').inert = true;
    document.body.style.overflow = 'hidden';
    tourFrame.querySelector('[data-tour-exit]').focus();
  }
  window.addEventListener('message', event => {
    if (!tourFrame || event.origin !== 'null' || event.source !== tourFrame.querySelector('iframe').contentWindow) return;
    if (event.data?.type === 'studiodeck-tour-exit') closeTour();
    if (event.data?.type === 'studiodeck-tour-create') closeTour(true);
  });
  document.addEventListener('keydown', event => {
    if (!tourFrame) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeTour();
    }
  }, true);
  function created(projectId) {
    remember({
      projectId,
      dismissed: false,
      reviewed: false
    });
  }
  function reviewed() {
    if (prefs().projectId === state.data?.project.id) remember({
      reviewed: true
    });
  }
  function checklist() {
    const p = prefs(), d = state.data;
    if (!d || d.can_edit === false || p.projectId !== d.project.id || p.dismissed) return '';
    const shared = d.iterations?.some(i => i.status === 'shared') || d.iteration.status === 'shared';
    const done = [((d.overview?.file_count ?? d.files?.length) ?? 0) > 0, !!p.reviewed || shared, shared];
    return domView.element("section", [{
      "class": "onboarding-checklist"
    }, {
      "aria-labelledby": "onboarding-checklist-title"
    }], [domView.element("div", [{
      "class": "onboarding-checklist-head"
    }], [domView.element("div", [], [domView.element("h2", [{
      "id": "onboarding-checklist-title"
    }], [t(done.every(Boolean) ? 'complete' : 'checklist')], false), domView.element("p", [], [domView.fragment([t('progress', {
      number: done.filter(Boolean).length
    }), " · ", t('checklistNote')])], false)], false), domView.element("button", [{
      "class": "icon-button"
    }, {
      "data-action": "onboarding-dismiss"
    }, {
      "aria-label": t('dismiss')
    }], [icon('close')], false)], false), domView.element("ol", [], [domView.join(['addFiles', 'review', 'send'].map((item, i) => domView.element("li", [{
      "class": done[i] ? 'is-done' : ''
    }], [domView.element("span", [{
      "aria-label": t(done[i] ? 'completed' : 'pending')
    }], [done[i] ? icon('check') : domView.concat(i, 1)], false), button(t(item), domView.concat('onboarding-check-', i), 'ghost', i === 2 && !p.reviewed && !shared ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], false)), '')], false)], false);
  }
  async function action(name) {
    switch (name) {
      case 'onboarding-help':
        help();
        break;
      case 'onboarding-video':
        video();
        break;
      case 'onboarding-example':
        openAppTour();
        break;
      case 'onboarding-create':
        remember({
          learned: true
        });
        closeModal();
        await startProject();
        break;
      case 'onboarding-dismiss':
        remember({
          dismissed: true
        });
        render();
        break;
      case 'onboarding-check-0':
        upload();
        break;
      case 'onboarding-check-1':
        await preview();
        break;
      case 'onboarding-check-2':
        await share();
        break;
    }
  }
  return {
    welcome,
    checklist,
    created,
    reviewed,
    action,
    helpLabel: () => t('help')
  };
}
