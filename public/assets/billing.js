import {tr,getLanguage} from './i18n.js';
export function billingUi({state,api,esc,button,openModal,closeModal,render,applySession,resetStudio,toast,isModalOpen,resourceHeaders,resumeAccess=async()=>false,hasIntent=()=>false,purchaseStarted=()=>{},createProject=async()=>{}}){
  const date=t=>t?new Date(Number(t)*1000).toLocaleString(getLanguage()==='nl'?'nl-NL':undefined,{dateStyle:'medium',timeStyle:'short'}):'—';
  const money=(n,c='eur')=>new Intl.NumberFormat(getLanguage()==='nl'?'nl-NL':undefined,{style:'currency',currency:c.toUpperCase()}).format(n/100);
  const monthly=(plan,projects=0,seats=0)=>({base:Number(plan.cents),projects:Number(projects)*1000,seats:Number(seats)*2000,total:Number(plan.cents)+Number(projects)*1000+Number(seats)*2000});
  const priceText=(plan,projects=0,seats=0)=>money(monthly(plan,projects,seats).total);
  const selectedPlan=()=>current?.summary.plan&&!['canceled','incomplete_expired','none'].includes(current.summary.status)?current.summary.plan:null;
  const source=s=>({get trial(){return tr("studio_trial");},get project_pass(){return tr("studio_project_pass");},get subscription(){return tr("studio_subscription");},get legacy(){return tr("studio_existing_studio");},get none(){return tr("studio_awaiting_purchase");}}[s]||s);
  const admin=()=>state.studio?.role==='admin';
  const submit=label=>`<div class="modal-footer">${button(tr("cancel"),'close-modal')}<button type="submit" class="button primary">${label}</button></div>`;
  let drafts={},current=null,invoices=null,invoiceError='',poll=null,checkoutNotice='';
  async function load(){
    if(!admin())throw Error(tr("studio_only_studio_admins_can_view_billing"));
    const sid=state.studio.id;current=await api('billing');if(state.studio.id!==sid)return;
    state.billing=current.summary;drafts={};invoices=null;invoiceError='';
    try{invoices=(await api('billing_invoices')).invoices;}catch(e){invoiceError=e.message;}
  }
  async function open(){closeModal();state.settingsOpen=false;state.present=false;state.tab='billing';await load();render();}
  function page(){
    if(!admin())return `<p class="notice">${tr("studio_only_studio_admins_can_view_billing")}</p>`;
    if(!current)return `<p role="status">${tr("studio_loading_billing")}</p>`;
    const b=current.summary,c=current.catalog;
    return `<div class="project-head"><h1>${tr("studio_billing_2")}</h1><div class="row billing-actions">${button(tr("studio_refresh"),'billing-refresh','','','history')}${current.has_customer?button(tr("studio_manage_payments"),'billing-portal','primary','','budget'):''}</div></div>
      ${hasIntent()?`<div class="notice billing-notice"><span>${tr("studio_your_project_action_is_saved_after_payment_continue_to_recheck_access_and_available_slots")}</span>${button(tr("studio_continue_to_project"),'billing-refresh','primary')}</div>`:''}
      ${checkoutNotice?`<p class="notice" role="status">${esc(checkoutNotice)}</p>`:''}
      ${b.legacy_exempt?`<p class="notice">${tr('billing_legacy_access_explanation')}</p>`:''}
      ${b.status==='past_due'?`<p class="notice" role="alert">${tr("studio_your_renewal_payment_needs_attention_editing_pauses_three_days_after_your_paid_period_ends_update_yo")}</p>`:''}
      ${current.orders.filter(o=>o.status==='pending'||o.error).map(o=>`<div class="notice billing-notice"><span>${esc(c[o.plan]?.name||current.addons?.find(a=>a.id===o.plan)?.name||o.plan)} · ${esc(o.error||tr("studio_checkout_pending_access_changes_only_after_payment_is_confirmed"))}</span>${o.status==='pending'?`${button(tr("studio_resume"),'billing-resume','small',`data-id="${esc(o.id)}"`)}${button(tr("studio_cancel_checkout"),'billing-cancel-checkout','small',`data-id="${esc(o.id)}"`)}`:''}</div>`).join('')}
      ${current.changes.map(x=>`<div class="notice billing-notice"><span>${esc(c[x.plan].name)} · ${esc(tr('billing_change_'+x.status))} · ${date(x.effective_at)}</span>${x.status==='scheduled'?button(tr("studio_cancel_change"),'billing-cancel-change','small',`data-id="${esc(x.id)}"`):x.invoice_url?`<a class="button small" href="${esc(x.invoice_url)}" target="_blank" rel="noopener">${tr("studio_complete_payment")}</a>`:button(tr("studio_resume_change"),'billing-confirm-change','small',`data-id="${esc(x.id)}"`)}</div>`).join('')}
      <section class="billing-section"><div class="billing-offers"><section class="billing-pass-group billing-offer-group" aria-labelledby="billing-pass-title"><header class="billing-group-heading"><p class="billing-eyebrow">${tr("billing_pass_eyebrow")}</p><h2 id="billing-pass-title">${tr("billing_pass_title")}</h2><p class="muted">${tr("billing_pass_description")}</p></header><article class="billing-plan billing-pass-card"><h3>${tr('studio_project_pass')}</h3><p class="billing-price">${money(c.pass.cents??1900)}<small> ${tr('billing_one_time')}</small></p><p>${tr('billing_pass_new_project')}</p><p class="muted">${tr('billing_pass_activation')}</p><p class="muted">${tr('billing_pass_images')}</p>${b.available_passes?`<p class="notice">${tr('billing_available_passes',{count:b.available_passes})}</p>`:''}<div class="billing-plan-actions">${button(tr('billing_go_to_checkout'),'billing-new-pass',b.available_passes?'small':'primary',c.pass.available?'':'disabled','cart')}${b.available_passes?button(tr('billing_create_with_pass'),'billing-use-pass','primary'):''}</div></article></section><section class="billing-package-group billing-offer-group" aria-labelledby="billing-subscriptions-title"><header class="billing-group-heading"><p class="billing-eyebrow">${tr("billing_monthly_eyebrow")}</p><h2 id="billing-subscriptions-title">${tr("billing_subscriptions_title")}</h2><p class="muted">${tr("billing_subscriptions_description")}</p></header><div class="billing-plans">${['solo','studio','practice'].map(key=>{
        const p=c[key],selected=selectedPlan()===key,draft=planDraft(key);
        return `<article class="billing-plan ${selected?'is-selected':''}" data-package="${key}" ${selected?'aria-label="'+esc(tr('billing_selected_package',{plan:p.name}))+'"':''}><div class="billing-plan-heading"><h3>${esc(p.name)}</h3>${selected?`<span class="billing-selected-badge">✓ ${tr('billing_selected')}</span>`:''}</div><p class="billing-price" aria-live="polite"><span data-package-total>${priceText(p,draft.projects-p.projects,draft.seats-p.seats)}</span><small> ${tr("studio_month_2")}</small></p><form data-form="billing-plan-column"><input type="hidden" name="plan" value="${key}"><div class="billing-capacity-controls">${capacityControl(key,'projects',p.projects,draft.projects)}${key==='solo'?'<input type="hidden" name="seats" value="1">':capacityControl(key,'seats',p.seats,draft.seats)}</div></form><p class="muted">${tr("studio_10_image_enhancements_per_project_per_calendar_month")}</p><p class="muted">${tr("billing_website_included")}</p><div class="billing-plan-actions">${selected?`${button(tr('studio_adjust_capacity'),'billing-plan','small billing-adjust',`data-plan="${key}"`)}<button type="button" class="button billing-current-button" disabled>${tr('studio_current_package')}</button>`:button(tr("billing_go_to_checkout"),'billing-plan','primary',`data-plan="${key}" ${p.available?'':'disabled'}`,'cart')}</div></article>`;
      }).join('')}</div></section></div><p class="form-hint">${tr('billing_price_note')}</p>${!c.pass.available?`<p class="notice">${tr("studio_checkout_will_be_available_once_the_studio_s_payment_connection_is_configured")}</p>`:''}</section>
      <section class="billing-section"><h2>${tr("studio_invoices")}</h2>${invoiceError?`<p class="notice">${esc(invoiceError)}</p>`:`<div class="billing-table-wrap"><table class="billing-table"><thead><tr><th>${tr("studio_date")}</th><th>${tr("studio_invoice")}</th><th>${tr("studio_amount")}</th><th>${tr("studio_status")}</th><th>${tr("download")}</th></tr></thead><tbody>${(invoices||[]).map(i=>`<tr><td>${date(i.created)}</td><td>${esc(i.number||i.description)}</td><td>${money(i.amount,i.currency)}</td><td>${esc(i.status)}</td><td>${i.url?`<a href="${esc(i.url)}" target="_blank" rel="noopener">${tr("studio_view_invoice")}</a>`:''} ${i.pdf?`<a href="${esc(i.pdf)}" target="_blank" rel="noopener">PDF</a>`:''}</td></tr>`).join('')||`<tr><td colspan="5">${tr("studio_your_stripe_invoices_will_appear_here_after_your_first_purchase")}</td></tr>`}</tbody></table></div>`}<p class="form-hint">${tr("studio_showing_the_latest_24_invoices_older_invoices_are_available_through_manage_payments")}</p></section>`;
  }
  function planDraft(key){
    const p=current.catalog[key],selected=selectedPlan()===key;
    return drafts[key]??={projects:Number(p.projects)+(selected?Number(current.extra_projects||0):0),seats:key==='solo'?1:Math.min(capacityMax(key,'seats'),Number(p.seats)+(selected?Number(current.extra_seats||0):0))};
  }
  const capacityMax=(key,kind)=>kind==='seats'?(key==='solo'?1:key==='studio'?14:Infinity):Infinity;
  function capacityControl(key,kind,min,value){
    const label=tr(kind==='projects'?'billing_projects':'billing_people'),id=`billing-${key}-${kind}`,max=capacityMax(key,kind);
    return `<div class="billing-capacity-row"><label for="${id}">${label}</label><span class="billing-stepper"><button type="button" data-action="billing-capacity-step" data-plan="${key}" data-kind="${kind}" data-delta="-1" aria-label="${esc(tr('billing_decrease',{name:label}))}" ${value<=min?'disabled':''}>−</button><input id="${id}" name="${kind}" type="number" min="${min}" ${Number.isFinite(max)?`max="${max}"`: ''} step="1" value="${value}" required><button type="button" data-action="billing-capacity-step" data-plan="${key}" data-kind="${kind}" data-delta="1" aria-label="${esc(tr('billing_increase',{name:label}))}" ${value>=max?'disabled':''}>+</button></span></div>`;
  }
  function trialBar(){
    const b=state.billing;
    if(!state.user||state.client||state.present||!b||b.needs_onboarding||b.legacy_exempt||b.subscription_active||!b.trial_ends_at||b.usage.passes>0)return '';
    const days=Math.max(0,Math.ceil((Number(b.trial_ends_at)*1000-Date.now())/86400000));
    return `<aside class="billing-trial-bar" aria-label="${esc(tr('studio_trial'))}"><span role="status">${days?tr('billing_trial_days',{count:days}):tr('billing_trial_ended')}</span>${admin()?button(tr('billing_activate'),'billing','small'):''}</aside>`;
  }
  function banner(){
    const b=state.billing,a=state.data?.billing;if(!b)return '';
    let text='';if(a?.archived)text=tr("studio_this_project_is_archived_and_read_only_reactivate_it_to_continue_working");
    else if(b.status==='past_due')text=tr("studio_your_renewal_payment_needs_attention_editing_pauses_three_days_after_your_paid_period_ends");
    else if(a&&!a.active&&!(a.source==='trial'&&trialBar()))text=tr("studio_this_project_is_read_only",{v0:a.delete_after?` ${tr("studio_export_or_renew_before_2",{v0:date(a.delete_after)})}`:' Your files remain available to view and download.'});

    if(!text||state.tab==='billing')return '';
    return `<div class="notice billing-notice" role="status"><span>${esc(text)}</span>${admin()?button(b.needs_onboarding?tr("studio_set_up_studio"):a&&(a.archived||!a.active)?tr("studio_review_project_access"):tr("studio_view_packages"),b.needs_onboarding?'billing-onboarding':a&&(a.archived||!a.active)?'billing-access-current':'billing','small'): `<span>${tr("studio_contact_your_studio_admin")}</span>`}</div>`;
  }
  function badge(a){return a?`<span class="tag">${esc(source(a.source))}${a.archived?` ${tr("studio_archived_2")}`:a.active?'':a.source==='project_pass'?` ${tr("studio_expired")}`:a.source==='subscription'?` ${tr("studio_payment_required")}`:` ${tr("studio_read_only_2")}`}</span>`:'';}
  function onboarding(){openModal(tr("studio_your_studio_starts_here"),`<p>${tr("studio_try_one_real_project_for_7_days_no_card_required_includes_3_image_enhancements_30_uploads_250_mb_tot")}</p><form data-form="billing-onboard"><label>${tr("studio_your_name")}<input name="name" value="${esc(state.user?.name||'')}" required maxlength="100" autocomplete="name"></label><label>${tr("studio_studio_name")}<input name="studio_name" value="${esc(state.studio?.name||'')}" required maxlength="100" autocomplete="organization"></label><p class="form-hint">${tr("studio_one_trial_per_account_if_you_have_already_used_yours_you_can_buy_a_pass_or_subscription_after_setup_")}</p>${submit(tr("studio_set_up_studio"))}</form>`);}
  async function action(a,el){
    if(!a.startsWith('billing'))return false;
    if(a==='billing'){await open();return true;}
    if(a==='billing-onboarding'){onboarding();return true;}
    if(a==='billing-refresh'){await api('billing_refresh');await load();render();await resumeAccess();return true;}
    if(a==='billing-portal'){const r=await api('billing_portal');location.assign(r.url);return true;}
    if(a==='billing-capacity-step'){
      const {plan:key,kind}=el.dataset,delta=Number(el.dataset.delta);
      if(!['solo','studio','practice'].includes(key)||!['projects','seats'].includes(kind)||![-1,1].includes(delta))return true;
      const draft=planDraft(key);draft[kind]=Math.min(capacityMax(key,kind),Math.max(Number(current.catalog[key][kind]),draft[kind]+delta));
      const input=el.closest('form').elements[kind];input.value=draft[kind];capacityChanged(input.form);return true;
    }
    if(a==='billing-new-pass'){return form('billing-checkout',{plan:'pass'});}
    if(a==='billing-use-pass'){await load();if(!current.summary.available_passes)throw Error(tr('billing_no_unused_pass'));closeModal();await createProject('pass');return true;}
    if(a==='billing-pass'){const p=current.projects.find(p=>p.id===el.dataset.id);openModal(el.dataset.plan==='extension'?tr("studio_more_time_for_your_project"):tr("studio_buy_a_project_pass"),`<p><strong>${esc(p.name)}</strong></p><p>${el.dataset.plan==='extension'?tr("studio_15_adds_another_150_days_from_the_later_of_your_current_expiry_and_payment_it_does_not_reset_the_10_"):tr("studio_19_covers_one_named_designer_this_project_and_150_days_from_payment_includes_10_image_enhancements_t")}</p><p>${tr("studio_prices_exclude_vat_no_automatic_renewal_this_purchase_selects_project_pass_coverage_for_this_project")}</p><form data-form="billing-checkout"><input type="hidden" name="plan" value="${esc(el.dataset.plan)}"><input type="hidden" name="project_id" value="${esc(p.id)}">${submit(tr("studio_continue_to_stripe"))}</form>`);return true;}
    if(a==='billing-plan'){
      const key=el.dataset.plan,p=current.catalog[key],draft=planDraft(key),column=el.closest?.('[data-package]');
      if(column&&!column.querySelector('form').reportValidity())return true;
      const data={plan:key,extra_projects:draft.projects-p.projects+(el.dataset.addSlot?1:0),extra_seats:draft.seats-p.seats};
      if(selectedPlan()===key&&data.extra_projects===Number(current.extra_projects||0)&&data.extra_seats===Number(current.extra_seats||0)){
        const result=await api('billing_portal');location.assign(result.url);return true;
      }
      purchaseStarted(data);
      const result=await api(selectedPlan()?'billing_change_checkout':'billing_checkout',data);location.assign(result.url);return true;
    }
    if(a==='billing-coverage'){openModal(tr("studio_change_project_coverage"),`<p>${el.dataset.source==='subscription'?tr("studio_this_project_will_use_one_subscription_project_slot_when_active_any_existing_pass_keeps_its_original"):tr("studio_this_project_will_use_its_existing_pass_and_must_have_only_its_named_designer_historical_image_usage")}</p><form data-form="billing-coverage"><input type="hidden" name="project_id" value="${esc(el.dataset.id)}"><input type="hidden" name="source" value="${esc(el.dataset.source)}">${submit(tr("studio_change_coverage"))}</form>`);return true;}
    if(a==='billing-cancel-checkout'){await api('billing_cancel_checkout',{order_id:el.dataset.id});await load();render();return true;}
    if(a==='billing-resume'){const r=await api('billing_resume_checkout',{order_id:el.dataset.id});location.assign(r.url);return true;}
    if(a==='billing-cancel-change'){await api('billing_cancel_change',{change_id:el.dataset.id});await load();render();return true;}
    if(a==='billing-confirm-change'){const r=await api('billing_change_confirm',{change_id:el.dataset.id});if(r.url)location.assign(r.url);else{await load();render();await resumeAccess();}return true;}
    if(a==='billing-export'){
      const response=await fetch('/api.php?'+new URLSearchParams({action:'project_export',project_id:state.data.project.id}),{credentials:'same-origin',headers:resourceHeaders()});if(!response.ok)throw Error((await response.json()).error||tr("studio_export_failed"));
      const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='studiodeck-project.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);return true;
    }
    return false;
  }
  function capacityText(key,projects,seats){const p=current.catalog[key];return `${tr('billing_capacity_counts',{members:p.seats+seats,projects:p.projects+projects,count:p.seats+seats})} · ${priceText(p,projects,seats)} ${tr('studio_month_2')}`;}
  function capacityChanged(form){
    if(form?.dataset.form==='billing-plan-column'){
      const key=form.elements.plan.value,p=current.catalog[key],draft=planDraft(key);
      for(const kind of ['projects','seats']){
        const input=form.elements[kind],value=Number(input.value);
        if(input.value===''||!Number.isInteger(value)||value<Number(p[kind])||value>capacityMax(key,kind))return;
      }
      draft.projects=Number(form.elements.projects.value);draft.seats=Number(form.elements.seats.value);
      form.closest('[data-package]').querySelector('[data-package-total]').textContent=priceText(p,draft.projects-p.projects,draft.seats-p.seats);
      for(const kind of ['projects','seats']){
        const decrease=form.querySelector(`[data-kind="${kind}"][data-delta="-1"]`),increase=form.querySelector(`[data-kind="${kind}"][data-delta="1"]`);
        if(decrease)decrease.disabled=draft[kind]<=Number(p[kind]);
        if(increase)increase.disabled=draft[kind]>=capacityMax(key,kind);
      }
      return;
    }
    if(form?.dataset.form!=='billing-plan')return;
    const key=form.elements.plan.value,p=current.catalog[key],projects=Number(form.elements.extra_projects.value),seats=Number(form.elements.team_capacity.value)-p.seats;
    if(Number.isInteger(projects)&&projects>=0&&Number.isInteger(seats)&&seats>=0)form.querySelector('[data-capacity-preview]').textContent=capacityText(key,projects,seats);
  }
  async function form(type,data){
    if(!type.startsWith('billing-'))return false;
    if(type==='billing-plan-column')return action('billing-plan',{dataset:{plan:data.plan}});
    if(type==='billing-onboard'){applySession(await api('billing_onboard',data));closeModal();await resetStudio();return true;}

    if(type==='billing-checkout'){purchaseStarted(data);const r=await api('billing_checkout',data);location.assign(r.url);return true;}
    if(type==='billing-coverage'){await api('billing_coverage',data);closeModal();await load();render();return true;}
    if(type==='billing-plan'){
      const p=current.catalog[data.plan];data={...data,extra_seats:data.team_capacity===undefined?Number(data.extra_seats||0):Number(data.team_capacity)-p.seats};delete data.team_capacity;
      purchaseStarted(data);const result=await api(selectedPlan()?'billing_change_checkout':'billing_checkout',data);location.assign(result.url);return true;
    }
    if(type==='billing-change-confirm'){const r=await api('billing_change_confirm',data);if(r.url)location.assign(r.url);else{closeModal();await load();render();toast(r.status==='scheduled'?tr("studio_package_change_scheduled"):tr("studio_package_updated"));if(r.status!=='scheduled')await resumeAccess();}return true;}
    return false;
  }
  async function returned(){
    const params=new URLSearchParams(location.search);if(params.has('portal')){history.replaceState(null,'',location.pathname);await api('billing_refresh');await load();render();await resumeAccess();return;}if(!params.has('checkout'))return;
    const outcome=params.get('checkout'),orderId=params.get('order');history.replaceState(null,'',location.pathname);clearTimeout(poll);
    if(!orderId){await api('billing_refresh');await load();render();toast(tr("studio_checkout_cancelled_your_current_access_is_unchanged"));return;}
    checkoutNotice=tr('studio_confirming_your_payment');render();let attempts=0;
    const refresh=async()=>{
      try{
        await api('billing_refresh');await load();
        const order=current.orders.find(o=>o.id===orderId);let done=true;
        if(order?.status==='paid'){checkoutNotice=tr(order.plan==='pass'&&!order.project_id?'billing_pass_ready':'studio_payment_confirmed_your_access_is_ready');}
        else if(order?.status==='failed'){checkoutNotice=tr('billing_payment_failed_access_explanation');}
        else if(['refunded','expired','cancelled'].includes(order?.status)){checkoutNotice=tr('studio_payment_was_not_completed_or_was_refunded_review_your_project_access_or_choose_another_payment_optio');}
        else if(++attempts>=6){checkoutNotice=tr('studio_payment_is_still_processing_access_will_update_when_stripe_confirms_it');}
        else{done=false;checkoutNotice=tr(outcome==='failed'?'billing_confirming_declined_payment':'studio_confirming_your_payment');}
        if(state.tab==='billing')render();
        if(done){toast(checkoutNotice);if(order?.status==='paid')await resumeAccess();}
        else poll=setTimeout(refresh,6000);
      }catch(e){checkoutNotice=e.message;if(state.tab==='billing')render();toast(e.message);}
    };
    await refresh();
  }
  return {load,open,page,banner,trialBar,badge,action,form,returned,capacityChanged};
}
