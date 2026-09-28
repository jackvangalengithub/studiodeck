import * as domView from "./render.js";
import {getLanguage} from './i18n.js';
const response = await fetch(new URL('./studio-types.json', import.meta.url));
if (!response.ok) throw new Error('Studio choices could not be loaded. Please refresh.');
export const studioTypes = await response.json();
export function studioBusiness(type = 'interior', language = getLanguage()) {
  const entry = studioTypes.find(item => item.id === type) || studioTypes[0];
  return {
    ...entry,
    ...entry[language === 'nl' ? 'nl' : 'en']
  };
}
export function businessTypeField(type, esc, help) {
  const nl = getLanguage() === 'nl', label = nl ? 'Type bedrijf' : 'Business type', hint = nl ? 'Bepaalt je welkomstbeelden en aanbevolen websitedesigns. Je bestaande website blijft behouden.' : 'Sets your welcome images and recommended website designs. Your existing website is preserved.';
  const select = domView.element("select", [{
    "id": "studio-business-type"
  }, {
    "name": "business_type"
  }], [domView.join(studioTypes.map(item => domView.element("option", [{
    "value": item.id
  }, domView.spread(type === item.id ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [studioBusiness(item.id).label], false)), '')], false);
  return help ? domView.element("div", [{
    "class": "settings-field"
  }], [domView.element("div", [{
    "class": "settings-heading"
  }], [domView.element("label", [{
    "for": "studio-business-type"
  }], [label], false), help('studio-business-help', label, hint)], false), select], false) : domView.fragment([domView.element("label", [], [domView.fragment([label, select])], false), domView.element("p", [{
    "class": "form-hint"
  }], [hint], false)]);
}
