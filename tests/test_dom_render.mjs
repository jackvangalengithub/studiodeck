import test from 'node:test';
import assert from 'node:assert/strict';
import {renderNode} from './helpers/render.mjs';
import {e,safeUrl} from '../public/assets/dom.js';
import * as view from '../public/assets/render.js';
const payload='<img src=x onerror="globalThis.pwned=1"> & </textarea><svg onload=alert(1)>';

test('composed views preserve literal user text and quoted attributes',()=>{
 const root=renderNode(view.element('div',[{title:payload}], [view.concat(view.element('strong',[],['Name: ']),payload)]));
 assert.equal(root.textContent,'Name: '+payload);assert.equal(root.querySelectorAll('img,svg,script').length,0);assert.equal(root.firstChild.title,payload);
});
test('translations and nested lists keep icons structural and content textual',()=>{
 const root=renderNode(view.interpolate('{icon} {name}',{icon:view.element('b',[],['!']),name:payload}));
 assert.equal(root.querySelector('b').textContent,'!');assert.equal(root.textContent,'! '+payload);assert.equal(root.querySelector('img'),null);
 const list=renderNode(view.join([view.element('li',[],[payload]),view.element('li',[],['second'])],''));assert.equal(list.querySelectorAll('li').length,2);
});
test('API-shaped objects and raw attribute fragments cannot impersonate UI',()=>{
 for(const data of [{tag:'script',children:['run()']},{html:payload},{toString:()=>payload}])assert.throws(()=>renderNode(data),TypeError);
 assert.throws(()=>view.spread('onclick="run()"'),TypeError);
 assert.throws(()=>renderNode(view.element('div',[view.spread(view.attributes([{onclick:'run()'}]))],[])),TypeError);
 const root=renderNode(view.element('button',[view.spread(view.attributes([{'data-name':payload,disabled:true}]))],['Click']));
 assert.equal(root.firstChild.getAttribute('data-name'),payload);assert.ok(root.firstChild.hasAttribute('disabled'));
});
test('URL, CSS and iframe contexts are validated separately from text',()=>{
 for(const url of ['javascript:alert(1)','java\tscript:alert(1)','data:text/html,bad','vbscript:bad'])assert.throws(()=>safeUrl(url,'href'),TypeError);
 assert.throws(()=>e('div',{style:'background:url(https://evil.test/)'}),TypeError);
 assert.throws(()=>e('div',{style:'background:u\\72l(foo)'}),TypeError);
 assert.equal(e('div',{style:'color:red'}).style.color,'red');
 assert.throws(()=>e('iframe',{src:'/preview',sandbox:'allow-scripts allow-same-origin'}),TypeError);
 assert.throws(()=>e('iframe',{src:'/preview',sandbox:null}),TypeError);
 assert.throws(()=>e('iframe',{src:'/preview',sandbox:'ALLOW-SAME-ORIGIN'}),TypeError);
 assert.equal(e('iframe',{src:'/preview',sandbox:'allow-scripts'}).getAttribute('sandbox'),'allow-scripts');
 assert.throws(()=>safeUrl('blob:https://studiodeck.test/a','href'),TypeError);
 assert.equal(safeUrl('blob:https://studiodeck.test/a','href',true),'blob:https://studiodeck.test/a');
});

test('communication names, mentions and editable message bodies preserve literal text',async()=>{
 const {summaryPerson,plainMessageFields,composerFields}=await import('../public/assets/communication-composer.js');
 const {mentionBody}=await import('../public/assets/mentions.js');
 const person=renderNode(summaryPerson('Contact',payload,'A & B'));
 assert.equal(person.querySelector('strong').textContent,payload);assert.equal(person.querySelector('small').textContent,'A & B');assert.equal(person.querySelector('img'),null);
 const fields=renderNode(plainMessageFields({body:payload}));assert.equal(fields.querySelector('textarea').textContent,payload);
 const compose=renderNode(composerFields({body:payload,people:[{name:payload,email:'a@example.test',group:'clients'}]}));assert.equal(compose.querySelector('textarea').textContent,payload);assert.equal(compose.querySelector('img'),null);
 const message=renderNode(mentionBody('Hi @Alex & '+payload,[{label:'Alex',email:'alex@example.test'}]));assert.equal(message.textContent,'Hi @Alex & '+payload);assert.equal(message.querySelectorAll('.chat-mention').length,1);assert.equal(message.querySelector('img'),null);
});

test('descriptions snapshot their props and unchanged polling preserves existing nodes',()=>{
 const props={title:'original'},children=['first'];const description=view.element('button',[props],children);
 props.title='changed';children[0]='changed';const root=renderNode(description);
 assert.equal(root.firstChild.title,'original');assert.equal(root.textContent,'first');
 view.update(root,view.element('button',[],['Ready']));const button=root.firstChild;
 view.update(root,view.element('button',[],['Ready']));assert.equal(root.firstChild,button);
 view.update(root,view.element('button',[],['Finished']));assert.notEqual(root.firstChild,button);assert.equal(root.textContent,'Finished');
});

test('communication previews use safe image URLs and literal fallback labels',async()=>{
 const {commentPreviewImage}=await import('../public/assets/comment-preview.js');
 const image=renderNode(commentPreviewImage({id:'c',preview_url:'/200/userfiles/file?size=small'},payload));
 assert.equal(image.querySelector('img').getAttribute('src'),'/200/userfiles/file?size=small');assert.equal(image.querySelector('img').alt,payload);
 const fallback=renderNode(commentPreviewImage({id:'text'},payload));assert.equal(fallback.textContent,payload);assert.equal(fallback.querySelector('img,svg,script'),null);
 assert.throws(()=>renderNode(commentPreviewImage({id:'bad',preview_url:'javascript:alert(1)'},'Bad')),TypeError);
});
