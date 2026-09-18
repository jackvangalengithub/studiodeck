import assert from 'node:assert/strict';
import {presentationSlides,visualSlides,groupSlideOrder} from '../public/assets/slides.js';
const file={id:'source',name:'mixed.pdf',mime:'application/pdf',category:'presentation',has_preview:true,pages:[{number:1,has_preview:true}]};
const data={files:[file],slides:[
 {id:'a',source_version_id:'source',page_number:1,image_number:1,type:'photo',situation:'before',title:'Existing living room'},
 {id:'b',source_version_id:'source',page_number:1,image_number:2,type:'render',situation:'concept',title:'Living room proposal'},
 {id:'c',source_version_id:'source',page_number:2,image_number:1,type:'render',situation:'concept',title:'Kitchen proposal'},
 {id:'d',source_version_id:'source',page_number:3,image_number:0,type:'moodboard',situation:'reference',title:'Natural finishes'},
 {id:'e',source_version_id:'source',page_number:4,image_number:0,type:'moodboard',situation:'reference',title:'Warm finishes'}]};
const slides=presentationSlides(data),visuals=visualSlides(data);
assert.equal(slides.length,11);assert.equal(new Set(slides.map(s=>s.id)).size,11);
assert.deepEqual(visuals.map(s=>s.type),['photo','render','render','moodboard','moodboard']);
assert.equal(visuals[0].situation,'before');assert.equal(visuals[1].situation,'concept');
assert.equal(visuals[1].visual.image_number,2);assert.equal(visuals[1].visual.page_number,1);
assert.equal(visuals[2].visual.page_number,2);
assert.equal(slides.filter(s=>s.sourceOnly).length,0);
assert.equal(presentationSlides({files:[],slides:[]}).length,6);
assert.equal(visualSlides({...data,slides:[{...data.slides[1],image_version_id:'edited'}]})[0].visual.slide_image_version,'edited');
console.log('PASS Repeating slide types, separate before/concept labels, exact page/crop mapping, stable feedback IDs and generated variants.');

const arranged={...data,slide_layout:[{slide_id:'visual-c',position:0},{slide_id:'intro',position:1,hidden:1},{slide_id:'visual-a',position:2,deleted:1}]};
assert.equal(presentationSlides(arranged).filter(s=>s.section==='designs')[0].id,'visual-c');
assert.equal(presentationSlides(arranged).some(s=>['intro','visual-a'].includes(s.id)),false);
assert.equal(presentationSlides(arranged,{includeHidden:true}).some(s=>s.id==='intro'&&s.hidden),true);
assert.equal(presentationSlides(arranged,{includeHidden:true}).some(s=>s.id==='visual-a'),false);
assert.equal(presentationSlides({...data,slide_layout:slides.map(s=>({slide_id:s.id,hidden:1}))}).length,0);
assert.equal(presentationSlides({...data,slide_layout:slides.map(s=>({slide_id:s.id,deleted:1}))},{includeHidden:true}).length,0);
console.log('PASS Custom ordering, hidden editor slides, deletion without fallback duplication, and empty presentations.');
const excludedPage={...file,pages:[{number:1,has_preview:true,include_in_presentation:false}]};
assert.equal(presentationSlides({files:[excludedPage],slides:[]}).some(s=>s.sourceOnly),false);
console.log('PASS Branding-only/text pages cannot reappear through source-page fallback slides.');

const grouped=presentationSlides({...data,slide_sections:[{slide_id:'visual-b',section:'current'}]});
assert.equal(grouped.find(s=>s.id==='visual-a').section,'current');
assert.equal(grouped.find(s=>s.id==='visual-b').section,'current');
assert.equal(grouped.find(s=>s.id==='visual-d').section,'moodboards');
assert.equal(groupSlideOrder(grouped).at(-1),'open-questions');
console.log('PASS Default and custom slide sections produce a complete grouped order.');

assert.equal(slides.find(s=>s.id==='open-questions').section,'questions');
assert.equal(slides.filter(s=>s.section==='questions').length,1);
console.log('PASS Open questions has its own presentation section.');

const repeated={files:[],system_slides:[{id:'system-first',type:'budget'},{id:'system-later',type:'budget'}],slide_content:[{slide_id:'budget',title:'Shared investment',description:'Live costs'}],slide_sections:[{slide_id:'system-later',section:'story'}],slide_layout:[{slide_id:'budget',deleted:1},{slide_id:'system-first',hidden:1}]};
const repeatedSlides=presentationSlides(repeated,{includeHidden:true});
assert.deepEqual(repeatedSlides.filter(s=>s.type==='budget').map(s=>s.id),['system-later','system-first']);
assert.ok(repeatedSlides.filter(s=>s.type==='budget').every(s=>s.title==='Shared investment'&&s.description==='Live costs'&&s.systemType==='budget'));
assert.equal(presentationSlides(repeated).filter(s=>s.type==='budget').length,1);
repeated.slide_content[0].title='Updated on either copy';
assert.ok(presentationSlides(repeated,{includeHidden:true}).filter(s=>s.type==='budget').every(s=>s.title==='Updated on either copy'));
console.log('PASS Repeated system slides share live content, retain independent identity, visibility and groups, and survive deletion of the original.');
