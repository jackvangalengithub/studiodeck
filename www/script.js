'use strict';

// Marketing previews remain local. Signup opens the configured application.
const appBase=(document.querySelector('meta[name="studiodeck-app-url"]')?.content||location.origin).replace(/\/$/,'');
const signupUrl=plan=>appBase+'/login'+(plan?'?plan='+encodeURIComponent(plan):'');
document.querySelectorAll('[data-login]').forEach(el=>{el.href=appBase+'/';});
document.querySelectorAll('[data-signup]').forEach(el=>el.addEventListener('click',()=>location.assign(signupUrl())));
const plans = {
  solo: { name: 'Solo', monthly: 59, designers: 1, projects: 3, description: 'A considered workspace for your independent practice.' },
  studio: { name: 'Studio', monthly: 199, designers: 5, projects: 15, description: 'A shared home for your creative team and its next great ideas.' },
  practice: { name: 'Practice', monthly: 499, designers: 15, projects: 50, description: 'More room for a growing practice, with clarity across your projects.' },
  pass: { name: 'Project Pass', price: 19, designers: 1, projects: 1, durationDays: 150, description: 'For your own home or a client project. Bring plans and quotes together, let AI help you spot discrepancies, and keep conversations and decisions in one place. One project owner, one project, 150 days of access. No subscription.' }
};
const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const euroWithCents = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
let selectedPlan = 'solo';
let currentTab = 0;
let commentCount = 1;
let dialogTrigger = null;

const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#navigation');
function closeMenu() {
  navigation.classList.remove('is-open');
  menuButton.setAttribute('aria-expanded', 'false');
}
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  navigation.classList.toggle('is-open', open);
});
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
    closeMenu();
    menuButton.focus();
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
window.matchMedia('(min-width: 701px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

const tabs = [...document.querySelectorAll('[role="tab"]')];
function showTab(index, focus = false) {
  currentTab = (index + tabs.length) % tabs.length;
  tabs.forEach((tab, i) => {
    const selected = i === currentTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
  });
  document.querySelector('#slide-counter').textContent = `0${currentTab + 1} / 04`;
  if (focus) tabs[currentTab].focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => showTab(index));
  tab.addEventListener('keydown', event => {
    const keys = { ArrowRight: currentTab + 1, ArrowLeft: currentTab - 1, Home: 0, End: tabs.length - 1 };
    if (event.key in keys) {
      event.preventDefault();
      showTab(keys[event.key], true);
    }
  });
});
document.querySelector('#demo-prev').addEventListener('click', () => showTab(currentTab - 1));
document.querySelector('#demo-next').addEventListener('click', () => showTab(currentTab + 1));
document.querySelector('[data-show-feedback]').addEventListener('click', () => showTab(3, true));
document.querySelector('#source-toggle').addEventListener('click', event => {
  const button = event.currentTarget;
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  button.setAttribute('aria-expanded', String(expanded));
  document.querySelector('#budget-source').hidden = !expanded;
});

document.querySelector('#feedback-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = document.querySelector('#feedback-input');
  const value = input.value.trim();
  if (!value) {
    input.setCustomValidity('Please write a note first.');
    input.reportValidity();
    return;
  }
  const comment = document.createElement('div');
  comment.className = 'sample-comment';
  const avatar = document.createElement('span');
  avatar.className = 'note-avatar';
  avatar.textContent = 'Y';
  const content = document.createElement('div');
  const name = document.createElement('b');
  name.textContent = 'You · Preview guest';
  const text = document.createElement('p');
  text.textContent = value;
  content.append(name, text);
  comment.append(avatar, content);
  const comments = document.querySelector('#sample-comments');
  comments.append(comment);
  comments.scrollTop = comments.scrollHeight;
  commentCount += 1;
  document.querySelector('.feedback-count').textContent = commentCount;
  document.querySelector('.image-comment').lastChild.textContent = ` ${commentCount}`;
  input.value = '';
  input.focus();
});
document.querySelector('#feedback-input').addEventListener('input', event => event.currentTarget.setCustomValidity(''));

function openDialog(dialog) {
  dialogTrigger = document.activeElement;
  dialog.showModal();
  document.body.classList.add('dialog-open');
}
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    if (dialogTrigger) dialogTrigger.focus({ preventScroll: true });
  });
});
document.querySelector('#expand-demo').addEventListener('click', () => {
  const source = document.querySelector('#demo-image');
  const expanded = document.querySelector('#expanded-image');
  expanded.src = source.src;
  expanded.alt = source.alt;
  document.querySelector('#image-dialog-title').textContent = document.querySelector('#demo-title').textContent;
  document.querySelector('#expanded-image-credit').textContent = (source.src.includes('/studio-types/') || source.src.includes('/villas/') || source.src.includes('/architecture.jpg') || source.src.includes('/garden.jpg')) ? 'Original AI-generated architectural concept · Created for Studiodeck.' : 'Illustrative stock photograph · Your own project images take center stage in Studiodeck.';
  openDialog(document.querySelector('#image-dialog'));
});
document.querySelector('#privacy-button').addEventListener('click', () => openDialog(document.querySelector('#privacy-dialog')));

document.querySelectorAll('[data-plan]').forEach(button => {
  button.addEventListener('click', () => {
    selectedPlan = button.dataset.plan;
    document.querySelector('#signup-plan').href=signupUrl(selectedPlan);
    const plan = plans[selectedPlan];
    const pass = selectedPlan === 'pass';
    document.querySelector('#plan-dialog-title').textContent = pass ? 'One project. All the care.' : `Your ${plan.name} plan.`;
    document.querySelector('#plan-dialog-description').textContent = plan.description;
    document.querySelector('#summary-plan').textContent = `${selectedPlan === 'studio' ? 'Up to 5 people' : selectedPlan === 'practice' ? '15 people included' : pass ? '1 project owner' : '1 designer'} · ${plan.projects} active project${plan.projects > 1 ? 's' : ''}`;
    document.querySelector('#summary-extra').hidden = pass;
    document.querySelector('#summary-extra').textContent = pass ? '' : `${selectedPlan === 'practice' ? 'Additional people: €20 each / month. ' : ''}Extra active projects: €10 each / month. Studio website included.`;
    document.querySelector('#summary-price').textContent = pass ? `${euroWithCents.format(plan.price)} one-time` : `${euro.format(plan.monthly)} / month`;
    document.querySelector('#summary-billing').textContent = pass ? `One project · ${plan.durationDays} days of access · excluding VAT`
      : `${euro.format(plan.monthly)} billed monthly · excluding VAT`;
    document.querySelector('#summary-enhancements').textContent = pass ? '10 image enhancements for this project.' : '10 image enhancements per project per calendar month.';
    document.querySelector('#download-status').textContent = '';
    openDialog(document.querySelector('#plan-dialog'));
  });
});
document.querySelector('#download-plan').addEventListener('click', () => {
  const plan = plans[selectedPlan];
  const details = [
    `STUDIODECK — ${plan.name.toUpperCase()}`,
    'Studiodeck package details · complete your purchase in the application.', '',
    plan.description, '',
    document.querySelector('#summary-plan').textContent,
    document.querySelector('#summary-price').textContent,
    document.querySelector('#summary-billing').textContent,
    ...(selectedPlan !== 'pass' ? [document.querySelector('#summary-extra').textContent] : []), '',
    'Includes: branded presentations, client feedback, budgets, iteration history and client guests.',
    'All AI features are included in this plan.',
    document.querySelector('#summary-enhancements').textContent,
    'Originals and saved enhancements remain available when the allowance is used up.',
    selectedPlan === 'pass' ? `One payment for one project and ${plan.durationDays} days of access. No recurring subscription. Extend the same project for another 150 days for €15 excluding VAT, without resetting its image allowance. After expiry, private downloads remain available for at least 90 days after notice.` : 'Archived projects are read-only. At the end of paid access, private downloads remain available for at least 90 days after notice.', '',
    'This is a saved plan preview, not an order, invoice or subscription. No payment has been taken.'
  ].join('\n');
  const url = URL.createObjectURL(new Blob([details], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `studiodeck-${selectedPlan}-proposed-plan.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  document.querySelector('#download-status').textContent = 'Your plan summary is ready in your downloads.';
});
document.querySelector('#plan-to-demo').addEventListener('click', () => {
  const dialog = document.querySelector('#plan-dialog');
  dialog.addEventListener('close', () => {
    showTab(0, true);
    document.querySelector('#live-demo').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }, { once: true });
  dialog.close();
});
document.querySelector('#year').textContent = new Date().getFullYear();
