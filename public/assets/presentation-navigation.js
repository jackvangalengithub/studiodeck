let observer;
export function syncPresentationNavigation(){
 observer?.disconnect();
 const presentation=document.querySelector('.presentation'),chrome=presentation?.querySelector('.presentation-chrome-top'),rail=chrome?.querySelector('.presentation-section-index');
 if(!rail)return;
 const back=chrome.querySelector('[data-group-scroll="-1"]'),forward=chrome.querySelector('[data-group-scroll="1"]');
 const update=()=>{
  const overflow=rail.scrollWidth>rail.clientWidth+2;
  // Absolute arrows reserve no space, so their appearance cannot move the groups.
  back.hidden=!overflow||rail.scrollLeft<=2;
  forward.hidden=!overflow||rail.scrollLeft+rail.clientWidth>=rail.scrollWidth-2;
  presentation.style.setProperty('--presentation-toolbar-height',`${chrome.offsetHeight}px`);
 };
 const revealActive=()=>{
  const selected=rail.querySelector('[aria-current="true"]');if(!selected)return;
  const target=selected.closest('.section-split')||selected,r=rail.getBoundingClientRect(),b=target.getBoundingClientRect();
  if(b.left<r.left+22)rail.scrollLeft-=r.left+22-b.left;
  else if(b.right>r.right-22)rail.scrollLeft+=b.right-(r.right-22);
 };
 for(const button of [back,forward])button.addEventListener('click',()=>rail.scrollBy({left:Number(button.dataset.groupScroll)*Math.max(100,rail.clientWidth*.7),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
 rail.addEventListener('scroll',update,{passive:true});
 rail.addEventListener('focusin',event=>{const b=event.target.getBoundingClientRect(),r=rail.getBoundingClientRect();if(b.left<r.left+22)rail.scrollLeft-=r.left+22-b.left;else if(b.right>r.right-22)rail.scrollLeft+=b.right-r.right+22;});
 observer=new ResizeObserver(()=>{revealActive();update();});observer.observe(chrome);observer.observe(rail);revealActive();update();
}
