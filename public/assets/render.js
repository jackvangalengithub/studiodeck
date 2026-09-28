import {e} from './dom.js';

// Immutable descriptions retain structure when views are composed or cached.
// Only descriptions minted in this module are renderable; API objects cannot
// impersonate an element by supplying a tag/props-shaped JSON object.
const views=new WeakMap(),props=new WeakMap();
const isView=value=>!!value&&typeof value==='object'&&views.has(value);
const isProps=value=>!!value&&typeof value==='object'&&props.has(value);
const isNode=value=>typeof Node!=='undefined'&&value instanceof Node;
const describe=data=>{
 const value=Object.freeze({toString:()=>plain(value)});
 views.set(value,Object.freeze({...data,children:Object.freeze([...data.children]),...(data.attributes?{attributes:Object.freeze(data.attributes.map(p=>isProps(p)?p:Object.freeze({...p})))}:{})}));return value;
};
export const fragment=children=>describe({children});
export const element=(tag,attributes,children,svg=false)=>describe({tag,attributes,children,svg});
export function attributes(parts){const value=Object.freeze({toString:()=>plain(value)});props.set(value,Object.freeze(parts.map(p=>isProps(p)?p:Object.freeze({...p}))));return value;}
export function spread(value){
 if(value==null||value===false||value==='')return attributes([]);
 if(isProps(value))return value;
 if(isView(value)&&!views.get(value).tag)return attributes(views.get(value).children.map(spread));
 if(typeof value==='string'&&!value.trim())return attributes([]);
 throw new TypeError('Attribute spreads must be application-created attributes');
}
export function plain(value){
 if(value==null||typeof value==='boolean')return '';
 if(Array.isArray(value))return value.map(plain).join('');
 if(isNode(value))return value.textContent;
 if(isView(value))return views.get(value).children.map(plain).join('');
 if(isProps(value))return Object.entries(resolveProps(props.get(value))).map(([key,v])=>v===true?key:`${key}="${v}"`).join(' ');
 if(['string','number','bigint'].includes(typeof value))return String(value);
 throw new TypeError('UI text must be a primitive value or a view');
}
export function text(parts){return parts.some(v=>isView(v)||isProps(v)||isNode(v))?fragment(parts):parts.map(v=>v==null?'':String(v)).join('');}
export function concat(left,right){return isView(left)||isView(right)||isProps(left)||isProps(right)||isNode(left)||isNode(right)?fragment([left,right]):left+right;}
export function join(values,separator=','){
 if(!values.some(v=>isView(v)||isProps(v)||isNode(v)))return values.join(separator);
 return fragment(values.flatMap((value,index)=>index?[separator,value]:[value]));
}
export function interpolate(message,values){
 const parts=[];let last=0;
 for(const match of String(message).matchAll(/\{(\w+)\}/g)){
  parts.push(message.slice(last,match.index),Object.hasOwn(values,match[1])?values[match[1]]:match[0]);last=match.index+match[0].length;
 }
 parts.push(message.slice(last));return text(parts);
}
function resolveProps(parts){
 const result={};
 for(const part of parts){
  if(isProps(part)){Object.assign(result,resolveProps(props.get(part)));continue;}
  for(const [key,value] of Object.entries(part))result[key]=isView(value)||isProps(value)?plain(value):value;
 }
 return result;
}
export function withProps(view,changes){
 if(!isView(view)||!views.get(view).tag)throw new TypeError('Expected element description');
 const source=views.get(view);return describe({...source,attributes:[...source.attributes,changes]});
}
export function nodes(value){
 if(value==null||typeof value==='boolean')return [];
 if(Array.isArray(value))return value.flatMap(nodes);
 if(isNode(value))return [value];
 if(isView(value)){
  const data=views.get(value);if(!data.tag)return data.children.flatMap(nodes);
  return [e(plain(data.tag),resolveProps(data.attributes),data.children.flatMap(nodes),data.svg)];
 }
 if(['string','number','bigint'].includes(typeof value))return [document.createTextNode(String(value))];
 throw new TypeError('Only text, DOM nodes and application-created views can render');
}
export function mount(target,value){(target.content instanceof DocumentFragment?target.content:target).replaceChildren(...nodes(value));return value;}
export function append(target,value){target.append(...nodes(value));}
export function replace(target,value){target.replaceWith(...nodes(value));}
export function insert(target,position,value){
 const list=nodes(value);
 switch(position){case 'beforeend':target.append(...list);break;case 'afterbegin':target.prepend(...list);break;case 'beforebegin':target.before(...list);break;case 'afterend':target.after(...list);break;default:throw new TypeError('Unknown insertion position');}
}

// Keep focused controls stable when a background progress poll changes nothing.
const rendered=new WeakMap();
function equal(left,right){
 if(left===right)return true;
 if(!left||!right||typeof left!=='object'||typeof right!=='object'||isNode(left)||isNode(right))return false;
 const a=views.get(left)||props.get(left)||left,b=views.get(right)||props.get(right)||right;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&equal(a[key],b[key]));
}
export function update(target,value){
 if(equal(rendered.get(target),value))return;
 mount(target,value);rendered.set(target,value);
}
