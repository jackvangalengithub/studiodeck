import assert from 'node:assert/strict';
import {MAX_FILE_BYTES,MAX_BATCH_BYTES,uploadSelectionError} from '../public/assets/upload-limits.js';
const file=(size,name='design.pdf')=>({name,size});
assert.equal(MAX_FILE_BYTES,23*1024*1024);
assert.equal(uploadSelectionError([file(MAX_FILE_BYTES)]),'');
assert.match(uploadSelectionError([file(MAX_FILE_BYTES+1,'Large design.pdf')]),/Large design.pdf.*23 MiB/);
assert.match(uploadSelectionError([file(33*1024*1024)]),/23 MiB/);
assert.equal(uploadSelectionError([file(MAX_BATCH_BYTES/2),file(MAX_BATCH_BYTES/2)]),'');
assert.match(uploadSelectionError([file(MAX_BATCH_BYTES/2+1),file(MAX_BATCH_BYTES/2)]),/23 MiB.*per upload/);
assert.equal(uploadSelectionError(Array.from({length:25},()=>file(1))),'');
assert.match(uploadSelectionError(Array.from({length:26},()=>file(1))),/25 files/);
// Base64 plus envelope headroom fits the current platform's 32 MiB body limit.
assert.ok(Math.ceil(MAX_BATCH_BYTES/3)*4+65536<32*1024*1024);
console.log('PASS platform file count and JSON/base64 upload boundaries.');
