let noticeSession=null,noticeSeen=false,notice=null,noticeTimer;
function syncBudgetNotice(session,budget){
 if(session!==noticeSession){clearTimeout(noticeTimer);notice?.remove();notice=null;noticeSeen=false;noticeSession=session;}
 if(!session||!budget){clearTimeout(noticeTimer);notice?.remove();notice=null;return;}
 if(!noticeSeen){
  noticeSeen=true;notice=document.createElement('div');notice.className='budget-interactive-notice';notice.setAttribute('role','status');notice.textContent='This slide is interactive';
  noticeTimer=setTimeout(()=>{notice?.remove();notice=null;},3000);
 }
 // Keep the same notice and deadline if the current slide renders again.
 if(notice)budget.closest('.presentation').append(notice);
}
let observer;
let cancelBudgetJump=()=>{};
export function scrollToBudgetRow(row){
 cancelBudgetJump();
 const line=row.querySelector(':scope > .budget-line');
 const summary=row.closest('.budget-layout')?.previousElementSibling;
 let scroller=row.parentElement;
 while(scroller&&!(scroller.scrollHeight>scroller.clientHeight&&/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)))scroller=scroller.parentElement;
 scroller=scroller||document.scrollingElement;
 const isPage=scroller===document.scrollingElement,viewportTop=isPage?0:scroller.getBoundingClientRect().top+scroller.clientTop;
 const offset=(summary?.classList.contains('budget-sticky-summary')?summary.offsetHeight:0)+16;
 const target=Math.max(0,Math.min(scroller.scrollHeight-scroller.clientHeight,scroller.scrollTop+row.getBoundingClientRect().top-viewportTop-offset));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let frame,timer,previous=scroller.scrollTop,stable=0;
 const start=performance.now();
 cancelBudgetJump=()=>{cancelAnimationFrame(frame);clearTimeout(timer);line?.classList.remove('budget-jump-highlight');};
 (isPage?window:scroller).scrollTo({top:target,behavior:reduced?'instant':'smooth'});
 function settled(now){
  if(!row.isConnected){cancelBudgetJump();return;}
  const current=scroller.scrollTop;
  stable=Math.abs(current-previous)<.5?stable+1:0;previous=current;
  if((stable>=3&&now-start>120)||now-start>2500){
   const top=row.getBoundingClientRect().top,bottom=isPage?innerHeight:scroller.getBoundingClientRect().bottom;
   if(top<viewportTop+offset-2||top>=bottom)return;
   row.focus({preventScroll:true});
   line?.classList.add('budget-jump-highlight');
   timer=setTimeout(()=>line?.classList.remove('budget-jump-highlight'),900);
   return;
  }
  frame=requestAnimationFrame(settled);
 }
 frame=requestAnimationFrame(settled);
}
// The question panel stays below the entire summary, even when its text wraps.
export function syncBudgetLayout(presentationSession=null){
 observer?.disconnect();
 const budget=document.querySelector('.presentation-budget'),summary=budget?.querySelector('.budget-sticky-summary'),area=budget?.closest('.slide-area');
 syncBudgetNotice(presentationSession,budget);
 if(!summary||!area)return;
 const measure=()=>{
  budget.style.setProperty('--budget-summary-height',`${summary.offsetHeight}px`);
  budget.style.setProperty('--budget-chat-height',`${Math.max(120,area.clientHeight-summary.offsetHeight-24)}px`);
 };
 observer=new ResizeObserver(measure);observer.observe(summary);observer.observe(area);const chrome=budget.closest('.presentation')?.querySelector('.presentation-chrome-top');if(chrome)observer.observe(chrome);measure();
}
