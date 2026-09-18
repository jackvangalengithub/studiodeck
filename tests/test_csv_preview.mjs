import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseCsv,csvPreview} from '../public/assets/csv-preview.js';

test('CSV preserves quoted separators, escaped quotes, multiline values and trailing empty cells',()=>{
 assert.deepEqual(parseCsv('\uFEFFName,Note,Price\r\n"Oak, light","He said ""yes""\r\nTwice",\r\nPine,,12\r\n').rows,[['Name','Note','Price'],['Oak, light','He said "yes"\r\nTwice',''],['Pine','','12']]);
});
test('CSV detects European and tab-separated exports and Excel separator hints',()=>{
 for(const delimiter of [';','\t','|'])assert.deepEqual(parseCsv(`Name${delimiter}Price\nOak${delimiter}12,50`).rows,[['Name','Price'],['Oak','12,50']]);
 assert.deepEqual(parseCsv('sep=;\r\nName;Price\r\nOak;12,50').rows,[['Name','Price'],['Oak','12,50']]);
 assert.deepEqual(parseCsv('Name\nOak\n').rows,[['Name'],['Oak']]);
});
test('CSV handles empty files, missing cells and limits large previews',()=>{
 assert.deepEqual(parseCsv('').rows,[]);
 assert.deepEqual(parseCsv('""').rows,[['']]);
 assert.deepEqual(parseCsv('Name,Price\nOak').rows,[['Name','Price'],['Oak','']]);
 const large=parseCsv('Name,Price\n'+Array.from({length:1000},()=> 'Oak,10').join('\n'));
 assert.equal(large.rows.length,201);assert.equal(large.truncated,true);
 const wide=parseCsv(Array.from({length:55},(_,i)=>i).join(','));
 assert.equal(wide.rows[0].length,50);assert.equal(wide.truncated,true);
 assert.equal(parseCsv('x'.repeat(1000001)).truncated,true);
});
test('preview escapes every source cell and keeps formulas as text',()=>{
 const escaped=[],html=csvPreview('Name,Value\n<script>,=SUM(A1:A2)',value=>{escaped.push(value);return String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');});
 assert.ok(escaped.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('=SUM(A1:A2)'));
});
