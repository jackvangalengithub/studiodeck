import assert from 'node:assert/strict';
import {extractionProgress} from '../public/assets/progress.js';
const progress=(stage,page,total=31)=>extractionProgress({status:'running',progress:{stage,page,total}});
let previous=0;
for(const stage of ['extracting_text','classifying_pages','extracting_images','extracting_colors','analyzing_moodboard']){
    for(let page=1;page<=31;page++){
        const p=progress(stage,page);
        assert.ok(p.percent>=previous,`${stage} page ${page} must not reset overall progress`);
        assert.ok(p.detail.includes(`page ${page} of 31`));
        previous=p.percent;
    }
}
for(const stage of ['finding_style','classifying_images','applying_results']){
    const p=progress(stage);
    assert.ok(p.percent>=previous);previous=p.percent;
}
assert.match(progress('classifying_pages',1).detail,/Step 2 of 5 · Classifying page 1 of 31/);
assert.match(progress('extracting_images',1).detail,/Step 3 of 5 · Cropping page 1 of 31/);
assert.equal(extractionProgress({status:'queued'}).percent,0);
assert.equal(extractionProgress({status:'done'}).percent,100);
assert.ok(Number.isFinite(progress('reading_pages',1,0).percent));
console.log('PASS 31-page phase transitions keep overall progress moving forward and label each page counter.');
