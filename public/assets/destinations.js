import * as domView from "./render.js";
import {tr, getLanguage} from './i18n.js';
const esc = value => String(value ?? '');
export function destinationPage(data, brand) {
  const logo = (src, name) => src ? domView.element("img", [{
    "class": "destination-logo"
  }, {
    "src": src
  }, {
    "alt": domView.text([name, " logo"])
  }], [], false) : domView.element("span", [{
    "class": "destination-monogram"
  }, {
    "aria-hidden": "true"
  }], [name.slice(0, 1).toUpperCase()], false);
  return domView.element("div", [{
    "class": "destination-shell"
  }], [domView.element("header", [], [brand, domView.element("button", [{
    "type": "button"
  }, {
    "class": "button small"
  }, {
    "data-action": "account-menu"
  }], [tr("your_account")], false)], false), domView.element("main", [{
    "id": "main"
  }], [domView.element("h1", [], [tr("where_would_you_like_to_go")], false), domView.element("p", [{
    "class": "muted"
  }], [tr("choose_your_workspace_or_a_project_shared_with_you")], false), domView.fragment([data.studios.length ? domView.element("section", [], [domView.element("h2", [], [tr("your_studios")], false), domView.element("div", [{
    "class": "destination-grid"
  }], [domView.join(data.studios.map(s => domView.element("button", [{
    "type": "button"
  }, {
    "class": "destination-studio"
  }, {
    "data-action": "destination-studio"
  }, {
    "data-id": s.id
  }], [logo(s.logo, s.name), domView.element("span", [], [domView.element("strong", [], [s.name], false), domView.element("small", [], [s.role === 'admin' ? tr("studio_admin") : tr("studio_member")], false)], false), domView.element("span", [{
    "aria-hidden": "true"
  }], ["→"], false)], false)), '')], false)], false) : '', data.projects.length ? domView.element("section", [], [domView.element("h2", [], [tr("shared_with_you")], false), domView.element("div", [{
    "class": "destination-grid"
  }], [domView.join(data.projects.map(p => domView.element("article", [{
    "class": "destination-project"
  }, {
    "data-destination-project": p.id
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "destination-cover"
  }, {
    "data-action": "destination-client"
  }, {
    "data-id": p.id
  }, {
    "aria-label": tr('open_as_client', {
      name: p.name
    })
  }], [p.has_cover ? domView.element("img", [{
    "src": p.cover_url || ''
  }, {
    "alt": domView.text([])
  }, {
    "loading": "lazy"
  }], [], false) : domView.element("span", [{
    "aria-hidden": "true"
  }], [p.name.slice(0, 1)], false)], false), domView.element("div", [{
    "class": "destination-project-copy"
  }], [domView.element("div", [{
    "class": "destination-studio-name"
  }], [logo(p.studio_logo, p.studio_name), domView.element("span", [], [p.studio_name], false)], false), domView.element("h3", [], [p.name], false), domView.element("p", [], [domView.fragment([tr("iteration"), " ", String(p.iteration_number).padStart(2, '0'), p.iteration_title ? domView.concat(' · ', p.iteration_title) : ''])], false), domView.element("div", [{
    "class": "row wrap"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "button primary small"
  }, {
    "data-action": "destination-client"
  }, {
    "data-id": p.id
  }], [p.studio_access ? tr("view_as_client") : tr("open_presentation")], false), p.studio_access ? domView.element("button", [{
    "type": "button"
  }, {
    "class": "button small"
  }, {
    "data-action": "destination-studio"
  }, {
    "data-id": p.studio_id
  }, {
    "data-project": p.id
  }], [tr("open_in_studio")], false) : ''], false)], false)], false)), '')], false)], false) : '', data.conversations?.length ? domView.element("section", [], [domView.element("h2", [], [getLanguage() === 'nl' ? 'Gedeelde gesprekken' : 'Shared conversations'], false), domView.element("div", [{
    "class": "destination-grid"
  }], [domView.join(data.conversations.map(c => domView.element("a", [{
    "class": "destination-studio"
  }, {
    "href": domView.text(["/conversations/", c.id])
  }], [domView.element("span", [], [domView.element("strong", [], [c.title], false), domView.element("small", [], [c.project_name], false)], false), domView.element("span", [{
    "aria-hidden": "true"
  }], ["→"], false)], false)), '')], false)], false) : '', !data.studios.length && !data.projects.length && !data.conversations?.length ? domView.element("div", [{
    "class": "notice"
  }], [tr("no_active_projects_have_been_shared_with_this_account_your_studio_can_invite_you_using_your_sign_in_email")], false) : ''])], false)], false);
}
export function readClientRoute(location) {
  const match = location.pathname.match(/^\/client\/projects\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) return null;
  const query = new URLSearchParams(location.search);
  return {
    projectId: match[1],
    iteration: query.get('iteration'),
    slide: query.get('slide'),
    ...query.get('view') === 'scroll' ? {
      presentationMode: 'scroll'
    } : {}
  };
}
export function clientProjectUrl(project, iteration, slide, presentationMode) {
  const query = new URLSearchParams();
  if (iteration) query.set('iteration', iteration);
  if (slide) query.set('slide', slide);
  if (presentationMode === 'scroll') query.set('view', 'scroll');
  return domView.concat(domView.concat('/client/projects/', encodeURIComponent(project)), query.size ? domView.concat('?', query) : '');
}
