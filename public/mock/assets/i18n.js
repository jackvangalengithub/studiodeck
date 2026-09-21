import clientEn from './languages/en.js';
import clientNl from './languages/nl.js';
import studioEn from './languages/studio-en.js';
import studioNl from './languages/studio-nl.js';
const en={...clientEn,...studioEn},nl={...clientNl,...studioNl};

export const languages=Object.freeze({en:'English',nl:'Nederlands'});
let language='en';
export function resolveLanguage({user='',project='',studio='en'}={}) {
  return [user,project,studio,'en'].find(value=>Object.hasOwn(languages,value));
}
export function setLanguage(value) {
  language=resolveLanguage({user:value});
  if(typeof document!=='undefined')document.documentElement.lang=language;
  return language;
}
export const getLanguage=()=>language;
export const numberLocale=()=>language==='nl'?'nl-NL':'en-IE';
export const dateLocale=()=>language==='nl'?'nl-NL':'en-GB';
// Translate only application-owned copy. Interpolated content is escaped by the
// rendering caller, exactly like other project/user content in the templates.
export function tr(key,values={}) {
  const catalog=language==='nl'?nl:en;
  const message=(Number(values.count)===1?catalog[key+'_one']:undefined)??catalog[key]??en[key]??key;
  return message.replace(/\{(\w+)\}/g,(match,name)=>Object.hasOwn(values,name)?String(values[name]):match);
}

// API errors are application copy; never run this on project content.
const errorKeys=new Map(Object.entries(en).filter(([key])=>key.startsWith('error_')).map(([key,value])=>[value,key]));
export const translateError=message=>errorKeys.has(message)?tr(errorKeys.get(message)):message;
