/** Real browser UI with mocked API responses; no real project deletions.
 * node --test tests/test_project_actions.mjs
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

async function setup(t,{role='admin',width=1440,archived=false,denyDelete=false}={}){
    const page=await browser.newPage({viewport:{width,height:900}});
    page.setDefaultTimeout(5000);
    const errors=[],calls=[];
    page.on('pageerror',e=>errors.push(e.message));
    t.after(async()=>{await page.close();assert.deepEqual(errors,[]);});
    const studio={id:'actions-studio',name:'Test studio',role};
    const projects=[{...template.project,id:'project-a',name:'Keep this project',can_edit:true,visibility:'team',iteration:template.iteration},
        {...template.project,id:'project-b',name:'Delete <this> & only this',can_edit:false,visibility:'public',archived:Number(archived),iteration:template.iteration}];
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base){await route.abort();return;}
        if(url.pathname!=='/api.php'){await route.continue();return;}
        const action=url.searchParams.get('action'),data=route.request().postDataJSON();
        calls.push({action,data});
        let response;
        if(action==='session')response={user:{id:'test-user',name:'Test user'},csrf:'test-csrf',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:false,mail:false}};
        else if(action==='projects')response={projects:projects.filter(p=>!p.archived||url.searchParams.get('archived')==='1')};
        else if(action==='project'){
            const project=projects.find(p=>p.id===url.searchParams.get('id'));
            response={...structuredClone(template),project,can_edit:project.can_edit};
        }else if(action==='prepare_delete_project'){
            const project=projects.find(p=>p.id===data.project_id);
            response={name:project.name,confirmation:'confirmation-for-'+project.id,iterations:2,files:4};
        }else if(action==='delete_project'){
            if(denyDelete){await route.fulfill({status:403,json:{error:'Only studio admins can permanently delete projects.'}});return;}
            const index=projects.findIndex(p=>p.id===data.project_id);
            if(index<0||data.name!==projects[index].name||data.acknowledged!==true||data.confirmation!=='confirmation-for-'+data.project_id){
                await route.fulfill({status:400,json:{error:'Type the exact project name and confirm that deletion is permanent.'}});return;
            }
            projects.splice(index,1);response={ok:true};
        }else{errors.push(`Unexpected API action: ${action}`);await route.fulfill({status:500,json:{error:'Unexpected fixture request'}});return;}
        await route.fulfill({json:response});
    });
    await page.goto(`${base}/${studio.id}/projects${archived?'?archived=1':''}`);
    await page.locator('.project-tile').first().waitFor();
    return {page,calls,projects};
}
const tileDelete=page=>page.locator('.project-tile-actions [data-action=delete-project][data-id=project-b]');
const requests=(calls,action)=>calls.filter(call=>call.action===action);

for(const role of ['admin','member'])test(`${role} sees only the permitted project delete controls`,async t=>{
    const {page}=await setup(t,{role});
    assert.equal(await page.locator('.project-tile-actions [data-action=delete-project]').count(),role==='admin'?2:0);
    if(role==='admin'){
        assert.equal(await tileDelete(page).getAttribute('aria-label'),'Delete project: Delete <this> & only this');
        assert.equal(await tileDelete(page).locator('svg.icon').count(),1);
        assert.equal(await tileDelete(page).evaluate(el=>el.parentElement.closest('button')),null,'Delete button must not be nested inside the open-project button');
    }
    await page.locator('[data-action=open-project][data-id=project-a]').click();
    await page.getByRole('button',{name:'Project settings',exact:true}).click();
    assert.equal(await page.locator('.project-danger-zone').count(),role==='admin'?1:0);
});

test('Tile deletion can cancel either confirmation step without opening or deleting a project',async t=>{
    const {page,calls}=await setup(t);
    const originalUrl=page.url();
    await tileDelete(page).click();
    assert.match(await page.getByRole('dialog').innerText(),/Delete <this> & only this/);
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(requests(calls,'prepare_delete_project').length,0);
    await tileDelete(page).click();
    await page.getByRole('button',{name:'Continue to final check',exact:true}).click();
    await page.locator('[data-form=delete-project]').waitFor();
    assert.equal(requests(calls,'prepare_delete_project')[0].data.project_id,'project-b');
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(requests(calls,'delete_project').length,0);
    assert.equal(requests(calls,'project').length,0);
    assert.equal(await page.locator('.project-tile').count(),2);
    assert.equal(page.url(),originalUrl);
    assert.ok(await tileDelete(page).evaluate(el=>document.activeElement===el),'Cancellation returns focus to the tile trash button');
});

test('Tile confirmation deletes the selected project even when another project was previously open',async t=>{
    const {page,calls}=await setup(t);
    await page.locator('[data-action=open-project][data-id=project-a]').click();
    await page.getByRole('button',{name:'All projects',exact:true}).click();
    await tileDelete(page).click();
    await page.getByRole('button',{name:'Continue to final check',exact:true}).click();
    const form=page.locator('[data-form=delete-project]');
    await form.waitFor();
    assert.equal(await form.locator('[name=project_id]').inputValue(),'project-b');
    await form.locator('[name=name]').fill('Delete <this> & only this');
    await form.locator('[type=submit]').click();
    assert.equal(requests(calls,'delete_project').length,0,'Required acknowledgement blocks submission');
    await form.locator('[name=acknowledged]').check();
    await form.locator('[name=name]').fill('Wrong name');
    await form.locator('[type=submit]').click();
    await form.locator('.form-error').waitFor();
    assert.equal(await page.locator('.project-tile').count(),2);
    await form.locator('[name=name]').fill('Delete <this> & only this');
    await form.locator('[type=submit]').click();
    await form.waitFor({state:'detached'});
    await page.locator('.project-tile-actions [data-id=project-b]').waitFor({state:'detached'});
    assert.equal(await page.locator('.project-tile').count(),1);
    assert.ok(await page.locator('[data-action=open-project][data-id=project-a]').isVisible());
    assert.deepEqual(requests(calls,'delete_project').at(-1).data,{project_id:'project-b',confirmation:'confirmation-for-project-b',name:'Delete <this> & only this',acknowledged:true});
});

test('Server refusal preserves the project and displays the error in the confirmation',async t=>{
    const {page}=await setup(t,{denyDelete:true});
    await tileDelete(page).click();
    await page.getByRole('button',{name:'Continue to final check',exact:true}).click();
    const form=page.locator('[data-form=delete-project]');
    await form.locator('[name=name]').fill('Delete <this> & only this');
    await form.locator('[name=acknowledged]').check();
    await form.locator('[type=submit]').click();
    await form.locator('.form-error').waitFor();
    assert.match(await form.locator('.form-error').innerText(),/Only studio admins/);
    assert.equal(await page.locator('.project-tile').count(),2);
});

test('Project settings uses the same confirmation target as the tile',async t=>{
    const {page,calls}=await setup(t);
    await page.locator('[data-action=open-project][data-id=project-a]').click();
    await page.getByRole('button',{name:'Project settings',exact:true}).click();
    await page.getByRole('button',{name:'Delete project permanently',exact:true}).click();
    await page.getByRole('button',{name:'Continue to final check',exact:true}).click();
    assert.equal(await page.locator('[data-form=delete-project] [name=project_id]').inputValue(),'project-a');
    assert.equal(requests(calls,'prepare_delete_project')[0].data.project_id,'project-a');
});

test('Archived public project exposes the admin trash action on mobile',async t=>{
    const {page}=await setup(t,{width:390,archived:true});
    await tileDelete(page).scrollIntoViewIfNeeded();
    const rect=await tileDelete(page).boundingBox();
    assert.ok(rect.x>=0&&rect.x+rect.width<=390);
    await tileDelete(page).click();
    await page.getByRole('dialog').waitFor();
});

for(const width of [1440,390])test(`Project settings remains usable at ${width}px`,async t=>{
    const {page}=await setup(t,{width});
    await page.locator('[data-action=open-project][data-id=project-a]').click();
    await page.getByRole('button',{name:'Project settings',exact:true}).click();
    const dialog=page.getByRole('dialog');
    assert.ok(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&el.scrollWidth<=el.clientWidth+1;}));
    for(const name of ['tags','deadline','visibility'])assert.equal(await dialog.locator(`[name=${name}]`).count(),1);
    await page.getByRole('button',{name:'Delete project permanently',exact:true}).scrollIntoViewIfNeeded();
    assert.ok(await page.getByRole('button',{name:'Delete project permanently',exact:true}).isVisible());
    if(process.env.TEST_SCREENSHOT_DIR){
        await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});
        await dialog.evaluate(el=>{el.scrollTop=0;});
        await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`project-settings-${width}.png`)});
    }
});
