import assert from 'node:assert/strict';
import {movedSlide} from '../public/assets/slide-order.js';
import {presentationSlides,groupSlideOrder} from '../public/assets/slides.js';
const full=['intro','a','hidden','b','c','summary'];
assert.deepEqual(movedSlide(full,'a','c',true),['intro','hidden','b','c','a','summary']);
assert.deepEqual(movedSlide(full,'c','a'),['intro','c','a','hidden','b','summary']);
assert.deepEqual(movedSlide(full,'a','missing'),full);
const slides=presentationSlides({slide_groups:{custom:'Materials'},slide_sections:[{slide_id:'summary',section:'custom'}]});
assert.equal(slides.find(s=>s.id==='summary').section,'custom');
assert.equal(new Set(groupSlideOrder(slides)).size,slides.length);
assert.equal(groupSlideOrder(slides).at(-1),'summary');
console.log('PASS Filtered reordering preserves all slide IDs, custom groups retain every slide.');

assert.equal(groupSlideOrder(slides,{custom:'Materials',story:'The story',budget:'The budget'})[0],'summary');
