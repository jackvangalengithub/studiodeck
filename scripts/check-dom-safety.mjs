import {checkNoEval, checkNoEvalPolicy} from './check-no-eval.mjs';
import {parse} from 'acorn';
import {createHash} from 'node:crypto';
import {ancestor} from 'acorn-walk';
import {parse as parseHtml} from 'parse5';
import {readFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const htmlSinks=new Set(['innerHTML','outerHTML','insertAdjacentHTML','srcdoc','parseFromString','createContextualFragment','setHTML','setHTMLUnsafe','parseHTML','parseHTMLUnsafe','createPolicy']);
const activeTags=new Set(['script','style','object','embed','base','link','meta','iframe']);
const urlProps=new Set(['href','src','poster','action','formAction','srcset','srcSet','xlink:href']);
export function constant(node){
 if(node?.type==='Literal')return node.value;
 if(node?.type==='TemplateLiteral'&&!node.expressions.length)return node.quasis[0].value.cooked;
 if(node?.type==='BinaryExpression'&&node.operator==='+'){const l=constant(node.left),r=constant(node.right);if(l!==undefined&&r!==undefined)return l+r;}
}
const name=n=>n?.type==='MemberExpression'?(n.computed?constant(n.property):n.property.name):undefined;
const validated=n=>n?.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='safeUrl';
export function checkJavaScript(source,file='input.js'){
 const errors=checkNoEval(source,file),report=(n,message)=>errors.push(`${file}:${n.loc.start.line}: ${message}`);
 let ast;try{ast=parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true});}catch(e){return [`${file}: ${e.message}`];}
 const boundary=file.replaceAll('\\','/')==='public/assets/dom.js';
 ancestor(ast,{
  MemberExpression(n){if(htmlSinks.has(name(n))||['write','writeln'].includes(name(n))&&(n.object.name==='document'||name(n.object)==='document'))report(n,`Forbidden HTML/code sink ${name(n)}; use text or DOM nodes.`);},
  ObjectPattern(n){for(const prop of n.properties){const key=prop.computed?constant(prop.key):prop.key?.name??prop.key?.value;if(htmlSinks.has(key))report(prop,`Forbidden HTML sink alias ${key}.`);}},
  Property(n){const key=n.computed?constant(n.key):n.key.name??n.key.value;if(htmlSinks.has(key)||typeof key==='string'&&/^on[a-z]+$/.test(key)&&typeof constant(n.value)==='string')report(n,`Forbidden property ${key}; use text nodes or function listeners.`);},
  AssignmentExpression(n){const key=name(n.left);if(urlProps.has(key)&&name(n.left.object)!=='dataset'&&!validated(n.right))report(n,'URL assignments must pass through safeUrl().');},
  CallExpression(n){
   const fn=n.callee.type==='Identifier'?n.callee.name:name(n.callee);
   if(['eval','Function','execScript'].includes(fn))report(n,'Dynamic code execution is forbidden.');
   if(['setTimeout','setInterval'].includes(fn)&&typeof constant(n.arguments[0])==='string')report(n,'Timers must receive functions.');
   if(['assign','replace'].includes(fn)&&(n.callee.object?.name==='location'||name(n.callee.object)==='location')&&!validated(n.arguments[0]))report(n,'Navigation must pass through safeUrl().');
   if(['setAttribute','setAttributeNS'].includes(fn)&&!boundary){
    const key=constant(n.arguments[fn==='setAttributeNS'?1:0]);
    if(key===undefined||/^on/i.test(key)||['srcdoc','is',...urlProps].includes(key))report(n,'Dynamic, event and URL attributes must use the DOM helper.');
   }
   if(['createElement','createElementNS'].includes(fn)&&!boundary){
    const tag=constant(n.arguments[fn==='createElementNS'?1:0]);
    if(typeof tag!=='string'||activeTags.has(tag.toLowerCase())||tag.includes('-'))report(n,'Active/dynamic elements must use the DOM helper allowlist.');
   }
  },
  NewExpression(n){if(n.callee.name==='Function')report(n,'Dynamic code execution is forbidden.');}
 });
 return errors;
}
export function checkHTML(source,file){
 const errors=[],tree=parseHtml(source,{sourceCodeLocationInfo:true});
 function visit(n){
  const attrs=Object.fromEntries((n.attrs||[]).map(a=>[a.name,a.value]));
  const fail=m=>errors.push(`${file}:${n.sourceCodeLocation?.startLine||1}: ${m}`);
  if(n.tagName==='meta'&&attrs['http-equiv']?.toLowerCase()==='content-security-policy')for(const error of checkNoEvalPolicy(attrs.content||''))fail(error);
  if(n.tagName==='script'&&!attrs.src&&attrs.type!=='application/json')fail('Inline executable scripts are forbidden.');
  for(const [key,value]of Object.entries(attrs))if(/^on/i.test(key)||key==='srcdoc'||urlProps.has(key)&&/^\s*(?:javascript|vbscript):/i.test(value))fail(`Forbidden active HTML attribute ${key}.`);
  for(const child of n.childNodes||[])visit(child);if(n.content)visit(n.content);
 }visit(tree);return errors;
}
export async function checkTree(root){
 const errors=[];let count=0;
 const vendors=JSON.parse(await readFile(new URL('./dom-vendor-integrity.json',import.meta.url),'utf8'));
 for(const file of (await readdir(root,{recursive:true})).sort()){
  if(!/\.(?:js|html)$/.test(file))continue;
  const source=await readFile(resolve(root,file),'utf8');count++;
  if(Object.hasOwn(vendors,file)){
   errors.push(...checkNoEval(source,`public/${file}`));
   if(createHash('sha256').update(source).digest('hex')!==vendors[file])errors.push(`public/${file}: Vendor changed; review DOM behavior and renew the integrity entry.`);
   continue;
  }
  errors.push(...(file.endsWith('.js')?checkJavaScript(source,`public/${file}`):checkHTML(source,`public/${file}`)));
 }
 return {errors,count};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {errors,count}=await checkTree(resolve(import.meta.dirname,'../public'));
 if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`DOM safety check passed (${count} JS/HTML files, including vendor and demo code).`);
}
