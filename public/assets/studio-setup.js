import {getLanguage,setLanguage} from './i18n.js';
import {studioTypes,studioBusiness} from './studio-business.js';

const copy={
  en:{tag:'A SPACE FOR YOUR PRACTICE',steps:['Language','Your studio','Your craft'],title:['Let’s make this feel like you.','Every studio starts with a name.','What kind of studio do you run?'],intro:['A few small details. A space that feels your own. First, choose the language you feel at home in.','Your name, on your workspace. You can always change it later.','Choose the closest fit. We’ll bring your world into the welcome images and website starting designs.'],language:'Studio language',name:'Studio name',placeholder:'e.g. Studio Willow',next:'Continue',back:'Back',finish:'Open my studio',saving:'Making room for you…',later:'You can change these details in Studio settings.',note:'For the work you love.\nAnd the people you create it for.',step:'Step',of:'of',error:'We couldn’t save your studio. Please try again.',choose:'Choose your field',languageHint:'Your workspace and new projects start in this language.',exit:'Your workspaces'},
  nl:{tag:'RUIMTE VOOR JOUW PRAKTIJK',steps:['Taal','Jouw studio','Jouw vak'],title:['Laten we het eigen maken.','Elke studio begint met een naam.','Wat voor studio heb je?'],intro:['Een paar kleine details. Een plek die als jouw eigen studio voelt. Kies eerst de taal waarin je je thuis voelt.','Jouw naam, op jouw werkplek. Je kunt hem later altijd aanpassen.','Kies wat het beste past. We stemmen je welkomstbeelden en websitedesigns af op jouw vak.'],language:'Studiotaal',name:'Studionaam',placeholder:'bijv. Studio Wilg',next:'Verder',back:'Terug',finish:'Open mijn studio',saving:'We maken ruimte voor je…',later:'Je kunt deze gegevens later wijzigen in Studio-instellingen.',note:'Voor het werk waar je van houdt.\nEn de mensen voor wie je het maakt.',step:'Stap',of:'van',error:'We konden je studio niet opslaan. Probeer het opnieuw.',choose:'Kies je vakgebied',languageHint:'Je werkplek en nieuwe projecten beginnen in deze taal.',exit:'Jouw werkplekken'}
};

export function studioSetupUi({state,esc,brand,api,applySession,render}){
  let draft=null,busy=false,error='';
  function required(){return !state.client&&state.studio?.role==='admin'&&state.studio.setup_completed_at===null;}
  function values(){
    if(draft?.id!==state.studio.id){draft={id:state.studio.id,step:0,language:state.studio.language||getLanguage(),name:state.studio.name||'',business_type:''};error='';}
    return draft;
  }
  function page(){
    const d=values();setLanguage(d.language);const t=copy[d.language],step=d.step;
    const profile=studioBusiness(d.business_type||'landscape',d.language);
    return `<main class="studio-setup" id="main"><header class="setup-header">${brand()}<a href="/choose">${t.exit} ↗</a></header>
      <div class="setup-shell"><nav aria-label="${t.step}"><ol class="setup-steps">${t.steps.map((label,i)=>`<li ${i===step?'aria-current="step"':''} class="${i<step?'complete':''}"><span>${i<step?'✓':String(i+1).padStart(2,'0')}</span>${label}</li>`).join('')}</ol></nav>
      <form data-studio-setup class="setup-form ${step===2?'setup-craft':'setup-intro'}" aria-busy="${busy}">
        <div class="setup-copy"><p class="setup-eyebrow">${t.tag}</p><h1 tabindex="-1">${t.title[step]}</h1><p class="setup-description">${t.intro[step]}</p>
        ${step===0?`<fieldset class="setup-languages"><legend class="sr-only">${t.language}</legend>${[['en','English','Hello. Make yourself at home.'],['nl','Nederlands','Hallo. Voel je thuis.']].map(([id,label,hint])=>`<label><input type="radio" name="language" value="${id}" ${d.language===id?'checked':''}><span><strong>${label}</strong><small>${hint}</small><i aria-hidden="true">✓</i></span></label>`).join('')}</fieldset><p class="setup-hint">${t.languageHint}</p>`:''}
        ${step===1?`<label class="setup-name">${t.name}<input name="name" value="${esc(d.name)}" placeholder="${t.placeholder}" required maxlength="100" autocomplete="organization"></label>`:''}</div>
        ${step===2?`<fieldset class="setup-types" ${busy?'disabled':''}><legend class="sr-only">${t.choose}</legend>${studioTypes.map(item=>{const b=studioBusiness(item.id,d.language);return `<label class="setup-type"><input type="radio" name="business_type" value="${item.id}" ${d.business_type===item.id?'checked':''} required><span class="setup-type-photo"><img src="${b.image}" alt="" ${item.id==='interior'?'fetchpriority="high"':'loading="lazy"'}><i aria-hidden="true">✓</i></span><span class="setup-type-copy"><strong>${esc(b.label)}</strong><small>${esc(b.description)}</small></span></label>`;}).join('')}</fieldset>`:`<aside class="setup-art" aria-hidden="true"><img src="${profile.image}" alt=""><div><span>STUDIODECK / ${String(step+1).padStart(2,'0')}</span><p>${t.note.replace('\n','<br>')}</p></div></aside>`}
        <footer class="setup-footer"><div><span class="setup-count">${t.step} ${step+1} ${t.of} 3</span><p>${t.later}</p><p class="setup-error" role="alert">${esc(error)}</p></div><div class="setup-buttons">${step>0?`<button class="button ghost" type="button" data-setup-back ${busy?'disabled':''}>← ${t.back}</button>`:''}<button class="button primary" type="submit" ${busy||(step===2&&!d.business_type)?'disabled':''}>${busy?t.saving:step===2?t.finish:t.next}<span aria-hidden="true"> ↗</span></button></div></footer>
      </form></div></main>`;
  }
  function redraw(focus=true){render();if(focus)document.querySelector('.setup-copy h1')?.focus({preventScroll:true});}
  function afterRender(){
    const form=document.querySelector('[data-studio-setup]');if(!form)return;
    form.addEventListener('input',event=>{if(event.target.name==='name')draft.name=event.target.value;});
    form.addEventListener('change',event=>{
      if(event.target.name==='language'){draft.language=event.target.value;redraw(false);document.querySelector(`[name="language"][value="${draft.language}"]`)?.focus();}
      if(event.target.name==='business_type'){draft.business_type=event.target.value;form.querySelector('[type="submit"]').disabled=false;}
    });
    form.querySelector('[data-setup-back]')?.addEventListener('click',()=>{if(!busy){draft.step--;error='';redraw();}});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy)return;
      if(draft.step<2){if(draft.step===1&&!draft.name.trim()){form.elements.name.setCustomValidity(draft.language==='nl'?'Geef je studio een naam.':'Give your studio a name.');form.elements.name.reportValidity();form.elements.name.addEventListener('input',()=>form.elements.name.setCustomValidity(''),{once:true});return;}draft.step++;error='';redraw();return;}
      busy=true;error='';redraw(false);
      try{
        const sid=draft.id,result=await api('complete_studio_setup',{name:draft.name.trim(),language:draft.language,business_type:draft.business_type});
        if(state.studio?.id===sid){applySession(result);draft=null;state.websiteEditing=false;state.tab='projects';render();document.querySelector('#welcome-title')?.setAttribute('tabindex','-1');document.querySelector('#welcome-title')?.focus();}
      }catch(e){error=e.message||copy[draft.language].error;}
      finally{busy=false;if(required())redraw(false);}
    });
  }
  return {required,page,afterRender};
}
