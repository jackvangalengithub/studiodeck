import assert from 'node:assert/strict';
import {billingUi} from '../public/assets/billing.js';
import {setLanguage} from '../public/assets/i18n.js';

const catalog=Object.fromEntries([['pass','Project Pass',1900],['solo','Solo',5900],['studio','Studio',19900],['practice','Practice',49900]].map(([id,name,cents])=>[id,{name,cents,seats:1,projects:3,available:true}]));
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
assert.equal((html.match(/role="switch"/g)||[]).length,0);
assert.equal((html.match(/Studio website included/g)||[]).length,3);
assert(!html.slice(0,html.indexOf('billing-package-group')).includes('Studio website included'));
assert(!html.includes('Add-ons'));
for(const [plan,price] of [['solo','€59.00'],['studio','€199.00'],['practice','€499.00']]){
 assert(html.includes(price));
 await ui.action('billing-plan',{dataset:{plan}});
 assert.equal(redirect,'https://checkout.stripe.com/package');
 assert(!Object.hasOwn(calls.at(-1).body,'website'));
}
assert.equal(await ui.action('billing-addon-activate',{dataset:{addon:'website'}}),false);
assert.equal(await ui.form('billing-addon-checkout',{addon:'website'}),false);
assert(!calls.some(c=>c.action==='website_checkout'));
websiteIncluded=true;await ui.load();assert(ui.page().includes('€59.00'));
setLanguage('nl');html=ui.page();assert.equal((html.match(/Studiowebsite inbegrepen/g)||[]).length,3);assert(!html.includes('Extra modules'));setLanguage('en');
console.log('PASS Website included in every subscription without add-on controls, surcharges or standalone checkout');
