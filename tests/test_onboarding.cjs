const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {startOnboardingFixture}=require('./fixtures/onboarding-server.cjs');
(async()=>{
  const {fixture,base,close,install}=await startOnboardingFixture({offline:process.env.STUDIODECK_BROWSER_OFFLINE==='1'});let browser,page;
  const artifacts=process.env.STUDIODECK_ONBOARDING_ARTIFACTS||'/tmp/studiodeck-onboarding';await fs.mkdir(artifacts,{recursive:true});
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
    page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error:',e.message);});
    if(install)await install(page);
    await page.goto(base+'/demo/projects');await page.locator('.onboarding-welcome').waitFor();
    assert.equal(await page.locator('#project-search').count(),0);
    await page.screenshot({path:path.join(artifacts,'welcome-desktop.png'),fullPage:true});
    // Hidden and archived-only projects both have no visible cards but studio_empty=false.
    fixture.empty=false;await page.reload();await page.locator('#project-search').waitFor();assert.equal(await page.locator('.onboarding-welcome').count(),0);
    await page.locator('#show-archived').check();assert.equal(await page.locator('.onboarding-welcome').count(),0);
    await page.locator('#project-search').fill('Missing project');await page.getByText('No matching projects',{exact:true}).waitFor();
    fixture.empty=true;fixture.needsSetup=true;await page.goto(base+'/demo/projects');await page.locator('.onboarding-welcome').waitFor();
    assert.equal(await page.locator('.modal').count(),0,'Studio setup must not cover the welcome page');
    // Learning paths do not call mutation APIs and preserve the current studio.
    const before=fixture.calls.length;
    await page.locator('.onboarding-actions [data-action=onboarding-example]').click();
    const tour=page.frameLocator('.guided-app-tour iframe');
    const step=n=>tour.locator('.app-tour-coach[data-step="'+n+'"]');
    await step(0).waitFor();
    await tour.locator('.tabs [data-tab=slides]').click();await step(1).waitFor();
    await tour.locator('[data-action=edit-slide][data-id=intro]').click();await step(2).waitFor();
    await tour.locator('[data-form=slide-editor] [name=title]').fill('A home <for us>');
    // Typing alone does not advance. Only the successful save does.
    assert.equal(await step(2).count(),1);
    await tour.locator('[data-form=slide-editor] [type=submit]').click();await step(3).waitFor();
    await tour.locator('.project-head [data-action=preview]').click();await step(4).waitFor();
    await tour.getByText('A home <for us>',{exact:true}).first().waitFor();
    await tour.locator('[data-action=jump-section][data-section=budget]').click();await step(5).waitFor();
    await page.screenshot({path:path.join(artifacts,'app-tour-desktop.png'),fullPage:true});
    await tour.locator('[data-budget-option="tour-option"]').check();await step(6).waitFor();
    await tour.locator('[data-action=feedback]').click();await step(7).waitFor();
    await tour.locator('[data-form=feedback] textarea').fill('Could we try oak? <script>bad()</script>');
    await tour.locator('[data-form=feedback] [type=submit]').click();await step(8).waitFor();
    assert.equal(await tour.locator('.comment-thread script').count(),0);
    assert.equal(fixture.calls.length,before,'The actual-app tour must make no API requests');
    assert.equal(new URL(page.url()).pathname,'/demo/projects');
    // The primary action resumes creation after necessary studio setup.
    await tour.locator('[data-guide=create]').click();await page.locator('[data-form=billing-onboard]').waitFor();
    await page.locator('[data-form=billing-onboard] [type=submit]').click();await page.locator('.project-wizard-steps [aria-current=step]').waitFor();
    assert.match(await page.locator('.project-wizard-steps [aria-current=step]').innerText(),/How it works/);
    await page.locator('[data-action=wizard-details]').click();await page.locator('[data-form=new-project]').waitFor();
    await page.locator('[name=name]').fill('My first project');await page.locator('[data-form=new-project] [type=submit]').click();
    await page.locator('[name=finish][value=skip]').click();await page.locator('.onboarding-checklist').waitFor();
    assert.equal(fixture.calls.filter(c=>c.action==='create_project').length,1);
    assert.match(await page.locator('.onboarding-checklist').innerText(),/0 of 3 complete/);
    assert.equal(await page.locator('[data-action=onboarding-check-2]').isDisabled(),true);
    // Completion derives from files and sharing; preview requires actually opening the presentation.
    fixture.files=true;await page.reload();await page.locator('.onboarding-checklist').waitFor();
    await page.locator('[data-action=onboarding-check-1]').click();await page.locator('.presentation').waitFor();await page.keyboard.press('Escape');
    await page.locator('.onboarding-checklist').waitFor();assert.match(await page.locator('.onboarding-checklist').innerText(),/2 of 3 complete/);
    fixture.shared=true;await page.reload();await page.getByText('Your first presentation is out in the world.').waitFor();
    await page.locator('[data-action=onboarding-dismiss]').click();await page.reload();await page.locator('.project-head').waitFor();assert.equal(await page.locator('.onboarding-checklist').count(),0);
    fixture.empty=true;fixture.visible=false;await page.goto(base+'/demo/projects');await page.locator('.onboarding-film').click();
    const video=page.locator('.onboarding-video video');await video.waitFor();await video.evaluate(el=>new Promise((resolve,reject)=>{setTimeout(()=>reject(Error('Video metadata timed out')),10000);if(el.readyState>=1)return resolve();el.addEventListener('loadedmetadata',resolve,{once:true});el.addEventListener('error',reject,{once:true});}));
    assert.ok(Math.abs(await video.evaluate(el=>el.duration)-60)<1);assert.equal(await video.locator('track[srclang=en]').count(),1);
    async function checkAudio(filename){
      await page.waitForFunction(()=>document.querySelector('.onboarding-video video')?.webkitAudioDecodedByteCount>0);
      assert.equal(await video.evaluate(el=>el.muted),false);
      assert.ok((await video.evaluate(el=>el.currentSrc)).endsWith('/'+filename));
      await video.evaluate(el=>{el.pause();el.currentTime=30;});
      await page.waitForFunction(()=>{const el=document.querySelector('.onboarding-video video');return !el.seeking&&Math.abs(el.currentTime-30)<1;});
      const decoded=await video.evaluate(el=>el.webkitAudioDecodedByteCount);
      await video.evaluate(el=>el.play());
      await page.waitForFunction(before=>document.querySelector('.onboarding-video video').webkitAudioDecodedByteCount>before,decoded);
      assert.equal(await page.locator('[data-video-error]').isVisible(),false);
    }
    await checkAudio('tour.webm');
    await page.keyboard.press('Escape');assert.equal(await page.locator('video').count(),0);
    // A new studio starts fresh, with Dutch copy and a usable mobile layout.
    fixture.studio='second';fixture.created=null;fixture.empty=true;fixture.visible=false;fixture.language='nl';
    await page.setViewportSize({width:390,height:844});await page.goto(base+'/second/projects');await page.locator('.onboarding-welcome').waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),'nl');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(artifacts,'welcome-mobile-nl.png'),fullPage:true});
    await page.locator('.onboarding-actions [data-action=onboarding-example]').click();
    await step(0).waitFor();
    await tour.locator('.tabs [data-tab=slides]').click();await step(1).waitFor();
    await tour.locator('[data-action=edit-slide][data-id=intro]').click();await step(2).waitFor();
    await tour.locator('[data-form=slide-editor] [name=title]').fill('Een warm thuis');
    await page.screenshot({path:path.join(artifacts,'app-tour-mobile-nl.png'),fullPage:true});
    await tour.locator('[data-form=slide-editor] [type=submit]').click();await step(3).waitFor();
    await tour.locator('[data-guide=back]').click();await step(2).waitFor();
    await tour.locator('.modal-header [data-action=close-modal]').click();await tour.locator('[data-guide=recover]').waitFor();
    await tour.locator('[data-guide=recover]').click();await tour.locator('[data-form=slide-editor]').waitFor();
    await tour.locator('[data-guide=skip]').click();await step(3).waitFor();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await tour.locator('[data-guide=exit]').focus();await page.keyboard.press('Escape');await page.locator('.guided-app-tour').waitFor({state:'detached'});assert.equal(await page.locator('.guided-app-tour').count(),0);
    assert.equal(new URL(page.url()).pathname,'/second/projects');
    await page.locator('.onboarding-film').click();assert.equal(await page.locator('track[srclang=nl]').count(),1);
    await checkAudio('tour-nl.webm');
    await page.keyboard.press('Escape');
    await page.locator('.onboarding-actions [data-action=onboarding-create]').click();
    assert.match(await page.locator('.project-wizard-steps [aria-current=step]').innerText(),/Zo werkt het/);
    assert.deepEqual(errors,[]);
    console.log('PASS welcome eligibility, setup handoff, isolated actual-app tour, automatic advancement, skip/back, real creation, checklist persistence, English/Dutch audio playback and seeking, captions and Dutch mobile layout. Screenshots: '+artifacts);
  }catch(error){if(page){await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true});for(const frame of page.frames())console.error((await frame.locator('body').innerText()).slice(-4500));}throw error;}finally{if(browser)await browser.close();await close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
