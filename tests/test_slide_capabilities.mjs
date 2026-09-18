import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canAiEditSlide,slideTypeCapabilities,visualTypes} from '../public/assets/slides.js';

const source=fileURLToPath(new URL('../app/slides.php',import.meta.url));
const backend=JSON.parse(execFileSync(process.env.PHP_BIN||'php',['-r',`require ${JSON.stringify(source)}; echo json_encode(SLIDE_TYPE_CAPABILITIES);`],{encoding:'utf8'}));
assert.deepEqual(slideTypeCapabilities,backend,'Browser and server enforce the same type capabilities');
assert.deepEqual(Object.keys(slideTypeCapabilities),Object.keys(visualTypes));
for(const type of ['moodboard','floorplan','text','video','intro','source','unknown','toString'])assert.equal(canAiEditSlide(type),false,type);
for(const type of ['photo','render','drawing','other','fullphoto'])assert.equal(canAiEditSlide(type),true,type);
assert.throws(()=>{slideTypeCapabilities.moodboard.ai_edit=true;},TypeError);
console.log('Slide AI capabilities agree across browser/server; unsupported types fail closed.');
