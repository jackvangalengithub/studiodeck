import {getLanguage} from './i18n.js';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quote=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern=labels=>new RegExp('(?<![\\p{L}\\p{N}_@])@('+labels.sort((a,b)=>b.length-a.length).map(quote).join('|')+')(?![\\p{L}\\p{N}_@+-]|\\.[\\p{L}\\p{N}])','gu');
const t=(en,nl)=>getLanguage()==='nl'?nl:en;
const selections=new Map();
let contextFor=()=>null;

export function mentionData(form){
  const context=contextFor(form),body=form.elements.body?.value||'';
  if(!context)return [];
  return [...(selections.get(JSON.stringify(context))?.values()||[])].filter(m=>pattern([m.label]).test(body));
}
export function mentionBody(body,mentions=[]){
  if(!mentions.length)return esc(body);
  const byLabel=new Map(mentions.map(m=>[m.label,m]));
  let html='',last=0;
  for(const match of String(body).matchAll(pattern([...byLabel.keys()]))){
    const m=byLabel.get(match[1]);
    html+=esc(body.slice(last,match.index))+`<span class="chat-mention" title="${esc(m.email)}">${esc(match[0])}</span>`;
    last=match.index+match[0].length;
  }
  return html+esc(body.slice(last));
}

// One picker serves the hub, presentation comments and conversation-only guests.
export function installMentions({context,load,actor}){
  contextFor=context;
  let field=null,menu=null,items=[],selected=0,match=null,request=0,currentContext=null;
  const close=()=>{request++;menu?.remove();menu=null;field?.setAttribute('aria-expanded','false');field?.removeAttribute('aria-activedescendant');};
  const position=()=>{if(!menu||!field?.isConnected){close();return;}const r=field.getBoundingClientRect(),width=Math.min(r.width,380,innerWidth-24);menu.style.width=width+'px';menu.style.left=Math.max(12,Math.min(r.left,innerWidth-width-12))+'px';const h=menu.offsetHeight;menu.style.top=(r.bottom+h+8>innerHeight&&r.top>h+8?Math.max(8,r.top-h-4):Math.min(r.bottom+4,innerHeight-h-8))+'px';};
  function draw(){
    if(!menu){menu=document.createElement('div');menu.id='mention-picker';menu.className='mention-picker';menu.setAttribute('role','listbox');menu.setAttribute('aria-label',t('Mention someone','Iemand vermelden'));(field.closest('.modal')||document.body).append(menu);}
    menu.innerHTML=items.length?items.map((p,n)=>`<div role="option" id="mention-option-${n}" data-mention-index="${n}" aria-selected="${n===selected}" aria-disabled="${!!p.disabled}"><strong>${esc(p.name||p.email)}</strong><small>${esc(p.email)}</small>${p.disabled?`<small>${!p.email?t('Email address missing — add it in People','E-mailadres ontbreekt — voeg het toe bij Personen'):t('Ask the project team to invite this person','Vraag het projectteam om deze persoon uit te nodigen')}</small>`:p.invitable?`<small>${t('Invite to this conversation','Uitnodigen voor dit gesprek')}</small>`:''}</div>`).join(''):`<div class="mention-empty" role="status">${t('No project participants match.','Geen betrokken personen gevonden.')}</div>`;
    field.setAttribute('aria-expanded','true');field.setAttribute('aria-controls','mention-picker');
    if(selected>=0)field.setAttribute('aria-activedescendant','mention-option-'+selected);else field.removeAttribute('aria-activedescendant');
    position();menu.querySelector('[aria-selected=true]')?.scrollIntoView({block:'nearest'});
  }
  function choose(index){
    const p=items[index];if(!p||p.disabled||!match||!field?.isConnected)return;
    const label=p.label,token='@'+label+' ',start=match.index+match[1].length,end=field.selectionStart;
    if(field.value.length-(end-start)+token.length>field.maxLength&&field.maxLength>0)return;
    const key=JSON.stringify(currentContext);if(!selections.has(key))selections.set(key,new Map());selections.get(key).set(p.email,{email:p.email,label,...(p.invitable?{invite:true}:{})});
    const target=field;target.setRangeText(token,start,end,'end');close();target.focus();target.dispatchEvent(new Event('input',{bubbles:true}));
  }
  async function update(target){
    if(!(target instanceof HTMLTextAreaElement)||target.name!=='body')return;
    const ctx=context(target.form);if(!ctx)return;
    field=target;currentContext=ctx;hint(target);
    // A whitespace/opening punctuation boundary excludes ordinary email addresses.
    const found=/(^|[\s(\[{])@([^\s@]*)$/.exec(target.value.slice(0,target.selectionStart));
    if(!found||target.selectionStart!==target.selectionEnd){close();return;}
    match=found;const sequence=++request,query=found[2].toLocaleLowerCase();
    try{
      const people=await load(ctx);if(sequence!==request||!target.isConnected||document.activeElement!==target)return;
      items=people.filter(p=>(!p.email||p.email!==actor())&&(`${p.name} ${p.email}`).toLocaleLowerCase().includes(query)).map(p=>({...p,disabled:!p.email||(p.available===false&&!p.invitable),label:!p.name||people.filter(q=>q.name===p.name).length>1?p.email:p.name}));
      selected=items.findIndex(p=>!p.disabled);draw();
    }catch{if(sequence===request){close();const hint=target.parentElement.querySelector('.mention-hint');if(hint)hint.textContent=t('Could not load people. Type @ again to retry.','Personen laden mislukt. Typ opnieuw @ om het te proberen.');}}
  }
  function hint(target){
    let el=target.parentElement.querySelector('.mention-hint');
    if(!el){target.setAttribute('aria-autocomplete','list');el=document.createElement('small');el.className='form-hint mention-hint';el.id='mention-hint-'+Math.random().toString(36).slice(2);target.after(el);target.setAttribute('aria-describedby',[target.getAttribute('aria-describedby'),el.id].filter(Boolean).join(' '));}
    const invited=mentionData(target.form).filter(m=>m.invite).map(m=>m.label);
    el.textContent=invited.length?t('Sending invites '+invited.join(', ')+' to this conversation and its attachments, including earlier messages.','Met verzenden nodig je '+invited.join(', ')+' uit voor dit gesprek en de bijlagen, inclusief eerdere berichten.'):t('Type @ to mention someone.','Typ @ om iemand te vermelden.');
  }
  document.addEventListener('focusin',e=>{
    const target=e.target;
    if(target instanceof HTMLTextAreaElement&&target.name==='body'&&context(target.form)){
      hint(target);
    }else close();
  });
  document.addEventListener('input',e=>update(e.target));
  document.addEventListener('click',e=>{if(e.target===field)update(field);else if(!e.target.closest('.mention-picker'))close();});
  document.addEventListener('pointerdown',e=>{const option=e.target.closest('[data-mention-index]');if(option){e.preventDefault();choose(Number(option.dataset.mentionIndex));}},true);
  document.addEventListener('keydown',e=>{
    if(!menu||e.target!==field)return;
    if(['ArrowDown','ArrowUp','Enter','Escape'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')close();else if(e.key==='Enter'){if(selected>=0)choose(selected);else close();}else if(selected>=0){do{selected=(selected+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;}while(items[selected].disabled);draw();}}
    else if(e.key==='Tab')close();
  },true);
  document.addEventListener('scroll',position,true);window.addEventListener('resize',position);
  new MutationObserver(()=>{if(menu&&!field?.isConnected)close();}).observe(document.body,{childList:true,subtree:true});
}
