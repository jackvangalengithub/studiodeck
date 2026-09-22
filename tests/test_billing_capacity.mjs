import assert from 'node:assert/strict';
import {billingUi} from '../public/assets/billing.js';
const catalog={solo:{name:'Solo',cents:5900,seats:1,projects:3,available:true},studio:{name:'Studio',cents:19900,seats:5,projects:15,available:true},practice:{name:'Practice',cents:49900,seats:15,projects:50,available:true},pass:{available:true}};
const summary={plan:'studio',package:'Studio',status:'active',subscription_active:true,usage:{seats:3,projects:2,passes:0},limits:{seats:5,projects:17}};
const state={studio:{id:'test',role:'admin'},billing:summary};let modal='',preview=null,redirect='';
globalThis.location={assign:url=>redirect=url};
const api=async(action,body)=>{
  if(action==='billing')return {summary,catalog,extra_projects:2,extra_seats:0,projects:[],orders:[],changes:[]};
  if(action==='billing_invoices')return {invoices:[]};
  if(action==='billing_change_checkout'){preview=body;return {url:'https://invoice.stripe.com/test'};}
  if(action==='billing_portal')return {url:'https://billing.stripe.com/test'};
  if(action==='billing_checkout'){preview=body;return {url:'https://checkout.stripe.com/test'};}
};
const button=(label,action,classes='',attrs='')=>`<button class="button ${classes}" data-action="${action}" ${attrs}>${label}</button>`;
const ui=billingUi({state,api,esc:v=>String(v),button,openModal:(_,html)=>modal=html});
await ui.load();const html=ui.page();
assert.equal((html.match(/class="billing-plan is-selected"/g)||[]).length,1);
assert(html.includes('Studio — current package'));
assert(html.includes('billing-current-button" disabled>CURRENT PACKAGE'));
assert(html.includes('small billing-adjust'));
assert(html.includes('>€219.00</span>'));assert(!html.includes(' = '));
assert(/name="projects"[^>]+min="15"[^>]+value="17"/.test(html));assert(/name="seats"[^>]+min="5"[^>]+value="5"/.test(html));assert(/name="seats"[^>]+min="5"[^>]+max="14"/.test(html));assert(!html.includes('billing-solo-seats'));assert(html.includes('Active projects'));assert.equal((html.match(/role="switch"/g)||[]).length,0);
await ui.action('billing-plan',{dataset:{plan:'studio'}});
assert.equal(redirect,'https://billing.stripe.com/test');assert.equal(modal,'');
await ui.action('billing-plan',{dataset:{plan:'practice'}});
assert.deepEqual(preview,{plan:'practice',extra_projects:0,extra_seats:0});assert.equal(redirect,'https://invoice.stripe.com/test');assert.equal(modal,'');
const output={textContent:''};
ui.capacityChanged({dataset:{form:'billing-plan'},elements:{plan:{value:'practice'},extra_projects:{value:'2'},team_capacity:{value:'17'}},querySelector:()=>output});
assert(output.textContent.includes('17 team members · 52 active projects'));
assert(output.textContent.includes('€559.00'));assert(!output.textContent.includes(' = '));
await ui.form('billing-plan',{plan:'practice',extra_projects:'2',team_capacity:'17'});
assert.equal(preview.extra_seats,2);assert(!Object.hasOwn(preview,'team_capacity'));
assert.equal(modal,'');summary.plan=null;summary.status='none';await ui.action('billing-plan',{dataset:{plan:'solo'}});assert.equal(redirect,'https://checkout.stripe.com/test');
console.log('PASS package minimums, people limits, correct totals and direct Stripe checkout/update redirects without modals.');
