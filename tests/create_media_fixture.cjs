// Generate a tiny local WebM for the media regression suite. No network.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  const bytes=await page.evaluate(async()=>{
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
   const ctx=canvas.getContext('2d'),recorder=new MediaRecorder(canvas.captureStream(15),{mimeType:'video/webm;codecs=vp8'}),chunks=[];
   recorder.ondataavailable=e=>chunks.push(e.data);
   const done=new Promise(resolve=>recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()))));
   recorder.start();let frame=0;
   const draw=setInterval(()=>{ctx.fillStyle='#183832';ctx.fillRect(0,0,640,360);ctx.fillStyle='#e5d3b5';ctx.fillRect(80+frame++*2,80,180,200);},65);
   await new Promise(resolve=>setTimeout(resolve,1800));clearInterval(draw);recorder.stop();return done;
  });
  fs.writeFileSync(process.env.MEDIA_TEST_VIDEO||'/tmp/studiodeck-media-test.webm',Buffer.from(bytes));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
