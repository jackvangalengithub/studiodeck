let observer;
// The question panel stays below the entire summary, even when its text wraps.
export function syncBudgetLayout(){
 observer?.disconnect();
 const budget=document.querySelector('.presentation-budget'),summary=budget?.querySelector('.budget-sticky-summary'),area=budget?.closest('.slide-area');
 if(!summary||!area)return;
 const measure=()=>{
  budget.style.setProperty('--budget-summary-height',`${summary.offsetHeight}px`);
  budget.style.setProperty('--budget-chat-height',`${Math.max(120,area.clientHeight-summary.offsetHeight-24)}px`);
 };
 observer=new ResizeObserver(measure);observer.observe(summary);observer.observe(area);const chrome=budget.closest('.presentation')?.querySelector('.presentation-chrome-top');if(chrome)observer.observe(chrome);measure();
}
