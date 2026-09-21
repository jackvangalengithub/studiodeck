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
