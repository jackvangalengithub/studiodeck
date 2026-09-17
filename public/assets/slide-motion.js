let cleanup=null;
export function cancelSlideMotion(){if(cleanup){const done=cleanup;cleanup=null;done();}}
export function animateSlideChange(update,direction=1){
    cancelSlideMotion();
    const previous=document.querySelector('.presentation .slide-area');
    if(!previous||matchMedia('(prefers-reduced-motion: reduce)').matches){update();return;}
    const rect=previous.getBoundingClientRect(),copy=previous.cloneNode(true),background=getComputedStyle(document.querySelector('.presentation')).backgroundColor;
    copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));copy.setAttribute('aria-hidden','true');copy.inert=true;
    update();
    const next=document.querySelector('.presentation .slide-area');if(!next)return;
    Object.assign(copy.style,{position:'fixed',top:rect.top+'px',left:rect.left+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',zIndex:'20',pointerEvents:'none',background});
    copy.classList.add('slide-outgoing');document.body.append(copy);document.body.classList.add('slide-in-motion');
    const distance=innerWidth*(direction<0?-1:1),timing={duration:320,easing:'cubic-bezier(.22,.7,.25,1)',fill:'both'};
    const outgoing=copy.animate([{transform:'translateX(0)'},{transform:`translateX(${-distance}px)`}],timing);
    const incoming=next.animate([{transform:`translateX(${distance}px)`},{transform:'translateX(0)'}],timing);
    const done=()=>{outgoing.cancel();incoming.cancel();copy.remove();document.body.classList.remove('slide-in-motion');};cleanup=done;
    incoming.finished.then(()=>{if(cleanup===done){cleanup=null;done();}}).catch(()=>{});
}
