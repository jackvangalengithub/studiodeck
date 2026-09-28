import * as domView from "../../assets/render.js";
import {tr} from './i18n.js';
export function installProjectMemberPopovers({getMembers, esc, personAvatar}) {
  let popup = null, anchor = null, pinned = false, closeTimer = null, suppressFocus = false;
  const triggerFor = target => target instanceof Element ? target.closest('[data-project-members]') : null;
  function cancelClose() {
    clearTimeout(closeTimer);
  }
  function close(restoreFocus = false) {
    cancelClose();
    const previous = anchor;
    popup?.remove();
    popup = null;
    anchor = null;
    pinned = false;
    previous?.setAttribute('aria-expanded', 'false');
    previous?.removeAttribute('aria-controls');
    if (restoreFocus && previous?.isConnected) {
      suppressFocus = true;
      previous.focus({
        preventScroll: true
      });
      suppressFocus = false;
    }
  }
  function position() {
    if (!popup || !anchor?.isConnected) {
      close();
      return;
    }
    const rect = anchor.getBoundingClientRect(), width = Math.min(320, innerWidth - 24), maxHeight = Math.min(560, innerHeight - 24);
    Object.assign(popup.style, {
      width: domView.concat(width, 'px'),
      maxHeight: domView.concat(maxHeight, 'px')
    });
    const height = popup.offsetHeight, below = innerHeight - rect.bottom - 8, above = rect.top - 8;
    const top = below >= height || below >= above ? domView.concat(rect.bottom, 8) : rect.top - height - 8;
    Object.assign(popup.style, {
      left: domView.concat(Math.max(12, Math.min(innerWidth - width - 12, rect.left)), 'px'),
      top: domView.concat(Math.max(12, Math.min(innerHeight - height - 12, top)), 'px')
    });
  }
  function open(trigger) {
    cancelClose();
    if (anchor === trigger && popup) return;
    close();
    const members = getMembers(trigger.dataset.projectMembers);
    if (!members.length) return;
    anchor = trigger;
    popup = document.createElement('section');
    popup.id = 'project-member-popover';
    popup.className = 'project-member-popover';
    popup.setAttribute('role', 'dialog');
    popup.setAttribute('aria-label', tr("studio_project_team"));
    popup.tabIndex = -1;
    domView.mount(popup, domView.fragment([domView.element("header", [], [domView.element("h3", [], [domView.fragment([tr("studio_project_team"), " "]), domView.element("span", [], [members.length], false)], false), domView.element("button", [{
      "type": "button"
    }, {
      "data-close-member-popover": domView.text([])
    }, {
      "aria-label": tr("studio_close_project_team")
    }], ["×"], false)], false), domView.element("ul", [], [domView.join(members.map(member => domView.element("li", [], [personAvatar(member.profile, member.name), domView.element("span", [{
      "class": "project-member-info"
    }], [domView.element("strong", [], [member.name || member.profile?.name || member.email], false), member.role || member.email ? domView.element("small", [], [member.role || member.email], false) : ''], false)], false)), '')], false)]));
    popup.addEventListener('pointerenter', cancelClose);
    popup.addEventListener('pointerleave', () => {
      if (!pinned) scheduleClose();
    });
    document.body.append(popup);
    anchor.setAttribute('aria-expanded', 'true');
    anchor.setAttribute('aria-controls', popup.id);
    position();
  }
  function scheduleClose() {
    cancelClose();
    closeTimer = setTimeout(() => {
      if (!popup?.contains(document.activeElement) && document.activeElement !== anchor) close();
    }, 160);
  }
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const trigger = triggerFor(event.target);
    if (trigger && !trigger.contains(event.relatedTarget)) open(trigger);
  });
  document.addEventListener('pointerout', event => {
    const trigger = triggerFor(event.target);
    if (trigger && trigger === anchor && !trigger.contains(event.relatedTarget) && !popup?.contains(event.relatedTarget) && !pinned) scheduleClose();
  });
  document.addEventListener('focusin', event => {
    if (suppressFocus) return;
    const trigger = triggerFor(event.target);
    if (trigger) open(trigger); else if (popup && !popup.contains(event.target)) close();
  });
  document.addEventListener('focusout', () => {
    if (popup) scheduleClose();
  });
  document.addEventListener('click', event => {
    const trigger = triggerFor(event.target);
    if (trigger) {
      event.preventDefault();
      if (anchor === trigger && pinned) {
        close(true);
        return;
      }
      open(trigger);
      pinned = true;
      popup?.focus({
        preventScroll: true
      });
      return;
    }
    if (event.target.closest('[data-close-member-popover]')) {
      close(true);
      return;
    }
    if (popup && !popup.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && popup) {
      event.preventDefault();
      event.stopImmediatePropagation();
      close(true);
    }
  }, true);
  window.addEventListener('resize', position);
  document.addEventListener('scroll', event => {
    if (popup && !popup.contains(event.target)) position();
  }, true);
  new MutationObserver(() => {
    if (anchor && !anchor.isConnected) close();
  }).observe(document.querySelector('#app'), {
    childList: true,
    subtree: true
  });
}
