import {tr} from './i18n.js';
let fallback=false,lastExit=0,wasActive=false,hideTimer;
const delay=2200;
export const isPresentationFullscreen=()=>!!document.fullscreenElement||fallback;
export const justExitedFullscreen=()=>Date.now()-lastExit<400;
const hasPopup=()=>!!document.querySelector('.modal-backdrop,#section-slide-menu');
function setHidden(hidden){
 document.body.classList.toggle('presentation-controls-hidden',hidden);
}
function hide(){
 clearTimeout(hideTimer);
 if(!isPresentationFullscreen()||!document.querySelector('.presentation'))return;
 if(hasPopup()){hideTimer=setTimeout(hide,delay);return;}
 setHidden(true);
}
function reveal(){
 if(!isPresentationFullscreen()||!document.querySelector('.presentation'))return;
 setHidden(false);clearTimeout(hideTimer);hideTimer=setTimeout(hide,delay);
}
export function syncPresentationFullscreen(){
 const active=isPresentationFullscreen();document.body.classList.toggle('presentation-fullscreen',active);
 document.querySelectorAll('[data-action="toggle-fullscreen"]').forEach(button=>{button.setAttribute('aria-label',active?tr("exit_fullscreen"):tr("show_fullscreen"));const tooltip=button.querySelector('.presentation-action-tooltip');if(tooltip){tooltip.textContent=active?tr('exit_fullscreen'):tr('show_fullscreen');button.removeAttribute('title');}else button.setAttribute('title',active?tr("exit_fullscreen"):tr("show_fullscreen"));button.setAttribute('aria-pressed',String(active));const label=button.querySelector('[data-fullscreen-label]');if(label)label.textContent=active?tr('exit_fullscreen'):tr('show_fullscreen');});
 if(active&&!wasActive)reveal();
 else if(!active){clearTimeout(hideTimer);setHidden(false);}
 else setHidden(document.body.classList.contains('presentation-controls-hidden'));
 wasActive=active;
}
export async function exitPresentationFullscreen(){if(document.fullscreenElement)await document.exitFullscreen();if(fallback){fallback=false;lastExit=Date.now();}syncPresentationFullscreen();}
export async function togglePresentationFullscreen(){if(isPresentationFullscreen()){await exitPresentationFullscreen();return;}if(document.documentElement.requestFullscreen&&document.fullscreenEnabled)await document.documentElement.requestFullscreen();else fallback=true;syncPresentationFullscreen();}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)lastExit=Date.now();syncPresentationFullscreen();});
document.addEventListener('pointermove',reveal,{passive:true});
document.addEventListener('pointerdown',reveal,{passive:true});
document.addEventListener('touchstart',reveal,{passive:true});
document.addEventListener('keydown',event=>{
 if(!isPresentationFullscreen())return;
 // Tab restores the cursor for keyboard navigation; slide arrows keep it hidden.
 if(event.key==='Tab'){reveal();return;}
 if(['ArrowLeft','ArrowRight'].includes(event.key)&&!hasPopup()&&!event.target.closest('input,textarea,select,[contenteditable="true"],.floorplan-viewport'))hide();
},true);
