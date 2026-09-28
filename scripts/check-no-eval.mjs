import {parse} from 'acorn';
import {ancestor, simple} from 'acorn-walk';

const forbidden = new Set(['eval', 'execScript', 'Function', 'AsyncFunction', 'GeneratorFunction', 'AsyncGeneratorFunction']);
const functions = new Set(['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration']);
function constant(n) {
 if(n?.type === 'Literal') return n.value;
 if(n?.type === 'TemplateLiteral' && !n.expressions.length) return n.quasis[0].value.cooked;
 if(n?.type === 'BinaryExpression' && n.operator === '+') {const a=constant(n.left),b=constant(n.right);if(a!==undefined&&b!==undefined)return a+b;}
}
const key = n => n?.type === 'MemberExpression' ? n.computed ? constant(n.property) : n.property.name : n?.name;

// This is a source guard, not a JavaScript sandbox. The mandatory CSP is the
// final enforcement boundary, including obfuscated code and dependency code.
export function checkNoEval(source, file='input.js') {
 let ast;try {ast=parse(source,{ecmaVersion:'latest',sourceType:'module',locations:true});} catch(e) {return [`${file}: ${e.message}`];}
 const errors=[], callable=new Set(), vendor=file.includes('/vendor/');
 const report=(n,msg)=>errors.push(`${file}:${n.loc.start.line}: ${msg}`);
 simple(ast, {
  FunctionDeclaration(n) {if(n.id)callable.add(n.id.name);},
  VariableDeclarator(n) {if(functions.has(n.init?.type))callable.add(n.id.name);},
  AssignmentExpression(n) {if(functions.has(n.right.type))callable.add(key(n.left));},
  NewExpression(n) {if(n.callee.name==='Promise'&&functions.has(n.arguments[0]?.type))for(const p of n.arguments[0].params)if(p.type==='Identifier')callable.add(p.name);}
 });
 ancestor(ast, {
  Identifier(n,parents) {
   const p=parents.at(-2);
   if(['setTimeout','setInterval'].includes(n.name) && !(p?.type==='CallExpression'&&p.callee===n))report(n,'Timer aliases are forbidden; pass a function directly.');
   if(!forbidden.has(n.name))return;
   // Function.prototype.call/bind and instanceof Function do not compile code.
   if(n.name==='Function'&&((p?.type==='MemberExpression'&&p.object===n&&key(p)==='prototype')||(p?.type==='BinaryExpression'&&p.operator==='instanceof'&&p.right===n)))return;
   report(n,'Dynamic code execution/reference is forbidden.');
  },
  MemberExpression(n,parents) {
   const k=key(n),p=parents.at(-2);
   if(['setTimeout','setInterval'].includes(k)&&!(p?.type==='CallExpression'&&p.callee===n))report(n,'Timer aliases are forbidden; pass a function directly.');
   if(forbidden.has(k))report(n,'Dynamic code execution/reference is forbidden.');
   // Reading a function constructor allows aliases to bypass direct-call checks.
   if(k==='constructor') {
    const metadata=p?.type==='MemberExpression'&&p.object===n&&['name','prototype','bucket','EDIT_CONTEXT'].includes(key(p));
    const comparison=p?.type==='BinaryExpression'&&['==','===','!=','!=='].includes(p.operator);
    if(!metadata&&!comparison&&!vendor)report(n,'Constructor extraction is forbidden.');
    if(functions.has(n.object.type))report(n,'Function constructor extraction is forbidden.');
   }
  },
  ObjectPattern(n) {for(const p of n.properties){const k=p.computed?constant(p.key):p.key?.name??p.key?.value;if(forbidden.has(k)||k==='constructor'||['setTimeout','setInterval'].includes(k))report(p,'Code evaluator aliases are forbidden.');}},
  CallExpression(n) {
   const k=key(n.callee);
   if(['get','getOwnPropertyDescriptor'].includes(k)&&(forbidden.has(constant(n.arguments[1]))||constant(n.arguments[1])==='constructor'))report(n,'Reflective access to code evaluators is forbidden.');
   if(['setTimeout','setInterval'].includes(k)) {
    const arg=n.arguments[0];
    const known=functions.has(arg?.type)||arg?.type==='Identifier'&&callable.has(arg.name);
    const reviewedVendorCallback=vendor&&(arg?.type==='MemberExpression'||arg?.type==='CallExpression'&&key(arg.callee)==='bind');
    if(!known&&!reviewedVendorCallback)report(n,'Timers must receive a statically known function; use an arrow callback.');
   }
  },
  NewExpression(n) {if(key(n.callee)==='constructor'&&!vendor)report(n,'Dynamic constructor calls are forbidden.');}
 });
 return [...new Set(errors)];
}

export function checkNoEvalPolicy(policy) {
 const directives=new Map(policy.split(';').map(s=>s.trim().split(/\s+/)).filter(p=>p[0]).map(([name,...values])=>[name,values]));
 const script=directives.get('script-src')||directives.get('default-src');
 return !script || script.some(s=>['\'unsafe-eval\'','\'trusted-types-eval\'','\'wasm-unsafe-eval\''].includes(s)) ? ['CSP must explicitly block dynamic code compilation.'] : [];
}
