import {tr} from './i18n.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function presentationModeSwitch(mode){
 return `<div class="presentation-mode-switch" role="group" aria-label="${tr('presentation_view')}">${['slides','scroll'].map(view=>`<button type="button" data-action="presentation-mode" data-mode="${view}" aria-pressed="${mode===view}">${tr('presentation_view_'+view)}</button>`).join('')}</div>`;
}

// Content and actions retain the original slide IDs in both presentation modes.
export function scrollPresentation({slides,groups,project,iteration,branding,preview,actions,navigation='',content,footer}){
 const chapters=Object.entries(groups).filter(([id])=>slides.some(slide=>slide.section===id));
 return `<div class="presentation presentation-scroll" data-scroll-iteration="${esc(iteration)}">
  <header class="scroll-header">${preview}<div class="scroll-header-top"><div class="scroll-brand">${branding}</div><span class="scroll-project-name">${esc(project)}</span>${presentationModeSwitch('scroll')}<div class="scroll-header-actions">${actions}</div></div>
   <nav class="scroll-chapters section-index" aria-label="${tr('presentation_sections')}">${navigation}</nav>
   <div class="scroll-progress" aria-hidden="true"><span></span></div>
  </header>
  <main id="main" class="scroll-story" tabindex="-1"><h1 class="sr-only">${esc(project)}</h1>${slides.map((slide,n)=>{
   const chapterStart=n===0||slides[n-1].section!==slide.section,chapter=chapters.findIndex(([id])=>id===slide.section);
   return `<article class="scroll-section scroll-type-${esc(slide.type)}" id="scroll-slide-${esc(slide.id)}" data-scroll-slide="${esc(slide.id)}" data-scroll-group="${esc(slide.section)}" tabindex="-1" aria-label="${esc(slide.title)}">
    ${chapterStart?`<div class="scroll-chapter-heading"><span>${String(chapter+1).padStart(2,'0')}</span><h2>${esc(groups[slide.section]||slide.section)}</h2><span class="scroll-chapter-line"></span></div>`:''}
    <div class="scroll-content">${content(slide.id)}</div><footer class="scroll-section-footer"><span class="scroll-item-number">${String(n+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}</span>${footer(slide)}</footer>
   </article>`;
  }).join('')}</main><footer class="scroll-end"><span>${esc(project)}</span><button type="button" data-action="scroll-top">${tr('back_to_top')} ↑</button><small>${tr('presented_by_studiodeck')}</small></footer>
 </div>`;
}

let events,resize,frame=0;
export function stopScrollPresentation(){events?.abort();resize?.disconnect();cancelAnimationFrame(frame);}
export function scrollPosition(){
 const page=document.querySelector('.presentation-scroll');if(!page)return null;
 const line=(page.querySelector('.scroll-header')?.offsetHeight||0)+12;
 const sections=[...page.querySelectorAll('[data-scroll-slide]')];
 const section=sections.find(el=>el.getBoundingClientRect().bottom>line);
 return section?{iteration:page.dataset.scrollIteration,id:section.dataset.scrollSlide,offset:section.getBoundingClientRect().top}:null;
}
export function scrollToSlide(id,{smooth=true,focus=false}={}){
 const section=document.getElementById('scroll-slide-'+id);if(!section)return;
 section.scrollIntoView({block:'start',behavior:smooth&&!matchMedia('(prefers-reduced-motion: reduce)').matches?'smooth':'instant'});
 if(focus)section.focus({preventScroll:true});
}
export function mountScrollPresentation({selected,position,onActive,canTrack}){
 stopScrollPresentation();const page=document.querySelector('.presentation-scroll');if(!page)return;
 events=new AbortController();const {signal}=events;
 const header=page.querySelector('.scroll-header'),sections=[...page.querySelectorAll('[data-scroll-slide]')];
 // Shared slide components use h1 in the deck. On this page they are section headings.
 page.querySelectorAll('.scroll-content').forEach((content,n)=>{
  content.querySelectorAll('h1').forEach(old=>{const heading=document.createElement('h2');for(const attr of old.attributes)heading.setAttribute(attr.name,attr.value);heading.innerHTML=old.innerHTML;old.replaceWith(heading);});
  // Repeated system slides must not introduce duplicate DOM IDs or label targets.
  const ids=new Map();content.querySelectorAll('[id]').forEach(el=>{const id=el.id;el.id=`scroll-${n}-${id}`;ids.set(id,el.id);});
  content.querySelectorAll('[for],[aria-controls],[aria-describedby],[aria-labelledby]').forEach(el=>{
   for(const attr of ['for','aria-controls','aria-describedby','aria-labelledby'])if(el.hasAttribute(attr))el.setAttribute(attr,el.getAttribute(attr).split(' ').map(id=>ids.get(id)||id).join(' '));
  });
 });
 const measure=()=>page.style.setProperty('--scroll-header-height',`${header.offsetHeight}px`);
 resize=new ResizeObserver(measure);resize.observe(header);measure();
 let activeGroup;
 const update=()=>{
  frame=0;if(!page.isConnected)return;
  const line=header.offsetHeight+Math.min(180,innerHeight*.2);
  let active=sections[0];for(const section of sections){if(section.getBoundingClientRect().top<=line)active=section;else break;}
  const group=active?.dataset.scrollGroup;
  page.querySelectorAll('.scroll-chapters [data-section]').forEach(button=>{const current=button.dataset.section===group;button.classList.toggle('active',current);button.closest('.section-split')?.classList.toggle('active',current);if(current)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
  if(group!==activeGroup){
   const nav=page.querySelector('.scroll-chapters'),button=nav.querySelector('[aria-current]');
   if(button){const outer=nav.getBoundingClientRect(),inner=button.getBoundingClientRect();if(inner.left<outer.left+20)nav.scrollLeft+=inner.left-outer.left-20;else if(inner.right>outer.right-20)nav.scrollLeft+=inner.right-outer.right+20;}
   activeGroup=group;
  }
  const distance=document.documentElement.scrollHeight-innerHeight;
  page.querySelector('.scroll-progress span').style.transform=`scaleX(${distance>0?Math.min(1,Math.max(0,scrollY/distance)):1})`;
  if(active&&canTrack())onActive(active.dataset.scrollSlide);
 };
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 window.addEventListener('scroll',schedule,{passive:true,signal});window.addEventListener('resize',schedule,{passive:true,signal});
 const previous=position?.iteration===page.dataset.scrollIteration&&sections.find(el=>el.dataset.scrollSlide===position.id);
 if(previous)window.scrollBy({top:previous.getBoundingClientRect().top-position.offset,behavior:'instant'});
 else if(selected&&selected!==sections[0]?.dataset.scrollSlide)scrollToSlide(selected,{smooth:false});
 else window.scrollTo({top:0,behavior:'instant'});
 schedule();
}
