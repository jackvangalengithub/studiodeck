import {tr} from './i18n.js';
let fallback=false,lastExit=0,wasActive=false,hideTimer;
const delay=2200;
export const isPresentationFullscreen=()=>!!document.fullscreenElement||fallback;
export const justExitedFullscreen=()=>Date.now()-lastExit<400;
const hasPopup=()=>!!document.querySelector('.modal-backdrop,#section-slide-menu');
function setHidden(hidden){
 document.body.classList.toggle('presentation-controls-hidden',hidden);
 document.querySelectorAll('.presentation-chrome-top').forEach(el=>{el.inert=hidden;if(hidden)el.setAttribute('aria-hidden','true');else el.removeAttribute('aria-hidden');});
}
function hide(){
 clearTimeout(hideTimer);
 if(!isPresentationFullscreen()||!document.querySelector('.presentation'))return;
 if(hasPopup()){hideTimer=setTimeout(hide,delay);return;}
 const focused=document.activeElement;
 if(focused?.closest('.presentation-chrome-top'))focused.blur();
 setHidden(true);
}
function reveal(){
 if(!isPresentationFullscreen()||!document.querySelector('.presentation'))return;
 setHidden(false);clearTimeout(hideTimer);hideTimer=setTimeout(hide,delay);
}
export function syncPresentationFullscreen(){
 const active=isPresentationFullscreen();document.body.classList.toggle('presentation-fullscreen',active);
 document.querySelectorAll('[data-action="toggle-fullscreen"]').forEach(button=>{button.setAttribute('aria-label',active?tr("exit_fullscreen"):tr("show_fullscreen"));button.setAttribute('title',active?tr("exit_fullscreen"):tr("show_fullscreen"));button.setAttribute('aria-pressed',String(active));});
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
 // Tab exposes all navigation to keyboard users. Slide arrows never wake chrome.
 if(event.key==='Tab'){reveal();return;}
 if(['ArrowLeft','ArrowRight'].includes(event.key)&&!hasPopup()&&!event.target.closest('input,textarea,select,[contenteditable="true"],.floorplan-viewport'))hide();
},true);
