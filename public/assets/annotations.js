import {tr} from './i18n.js';

// Coordinates are relative to the actual image, excluding letterboxing.
export function imageBounds(width,height,naturalWidth,naturalHeight,fit='contain'){
 const scale=(fit==='cover'?Math.max:Math.min)(width/naturalWidth,height/naturalHeight);
 const w=naturalWidth*scale,h=naturalHeight*scale;return {x:(width-w)/2,y:(height-h)/2,width:w,height:h};
}
export function sameAnnotationImage(a,b){return !!a&&!!b&&['source_version_id','page_number','image_number','image_version_id'].every(k=>String(a[k]??'')===String(b[k]??''));}
export function annotationUi(options){
 const controllers=new Map();
 const toolbar=def=>!options.context(def)?'':`<div class="annotation-toolbar">${options.state.client||options.state.data.can_edit!==false?options.button(`<span data-annotation-arm-label>${tr('pin_feedback')}</span>`,'annotation-arm','small','','pin'):''}${options.button(tr('show_resolved_pins'),'annotation-resolved','small ghost','aria-pressed="false"')}<span class="form-hint" data-annotation-hint role="status"></span></div>`;
 function mount(){
  const roots=[...document.querySelectorAll('.presentation-scroll [data-scroll-slide], .presentation:not(.presentation-scroll) .slide-area:not(.slide-outgoing)')];
  for(const [root,controller] of controllers)if(!roots.includes(root)){controller.destroy();controllers.delete(root);}
  for(const root of roots){
   if(!controllers.has(root))controllers.set(root,scopedAnnotationUi({...options,root,context:()=>options.context(root.dataset.scrollSlide||undefined)}));
   controllers.get(root).sync();
  }
 }
 new MutationObserver(mount).observe(document.querySelector('#app'),{childList:true,subtree:true});
 return {toolbar,mount,redraw:()=>controllers.forEach(controller=>controller.redraw())};
}
function scopedAnnotationUi({state,esc,button,context,openFeedback,root}){
 const hostSelector='.floorplan-image, .full-photo-slide, .visual-image-area, .mood-annotation-host';
 const events=new AbortController();
 let layer=null,host=null,image=null,armed=false,showResolved=false,point={x:.5,y:.5},frame=0,identity='';
 const resize=new ResizeObserver(()=>schedule());
 function current(){return context();}
 function geometry(){if(!host||!image?.naturalWidth)return null;const h=host.getBoundingClientRect(),r=image.getBoundingClientRect(),b=imageBounds(r.width,r.height,image.naturalWidth,image.naturalHeight,getComputedStyle(image).objectFit);return {x:r.left-h.left+b.x,y:r.top-h.top+b.y,width:b.width,height:b.height,sx:host.clientWidth/h.width,sy:host.clientHeight/h.height};}
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
 function draw(){if(!layer?.isConnected)return;const ctx=current(),g=geometry();if(!ctx||!g)return;
  layer.classList.toggle('placing',armed);layer.tabIndex=armed?0:-1;layer.setAttribute('aria-label',tr('pin_keyboard_hint'));
  const comments=state.data.comments.filter(c=>!c.parent_id&&c.slide===ctx.slide&&sameAnnotationImage(c.annotation,ctx));
  layer.innerHTML=comments.map((c,n)=>{const a=c.annotation,x=g.x+a.x*g.width,y=g.y+a.y*g.height;if((Number(c.answered)&&!showResolved)||x<0||y<0||x>host.clientWidth/g.sx||y>host.clientHeight/g.sy)return '';return `<button type="button" class="annotation-pin ${Number(c.answered)?'resolved':''}" data-pin-id="${esc(c.id)}" style="left:${x*g.sx}px;top:${y*g.sy}px" aria-label="${esc(tr('feedback_pin',{number:n+1})+': '+c.body)}" title="${esc(c.body)}">${Number(c.answered)?'✓':n+1}</button>`;}).join('')+(armed?`<span class="annotation-crosshair" style="left:${(g.x+point.x*g.width)*g.sx}px;top:${(g.y+point.y*g.height)*g.sy}px" aria-hidden="true">+</span>`:'');
  root.querySelectorAll('[data-action=annotation-arm]').forEach(b=>{b.setAttribute('aria-pressed',String(armed));const label=b.querySelector('[data-annotation-arm-label]');if(label)label.textContent=tr(armed?'cancel_pin':'pin_feedback');});
  root.querySelectorAll('[data-action=annotation-resolved]').forEach(b=>b.setAttribute('aria-pressed',String(showResolved)));
  root.querySelectorAll('[data-annotation-hint]').forEach(el=>el.textContent=armed?tr('pin_keyboard_hint'):'');
 }
 function mount(){resize.disconnect();layer?.remove();layer=null;host=null;image=null;const ctx=current();if(!ctx)return;const key=JSON.stringify(ctx);if(key!==identity){armed=false;identity=key;}
  // Comparisons show two different images. Pins appear after choosing one image.
  host=root.querySelector(hostSelector);
  if(!host||host.querySelector('.image-comparison'))return;image=host.querySelector('img');if(!image)return;
  host.classList.add('annotation-host');layer=document.createElement('div');layer.className='annotation-layer';host.append(layer);resize.observe(host);resize.observe(image);image.addEventListener('load',schedule,{once:true});schedule();
 }
 // The app replaces image placeholders after fetching authenticated image bytes.
 function sync(){const target=root.querySelector(hostSelector),next=target?.querySelector('img');if(current()&&((next&&next!==image)||!layer?.isConnected))mount();}

 function place(){const ctx=current();if(!ctx)return;armed=false;draw();openFeedback({...ctx,...point});}
 root.addEventListener('click',e=>{
  const control=e.target.closest('[data-action=annotation-arm],[data-action=annotation-resolved]');
  if(control){e.preventDefault();e.stopImmediatePropagation();if(control.dataset.action==='annotation-resolved')showResolved=!showResolved;else {armed=!armed;point={x:.5,y:.5};}draw();if(armed)layer?.focus({preventScroll:true});return;}
  const pin=e.target.closest('[data-pin-id]');if(pin){e.preventDefault();e.stopImmediatePropagation();armed=false;draw();openFeedback(null,pin.dataset.pinId);return;}
  if(!armed||!layer||!e.target.closest('.annotation-layer'))return;
  e.preventDefault();e.stopImmediatePropagation();const g=geometry(),r=host.getBoundingClientRect();if(!g)return;const x=(e.clientX-r.left-g.x)/g.width,y=(e.clientY-r.top-g.y)/g.height;if(x<0||x>1||y<0||y>1)return;point={x,y};place();
 },{capture:true,signal:events.signal});
 root.addEventListener('pointerdown',e=>{if(e.target.closest('.annotation-pin')||(armed&&e.target.closest('.annotation-layer')))e.stopImmediatePropagation();},{capture:true,signal:events.signal});
 root.addEventListener('keydown',e=>{if(e.target!==layer||!armed)return;const delta={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowUp:[0,-.01],ArrowDown:[0,.01]}[e.key];if(delta){e.preventDefault();e.stopImmediatePropagation();point={x:Math.max(0,Math.min(1,point.x+delta[0])),y:Math.max(0,Math.min(1,point.y+delta[1]))};draw();}else if(['Enter',' ','Escape'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape'){armed=false;draw();root.querySelector('[data-action=annotation-arm]')?.focus();}else place();}},{capture:true,signal:events.signal});
 return {sync,redraw:draw,destroy(){events.abort();resize.disconnect();cancelAnimationFrame(frame);layer?.remove();}};
}
