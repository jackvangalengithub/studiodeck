import assert from 'node:assert/strict';
import {extractionProgress} from '../public/assets/progress.js';
import {setLanguage} from '../public/assets/i18n.js';
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
const parallel=(completed,total,active=0)=>extractionProgress({status:'running',progress:{stage:'classifying_pages',completed,total,active}});
assert.equal(parallel(0,8,4).percent,20);
assert.equal(parallel(4,8,4).percent,50);
assert.equal(parallel(8,8).percent,80);
assert.match(parallel(4,8,4).detail,/4 of 8 pages processed · 4 in progress/);
assert.doesNotMatch(parallel(8,8).detail,/in progress/);
assert.ok(Number.isFinite(parallel(0,0).percent));
assert.equal(extractionProgress({status:'running',progress:{stage:'classifying_pages',page:8,completed:2,total:8}}).percent,35);
setLanguage('nl');
assert.match(parallel(4,8,4).detail,/4 van 8 pagina’s verwerkt · 4 bezig/);
setLanguage('en');
console.log('PASS Parallel page counts drive progress in English and Dutch while legacy counters remain supported.');
