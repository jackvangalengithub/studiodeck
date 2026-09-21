import {syncMockAdditions} from './assets/demo.js';

// Conversation-first prototype. All data, uploads, confirmations and costs stay in this browser.
export function createMockFeatures({state,render,openModal,closeModal,toast,button,icon,esc,personAvatar,api,refresh,slideDefs,startPresentation}) {
  const storageKey = 'studiodeck-communication-mock-v3';
  const people = {
    studio: {name:'Sophie van Dijk',role:'Designer',budget:true},
    client: {name:'Emma de Vries',role:'Client',budget:true},
    trade: {name:'Thomas Bakker',role:'Bakker Joinery',budget:false}
  };
  const seed = () => ({role:'studio',messages:[],uploads:[],events:[],legacy:[],requests:[
    {id:'paint',thread:'paint',text:'Please confirm the more durable, washable paint for the hallway. It will cost €1,000 extra.',from:'studio',to:'client',amount:100000,status:'pending',created:'2026-09-19T09:30:00Z',project:'van-galen',iteration:'it-2',attachment:null},
    {id:'installation',thread:'kitchen',text:'Can you confirm that removing the old cabinets is included in the installation?',from:'client',to:'studio',amount:null,status:'pending',created:'2026-09-19T09:45:00Z',project:'van-galen',iteration:'it-2',attachment:null},
    {id:'colour',thread:'paint',text:'Please confirm RAL 9010 with a matt finish for the hallway walls.',from:'studio',to:'client',amount:null,status:'confirmed',created:'2026-09-18T13:00:00Z',confirmedAt:'2026-09-18T14:32:00Z',project:'van-galen',iteration:'it-2',attachment:null}
  ]});
  let demo=seed();
  try {const stored=JSON.parse(sessionStorage.getItem(storageKey));if(stored&&Array.isArray(stored.requests)&&Array.isArray(stored.uploads))demo={...demo,...stored};} catch {}
  if(!people[demo.role])demo.role='studio';
  let thread=demo.ui?.thread||'paint',view=demo.ui?.view||'all',pendingOnly=demo.ui?.pendingOnly||false,who=demo.ui?.who||'everyone',drafts={},replyTo=null,requestDraft=null,highlight=null;
  const $=selector=>document.querySelector(selector);
  const btn=(label,action,kind='',extra='',ico='')=>button(label,'mock-'+action,kind,extra,ico);
  const uid=()=>crypto.randomUUID();
  const save=()=>{try{sessionStorage.setItem(storageKey,JSON.stringify(demo));return true;}catch{toast('This browser’s demo storage is full. Your changes remain available until you reload.');return false;}};
  const money=cents=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:cents%100?2:0}).format(Math.abs(cents)/100);
  const signed=cents=>(cents>0?'+ ':cents<0?'− ':'')+money(cents);
  const time=value=>new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
  const avatar=role=>personAvatar({},people[role]?.name||role);
  const currentProject=()=>state.data?.project.id||'van-galen';
  const projectRequests=()=>demo.requests.filter(r=>r.project===currentProject());
  const allowedThread=id=>id!=='internal'||demo.role==='studio';
  const visibleRequests=()=>projectRequests().filter(r=>allowedThread(r.thread));
  const pendingCount=()=>visibleRequests().filter(r=>r.status==='pending').length;
  const uploadFiles=()=>demo.uploads.map(f=>({id:f.id,asset_id:f.id,iteration_id:f.iteration,project_id:f.project,name:f.name,number:1,mime:f.mime,size:f.size,url:f.data,preview_url:f.mime.startsWith('image/')?f.data:null,has_preview:f.mime.startsWith('image/'),category:'other',metadata:{summary:'Attached in Communication (local demo)'},history:[{id:f.id,name:f.name,number:1,url:f.data}]}));
  const budgetRows=()=>demo.requests.filter(r=>r.status==='confirmed'&&r.amount!==null).map(r=>({id:'confirmation-'+r.id,iteration_id:r.iteration,mock_confirmation_id:r.id,label:r.text.replace(/^please confirm\s+(the\s+)?/i,'').slice(0,140),vendor:'Confirmed project change',amount_cents:r.amount,kind:'quote',parent_id:null,included:0,source_version_id:null,note:`Confirmed by ${people[r.to].name} on ${time(r.confirmedAt)}. Linked to the original message in Communication.`}));
  function beforeRequest(action,body){syncMockAdditions(budgetRows(),uploadFiles(),demo.legacy);if(action==='comment')body._mock_author=people[demo.role].name;}
  function enrich(result,action){
    if(['project','deck'].includes(action)){
      result.slides??=[];result.slide_content??=[];result.open_questions??=[];
      const events=demo.events.filter(e=>e.project===result.project.id);
      result.events=[...events,...(result.events||[])];result.events_pagination={page:0,total:result.events.length};
      result.members=[{id:'sophie',name:people.studio.name,email:'sophie@example.test',role:'Project designer',profile:{name:people.studio.name}}];
      for(const comment of result.comments||[]){const id=result.project.id+':'+comment.id;const existing=demo.legacy.find(c=>c.key===id);const copy={...comment,key:id,project:result.project.id,iteration:comment.iteration_id||result.iteration.id};if(existing)Object.assign(existing,copy);else demo.legacy.push(copy);}
      save();
    }
    return result;
  }
  function record(detail,type='confirmation_updated'){demo.events.unshift({id:'mock-'+uid(),project:currentProject(),actor:people[demo.role].name,type,detail,created_at:new Date().toISOString()});save();}
  const tabs=['overview','slides','files','budget','people','comments','activity','projects'];
  function readTab(){const hash=location.hash.slice(1);return ['approvals','documents','communication'].includes(hash)?'comments':tabs.includes(hash)?hash:'comments';}
  function syncUrl(replace=false){const path='/mock#'+(state.present?'presentation':state.tab);if(location.pathname+location.hash!==path)history[replace?'replaceState':'pushState'](null,'',path);}
  function restoreRoute(){state.present=false;state.client=false;state.tab=readTab();render();}
  function go(tab){closeModal();state.present=false;state.client=false;state.tab=tab;render();window.scrollTo({top:0,behavior:'instant'});}
  function toolbar(){return `<div class="mock-toolbar"><span class="mock-demo-label">Concept demo · Communication & confirmations</span><div class="row"><label class="mock-perspective">View as<select id="mock-role" aria-label="Demo perspective">${Object.entries(people).map(([r,p])=>`<option value="${r}" ${demo.role===r?'selected':''}>${p.name.split(' ')[0]} · ${p.role}</option>`).join('')}</select></label>${btn('Reset','reset','small ghost','','history')}</div></div>`;}
  function overviewPanel(){return `<div class="mock-overview-note"><div>${icon('chat')}<span><strong>Keep the conversation together</strong><small>${pendingCount()} confirmations waiting · Comments and replies in one place</small></span></div>${btn('Communication','communication','small','','arrow')}</div>`;}
  function topics(){
    const base=[{id:'paint',title:'Hallway paint',label:'Materials & finishes',scope:'Emma, Sophie & Thomas'},{id:'kitchen',title:'Kitchen installation',label:'Scope & practical details',scope:'Emma, Sophie & Thomas'},{id:'internal',title:'Material review',label:'Internal team',scope:'Studio team only'}];
    const roots=demo.legacy.filter(c=>c.project===currentProject()&&!c.parent_id);
    return [...base,...roots.map(c=>({id:'comment-'+c.id,title:c.slide_title||'Design feedback',label:'Slide comments',scope:'Emma, Sophie & Thomas',source:c}))].filter(t=>allowedThread(t.id));
  }
  function topicFor(id){return topics().find(t=>t.id===id)||topics()[0];}
  function legacyRole(author){return /emma|family/i.test(author)?'client':/thomas/i.test(author)?'trade':'studio';}
  function entries(id){
    const seeded=id==='paint'?[{id:'paint-intro',role:'client',text:'The hallway gets a lot of use. Could we choose something that is easier to clean?',created:'2026-09-19T08:10:00Z'},{id:'paint-answer',role:'studio',text:'Yes. We can keep the colour we agreed and choose a more durable, washable paint.',created:'2026-09-19T08:30:00Z'}]:id==='kitchen'?[{id:'kitchen-intro',role:'trade',text:'We’re checking the installation details before ordering. Happy to clarify anything here.',created:'2026-09-19T08:15:00Z'}]:id==='internal'?[{id:'internal-intro',role:'studio',text:'Let’s review the oak and limestone samples together on Friday.',created:'2026-09-19T08:00:00Z'}]:[];
    if(id.startsWith('comment-')){const root=id.slice(8);for(const c of demo.legacy.filter(c=>c.project===currentProject()&&(c.id===root||c.parent_id===root)))seeded.push({id:'legacy-'+c.id,role:legacyRole(c.author),author:c.profile?.name||c.author,text:c.body,created:c.created_at,legacy:true});}
    return [...seeded,...demo.messages.filter(m=>m.project===currentProject()&&m.thread===id),...projectRequests().filter(r=>r.thread===id).map(r=>({...r,confirmation:true}))].sort((a,b)=>new Date(a.created)-new Date(b.created));
  }
  function fileSnapshot(file){return {id:file.id,name:file.name,number:file.number||1,mime:file.mime,url:demo.uploads.some(u=>u.id===file.id)?null:file.url,uploadId:demo.uploads.some(u=>u.id===file.id)?file.id:null};}
  const attachmentUrl=a=>a?.uploadId?demo.uploads.find(f=>f.id===a.uploadId)?.data:a?.url;
  function attachmentHtml(attachment,owner){if(!attachment)return '';const upload=demo.uploads.find(u=>u.id===attachment.uploadId);const processing=upload&&Date.now()<upload.readyAt;return `<button class="mock-attachment" data-action="mock-file" data-owner="${esc(owner)}">${icon('file')}<span>${esc(attachment.name)} <small>V${attachment.number}${processing?' · Preparing preview…':''}</small></span>${icon('eye')}</button>`;}
  function confirmationCard(r,compact=false){
    const confirmed=r.status==='confirmed',withdrawn=r.status==='withdrawn',mine=r.to===demo.role;
    return `<article class="mock-confirmation ${confirmed?'is-confirmed':''} ${withdrawn?'is-withdrawn':''} ${highlight===r.id?'is-highlighted':''}" data-confirmation="${esc(r.id)}"><div class="mock-confirmation-top"><span class="mock-status ${confirmed?'done':withdrawn?'closed':'pending'}">${icon(confirmed?'check':withdrawn?'close':'clock')}${confirmed?'Confirmed':withdrawn?'Withdrawn':'Pending confirmation'}</span><small>${people[r.from].name.split(' ')[0]} → ${people[r.to].name}${compact?' · '+esc(topicFor(r.thread).title):''}</small></div><p>${esc(r.text)}</p>${attachmentHtml(r.attachment,r.id)}${r.amount!==null?`<div class="mock-budget-change">${icon('budget')}<span>Budget change <strong>${signed(r.amount)}</strong> <small>including VAT</small></span></div>`:''}<div class="mock-confirmation-bottom">${confirmed?`<span class="mock-confirmed-by">${icon('check')} ${people[r.to].name} confirmed · ${time(r.confirmedAt)}</span>${r.amount!==null?btn('Added to budget','budget-link','small ghost',`data-id="${esc(r.id)}"`,'arrow'):''}`:withdrawn?`<small class="muted">Withdrawn by ${people[r.from].name} · ${time(r.withdrawnAt)}</small>`:`${mine?btn(r.amount!==null?'Confirm change · '+signed(r.amount):'Confirm','confirm','primary small',`data-id="${esc(r.id)}"`,'check'):`<small class="muted">Waiting for ${people[r.to].name.split(' ')[0]}</small>`}${btn('Reply','reply-to','small ghost',`data-id="${esc(r.id)}"`,'chat')}${r.from===demo.role?btn('Withdraw','withdraw','small ghost',`data-id="${esc(r.id)}"`):''}`}${compact?btn('Open conversation','open-request','small ghost',`data-id="${esc(r.id)}"`,'arrow'):''}</div></article>`;
  }
  function messageCard(m){const r=people[m.role]?m.role:'studio';return `<article class="mock-message" data-message="${esc(m.id)}"><div class="comment-author">${avatar(r)}<small><strong>${esc(m.legacy&&m.author&&!m.author.includes('@')?m.author:people[r].name)}</strong> · ${time(m.created)}${m.legacy?' · Slide comment':''}</small></div><div class="mock-message-body">${m.replyTo?`<small class="mock-reply-ref">Reply to a confirmation request</small>`:''}<p>${esc(m.text)}</p>${attachmentHtml(m.attachment,m.id)}${btn('Ask for confirmation','ask-existing','small ghost',`data-message="${esc(m.id)}"`,'check')}</div></article>`;}
  function sourceContext(topic){if(!topic.source)return '';const def=findSource(topic.source);return `<button class="mock-context" data-action="mock-source" data-thread="${esc(topic.id)}"><img src="${esc(def?.visual?.url||'assets/interior.webp')}" alt="Original commented design"><span><strong>${esc(def?.title||'Original design slide')}</strong><small>Comments and replies from the presentation</small></span>${icon('arrow')}</button>`;}
  function findSource(c){return slideDefs().find(s=>s.id===c.slide||s.record?.id===c.slide)||slideDefs().find(s=>s.visual&&['photo','render'].includes(s.type));}
  function communication(){
    const list=topics();if(!list.some(t=>t.id===thread))thread=list[0].id;const topic=topicFor(thread);const pending=pendingCount();
    const controls=`<div class="mock-view-controls"><div class="filter-chips mock-view-tabs">${btn('All communication','view','small '+(view==='all'?'primary':''),'data-view="all"')}${btn('Confirmations <span class="mock-count">'+visibleRequests().length+'</span>','view','small '+(view==='confirmations'?'primary':''),'data-view="confirmations"')}</div>${view==='confirmations'?`<div class="row wrap mock-check-filters"><label class="check-label"><input id="mock-pending-only" type="checkbox" ${pendingOnly?'checked':''}>Pending only <span class="mock-count">${pending}</span></label><select id="mock-who" aria-label="Filter confirmations by person"><option value="everyone">Everyone</option><option value="mine" ${who==='mine'?'selected':''}>Needs my confirmation</option><option value="waiting" ${who==='waiting'?'selected':''}>Waiting for someone else</option></select></div>`:`<small class="muted">${pending} pending · Slide comments included</small>`}</div>`;
    const heading=`<div class="section-title mock-section-title"><div><h2>Communication</h2><p class="muted">Discuss the details. Ask for a go-ahead. Keep the answer here.</p></div></div>${controls}`;
    if(view==='confirmations'){
      const matches=visibleRequests().filter(r=>(!pendingOnly||r.status==='pending')&&(who!=='mine'||r.status==='pending'&&r.to===demo.role)&&(who!=='waiting'||r.status==='pending'&&r.from===demo.role&&r.to!==demo.role)).sort((a,b)=>(a.status==='pending'?0:1)-(b.status==='pending'?0:1)||new Date(b.created)-new Date(a.created));
      return heading+`<div class="mock-checklist">${matches.map(r=>confirmationCard(r,true)).join('')||'<div class="notice">No confirmations match this view. Try showing all confirmations.</div>'}</div>`;
    }
    return heading+`<div class="mock-hub"><aside class="mock-topic-list"><div class="mock-topic-heading">Conversations <small>${list.length}</small></div>${list.map(t=>{const count=projectRequests().filter(r=>r.thread===t.id&&r.status==='pending').length;return `<button class="mock-topic ${t.id===thread?'selected':''}" data-action="mock-thread" data-thread="${esc(t.id)}" aria-pressed="${t.id===thread}"><small>${esc(t.label)}</small><strong>${esc(t.title)}</strong><span>${count?`<i class="mock-pending-dot"></i>${count} pending confirmation${count===1?'':'s'}`:t.id==='internal'?'Studio team only':t.source?'Comments & replies':'Everyone is up to date'}</span></button>`;}).join('')}</aside><section class="mock-thread"><header class="mock-thread-head"><div><h2>${esc(topic.title)}</h2><p class="muted">${icon(thread==='internal'?'lock':'users')}${topic.scope}</p></div>${thread==='internal'?'<span class="tag">Internal</span>':''}</header>${sourceContext(topic)}<div class="mock-messages">${entries(thread).map(m=>m.confirmation?confirmationCard(m):messageCard(m)).join('')}</div><form id="mock-reply-form" class="mock-composer">${replyTo?`<div class="mock-replying">Replying to a confirmation ${btn('Cancel','cancel-reply','small ghost')}</div>`:''}<label for="mock-reply">Message<textarea id="mock-reply" required maxlength="1500" rows="3" placeholder="Add a thought, ask a question, or confirm a detail…">${esc(drafts[thread]||'')}</textarea></label><div class="mock-compose-actions"><small class="muted">${thread==='internal'?'Visible to the studio team':'Shared with Emma, Sophie & Thomas'}</small><div class="row wrap"><button class="button" type="submit">Post reply ${icon('send')}</button>${btn('Ask for confirmation','ask','primary','','check')}</div></div></form></section></div>`;
  }
  function recipients(amount){return Object.entries(people).filter(([role,p])=>role!==demo.role&&(requestDraft.thread!=='internal'||role==='studio')&&(amount===null||p.budget));}
  function requestPopup(text=''){
    if(thread==='internal'){toast('This demo’s internal thread has only Sophie. Choose a shared conversation to ask another person.');return;}
    requestDraft={thread,text,attachment:null};
    openModal('Ask for confirmation',`<form id="mock-confirmation-form"><label for="mock-request-text">Message<textarea id="mock-request-text" required maxlength="1500" rows="3" placeholder="Please confirm the paint colour for the hallway…">${esc(text)}</textarea></label><label for="mock-recipient">Confirm with<select id="mock-recipient" required>${recipients(null).map(([r,p])=>`<option value="${r}" ${r===(demo.role==='client'?'studio':'client')?'selected':''}>${p.name} · ${p.role}</option>`).join('')}</select></label><details class="mock-attach-details"><summary>${icon('file')}Attach a file <span class="muted">optional</span></summary><div class="mock-attach-fields"><label for="mock-existing-file">Choose a project file<select id="mock-existing-file"><option value="">No file attached</option>${(state.data.files||[]).map(f=>`<option value="${esc(f.id)}">${esc(f.name)} · V${f.number||1}</option>`).join('')}</select></label><label class="mock-upload-label" for="mock-upload">${icon('upload')} Or upload and link a file<input id="mock-upload" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp"></label><small class="form-hint">Images or PDF, up to 2 MB. Preview preparation is simulated; files stay in this demo.</small><div id="mock-upload-status" role="status"></div></div></details><div class="mock-cost-option"><label class="check-label"><input id="mock-has-cost" type="checkbox">Include a budget change</label><div id="mock-cost-fields" hidden><div class="mock-cost-label"><label for="mock-cost">Budget change (€) · including VAT</label><span class="mock-tooltip-wrap"><button class="mock-help" type="button" aria-label="About positive and negative budget changes" aria-describedby="mock-cost-help">${icon('help')}</button><span id="mock-cost-help" class="mock-tooltip" role="tooltip">Use a positive amount for extra cost (1000), or a negative amount for a cheaper option (−250). Enter the change, not the new total.</span></span></div><input id="mock-cost" type="text" inputmode="decimal" placeholder="e.g. 1000 or -250" maxlength="12" aria-describedby="mock-cost-help"><small class="form-hint">Added to the budget only after confirmation.</small></div></div><p id="mock-request-error" class="form-error" role="alert" hidden></p><div class="modal-footer">${button('Cancel','close-modal','ghost')}<button type="submit" id="mock-send-request" class="button primary">Send confirmation request ${icon('send')}</button></div></form>`);
  }
  function parseAmount(value){const s=value.trim().replace(/[−–]/g,'-').replace(',','.');if(!/^[+-]?\d{1,7}(\.\d{1,2})?$/.test(s))return null;const negative=s[0]==='-';const [whole,frac='']=s.replace(/^[+-]/,'').split('.');return (negative?-1:1)*(Number(whole)*100+Number(frac.padEnd(2,'0')));}
  function amountFields(){const enabled=$('#mock-has-cost').checked;$('#mock-cost-fields').hidden=!enabled;$('#mock-cost').required=enabled;const selected=$('#mock-recipient').value;$('#mock-recipient').innerHTML=recipients(enabled?0:null).map(([r,p])=>`<option value="${r}" ${r===selected?'selected':''}>${p.name} · ${p.role}</option>`).join('');if(enabled)$('#mock-cost').focus();}
  function afterRender(){
    demo.ui={thread,view,pendingOnly,who};save();
    const top=$('.demo-indicator');if(top){top.innerHTML='Concept demo '+icon('help');top.dataset.action='mock-about';}
    const nav=$('.tabs'),active=nav?.querySelector('.tab.active');if(active){const n=nav.getBoundingClientRect(),a=active.getBoundingClientRect();if(a.left<n.left||a.right>n.right)nav.scrollLeft+=a.left-n.left-16;}
    const globalComments=$('[data-action="all-comments"] .side-link-label');if(globalComments)globalComments.textContent='Communication';
    for(const r of projectRequests().filter(r=>r.status==='confirmed'&&r.amount!==null)){
      const row=document.querySelector(`[data-budget-row="confirmation-${CSS.escape(r.id)}"]`);
      if(row&&!row.querySelector('[data-action="mock-open-request"]'))row.insertAdjacentHTML('beforeend',`<div class="mock-budget-source">${icon('check')} Confirmed by ${people[r.to].name} ${btn('View confirmation','open-request','small ghost',`data-id="${esc(r.id)}"`,'arrow')}</div>`);
    }
    if(highlight){const card=document.querySelector(`[data-confirmation="${CSS.escape(highlight)}"]`);if(card)requestAnimationFrame(()=>card.scrollIntoView({block:'center',behavior:'instant'}));}
  }
  function openRequest(id){const r=projectRequests().find(r=>r.id===id&&allowedThread(r.thread));if(!r)return;thread=r.thread;view='all';highlight=id;go('comments');}
  function previewAttachment(owner){const item=[...demo.requests,...demo.messages].find(m=>m.id===owner);const a=item?.attachment;if(!a)return;const url=attachmentUrl(a);openModal(esc(a.name),`${a.mime?.startsWith('image/')&&url?`<img class="mock-modal-image" src="${esc(url)}" alt="${esc(a.name)}">`:`<div class="mock-document-preview">${icon('file')}<strong>${esc(a.name)}</strong><p>Linked original · Version ${a.number}</p></div>`}<p class="form-hint">This exact file version stays attached to the message.</p>${url?`<div class="modal-footer"><a class="button primary" href="${esc(url)}" download="${esc(a.name)}">${icon('download')}Download original</a></div>`:'<p class="notice">This temporary file is no longer available in this browser session.</p>'}`);}
  async function handleUpload(input){
    const file=input.files?.[0];if(!file)return;const status=$('#mock-upload-status'),submit=$('#mock-send-request');
    if(file.size>2*1024*1024||! /\.(pdf|png|jpe?g|webp)$/i.test(file.name)){status.textContent='Choose an image or PDF up to 2 MB.';input.value='';return;}
    if(demo.uploads.reduce((sum,f)=>sum+f.size,0)+file.size>3*1024*1024){status.textContent='This demo stores up to 3 MB of attachments. Reset it or choose a project file.';return;}
    const draft=requestDraft;submit.disabled=true;status.textContent='Adding file…';
    try{
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
      const upload={id:'mock-upload-'+uid(),project:currentProject(),iteration:state.data.iteration.id,name:file.name,mime:file.type||(/\.pdf$/i.test(file.name)?'application/pdf':'image/'+file.name.split('.').pop()),size:file.size,data,readyAt:Date.now()+1600};demo.uploads.push(upload);save();syncMockAdditions([],uploadFiles());
      const f=uploadFiles().find(f=>f.id===upload.id);if(!state.data.files.some(existing=>existing.id===f.id))state.data.files.push(f);
      if(requestDraft===draft&&$('#mock-confirmation-form')){const select=$('#mock-existing-file');select.add(new Option(file.name+' · V1',f.id));select.value=f.id;requestDraft.attachment=fileSnapshot(f);status.textContent='Linked · preparing preview…';}
      setTimeout(()=>{if(requestDraft===draft&&$('#mock-upload-status'))$('#mock-upload-status').textContent='Linked · demo preview ready';document.querySelectorAll('.mock-attachment small').forEach(el=>{el.textContent=el.textContent.replace(' · Preparing preview…','');});},1700);
    }catch{if(status.isConnected)status.textContent='Could not read this file. Please try another.';}finally{if(submit.isConnected)submit.disabled=false;}
  }
  async function confirmRequest(id){
    const r=projectRequests().find(r=>r.id===id);if(!r||r.status!=='pending'||r.to!==demo.role||!allowedThread(r.thread))return;
    if(r.amount!==null&&!people[demo.role].budget)return;
    r.status='confirmed';r.confirmedAt=new Date().toISOString();record(`Confirmed: ${r.text}${r.amount!==null?' Budget change '+signed(r.amount)+' (including VAT) added.':''}`);beforeRequest('project',{});highlight=r.id;await refresh(true);toast(r.amount!==null?`Confirmed. ${signed(r.amount)} added to the budget.`:'Confirmation recorded.');
  }
  document.addEventListener('click',async e=>{
    const target=e.target.closest('[data-action]');if(!target)return;let action=target.dataset.action;
    if(['cost','edit-cost'].includes(action)&&target.dataset.id?.startsWith('confirmation-')){e.preventDefault();e.stopImmediatePropagation();openRequest(target.dataset.id.slice(13));return;}
    if(['all-comments','all-activity'].includes(action)&&state.data){e.preventDefault();e.stopImmediatePropagation();go(action==='all-comments'?'comments':'activity');return;}
    if(!action.startsWith('mock-'))return;e.preventDefault();e.stopImmediatePropagation();action=action.slice(5);
    try{
      if(action==='communication'){view='all';highlight=null;go('comments');}
      if(action==='thread'){thread=target.dataset.thread;replyTo=null;highlight=null;render();}
      if(action==='view'){view=target.dataset.view;highlight=null;render();}
      if(action==='ask')requestPopup(drafts[thread]||'');
      if(action==='ask-existing'){const m=entries(thread).find(m=>m.id===target.dataset.message);if(m)requestPopup(m.text);}
      if(action==='confirm')await confirmRequest(target.dataset.id);
      if(action==='open-request')openRequest(target.dataset.id);
      if(action==='reply-to'){const r=projectRequests().find(r=>r.id===target.dataset.id);if(r){thread=r.thread;view='all';replyTo=r.id;highlight=null;go('comments');$('#mock-reply')?.focus();}}
      if(action==='cancel-reply'){replyTo=null;render();}
      if(action==='withdraw'){const r=projectRequests().find(r=>r.id===target.dataset.id);if(r&&r.from===demo.role&&r.status==='pending'){openModal('Withdraw this request?',`<p>${esc(r.text)}</p><p class="form-hint">It will remain in the conversation as withdrawn. The budget will not change.</p><div class="modal-footer">${button('Keep request','close-modal','ghost')}${btn('Withdraw request','confirm-withdraw','primary',`data-id="${esc(r.id)}"`)}</div>`);}}
      if(action==='confirm-withdraw'){const r=projectRequests().find(r=>r.id===target.dataset.id);if(r&&r.status==='pending'&&r.from===demo.role){r.status='withdrawn';r.withdrawnAt=new Date().toISOString();record('Withdrew confirmation request: '+r.text);closeModal();render();}}
      if(action==='file')previewAttachment(target.dataset.owner);
      if(action==='source'){const topic=topicFor(target.dataset.thread),def=findSource(topic.source);if(def)startPresentation(slideDefs().findIndex(s=>s.id===def.id));}
      if(action==='budget-link'){highlight=null;go('budget');const row=document.querySelector(`[data-budget-row="confirmation-${CSS.escape(target.dataset.id)}"]`);row?.scrollIntoView({block:'center'});}
      if(action==='reset')openModal('Reset the mock?',`<p>Clear the demo replies, uploaded files, confirmations, and budget changes.</p><div class="modal-footer">${button('Cancel','close-modal','ghost')}${btn('Reset demo','confirm-reset','primary','','history')}</div>`);
      if(action==='confirm-reset'){sessionStorage.removeItem(storageKey);location.assign('/mock#comments');location.reload();}
      if(action==='about')openModal('Communication, with a simple go-ahead.',`<p>Post a reply or ask someone to confirm a message. You can attach a file and optionally include a positive or negative budget change.</p><p class="notice">Use “View as” to try both sides. All data, uploads, and confirmations are local to this fictional mock.</p>`);
    }catch(error){toast(error.message||'This demo action could not be completed.');}
  },true);
  document.addEventListener('input',e=>{if(e.target.id==='mock-reply')drafts[thread]=e.target.value;},true);
  document.addEventListener('change',e=>{
    if(e.target.id==='mock-role'){demo.role=e.target.value;highlight=null;if(!allowedThread(thread))thread='paint';save();render();}
    if(e.target.id==='mock-pending-only'){pendingOnly=e.target.checked;render();}
    if(e.target.id==='mock-who'){who=e.target.value;render();}
    if(e.target.id==='mock-has-cost')amountFields();
    if(e.target.id==='mock-existing-file'){const f=state.data.files.find(f=>f.id===e.target.value);requestDraft.attachment=f?fileSnapshot(f):null;}
    if(e.target.id==='mock-upload')handleUpload(e.target);
  },true);
  document.addEventListener('submit',async e=>{
    if(!e.target.id.startsWith('mock-'))return;e.preventDefault();e.stopImmediatePropagation();
    try{
      if(e.target.id==='mock-reply-form'){
        const text=$('#mock-reply').value.trim();if(!text)return;
        const topic=topicFor(thread),root=topic.source;
        if(root&&(state.data.comments||[]).some(c=>c.id===root.id)){await api('comment',{iteration:state.data.iteration.id,slide:root.slide,parent_id:root.id,body:text});}
        else demo.messages.push({id:uid(),thread,project:currentProject(),role:demo.role,text,created:new Date().toISOString(),replyTo});
        drafts[thread]='';replyTo=null;highlight=null;save();await refresh(true);$('#mock-reply')?.focus();toast('Reply posted.');
      }
      if(e.target.id==='mock-confirmation-form'){
        const text=$('#mock-request-text').value.trim(),to=$('#mock-recipient').value,hasCost=$('#mock-has-cost').checked,amount=hasCost?parseAmount($('#mock-cost').value):null;
        if(hasCost&&amount===null){$('#mock-request-error').hidden=false;$('#mock-request-error').textContent='Enter an amount such as 1000, -250, or -250.50.';$('#mock-cost').focus();return;}
        if(!text||!people[to]||to===demo.role||hasCost&&!people[to].budget)return;
        const r={id:uid(),thread:requestDraft.thread,text,from:demo.role,to,amount,status:'pending',created:new Date().toISOString(),project:currentProject(),iteration:state.data.iteration.id,attachment:requestDraft.attachment};
        demo.requests.push(r);record(`Asked ${people[to].name} to confirm: ${text}`,'confirmation_requested');drafts[thread]='';thread=r.thread;highlight=r.id;view='all';requestDraft=null;closeModal();render();toast('Confirmation requested.');
      }
    }catch(error){toast(error.message||'Could not save this demo message.');}
  },true);
  return {beforeRequest,enrich,toolbar,overviewPanel,communication,afterRender,readTab,syncUrl,restoreRoute,pendingCount};
}
