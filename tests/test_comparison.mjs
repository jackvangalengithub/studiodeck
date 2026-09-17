import assert from 'node:assert/strict';
import {latestSlideImageJob,comparisonPosition} from '../public/assets/comparison.js';
const jobs=[{type:'ingest',status:'running'}, {type:'slide_image_edit',slide_id:'a',status:'failed'},{type:'slide_image_edit',slide_id:'b',status:'running'},{type:'slide_image_edit',slide_id:'a',status:'queued'}];
assert.equal(latestSlideImageJob(jobs,'a').status,'queued');
assert.equal(latestSlideImageJob(jobs,'b').status,'running');
assert.equal(latestSlideImageJob(jobs,'c'),undefined);
assert.equal(comparisonPosition('new'),50);
console.log('PASS Image generation status matches its slide and the latest attempt.');
