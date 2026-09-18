let fallback=false,lastExit=0;
export const isPresentationFullscreen=()=>!!document.fullscreenElement||fallback;
export const justExitedFullscreen=()=>Date.now()-lastExit<400;
export function syncPresentationFullscreen(){const active=isPresentationFullscreen();document.body.classList.toggle('presentation-fullscreen',active);document.querySelectorAll('[data-action="toggle-fullscreen"]').forEach(button=>{button.setAttribute('aria-label',active?'Exit fullscreen':'Show fullscreen');button.setAttribute('title',active?'Exit fullscreen':'Show fullscreen');button.setAttribute('aria-pressed',String(active));});}
export async function exitPresentationFullscreen(){if(document.fullscreenElement)await document.exitFullscreen();if(fallback){fallback=false;lastExit=Date.now();}syncPresentationFullscreen();}
export async function togglePresentationFullscreen(){if(isPresentationFullscreen()){await exitPresentationFullscreen();return;}if(document.documentElement.requestFullscreen&&document.fullscreenEnabled)await document.documentElement.requestFullscreen();else fallback=true;syncPresentationFullscreen();}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)lastExit=Date.now();syncPresentationFullscreen();});
