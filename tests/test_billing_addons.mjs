import assert from 'node:assert/strict';
import {billingUi} from '../public/assets/billing.js';
import {setLanguage} from '../public/assets/i18n.js';

const catalog=Object.fromEntries([['pass','Project Pass',1900],['solo','Solo',3900],['studio','Studio',19900],['practice','Practice',39900]].map(([id,name,cents])=>[id,{name,cents,seats:1,projects:3,available:true}]));
const baseAddon={id:'website',name:'Website',price:3900,currency:'EUR',available:true,active:false,local:false,has_subscription:false,status:'none'};
let addon={...baseAddon},modal='',calls=[],purchaseIntent=0,redirect='',websiteIncluded=false;
globalThis.location={assign:url=>redirect=url};
const ui=billingUi({
 state:{studio:{id:'studio',role:'admin'}},esc:value=>String(value),button:(label,action,kind='',attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`,
 openModal:(_,html)=>modal=html,purchaseStarted:()=>purchaseIntent++,
 api:async(action,body)=>{
  calls.push({action,body});
  if(action==='billing')return {summary:{usage:{},status:'none'},catalog,website_included:websiteIncluded,addons:[addon],orders:[],changes:[],extra_projects:0,extra_seats:0,has_customer:true};
  if(action==='billing_invoices')return {invoices:[]};
  if(action==='billing_checkout')return {url:'https://checkout.stripe.com/package'};
  if(action==='website_checkout')return {url:'https://checkout.stripe.com/test'};
  throw Error('Unexpected action: '+action);
 }
});
await ui.load();let html=ui.page();
assert(html.indexOf('billing-pass-group')<html.indexOf('billing-package-group'));
assert.equal((html.match(/role="switch"/g)||[]).length,3);assert(!html.slice(0,html.indexOf('billing-package-group')).includes('role="switch"'));
assert(!html.includes('Google Ads'));assert(!html.includes('pricing preview'));
const total={textContent:''},before=calls.length,attributes={};const closest=()=>({querySelector:()=>total});await ui.action('billing-addon-toggle',{dataset:{plan:'solo',addon:'website'},closest,setAttribute:(k,v)=>attributes[k]=v});assert.equal(attributes['aria-checked'],'true');assert.equal(total.textContent,'€78.00');assert(ui.page().includes(total.textContent));assert.equal(calls.length,before,'Toggling a selection must not itself charge the customer');
await ui.action('billing-plan',{dataset:{plan:'solo'}});assert.equal(redirect,'https://checkout.stripe.com/package');assert.equal(calls.at(-1).body.website,true);assert.equal(modal,'');purchaseIntent=0;
await ui.action('billing-addon-toggle',{dataset:{plan:'solo',addon:'website'},closest,setAttribute:(k,v)=>attributes[k]=v});assert.equal(attributes['aria-checked'],'false');assert.equal(total.textContent,'€39.00');
await ui.action('billing-addon-activate',{dataset:{addon:'website'}});
assert(modal.includes('EUR'));assert(modal.includes('separate monthly subscription'));
await ui.form('billing-addon-checkout',{addon:'website'});
assert.equal(redirect,'https://checkout.stripe.com/test');assert.equal(purchaseIntent,0,'Module checkout must not consume pending project purchase intent');
assert.equal(calls.filter(c=>c.action==='website_checkout').length,1);

for(const status of ['active','past_due','unpaid','incomplete']){
 addon={...baseAddon,status,has_subscription:true,active:status==='active'};await ui.load();html=ui.page();
 assert(!html.includes('data-action="billing-addon-activate"'),status+' should not create a second subscription');
 assert.equal((html.match(/role="switch"/g)||[]).length,3);
 await assert.rejects(ui.form('billing-addon-checkout',{addon:'website'}),/Refresh Billing/);
}
addon={...baseAddon,available:false};await ui.load();html=ui.page();assert(html.includes('data-addon="website"'));assert(!html.includes('Activate Website'));
addon={...baseAddon,active:true,local:true};await ui.load();html=ui.page();assert(!html.includes('pricing preview'));assert(!html.includes('data-action="billing-addon-activate"'));
addon={...baseAddon,status:'canceled',has_subscription:true};await ui.load();assert(ui.page().includes('role="switch"'));
setLanguage('nl');html=ui.page();assert(html.includes('Extra modules'));assert(!html.includes('prijsvoorbeeld'));assert(!html.includes('Google Ads'));assert(html.includes('Eén project tegelijk'));setLanguage('en');
websiteIncluded=true;await ui.load();assert.equal((ui.page().match(/aria-checked="true"/g)||[]).length,3);assert(ui.page().includes('€78.00'));
websiteIncluded=false;addon={...baseAddon,separate_subscription:true};await ui.load();assert(ui.page().includes('disabled title="Website is already billed separately.'));
console.log('PASS Website pricing, selected checkout item, purchased toggle state, duplicate billing guard and Dutch copy');
