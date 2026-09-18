const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,n)=>sum+v*[.2126,.7152,.0722][n],0);
// Match the text to the actual photo beneath it, adding only the shade needed for contrast.
export function photoInk(samples){
 const pixels=samples.length?samples:[[100,100,100]];
 const choices=[{color:'#ffffff',shade:0,ink:1},{color:'#171717',shade:255,ink:luminance([23,23,23])}];
 for(const c of choices){for(let step=0;step<=20;step++){const alpha=step/20;c.opacity=alpha;
  if(pixels.every(rgb=>{const l=luminance(rgb.map(v=>v*(1-alpha)+c.shade*alpha));return (Math.max(l,c.ink)+.05)/(Math.min(l,c.ink)+.05)>=4.5;}))break;
 }}
 return choices.sort((a,b)=>a.opacity-b.opacity)[0];
}
export function installFullPhotoContrast(){
 let frame=0;const observed=new Set();
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);};
 const resize=new ResizeObserver(schedule);
 function update(){for(const el of observed)if(!el.isConnected){resize.unobserve(el);observed.delete(el);}document.querySelectorAll('.full-photo-slide').forEach(slide=>{
  if(!observed.has(slide)){observed.add(slide);resize.observe(slide);}
  const image=slide.querySelector('img'),copy=slide.querySelector('.full-photo-copy');if(!image?.complete||!image.naturalWidth||!copy)return;
  const r=slide.getBoundingClientRect(),t=copy.getBoundingClientRect();if(!r.width||!r.height)return;
  try{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d',{willReadFrequently:true});
   const scale=Math.max(r.width/image.naturalWidth,r.height/image.naturalHeight),sw=r.width/scale,sh=r.height/scale;
   ctx.fillStyle='#32312f';ctx.fillRect(0,0,64,64);
   ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,0,0,64,64);
   const x=Math.max(0,Math.floor((t.left-r.left)/r.width*64)),y=Math.max(0,Math.floor((t.top-r.top)/r.height*64));
   const w=Math.max(1,Math.min(64-x,Math.ceil(t.width/r.width*64))),h=Math.max(1,Math.min(64-y,Math.ceil(t.height/r.height*64)));
   const data=ctx.getImageData(x,y,w,h).data,samples=[];for(let n=0;n<data.length;n+=4)samples.push([data[n],data[n+1],data[n+2]]);
   const ink=photoInk(samples);slide.style.setProperty('--photo-ink',ink.color);slide.style.setProperty('--photo-shade',`rgba(${ink.shade},${ink.shade},${ink.shade},${ink.opacity})`);slide.dataset.contrast='ready';
  }catch{ /* Keep the readable white-on-dark fallback for unavailable image pixels. */ }
 });}
 document.addEventListener('load',e=>{if(e.target.matches?.('.full-photo-slide img'))schedule();},true);
 new MutationObserver(schedule).observe(document.querySelector('#app'),{childList:true,subtree:true});
 document.fonts?.ready.then(schedule);
}
