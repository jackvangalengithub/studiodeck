// A floating tooltip stays visible beside controls inside scrolling slide lists.
export function installIconTooltips({enabled}){
 let anchor=null,tooltip=null,nativeTitle=null,description=null;
 function hide(){
  if(anchor){if(nativeTitle!==null)anchor.setAttribute('title',nativeTitle);if(description===null)anchor.removeAttribute('aria-describedby');else anchor.setAttribute('aria-describedby',description);}
  tooltip?.remove();anchor=tooltip=null;nativeTitle=description=null;
 }
 function target(node){
  const button=node.closest?.('#app button,#overlay button');
  if(!enabled()||!button||button.closest('.quick-action'))return null;
  if(!button.matches('.slide-drag-handle,.group-drag-handle')&&(!button.querySelector('svg')||button.textContent.trim()))return null;
  return button;
 }
 function show(button){
  if(!button||anchor===button)return;
  hide();const label=button.getAttribute('title')||button.getAttribute('aria-label');if(!label)return;
  anchor=button;nativeTitle=button.getAttribute('title');description=button.getAttribute('aria-describedby');button.removeAttribute('title');
  tooltip=document.createElement('div');tooltip.id='icon-action-tooltip';tooltip.className='icon-action-tooltip';tooltip.setAttribute('role','tooltip');tooltip.textContent=label;
  document.body.append(tooltip);button.setAttribute('aria-describedby',[description,tooltip.id].filter(Boolean).join(' '));
  const rect=button.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
  tooltip.style.left=Math.max(8,Math.min(innerWidth-box.width-8,rect.left+rect.width/2-box.width/2))+'px';
  tooltip.style.top=(rect.bottom+box.height+14<innerHeight?rect.bottom+7:Math.max(8,rect.top-box.height-7))+'px';
 }
 document.addEventListener('pointerover',e=>show(target(e.target)));
 document.addEventListener('pointerout',e=>{if(anchor&&anchor.contains(e.target)&&!anchor.contains(e.relatedTarget)&&document.activeElement!==anchor)hide();});
 document.addEventListener('focusin',e=>show(target(e.target)));
 document.addEventListener('focusout',e=>{if(anchor===e.target)hide();});
 document.addEventListener('click',hide,true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
 new MutationObserver(()=>{if(anchor&&(!anchor.isConnected||!enabled()))hide();}).observe(document.querySelector('#app'),{childList:true,subtree:true});
}
