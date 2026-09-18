// Rebuild the silent, captioned 60-second product tour from fictional app screens.
// Requires Playwright, Chromium and ffmpeg (FFMPEG_BIN can point to Playwright's binary).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const fs=require('node:fs/promises'),path=require('node:path');
const {startOnboardingFixture}=require('../tests/fixtures/onboarding-server.cjs');
(async()=>{
  const {fixture,sample,base,close}=await startOnboardingFixture();let browser;
  const out=path.resolve(__dirname,'../public/assets/onboarding');await fs.mkdir(out,{recursive:true});
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});page.setDefaultTimeout(12000);
    const frames=[];
    async function capture(){await page.evaluate(()=>Promise.all([...document.images].filter(i=>i.src).map(i=>i.decode().catch(()=>{}))));frames.push(await page.screenshot({type:'jpeg',quality:90}));}
    await page.goto(base+'/demo/projects');await page.locator('.onboarding-welcome').waitFor();await capture();
    fixture.empty=false;fixture.visible=true;
    await page.goto(base+'/demo/projects/'+sample.id);await page.locator('.project-head [data-action=preview]').click();await page.locator('.presentation').waitFor();await capture();
    fixture.empty=true;fixture.visible=false;
    await page.goto(base+'/demo/projects');await page.locator('.onboarding-actions [data-action=onboarding-create]').click();await page.locator('[data-action=wizard-details]').waitFor();await capture();await page.locator('[data-action=wizard-details]').click();await page.locator('[data-form=new-project]').waitFor();
    await page.locator('[name=name]').fill('The Willow House');await page.locator('input[name=description]').fill('Natural materials, soft light, room to live.');await capture();
    await page.locator('[data-form=new-project] [type=submit]').click();await page.locator('#wizard-file-input').setInputFiles(path.resolve(__dirname,'../public/assets/moodboard.webp'));await capture();
    fixture.empty=false;fixture.visible=true;
    await page.goto(base+'/demo/projects/'+sample.id+'?tab=slides');await page.locator('.project-head').waitFor();await capture();
    await page.locator('.project-head [data-action=preview]').click();await page.locator('.presentation').waitFor();await page.locator('[data-action=next-slide]').first().click();await capture();
    await page.keyboard.press('Escape');await page.locator('[data-action=onboarding-help]').click();await page.locator('[data-action=onboarding-example]').click();
    const tour=page.frameLocator('.guided-app-tour iframe');
    await tour.locator('.tabs [data-tab=slides]').click();
    await tour.locator('[data-action=edit-slide][data-id=intro]').click();
    await tour.locator('[data-form=slide-editor] [name=title]').fill('A home, made for you.');await capture();
    await tour.locator('[data-form=slide-editor] [type=submit]').click();
    await tour.locator('.project-head [data-action=preview]').click();
    await tour.locator('[data-action=jump-section][data-section=budget]').click();await capture();
    await tour.locator('[data-budget-option="tour-option"]').check();await capture();
    await tour.locator('[data-action=feedback]').click();await tour.locator('[data-form=feedback] textarea').fill('Could we try a warmer finish?');
    await tour.locator('[data-form=feedback] [type=submit]').click();await tour.locator('.app-tour-coach[data-step="8"]').waitFor();await capture();
    await page.locator('[data-tour-exit]').click();fixture.empty=true;fixture.visible=false;await page.goto(base+'/demo/projects');await page.locator('.onboarding-welcome').waitFor();await capture();
    const encoder=spawn(process.env.FFMPEG_BIN||'ffmpeg',['-hide_banner','-loglevel','error','-f','image2pipe','-c:v','mjpeg','-framerate','1','-i','pipe:0','-an','-c:v','libvpx','-b:v','650k','-r','12','-t','60','-y',path.join(out,'tour.webm')],{stdio:['pipe','inherit','inherit']});
    const finished=once(encoder,'close');encoder.stdin.on('error',()=>{});
    for(const frame of frames)for(let i=0;i<5;i++)if(!encoder.stdin.write(frame))await once(encoder.stdin,'drain');encoder.stdin.end();
    const [code]=await finished;if(code!==0)throw Error('Tour encoder failed: '+code);
    // Use the same finished-presentation still as the accessible video poster.
    await fs.writeFile(path.join(out,'poster.jpg'),frames[1]);
    const captions={
      en:[
        'Welcome to Studiodeck. A considered space for your next great project.',
        'Bring your design files, presentation and client conversations together.',
        'Start a project. First, see how it works.',
        'Add a short description if you like. Make it your own.',
        'Add images, plans, presentations or quotes now. Or add your files later.',
        'Review the slides made from your files. You can always adjust the story.',
        'Preview the presentation to see what your client will see.',
        'Your words, your style. Try editing a slide in the guided app tour.',
        'Make budget choices clear with optional items and price ranges.',
        'Try adding the reading nook. The example total updates immediately.',
        'When you share, client feedback stays alongside the design.',
        'Ready to begin? Create your first project. We’ll guide you through it.',
      ],
      nl:[
        'Welkom bij Studiodeck. Een fijne plek voor je volgende mooie project.',
        'Breng je ontwerpbestanden, presentatie en gesprekken met klanten samen.',
        'Begin een project. Bekijk eerst hoe het werkt.',
        'Voeg eventueel een korte beschrijving toe. Maak het jouw verhaal.',
        'Voeg afbeeldingen, tekeningen, presentaties of offertes toe. Nu of later.',
        'Bekijk de dia’s die uit je bestanden zijn gemaakt. Je kunt alles aanpassen.',
        'Bekijk de presentatie zoals je klant die straks ziet.',
        'Jouw woorden, jouw stijl. Probeer het in de rondleiding door de app.',
        'Maak keuzes duidelijk met optionele onderdelen en prijsbandbreedtes.',
        'Voeg de leeshoek toe. Het voorbeeldtotaal wordt direct bijgewerkt.',
        'Als je deelt, blijft feedback van klanten bij het ontwerp.',
        'Klaar om te beginnen? Maak je eerste project. We helpen je op weg.',
      ],
    };
    const time=n=>`00:${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}.000`;
    for(const [language,lines]of Object.entries(captions))await fs.writeFile(path.join(out,`tour-${language}.vtt`),'WEBVTT\n\n'+lines.map((line,i)=>`${time(i*5)} --> ${time((i+1)*5)}\n${line}\n`).join('\n'));
    console.log('Created 60-second tour, poster and English/Dutch captions in '+out);
  }finally{if(browser)await browser.close();await close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
