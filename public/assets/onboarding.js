import {getLanguage} from './i18n.js';
import {onboardingText as t} from './onboarding-copy.js';

// The guided tour embeds the real app in a separate, local-only practice session.
export function onboardingUi({state,esc,icon,button,openModal,closeModal,render,startProject,upload,preview,share,onError}) {
  let tourFrame=null,tourFocus=null;
  const key=()=>`studiodeck.onboarding.v1:${state.user?.id||state.user?.email||'demo'}:${state.studio?.id||'demo'}`;
  const read=(storage,suffix,fallback={})=>{try{return JSON.parse(storage.getItem(key()+suffix))||fallback;}catch{return fallback;}};
  const write=(storage,suffix,value)=>{try{storage.setItem(key()+suffix,JSON.stringify(value));}catch{/* Private browsing still permits the full experience. */}};
  const prefs=()=>read(localStorage,':progress');
  function remember(patch){write(localStorage,':progress',{...prefs(),...patch});}
  const createButton=()=>button(t(state.studioEmpty?'create':'startProject'),'onboarding-create','primary','','arrow');
  function welcome(){
    const name=(state.user?.profile?.name||state.user?.name||'').trim().split(/\s+/)[0];
    return `<section class="onboarding-welcome" aria-labelledby="welcome-title">
      <div class="onboarding-hero"><div class="onboarding-copy">
        <p class="onboarding-eyebrow">${name?t('hello',{name:esc(name)}):t('welcome')}</p>
        <h1 id="welcome-title">${t('title')}</h1><p class="onboarding-intro">${t('intro')}</p>
        <div class="onboarding-actions">${createButton()}${button(t('example'),'onboarding-example','onboarding-secondary','','play')}</div>
        <p class="onboarding-reassurance">${t('reassurance')}</p>
      </div><button class="onboarding-film" data-action="onboarding-video" aria-label="${t('play')}">
        <img src="assets/interior.webp" alt="${t('interiorAlt')}" fetchpriority="high">
        <span class="onboarding-film-top"><span>STUDIODECK / ${getLanguage()==='nl'?'EEN EERSTE BLIK':'A FIRST LOOK'}</span><span>${t('duration')}</span></span>
        <span class="onboarding-film-play">${icon('play')}</span>
        <span class="onboarding-film-caption"><strong>${t('watch')}</strong><span>${t('watchSub')}</span></span>
      </button></div>
    </section>`;
  }
  function help(){
    openModal(t('help'),`<p>${t('helpIntro')}</p><div class="onboarding-help-actions">${button(t('watch'),'onboarding-video','','','play')}${button(t('example'),'onboarding-example','','','spark')}</div>`,true);
  }
  function video(){
    remember({learned:true});
    openModal(t('tour'),`<div class="onboarding-video"><video controls playsinline preload="metadata" poster="assets/onboarding/poster.jpg" aria-label="${t('tour')}"><source src="assets/onboarding/tour.webm" type="video/webm"><track kind="captions" src="assets/onboarding/tour-${getLanguage()}.vtt" srclang="${getLanguage()}" label="${getLanguage()==='nl'?'Nederlands':'English'}" default></video><p data-video-error role="status" hidden>${t('videoError')}</p></div>
      <details class="onboarding-transcript"><summary>${t('transcript')}</summary>${[1,2,3,4,5].map(n=>`<p>${t('transcript'+n)}</p>`).join('')}</details>
      <div class="modal-footer onboarding-footer">${button(t('example'),'onboarding-example','ghost')}${createButton()}</div>`,true);
    const player=document.querySelector('.onboarding-video video');
    player.querySelector('source').addEventListener('error',()=>{document.querySelector('[data-video-error]')?.removeAttribute('hidden');});
    player.addEventListener('error',()=>{document.querySelector('[data-video-error]')?.removeAttribute('hidden');});
    // This runs only in direct response to the customer's Play click.
    player.play().catch(()=>{});
  }
  function closeTour(create=false){
    if(!tourFrame)return;
    tourFrame.remove();tourFrame=null;
    document.querySelector('#app').inert=false;document.querySelector('#overlay').inert=false;
    document.body.style.overflow='';tourFocus?.focus();
    if(create)startProject().catch(onError);
  }
  function openAppTour(){
    closeModal();if(tourFrame)return;remember({learned:true});tourFocus=document.activeElement;
    tourFrame=document.createElement('section');tourFrame.className='guided-app-tour';
    tourFrame.setAttribute('role','dialog');tourFrame.setAttribute('aria-modal','true');tourFrame.setAttribute('aria-label',t('appTour'));
    tourFrame.innerHTML=`<header><div><strong>${t('appTour')}</strong><small>${t('tourSample')}</small></div><button type="button" class="button small" data-tour-exit>${t('tourExit')}</button></header><iframe title="${t('appTour')}" sandbox="allow-scripts allow-same-origin allow-forms" src="/index.html?app-tour=1&language=${getLanguage()}"></iframe>`;
    tourFrame.querySelector('[data-tour-exit]').addEventListener('click',()=>closeTour());
    document.body.append(tourFrame);document.querySelector('#app').inert=true;document.querySelector('#overlay').inert=true;document.body.style.overflow='hidden';
    tourFrame.querySelector('[data-tour-exit]').focus();
  }
  window.addEventListener('message',event=>{
    if(!tourFrame||event.origin!==location.origin||event.source!==tourFrame.querySelector('iframe').contentWindow)return;
    if(event.data?.type==='studiodeck-tour-exit')closeTour();
    if(event.data?.type==='studiodeck-tour-create')closeTour(true);
  });
  document.addEventListener('keydown',event=>{
    if(!tourFrame)return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();closeTour();}
  },true);
  function created(projectId){remember({projectId,dismissed:false,reviewed:false});}
  function reviewed(){if(prefs().projectId===state.data?.project.id)remember({reviewed:true});}
  function checklist(){
    const p=prefs(),d=state.data;
    if(!d||d.can_edit===false||p.projectId!==d.project.id||p.dismissed)return '';
    const shared=d.iterations?.some(i=>i.status==='shared')||d.iteration.status==='shared';
    const done=[d.files.length>0,!!p.reviewed||shared,shared];
    return `<section class="onboarding-checklist" aria-labelledby="onboarding-checklist-title"><div class="onboarding-checklist-head"><div><h2 id="onboarding-checklist-title">${t(done.every(Boolean)?'complete':'checklist')}</h2><p>${t('progress',{number:done.filter(Boolean).length})} · ${t('checklistNote')}</p></div><button class="icon-button" data-action="onboarding-dismiss" aria-label="${t('dismiss')}">${icon('close')}</button></div><ol>${['addFiles','review','send'].map((item,i)=>`<li class="${done[i]?'is-done':''}"><span aria-label="${t(done[i]?'completed':'pending')}">${done[i]?icon('check'):i+1}</span>${button(t(item),'onboarding-check-'+i,'ghost',i===2&&!p.reviewed&&!shared?'disabled':'')}</li>`).join('')}</ol></section>`;
  }
  async function action(name){
    switch(name){
      case 'onboarding-help':help();break;
      case 'onboarding-video':video();break;
      case 'onboarding-example':openAppTour();break;
      case 'onboarding-create':remember({learned:true});closeModal();await startProject();break;
      case 'onboarding-dismiss':remember({dismissed:true});render();break;
      case 'onboarding-check-0':upload();break;
      case 'onboarding-check-1':preview();break;
      case 'onboarding-check-2':share();break;
    }
  }
  return {welcome,checklist,created,reviewed,action,helpLabel:()=>t('help')};
}
