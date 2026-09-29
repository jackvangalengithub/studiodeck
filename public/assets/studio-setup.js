import * as domView from "./render.js";
import {getLanguage, setLanguage} from './i18n.js';
import {studioTypes, studioBusiness} from './studio-business.js';
const copy = {
  en: {
    tag: 'A SPACE FOR YOUR PRACTICE',
    steps: ['Language', 'Your studio', 'Your craft'],
    title: ['Let’s make this feel like you.', 'Every studio starts with a name.', 'What kind of studio do you run?'],
    intro: ['A few small details. A space that feels your own. First, choose the language you feel at home in.', 'Your name, on your workspace. You can always change it later.', 'Choose the closest fit. We’ll bring your world into the welcome images and website starting designs.'],
    language: 'Studio language',
    name: 'Studio name',
    placeholder: 'e.g. Studio Willow',
    next: 'Continue',
    back: 'Back',
    finish: 'Open my studio',
    saving: 'Making room for you…',
    later: 'You can change these details in Studio settings.',
    note: 'For the work you love.\nAnd the people you create it for.',
    step: 'Step',
    of: 'of',
    error: 'We couldn’t save your studio. Please try again.',
    choose: 'Choose your field',
    languageHint: 'Your workspace and new projects start in this language.',
    exit: 'Your workspaces'
  },
  nl: {
    tag: 'RUIMTE VOOR JOUW PRAKTIJK',
    steps: ['Taal', 'Jouw studio', 'Jouw vak'],
    title: ['Laten we het eigen maken.', 'Elke studio begint met een naam.', 'Wat voor studio heb je?'],
    intro: ['Een paar kleine details. Een plek die als jouw eigen studio voelt. Kies eerst de taal waarin je je thuis voelt.', 'Jouw naam, op jouw werkplek. Je kunt hem later altijd aanpassen.', 'Kies wat het beste past. We stemmen je welkomstbeelden en websitedesigns af op jouw vak.'],
    language: 'Studiotaal',
    name: 'Studionaam',
    placeholder: 'bijv. Studio Wilg',
    next: 'Verder',
    back: 'Terug',
    finish: 'Open mijn studio',
    saving: 'We maken ruimte voor je…',
    later: 'Je kunt deze gegevens later wijzigen in Studio-instellingen.',
    note: 'Voor het werk waar je van houdt.\nEn de mensen voor wie je het maakt.',
    step: 'Stap',
    of: 'van',
    error: 'We konden je studio niet opslaan. Probeer het opnieuw.',
    choose: 'Kies je vakgebied',
    languageHint: 'Je werkplek en nieuwe projecten beginnen in deze taal.',
    exit: 'Jouw werkplekken'
  }
};
export function studioSetupUi({state, esc, brand, api, applySession, render}) {
  let draft = null, busy = false, error = '';
  function required() {
    return !state.client && state.studio?.role === 'admin' && state.studio.setup_completed_at === null;
  }
  function values() {
    if (draft?.id !== state.studio.id) {
      draft = {
        id: state.studio.id,
        step: 0,
        language: state.studio.language || getLanguage(),
        name: state.studio.name || '',
        business_type: ''
      };
      error = '';
    }
    return draft;
  }
  function page() {
    const d = values();
    setLanguage(d.language);
    const t = copy[d.language], step = d.step;
    const profile = studioBusiness(d.business_type || 'landscape', d.language);
    return domView.element("main", [{
      "class": "studio-setup"
    }, {
      "id": "main"
    }], [domView.element("header", [{
      "class": "setup-header"
    }], [brand(), domView.element("a", [{
      "href": "/choose"
    }], [domView.fragment([t.exit, " ↗"])], false)], false), "\n      ", domView.element("div", [{
      "class": "setup-shell"
    }], [domView.element("nav", [{
      "aria-label": t.step
    }], [domView.element("ol", [{
      "class": "setup-steps"
    }], [domView.join(t.steps.map((label, i) => domView.element("li", [domView.spread(i === step ? domView.attributes([{
      "aria-current": "step"
    }]) : ''), {
      "class": i < step ? 'complete' : ''
    }], [domView.element("span", [], [i < step ? '✓' : String(domView.concat(i, 1)).padStart(2, '0')], false), label], false)), '')], false)], false), "\n      ", domView.element("form", [{
      "data-studio-setup": domView.text([])
    }, {
      "class": domView.text(["setup-form ", step === 2 ? 'setup-craft' : 'setup-intro'])
    }, {
      "aria-busy": busy
    }], ["\n        ", domView.element("div", [{
      "class": "setup-copy"
    }], [domView.element("p", [{
      "class": "setup-eyebrow"
    }], [t.tag], false), domView.element("h1", [{
      "tabindex": "-1"
    }], [t.title[step]], false), domView.element("p", [{
      "class": "setup-description"
    }], [t.intro[step]], false), domView.fragment(["\n        ", step === 0 ? domView.fragment([domView.element("fieldset", [{
      "class": "setup-languages"
    }], [domView.element("legend", [{
      "class": "sr-only"
    }], [t.language], false), domView.join([['en', 'English', 'Hello. Make yourself at home.'], ['nl', 'Nederlands', 'Hallo. Voel je thuis.']].map(([id, label, hint]) => domView.element("label", [], [domView.element("input", [{
      "type": "radio"
    }, {
      "name": "language"
    }, {
      "value": id
    }, domView.spread(d.language === id ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), domView.element("span", [], [domView.element("strong", [], [label], false), domView.element("small", [], [hint], false), domView.element("i", [{
      "aria-hidden": "true"
    }], ["✓"], false)], false)], false)), '')], false), domView.element("p", [{
      "class": "setup-hint"
    }], [t.languageHint], false)]) : '', "\n        ", step === 1 ? domView.element("label", [{
      "class": "setup-name"
    }], [t.name, domView.element("input", [{
      "name": "name"
    }, {
      "value": d.name
    }, {
      "placeholder": t.placeholder
    }, {
      "required": domView.text([])
    }, {
      "maxlength": "100"
    }, {
      "autocomplete": "organization"
    }], [], false)], false) : ''])], false), domView.fragment(["\n        ", step === 2 ? domView.element("fieldset", [{
      "class": "setup-types"
    }, domView.spread(busy ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], [domView.element("legend", [{
      "class": "sr-only"
    }], [t.choose], false), domView.join(studioTypes.map(item => {
      const b = studioBusiness(item.id, d.language);
      return domView.element("label", [{
        "class": "setup-type"
      }], [domView.element("input", [{
        "type": "radio"
      }, {
        "name": "business_type"
      }, {
        "value": item.id
      }, domView.spread(d.business_type === item.id ? domView.attributes([{
        "checked": domView.text([])
      }]) : ''), {
        "required": domView.text([])
      }], [], false), domView.element("span", [{
        "class": "setup-type-photo"
      }], [domView.element("img", [{
        "src": b.image
      }, {
        "alt": domView.text([])
      }, domView.spread(domView.attributes([item.id === 'interior' ? {fetchpriority: 'high'} : {loading: 'lazy'}]))], [], false), domView.element("i", [{
        "aria-hidden": "true"
      }], ["✓"], false)], false), domView.element("span", [{
        "class": "setup-type-copy"
      }], [domView.element("strong", [], [b.label], false), domView.element("small", [], [b.description], false)], false)], false);
    }), '')], false) : domView.element("aside", [{
      "class": "setup-art"
    }, {
      "aria-hidden": "true"
    }], [domView.element("img", [{
      "src": profile.image
    }, {
      "alt": domView.text([])
    }], [], false), domView.element("div", [], [domView.element("span", [], [domView.fragment(["STUDIODECK / ", String(domView.concat(step, 1)).padStart(2, '0')])], false), domView.element("p", [], [t.note.replace('\n', '<br>')], false)], false)], false), "\n        "]), domView.element("footer", [{
      "class": "setup-footer"
    }], [domView.element("div", [], [domView.element("span", [{
      "class": "setup-count"
    }], [domView.fragment([t.step, " ", domView.concat(step, 1), " ", t.of, " 3"])], false), domView.element("p", [], [t.later], false), domView.element("p", [{
      "class": "setup-error"
    }, {
      "role": "alert"
    }], [error], false)], false), domView.element("div", [{
      "class": "setup-buttons"
    }], [step > 0 ? domView.element("button", [{
      "class": "button ghost"
    }, {
      "type": "button"
    }, {
      "data-setup-back": domView.text([])
    }, domView.spread(busy ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], [domView.fragment(["← ", t.back])], false) : '', domView.element("button", [{
      "class": "button primary"
    }, {
      "type": "submit"
    }, domView.spread(busy || step === 2 && !d.business_type ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], [busy ? t.saving : step === 2 ? t.finish : t.next, domView.element("span", [{
      "aria-hidden": "true"
    }], [" ↗"], false)], false)], false)], false), "\n      "], false)], false)], false);
  }
  function redraw(focus = true) {
    render();
    if (focus) document.querySelector('.setup-copy h1')?.focus({
      preventScroll: true
    });
  }
  function afterRender() {
    const form = document.querySelector('[data-studio-setup]');
    if (!form) return;
    form.addEventListener('input', event => {
      if (event.target.name === 'name') draft.name = event.target.value;
    });
    form.addEventListener('change', event => {
      if (event.target.name === 'language') {
        draft.language = event.target.value;
        redraw(false);
        document.querySelector(domView.text(["[name=\"language\"][value=\"", draft.language, "\"]"]))?.focus();
      }
      if (event.target.name === 'business_type') {
        draft.business_type = event.target.value;
        form.querySelector('[type="submit"]').disabled = false;
      }
    });
    form.querySelector('[data-setup-back]')?.addEventListener('click', () => {
      if (!busy) {
        draft.step--;
        error = '';
        redraw();
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      if (draft.step < 2) {
        if (draft.step === 1 && !draft.name.trim()) {
          form.elements.name.setCustomValidity(draft.language === 'nl' ? 'Geef je studio een naam.' : 'Give your studio a name.');
          form.elements.name.reportValidity();
          form.elements.name.addEventListener('input', () => form.elements.name.setCustomValidity(''), {
            once: true
          });
          return;
        }
        draft.step++;
        error = '';
        redraw();
        return;
      }
      busy = true;
      error = '';
      redraw(false);
      try {
        const sid = draft.id, result = await api('complete_studio_setup', {
          name: draft.name.trim(),
          language: draft.language,
          business_type: draft.business_type
        });
        if (state.studio?.id === sid) {
          applySession(result);
          draft = null;
          state.websiteEditing = false;
          state.tab = 'projects';
          render();
          document.querySelector('#welcome-title')?.setAttribute('tabindex', '-1');
          document.querySelector('#welcome-title')?.focus();
        }
      } catch (e) {
        error = e.message || copy[draft.language].error;
      } finally {
        busy = false;
        if (required()) redraw(false);
      }
    });
  }
  return {
    required,
    page,
    afterRender
  };
}
