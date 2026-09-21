import assert from 'node:assert/strict';
import {billingUi} from '../public/assets/billing.js';
import {setLanguage} from '../public/assets/i18n.js';

const catalog=Object.fromEntries([['pass','Project Pass',1900],['solo','Solo',3900],['studio','Studio',19900],['practice','Practice',39900]].map(([id,name,cents])=>[id,{name,cents,seats:1,projects:3,available:true}]));
const baseAddon={id:'website',name:'Website',price:3900,currency:'USD',available:true,active:false,local:false,has_subscription:false,status:'none'};
let addon={...baseAddon},modal='',calls=[],purchaseIntent=0,redirect='';
globalThis.location={assign:url=>redirect=url};
const ui=billingUi({
 state:{studio:{id:'studio',role:'admin'}},esc:value=>String(value),button:(label,action,kind='',attrs='')=>`<button data-action="${action}" ${attrs}>${label}</button>`,
 openModal:(_,html)=>modal=html,purchaseStarted:()=>purchaseIntent++,
 api:async(action,body)=>{
  calls.push({action,body});
  if(action==='billing')return {summary:{usage:{},status:'none'},catalog,addons:[addon],orders:[],changes:[],extra_projects:0,extra_seats:0,has_customer:true};
  if(action==='billing_invoices')return {invoices:[]};
  if(action==='website_checkout')return {url:'https://checkout.stripe.com/test'};
  throw Error('Unexpected action: '+action);
 }
});
await ui.load();let html=ui.page();
assert(html.indexOf('billing-pass-group')<html.indexOf('billing-package-group'));
assert(html.includes('data-action="billing-addon-activate" data-addon="website" >Activate Website'));
await ui.action('billing-addon-activate',{dataset:{addon:'website'}});
assert(modal.includes('USD'));assert(modal.includes('separate monthly subscription'));
await ui.form('billing-addon-checkout',{addon:'website'});
assert.equal(redirect,'https://checkout.stripe.com/test');assert.equal(purchaseIntent,0,'Module checkout must not consume pending project purchase intent');
assert.equal(calls.filter(c=>c.action==='website_checkout').length,1);

for(const status of ['active','past_due','unpaid','incomplete']){
 addon={...baseAddon,status,has_subscription:true,active:status==='active'};await ui.load();html=ui.page();
 assert(!html.includes('data-action="billing-addon-activate"'),status+' should not create a second subscription');
 assert(html.includes('Manage subscription'));
 await assert.rejects(ui.form('billing-addon-checkout',{addon:'website'}),/Refresh Billing/);
}
addon={...baseAddon,available:false};await ui.load();html=ui.page();assert(html.includes('data-addon="website" disabled>Activate Website'));assert(html.includes('Payment setup is not available yet'));
addon={...baseAddon,active:true,local:true};await ui.load();html=ui.page();assert(html.includes('Development access'));assert(html.includes('Open Website'));assert(!html.includes('data-action="billing-addon-activate"'));
addon={...baseAddon,status:'canceled',has_subscription:true};await ui.load();assert(ui.page().includes('Activate Website'));
setLanguage('nl');html=ui.page();assert(html.includes('Extra modules'));assert(html.includes('Website activeren'));assert(html.includes('Eén project tegelijk'));setLanguage('en');
console.log('PASS grouped offers, module checkout isolation, active/overdue/pending/unavailable/local/canceled states and Dutch copy');
