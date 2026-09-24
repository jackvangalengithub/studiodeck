// A local, illustrative pan/zoom demo. No provider requests or prompt interpretation.
(() => {
  const section=document.querySelector('#ai-movement');if(!section)return;
  const image=section.querySelector('.motion-scene img'),status=section.querySelector('[data-motion-demo-status]'),play=section.querySelector('[data-motion-demo-play]'),prompt=section.querySelector('textarea');
  const preference=matchMedia('(prefers-reduced-motion: reduce)');
  const presets={
    'pan-right':{transform:'translateX(-3%) scale(1.1)',prompt:'Move slowly from left to right. Keep the light soft and the details faithful to the design. Ease to a stop at the original photo’s exact composition.'},
    'pan-left':{transform:'translateX(3%) scale(1.1)',prompt:'Move slowly from right to left, with a calm, steady pace. Preserve the materials and lighting. Finish at the original photo’s exact composition.'},
    'pull-back':{transform:'scale(1.14)',prompt:'Start a little closer and gently pull the camera back to reveal the scene. Keep every detail true to the design. Slow to a stop at the original photo’s exact composition.'}
  };
  let selected='pan-right',animation=null,played=false;
  function stop(){animation?.cancel();animation=null;play.textContent='Replay movement demo ↗';status.textContent='The original photo. Exactly where the movement ends.';}
  function run(){
    if(!image.complete||!image.naturalWidth)return;
    stop();played=true;
    if(preference.matches){status.textContent='Original photo shown — reduced motion is enabled.';return;}
    const current=image.animate([{transform:presets[selected].transform},{transform:'none'}],{duration:8000,easing:'cubic-bezier(.25,.1,.25,1)',fill:'none'});
    animation=current;status.textContent='A little movement. A new way into the design.';
    current.finished.then(()=>{if(animation===current)stop();}).catch(()=>{});
  }
  play.hidden=false;play.addEventListener('click',run);
  section.querySelectorAll('[data-demo-preset]').forEach(button=>{
    button.disabled=false;button.addEventListener('click',()=>{
      selected=button.dataset.demoPreset;prompt.value=presets[selected].prompt;
      section.querySelectorAll('[data-demo-preset]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      run();
    });
  });
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){if(!played)run();else if(animation?.playState==='paused')animation.play();}else animation?.pause();}},{threshold:.3});
  observer.observe(image);
  image.addEventListener('load',()=>{const rect=image.getBoundingClientRect();if(!played&&rect.top<innerHeight&&rect.bottom>0)run();});
  preference.addEventListener('change',()=>{if(preference.matches)stop();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)animation?.pause();else{const r=image.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0&&animation?.playState==='paused')animation.play();}});
  document.addEventListener('studiodeck:audience',stop);
})();
