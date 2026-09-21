import {getLanguage} from './i18n.js';

const response=await fetch(new URL('./studio-types.json',import.meta.url));
if(!response.ok)throw new Error('Studio choices could not be loaded. Please refresh.');
export const studioTypes=await response.json();
export function studioBusiness(type='interior',language=getLanguage()){
  const entry=studioTypes.find(item=>item.id===type)||studioTypes[0];
  return {...entry,...entry[language==='nl'?'nl':'en']};
}
export function businessTypeField(type,esc){
  const nl=getLanguage()==='nl';
  return `<label>${nl?'Type bedrijf':'Business type'}<select name="business_type">${studioTypes.map(item=>`<option value="${item.id}" ${type===item.id?'selected':''}>${esc(studioBusiness(item.id).label)}</option>`).join('')}</select></label><p class="form-hint">${nl?'Bepaalt je welkomstbeelden en aanbevolen websitedesigns. Je bestaande website blijft behouden.':'Sets your welcome images and recommended website designs. Your existing website is preserved.'}</p>`;
}
