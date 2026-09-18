/** Real browser UI with mocked API responses; no real project deletions.
 * node --test tests/test_iteration_activity.mjs
 * Requires Playwright/Chromium; optional PLAYWRIGHT_MODULE and CHROMIUM_PATH.
 */
import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {demoRequest} from '../public/assets/demo.js';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../public/',import.meta.url));
const template=await demoRequest('project',{id:'van-galen'});
let server,browser,base;
before(async()=>{
    server=createServer(async(req,res)=>{
        try{
            const path=new URL(req.url,'http://localhost').pathname;
            const file=path.startsWith('/assets/')?resolve(root,'.'+path):resolve(root,'index.html');
            if(!file.startsWith(root)){res.writeHead(404);res.end();return;}
            res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp'})[extname(file)]||'application/octet-stream');
            res.end(await readFile(file));
        }catch{res.writeHead(404);res.end();}
    });
    await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
    base=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
});
after(async()=>{await browser?.close();if(server)await new Promise(done=>server.close(done));});

async function setup(t,{width=1440,canEdit=true,total=45,role='admin'}={}){
    const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],calls=[];
    page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
    t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
    const studio={id:'activity-studio',name:'Test studio',role};
    const deck={...structuredClone(template),can_edit:canEdit,jobs:[],shares:[]};
    deck.iteration={...deck.iteration,status:'shared',locked:0};deck.iterations=[deck.iteration];
    const events=Array.from({length:total},(_,n)=>({id:'event-'+n,actor:'Designer',type:'test',detail:'Activity '+n,created_at:'2026-09-18T12:00:00Z'}));
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base){await route.abort();return;}
        if(url.pathname!=='/api.php'){await route.continue();return;}
        const action=url.searchParams.get('action'),data=route.request().postDataJSON();calls.push({action,data});let response;
        if(action==='session')response={user:{id:'test-user',name:'Designer'},csrf:'test-csrf',studio,studios:[studio],capabilities:{ai:false,mail:false}};
        else if(action==='projects')response={projects:[]};
        else if(action==='project'){
            const pageNumber=Number(url.searchParams.get('events_page')||0);
            response={...deck,events:events.slice(pageNumber*20,pageNumber*20+20),events_pagination:{page:pageNumber,per_page:20,total}};
        }else if(action==='lock_iteration'){deck.iteration.locked=Number(data.locked);response={ok:true};}
        else if(action==='theme'){deck.project.theme=data.theme;response={ok:true};}
        else if(action==='new_iteration'){deck.iteration={...deck.iteration,id:'new-iteration',number:3,status:'draft',locked:0};deck.iterations.unshift(deck.iteration);response={id:deck.iteration.id};}
        else{errors.push('Unexpected API action: '+action);await route.fulfill({status:500,json:{error:'Unexpected fixture request'}});return;}
        await route.fulfill({json:response});
    });
    await page.goto(`${base}/${studio.id}/projects/${deck.project.id}?iteration=${deck.iteration.id}&tab=activity`);
    await page.locator('[data-action=tab][data-tab=activity]').click();await page.locator('.timeline').waitFor();return {page,calls};
}
for(const width of [1440,390])test(`Activity pagination and iteration controls at ${width}px`,async t=>{
    const {page}=await setup(t,{width});
    await page.locator('[data-action=tab][data-tab=activity]').click();
    assert.equal(await page.getByRole('button',{name:'Client feedback',exact:true}).count(),0);
    assert.equal(await page.locator('.timeline-item').count(),20);
    assert.equal(await page.getByRole('button',{name:'Prev',exact:true}).isDisabled(),true);
    const controls=page.locator('.iteration-controls');
    assert.equal(await controls.locator('[data-action=manage-links]').count(),1);
    const positions=await controls.evaluate(el=>[...el.children].map(e=>e.id||e.dataset.action));
    assert.deepEqual(positions,['manage-links','iteration-select','lock-iteration','iteration']);
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.getByText('Page 2 of 3',{exact:true}).waitFor();
    assert.equal(await page.locator('.timeline-item').count(),20);
    assert.equal(await page.locator('.timeline-item').first().locator('p').innerText(),'Activity 20');
    await page.getByRole('button',{name:'Next',exact:true}).click();
    await page.getByText('Page 3 of 3',{exact:true}).waitFor();
    assert.equal(await page.locator('.timeline-item').count(),5);
    assert.equal(await page.getByRole('button',{name:'Next',exact:true}).isDisabled(),true);
    await page.getByRole('button',{name:'Prev',exact:true}).click();
    await page.getByText('Page 2 of 3',{exact:true}).waitFor();
    assert.equal(await page.locator('.timeline-item').first().locator('p').innerText(),'Activity 20');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal page overflow');
});
test('Shared iteration styling stays editable until locking; new iteration is editable',async t=>{
    const {page,calls}=await setup(t);
    await page.getByRole('button',{name:'Project style',exact:true}).click();
    await page.locator('[data-form=theme]').waitFor();
    await page.locator('[data-form=theme] button[type=submit]').click();
    await page.locator('[data-form=theme]').waitFor({state:'hidden'});
    assert.equal(calls.filter(c=>c.action==='theme').length,1);
    const lockButton=page.locator('.iteration-controls [data-action=lock-iteration]');
    const openPath=await lockButton.locator('path').getAttribute('d');
    assert.equal(await lockButton.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    await lockButton.click();
    await page.getByRole('dialog',{name:'Lock this iteration?'}).waitFor();
    assert.equal(calls.filter(c=>c.action==='lock_iteration').length,0);
    await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(calls.filter(c=>c.action==='lock_iteration').length,0);

    await page.getByRole('button',{name:'Lock iteration',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Lock iteration',exact:true}).click();
    await page.getByRole('button',{name:'Unlock iteration',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Unlock iteration',exact:true}).isDisabled(),false);
    assert.equal(await page.getByRole('button',{name:'Project style',exact:true}).count(),0);
    assert.notEqual(await lockButton.locator('path').getAttribute('d'),openPath);
    assert.equal(await lockButton.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    assert.equal(await lockButton.evaluate(el=>getComputedStyle(el).color),'rgb(157, 65, 59)');
    await lockButton.click();
    await page.getByRole('dialog',{name:'Unlock this iteration?'}).waitFor();
    assert.equal(calls.filter(c=>c.action==='lock_iteration').length,1);
    await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await lockButton.getAttribute('aria-pressed'),'true');
    assert.equal(calls.filter(c=>c.action==='lock_iteration').length,1);

    await page.getByRole('button',{name:'Unlock iteration',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Unlock iteration',exact:true}).click();
    await page.getByRole('button',{name:'Project style',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Lock iteration',exact:true}).getAttribute('aria-pressed'),'false');
    assert.deepEqual(calls.filter(c=>c.action==='lock_iteration').map(c=>c.data.locked),[true,false]);
    assert.equal(await lockButton.locator('path').getAttribute('d'),openPath);
    assert.equal(await lockButton.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
    await page.getByRole('button',{name:'Lock iteration',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Lock iteration',exact:true}).click();
    await page.getByRole('button',{name:'Unlock iteration',exact:true}).waitFor();
    await page.getByRole('button',{name:'New iteration',exact:true}).click();
    await page.locator('[data-form=iteration] button[type=submit]').click();
    await page.getByRole('button',{name:'Lock iteration',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Project style',exact:true}).count(),1);
});
test('View-only project members have no lock control',async t=>{
    const {page}=await setup(t,{canEdit:false});
    assert.equal(await page.locator('[data-action=lock-iteration]').count(),0);
    assert.equal(await page.getByRole('button',{name:'Project style',exact:true}).count(),0);
});

test('Non-admin team members can edit but cannot lock or unlock',async t=>{
    const {page}=await setup(t,{role:'member'});
    assert.equal(await page.getByRole('button',{name:'Project style',exact:true}).count(),1);
    assert.equal(await page.locator('[data-action=lock-iteration]').count(),0);
});
