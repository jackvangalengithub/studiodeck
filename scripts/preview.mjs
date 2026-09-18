// Optional dependency-free server for the fictional UI demo. The application uses PHP.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(import.meta.dirname,'../public');
const portIndex=process.argv.indexOf('--port');
const port=Number(portIndex>=0?process.argv[portIndex+1]:process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.pdf':'application/pdf','.csv':'text/csv; charset=utf-8','.webm':'video/webm','.vtt':'text/vtt; charset=utf-8'};
createServer(async(req,res)=>{try{const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/')||(!path.startsWith('/assets/')&&path!=='/'&&path!=='/index.html')){res.writeHead(404);res.end('Not found');return;}let body=await readFile(file);if(extname(file)==='.html')body=Buffer.from(body.toString().replace('<script type="module"','<script>window.STUDIODECK_DEMO=true;</script><script type="module"'));res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'0.0.0.0',()=>process.stdout.write(`Local: http://localhost:${port}/\n`));
