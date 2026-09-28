import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {browserPolicy} from '../scripts/browser-policy.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('public');let server,browser,base;
before(async()=>{
 server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  const file=resolve(root,'.'+(path.startsWith('/assets/')||path.startsWith('/auth/')||path.startsWith('/mock/')?path==='/mock/'?'/mock/index.html':path:'/index.html'));
  if(!file.startsWith(root+'/'))throw Error('path');
  const body=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream','Content-Security-Policy':browserPolicy,'Access-Control-Allow-Origin':'*'});res.end(body);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});
});
after(async()=>{await browser?.close();await new Promise(r=>server?.close(r));});
async function fixture(t){
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(5000);
 page.on('pageerror',e=>errors.push(e.message));t.after(async()=>{if(t.passed===false)for(const f of page.frames())console.log('FRAME',f.url(),await f.locator('body').innerText().catch(()=>''));await page.close();assert.deepEqual(errors,[]);});
 await page.addInitScript(()=>{window.STUDIODECK_DEMO=true;});
 await page.goto(base+'/demo/projects/van-galen');await page.locator('.project-head').waitFor();return page;
}

test('browser refuses HTML insertion, parser bypasses, event strings and new Trusted Types policies',async t=>{
 const page=await fixture(t);
 const result=await page.evaluate(()=>{
  const node=document.createElement('div');document.body.append(node);
  const bad='<img src=x onerror="window.pwned=1">';
  const attempts=[()=>node.innerHTML=bad,()=>node['outer'+'HTML']=bad,()=>node.insertAdjacentHTML('beforeend',bad),()=>new DOMParser().parseFromString(bad,'text/html'),()=>document.createRange().createContextualFragment(bad),()=>document.createElement('iframe').srcdoc=bad,()=>node.setAttribute('onclick','window.pwned=2'),()=>trustedTypes.createPolicy('bypass',{createHTML:v=>v})];
  const rejected=attempts.map(run=>{try{run();return false;}catch(e){return e instanceof TypeError;}});
  node.textContent=bad;return {rejected,text:node.textContent,children:node.children.length,ran:window.pwned};
 });assert.ok(result.rejected.every(Boolean));assert.equal(result.children,0);assert.equal(result.ran,undefined);
});

test('project tabs, style brush, settings, file previews and slide forms render under CSP',async t=>{
 const page=await fixture(t);
 const brush=page.locator('.project-head [data-action="theme"]');assert.match(await brush.locator('path').getAttribute('d'),/^M14 6l4-4/);
 await brush.click();await page.locator('[data-project-style-preview]').waitFor();await page.locator('[data-action="close-modal"]').first().click();
 for(const tab of ['slides','files','budget','people','overview']){
  await page.locator(`nav [data-tab="${tab}"]`).click();await page.locator(`nav [data-tab="${tab}"].active`).waitFor();
  assert.equal(await page.locator('.status-page,.form-error').count(),0,tab);
 }
 await page.locator('.project-head [data-action="project-settings"]').click();await page.locator('[data-form="project-settings"]').waitFor();
 assert.equal(await page.locator('[data-form="project-settings"] [name="language"]').inputValue(),'');
 await page.locator('[data-action="close-modal"]').first().click();
 await page.locator('nav [data-tab="slides"]').click();await page.locator('[data-action="add-slide"]').click();
 const form=page.locator('[data-form="slide-editor"]');await form.locator('[name="type"]').selectOption('text');
 const title='<svg onload="window.pwned=1">Literal & title';await form.locator('[name="title"]').fill(title);
 await form.locator('[name="description"]').fill('<img src=x onerror="window.pwned=2">');
 await form.locator('[type="submit"]').click();await form.waitFor({state:'detached'});
 await page.getByText(title,{exact:true}).first().waitFor();assert.equal(await page.evaluate(()=>window.pwned),undefined);

});

test('website code editor and formatter treat HTML source as text under enforcement',async t=>{
 const page=await fixture(t);
 const result=await page.evaluate(async()=>{
  const {mountEditor,formatEditor}=await import('/assets/vendor/website-editor.js');
  const host=document.createElement('div');document.body.append(host);
  const value='<img src="x" onerror="window.pwned=1"><script>window.pwned=2</script>';
  const editor=mountEditor(host,{filename:'index.html',value,onChange:()=>{},onSave:()=>{},onFormat:()=>{}});
  await formatEditor(editor,'index.html');const result={text:editor.state.doc.toString(),injected:host.querySelectorAll('img,script').length,ran:window.pwned};editor.destroy();return result;
 });assert.equal(result.injected,0);assert.equal(result.ran,undefined);assert.ok(result.text.includes('onerror'));
});

test('guided tour runs in an isolated iframe and can close through its verified message source',async t=>{
 const page=await fixture(t);
 await page.evaluate(async()=>{
  const {onboardingUi}=await import('/assets/onboarding.js');
  const ui=onboardingUi({state:{user:{id:'fixture'},studio:{id:'demo'}},closeModal:()=>{},startProject:async()=>{},onError:e=>{throw e;}});
  await ui.action('onboarding-example');
 });
 const frame=page.frameLocator('.guided-app-tour iframe');await frame.locator('.app-tour-coach').waitFor();
 assert.equal(await page.locator('.guided-app-tour iframe').getAttribute('sandbox'),'allow-scripts allow-forms');
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'null',data:{type:'studiodeck-tour-exit'}})));
 assert.equal(await page.locator('.guided-app-tour').count(),1,'unrelated frames cannot close the tour');
 await frame.getByRole('button',{name:/exit|leave|sluiten|stoppen/i}).last().click();await page.locator('.guided-app-tour').waitFor({state:'detached'});
});

test('the frozen communication demo also renders without HTML insertion',async t=>{
 const page=await fixture(t);await page.goto(base+'/mock/');
 await page.locator('.workspace,.presentation,.destination-shell').first().waitFor();
 assert.equal(await page.locator('.status-page').count(),0);
});
