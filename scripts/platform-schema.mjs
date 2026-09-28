// Regenerate only the local adapter schema. The source backend is never modified.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const source=process.argv.find(arg=>arg.endsWith('.json'))||resolve(process.env.HOME,'platform/apps/studiodeck/docs/api/openapi.json');
const spec=JSON.parse(await readFile(source,'utf8')),tables={};
for(const [path,entry] of Object.entries(spec.paths)){const name=path.split('/').at(-1);if(entry.post&&spec.components.schemas[name]?.properties)tables[name]=spec.components.schemas[name].properties;}
const target=new URL('../public/assets/platform/schema.js',import.meta.url);
const output='// Snapshot of the StudioDeck platform OpenAPI table fields; no runtime schema discovery.\nexport const schema='+JSON.stringify(tables)+';\n';
if(process.argv.includes('--check')){if(await readFile(target,'utf8')!==output)throw Error('Platform schema snapshot is stale. Run node scripts/platform-schema.mjs.');console.log('Platform schema snapshot matches OpenAPI.');}
else{await writeFile(target,output);console.log('Updated local platform schema snapshot.');}
