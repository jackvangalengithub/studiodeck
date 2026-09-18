export function installSectionMenus({getSlides,onNavigate}){
 let menu=null,anchor=null;
 function close(restore=false){const button=anchor;menu?.remove();menu=null;anchor=null;button?.setAttribute('aria-expanded','false');if(restore&&button?.isConnected)button.focus();}
 function position(){if(!menu||!anchor?.isConnected){close();return;}const rect=anchor.parentElement.getBoundingClientRect(),width=Math.min(360,innerWidth-24);Object.assign(menu.style,{width:width+'px',left:Math.max(12,Math.min(innerWidth-width-12,rect.left))+'px',top:(rect.bottom+6)+'px',maxHeight:Math.max(100,Math.min(420,innerHeight-rect.bottom-18))+'px'});}
 function open(button){if(anchor===button){close(true);return;}close();anchor=button;const slides=getSlides();menu=document.createElement('div');menu.id='section-slide-menu';menu.className='section-slide-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',button.getAttribute('aria-label'));
  slides.forEach((slide,index)=>{if(slide.section!==button.dataset.sectionMenu)return;const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitem');const number=document.createElement('span'),title=document.createElement('span');number.className='section-slide-number';number.textContent=String(index+1).padStart(2,'0');title.textContent=slide.title;item.append(number,title);item.addEventListener('click',()=>{close();onNavigate(slide.id);document.querySelector('.slide-area')?.focus({preventScroll:true});});menu.append(item);});
  document.body.append(menu);button.setAttribute('aria-expanded','true');position();menu.querySelector('button')?.focus();
 }
 document.addEventListener('click',e=>{const button=e.target.closest('[data-section-menu]');if(button){open(button);return;}if(menu&&!menu.contains(e.target))close();});
 document.addEventListener('keydown',e=>{
  const trigger=e.target.closest('[data-section-menu]');if(trigger&&!menu&&e.key==='ArrowDown'){e.preventDefault();e.stopImmediatePropagation();open(trigger);return;}
  if(!menu)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);return;}
  if(e.key==='Tab'){close(true);return;}
  if(!menu.contains(e.target))return;
  if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key)){
   e.preventDefault();e.stopImmediatePropagation();const items=[...menu.querySelectorAll('button')],index=items.indexOf(document.activeElement);
   const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1)+items.length)%items.length;items[next]?.focus();
  }
 },true);
 window.addEventListener('resize',position);document.addEventListener('scroll',e=>{if(menu&&!menu.contains(e.target))position();},true);
 new MutationObserver(()=>{if(menu&&!anchor?.isConnected)close();}).observe(document.querySelector('#app'),{childList:true,subtree:true});
}
