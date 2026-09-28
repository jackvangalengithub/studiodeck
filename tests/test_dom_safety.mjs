import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkJavaScript,checkHTML,checkTree} from '../scripts/check-dom-safety.mjs';
import {browserPolicy} from '../scripts/browser-policy.mjs';

test('source guard rejects direct and computed HTML sinks, code and active props',()=>{
 for(const code of [
  'node.innerHTML = value', 'node["inner" + "HTML"] = value', 'node.outerHTML = value',
  'node.insertAdjacentHTML("beforeend", value)', 'node.srcdoc = value',
  'new DOMParser().parseFromString(value,"text/html")', 'range.createContextualFragment(value)',
  'document.write(value)', 'window.document.writeln(value)', 'node.setHTMLUnsafe(value)',
  'Object.assign(node,{innerHTML:value})', 'const {innerHTML} = node',
  'trustedTypes.createPolicy("unsafe", {})', 'eval(value)', 'new Function(value)',
  'setTimeout("run()",0)', 'node.setAttribute("onclick",value)', 'node.setAttribute(name,value)',
  'node.href=value', 'location.assign(value)', 'document.createElement("script")',
  'document.createElement(name)', 'e("div",{onclick:"alert(1)"})',
 ])assert.ok(checkJavaScript(code).length,code);
});
test('guard accepts node composition, safe URLs, function listeners and database writes',()=>{
 assert.deepEqual(checkJavaScript('node.replaceChildren(e("p", {on:{click:()=>go()}}, value)); node.textContent=value; image.src=safeUrl(value,"src"); client.write(data); document.addEventListener("click", listener, {once:true});'),[]);
});
test('HTML guard rejects inline handlers and executable scripts',()=>{
 for(const html of ['<img onerror="run()">','<script>run()</script>','<iframe srcdoc="bad"></iframe>','<a href="javascript:run()">Go</a>'])assert.ok(checkHTML(html,'fixture.html').length);
 assert.deepEqual(checkHTML('<script type="module" src="/assets/app.js"></script><script type="application/json">{}</script>','fixture.html'),[]);
});
test('all shipped source passes and every shell carries the enforced browser policy',async()=>{
 assert.deepEqual((await checkTree(new URL('../public',import.meta.url).pathname)).errors,[]);
 for(const file of ['public/index.html','public/conversation.html','public/mock/index.html'])assert.ok((await readFile(file,'utf8')).includes(`content="${browserPolicy}"`),file);
 const caddy=await readFile('docker/Caddyfile','utf8');assert.ok(caddy.includes(`header Content-Security-Policy "${browserPolicy}"`));
 assert.ok((await readFile('Dockerfile','utf8')).includes('RUN npm test'));
});
