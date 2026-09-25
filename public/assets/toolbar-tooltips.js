// A body-level tooltip stays clear of the toolbar's horizontal overflow.
export function installToolbarTooltips(){
 let tooltip,active;
 const hide=()=>{
  if(tooltip)tooltip.hidden=true;
  active?.querySelector('button')?.removeAttribute('aria-describedby');
  active?.removeAttribute('aria-describedby');active=null;
 };
 const show=item=>{
  if(!item?.dataset.tooltip)return;
  hide();active=item;
  if(!tooltip){tooltip=document.createElement('div');tooltip.id='preview-tool-tooltip';tooltip.className='preview-tool-tooltip';tooltip.setAttribute('role','tooltip');document.body.append(tooltip);}
  tooltip.textContent=item.dataset.tooltip;tooltip.hidden=false;
  (item.querySelector('button:not(:disabled)')||item).setAttribute('aria-describedby',tooltip.id);
  const rect=item.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
  tooltip.style.left=Math.max(8,Math.min(innerWidth-box.width-8,rect.left+(rect.width-box.width)/2))+'px';
  tooltip.style.top=(rect.bottom+8+box.height<=innerHeight-8?rect.bottom+8:Math.max(8,rect.top-box.height-8))+'px';
 };
 document.addEventListener('pointerover',event=>{const item=event.target.closest('.preview-tool');if(item&&item!==active)show(item);});
 document.addEventListener('pointerout',event=>{if(active&&event.target.closest('.preview-tool')===active&&!active.contains(event.relatedTarget))hide();});
 document.addEventListener('focusin',event=>{const item=event.target.closest('.preview-tool');if(item)show(item);});
 document.addEventListener('focusout',event=>{if(active&&!active.contains(event.relatedTarget))hide();});
 document.addEventListener('pointerdown',hide,true);
 document.addEventListener('scroll',hide,true);
 window.addEventListener('resize',hide);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active){hide();event.preventDefault();event.stopImmediatePropagation();}},true);
 return hide;
}
