import {feedbackText as t,feedbackCategories,feedbackAreas,feedbackStatuses,feedbackPrompts} from './product-feedback-copy.js';

export function productFeedbackUi({state,api,esc,icon,openModal,closeModal,resourceHeaders,demo=false}){
 let draft=null,identity='',sending=false,reviewBusy=false,preview='',inboxData=null,inboxRequest=0;
 let filters={search:'',category:'',area:'',status:'',impact:'',theme:'',offset:0};
 const currentIdentity=()=>`${state.user?.id}:${state.studio?.id}`;
 const button=(label,action,primary=false)=>`<button type="button" class="button ${primary?'primary':'ghost'}" data-pf="${action}">${esc(t(label))}</button>`;
 const text=(key)=>esc(t(key));
 const select=(name,values,value,all=false)=>`<select name="${name}">${all?`<option value="">${text('all')}</option>`:''}${values.map(v=>`<option value="${esc(v)}" ${value===v?'selected':''}>${text(v)}</option>`).join('')}</select>`;
 const field=(name,label,value,max)=>`<label>${text(label)}<textarea name="${name}" rows="${name==='goal'?2:3}" maxlength="${max}" required>${esc(value)}</textarea></label>`;
 function screen(){
  if(state.settingsOpen)return 'settings';if(state.present)return 'presentation';
  return ({overview:'projects',projects:'projects',files:'files',budget:'budget',slides:'presentation',presentation:'presentation',comments:'communication','all-comments':'communication',checks:'communication',website:'website',profile:'settings','studio-users':'settings',billing:'billing'})[state.tab]||'other';
 }
 function reset(){if(preview)URL.revokeObjectURL(preview);preview='';draft=null;}
 function open(){
  if(demo){openModal(text('title'),`<p>${text('demo')}</p>`);return;}
  if(identity!==currentIdentity()){reset();identity=currentIdentity();}
  if(!draft)draft={step:1,category:'',area:screen(),screen:screen(),goal:'',detail:'',impact:'',frequency:'',contact_allowed:false,screenshot:null,request_key:crypto.randomUUID()};
  show();
 }
 function mount(title,content,wide=false){
  openModal(esc(title),content,wide);
  const modal=document.querySelector('.modal');modal.classList.add(wide?'pf-inbox-dialog':'pf-dialog');
  return modal;
 }
 function progress(){return `<div class="pf-progress" aria-label="${esc(t('step',{step:draft.step}))}"><span aria-hidden="true">${[1,2,3].map(n=>`<i class="${n<=draft.step?'filled':''}"></i>`).join('')}</span><small>${esc(t('step',{step:draft.step}))}</small></div>`;}
 function heading(title,intro=''){return `<h3 class="pf-heading" tabindex="-1">${text(title)}</h3>${intro?`<p class="pf-intro">${text(intro)}</p>`:''}`;}
 function radio(name,value,label,hint=''){
  return `<label class="pf-choice ${name==='category'?'pf-category':''}"><input type="radio" name="${name}" value="${value}" ${draft[name]===value?'checked':''} required><span><strong>${text(label)}</strong>${hint?`<small>${text(hint)}</small>`:''}</span></label>`;
 }
 function show(){
  let body='';
  if(draft.step===1)body=`${heading('introTitle','intro')}<fieldset class="pf-choices"><legend>${text('choose')}</legend>${feedbackCategories.map(c=>radio('category',c,c,c==='other'?'':c+'Hint')).join('')}</fieldset>`;
  if(draft.step===2){
   const [goal,detail]=feedbackPrompts(draft.category);
   body=`${heading(draft.category+'Title',draft.category+'Intro')}<label class="pf-area">${text('about')}${select('area',feedbackAreas,draft.area)}</label>${field('goal',goal,draft.goal,500)}${field('detail',detail,draft.detail,1500)}<p class="pf-hint">${text('example')}</p><label class="pf-upload">${text('screenshot')}<input type="file" accept="image/png,image/jpeg,image/webp" data-pf-file aria-describedby="pf-screenshot-hint"></label><p class="pf-hint" id="pf-screenshot-hint">${text('screenshotHint')}</p><div data-pf-preview>${previewMarkup()}</div>`;
  }
  if(draft.step===3)body=`${heading(draft.category==='positive'?'positiveFrequency':'impactTitle',draft.category==='positive'?'positiveIntro':'impactIntro')}${draft.category!=='positive'?`<fieldset class="pf-choices"><legend class="sr-only">${text('impactTitle')}</legend>${['minor','slows','blocked'].map(v=>radio('impact',v,v)).join('')}</fieldset>`:''}<fieldset class="pf-choices pf-frequency"><legend ${draft.category==='positive'?'class="sr-only"':''}>${text(draft.category==='positive'?'positiveFrequency':'frequency')}</legend><div>${['first','sometimes','often'].map(v=>radio('frequency',v,v)).join('')}</div></fieldset><div class="pf-contact"><label class="check-label"><input type="checkbox" name="contact_allowed" ${draft.contact_allowed?'checked':''}>${text('contact')}</label><p class="pf-hint">${text('contactHint')}</p></div><p class="pf-hint">${text('separate')}</p><p class="pf-hint">${text('context')}</p><details class="pf-context"><summary>${text('contextDetails')}</summary><dl><dt>${text('account')}</dt><dd>${esc(state.user?.name)} (${esc(state.user?.email)})</dd><dt>${text('studio')}</dt><dd>${esc(state.studio?.name)}</dd><dt>${text('screen')}</dt><dd>${text(draft.screen)}</dd><dt>${text('version')}</dt><dd>${esc(state.capabilities?.app_version==='unversioned'?t('unversioned'):state.capabilities?.app_version||t('unversioned'))}</dd></dl><p>${text('privacy')}</p></details>`;
  const modal=mount(t('title'),`<div class="pf">${progress()}<form data-pf-form>${body}<p class="pf-error" role="alert" hidden></p><div class="pf-footer">${draft.step>1?button('back','back'):`<small>${text('minute')}</small>`}<button type="submit" class="button primary">${text(draft.step===3?'send':'next')}</button></div></form></div>`);
  const form=modal.querySelector('form');
  if(draft.step===2&&draft.screenshot){const files=new DataTransfer();files.items.add(draft.screenshot);form.querySelector('[data-pf-file]').files=files.files;}
  form.addEventListener('input',remember);form.addEventListener('change',remember);
  form.addEventListener('submit',async event=>{
   event.preventDefault();event.stopPropagation();if(sending)return;remember();
   if(draft.step===2&&(!draft.goal.trim()||!draft.detail.trim())){error(t('required'));return;}
   if(draft.step<3){draft.step++;show();return;}
   await send(form);
  });
  modal.querySelector('[data-pf="back"]')?.addEventListener('click',()=>{remember();draft.step--;show();});
  modal.querySelector('[data-pf-file]')?.addEventListener('change',event=>{
   const file=event.target.files[0];if(!file)return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){event.target.value='';error(t('screenshotError'));return;}
   if(preview)URL.revokeObjectURL(preview);draft.screenshot=file;preview=URL.createObjectURL(file);
   modal.querySelector('[data-pf-preview]').innerHTML=previewMarkup();bindRemove(modal);error('');
  });
  bindRemove(modal);
  // Announce the new step; the shared modal still owns focus trapping and restoration.
  setTimeout(()=>{if(modal.isConnected)modal.querySelector('.pf-heading')?.focus();},30);
 }
 function remember(){
  const form=document.querySelector('[data-pf-form]');if(!form||!draft)return;
  const values=new FormData(form);
  for(const name of ['category','area','goal','detail','impact','frequency'])if(values.has(name))draft[name]=values.get(name);
  if(form.elements.contact_allowed)draft.contact_allowed=form.elements.contact_allowed.checked;
  if(draft.category==='positive')draft.impact='';
 }
 function previewMarkup(){return preview?`<div class="pf-attachment"><img src="${esc(preview)}" alt="${text('screenshotAlt')}"><span>${esc(draft.screenshot.name)}</span>${button('remove','remove')}</div>`:'';}
 function bindRemove(modal){modal.querySelector('[data-pf="remove"]')?.addEventListener('click',()=>{URL.revokeObjectURL(preview);preview='';draft.screenshot=null;modal.querySelector('[data-pf-file]').value='';modal.querySelector('[data-pf-preview]').innerHTML='';});}
 function error(message){const el=document.querySelector('.pf-error');if(el){el.textContent=message;el.hidden=!message;}}
 async function send(form){
  sending=true;error('');form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
  const submit=form.querySelector('[type="submit"]');submit.textContent=t('sending');
  try{
   const {step,screenshot,...payload}=draft,body=new FormData();body.set('feedback',JSON.stringify(payload));if(screenshot)body.set('screenshot',screenshot);
   await api('product_feedback_submit',body);reset();
   const modal=mount(t('title'),`<div class="pf pf-thanks"><span class="pf-thanks-mark" aria-hidden="true">${icon('check')}</span>${heading('thanksTitle','thanks')}<p class="pf-hint">${text('promise')}</p><div class="pf-footer">${button('done','done',true)}</div></div>`);
   modal.querySelector('[data-pf="done"]').addEventListener('click',()=>closeModal());
  }catch(e){error(t('failed')+(e.status&&e.status<500?' '+e.message:''));}
  finally{sending=false;form.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=false);submit.textContent=t('send');}
 }
 function navigation(){
  if(demo)return '';
  return `<button class="side-link pf-nav" data-action="product-feedback" title="${text('title')}" aria-label="${text('title')}">${icon('heart')}<span class="side-link-label">${text('title')}</span></button>${state.user?.feedback_reviewer?`<button class="side-link pf-nav" data-action="product-feedback-inbox" title="${text('inbox')}" aria-label="${text('inbox')}">${icon('mail')}<span class="side-link-label">${text('inbox')}</span></button>`:''}`;
 }
 async function inbox(){
  const request=++inboxRequest;
  const modal=mount(t('inbox'),`<div class="pf" data-pf-inbox><p role="status">${text('loading')}</p></div>`,true);
  try{const result=await api('product_feedback_inbox',filters);if(request!==inboxRequest||!modal.isConnected)return;inboxData=result;renderInbox();}
  catch(e){if(request!==inboxRequest||!modal.isConnected)return;modal.querySelector('[data-pf-inbox]').innerHTML=`<p role="alert">${text('loadFailed')}</p>${button('retry','retry')}`;modal.querySelector('[data-pf="retry"]').onclick=inbox;}
 }
 function renderInbox(){
  const d=inboxData;
  const modal=mount(t('inbox'),`<div class="pf" data-pf-inbox><p class="pf-intro">${text('inboxIntro')}</p><form class="pf-filters"><label class="pf-search">${text('search')}<input type="search" name="search" value="${esc(filters.search)}" maxlength="200"></label>${['category','area','status','impact'].map((name,n)=>`<label>${text(name)}${select(name,[feedbackCategories,feedbackAreas,feedbackStatuses,['minor','slows','blocked']][n],filters[name],true)}</label>`).join('')}<label>${text('theme')}<select name="theme"><option value="">${text('all')}</option>${d.themes.map(theme=>`<option ${filters.theme===theme.theme?'selected':''} value="${esc(theme.theme)}">${esc(theme.theme)}</option>`).join('')}</select></label><button class="button" type="submit">${text('filter')}</button></form><p class="pf-counts">${esc(t('counts',d.counts))}</p>${d.themes.length?`<details class="pf-themes"><summary>${text('themes')}</summary>${d.themes.map(theme=>`<button type="button" data-pf-theme="${esc(theme.theme)}"><strong>${esc(theme.theme)}</strong><small>${esc(t('counts',theme))}</small></button>`).join('')}</details>`:''}<div class="pf-reports">${d.items.map(item=>`<button type="button" class="pf-report" data-pf-report="${esc(item.id)}"><span class="row wrap"><span class="tag">${text(item.category)}</span><span class="tag outline">${text(item.area)}</span><span class="tag outline">${text(item.status)}</span>${item.impact==='blocked'?`<span class="tag pf-blocked">${text('blocked')}</span>`:''}</span><strong>${esc(item.goal)}</strong><span class="pf-report-detail">${esc(item.detail)}</span><small>${esc(item.studio_name||'—')} · ${esc(item.created_at.slice(0,10))} · ${esc(item.theme||t('unthemed'))}</small></button>`).join('')||`<p>${text('empty')}</p>`}</div><div class="pf-footer">${filters.offset?button('previous','previous'): '<span></span>'}${d.has_more?button('nextPage','nextPage'):''}</div></div>`,true);
  modal.querySelector('form').onsubmit=event=>{event.preventDefault();event.stopPropagation();filters={...filters,...Object.fromEntries(new FormData(event.target)),offset:0};inbox();};
  modal.querySelectorAll('[data-pf-report]').forEach(el=>el.onclick=()=>review(d.items.find(item=>item.id===el.dataset.pfReport)));
  modal.querySelectorAll('[data-pf-theme]').forEach(el=>el.onclick=()=>{filters.theme=el.dataset.pfTheme;filters.offset=0;inbox();});
  modal.querySelector('[data-pf="previous"]')?.addEventListener('click',()=>{filters.offset=Math.max(0,filters.offset-50);inbox();});
  modal.querySelector('[data-pf="nextPage"]')?.addEventListener('click',()=>{filters.offset+=50;inbox();});
 }
 function review(item){
  const [goal,detail]=feedbackPrompts(item.category);
  const modal=mount(t('inbox'),`<div class="pf">${button('backInbox','backInbox')}<div class="row wrap pf-review-tags"><span class="tag">${text(item.category)}</span><span class="tag">${text(item.area)}</span><span class="tag">${text(item.frequency)}</span>${item.impact?`<span class="tag">${text(item.impact)}</span>`:''}</div><dl class="pf-report-body"><dt>${text(goal)}</dt><dd>${esc(item.goal)}</dd><dt>${text(detail)}</dt><dd>${esc(item.detail)}</dd><dt>${text('account')}</dt><dd>${esc(item.user_name||'—')} · ${esc(item.studio_name||'—')}</dd><dt>${text('screen')}</dt><dd>${text(item.screen)} · ${esc(item.app_version)}</dd></dl><p class="pf-hint">${text(item.contact_allowed?'followup':'noFollowup')}${item.contact_email?` · <a href="mailto:${esc(item.contact_email)}">${esc(item.contact_email)}</a>`:''}</p>${item.has_screenshot?`<div data-pf-image>${button('viewScreenshot','image')}</div>`:''}<form data-pf-review><label>${text('status')}${select('status',feedbackStatuses,item.status)}</label><label>${text('theme')}<input name="theme" value="${esc(item.theme)}" maxlength="120" list="pf-theme-list"><datalist id="pf-theme-list">${inboxData.themes.map(theme=>`<option value="${esc(theme.theme)}"></option>`).join('')}</datalist></label><p class="pf-hint">${text('themeHint')}</p><label>${text('notes')}<textarea name="notes" rows="3" maxlength="1500">${esc(item.notes)}</textarea></label><p class="pf-hint">${text('reviewHint')}</p><p class="pf-error" role="alert" hidden></p><p data-pf-saved role="status"></p><div class="pf-footer"><button class="button primary" type="submit">${text('save')}</button></div></form></div>`,true);
  modal.querySelector('[data-pf="backInbox"]').onclick=inbox;
  modal.querySelector('[data-pf="image"]')?.addEventListener('click',async event=>{
   const button=event.currentTarget;button.disabled=true;
   try{
    const response=await fetch('api.php?'+new URLSearchParams({action:'product_feedback_image',id:item.id}),{credentials:'same-origin',headers:resourceHeaders()});if(!response.ok)throw Error();
    const blob=await response.blob();if(!modal.isConnected)return;
    const url=URL.createObjectURL(blob),image=new Image();image.alt=t('screenshotAlt');image.className='pf-full-screenshot';image.onload=image.onerror=()=>URL.revokeObjectURL(url);image.src=url;
    modal.querySelector('[data-pf-image]').replaceChildren(image);
   }catch{if(modal.isConnected){error(t('screenshotUnavailable'));button.disabled=false;}}
  });
  const form=modal.querySelector('form');
  form.onsubmit=async event=>{
   event.preventDefault();event.stopPropagation();if(reviewBusy)return;
   const payload={...Object.fromEntries(new FormData(form)),id:item.id,updated_at:item.updated_at};reviewBusy=true;error('');modal.querySelector('[data-pf-saved]').textContent='';
   modal.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);const submit=form.querySelector('[type="submit"]');submit.textContent=t('saving');
   try{const result=await api('product_feedback_review',payload);Object.assign(item,payload,{updated_at:result.updated_at});modal.querySelector('[data-pf-saved]').textContent=t('saved');}
   catch(e){error(e.message);}
   finally{reviewBusy=false;modal.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=false);submit.textContent=t('save');}
  };
 }
 return {open,inbox,navigation,busy:()=>sending||reviewBusy};
}
