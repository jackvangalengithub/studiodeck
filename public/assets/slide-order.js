// Pointer, touch and keyboard ordering share the same persistent order.
export function movedSlide(order,id,target,after=false){const next=order.filter(v=>v!==id),index=next.indexOf(target);if(index<0)return order;next.splice(index+(after?1:0),0,id);return next;}
export function installSlideOrdering({getOrder,saveOrder,assignGroup,setBusy,onError}){
 let drag=null,keyboard=null,frame=0,saving=false;
 const announce=message=>{const el=document.querySelector('#slide-order-status');if(el)el.textContent=message;};
 const resetTargets=()=>document.querySelectorAll('.group-drop-target').forEach(el=>el.classList.remove('group-drop-target'));
 function placeholder(row){const ghost=row.cloneNode(true);ghost.className='slide-drop-placeholder';ghost.removeAttribute('data-slide-id');ghost.removeAttribute('data-slide-section');ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));ghost.innerHTML=`<span>Drop here</span><strong></strong>`;ghost.querySelector('strong').textContent=row.querySelector('h3')?.textContent||'Slide';ghost.style.minHeight=Math.min(180,row.getBoundingClientRect().height)+'px';return ghost;}
 function clear(){document.body.classList.remove('dragging-slide');cancelAnimationFrame(frame);resetTargets();document.querySelectorAll('.dragging').forEach(el=>el.classList.remove('dragging'));document.querySelector('.slide-drop-placeholder')?.remove();if(drag?.handle.hasPointerCapture?.(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);drag=null;keyboard=null;setBusy(false);}
 function target(x,y){const hit=document.elementFromPoint(Math.max(1,Math.min(innerWidth-1,x)),Math.max(1,Math.min(innerHeight-1,y))),group=hit?.closest('[data-drop-group]');resetTargets();drag.group=group?.dataset.dropGroup;drag.valid=false;
  if(group){group.classList.add('group-drop-target');drag.ghost.hidden=true;announce('Move slide to '+group.textContent);return;}
  drag.ghost.hidden=false;
  if(hit?.closest('.slide-drop-placeholder')){drag.valid=!!drag.target;return;}
  const row=hit?.closest('[data-slide-id]');if(!row||row.dataset.slideId===drag.id){drag.valid=!!drag.target&&!!hit?.closest('.slide-editor');return;}
  const rect=row.getBoundingClientRect(),after=document.querySelector('.all-slides')?y>rect.bottom-rect.height*.25||(y>rect.top+rect.height*.25&&x>rect.left+rect.width/2):y>rect.top+rect.height/2;
  drag.target=row.dataset.slideId;drag.after=after;drag.valid=true;row[after?'after':'before'](drag.ghost);
 }
 function autoScroll(){if(!drag?.active)return;const rail=document.querySelector('.editor-section-index'),rect=rail?.getBoundingClientRect(),overRail=rect&&drag.y>=rect.top&&drag.y<=rect.bottom;
  if(overRail){const dx=drag.x<rect.left+35?-10:drag.x>rect.right-35?10:0;if(dx){rail.scrollLeft+=dx;target(drag.x,drag.y);}}
  else{const margin=80,delta=drag.y<margin?-16:drag.y>innerHeight-margin?16:0;if(delta){window.scrollBy(0,delta);target(drag.x,drag.y);}}
  frame=requestAnimationFrame(autoScroll);
 }

 async function commit(action,id,message){saving=true;setBusy(true);try{await action();document.querySelector(`[data-drag-slide="${CSS.escape(id)}"]`)?.focus({preventScroll:true});announce(message);}catch(error){onError(error.message);}finally{saving=false;setBusy(false);}}
 document.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-drag-slide]');if(!handle||handle.disabled||e.button!==0||drag||saving)return;e.preventDefault();const row=handle.closest('[data-slide-id]');drag={id:handle.dataset.dragSlide,handle,row,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,active:false};handle.setPointerCapture(e.pointerId);setBusy(true);});
 document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;drag.x=e.clientX;drag.y=e.clientY;if(!drag.active&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>6){drag.active=true;document.body.classList.add('dragging-slide');drag.ghost=placeholder(drag.row);drag.row.after(drag.ghost);drag.row.classList.add('dragging');autoScroll();}if(!drag.active)return;e.preventDefault();target(e.clientX,e.clientY);});
 document.addEventListener('pointerup',e=>{if(!drag||e.pointerId!==drag.pointerId)return;const {id,target,after,active,group,valid}=drag,order=getOrder();clear();if(active&&group)commit(()=>assignGroup(id,group),id,'Slide moved to group.');else if(active&&valid&&target)commit(()=>saveOrder(movedSlide(order,id,target,after)),id,'Slide order saved.');});
 document.addEventListener('pointercancel',()=>{if(drag)clear();});
 document.addEventListener('keydown',e=>{const handle=e.target.closest('[data-drag-slide]');if(e.key==='Escape'&&(drag||keyboard)){e.preventDefault();clear();announce('Reordering cancelled.');return;}if(!handle||handle.disabled||saving)return;
  if([' ','Enter'].includes(e.key)){e.preventDefault();if(keyboard){const {order,id}=keyboard;clear();commit(()=>saveOrder(order),id,'Slide order saved.');}else{document.body.classList.add('dragging-slide');keyboard={id:handle.dataset.dragSlide,order:getOrder()};const row=handle.closest('[data-slide-id]');keyboard.ghost=placeholder(row);row.after(keyboard.ghost);setBusy(true);announce('Picked up slide. Use arrow keys to choose its position, Enter to save, or Escape to cancel.');}return;}
  if(keyboard&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const order=keyboard.order,visible=[...document.querySelectorAll('[data-slide-id]')].map(el=>el.dataset.slideId),subset=order.filter(id=>visible.includes(id)),from=subset.indexOf(keyboard.id),to=e.key==='Home'?0:e.key==='End'?subset.length-1:Math.max(0,Math.min(subset.length-1,from+(['ArrowUp','ArrowLeft'].includes(e.key)?-1:1)));if(to!==from){const targetId=subset[to],row=document.querySelector(`[data-slide-id="${CSS.escape(targetId)}"]`);keyboard.order=movedSlide(order,keyboard.id,targetId,to>from);row[to>from?'after':'before'](keyboard.ghost);}announce(`New position ${to+1} of ${subset.length}. Press Enter to save.`);}
 });
 document.addEventListener('dragstart',e=>{if(e.target.closest('.slide-editor'))e.preventDefault();});
}
