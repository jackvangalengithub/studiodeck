import {getLanguage} from './i18n.js';

const response=await fetch(new URL('./studio-types.json',import.meta.url));
if(!response.ok)throw new Error('Studio choices could not be loaded. Please refresh.');
export const studioTypes=await response.json();
export function studioBusiness(type='interior',language=getLanguage()){
  const entry=studioTypes.find(item=>item.id===type)||studioTypes[0];
  return {...entry,...entry[language==='nl'?'nl':'en']};
}
export function businessTypeField(type,esc,help){
  const nl=getLanguage()==='nl',label=nl?'Type bedrijf':'Business type',hint=nl?'Bepaalt je welkomstbeelden en aanbevolen websitedesigns. Je bestaande website blijft behouden.':'Sets your welcome images and recommended website designs. Your existing website is preserved.';
  const select=`<select id="studio-business-type" name="business_type">${studioTypes.map(item=>`<option value="${item.id}" ${type===item.id?'selected':''}>${esc(studioBusiness(item.id).label)}</option>`).join('')}</select>`;
  return help?`<div class="settings-field"><div class="settings-heading"><label for="studio-business-type">${label}</label>${help('studio-business-help',label,hint)}</div>${select}</div>`:`<label>${label}${select}</label><p class="form-hint">${hint}</p>`;
}
