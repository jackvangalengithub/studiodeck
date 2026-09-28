export {createRowQueue as createApiBatcher} from './platform/transport.js';
export const contextActions=new Set(['switch_studio','create_studio','logout']);
export function jsonFormBody(action,body){
  if(!(body instanceof FormData))return body;
  // Empty file inputs are not uploads. Retain multipart when a file is selected.
  if([...body.values()].some(value=>value instanceof Blob&&value.name))return body;
  const fields=Object.fromEntries([...body].filter(([,value])=>!(value instanceof Blob)));
  if(action==='project_settings'&&typeof fields.tags==='string')fields.tags=fields.tags.split(/[,;\r\n]+/);
  if(action==='studio_theme'&&typeof fields.theme==='string')fields.theme=JSON.parse(fields.theme);
  return action==='product_feedback_submit'?JSON.parse(fields.feedback):fields;
}

