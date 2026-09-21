import {setLanguage} from './i18n.js';
import {onboardingText as t} from './onboarding-copy.js';
import {budgetTotal} from './budget.js';

// Every request made by the practice app ends here. There is no server fallback.
export function createAppTourData(language='en') {
  setLanguage(language);
  const theme={style:'Warm minimalism',font:'serif',colors:['#e9e3d7','#bc9f7c','#7d705c','#535e4c','#3b352f']};
  const studio={id:'tour-studio',name:t('sampleName'),role:'admin',language};
  const user={id:'tour-user',name:t('you'),email:'designer@example.test',profile:{name:t('you'),language}};
  const file=(id,name,url,category)=>({id,asset_id:id,name,url,preview_url:url,category,mime:'image/webp',has_preview:true,number:1,size:241800,metadata:{},history:[]});
  const iteration={id:'tour-iteration',project_id:'tour-project',number:1,title:t('concept'),status:'draft',locked:0,theme:JSON.stringify(theme)};
  const data={project:{id:'tour-project',name:t('sampleName'),location:'',description:t('conceptSub'),theme,language},iteration,iterations:[iteration],can_edit:true,
    files:[file('tour-photo','Living room.webp','assets/interior.webp','renders'),file('tour-mood','Moodboard.webp','assets/moodboard.webp','moodboard')],
    slides:[{id:'tour-photo-slide',source_version_id:'tour-photo',type:'photo',title:t('concept'),situation:'concept',metadata:{}},{id:'tour-mood-slide',source_version_id:'tour-mood',type:'moodboard',title:t('shape'),situation:'reference',metadata:{}}],
    slide_content:[{slide_id:'intro',title:t('concept'),description:t('conceptSub')}],slide_layout:[],slide_sections:[],slide_groups:null,
    budget:[{id:'tour-base',label:t('base'),amount_cents:2450000,kind:'estimate',parent_id:null,included:0},{id:'tour-option',label:language==='nl'?'Leeshoek':'Reading nook',amount_cents:180000,kind:'estimate',is_optional:1,selected:false,parent_id:null,included:0}],
    comments:[],events:[],jobs:[],shares:[],changes:[],contacts:[],clients:[],members:[],profile:user.profile,capabilities:{demo:true,ai:false,mail:false},total_cents:2450000};
  const stats={saves:0,choices:0,comments:0};
  const copy=()=>structuredClone({...data,total_cents:budgetTotal(data.budget)});
  async function request(action,body={}) {
    if(body instanceof FormData)body=Object.fromEntries(body);
    if(action==='session')return {user,studio,studios:[studio],csrf:'tour',studio_theme:{palette:'warmgray'},capabilities:data.capabilities};
    if(action==='projects')return {projects:[{...data.project,iteration,file_count:2,members:[]}],studio_empty:false};
    if(action==='project'||action==='deck')return copy();
    if(action==='save_slide'){
      const title=String(body.title||'').trim();if(!title)throw Error(t('slideTitle'));
      const slide=data.slide_content.find(s=>s.slide_id===body.slide_id);if(!slide)throw Error(t('tourRecover'));
      if(slide.title!==title)stats.saves++;
      slide.title=title;slide.description=String(body.description||'');
      return {id:body.slide_id};
    }
    if(action==='budget_choice'){
      const row=data.budget.find(b=>b.id===body.id);if(!row)throw Error(t('tourRecover'));
      if('selected' in body&&row.selected!==!!body.selected){row.selected=!!body.selected;stats.choices++;}
      return {budget:structuredClone(data.budget),total_cents:budgetTotal(data.budget)};
    }
    if(action==='comment'){
      const text=String(body.body||'').trim();if(!text)throw Error(t('commentLabel'));
      const comment={id:'tour-comment-'+(++stats.comments),iteration_id:iteration.id,slide:body.slide||'general',body:text,author:user.name,profile:user.profile,created_at:new Date().toISOString(),answered:false,parent_id:null,comment_order:stats.comments};
      data.comments.push(comment);return {ok:true,id:comment.id};
    }
    if(['view_event','read_comments'].includes(action))return {ok:true};
    if(action==='studio_starting_pack')return {items:[]};
    if(action==='drive_status')return {configured:false,connected:false};
    throw Error(t('tourSample'));
  }
  return {request,stats};
}

export function appTourGuide({state,stats,esc,prepare}) {
  let step=0,baseline={},target=null,coach=null,spot=null,scheduled=false,active=false,missing=false;
  const steps=[
    {key:'tourSlides',target:'.tabs [data-action="tab"][data-tab="slides"]',done:()=>state.tab==='slides'},
    {key:'tourEdit',target:'[data-action="edit-slide"][data-id="intro"]',done:()=>!!document.querySelector('[data-form="slide-editor"]')},
    {key:'tourSave',target:'.modal:has([data-form="slide-editor"])',done:()=>stats.saves>baseline.saves&&!document.querySelector('[data-form="slide-editor"]')},
    {key:'tourPreview',target:'.project-head [data-action="preview"]',done:()=>state.present},
    {key:'tourBudget',target:'[data-action="jump-section"][data-section="budget"]',done:()=>!!document.querySelector('[data-budget-option="tour-option"]')},
    {key:'tourOption',target:'[data-budget-row="tour-option"]',done:()=>stats.choices>baseline.choices&&!document.querySelector('[data-budget-option="tour-option"]')?.disabled},
    {key:'tourFeedback',target:'[data-action="feedback"]',done:()=>!!document.querySelector('[data-form="feedback"]')},
    {key:'tourComment',target:'.modal:has([data-form="feedback"])',done:()=>stats.comments>baseline.comments&&!!document.querySelector('.comment-thread')},
  ];
  const post=type=>{if(window.parent!==window)window.parent.postMessage({type},location.origin);else location.assign('/');};
  function visibleControls(root){return [...root.querySelectorAll('button:not(:disabled),input:not([type=hidden]):not(:disabled),textarea,select,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));}
  function focusTarget(){const focus=target?.matches('button,input')?target:target?.querySelector('input[name=title],textarea[name=body]')||visibleControls(target||coach)[0];focus?.focus({preventScroll:true});}
  function show(){
    baseline={...stats};missing=false;
    coach.dataset.step=String(step);
    coach.innerHTML=`<div class="app-tour-copy" aria-live="polite"><small>${step<steps.length?t('tourStep',{number:step+1,total:steps.length}):t('appTour')}</small><h2 id="app-tour-title">${t(step<steps.length?steps[step].key:'tourDone')}</h2><p id="app-tour-instruction">${t(step<steps.length?steps[step].key+'Text':'tourDoneText')}</p><p data-tour-missing hidden>${t('tourMissing')}</p></div><div class="app-tour-controls">${step?`<button type="button" class="button ghost small" data-guide="back">${t('tourBack')}</button>`:''}${step<steps.length?`<button type="button" class="button small" data-guide="skip">${t('tourSkip')}</button><button type="button" class="button small" data-guide="recover" hidden>${t('tourRecover')}</button>`:`<button type="button" class="button primary" data-guide="create">${t('create')}</button>`}<button type="button" class="button ghost small" data-guide="exit">${t('tourExit')}</button></div>`;
    coach.querySelectorAll('[data-guide]').forEach(el=>el.addEventListener('click',()=>{
      const action=el.dataset.guide;
      if(action==='exit'||action==='create'){post('studiodeck-tour-'+action);return;}
      if(action==='back')step=Math.max(0,step-1);else if(action==='skip')step=Math.min(steps.length,step+1);
      prepare(step);show();
    }));
    document.documentElement.style.setProperty('--tour-dock-size',coach.offsetHeight+'px');
    target?.removeAttribute('aria-describedby');
    target=document.querySelector(step<steps.length?steps[step].target:'.comment-thread');
    if(target){target.setAttribute('aria-describedby','app-tour-instruction');target.scrollIntoView({block:'center',inline:'center',behavior:'instant'});}
    requestAnimationFrame(()=>{place();focusTarget();});
  }
  function place(){
    if(!active)return;
    const next=document.querySelector(step<steps.length?steps[step].target:'.comment-thread');
    if(target!==next){target?.removeAttribute('aria-describedby');target=next;target?.setAttribute('aria-describedby','app-tour-instruction');}
    missing=!target||!target.getClientRects().length;
    coach.querySelector('[data-tour-missing]').hidden=!missing||step===steps.length;
    const recover=coach.querySelector('[data-guide=recover]');if(recover)recover.hidden=!missing;
    spot.hidden=missing;
    if(missing)return;
    const r=target.getBoundingClientRect(),bottom=Math.min(r.bottom,coach.getBoundingClientRect().top-7),top=Math.max(5,r.top),left=Math.max(5,r.left),right=Math.min(innerWidth-5,r.right);
    spot.style.cssText=`left:${left-4}px;top:${top-4}px;width:${Math.max(0,right-left)+8}px;height:${Math.max(0,bottom-top)+8}px`;
  }
  function sync(){
    if(!active||scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;if(document.body.classList.contains('slide-in-motion')){sync();return;}if(step<steps.length&&steps[step].done()){step++;show();}else place();});
  }
  function allowed(node){return coach.contains(node)||target?.contains(node)||node===target;}
  function start(){
    active=true;document.body.classList.add('app-tour-running');
    spot=document.createElement('div');spot.className='app-tour-spot';spot.setAttribute('aria-hidden','true');
    coach=document.createElement('section');coach.className='app-tour-coach';coach.setAttribute('role','region');coach.setAttribute('aria-labelledby','app-tour-title');
    document.body.append(spot,coach);show();
    const observer=new MutationObserver(sync);for(const id of ['app','overlay'])observer.observe(document.getElementById(id),{childList:true,subtree:true,attributes:true,characterData:true});
    new ResizeObserver(()=>{document.documentElement.style.setProperty('--tour-dock-size',coach.offsetHeight+'px');place();}).observe(coach);
    addEventListener('resize',place);document.addEventListener('scroll',place,true);
    for(const name of ['click','pointerdown'])document.addEventListener(name,event=>{if(!allowed(event.target)){event.preventDefault();event.stopImmediatePropagation();}},true);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();post('studiodeck-tour-exit');return;}
      if(event.key==='Tab'){
        const list=[...(target?.matches('button,input')?[target]:target?visibleControls(target):[]),...visibleControls(coach)];
        const i=list.indexOf(document.activeElement),next=(i+(event.shiftKey?-1:1)+list.length)%list.length;
        event.preventDefault();event.stopImmediatePropagation();list[next]?.focus();return;
      }
      if(!allowed(event.target)){event.preventDefault();event.stopImmediatePropagation();}
    },true);
  }
  return {start};
}
