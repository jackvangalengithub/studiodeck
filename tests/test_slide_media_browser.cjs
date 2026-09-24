// Uses exported test_slide_media.py fixture; intercepts every request. No paid calls.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),fixture=JSON.parse(fs.readFileSync(process.env.MEDIA_BROWSER_EXPORT)),video=fs.readFileSync(process.env.MEDIA_TEST_VIDEO);
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.stack));
 const deck=fixture.deck;deck.jobs=[];deck.capabilities.video_ai=true;const photo=deck.slides.find(s=>s.type==='fullphoto'),film=deck.slides.find(s=>s.type==='video');
 await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
  if(url.pathname==='/api.php'){
   const action=url.searchParams.get('action'),body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():{};requests.push({action,body});let value={ok:true};
   if(action==='session')value=fixture.session;
   if(action==='project'||action==='deck')value=deck;
   if(action==='projects')value={projects:[]};
   if(action==='comments_feed')value={items:[],has_more:false,unread_count:0};
   if(action==='project_access')value={reason:'ready'};
   if(action==='slide_media')return route.fulfill({contentType:'video/webm',body:video});
   if(['file','slide_image','project_cover'].includes(action))return route.fulfill({contentType:'image/webp',body:fs.readFileSync(path.join(root,'public/assets/interior.webp'))});
   if(action==='studio_logo')return route.fulfill({status:404,body:''});
   if(action==='generate_slide_motion'){photo.metadata.motion_candidate.prompt=body.prompt;}
   if(action==='save_slide_motion'){
    const s=deck.slides.find(s=>s.id===body.slide_id);
    if(body.mode==='none')delete s.metadata.motion;
    else s.metadata.motion=body.mode==='ai'?{...s.metadata.motion_candidate,mode:'ai'}:{...body,duration:Number(body.duration),source_key:[s.source_version_id,0,0,s.image_version_id||''].join(':')};
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  }
  if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/auth/')){const file=path.join(root,'public',url.pathname);return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':'image/svg+xml',body:fs.readFileSync(file)});}
  return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'public/index.html'))});
 });
 await page.goto('http://media.test/studio-a/projects/shared?tab=slides');
 await page.locator('.slide-editor-row').first().waitFor();
 await page.locator(`[data-slide-id="visual-${film.id}"] [data-action=edit-slide]`).click();
 assert.equal(await page.locator('[name=video_layout]').inputValue(),'full');assert.equal(await page.locator('[name=video_autoplay]').isChecked(),true);assert.equal(await page.locator('[name=video_file]').getAttribute('accept'),'video/mp4,video/webm');await page.keyboard.press('Escape');
 assert.equal(await page.locator('.workspace-studio-name').count(),0);
 const photoRow=()=>page.locator(`[data-slide-id="visual-${photo.id}"]`);
 await photoRow().locator('[data-action=edit-slide]').click();await page.getByRole('button',{name:'Add motion',exact:true}).click();
 await page.locator('[data-form=photo-motion]').waitFor();await page.locator('.motion-preview img').waitFor();
 await page.locator('[name=movement]').selectOption('pan-left');await page.locator('[name=duration]').selectOption('4');await page.locator('[data-preview-motion]').click();
 await page.waitForFunction(()=>document.querySelector('.motion-preview img')?.getAnimations().some(a=>a.playState==='running'));
 await page.getByRole('button',{name:'Apply',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});assert.equal(photo.metadata.motion.movement,'pan-left');
 await photoRow().locator('[data-action=open-editor-slide]').click();await page.locator('.full-photo-slide .motion-photo img').waitFor();
 await page.waitForFunction(()=>document.querySelector('.full-photo-slide img')?.getAnimations().some(a=>a.playState==='running'));
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('.full-photo-slide img')).transform==='none',{},{timeout:6500});
 assert.equal(await page.locator('.full-photo-slide video').count(),0);
 // Open uploaded full-screen slide directly through the editor.
 await page.goto('http://media.test/studio-a/projects/shared?tab=slides');await page.locator(`[data-slide-id="visual-${film.id}"] [data-action=open-editor-slide]`).click();
 await page.locator('.full-video-slide video').waitFor();await page.waitForFunction(()=>{const v=document.querySelector('.full-video-slide video');return v&&!v.paused&&v.currentTime>0;});
 assert.equal(await page.locator('.full-video-slide video').evaluate(v=>v.muted),true);
 await page.waitForFunction(()=>document.querySelector('.full-video-slide video')?.ended,{},{timeout:6000});
 await page.screenshot({path:process.env.MEDIA_SCREENSHOT||'/tmp/studiodeck-media-review/video-desktop.png'});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:'/tmp/studiodeck-media-review/video-mobile.png'});
 // AI preview stays local until Apply; final display is the source image.
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://media.test/studio-a/projects/shared?tab=slides');await photoRow().locator('[data-action=edit-slide]').click();await page.getByRole('button',{name:'Add motion',exact:true}).click();
 await page.locator('[name=mode]').selectOption('ai');
 const prompt=page.locator('textarea[name=prompt]'),apply=page.getByRole('button',{name:'Apply',exact:true});
 assert.equal(await prompt.inputValue(),photo.metadata.motion_candidate.prompt);
 assert.equal(await page.locator('[name=movement]').isVisible(),false);
 assert.equal(await apply.isDisabled(),true);
 await page.locator('[data-motion-preset=pan-right]').click();assert.match(await prompt.inputValue(),/left to right/);
 await page.locator('[data-motion-preset=pan-left]').click();assert.match(await prompt.inputValue(),/right to left/);
 await page.locator('[data-motion-preset=zoom-out]').click();assert.match(await prompt.inputValue(),/pull the camera back/);
 await page.locator('[data-motion-preset=orbit]').click();assert.match(await prompt.inputValue(),/camera arc/);
 await page.locator('[data-motion-preset=custom]').click();assert.equal(await prompt.inputValue(),'');assert.equal(await page.locator('[data-generate-motion]').isDisabled(),true);
 const customPrompt='Glide past the dining table.\nKeep soft morning light & the original architecture.';
 await prompt.fill(customPrompt);assert.equal(await page.locator('[data-preview-motion]').isDisabled(),true);assert.equal(await apply.isDisabled(),true);
 await page.locator('[name=mode]').selectOption('simple');await page.locator('[name=mode]').selectOption('ai');assert.equal(await prompt.inputValue(),customPrompt);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'/tmp/studiodeck-media-review/motion-prompt-mobile.png'});await page.setViewportSize({width:1440,height:1000});
 await page.locator('[data-generate-motion]').click();await page.locator('.modal').waitFor({state:'detached'});
 const generation=requests.filter(r=>r.action==='generate_slide_motion').at(-1);assert.equal(generation.body.prompt,customPrompt);assert.equal('movement' in generation.body,false);
 await photoRow().locator('[data-action=edit-slide]').click();await page.getByRole('button',{name:'Add motion',exact:true}).click();await page.locator('[name=mode]').selectOption('ai');assert.equal(await prompt.inputValue(),customPrompt);
 await page.locator('[data-preview-motion]').click();
 await page.waitForFunction(()=>document.querySelector('.motion-preview .motion-playing'));
 assert.equal(photo.metadata.motion.mode,'simple');await prompt.fill(customPrompt+' Change the pace.');assert.equal(await apply.isDisabled(),true);await prompt.fill(customPrompt);assert.equal(await apply.isDisabled(),false);await page.getByRole('button',{name:'Apply',exact:true}).click();await page.locator('.modal').waitFor({state:'detached'});
 assert.equal(requests.filter(r=>r.action==='save_slide_motion').at(-1).body.prompt,customPrompt);
 await photoRow().locator('[data-action=open-editor-slide]').click();await page.waitForFunction(()=>document.querySelector('.full-photo-slide .motion-playing'));
 await page.waitForFunction(()=>{const s=document.querySelector('.full-photo-slide .motion-photo'),v=s?.querySelector('video');return s&&v?.currentTime>0&&v.paused&&!s.classList.contains('motion-playing');},{},{timeout:6500});
 assert.equal(await page.locator('.full-photo-slide img').evaluate(im=>im.complete&&im.naturalWidth>0),true);
 // Reduced motion shows the photo and gives video an explicit Play control.
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://media.test/studio-a/projects/shared?tab=slides');await photoRow().locator('[data-action=open-editor-slide]').click();
 assert.equal(await page.locator('.motion-playing').count(),0);assert.equal(await page.locator('.full-photo-slide video').evaluate(v=>v.paused),true);
 await page.goto('http://media.test/studio-a/projects/shared?tab=slides');await page.locator(`[data-slide-id="visual-${film.id}"] [data-action=open-editor-slide]`).click();await page.locator('.full-video-slide video').waitFor();assert.equal(await page.locator('.full-video-slide video').evaluate(v=>v.paused),true);
 assert.equal(await page.locator('[data-play-upload]').isVisible(),true);await page.locator('[data-play-upload]').click();await page.waitForFunction(()=>!document.querySelector('.full-video-slide video').paused);
 // Leaving an active slide must release its media, including in scroll mode.
 const oldVideo=await page.locator('.full-video-slide video').elementHandle();
 await page.keyboard.press('ArrowLeft');assert.equal(await oldVideo.evaluate(v=>v.paused&&!v.getAttribute('src')),true);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('http://media.test/studio-a/projects/shared?tab=slides');await photoRow().locator('[data-action=open-editor-slide]').click();
 await page.locator('[data-action=presentation-mode][data-mode=scroll]').evaluate(el=>el.click());await page.locator('.presentation-scroll').waitFor();
 // Enter the photo afresh: switching view mode can preserve an already-finished short fixture.
 await page.locator(`[data-scroll-slide="visual-${film.id}"]`).evaluate(el=>el.scrollIntoView({behavior:'instant'}));
 await page.waitForFunction(()=>!document.querySelector('.presentation-scroll [data-uploaded-video] video').paused);
 await page.locator(`[data-scroll-slide="visual-${photo.id}"]`).evaluate(el=>el.scrollIntoView({behavior:'instant'}));
 await page.waitForFunction(()=>document.querySelector('.presentation-scroll .motion-playing'));
 const oldMotion=await page.locator('.presentation-scroll .motion-playing video').elementHandle();
 await page.locator(`[data-scroll-slide="visual-${film.id}"]`).evaluate(el=>el.scrollIntoView());
 await page.waitForFunction(()=>!document.querySelector('.presentation-scroll [data-uploaded-video] video').paused);
 assert.equal(await oldMotion.evaluate(v=>v.paused&&!v.getAttribute('src')),true);
 // Applied movement on an image variation is visible until comparison is requested.
 photo.type='render';photo.image_version_id='variant-shared';photo.metadata.motion={mode:'simple',movement:'pan-right',duration:4,source_key:'file-shared:0:0:variant-shared'};
 await page.goto('http://media.test/studio-a/projects/shared?tab=slides');await photoRow().locator('[data-action=open-editor-slide]').click();
 await page.locator('.motion-photo img').waitFor();assert.equal(await page.locator('.image-comparison').count(),0);
 await page.locator('[data-action=toggle-slide-comparison]').first().click();await page.locator('.image-comparison').waitFor();assert.equal(await page.locator('.motion-photo').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS editor preview/apply, still-photo ending, uploaded autoplay/hold, mobile sizing, reduced motion, and removed top-right studio name.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1);});
