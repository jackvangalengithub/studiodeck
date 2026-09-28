import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STUDIODECK_TEST_URL||'http://localhost:8199';
let browser,page;
before(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});page=await browser.newPage();
 await page.route('**/dom-test-host',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
 await page.goto(base+'/dom-test-host');await page.evaluate(async()=>{window.e=(await import('/assets/dom.js')).e;});
});
after(async()=>browser?.close());

test('strings, nested children and attribute values are inert text',async()=>{
 const result=await page.evaluate(()=>{
  const payload='<svg onload="window.__domXss=1"></svg> & "hello"';
  const node=e('div',{title:'" onmouseover="window.__domXss=2','data-name':payload,'aria-hidden':false},[payload,[e('strong',{},'bold'),null,false,0,7n]]);
  document.body.replaceChildren(node);
  return {text:node.textContent,nodes:[...node.children].map(c=>c.tagName),title:node.title,attribute:node.getAttribute('data-name'),aria:node.getAttribute('aria-hidden'),ran:window.__domXss};
 });
 assert.equal(result.text,'<svg onload="window.__domXss=1"></svg> & "hello"bold07');
 assert.deepEqual(result.nodes,['STRONG']);assert.equal(result.title,'" onmouseover="window.__domXss=2');
 assert.equal(result.attribute,'<svg onload="window.__domXss=1"></svg> & "hello"');assert.equal(result.aria,'false');assert.equal(result.ran,undefined);
});

test('raw HTML, event attributes, executable elements and unknown props are rejected',async()=>{
 const rejected=await page.evaluate(()=>{
  const attempts=[()=>e('script',{},'alert(1)'),()=>e('iframe',{srcdoc:'bad'}),()=>e('custom-element'),()=>e('div',{innerHTML:'<img>'}),()=>e('div',{outerHTML:'<img>'}),()=>e('div',{textContent:'implicit'}),()=>e('div',{onclick:'alert(1)'}),()=>e('div',{onClick:()=>{}}),()=>e('div',{on:{click:'alert(1)'}}),()=>e('div',{style:'background:red'}),()=>e('div',{is:'custom'}),()=>e('div',{}, {html:'<img>'}),()=>e('img',{srcset:'anything'})];
  return attempts.map(run=>{try{run();return false;}catch(error){return error instanceof TypeError;}});
 });assert.ok(rejected.every(Boolean));
});

test('URL props reject browser-normalized script schemes and data documents',async()=>{
 const results=await page.evaluate(()=>{
  const rejected=[];
  for(const [tag,prop] of [['a','href'],['img','src'],['video','poster'],['form','action']]){
   for(const url of ['javascript:alert(1)',' \nJaVaScRiPt:alert(1)','java\tscript:alert(1)','data:text/html,<script>alert(1)</script>','vbscript:msgbox(1)','file:///etc/passwd']){
    try{e(tag,{[prop]:url});rejected.push(false);}catch(error){rejected.push(error instanceof TypeError);}
   }
  }
  const link=e('a',{href:'/200/projects?name=<x>',target:'_blank',rel:'nofollow'},'Open');
  const mail=e('a',{href:'mailto:person@example.com'},'Mail');
  const blob=URL.createObjectURL(new Blob(['image']));const image=e('img',{src:blob});const preserved=image.src===blob;URL.revokeObjectURL(blob);
  return {rejected,href:link.getAttribute('href'),rel:link.rel,mail:mail.getAttribute('href'),preserved};
 });assert.ok(results.rejected.every(Boolean));assert.equal(results.href,'/200/projects?name=<x>');assert.equal(results.rel,'nofollow noopener');assert.equal(results.mail,'mailto:person@example.com');assert.equal(results.preserved,true);
});

test('function listeners, boolean props, labels and form values work',async()=>{
 const result=await page.evaluate(()=>{
  let clicks=0;const button=e('button',{type:'button',disabled:false,on:{click:()=>clicks++}},'Click');
  const field=e('input',{id:'field',value:'" <text> &',readOnly:true});const label=e('label',{htmlFor:'field'},'Name');
  const textarea=e('textarea',{value:'<b>literal</b>'});const select=e('select',{value:'b'},[e('option',{value:'a'},'A'),e('option',{value:'b'},'B')]);
  document.body.replaceChildren(button,field,label);button.click();
  return {clicks,disabled:button.disabled,value:field.value,readOnly:field.readOnly,label:label.htmlFor,textarea:textarea.value,textareaHtml:textarea.innerHTML,select:select.value};
 });assert.deepEqual(result,{clicks:1,disabled:false,value:'" <text> &',readOnly:true,label:'field',textarea:'<b>literal</b>',textareaHtml:'&lt;b&gt;literal&lt;/b&gt;',select:'b'});
});
