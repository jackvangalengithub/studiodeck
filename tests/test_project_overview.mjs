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
            const file=(path.startsWith('/assets/')||path.startsWith('/auth/'))?resolve(root,'.'+path):resolve(root,'index.html');
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
    const projects=[{...template.project,id:'project-a',name:'A very long project title that must remain on one line with an ellipsis on every card',can_edit:true,tags:['Hidden custom label'],location:'Hidden location',billing:{source:'subscription',active:true},visibility:'team',iteration:template.iteration},
        {...template.project,id:'project-b',name:'Delete <this> & only this',can_edit:true,can_manage:role==='admin',billing:{source:'project_pass',active:true},visibility:'public',archived:Number(archived),iteration:template.iteration}];
    await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.origin!==base){await route.abort();return;}
        if(url.pathname!=='/api.php'){await route.continue();return;}
        const action=url.searchParams.get('action'),data=route.request().postDataJSON();
        calls.push({action,data});
        let response;
        if(action==='session')response={user:{id:'test-user',name:'Test user'},csrf:'test-csrf',studio,studios:[studio],studio_theme:{palette:'sage',style:'modern'},capabilities:{ai:false,mail:false}};
        else if(action==='project_access')response={reason:'ready'};
        else if(action==='projects')response={projects:projects.filter(p=>!p.archived||url.searchParams.get('archived')==='1')};
        else if(action==='project'){
            const project=projects.find(p=>p.id===url.searchParams.get('id'));
            response={...structuredClone(template),project,can_edit:project.can_edit};
        }else if(action==='pin_project'||action==='project_settings'){
            const project=projects.find(p=>p.id===data.project_id);
            Object.assign(project,action==='pin_project'?{pinned:data.pinned}:{archived:data.archived});response={ok:true};
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

for(const width of [1440,390,320])test(`Compact project cards and accessible actions at ${width}px`,async t=>{
 const {page,calls}=await setup(t,{width});
 const cards=page.locator('.project-tile');
 const text=await cards.allTextContents();
 assert.ok(!text.join(' ').includes('Hidden custom label'));
 assert.ok(!text.join(' ').includes('Hidden location'));
 assert.ok(!text.join(' ').includes('Subscription'));
 assert.ok(text[1].includes('Project Pass'));
 assert.equal(await page.locator('.project-head .project-sub,.tile-theme,.project-label-tag').count(),0);
 assert.equal(await page.locator('#project-search').getAttribute('placeholder'),'Search projects');
 const heading=cards.first().locator('h2');
 assert.ok(await heading.evaluate(el=>{const style=getComputedStyle(el);return style.whiteSpace==='nowrap'&&style.textOverflow==='ellipsis'&&el.scrollWidth>el.clientWidth;}));
 const title=await heading.boundingBox(),palette=await cards.first().locator('.tile-swatches').boundingBox();
 assert.ok(Math.abs(title.y+title.height/2-palette.y-palette.height/2)<2);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const menu=cards.last().locator('.project-tile-actions'),trigger=menu.locator('summary');
 assert.equal(await menu.locator('[data-action=preview-project]').isVisible(),false);
 await trigger.click();
 assert.equal(await menu.locator('button').count(),4);
 const box=await menu.locator('.project-actions-menu').boundingBox();
 assert.ok(box.x>=0&&box.x+box.width<=width);
 await page.keyboard.press('Escape');
 assert.equal(await menu.getAttribute('open'),null);
 assert.ok(await trigger.evaluate(el=>el===document.activeElement));
 await page.keyboard.press('Enter');
 assert.equal(await menu.locator('[data-action=preview-project]').isVisible(),true);
 await page.locator('h1').click();
 assert.equal(await menu.getAttribute('open'),null);
 await trigger.click();
 await menu.locator('[data-action=delete-project]').click();
 await page.getByRole('dialog').waitFor();
 assert.equal(await menu.getAttribute('open'),null);
 assert.equal(calls.filter(c=>c.action==='project').length,0);
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.ok(await trigger.evaluate(el=>el===document.activeElement));
 assert.equal(calls.filter(c=>c.action==='delete_project').length,0);
 await page.locator('#project-search').fill('Hidden custom label');
 assert.equal(await cards.count(),0);
 await page.locator('#project-search').fill('');
 await cards.first().waitFor();
 if(process.env.TEST_SCREENSHOT_DIR){await mkdir(process.env.TEST_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.TEST_SCREENSHOT_DIR,`project-overview-${width}.png`)});}
});
test('Project menus respect management permissions',async t=>{
 const {page}=await setup(t,{role:'member'});
 const menu=page.locator('.project-tile').last().locator('.project-tile-actions');
 await menu.locator('summary').click();
 assert.equal(await menu.locator('[data-action=delete-project],[data-action=archive-project]').count(),0);
 assert.equal(await menu.locator('[data-action=preview-project],[data-action=pin-project]').count(),2);
});

test('Menu pin and archive actions target the selected project',async t=>{
 const {page,calls}=await setup(t);
 const menu=()=>page.locator('.project-tile').filter({has:page.locator('[data-action=open-project][data-id=project-b]')}).locator('.project-tile-actions');
 await menu().locator('summary').click();
 await menu().locator('[data-action=pin-project]').click();
 await page.locator('.pinned-projects').waitFor();
 assert.deepEqual(calls.find(c=>c.action==='pin_project').data,{project_id:'project-b',pinned:true});
 await menu().locator('summary').click();
 await menu().locator('[data-action=archive-project]').click();
 await page.locator('[data-action=open-project][data-id=project-b]').waitFor({state:'detached'});
 assert.deepEqual(calls.find(c=>c.action==='project_settings').data,{project_id:'project-b',archived:true});
});
test('Project settings no longer expose custom tags',async t=>{
 const {page}=await setup(t);
 await page.locator('[data-action=open-project][data-id=project-a]').click();
 assert.ok(!(await page.locator('.project-head').innerText()).includes('Hidden custom label'));
 await page.getByRole('button',{name:'Project settings',exact:true}).click();
 await page.locator('[data-form=project-settings]').waitFor();
 assert.equal(await page.locator('[name=tags],#project-tags').count(),0);
});
