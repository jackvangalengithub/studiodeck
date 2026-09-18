import assert from 'node:assert/strict';
import {movedSlide} from '../public/assets/slide-order.js';
import {presentationSlides,groupSlideOrder,slideSections} from '../public/assets/slides.js';
const full=['intro','a','hidden','b','c','summary'];
assert.deepEqual(movedSlide(full,'a','c',true),['intro','hidden','b','c','a','summary']);
assert.deepEqual(movedSlide(full,'c','a'),['intro','c','a','hidden','b','summary']);
assert.deepEqual(movedSlide(full,'a','missing'),full);
const slides=presentationSlides({slide_groups:{...slideSections,custom:'Materials'},slide_sections:[{slide_id:'summary',section:'custom'}]});
assert.equal(slides.find(s=>s.id==='summary').section,'custom');
assert.equal(new Set(groupSlideOrder(slides)).size,slides.length);
assert.equal(groupSlideOrder(slides).at(-1),'summary');
console.log('PASS Filtered reordering preserves all slide IDs, custom groups retain every slide.');

assert.equal(groupSlideOrder(slides,{custom:'Materials',story:'The story',budget:'The budget'})[0],'summary');

// Old saved positions can interleave groups. Every view must keep groups contiguous.
const file={id:'file',name:'designs.pdf',mime:'application/pdf',category:'presentation'};
const groupedData={files:[file],slides:[
 {id:'before',source_version_id:'file',type:'photo',situation:'before'},
 {id:'design-a',source_version_id:'file',type:'render',situation:'concept'},
 {id:'design-b',source_version_id:'file',type:'render',situation:'concept'},
 {id:'mood',source_version_id:'file',type:'moodboard',situation:'reference'}],
 slide_groups:{story:'Story',current:'Current',moodboards:'Moodboards',designs:'Designs',budget:'Budget',custom:'Materials',questions:'Questions'},
 slide_sections:[{slide_id:'summary',section:'custom'}],
 slide_layout:['visual-design-b','budget','open-questions','intro','visual-mood','visual-design-a','summary','visual-before','changes','contacts'].map((slide_id,position)=>({slide_id,position}))};
const ordered=presentationSlides(groupedData);
assert.deepEqual(ordered.map(s=>s.id),['intro','changes','contacts','visual-before','visual-mood','visual-design-b','visual-design-a','budget','summary','open-questions']);
assert.deepEqual([...new Set(ordered.map(s=>s.section))],Object.keys(groupedData.slide_groups));
assert.deepEqual(presentationSlides({...groupedData,slide_groups:{custom:'Materials',designs:'Designs',budget:'Budget',story:'Story',current:'Current',moodboards:'Moodboards',questions:'Questions'}}).map(s=>s.id),['summary','visual-design-b','visual-design-a','budget','intro','changes','contacts','visual-before','visual-mood','open-questions']);
const withinGroup={...groupedData,slide_layout:movedSlide(ordered.map(s=>s.id),'visual-design-a','visual-design-b').map((slide_id,position)=>({slide_id,position}))};
assert.deepEqual(presentationSlides(withinGroup).filter(s=>s.section==='designs').map(s=>s.id),['visual-design-a','visual-design-b']);
const filtered={...groupedData,slide_layout:groupedData.slide_layout.map(s=>({...s,hidden:s.slide_id==='visual-design-b'?1:0,deleted:s.slide_id==='visual-mood'?1:0}))};
assert.deepEqual(presentationSlides(filtered).map(s=>s.id),['intro','changes','contacts','visual-before','visual-design-a','budget','summary','open-questions']);
assert.deepEqual(presentationSlides(filtered,{includeHidden:true}).filter(s=>s.section==='designs').map(s=>s.id),['visual-design-b','visual-design-a']);
assert.deepEqual(presentationSlides({...groupedData,slides:[...groupedData.slides,{id:'new',source_version_id:'file',type:'render',situation:'concept'}]}).filter(s=>s.section==='designs').map(s=>s.id),['visual-design-b','visual-design-a','visual-new']);
console.log('PASS Group order takes priority over saved positions; within-group moves, custom groups, hidden/deleted slides and new slides stay ordered.');

// A removed built-in group stays absent, and new slides use a remaining group.
const remaining=presentationSlides({slide_groups:{custom:'Materials'},slide_sections:[{slide_id:'summary',section:'story'}]});
assert.ok(remaining.every(s=>s.section==='custom'));
assert.equal(remaining.length,6);
console.log('PASS Removed default groups are not recreated and their slides retain a valid group.');
