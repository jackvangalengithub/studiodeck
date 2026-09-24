let cleanup=null;
export function cancelSlideMotion(){if(cleanup){const done=cleanup;cleanup=null;done();}}
export function animateSlideChange(update,direction=1){
    cancelSlideMotion();
    const previous=document.querySelector('.presentation .slide-area');
    if(!previous||matchMedia('(prefers-reduced-motion: reduce)').matches){update();return;}
    const rect=previous.getBoundingClientRect(),copy=previous.cloneNode(true),background=getComputedStyle(document.querySelector('.presentation')).backgroundColor;
    const toolbarHeight=getComputedStyle(previous).getPropertyValue('--presentation-toolbar-height');
    const originals=[previous,...previous.querySelectorAll('*')],copies=[copy,...copy.querySelectorAll('*')];
    const scrollPositions=originals.map((el,index)=>({el:copies[index],top:el.scrollTop,left:el.scrollLeft})).filter(p=>p.top||p.left);
    copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));copy.setAttribute('aria-hidden','true');copy.inert=true;
    // A transition copy must never create a second playing YouTube frame.
    copy.querySelectorAll('video').forEach(video=>video.remove());
    copy.querySelectorAll('iframe[data-youtube-player]').forEach(frame=>frame.remove());
    copy.querySelectorAll('[data-play-youtube]').forEach(button=>button.hidden=false);
    update();
    const next=document.querySelector('.presentation .slide-area');if(!next)return;
    Object.assign(copy.style,{position:'fixed',top:rect.top+'px',left:rect.left+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',zIndex:'20',pointerEvents:'none',background});
    // Keep ancestor-dependent styles (including fullscreen padding and animation:none).
    // Freeze the old toolbar measurement if the next slide changes its height.
    if(toolbarHeight)copy.style.setProperty('--presentation-toolbar-height',toolbarHeight);
    copy.classList.add('slide-outgoing');next.closest('.presentation').append(copy);
    // cloneNode does not copy scroll offsets; restore them after layout is available.
    for(const position of scrollPositions){position.el.scrollTop=position.top;position.el.scrollLeft=position.left;}
    document.body.classList.add('slide-in-motion');
    const distance=innerWidth*(direction<0?-1:1),timing={duration:320,easing:'cubic-bezier(.22,.7,.25,1)',fill:'both'};
    const outgoing=copy.animate([{transform:'translateX(0)'},{transform:`translateX(${-distance}px)`}],timing);
    const incoming=next.animate([{transform:`translateX(${distance}px)`},{transform:'translateX(0)'}],timing);
    const done=()=>{outgoing.cancel();incoming.cancel();copy.remove();document.body.classList.remove('slide-in-motion');};cleanup=done;
    incoming.finished.then(()=>{if(cleanup===done){cleanup=null;done();}}).catch(()=>{});
}
