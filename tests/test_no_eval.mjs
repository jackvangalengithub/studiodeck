import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkNoEval,checkNoEvalPolicy} from '../scripts/check-no-eval.mjs';
import {browserPolicy} from '../scripts/browser-policy.mjs';

test('no-eval guard rejects evaluator references, aliases and constructor extraction',()=>{
 for(const code of [
  'eval(code)','(0, eval)(code)','const run=eval;run(code)','window.eval.call(null,code)',
  'const {eval:run}=window;run(code)','window["ev"+"al"](code)',
  'new Function(code)','new window.Function(code)','const Compile=Function;new Compile(code)',
  'AsyncFunction(code)','GeneratorFunction(code)','AsyncGeneratorFunction(code)',
  '(()=>{}).constructor(code)()', '(async()=>{}).constructor(code)()',
  'const f=()=>{}; const compile=f.constructor; compile(code)',
  'const {constructor:compile}=fn', 'Reflect.get(window,"eval")(code)',
  'Object.getOwnPropertyDescriptor(window,"Function").value(code)',
  'Reflect.construct(Function,[code])',
  'setTimeout(code,0)','window.setInterval(code,0)','setTimeout("alert(1)",0)',
  'const timer=setTimeout;timer(code,0)','const {setTimeout:timer}=window;timer(code,0)',
 ])assert.ok(checkNoEval(code).length,code);
});
test('normal functions and non-compiling Function utilities remain allowed',()=>{
 assert.deepEqual(checkNoEval('const call=Function.prototype.call.bind(Object.prototype.hasOwnProperty); const ok=listener instanceof Function;setTimeout(()=>listener(),0);function next(){};setInterval(next,10);'),[]);
});
test('every deployed CSP and the development policy block code compilation',async()=>{
 assert.deepEqual(checkNoEvalPolicy(browserPolicy),[]);
 for(const permission of ["'unsafe-eval'","'wasm-unsafe-eval'","'trusted-types-eval'"])
  assert.ok(checkNoEvalPolicy("script-src 'self' "+permission).length);
 assert.ok(checkNoEvalPolicy("object-src 'none'").length);
 const caddy=await readFile('docker/Caddyfile','utf8');
 const policies=[...caddy.matchAll(/header Content-Security-Policy "([^"]+)"/g)];assert.ok(policies.length>=3);
 for(const [,policy]of policies)assert.deepEqual(checkNoEvalPolicy(policy),[]);
});
