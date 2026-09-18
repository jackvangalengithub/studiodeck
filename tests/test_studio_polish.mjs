/** Browser acceptance checks; all API responses are fictional fixtures.
 * Run: node --test tests/test_studio_polish.mjs
 * Requires Playwright and Chromium; optional PLAYWRIGHT_MODULE / CHROMIUM_PATH.
 * Targets interpret request 10: wider than 560px, two palette columns,
 * desktop editor <=64px, mobile editor <=15vh, >9 sparkles, cycle <2.8s.
 */
import assert from 'node:assert/strict';
import {after, before, test} from 'node:test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve, extname} from 'node:path';
import {demoRequest} from '../public/assets/demo.js';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
let server,browser,base;
const deck=await demoRequest('project',{id:'van-galen'});
deck.can_edit=true;
deck.slides=[{id:'polish-slide',source_version_id:deck.files[0].id,title:'Living room concept',type:'render',situation:'concept',metadata:{}}];
const studio={id:'polish-studio',name:'Acceptance test studio',role:'admin'};
const session={user:{id:'test-admin',name:'Test admin'},csrf:'fixture',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:false,mail:false}};

before(async()=>{
    server=createServer(async(req,res)=>{
        try{
            const path=new URL(req.url,'http://localhost').pathname;
            const file=path.startsWith('/assets/')?resolve(root,'.'+path):resolve(root,'index.html');
            if(!file.startsWith(root)){res.writeHead(404);res.end();return;}
            const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'};
            res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
            res.end(await readFile(file));
        }catch{res.writeHead(404);res.end();}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    base=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});

async function pageFor(t,{width=1440,height=900,client=false,readonly=false,job=null}={}){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference'});
    page.setDefaultTimeout(5000);
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    t.after(async()=>{await page.close();assert.deepEqual(errors,[],'No browser script errors or unexpected requests');});
    const data=structuredClone(deck);
    data.can_edit=!readonly;
    if(job)data.jobs=[{id:'fixture-image-job',type:'slide_image_edit',slide_id:'polish-slide',status:job}];
    // Block external traffic and mock every API request: never contact a live account.
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base){await route.abort();return;}
        if(url.pathname!=='/api.php'){await route.continue();return;}
        const action=url.searchParams.get('action');
        const replies={session,project:data,deck:data,projects:{projects:[]},view_event:{ok:true},mark_comments_read:{ok:true}};
        if(!(action in replies)){errors.push(`Unexpected API request: ${action}`);await route.fulfill({status:500,json:{error:'Unexpected fixture request'}});return;}
        await route.fulfill({json:replies[action]});
    });
    await page.goto(client?`${base}/?slide=visual-polish-slide#/view/fixture-token`:`${base}/${studio.id}/slide/visual-polish-slide?project=van-galen&iteration=it-2`);
    await page.locator('.presentation').waitFor();
    return page;
}
async function settings(t,viewport){
    const page=await pageFor(t,viewport);
    // Test dialog layout independently from mobile sidebar accessibility.
    await page.goto(`${base}/${studio.id}/settings`);
    await page.getByRole('dialog').waitFor();
    return page;
}

test('Studio settings is wider than the original 560px desktop modal',async t=>{
    const page=await settings(t);
    const box=await page.getByRole('dialog').boundingBox();
    assert.ok(box.width>560,`Expected width >560px; measured ${box.width}px`);
});
test('Studio settings palette options form two desktop columns',async t=>{
    const page=await settings(t);
    const columns=await page.locator('.studio-palette-options .studio-choice').evaluateAll(nodes=>new Set(nodes.map(n=>Math.round(n.getBoundingClientRect().left))).size);
    assert.equal(columns,2,`Expected two option columns; measured ${columns}`);
});
test('Studio settings fits mobile and retains every setting and save/cancel',async t=>{
    const page=await settings(t,{width:390,height:844});
    const fits=await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;});
    assert.ok(fits,'Dialog and content must not overflow horizontally');
    for(const name of ['logo','name','palette','style','font'])assert.ok(await page.locator(`[name="${name}"]`).count(),`Missing ${name} setting`);
    assert.equal(await page.locator('[name=palette]').count(),14);
    assert.equal(await page.getByRole('button',{name:'Save studio settings',exact:true}).count(),1);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.getByRole('dialog').count(),0);
});
test('Mobile navigation can open Studio settings from the slide editor',async t=>{
    const page=await pageFor(t,{width:390,height:844});
    await page.locator('[data-action=exit-preview]').click();
    await page.locator('[data-action=menu]').click();
    await page.locator('[data-action=settings]').click();
    await page.getByRole('dialog').waitFor();
});
test('Desktop preview editor occupies at most 64px',async t=>{
    const page=await pageFor(t);
    const {height}=await page.locator('.preview-bar').boundingBox();
    assert.ok(height<=64,`Expected <=64px; measured ${height}px`);
});
test('Mobile preview editor occupies at most 15% of the viewport',async t=>{
    const page=await pageFor(t,{width:390,height:844});
    const {height}=await page.locator('.preview-bar').boundingBox();
    assert.ok(height<=844*.15,`Expected <=126.6px; measured ${height}px`);
});
test('Editable preview retains label, visibility, deletion and exit controls',async t=>{
    const page=await pageFor(t);
    for(const name of ['title','type','situation'])assert.ok(await page.locator(`.preview-bar [name=${name}]`).isVisible(),`Missing ${name}`);
    for(const action of ['exit-preview','visibility-slide','delete-slide'])assert.ok(await page.locator(`.preview-bar [data-action=${action}]`).isVisible(),`Missing ${action}`);
    assert.ok(await page.getByRole('button',{name:'Save labels',exact:true}).isVisible());
});
for(const mode of ['client','readonly'])test(`${mode} preview cannot show editing controls`,async t=>{
    const page=await pageFor(t,{[mode]:true});
    assert.equal(await page.locator('.slide-property-bar,.preview-bar [data-action=delete-slide],.preview-bar [data-action=visibility-slide]').count(),0);
    if(mode==='client')assert.equal(await page.locator('.preview-bar').count(),0);
});
for(const job of ['queued','running']){
    test(`${job} image processing displays more than nine sparkles`,async t=>{
        const page=await pageFor(t,{job});
        const count=await page.locator('.image-sparkles i').count();
        assert.ok(count>9,`Expected >9 sparkles; measured ${count}`);
    });
    test(`${job} sparkles animate faster than the original 2.8 seconds`,async t=>{
        const page=await pageFor(t,{job});
        const timings=await page.locator('.image-sparkles i,.render-spark-icon').evaluateAll(nodes=>nodes.map(el=>({name:getComputedStyle(el).animationName,seconds:parseFloat(getComputedStyle(el).animationDuration)})));
        assert.ok(timings.length>0,'Processing animation must exist');
        assert.ok(timings.every(t=>t.name!=='none'&&t.seconds>0&&t.seconds<2.8),`Expected active cycles <2.8s; measured ${JSON.stringify(timings)}`);
    });
}
test('Reduced motion disables sparkles while preserving processing status',async t=>{
    const page=await pageFor(t,{job:'running'});
    await page.emulateMedia({reducedMotion:'reduce'});
    const names=await page.locator('.image-sparkles i,.render-spark-icon').evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).animationName));
    assert.ok(names.length>0&&names.every(name=>name==='none'));
    assert.ok(await page.locator('.image-working[role=status][aria-live=polite]').isVisible());
    assert.equal(await page.locator('.image-sparkles').getAttribute('aria-hidden'),'true');
});
for(const job of ['done','failed'])test(`${job} image job does not keep showing processing sparkles`,async t=>{
    const page=await pageFor(t,{job});
    assert.equal(await page.locator('.image-sparkles').count(),0);
});
