import assert from 'node:assert/strict';
import {test} from 'node:test';
import en from '../public/assets/languages/en.js';
import nl from '../public/assets/languages/nl.js';
import {resolveLanguage,setLanguage,tr,numberLocale,dateLocale} from '../public/assets/i18n.js';
import {presentationSlides,slideSections,visualTypes} from '../public/assets/slides.js';
import {csvPreview} from '../public/assets/csv-preview.js';

test('catalogues have matching keys, placeholders and nonempty translations',()=>{
 assert.deepEqual(Object.keys(nl).sort(),Object.keys(en).sort());
 for(const [key,value] of Object.entries(en)){
  assert.ok(nl[key]?.trim(),key);
  assert.deepEqual(nl[key].match(/\{\w+\}/g)?.sort(),value.match(/\{\w+\}/g)?.sort(),key);
 }
});
test('user overrides project; project overrides studio; English is the fallback',()=>{
 for(const studio of ['en','nl'])for(const project of ['','en','nl'])for(const user of ['','en','nl'])
  assert.equal(resolveLanguage({studio,project,user}),user||project||studio);
 assert.equal(resolveLanguage(), 'en');
 assert.equal(resolveLanguage({studio:'fr',project:null,user:'de'}),'en');
});
test('switching language translates built-ins without changing project content or slide IDs',()=>{
 const data={files:[],slide_content:[{slide_id:'intro',title:'My English title',description:'Do not translate'}],slide_groups:{custom:'The story'}};
 setLanguage('en');const english=presentationSlides(data);
 assert.equal(english.find(s=>s.id==='budget').title,'The investment');
 setLanguage('nl');const dutch=presentationSlides(data);
 assert.deepEqual(dutch.map(s=>s.id),english.map(s=>s.id));
 assert.equal(dutch.find(s=>s.id==='budget').title,'De investering');
 assert.equal(dutch.find(s=>s.id==='intro').title,'My English title');
 assert.equal(dutch.find(s=>s.id==='intro').description,'Do not translate');
 assert.equal(slideSections.story,'Het verhaal');assert.equal(visualTypes.floorplan,'Plattegrond');
 assert.equal(tr('comment_count',{count:1}),'1 reactie');assert.equal(tr('comment_count',{count:3}),'3 reacties');
 assert.equal(numberLocale(),'nl-NL');assert.equal(dateLocale(),'nl-NL');
 const preview=csvPreview('Budget,Source files\n1,Original',x=>x);
 assert.ok(preview.includes('1 gegevensrij'));assert.ok(preview.includes('Budget'));assert.ok(preview.includes('Source files'));assert.ok(preview.includes('Original'));
 setLanguage('en');assert.equal(slideSections.story,'The story');assert.equal(numberLocale(),'en-IE');assert.equal(dateLocale(),'en-GB');
});

test('workspace catalogues preserve interpolation values and translate on language changes',async()=>{
 const {default:studioEn}=await import('../public/assets/languages/studio-en.js');
 const {default:studioNl}=await import('../public/assets/languages/studio-nl.js');
 const {processingSteps,extractionStages}=await import('../public/assets/progress.js');
 const {imagePresets,customImagePlaceholder}=await import('../public/assets/image-presets.js');
 const {studioPalettes}=await import('../public/assets/studio.js');
 assert.deepEqual(Object.keys(studioNl).sort(),Object.keys(studioEn).sort());
 // Dutch uses count-first phrasing in these messages instead of English plural suffixes.
 const omittedSuffixes=new Set(['studio_subquote_linked_automatically_open_a_cost_to_see_the_source_evidence_or_undo_its_link','studio_ai_enhancement_left','studio_file_selected','studio_file_processed_explore_the_extracted_pages_images_and_palette','studio_extraction_note_to_review_in_files','studio_extracted_image_2','studio_team_member','studio_designer_active_projects','studio_day_left_in_your_trial_ends']);
 for(const [key,value] of Object.entries(studioEn)){
  assert.ok(studioNl[key]?.trim(),key);
  const english=value.match(/\{\w+\}/g)||[],dutch=studioNl[key].match(/\{\w+\}/g)||[];
  assert.ok(dutch.every(token=>english.includes(token)),key+' introduces an unknown placeholder');
  if(!omittedSuffixes.has(key))assert.deepEqual(dutch.sort(),english.sort(),key);
 }
 setLanguage('nl');
 assert.equal(tr('studio_project_settings'),'Projectinstellingen');
 assert.equal(processingSteps[0],'Pagina’s en tekst lezen');
 assert.equal(imagePresets.photorealistic.label,'Fotorealistisch maken');
 assert.match(customImagePlaceholder(),/Beschrijf/);
 assert.equal(studioPalettes.sage.name,'Salie en linnen');
 assert.equal(tr('studio_file_selected',{v0:2,v1:'s',v2:'Google Drive'}),'Geselecteerde bestanden: 2 · Google Drive');
 assert.ok(tr('studio_your_designer').includes('{{designer_name}}'));
 setLanguage('en');
 assert.equal(processingSteps[0],'Read pages & text');
 assert.equal(extractionStages.reading_pages,'Reading document pages');
 assert.equal(imagePresets.photorealistic.label,'Make photorealistic');
 assert.match(customImagePlaceholder(),/^Describe/);
 assert.equal(tr('studio_file_selected',{v0:2,v1:'s',v2:'Google Drive'}),'2 files selected · Google Drive');
});
