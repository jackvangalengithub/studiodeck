import assert from 'node:assert/strict';
import {imageBounds,sameAnnotationImage} from '../public/assets/annotations.js';
assert.deepEqual(imageBounds(800,600,1000,500),{x:0,y:100,width:800,height:400});
assert.deepEqual(imageBounds(800,600,1000,500,'cover'),{x:-200,y:0,width:1200,height:600});
const a={source_version_id:'v1',page_number:1,image_number:2,image_version_id:''};
assert.ok(sameAnnotationImage(a,{...a,page_number:'1'}));
for(const [key,value] of Object.entries({source_version_id:'v2',page_number:2,image_number:3,image_version_id:'ai'}))assert.equal(sameAnnotationImage(a,{...a,[key]:value}),false);
console.log('PASS image geometry and pin version isolation');
