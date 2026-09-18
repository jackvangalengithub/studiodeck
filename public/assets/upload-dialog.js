import {tr} from './i18n.js';
import {uploadSelectionError} from './upload-limits.js';
const accepted='.pdf,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp';
export function uploadDialog({api,state,esc,button,icon,openModal,closeModal,toast,onComputer,onDrive,onCancel}){
 let view=null,popup=null,request=0;
 const active=()=>!!view&&!!document.querySelector('[data-upload-dialog]');
 function tabs(){return `<div class="upload-source-tabs" role="tablist" aria-label="${tr("studio_file_source")}">${[['computer',tr("studio_from_my_computer")],['drive',tr("studio_from_google_drive")]].map(([id,text])=>`<button type="button" role="tab" id="upload-tab-${id}" aria-controls="upload-source-panel" aria-selected="${view.tab===id}" tabindex="${view.tab===id?0:-1}" data-action="upload-source" data-tab="${id}">${text}</button>`).join('')}</div>`;}
 function paint(){
  if(!view)return;
  const computer=`<div class="dropzone upload-computer-drop" data-computer-drop><button class="wizard-file-picker" type="button" data-action="upload-browse">${icon('upload')}<strong>${tr("studio_drop_your_files_here_or_browse")}</strong><span>${tr("studio_pdf_powerpoint_excel_csv_images")}</span><small>${tr("studio_up_to_100_mb_per_file_120_mb_per_batch_20_files")}</small></button><input type="file" id="upload-computer-input" accept="${accepted}" ${view.options.asset?'':'multiple'} hidden></div><div class="upload-selected-list">${view.local.map((f,n)=>`<div class="wizard-file-row">${icon('file')}<span><strong>${esc(f.name)}</strong><small>${formatSize(f.size)}</small></span>${button(tr("studio_remove_2"),'upload-remove-local','small ghost',`data-index="${n}"`)}</div>`).join('')}</div><div class="modal-footer">${button(view.options.chooseOnly?tr("studio_back"):tr("cancel"),'upload-cancel','ghost')}<button class="button primary" type="button" data-action="upload-add-local" ${view.local.length?'':'disabled'}>${view.options.chooseOnly?tr("studio_use_selected_files"):tr("studio_add_to_project")}</button></div>`;
  openModal(view.options.asset?tr("studio_replace_file"):tr("studio_upload_files"),`<div data-upload-dialog>${tabs()}<div id="upload-source-panel" role="tabpanel" aria-labelledby="upload-tab-${view.tab}" ${view.loading?'aria-busy="true"':''}>${view.error?`<p class="form-error" role="alert">${esc(view.error)}</p>`:''}${view.tab==='computer'?computer:drivePanel()}</div></div>`,true);
  if(view.busy)document.querySelectorAll('.modal button,.modal input').forEach(el=>el.disabled=true);
 }
 function formatSize(size){return size?`${(size/1024/1024).toFixed(1)} MB`:tr("studio_size_available_after_export");}
 function drivePanel(){
  if(!view.status)return `<p class="upload-loading" role="status">${tr("studio_checking_your_google_drive_connection")}</p>`;
  if(!view.status.connected)return `<div class="drive-connect"><span class="drive-mark">${icon('file')}</span><h3>${tr("studio_bring_your_drive_files_into_this_project")}</h3><p>${tr("studio_connect_your_account_open_a_folder_and_choose_the_files_to_import")}</p><p class="form-hint">${tr("studio_google_will_ask_for_read_only_drive_access_so_you_can_browse_folders_only_the_files_you_select_are_c")}</p>${button(tr("studio_connect_google_drive"),'drive-connect','primary',view.status.configured&&!view.connecting?'':'disabled')}${!view.status.configured?`<p class="notice">${tr("studio_google_drive_is_not_configured_for_this_studiodeck_installation_yet_ask_your_administrator_to_comple")}</p>`:''}${view.connecting?`<p class="form-hint" role="status">${tr("studio_complete_the_connection_in_the_google_window_then_return_here")}</p>`:''}${button(tr("studio_check_connection"),'drive-refresh','small ghost')}</div>`;
  return `<div class="drive-account"><span>${tr("studio_connected",{v0:view.status.email?` ${tr("studio_as")} <strong>`+esc(view.status.email)+'</strong>':''})}</span>${button(tr("studio_disconnect"),'drive-disconnect','small ghost')}</div><form data-form="drive-folder" class="drive-folder-form"><label>${tr("studio_open_a_specific_folder")}<input name="folder" placeholder="${tr("studio_paste_a_google_drive_folder_link_or_id")}" required></label><button class="button small" type="submit">${tr("studio_open_folder")}</button></form><div class="drive-folder-heading"><nav aria-label="${tr("studio_drive_folder_path")}">${view.path.map((p,n)=>`<button type="button" data-action="drive-crumb" data-index="${n}" ${n===view.path.length-1?'aria-current="location"':''}>${esc(p.name)}</button>`).join('<span aria-hidden="true">/</span>')}</nav>${button(tr("studio_my_drive"),'drive-root','small ghost')}</div>${view.loading?`<p class="upload-loading" role="status">${tr("studio_loading_folder")}</p>`:`<div class="drive-files" aria-label="${tr("studio_files_in_this_folder")}">${view.items.map(f=>f.folder?`<button type="button" class="drive-folder-row" data-action="drive-open-folder" data-id="${esc(f.id)}">${icon('folder')}<span>${esc(f.name)}<small>${tr("studio_open_folder")}</small></span>${icon('right')}</button>`:`<label class="drive-file-row ${f.selectable?'':'unavailable'}"><input type="checkbox" data-drive-file="${esc(f.id)}" ${view.selected.has(f.id)?'checked':''} ${f.selectable?'':'disabled'}><span>${esc(f.name)}<small>${f.selectable?(f.export?`${tr("studio_imports_as")} `+f.export.toUpperCase()+' · ':'')+formatSize(f.size):tr("studio_not_available_for_import_unsupported_restricted_or_too_large")}</small></span></label>`).join('')||`<p class="muted">${tr("studio_this_folder_is_empty_open_another_folder_or_paste_a_folder_link")}</p>`}</div>${view.next?button(tr("studio_load_more"),'drive-more','small ghost'):''}`}${view.incomplete?`<p class="form-hint">${tr("studio_google_returned_a_partial_folder_listing_try_opening_a_specific_folder_using_its_link")}</p>`:''}<p class="form-hint">${tr("studio_choose_files_from_this_folder_opening_another_folder_clears_the_selection_folders_themselves_are_nev")}</p><div class="modal-footer"><span data-drive-count>${tr("studio_selected",{v6:view.selected.size})}</span>${button(view.options.chooseOnly?tr("studio_back"):tr("cancel"),'upload-cancel','ghost')}<button type="button" class="button primary" data-action="drive-add" ${view.selected.size&&!view.loading?'':'disabled'}>${view.busy?tr("studio_importing_from_drive"):view.options.chooseOnly?tr("studio_use_selected_files"):tr("studio_add_to_project")}</button></div>`;
 }
 function open(options={}){request++;view={options,tab:options.tab||'computer',local:[],status:null,items:[],selected:new Map(),path:[],folder:'root',next:'',loading:false,busy:false,error:'',connecting:false};paint();if(view.tab==='drive')loadStatus().catch(error);}
 function error(e){if(!active())return;view.loading=false;view.busy=false;view.error=e.message;paint();}
 async function loadStatus(){const v=view,seq=++request;const status=await api('drive_status');if(view!==v||seq!==request||!active())return;view.status=status;view.error='';paint();if(status.connected)await loadFolder(view.folder||'root',false,view.path);}
 async function loadFolder(id,more=false,path=null){
  const v=view,seq=++request;view.loading=true;view.error='';paint();
  try{const data=await api('drive_list',{folder:id,page:more?view.next:''});if(view!==v||seq!==request||!active())return;
   view.folder=data.folder.id;view.items=more?[...view.items,...data.items.filter(f=>!view.items.some(old=>old.id===f.id))]:data.items;view.next=data.next_page;view.incomplete=data.incomplete;
   if(!more){view.selected.clear();view.path=path?.length?[...path.slice(0,-1),data.folder]:[data.folder];}view.loading=false;paint();
  }catch(e){if(view===v&&seq===request){error(e);if(/connect|expired/i.test(e.message)){view.status.connected=false;paint();}}}
 }
 function localFiles(files){
  if(view.busy)return;const next=[...view.local];for(const f of files)if(!next.some(x=>x.name===f.name&&x.size===f.size&&x.lastModified===f.lastModified))next.push(f);
  const bad=next.find(f=>!(/\.(pdf|pptx?|xlsx?|csv|jpe?g|png|webp)$/i.test(f.name)));
  const problem=view.options.asset&&next.length>1?tr("studio_choose_one_replacement_file"):bad?tr("studio_choose_pdf_powerpoint_excel_csv_or_image_files"):uploadSelectionError(next);
  if(problem){view.error=problem;paint();return;}view.local=next;view.error='';paint();
 }
 async function action(a,el){
  if(!active())return;
  if(a==='upload-cancel'){if(view.options.chooseOnly)onCancel();else closeModal();}
  if(a==='upload-source'){if(view.busy)return;view.tab=el.dataset.tab;view.error='';paint();if(view.tab==='drive'&&!view.status)await loadStatus();document.querySelector(`#upload-tab-${view.tab}`)?.focus();}
  if(a==='upload-browse')document.getElementById('upload-computer-input')?.click();
  if(a==='upload-remove-local'){view.local.splice(Number(el.dataset.index),1);paint();}
  if(a==='upload-add-local'){const v=view;view.busy=true;paint();try{await onComputer(v.local,v.options);}catch(e){if(view===v)error(e);throw e;}}
  if(a==='drive-refresh')await loadStatus();
  if(a==='drive-connect'){
   // Open synchronously to avoid browser popup blocking after the API request.
   popup=window.open('about:blank','studiodeck-google-drive','popup,width=580,height=720');if(!popup)throw Error(tr("studio_allow_popups_for_studiodeck_then_try_connecting_again"));
   view.connecting=true;view.error='';paint();try{const r=await api('drive_connect');popup.location.href=r.url;const v=view,win=popup;const timer=setInterval(()=>{if(!active()||view!==v||popup!==win||!v.connecting){clearInterval(timer);return;}if(win.closed){clearInterval(timer);view.connecting=false;loadStatus().catch(error);}},500);}catch(e){popup.close();view.connecting=false;throw e;}
  }
  if(a==='drive-disconnect'){await api('drive_disconnect',{});view.status.connected=false;view.items=[];view.selected.clear();view.folder='root';view.path=[];paint();}
  if(a==='drive-root')await loadFolder('root');
  if(a==='drive-crumb'){const n=Number(el.dataset.index);await loadFolder(view.path[n].id,false,view.path.slice(0,n+1));}
  if(a==='drive-open-folder'){const f=view.items.find(f=>f.id===el.dataset.id&&f.folder);if(f)await loadFolder(f.id,false,[...view.path,{id:f.id,name:f.name}]);}
  if(a==='drive-more')await loadFolder(view.folder,true);
  if(a==='drive-add'){
   if(!view.selected.size||view.busy)return;const files=[...view.selected.values()],problem=uploadSelectionError(files);if(problem)throw Error(problem);if(view.options.asset&&files.length!==1)throw Error(tr("studio_choose_one_replacement_file"));
   const v=view;view.busy=true;view.error='';paint();try{await onDrive({folder:v.folder,files:files.map(f=>f.id),names:files.map(f=>f.name)},v.options);}catch(e){if(view===v)error(e);throw e;}
  }
 }
 async function submit(form){const input=new FormData(form).get('folder').trim();let id=input;
  if(/^https?:/i.test(input)){let url;try{url=new URL(input);}catch{throw Error(tr("studio_paste_a_valid_google_drive_folder_link"));}if(url.hostname!=='drive.google.com')throw Error(tr("studio_use_a_folder_link_from_drive_google_com"));id=url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/)?.[1]||'';}
  if(!/^[a-zA-Z0-9_-]+$/.test(id))throw Error(tr("studio_paste_a_google_drive_folder_link_or_folder_id"));await loadFolder(id);
 }
 document.addEventListener('change',e=>{if(!active())return;if(e.target.id==='upload-computer-input')localFiles([...e.target.files]);if(e.target.matches('[data-drive-file]')){const f=view.items.find(f=>f.id===e.target.dataset.driveFile);if(!f?.selectable||f.folder)return;const next=new Map(view.selected);if(e.target.checked)next.set(f.id,f);else next.delete(f.id);const problem=view.options.asset&&next.size>1?tr("studio_choose_one_replacement_file"):uploadSelectionError([...next.values()]);if(problem){e.target.checked=false;toast(problem);return;}view.selected=next;document.querySelector('[data-drive-count]').textContent=next.size+' selected';document.querySelector('[data-action=drive-add]').disabled=!next.size;}});
 document.addEventListener('dragover',e=>{const zone=e.target.closest('[data-computer-drop]');if(zone){e.preventDefault();zone.classList.add('dragging');}});
 document.addEventListener('dragleave',e=>e.target.closest('[data-computer-drop]')?.classList.remove('dragging'));
 document.addEventListener('drop',e=>{if(e.target.closest('[data-computer-drop]')&&active()){e.preventDefault();localFiles([...e.dataTransfer.files]);}});
 document.addEventListener('keydown',e=>{if(!e.target.matches('[role=tab][data-action=upload-source]')||!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||!active())return;e.preventDefault();action('upload-source',{dataset:{tab:e.key==='Home'?'computer':e.key==='End'?'drive':view.tab==='computer'?'drive':'computer'}}).catch(error);});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==popup||e.data?.type!=='studiodeck-drive'||!active())return;view.connecting=false;if(!e.data.ok){view.error=e.data.message;paint();return;}loadStatus().catch(error);});
 return {open,action,submit,busy:()=>active()&&view.busy};
}
