// Uses only an isolated WEBSITE_FIXTURE, as created by test_website_api.py.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=JSON.parse(fs.readFileSync(process.env.WEBSITE_FIXTURE,'utf8'));
const base=process.env.STUDIODECK_TEST_URL||'http://127.0.0.1:18098';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:1512,height:1000}});await context.addCookies(fixture.cookies);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/'+fixture.studio+'/website');
 const start=page.getByRole('button',{name:'Find your starting point'});
 await page.locator('[data-action="website-gallery"], [data-action="website-enter"]').first().waitFor();
 if(await start.isVisible()){
  await start.click();await page.locator('[data-action="website-example"][data-template="linen"]').click();await page.getByRole('button',{name:'Use this starting point'}).click();
 }else await page.getByRole('button',{name:'Edit website ↗',exact:true}).click();
 await page.getByRole('button',{name:'Code',exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.cm-line').length>5);
 assert.match(await page.locator('.website-status').innerText(),/Unsaved changes/);
 const preview=await page.locator('.website-preview iframe').getAttribute('src');
 await page.getByRole('textbox',{name:'index.html source',exact:true}).fill('<main><h1>Readable source</h1><p><span>Hello</span><span>world</span></p><pre>  keep\n whitespace </pre></main>');
 await page.getByRole('button',{name:'Format code',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.cm-content').innerText.includes('\n  <h1>'));
 assert.match(await page.locator('.cm-content').innerText(),/\n  <h1>/);
 assert.match(await page.locator('.cm-content').innerText(),/<span>Hello<\/span><span>world<\/span>/);
 for(const [file,input,expected] of [
  ['styles.css','body{color:red;margin:0}',/body \{\n  color: red;/],
  ['script.js','function hello(){return {a:1,b:2};}',/function hello\(\) \{\n  return/]
 ]){
  await page.locator(`[data-action="website-file"][data-file="${file}"]`).click();
  const editor=page.getByRole('textbox',{name:file+' source',exact:true});await editor.fill(input);
  if(file==='script.js')await editor.press('Alt+Shift+f');else await page.getByRole('button',{name:'Format code',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.cm-line').length>1);
  assert.match(await editor.innerText(),expected);
  await editor.press('Control+z');assert.equal((await editor.innerText()).trim(),input,'Formatting should undo in one step');
  await editor.press('Control+y');assert.match(await editor.innerText(),expected);
 }
 const editor=page.getByRole('textbox',{name:'script.js source',exact:true});
 await editor.fill('function broken(');await page.getByRole('button',{name:'Format code',exact:true}).click();
 await page.locator('#toast').getByText('Could not format this file.',{exact:false}).waitFor();assert.equal((await editor.innerText()).trim(),'function broken(');
 assert.equal(await page.locator('.website-preview iframe').getAttribute('src'),preview,'Formatting must not reload the preview');
 console.log('PASS HTML/CSS/JS formatting, keyboard shortcut, undo/redo, invalid syntax, and preview continuity');
 const race=await page.evaluate(async()=>{
  const {mountEditor,formatEditor}=await import('/assets/vendor/website-editor.js');
  const host=document.createElement('div');document.body.append(host);
  const view=mountEditor(host,{filename:'script.js',value:'let x=1;',onChange:()=>{},onSave:()=>{},onFormat:()=>{}});
  const pending=formatEditor(view,'script.js');view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'let newer=2;'}});
  const status=await pending,value=view.state.doc.toString();view.destroy();host.remove();return {status,value};
 });assert.deepEqual(race,{status:'stale',value:'let newer=2;'});
 console.log('PASS Asynchronous formatting preserves newer typing');assert.deepEqual(errors,[]);
}finally{await browser.close();}
