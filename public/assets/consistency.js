import {getLanguage,tr} from './i18n.js';
const labels={
  checking_sources:['Classifying sources and reading design details','Bronnen classificeren en ontwerpdetails lezen'],comparing_sources:['Comparing specifications and images','Specificaties en afbeeldingen vergelijken'],verifying_mismatch:['Reviewing a possible mismatch','Een mogelijk verschil beoordelen'],checks:['Checks','Controles'],run:['Scan for inconsistencies','Scannen op tegenstrijdigheden'],running:['Checking sources…','Bronnen controleren…'],intro:['Compare specifications, detailed designs and project images. Inspiration and before photos normally do not create warnings.','Vergelijk specificaties, uitgewerkte ontwerpen en projectbeelden. Inspiratie en voorfoto’s leveren normaal geen waarschuwingen op.'],
  unavailable:['Connect AI to enable consistency checks.','Verbind AI om consistentiecontroles in te schakelen.'],notRun:['These sources have not been checked yet.','Deze bronnen zijn nog niet gecontroleerd.'],stale:['Sources or their roles changed. Run checks again to review the current design.','Bronnen of hun rollen zijn gewijzigd. Voer de controles opnieuw uit voor het huidige ontwerp.'],partial:['Some evidence could not be checked. These results are incomplete.','Niet al het bewijs kon worden gecontroleerd. Deze resultaten zijn onvolledig.'],empty:['No mismatches found in the evidence checked.','Geen verschillen gevonden in het gecontroleerde bewijs.'],none:['No source files yet. Upload files to compare them.','Nog geen bronbestanden. Upload bestanden om ze te vergelijken.'],
  mismatch:['Possible mismatch','Mogelijk verschil'],clarification:['Needs clarification','Verduidelijking nodig'],resolved:['Resolved','Opgelost'],dismissed:['Hidden','Verborgen'],open:['Open','Open'],resolve:['Mark resolved','Markeer als opgelost'],dismiss:['Hide as irrelevant','Verbergen als niet relevant'],reopen:['Restore finding','Bevinding terugzetten'],question:['Create conversation','Gesprek starten'],linked:['Open conversation','Gesprek openen'],history:['Hidden and resolved findings','Verborgen en opgeloste bevindingen'],evidence:['View evidence','Bekijk bewijs'],written:['Written requirement','Geschreven vereiste'],visual:['Visual observation','Visuele waarneming'],
  price:['Price','Prijs'],scope:['Scope','Omvang'],inclusion:['Inclusion','Inbegrepen'],suggestions:['Inconsistency suggestions','Suggesties bij tegenstrijdigheden'],explainTitle:['Suggested items','Voorgestelde items'],explain:['We will compare details extracted from your current files: materials, dimensions, prices and what is included. Images can also reveal differences from written specifications.','We vergelijken details uit je huidige bestanden: materialen, afmetingen, prijzen en wat is inbegrepen. Ook afbeeldingen kunnen verschillen met geschreven specificaties laten zien.'],limits:['Suggestions require conflicting evidence about the same detail. Missing information, routine tasks and normal design changes do not create suggestions. There may be no inconsistencies to report.','Suggesties vereisen tegenstrijdig bewijs over hetzelfde detail. Ontbrekende informatie, gewone taken en normale ontwerpwijzigingen leveren geen suggesties op. Er zijn mogelijk geen tegenstrijdigheden te melden.'],control:['Each suggestion shows both sources. You decide whether to discuss it, hide it as irrelevant or mark it resolved. Nothing is sent to clients or added to the budget automatically. File extraction continues as usual.','Elke suggestie toont beide bronnen. Jij bepaalt of je deze bespreekt, als niet relevant verbergt of als opgelost markeert. Er wordt niets automatisch naar klanten verstuurd of aan het budget toegevoegd. Het uitlezen van bestanden gaat gewoon door.'],start:['Scan for inconsistencies','Scannen op tegenstrijdigheden'],cancel:['Cancel','Annuleren'],
  roles:['Source roles','Bronrollen'],rolesHint:['AI suggests a role for each page and image. Correct it here when needed. An approved specification requires recorded approval.','AI stelt een rol voor per pagina en afbeelding. Corrigeer die hier indien nodig. Een goedgekeurde specificatie vereist vastgelegde goedkeuring.'],fileRole:['Document role','Documentrol'],editRole:['Edit role','Rol wijzigen'],automatic:['Automatic','Automatisch'],save:['Save role','Rol opslaan'],sources:['sources','bronnen'],source:['Source','Bron'],page:['Page','Pagina'],image:['Image','Afbeelding'],checked:['Last checked','Laatst gecontroleerd'],queued:['Checks queued.','Controles ingepland.'],questionSaved:['Conversation started privately with the source evidence.','Privégesprek gestart met de broninformatie.'],outdated:['Earlier evidence — run checks again before using this finding.','Eerder bewijs — voer de controles opnieuw uit voordat je deze bevinding gebruikt.'],imageUnavailable:['Image unavailable. Open the original source to review it.','Afbeelding niet beschikbaar. Open de oorspronkelijke bron om die te bekijken.'],original:['Download original','Origineel downloaden'],
  inspiration:['Inspiration / moodboard','Inspiratie / moodboard'],concept:['Concept','Concept'],alternative:['Unselected alternative','Niet-geselecteerd alternatief'],detailed_design:['Detailed design','Uitgewerkt ontwerp'],specification:['Specification','Specificatie'],approved_specification:['Approved specification','Goedgekeurde specificatie'],before:['Before / existing','Voor / bestaand'],progress:['Work in progress','Werk in uitvoering'],completed:['Completed work','Opgeleverd werk'],unknown:['Unknown','Onbekend'],colour:['Colour','Kleur'],material:['Material','Materiaal'],finish:['Finish','Afwerking'],model:['Product / model','Product / model'],dimension:['Written dimension','Geschreven maat'],
  found:['Findings to review','Te beoordelen bevindingen'],
  allReviewed:['All findings have been hidden or resolved. You can restore them below.','Alle bevindingen zijn verborgen of opgelost. Je kunt ze hieronder terugzetten.'],
  background:['The scan runs in the background. You can close this window and keep working. Open it again to see progress and results.','De scan draait op de achtergrond. Je kunt dit venster sluiten en doorwerken. Open het opnieuw voor de voortgang en resultaten.'],
  scanQueued:['Scan queued…','Scan ingepland…'],
  scanRunning:['Scanning for inconsistencies…','Scannen op tegenstrijdigheden…'],
  scanFailed:['The scan could not finish. Your earlier findings are still available. Try scanning again.','De scan kon niet worden voltooid. Je eerdere bevindingen zijn nog beschikbaar. Probeer opnieuw te scannen.'],
  keepWorking:['Continue working','Verder werken'],
  close:['Close','Sluiten'],
  readyQuestion:['Question to discuss','Vraag om te bespreken'],
  noSuggestions:['No suggestions this time','Deze keer geen suggesties'],
  noSuggestionsHint:['We couldn’t find any inconsistencies in the files we checked.','We konden geen tegenstrijdigheden vinden in de bestanden die we hebben bekeken.'],
  readyTitle:['Something worth discussing?','Iets om te bespreken?'],
  readyHint:['Scan your project files to find differences worth a conversation.','Scan je projectbestanden om verschillen te vinden die een gesprek waard zijn.'],
  caughtUp:['You’re all caught up','Je bent helemaal bij'],
  caughtUpHint:['Your reviewed findings are saved below if you need them again.','Je beoordeelde bevindingen staan hieronder als je ze weer nodig hebt.'],
};
export const checkText=key=>labels[key]?.[getLanguage()==='nl'?1:0]||key;

export function consistencyUi({state,esc,button,openModal,closeModal,api,refresh,toast,editable,resourceHeaders,discuss}){
  const t=checkText,roles=['inspiration','concept','alternative','detailed_design','specification','approved_specification','before','progress','completed','unknown'];
  const data=()=>state.data.checks||{sources:[],findings:[],roles:{}};
  const starting=new Set();
  const jobs=()=>state.data?.jobs?.filter(j=>j.type==='consistency')||[];
  const pending=()=>starting.has(state.data?.iteration.id)||jobs().some(j=>['queued','running'].includes(j.status));
  const attrs=f=>`data-id="${esc(f.id)}"`;
  function finding(f){
    const question=f.question||(getLanguage()==='nl'?`Welke keuze moeten we aanhouden voor “${f.title}”?`:`Which choice should we use for “${f.title}”?`);
    return `<article class="check-finding ${f.stale?'is-stale':''}"><h3>${esc(f.title)}</h3><p class="check-finding-summary">${esc(f.explanation)}</p>${f.stale?`<p class="notice">${esc(t('outdated'))}</p>`:''}<div class="check-question-preview"><small>${t('readyQuestion')}</small><p>${esc(question)}</p></div><details class="check-finding-sources" data-check-details="${esc(f.id)}"><summary>${t('evidence')}</summary><div class="check-evidence">${f.evidence.map((e,n)=>`<div><small>${esc(t(e.basis==='text'?'written':'visual'))} · ${esc(t(e.role))}</small><p><strong>${esc(e.object)}${e.room?' · '+esc(e.room):''}</strong><br>${esc(t(e.property))}: ${esc(e.value)}</p>${e.quote?`<blockquote>${esc(e.quote)}</blockquote>`:''}<small>${esc(e.name)}${e.page?' · '+t('page')+' '+Number(e.page):''}</small>${!f.stale?button(t('evidence'),'check-evidence','small ghost',attrs(f)+` data-evidence="${n}"`):''}</div>`).join('')}</div></details>${editable()?`<div class="row wrap check-finding-actions">${f.question_id?button(t('linked'),'check-question','small primary',attrs(f),'chat'):!f.stale?button(t('question'),'check-review','small primary',attrs(f)+' data-operation="question"','chat'):''}${f.status==='open'?button(t('dismiss'),'check-review','small ghost',attrs(f)+' data-operation="dismissed"'):button(t('reopen'),'check-review','small ghost',attrs(f)+' data-operation="open"')}</div>`:''}</article>`;
  }
  function emptyState(reviewed){
    const d=data(),title=reviewed?'caughtUp':!d.sources.length||!d.run?'readyTitle':'noSuggestions',hint=reviewed?'caughtUpHint':!d.sources.length?'none':!d.run?'readyHint':'noSuggestionsHint';
    return `<div class="check-empty"><svg class="check-empty-art" viewBox="0 0 240 160" fill="none" aria-hidden="true"><ellipse cx="120" cy="142" rx="76" ry="8" fill="currentColor" opacity=".06"/><circle cx="118" cy="77" r="65" fill="currentColor" opacity=".05"/><rect x="56" y="33" width="74" height="98" rx="9" transform="rotate(-12 56 33)" fill="var(--surface,#fff)" stroke="currentColor" opacity=".35"/><rect x="81" y="24" width="77" height="104" rx="9" fill="var(--surface,#fff)" stroke="currentColor" stroke-width="2"/><path d="M97 44h37M97 56h29M97 70h17" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".3"/><circle cx="149" cy="98" r="27" fill="var(--surface,#fff)" stroke="currentColor" stroke-width="3"/><path d="m169 119 19 20" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M139 98h20M181 36v12M175 42h12M48 94v8M44 98h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".5"/></svg><h3>${t(title)}</h3><p>${t(hint)}</p></div>`;
  }
  function scanStatus(){
    const job=jobs().find(j=>j.status==='running')||jobs().find(j=>j.status==='queued');
    if(pending())return `<div class="notice check-scan-status" role="status"><strong>${t(job?.status==='running'?'scanRunning':'scanQueued')}</strong>${job?.progress?.stage&&labels[job.progress.stage]?`<p>${t(job.progress.stage)}</p>`:''}<p>${t('background')}</p><span class="check-scan-track" aria-hidden="true"></span></div>`;
    if(jobs().at(-1)?.status==='failed')return `<p class="notice" role="status">${t('scanFailed')}</p>`;
    return '';
  }
  function page(){
    const d=data(),active=d.findings.filter(f=>f.status==='open'),reviewed=d.findings.filter(f=>f.status!=='open');
    return `<section class="consistency-panel">${!d.available?`<p class="notice">${t('unavailable')}</p>`:''}${active.map(finding).join('')}${!active.length&&!pending()&&jobs().at(-1)?.status!=='failed'?emptyState(reviewed.length):''}${reviewed.length?`<details class="check-reviewed" data-check-details="reviewed"><summary>${t('history')} (${reviewed.length})</summary>${reviewed.map(finding).join('')}</details>`:''}</section>`;
  }
  function sources(){const d=data();return `<details class="check-sources"><summary>${t('roles')} (${d.sources.length})</summary><p class="muted">${t('rolesHint')}</p>${state.data.files.map(file=>`<section class="check-source-file"><div class="row between wrap"><h3>${esc(file.name)}</h3>${editable()?button(t('fileRole')+': '+t(d.roles[file.id+':file']||'automatic'),'check-role','small ghost',`data-key="${esc(file.id+':file')}"`):''}</div>${d.sources.filter(s=>s.version_id===file.id).map(s=>`<div class="check-source row between wrap"><div><strong>${s.slide_id?esc(s.name):s.page?t('page')+' '+s.page:esc(s.name)}</strong><span class="tag outline">${esc(t(s.role))}</span>${s.reason?`<p class="muted">${esc(s.reason)}</p>`:''}</div>${editable()?button(t('editRole'),'check-role','small ghost',`data-key="${esc(s.key)}"`):''}</div>`).join('')}</section>`).join('')}</details>`;}
  function footer(){const d=data();return `<div class="modal-footer">${button(t(pending()?'keepWorking':'close'),'close-modal','ghost')}${editable()?button(t(pending()?'scanRunning':'start'),'check-start','primary',pending()||!d.available||!d.sources.length?'disabled':'','spark'):''}</div>`;}
  function explain(){
    openModal(t('explainTitle'),`<div data-check-dialog="${esc(state.data.iteration.id)}"><div data-check-status></div><div data-check-results></div><div data-check-footer></div></div>`,true);
    sync();
  }
  function sync(){
    const busy=pending();
    document.querySelectorAll('[data-action="check-run"],[data-action="suggest-open-questions"]').forEach(el=>{
      el.classList.toggle('is-scanning',busy);
      el.title=busy?t('scanRunning'):tr('checklist_suggest');
    });
    const dialog=document.querySelector('[data-check-dialog]');
    if(!dialog||dialog.dataset.checkDialog!==state.data?.iteration.id)return;
    for(const [key,html] of [['status',scanStatus()],['results',page()],['footer',footer()]]){
      const target=dialog.querySelector(`[data-check-${key}]`);
      if(target.checkHtml===html)continue;
      const expanded=[...target.querySelectorAll('details[open]')].map(el=>el.dataset.checkDetails);
      const focused=target.contains(document.activeElement)?document.activeElement:null;
      const action=focused?.dataset.action,id=focused?.dataset.id,operation=focused?.dataset.operation;
      target.innerHTML=html;target.checkHtml=html;
      target.querySelectorAll('details').forEach(el=>{el.open=expanded.includes(el.dataset.checkDetails);});
      if(focused){
        const replacement=[...target.querySelectorAll('button')].find(el=>el.dataset.action===action&&el.dataset.id===id&&el.dataset.operation===operation);
        (replacement||dialog.querySelector('[data-action="close-modal"]'))?.focus({preventScroll:true});
      }
    }
  }
  async function action(action,el){
    const d=data(),iteration=state.data.iteration.id,f=d.findings.find(f=>f.id===el.dataset.id);
    if(action==='check-run'||action==='suggest-open-questions'){explain();}
    if(action==='check-start'){
      if(pending()||!editable()||!d.available||!d.sources.length)return;
      starting.add(iteration);closeModal();sync();
      try{await api('run_consistency_checks',{iteration});if(state.data?.iteration.id===iteration){await refresh();toast(t('queued'));}}
      finally{starting.delete(iteration);sync();}
    }
    if(action==='check-role'){
      const key=el.dataset.key,source=d.sources.find(s=>s.key===key),file=state.data.files.find(f=>key===f.id+':file');
      openModal(t('editRole'),`<p>${esc(source?.name||file?.name||'')}${source?.page?' · '+t('page')+' '+source.page:''}</p><p>${t('rolesHint')}</p><form data-form="check-role"><input type="hidden" name="source_key" value="${esc(key)}"><label>${t('source')}<select name="role"><option value="">${t('automatic')}</option>${roles.map(role=>`<option value="${role}" ${d.roles[key]===role?'selected':''}>${esc(t(role))}</option>`).join('')}</select></label><button type="submit" class="button primary">${t('save')}</button></form>`);
    }
    if(action==='check-review'&&f){const r=await api('review_consistency_finding',{iteration,id:f.id,operation:el.dataset.operation});await refresh(true);sync();if(el.dataset.operation==='question'){closeModal();toast(t('questionSaved'));if(r.question_id)discuss(r.question_id);}}
    if(action==='check-question'&&f?.question_id){closeModal();discuss(f.question_id);}
    if(action==='check-evidence'&&f&&!f.stale){
      const e=f.evidence[Number(el.dataset.evidence)];if(!e)return;
      let src='';if(e.has_image){try{const response=await fetch('api.php?'+new URLSearchParams({action:'check_image',iteration,source_key:e.source_key}),{credentials:'same-origin',headers:resourceHeaders()});if(response.ok){src=URL.createObjectURL(await response.blob());setTimeout(()=>URL.revokeObjectURL(src),60000);}}catch{}}
      const box=e.bbox,overlay=box?`<span class="check-region" style="left:${box[0]*100}%;top:${box[1]*100}%;width:${(box[2]-box[0])*100}%;height:${(box[3]-box[1])*100}%"></span>`:'';
      openModal(t('evidence'),`<p><strong>${esc(e.name)}</strong>${e.page?' · '+t('page')+' '+e.page:''}</p><p>${esc(t(e.role))} · ${esc(e.object)} · ${esc(e.value)}</p>${e.quote?`<blockquote>${esc(e.quote)}</blockquote>`:''}${src?`<div class="check-image"><img src="${esc(src)}" alt="${esc(e.object)}">${overlay}</div>`:e.has_image?`<p class="notice">${t('imageUnavailable')}</p>`:''}${button(t('original'),'download','small ghost',`data-id="${esc(e.version_id)}"`)}`,true);
    }
  }
  async function submit(fields){await api('check_source_role',{...fields,iteration:state.data.iteration.id});closeModal();await refresh(true);}
  return {page,sources,action,submit,sync};
}
