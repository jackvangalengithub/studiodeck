import {getLanguage} from './i18n.js';

const t=(en,nl)=>getLanguage()==='nl'?nl:en;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let active=null,sequence=0;

// Keep the native select as the form value and validation source. The visible
// control uses the same name/email search and result styling as @mentions.
export function syncPersonPickers(container){
 container.querySelectorAll('[data-person-picker]').forEach(wrap=>{
  const select=wrap.querySelector('select'),label=wrap.querySelector('[data-person-label]').textContent;
  let chip=wrap.querySelector('[data-person-chip]');
  if(!chip){
   chip=document.createElement('button');chip.type='button';chip.className='comm-person-chip';chip.dataset.personChip='';chip.setAttribute('aria-haspopup','dialog');chip.setAttribute('aria-expanded','false');
   const clear=document.createElement('button');clear.type='button';clear.className='comm-person-clear';clear.dataset.personClear='';clear.textContent='×';
   wrap.append(chip,clear);select.hidden=true;
  }
  const option=select.selectedOptions[0],name=option?.dataset.name||option?.textContent;
  chip.textContent=select.value?name:t('Choose a person','Kies een persoon');
  chip.title=select.value;chip.disabled=select.disabled;chip.setAttribute('aria-label',label+': '+chip.textContent);
  const clear=wrap.querySelector('[data-person-clear]');clear.hidden=!select.value||select.disabled;clear.setAttribute('aria-label',t('Remove','Verwijder')+' '+name);
  if(select.value||!select.required)chip.removeAttribute('aria-invalid');
 });
 if(active&&(active.select.disabled||active.wrap.closest('[hidden]')||!active.wrap.isConnected))close();
}

function close(restore=false){
 if(!active)return;const {panel,chip,select,wrap}=active;active=null;panel.remove();chip.setAttribute('aria-expanded','false');chip.removeAttribute('aria-controls');
 const box=wrap.closest('.comm-typed-composer');
 if(select.name==='assignee'&&!select.value&&box?.dataset.threadType==='conversation')select.dispatchEvent(new Event('change',{bubbles:true}));
 if(restore)(wrap.closest('[hidden]')?box.querySelector('[data-compose-waiting]'):chip).focus();
}
function position(){
 if(!active)return;const {wrap,chip,panel}=active;if(!wrap.isConnected){close();return;}
 const r=chip.getBoundingClientRect(),viewportWidth=document.documentElement.clientWidth||innerWidth,width=Math.min(360,viewportWidth-24);panel.style.width=width+'px';panel.style.left=Math.max(12,Math.min(r.left,viewportWidth-width-12))+'px';
 const h=panel.offsetHeight;panel.style.top=Math.max(8,r.bottom+h+8>innerHeight&&r.top>h+8?r.top-h-4:Math.min(r.bottom+4,innerHeight-h-8))+'px';
}
function draw(){
 const a=active,query=a.search.value.trim().replace(/^@/,'').toLocaleLowerCase();
 a.options=[...a.select.options].filter(o=>o.value&&!o.disabled&&(o.textContent+' '+o.value).toLocaleLowerCase().includes(query));
 a.index=a.options.findIndex(o=>o.selected);if(a.index<0&&a.options.length)a.index=0;
 a.list.innerHTML=a.options.length?a.options.map((o,n)=>`<div role="option" id="${a.list.id}-${n}" data-person-option="${n}" aria-selected="${n===a.index}"><strong>${esc(o.dataset.name||o.textContent)}</strong><small>${esc(o.value)}</small>${o.dataset.invite==='true'?`<small>${t('Invite to this conversation','Uitnodigen voor dit gesprek')}</small>`:''}</div>`).join(''):`<div class="mention-empty" role="status">${t('No project participants match.','Geen betrokken personen gevonden.')}</div>`;
 highlight();position();
}
function highlight(){
 const a=active;a.list.querySelectorAll('[role=option]').forEach((el,n)=>el.setAttribute('aria-selected',String(n===a.index)));
 if(a.index>=0){a.search.setAttribute('aria-activedescendant',a.list.id+'-'+a.index);a.list.children[a.index].scrollIntoView({block:'nearest'});}else a.search.removeAttribute('aria-activedescendant');
}
function choose(index){
 const a=active,option=a?.options[index];if(!option||option.disabled||a.select.disabled)return;
 a.select.value=option.value;close(true);a.select.dispatchEvent(new Event('change',{bubbles:true}));
}
function open(wrap){
 close();const select=wrap.querySelector('select');if(select.disabled)return;
 const chip=wrap.querySelector('[data-person-chip]'),panel=document.createElement('div'),id='person-picker-'+(++sequence);
 panel.className='comm-person-popover';panel.id=id;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',wrap.querySelector('[data-person-label]').textContent);
 panel.innerHTML=`<input type="search" role="combobox" aria-label="${t('Search people by name or email','Zoek personen op naam of e-mail')}" placeholder="${t('Search name or email…','Zoek naam of e-mail…')}" aria-autocomplete="list" aria-expanded="true" aria-controls="${id}-list" autocomplete="off"><div class="mention-picker comm-person-results" role="listbox" id="${id}-list" aria-label="${t('People','Personen')}"></div>`;
 (wrap.closest('.modal')||document.body).append(panel);
 active={wrap,select,chip,panel,search:panel.querySelector('input'),list:panel.querySelector('[role=listbox]'),options:[],index:-1};
 chip.setAttribute('aria-expanded','true');chip.setAttribute('aria-controls',id);active.search.addEventListener('input',draw);draw();active.search.focus();
}
document.addEventListener('click',e=>{
 const chip=e.target.closest('[data-person-chip]');if(chip){if(active?.chip===chip)close();else open(chip.closest('[data-person-picker]'));return;}
 const clear=e.target.closest('[data-person-clear]');if(clear){const wrap=clear.closest('[data-person-picker]'),select=wrap.querySelector('select');if(select.disabled)return;select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));const waiting=wrap.closest('.comm-typed-composer')?.querySelector('[data-compose-waiting]');(waiting&&!waiting.hidden?waiting:wrap.querySelector('[data-person-chip]')).focus();return;}
 if(active&&!active.panel.contains(e.target))close();
});
document.addEventListener('pointerdown',e=>{const option=e.target.closest('[data-person-option]');if(option&&active?.panel.contains(option)){e.preventDefault();choose(Number(option.dataset.personOption));}});
document.addEventListener('keydown',e=>{
 if(!active)return;
 if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(true);return;}
 if(e.target!==active.search)return;
 if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Enter')choose(active.index);else if(active.options.length){active.index=(active.index+(e.key==='ArrowDown'?1:-1)+active.options.length)%active.options.length;highlight();}}
},true);
document.addEventListener('focusin',e=>{if(active&&!active.panel.contains(e.target)&&e.target!==active.chip)close();});
document.addEventListener('invalid',e=>{if(!e.target.matches('[data-person-picker] select'))return;e.preventDefault();const wrap=e.target.closest('[data-person-picker]');wrap.querySelector('[data-person-chip]').setAttribute('aria-invalid','true');open(wrap);},true);
document.addEventListener('scroll',position,true);window.addEventListener('resize',position);
new MutationObserver(()=>{if(active&&!active.wrap.isConnected)close();}).observe(document.body,{childList:true,subtree:true});
