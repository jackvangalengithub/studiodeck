import assert from 'node:assert/strict';
import {presentationSlides,visualSlides} from '../public/assets/slides.js';
const file={id:'source',name:'mixed.pdf',mime:'application/pdf',category:'presentation',has_preview:true,pages:[{number:1,has_preview:true}]};
const data={files:[file],slides:[
 {id:'a',source_version_id:'source',page_number:1,image_number:1,type:'photo',situation:'before',title:'Existing living room'},
 {id:'b',source_version_id:'source',page_number:1,image_number:2,type:'render',situation:'concept',title:'Living room proposal'},
 {id:'c',source_version_id:'source',page_number:2,image_number:1,type:'render',situation:'concept',title:'Kitchen proposal'},
 {id:'d',source_version_id:'source',page_number:3,image_number:0,type:'moodboard',situation:'reference',title:'Natural finishes'},
 {id:'e',source_version_id:'source',page_number:4,image_number:0,type:'moodboard',situation:'reference',title:'Warm finishes'}]};
const slides=presentationSlides(data),visuals=visualSlides(data);
assert.equal(slides.length,10);assert.equal(new Set(slides.map(s=>s.id)).size,10);
assert.deepEqual(visuals.map(s=>s.type),['photo','render','render','moodboard','moodboard']);
assert.equal(visuals[0].situation,'before');assert.equal(visuals[1].situation,'concept');
assert.equal(visuals[1].visual.image_number,2);assert.equal(visuals[1].visual.page_number,1);
assert.equal(visuals[2].visual.page_number,2);
assert.equal(slides.filter(s=>s.sourceOnly).length,0);
assert.equal(presentationSlides({files:[],slides:[]}).length,5);
assert.equal(visualSlides({...data,slides:[{...data.slides[1],image_version_id:'edited'}]})[0].visual.slide_image_version,'edited');
console.log('PASS Repeating slide types, separate before/concept labels, exact page/crop mapping, stable feedback IDs and generated variants.');
