'use strict';
import {mountErrorPage} from './error-page.js';
const translations=JSON.parse(document.querySelector('#login-translations').textContent);
let language='en';try{language=localStorage.getItem('studiodeck.loginLanguage')==='nl'?'nl':'en';}catch{}
const copy=key=>translations[language][key]||translations.en[key];
const localize=message=>{const key=Object.keys(translations.en).find(key=>translations.en[key]===message);return key?copy(key):message;};
const params=new URLSearchParams(location.search);
if(['pass','solo','studio','practice'].includes(params.get('plan')))sessionStorage.setItem('studiodeck.preferredPlan',params.get('plan'));
const safePath=value=>typeof value==='string'&&/^\/(?!\/)/.test(value)&&!/[\\\r\n]/.test(value)?value:'/';
let destination=safePath(params.get('returnTo')||sessionStorage.getItem('studiodeck.returnTo')||'/');
const match=location.hash.match(/^#\/login\/([a-f0-9]{64})$/);
let loginToken=match?.[1]||'';
const legacy=location.hash.startsWith('#/view/');
// Credentials never remain in browser history after the page is opened.
history.replaceState(null,'','/login');
const form=document.querySelector('#login'),status=document.querySelector('#status'),submit=document.querySelector('#submit');
if(loginToken){document.querySelector('#email-label').hidden=true;document.querySelector('#email').required=false;}
let statusMessage=legacy?translations.en.login_legacy:'';
function renderLanguage(){
 document.documentElement.lang=language;
 document.querySelectorAll('[data-login-copy]').forEach(el=>el.textContent=copy(el.dataset.loginCopy));
 submit.textContent=copy(loginToken?'login_continue':'login_submit');
 status.textContent=localize(statusMessage);
}
renderLanguage();
async function signIn(){
 if(submit.disabled)return;
 submit.disabled=true;form.hidden=!!loginToken;statusMessage=loginToken?translations.en.login_signing_in:'';status.textContent=localize(statusMessage);status.classList.remove('login-error');status.setAttribute('role','status');
 try{
  const action=loginToken?'consume_login':'request_login';
  const response=await fetch('/api.php?action='+action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(loginToken?{token:loginToken}:{email:document.querySelector('#email').value})});
  const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error||'Sign-in could not be completed.'),{status:response.status});
  if(loginToken){loginToken='';sessionStorage.removeItem('studiodeck.returnTo');location.replace(safePath(result.redirect&&result.redirect!=='/choose'?result.redirect:destination));}
  else{sessionStorage.setItem('studiodeck.returnTo',destination);statusMessage=result.message;status.textContent=localize(statusMessage);}
 }catch(error){
  if(loginToken){
   sessionStorage.setItem('studiodeck.returnTo',destination);
   const container=document.createElement('div');document.querySelector('main').replaceWith(container);
   const expired=error.message===translations.en.login_expired||[400,401].includes(error.status);
   mountErrorPage(container,error,{language,kind:expired?'expired':[403,404].includes(error.status)?'access':'service',onRetry:signIn});
  }else{form.hidden=false;statusMessage=error.status?error.message:(language==='nl'?'We konden geen verbinding maken. Probeer het over een ogenblik opnieuw.':'We couldn’t connect. Please try again in a moment.');status.textContent=localize(statusMessage);status.classList.add('login-error');status.setAttribute('role','alert');document.querySelector('#request').hidden=false;}
 }
 finally{submit.disabled=false;}
}
form.addEventListener('submit',event=>{event.preventDefault();signIn();});
if(loginToken)signIn();
