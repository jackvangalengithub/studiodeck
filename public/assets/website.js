import {safeUrl, e} from './dom.js';
import * as domView from "./render.js";
import {platformUrl} from './platform/files.js';
import {studioBusiness, studioTypes} from './studio-business.js';
import {getLanguage} from './i18n.js';
export function websiteUi({state, api, esc, button, openModal, closeModal, render, toast, resourceHeaders}) {
  let data = null, studio = '', tab = 'chat', dirty = false, busy = false, message = '', source = null, portrait = '', pendingPrompt = '', galleryOpen = false, previewTemplate = '', sourceFile = 'index.html', previewChannel = '', previewReport = null, device = 'desktop', chatDraft = '', codeView = null, codeFilename = '', codeStates = {}, projectQuotes = null, businessFilter = '', styleFilter = 'all', publishTab = 'publish', publishChecks = null, materialsTab = 'projects', selectedPage = 'home', editScope = 'page', sourceScope = 'page';
  const freeze = value => document.querySelectorAll('.workspace,.website-workspace,.website-studio,.modal').forEach(el => {
    el.inert = value;
    el.setAttribute('aria-busy', String(value));
  });
  const copy = v => structuredClone(v), uid = () => crypto.randomUUID().replaceAll('-', '');
  const btn = (label, act, kind = '', extra = '') => button(label, domView.concat('website-', act), kind, extra);
  const field = (label, name, value, max = 160, area = false) => domView.element("label", [], [domView.fragment([label, area ? domView.element("textarea", [{
    "rows": "4"
  }, {
    "name": name
  }, {
    "maxlength": max
  }], [value], false) : domView.element("input", [{
    "name": name
  }, {
    "value": value
  }, {
    "maxlength": max
  }], [], false)])], false);
  const footer = label => domView.element("div", [{
    "class": "modal-footer"
  }], [button('Cancel', 'close-modal', 'ghost'), domView.element("button", [{
    "class": "button primary"
  }, {
    "type": "submit"
  }], [label], false)], false);
  const endpoint = (action, params = {}) => platformUrl({
    action,
    website_studio: state.studio.id,
    ...params
  });
  const asset = id => endpoint('website_asset', {
    id
  });
  async function load() {
    destroyCode();
    codeStates = {};
    const sid = state.studio.id;
    const result = await api('website');
    if (state.studio.id !== sid) return;
    data = result;
    studio = sid;
    selectedPage = 'home';
    sourceScope = 'page';
    editScope = 'page';
    businessFilter = studioBusiness(state.studio?.business_type).id;
    styleFilter = 'all';
    dirty = false;
    tab = 'chat';
    chatDraft = '';
    if (new URLSearchParams(location.search).get('website_checkout') === 'success') {
      message = 'Confirming your payment…';
      data = await api('website_refresh_billing');
      message = data.billing.active ? 'Website activated. You can now publish.' : 'Payment is processing. Use Check payment to refresh.';
    }
  }
  function accept(result) {
    if (result.studio_id !== state.studio.id) return;
    data = result;
    if (!enabledPages().some(p => p.id === selectedPage)) selectedPage = 'home';
    dirty = false;
    render();
  }
  async function save() {
    if (!dirty) return;
    accept(await api('website_save', {
      draft: data.draft,
      revision: data.revision
    }));
  }
  function destroyCode() {
    if (codeView) {
      codeStates[codeFilename] = codeView.state;
      codeView.destroy();
      codeView = null;
    }
  }
  function active() {
    return !!state.user && !state.client && state.tab === 'website' && state.websiteEditing && data?.draft.started && studio === state.studio?.id;
  }
  function page() {
    destroyCode();
    if (!data || studio !== state.studio.id) return domView.element("p", [], ["Opening your website…"], false);
    if (!data.draft.started) return welcome();
    if (active()) return editorPage();
    return domView.element("section", [{
      "class": "website-dashboard"
    }], [domView.element("div", [{
      "class": "page-heading"
    }], [domView.element("div", [], [domView.element("p", [{
      "class": "website-eyebrow"
    }], ["YOUR STUDIO WEBSITE"], false), domView.element("h1", [], ["A home for your work."], false), domView.element("p", [{
      "class": "muted"
    }], ["Shape your next chapter. Publish when it feels right."], false)], false), domView.element("div", [{
      "class": "website-dashboard-top-actions"
    }], [domView.fragment([btn('Edit website ↗', 'enter', 'ghost'), btn(data.live ? 'Publish changes' : 'Publish website', 'publish', 'primary')])], false)], false), domView.element("div", [{
      "class": "website-dashboard-grid"
    }], [domView.element("div", [{
      "class": "website-dashboard-preview"
    }], [domView.element("iframe", [{
      "title": "Saved website preview"
    }, {
      "tabindex": "-1"
    }, {
      "sandbox": domView.text([])
    }, {
      "src": endpoint('website_preview', {
        v: data.revision
      })
    }], [], false)], false), domView.element("aside", [{
      "class": "website-dashboard-details"
    }], [domView.element("span", [{
      "class": "tag"
    }], [data.live ? 'Website published' : 'Private draft'], false), domView.element("h2", [], [data.draft.name], false), domView.element("p", [], ["Your website changes only when you publish a new version."], false), domView.element("div", [{
      "class": "website-dashboard-actions"
    }], [data.live ? domView.element("a", [{
      "class": "button ghost"
    }, {
      "href": data.url
    }, {
      "target": "_blank"
    }, {
      "rel": "noopener"
    }], ["View live website ↗"], false) : ''], false), domView.element("hr", [], [], false), domView.element("p", [], ["Try a different direction"], false), domView.fragment([btn('Browse starting designs', 'gallery', 'ghost'), btn('Start from scratch', 'reset', 'ghost')])], false)], false)], false);
  }
  const pageFile = (id, ext = 'html') => id === 'home' && ext === 'html' ? 'index.html' : domView.text(["pages/", id, ".", ext, ""]);
  const enabledPages = () => data.draft.pages.filter(p => p.kind !== 'project' || data.draft.projects.some(project => project.id === p.project && project.included));
  const currentPage = () => data.draft.pages.find(p => p.id === selectedPage) || data.draft.pages[0];
  const sharedLayout = () => Object.hasOwn(data.draft.files, 'header.html');
  function editableFiles() {
    return !sharedLayout() ? ['index.html', 'styles.css', 'script.js'] : sourceScope === 'shared' ? ['header.html', 'footer.html', 'styles.css', 'script.js'] : ['html', 'css', 'js'].map(ext => pageFile(selectedPage, ext));
  }
  function pageToolbar() {
    return domView.element("div", [{
      "class": "website-page-toolbar"
    }], [domView.element("label", [], ["Page", domView.element("select", [{
      "data-website-page": domView.text([])
    }, {
      "aria-label": "Website page"
    }], [domView.join(enabledPages().map(p => domView.element("option", [{
      "value": p.id
    }, domView.spread(selectedPage === p.id ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [p.name], false)), '')], false)], false), domView.element("div", [], [domView.fragment([btn('Add page', 'add-page', 'small'), btn('Manage pages', 'pages', 'small ghost')])], false)], false);
  }
  async function selectPage(id, fragment = '') {
    if (!enabledPages().some(p => p.id === id)) return;
    await save();
    destroyCode();
    selectedPage = id;
    sourceScope = 'page';
    sourceFile = pageFile(id);
    render();
    const frame = document.querySelector('.website-preview iframe');
    if (frame && fragment) frame.src = safeUrl(frame.src + domView.concat('#', encodeURIComponent(fragment)), 'src');
  }
  function managePages() {
    openModal('Your website pages', domView.element("div", [{
      "class": "website-pages-dialog"
    }], [domView.element("div", [{
      "class": "website-materials-toolbar"
    }], [domView.element("p", [], ["Every page shares your website’s header, footer and design. Change the order here to arrange your menu."], false), btn('Add page', 'add-page', 'primary small')], false), domView.element("div", [{
      "class": "website-page-list"
    }], [domView.join(data.draft.pages.map((p, i) => domView.element("article", [{
      "class": "website-page-card"
    }], [domView.element("div", [], [domView.element("h3", [], [p.name], false), domView.element("p", [], [domView.fragment(["/", p.slug, p.slug ? '/' : ''])], false), domView.element("small", [], [domView.fragment([enabledPages().some(a => a.id === p.id) ? p.navigation ? 'In navigation' : 'Hidden from navigation' : 'Project hidden from website', p.kind === 'project' ? ' · Connected project' : ''])], false)], false), domView.element("div", [{
      "class": "website-page-actions"
    }], [domView.fragment([btn('Open', 'open-page', 'small', domView.attributes([{
      "data-id": p.id
    }, domView.spread(enabledPages().some(a => a.id === p.id) ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))])), btn('Page details', 'page-details', 'small ghost', domView.attributes([{
      "data-id": p.id
    }])), p.kind !== 'project' ? btn('Duplicate', 'duplicate-page', 'small ghost', domView.attributes([{
      "data-id": p.id
    }])) : '', btn('↑', 'move-page', 'small ghost', domView.attributes([{
      "data-id": p.id
    }, {
      "data-direction": "-1"
    }, {
      "aria-label": domView.text(["Move ", p.name, " up"])
    }, domView.spread(i ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))])), btn('↓', 'move-page', 'small ghost', domView.attributes([{
      "data-id": p.id
    }, {
      "data-direction": "1"
    }, {
      "aria-label": domView.text(["Move ", p.name, " down"])
    }, domView.spread(i === data.draft.pages.length - 1 ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')])), p.id !== 'home' ? btn('Delete', 'delete-page', 'small ghost', domView.attributes([{
      "data-id": p.id
    }])) : ''])], false)], false)), '')], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button('Done', 'close-modal', 'ghost')], false)], false), true);
  }
  const slugify = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function pageForm(operation = 'add', id = '', project = '') {
    const p = data.draft.pages.find(p => p.id === id), item = data.draft.projects.find(p => p.id === project), name = operation === 'update' ? p.name : operation === 'duplicate' ? domView.concat(p.name, ' copy') : item?.title || 'About', slug = operation === 'update' ? p.slug : item ? domView.concat('work/', slugify(name)) : slugify(name);
    openModal(operation === 'update' ? 'Page details' : operation === 'duplicate' ? 'Duplicate page' : 'Add a page', domView.element("form", [{
      "data-form": "website-page"
    }, {
      "data-operation": operation
    }, {
      "data-id": id
    }, {
      "data-project": project
    }], [domView.fragment([operation === 'add' && !project ? domView.fragment([domView.element("label", [], ["Start with", domView.element("select", [{
      "name": "kind"
    }, {
      "data-website-page-kind": domView.text([])
    }], [domView.element("option", [{
      "value": "about"
    }], ["About"], false), domView.element("option", [{
      "value": "contact"
    }], ["Contact"], false), domView.element("option", [{
      "value": "projects"
    }], ["Projects"], false), domView.element("option", [{
      "value": "custom"
    }], ["Blank page"], false)], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], ["The Projects layout lists your connected projects automatically."], false)]) : '', field('Page name', 'name', name, 120), id === 'home' && operation === 'update' ? domView.element("p", [], ["Home is always at /."], false) : field('Page address', 'slug', slug, 120)]), domView.element("p", [{
      "class": "form-hint"
    }], [project ? 'This page uses your reviewed project text, images and testimonials. Update them in your website library.' : 'Addresses look like /contact/ or /work/our-story/.'], false), domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "navigation"
    }, domView.spread(operation === 'update' ? p.navigation ? domView.attributes([{
      "checked": domView.text([])
    }]) : '' : project ? '' : domView.attributes([{
      "checked": domView.text([])
    }]))], [], false), " Show in navigation"], false), footer(operation === 'update' ? 'Save page details' : 'Create page')], false));
  }
  async function changePage(values) {
    await save();
    const result = await api('website_page', {
      ...values,
      revision: data.revision
    });
    destroyCode();
    selectedPage = result.page;
    sourceScope = 'page';
    sourceFile = pageFile(selectedPage);
    accept(result.website);
    return result;
  }
  function editorPage() {
    previewChannel = uid();
    previewReport = null;
    return domView.element("main", [{
      "class": "website-studio"
    }, {
      "id": "main"
    }, domView.spread(busy ? domView.attributes([{
      "inert": domView.text([])
    }, {
      "aria-busy": "true"
    }]) : '')], [domView.element("header", [{
      "class": "website-editor-top"
    }], [domView.element("div", [{
      "class": "website-editor-identity"
    }], [btn('← Back to studio', 'leave', 'small ghost'), domView.element("span", [], [data.draft.name], false)], false), domView.element("div", [{
      "class": "website-device-switch"
    }, {
      "role": "group"
    }, {
      "aria-label": "Preview size"
    }], [domView.fragment([btn('Desktop', 'device', domView.concat('small ', device === 'desktop' ? 'active' : ''), domView.attributes([{
      "data-size": "desktop"
    }, {
      "aria-pressed": device === 'desktop'
    }])), btn('Mobile', 'device', domView.concat('small ', device === 'mobile' ? 'active' : ''), domView.attributes([{
      "data-size": "mobile"
    }, {
      "aria-pressed": device === 'mobile'
    }]))])], false), domView.element("div", [{
      "class": "website-editor-actions"
    }], [btn('Add your projects & testimonials', 'manage-projects', 'primary small')], false)], false), domView.element("div", [{
      "class": domView.text(["website-editor-layout ", tab === 'source' ? 'source-mode' : ''])
    }], [domView.element("section", [{
      "class": domView.text(["website-preview ", device === 'mobile' ? 'mobile' : ''])
    }, {
      "aria-label": "Website preview"
    }], [pageToolbar(), domView.element("div", [{
      "class": "website-preview-canvas"
    }], [domView.element("iframe", [{
      "title": "Your website draft"
    }, {
      "sandbox": "allow-scripts allow-popups"
    }, {
      "src": endpoint('website_preview', {
        v: data.revision,
        channel: previewChannel,
        page: selectedPage
      })
    }], [], false)], false), domView.element("footer", [], [domView.element("span", [{
      "class": "website-preview-health"
    }, {
      "role": "status"
    }], ["Checking preview…"], false), domView.element("span", [], ["Private draft"], false)], false)], false), domView.element("aside", [{
      "class": "website-editor-panel"
    }], [domView.element("nav", [{
      "class": "website-editor-panelbar"
    }, {
      "aria-label": "Editing tools"
    }], [domView.element("div", [], [domView.fragment([btn('Chat', 'tab', tab === 'chat' ? 'active' : 'ghost', domView.attributes([{
      "data-tab": "chat"
    }, {
      "aria-pressed": tab === 'chat'
    }])), btn('Code', 'tab', tab === 'source' ? 'active' : 'ghost', domView.attributes([{
      "data-tab": "source"
    }, {
      "aria-pressed": tab === 'source'
    }]))])], false), domView.element("div", [], [domView.fragment([btn('Undo', 'undo', 'small ghost', data.can_undo ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])), btn('Save draft', 'save', 'small', dirty ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))])], false)], false), domView.element("div", [{
      "class": "website-status"
    }, {
      "role": "status"
    }], [domView.element("span", [], [dirty ? 'Unsaved changes · Save to refresh preview' : 'Draft saved'], false)], false), domView.element("div", [{
      "class": "website-editor-panel-content"
    }], [tab === 'source' ? sourcePanel(data.draft) : chatPanel(data.draft)], false)], false)], false)], false);
  }
  async function afterRender() {
    const host = document.querySelector('[data-website-code-host]');
    if (!host || !active() || tab !== 'source') return;
    try {
      const {mountEditor} = await import('./vendor/website-editor.js');
      if (!host.isConnected || codeView) return;
      const file = sourceFile, fresh = !codeStates[file] || codeStates[file].doc.toString() !== data.draft.files[file];
      const value = data.draft.files[file];
      let formatted;
      if (fresh) {
        try {
          const {formatSource} = await import('./vendor/website-formatter.js');
          formatted = await formatSource(file, value);
        } catch {}
      }
      if (!host.isConnected || codeView || data.draft.files[file] !== value) return;
      codeFilename = file;
      host.replaceChildren();
      codeView = mountEditor(host, {
        filename: file,
        value,
        formatted,
        state: codeStates[file],
        onChange: value => updateSource(file, value),
        onFormat: () => {
          if (!busy) action('website-format-source', document.querySelector('[data-action="website-format-source"]')).catch(e => toast(e.message));
        },
        onSave: () => {
          if (!busy) action('website-save', document.querySelector('[data-action="website-save"]')).catch(e => toast(e.message));
        }
      });
    } catch (e) {
      domView.mount(host, domView.element("label", [], [sourceFile, domView.element("textarea", [{
        "class": "website-code"
      }, {
        "data-website-file": sourceFile
      }, {
        "aria-label": domView.text([sourceFile, " source"])
      }], [data.draft.files[sourceFile]], false)], false));
      toast('The code editor could not load. Plain-text editing is available.');
    }
  }
  function updateSource(file, value) {
    data.draft.files[file] = value;
    dirty = true;
    const status = document.querySelector('.website-status span');
    if (status) status.textContent = 'Unsaved changes · Save to refresh preview';
    document.querySelectorAll('[data-action="website-save"]').forEach(b => b.disabled = false);
  }
  function switchPanel(next) {
    destroyCode();
    tab = next;
    const layout = document.querySelector('.website-editor-layout');
    if (!layout) {
      render();
      return;
    }
    layout.classList.toggle('source-mode', tab === 'source');
    document.querySelectorAll('[data-action="website-tab"]').forEach(b => {
      const selected = b.dataset.tab === tab;
      b.classList.toggle('active', selected);
      b.classList.toggle('ghost', !selected);
      b.setAttribute('aria-pressed', String(selected));
    });
    domView.mount(document.querySelector('.website-editor-panel-content'), tab === 'source' ? sourcePanel(data.draft) : chatPanel(data.draft));
    afterRender();
  }
  const wt = (en, nl) => getLanguage() === 'nl' ? nl : en;
  const templateStyles = [['all', 'All styles', 'Alle stijlen'], ['modern', 'Modern', 'Modern'], ['classic', 'Classic', 'Klassiek'], ['minimal', 'Minimal', 'Minimalistisch'], ['editorial', 'Editorial', 'Redactioneel'], ['organic', 'Organic', 'Organisch'], ['experimental', 'Experimental', 'Experimenteel']];
  function filteredTemplates() {
    return data.templates.filter(t => t.id === 'blank' || (businessFilter === 'all' || t.business_types.includes(businessFilter)) && (styleFilter === 'all' || t.styles.includes(styleFilter))).sort((a, b) => Number(a.id === 'blank') - Number(b.id === 'blank'));
  }
  function galleryFilters() {
    return domView.element("div", [{
      "class": "website-gallery-filters"
    }], [domView.element("label", [], [wt('Business type', 'Type bedrijf'), domView.element("select", [{
      "data-website-filter": "business"
    }], [domView.element("option", [{
      "value": "all"
    }, domView.spread(businessFilter === 'all' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [wt('All businesses', 'Alle bedrijven')], false), domView.join(studioTypes.map(b => domView.element("option", [{
      "value": b.id
    }, domView.spread(businessFilter === b.id ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [studioBusiness(b.id).label], false)), '')], false)], false), domView.element("div", [{
      "class": "website-style-filters"
    }, {
      "role": "group"
    }, {
      "aria-label": wt('Design style', 'Ontwerpstijl')
    }], [domView.join(templateStyles.map(([id, en, nl]) => btn(wt(en, nl), 'filter-style', domView.concat('small ', styleFilter === id ? 'active' : 'ghost'), domView.attributes([{
      "data-style": id
    }, {
      "aria-pressed": styleFilter === id
    }]))), '')], false), domView.element("p", [{
      "class": "website-gallery-count"
    }, {
      "role": "status"
    }], [domView.fragment([filteredTemplates().length, " ", wt('starting points', 'startpunten')])], false)], false);
  }
  function welcome() {
    const b = studioBusiness(state.studio?.business_type);
    return domView.element("section", [{
      "class": "website-welcome"
    }], [domView.element("div", [{
      "class": "website-welcome-copy"
    }], [domView.element("p", [{
      "class": "website-eyebrow"
    }], [wt('YOUR STUDIO, OUT IN THE WORLD', 'JOUW STUDIO, KLAAR VOOR DE WERELD')], false), domView.element("h1", [], [wt('Good work deserves<br>a beautiful home.', 'Mooi werk verdient<br>een mooie plek.')], false), domView.element("p", [], [wt('Start with a design you love. Make it entirely your own, simply by describing what you have in mind.', 'Begin met een ontwerp dat je aanspreekt. Maak het helemaal eigen door te vertellen wat je voor ogen hebt.')], false), domView.element("div", [{
      "class": "row"
    }], [btn(wt('Find your starting point ↗', 'Vind jouw startpunt ↗'), 'gallery', 'primary')], false), domView.element("span", [], [domView.fragment([wt('Starting designs selected for', 'Startontwerpen geselecteerd voor'), " ", b.label.toLocaleLowerCase(), "."])], false)], false), domView.element("div", [{
      "class": "website-welcome-art"
    }, {
      "aria-hidden": "true"
    }], [domView.element("div", [{
      "class": "website-cover-frame"
    }], [domView.element("small", [], [b.label], false), domView.element("h2", [], [b.headline], false), domView.element("img", [{
      "src": b.image
    }, {
      "alt": domView.text([])
    }], [], false), domView.element("span", [], [b.description], false)], false), domView.element("div", [{
      "class": "website-cover-note"
    }], [wt('Your story.<br>Your point of view.', 'Jouw verhaal.<br>Jouw blik.')], false)], false)], false);
  }
  function chatPanel(d) {
    return domView.element("section", [{
      "class": "website-chat"
    }], [domView.element("div", [{
      "class": "row"
    }], [domView.element("h2", [], ["Make it yours."], false)], false), domView.element("p", [], ["Describe any change: a new layout, your updated address, an image gallery, or a project you’d like to add."], false), domView.element("div", [{
      "class": "website-conversation"
    }], [domView.join((d.conversation || []).map(m => domView.element("div", [{
      "class": domView.text(["website-chat-bubble ", m.role])
    }], [domView.element("small", [], [m.role === 'user' ? 'You' : 'Website assistant'], false), domView.element("p", [], [m.text], false)], false)), '')], false), domView.element("form", [{
      "data-form": "website-chat"
    }], [sharedLayout() ? domView.element("label", [], ["Edit scope", domView.element("select", [{
      "name": "scope"
    }, {
      "data-website-edit-scope": domView.text([])
    }], [domView.element("option", [{
      "value": "page"
    }, domView.spread(editScope === 'page' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [domView.fragment(["This page · ", currentPage().name])], false), domView.element("option", [{
      "value": "shared"
    }, domView.spread(editScope === 'shared' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], ["Shared design · all pages"], false)], false)], false) : '', domView.element("label", [{
      "for": "website-prompt"
    }], ["What would you like to change?"], false), domView.element("textarea", [{
      "id": "website-prompt"
    }, {
      "name": "prompt"
    }, {
      "rows": "5"
    }, {
      "maxlength": "4000"
    }, {
      "placeholder": "Make this feel like an architectural magazine…"
    }, domView.spread(data.ai ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])), {
      "required": domView.text([])
    }], [chatDraft], false), domView.element("button", [{
      "class": "button primary"
    }, {
      "type": "submit"
    }, domView.spread(data.ai ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))], ["Update my draft ↗"], false), domView.element("small", [], [data.ai ? domView.concat(data.ai_remaining, ' edits left this month') : 'AI is not connected. You can edit the files in Code.'], false)], false), domView.element("div", [{
      "class": "website-prompt-ideas"
    }], [domView.join(['Make the layout more editorial', 'Add a project from StudioDeck', 'Update my studio address'].map(p => btn(p, 'prompt', 'small ghost', domView.attributes([{
      "data-prompt": p
    }]))), '')], false), domView.element("p", [{
      "class": "website-chat-message"
    }, {
      "role": "status"
    }], [message], false)], false);
  }
  function sourcePanel(d) {
    const files = editableFiles();
    if (!files.includes(sourceFile)) sourceFile = files[0];
    return domView.element("section", [{
      "class": "website-source-panel"
    }], [sharedLayout() ? domView.fragment([domView.element("div", [{
      "class": "website-code-scope"
    }, {
      "role": "group"
    }, {
      "aria-label": "Code scope"
    }], [domView.fragment([btn(currentPage().name, 'source-scope', domView.concat('small ', sourceScope === 'page' ? 'active' : 'ghost'), domView.attributes([{
      "data-scope": "page"
    }])), btn('Shared design', 'source-scope', domView.concat('small ', sourceScope === 'shared' ? 'active' : 'ghost'), domView.attributes([{
      "data-scope": "shared"
    }]))])], false), domView.element("p", [{
      "class": "form-hint"
    }], [sourceScope === 'shared' ? 'Changes here apply to every page. Menu links are managed in Pages.' : 'Changes here apply to this page. Keep the shared header and footer markers.'], false)]) : '', domView.element("div", [{
      "class": "website-file-tabs"
    }, {
      "role": "group"
    }, {
      "aria-label": "Website files"
    }], [domView.join(files.map(f => btn(sharedLayout() && sourceScope === 'page' ? ({
      'html': 'Page HTML',
      'css': 'Page CSS',
      'js': 'Page JavaScript'
    })[f.split('.').pop()] : f, 'file', domView.concat('small ', sourceFile === f ? 'active' : 'ghost'), domView.attributes([{
      "data-file": f
    }, {
      "aria-pressed": sourceFile === f
    }]))), '')], false), domView.element("div", [{
      "class": "website-code-host"
    }, {
      "data-website-code-host": domView.text([])
    }], [domView.element("p", [], ["Opening code editor…"], false)], false), domView.element("footer", [{
      "class": "website-source-footer"
    }], [domView.element("span", [], ["HTML / CSS / JavaScript · Ctrl/⌘ S to save · Ctrl/⌘ F to find · Shift+Alt+F to format"], false), domView.element("div", [{
      "class": "row wrap"
    }], [domView.fragment([btn('Save & preview', 'save', 'small primary'), btn('Format code', 'format-source', 'small ghost', domView.attributes([{
      "title": "Format code (Shift+Alt+F)"
    }])), btn('Copy file', 'copy-source', 'small ghost')]), domView.element("label", [{
      "class": "website-file-import button small ghost"
    }], ["Import files", domView.element("input", [{
      "type": "file"
    }, {
      "data-website-files": domView.text([])
    }, {
      "multiple": domView.text([])
    }, {
      "accept": ".html,.css,.js"
    }], [], false)], false), btn('Images', 'images', 'small ghost')], false), domView.join([...data.checks?.errors || [], ...data.checks?.warnings || []].map(m => domView.element("p", [{
      "class": "form-hint"
    }], [m], false)), '')], false)], false);
  }
  function imageLibrary() {
    return domView.fragment([domView.element("p", [], ["Use these paths in your source. Images are optimized when published."], false), domView.join([...new Set([data.draft.hero_asset, data.draft.logo, ...data.draft.projects.flatMap(p => p.images.map(im => im.asset)), ...data.draft.testimonials.map(t => t.photo)].filter(Boolean))].map(id => domView.element("div", [{
      "class": "website-asset-reference"
    }], [domView.element("img", [{
      "src": asset(id)
    }, {
      "alt": domView.text([])
    }], [], false), domView.element("code", [], [domView.fragment(["assets/", id, ".webp"])], false)], false)), '')]);
  }
  function manageProjects(next = materialsTab) {
    materialsTab = next;
    const isProjects = materialsTab === 'projects';
    openModal('Your projects & testimonials', domView.element("div", [{
      "class": "website-materials-dialog"
    }], [domView.element("div", [{
      "class": "website-materials-tabs"
    }, {
      "role": "tablist"
    }, {
      "aria-label": "Website content"
    }], [domView.join([['projects', 'Projects'], ['testimonials', 'Testimonials']].map(([id, label]) => btn(domView.fragment([domView.fragment([label, " "]), domView.element("span", [{
      "aria-hidden": "true"
    }], [data.draft[id].length], false)]), 'materials-tab', materialsTab === id ? 'active' : 'ghost', domView.attributes([{
      "data-tab": id
    }, {
      "role": "tab"
    }, {
      "id": domView.text(["website-materials-tab-", id])
    }, {
      "aria-selected": materialsTab === id
    }, {
      "aria-controls": "website-materials-panel"
    }, {
      "tabindex": materialsTab === id ? '0' : '-1'
    }]))), '')], false), domView.element("div", [{
      "class": "website-materials-panel"
    }, {
      "id": "website-materials-panel"
    }, {
      "role": "tabpanel"
    }, {
      "aria-labelledby": domView.text(["website-materials-tab-", materialsTab])
    }], [domView.element("div", [{
      "class": "website-materials-toolbar"
    }], [domView.element("p", [], [isProjects ? 'Choose the work you want to share on your website.' : 'Share the words of the people you work with.'], false), isProjects ? btn('Add project', 'choose-project', 'primary small') : btn('Add testimonial', 'testimonial', 'primary small')], false), domView.element("div", [{
      "class": "website-materials-list"
    }, {
      "tabindex": "0"
    }, {
      "aria-label": isProjects ? 'Connected projects' : 'Website testimonials'
    }], [isProjects ? projects(data.draft) : testimonials(data.draft)], false)], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button('Done', 'close-modal', 'ghost')], false)], false), true);
  }
  function renderGallery() {
    document.getElementById('website-gallery')?.remove();
    if (!galleryOpen) return;
    const selected = data.templates.find(t => t.id === previewTemplate);
    const node = document.createElement('div');
    node.id = 'website-gallery';
    node.className = 'website-gallery-overlay';
    node.setAttribute('role', 'dialog');
    node.setAttribute('aria-modal', 'true');
    node.setAttribute('aria-label', selected ? domView.concat(selected.name, ' full-screen preview') : 'Choose your starting point');
    domView.mount(node, selected ? domView.fragment([domView.element("header", [], [domView.element("div", [], [domView.element("strong", [], [selected.name], false), domView.element("span", [], [domView.fragment([selected.description, " · Example content"])], false)], false), domView.element("div", [{
      "class": "row"
    }], [domView.fragment([btn('All designs', 'gallery-back', 'ghost'), btn('Use this starting point', 'choose-template', 'primary', domView.attributes([{
      "data-template": selected.id
    }])), btn('Close', 'gallery-close', 'ghost')])], false)], false), domView.element("iframe", [{
      "class": "website-full-example"
    }, {
      "title": domView.text([selected.name, " full-screen example"])
    }, {
      "sandbox": "allow-scripts"
    }, {
      "src": endpoint('website_template_preview', {
        template: selected.id
      })
    }], [], false)]) : domView.fragment([domView.element("header", [], [domView.element("div", [], [domView.element("p", [{
      "class": "website-eyebrow"
    }], ["YOUR NEXT CHAPTER"], false), domView.element("h2", [], ["Find your starting point."], false), domView.element("p", [], [wt('Explore every design. Find a style that feels like you.', 'Ontdek alle ontwerpen. Vind een stijl die bij je past.')], false)], false), btn('Close', 'gallery-close', 'ghost')], false), galleryFilters(), domView.element("div", [{
      "class": "website-template-grid"
    }], [domView.join(filteredTemplates().map(t => domView.element("article", [{
      "class": domView.text(["website-example-card ", t.tone])
    }], [domView.element("button", [{
      "class": "website-example-preview"
    }, {
      "data-action": "website-example"
    }, {
      "data-template": t.id
    }, {
      "aria-label": domView.text(["Preview ", t.name, " full screen"])
    }], [domView.element("iframe", [{
      "title": domView.text([t.name, " thumbnail"])
    }, {
      "tabindex": "-1"
    }, {
      "loading": "lazy"
    }, {
      "sandbox": domView.text([])
    }, {
      "src": endpoint('website_template_preview', {
        template: t.id
      })
    }], [], false), domView.element("span", [], ["Explore full screen ↗"], false)], false), domView.element("div", [{
      "class": "website-example-caption"
    }], [domView.element("div", [], [domView.element("h3", [], [t.name], false), t.recommended ? domView.element("span", [{
      "class": "website-recommendation"
    }], [wt('Selected for your studio', 'Geselecteerd voor jouw studio')], false) : '', domView.element("p", [], [t.description], false), domView.element("div", [{
      "class": "website-template-tags"
    }], [domView.join(t.styles.map(id => domView.element("span", [], [wt(...templateStyles.find(style => style[0] === id).slice(1))], false)), '')], false)], false), btn('Choose', 'choose-template', 'small', domView.attributes([{
      "data-template": t.id
    }]))], false)], false)), '')], false)]));
    document.body.append(node);
    node.querySelector('button')?.focus();
  }
  async function chooseTemplate(id) {
    await save();
    galleryOpen = false;
    renderGallery();
    if (data.draft.started) {
      openModal('Use a new starting point?', domView.fragment([domView.element("p", [], ["This replaces the draft design and keeps your project materials. Your current live website stays unchanged. You can undo this choice."], false), domView.element("div", [{
        "class": "modal-footer"
      }], [domView.fragment([button('Keep my design', 'close-modal', 'ghost'), btn('Replace draft design', 'start', 'primary', domView.attributes([{
        "data-template": id
      }]))])], false)]));
    } else {
      state.websiteEditing = true;
      accept(await api('website_start', {
        template: id,
        revision: data.revision
      }));
      tab = 'chat';
      render();
    }
  }
  async function checkViewport(width, page) {
    return new Promise(resolve => {
      const channel = uid(), frame = e('iframe', {sandbox:'allow-scripts'});
      frame.style.cssText = domView.text(["position:fixed;left:-20000px;top:0;width:", width, "px;height:900px;border:0"]);
      frame.title = 'Website publication check';
      let timer;
      const done = result => {
        clearTimeout(timer);
        window.removeEventListener('message', receive);
        frame.remove();
        resolve({
          ...result,
          width,
          page: page.name
        });
      };
      const receive = e => {
        if (e.source === frame.contentWindow && e.data?.type === 'website-preview-report' && e.data.channel === channel) done(e.data);
      };
      window.addEventListener('message', receive);
      timer = setTimeout(() => done({
        errors: ['Preview checks timed out. Please try again.']
      }), 12000);
      frame.src = safeUrl(endpoint('website_preview', {
        v: data.revision,
        channel,
        page: page.id
      }), 'src');
      document.body.append(frame);
    });
  }
  function projects(d) {
    return domView.join(d.projects.map(p => domView.element("article", [{
      "class": "website-material-card"
    }], [domView.element("div", [{
      "class": "website-material-summary"
    }], [p.images[0] ? domView.element("img", [{
      "class": "website-material-cover"
    }, {
      "src": asset(p.images[0].asset)
    }, {
      "alt": domView.text([])
    }, {
      "loading": "lazy"
    }], [], false) : domView.element("span", [{
      "class": "website-material-placeholder"
    }, {
      "aria-hidden": "true"
    }], ["↗"], false), domView.element("div", [], [domView.element("h3", [], [p.title], false), domView.element("p", [], [domView.fragment([p.images.length, " ", p.images.length === 1 ? 'photo' : 'photos', p.category ? domView.concat(' · ', p.category) : ''])], false), domView.element("span", [{
      "class": domView.text(["website-material-status ", p.included ? 'included' : ''])
    }], [p.included ? 'Included in draft' : 'Hidden from draft'], false)], false)], false), domView.element("div", [{
      "class": "website-material-actions"
    }], [domView.fragment([btn('Edit', 'edit-project', 'small', domView.attributes([{
      "data-id": p.id
    }])), btn(data.draft.pages.some(page => page.project === p.id) ? 'Open project page' : 'Create project page', 'project-page', 'small ghost', domView.attributes([{
      "data-id": p.id
    }, domView.spread(p.included ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))])), btn(p.included ? 'Hide' : 'Include', 'toggle-project', 'small ghost', domView.attributes([{
      "data-id": p.id
    }])), data.projects.some(s => s.id === p.source_id) ? domView.text(["", btn('Update from project', 'import', 'small ghost', domView.attributes([{
      "data-id": p.source_id
    }])), "", btn('Project testimonials', 'project-testimonials', 'small ghost', domView.attributes([{
      "data-project": p.source_id
    }])), ""]) : domView.element("span", [{
      "class": "website-material-note"
    }], ["Independent website copy"], false)])], false)], false)), '') || domView.element("div", [{
      "class": "website-material-empty"
    }], [domView.element("h3", [], ["Your work belongs here."], false), domView.element("p", [], ["Add a project and choose the photos and details to share."], false)], false);
  }
  function testimonials(d) {
    return domView.join(d.testimonials.map(t => domView.element("article", [{
      "class": "website-material-card"
    }], [domView.element("div", [{
      "class": "website-material-summary"
    }], [t.photo ? domView.element("img", [{
      "class": "website-material-avatar"
    }, {
      "src": asset(t.photo)
    }, {
      "alt": domView.text([])
    }, {
      "loading": "lazy"
    }], [], false) : domView.element("span", [{
      "class": "website-material-placeholder quote"
    }, {
      "aria-hidden": "true"
    }], ["“"], false), domView.element("div", [], [domView.element("h3", [], [t.name], false), t.title ? domView.element("p", [], [t.title], false) : '', domView.element("span", [{
      "class": domView.text(["website-material-status ", t.approved ? 'included' : ''])
    }], [t.approved ? 'Approved for publication' : 'Private draft'], false)], false)], false), domView.element("blockquote", [{
      "class": "website-material-quote"
    }], [t.content], false), domView.element("p", [{
      "class": "website-material-note"
    }], [d.projects.find(p => p.id === t.project)?.title || 'Studio testimonial'], false), domView.element("div", [{
      "class": "website-material-actions"
    }], [domView.fragment([btn('Edit', 'testimonial', 'small', domView.attributes([{
      "data-id": t.id
    }])), btn('Remove', 'remove-testimonial', 'small ghost', domView.attributes([{
      "data-id": t.id
    }]))])], false)], false)), '') || domView.element("div", [{
      "class": "website-material-empty"
    }], [domView.element("h3", [], ["Let your clients tell the story."], false), domView.element("p", [], ["Add a testimonial, or select approved quotes when adding a project."], false)], false);
  }
  function publishingContent() {
    const domain = data.domain;
    if (publishTab === 'domain') return domView.fragment([domView.element("form", [{
      "data-form": "website-domain"
    }], [field('Custom domain', 'name', domain.name, 253), domView.element("p", [{
      "class": "form-hint"
    }], ["Use a www address, such as www.yourstudio.com."], false), domView.element("button", [{
      "class": "button"
    }, {
      "type": "submit"
    }], [domain.name ? 'Check connection' : 'Set domain'], false)], false), domain.name ? domView.element("div", [{
      "class": "website-dns"
    }], [domView.element("p", [], [domain.verified ? 'Domain verified. Publish to use this address.' : 'Add these DNS records, then check the connection.'], false), domView.element("dl", [], [domView.element("dt", [], [domView.fragment(["CNAME · ", domain.name])], false), domView.element("dd", [], [domain.target || 'Hosting connection not configured'], false), domView.element("dt", [], [domView.fragment(["TXT · _studiodeck.", domain.name])], false), domView.element("dd", [], [domain.token], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], ["Keep your existing email DNS records. DNS changes can take time to appear."], false)], false) : '']);
    if (publishTab === 'versions') return domView.fragment([domView.element("div", [{
      "class": "website-version-heading"
    }], [domView.element("p", [], ["Restore a version to your draft, then publish when ready."], false), data.live ? domView.element("a", [{
      "class": "button small ghost"
    }, {
      "href": endpoint('website_export')
    }], ["Download live website (.zip)"], false) : ''], false), domView.element("ol", [{
      "class": "website-version-list"
    }], [domView.join(data.releases.map((r, i) => domView.element("li", [{
      "class": domView.text(["website-version ", r.id === data.live?.release ? 'current' : ''])
    }], [domView.element("div", [], [domView.element("div", [{
      "class": "website-version-title"
    }], [domView.element("strong", [], [domView.fragment(["Version ", data.releases.length - i])], false), r.id === data.live?.release ? domView.element("span", [{
      "class": "tag"
    }], ["Live"], false) : ''], false), domView.element("time", [{
      "datetime": r.created_at
    }], [new Date(r.created_at).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    })], false)], false), btn('Restore to draft', 'restore', 'small ghost', domView.attributes([{
      "data-id": r.id
    }]))], false)), '') || domView.element("li", [{
      "class": "website-versions-empty"
    }], ["No published versions yet. Your first publication will appear here."], false)], false)]);
    return domView.fragment([domView.element("div", [{
      "class": "website-publish-summary"
    }], [domView.element("span", [{
      "class": "tag"
    }], [data.live ? 'Published' : 'Private draft'], false), domView.element("h3", [], [data.draft.name], false), domView.element("p", [{
      "class": "website-url"
    }], [data.live ? domView.element("a", [{
      "href": data.url
    }, {
      "target": "_blank"
    }, {
      "rel": "noopener"
    }], [domView.fragment([data.url, " ↗"])], false) : data.url], false)], false), domView.element("p", [], [data.live ? 'Publish your saved draft to update the live website.' : 'Publish your saved draft at this address.'], false), domView.element("div", [{
      "class": "website-publish-checks"
    }, {
      "role": "status"
    }], [publishChecks?.checking ? domView.element("p", [], ["Checking desktop and mobile previews…"], false) : publishChecks ? domView.text(["", publishChecks.errors.length ? domView.element("p", [], ["Fix these issues in the editor before publishing."], false) : domView.element("p", [], ["Ready to publish."], false), "", domView.join(publishChecks.errors.map(error => domView.element("p", [{
      "class": "form-error"
    }], [error], false)), ''), "", domView.join(publishChecks.warnings.map(warning => domView.element("p", [{
      "class": "form-hint"
    }], [warning], false)), ''), ""]) : ''], false)]);
  }
  function showPublishing(next = publishTab) {
    publishTab = next;
    openModal('Publish website', domView.element("div", [{
      "class": "website-publish-dialog"
    }], [domView.element("div", [{
      "class": "website-publish-tabs"
    }, {
      "role": "tablist"
    }, {
      "aria-label": "Website publishing"
    }], [domView.join([['publish', 'Publish'], ['domain', 'Domain'], ['versions', 'Published versions']].map(([id, label]) => btn(label, 'publish-tab', publishTab === id ? 'active' : 'ghost', domView.attributes([{
      "data-tab": id
    }, {
      "role": "tab"
    }, {
      "id": domView.text(["website-publish-tab-", id])
    }, {
      "aria-selected": publishTab === id
    }, {
      "aria-controls": "website-publish-panel"
    }, {
      "tabindex": publishTab === id ? '0' : '-1'
    }]))), '')], false), domView.element("div", [{
      "class": "website-publish-content"
    }, {
      "id": "website-publish-panel"
    }, {
      "role": "tabpanel"
    }, {
      "aria-labelledby": domView.text(["website-publish-tab-", publishTab])
    }, {
      "tabindex": "0"
    }], [publishingContent()], false), domView.element("div", [{
      "class": "modal-footer"
    }], [domView.fragment([button('Close', 'close-modal', 'ghost'), publishTab === 'publish' ? publishChecks ? btn('Publish now', 'confirm-publish', 'primary', publishChecks.checking || publishChecks.errors.length ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '') : btn('Review & publish', 'review-publish', 'primary') : ''])], false)], false), true);
  }
  async function reviewPublication() {
    await save();
    publishChecks = {
      checking: true,
      errors: [],
      warnings: []
    };
    showPublishing('publish');
    const dialog = document.querySelector('.website-publish-dialog');
    dialog.inert = true;
    dialog.setAttribute('aria-busy', 'true');
    const checks = data.checks || ({
      errors: [],
      warnings: []
    });
    try {
      const results = [];
      if (!checks.errors.length) for (const page of enabledPages()) results.push(...await Promise.all([checkViewport(390, page), checkViewport(1280, page)]));
      publishChecks = {
        checking: false,
        revision: data.revision,
        errors: [...new Set([...checks.errors, ...results.flatMap(r => [...(r.errors || []).map(error => domView.text(["", r.page, " (", r.width, "px): ", error, ""])), ...r.missingImages ? [domView.text(["", r.page, ": Some images did not load."])] : []])])],
        warnings: [...checks.warnings, ...results.filter(r => r.overflow).map(r => domView.text(["", r.page, " overflows at ", r.width, "px. Review this layout before publishing."]))]
      };
    } catch (error) {
      publishChecks = {
        checking: false,
        errors: [error.message],
        warnings: []
      };
    }
    if (document.querySelector('.website-publish-dialog')) showPublishing();
  }
  async function importModal(pid, prompt = '') {
    pendingPrompt = prompt;
    await save();
    source = await api('website_sources', {
      project_id: pid
    });
    const previous = data.draft.projects.find(p => p.source_id === pid);
    openModal(previous ? 'Update public project copy' : 'Add project to website', domView.element("form", [{
      "data-form": "website-import"
    }], [domView.element("div", [{
      "class": "website-import-content"
    }], [domView.element("p", [], ["Review the public copy and select photographs. Private documents, budgets, and client details are never included automatically."], false), domView.fragment([field('Public title', 'title', source.project.title, 160), field('Public description', 'description', source.project.description, 6000, true)]), domView.element("p", [{
      "class": "form-hint"
    }], ["Updating replaces this website project’s title, description, and selected gallery. Its page anchor and visibility are kept."], false), domView.element("div", [{
      "class": "website-source-grid"
    }], [domView.join(source.images.map(im => domView.element("label", [{
      "class": "website-source"
    }], [domView.element("img", [{
      "loading": "lazy"
    }, {
      "src": endpoint('website_source_image', {
        project_id: pid,
        id: im.id
      })
    }, {
      "alt": domView.text([])
    }], [], false), domView.element("span", [], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "image"
    }, {
      "value": im.id
    }], [], false), domView.fragment([" ", im.title || 'Project image'])], false), domView.element("input", [{
      "name": domView.text(["alt_", im.id])
    }, {
      "maxlength": "250"
    }, {
      "placeholder": "Describe this image for visitors"
    }, {
      "aria-label": domView.text(["Image description for ", im.title])
    }, {
      "value": im.title
    }], [], false)], false)), '') || domView.element("p", [], ["No project photographs available. You can add images after importing."], false)], false), domView.element("fieldset", [{
      "class": "website-import-quotes"
    }], [domView.element("legend", [], ["Project testimonials"], false), domView.element("p", [{
      "class": "form-hint"
    }], ["Select the approved quotes to copy onto this website."], false), domView.join(source.testimonials.filter(t => Number(t.approved)).map(t => domView.element("label", [{
      "class": "website-quote-choice"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "testimonial"
    }, {
      "value": t.id
    }, domView.spread(previous && data.draft.testimonials.some(c => c.project === previous.id && c.source_testimonial === t.id) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), domView.element("span", [], [domView.element("strong", [], [t.name], false), domView.element("span", [], [t.content], false)], false)], false)), '') || domView.element("p", [], ["No approved testimonials yet. Add them in the project’s settings."], false)], false)], false), footer(previous ? 'Update draft copy' : 'Add to draft')], false), true);
  }
  function editProject(id) {
    const p = data.draft.projects.find(p => p.id === id);
    openModal('Website project', domView.element("form", [{
      "data-form": "website-project"
    }, {
      "data-id": id
    }], [domView.fragment([field('Public title', 'title', p.title, 160), field('Public description', 'description', p.description, 6000, true), field('Category', 'category', p.category, 80), field('Public location (optional)', 'location', p.location, 100)]), domView.element("div", [{
      "class": "website-edit-images"
    }], [domView.join(p.images.map((im, n) => domView.element("div", [], [domView.element("img", [{
      "src": asset(im.asset)
    }, {
      "alt": domView.text([])
    }], [], false), field('Image description', domView.concat('alt_', n), im.alt, 250), domView.element("label", [], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": domView.text(["remove_", n])
    }], [], false), " Remove from gallery"], false)], false)), '')], false), domView.element("label", [], ["Add gallery images", domView.element("input", [{
      "type": "file"
    }, {
      "name": "images"
    }, {
      "multiple": domView.text([])
    }, {
      "accept": "image/jpeg,image/png,image/webp"
    }], [], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], ["The first image is the project cover. New photographs are added at the end."], false), footer('Save public copy')], false), true);
  }
  function testimonialModal(id) {
    const t = data.draft.testimonials.find(t => t.id === id) || ({
      id: uid(),
      name: '',
      title: '',
      content: '',
      project: '',
      photo: '',
      video: '',
      placement: 'both',
      approved: false
    });
    portrait = t.photo;
    openModal('Client testimonial', domView.element("form", [{
      "data-form": "website-testimonial"
    }, {
      "data-id": t.id
    }], [domView.fragment([field('Name', 'name', t.name, 120), field('Title / role', 'title', t.title, 120), field('Quote', 'content', t.content, 2000, true), t.source_testimonial ? domView.fragment([domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "project"
    }, {
      "value": t.project
    }], [], false), domView.element("p", [], ["Project: ", domView.element("strong", [], [data.draft.projects.find(p => p.id === t.project)?.title || 'Project copy'], false)], false)]) : domView.element("label", [], ["Project (optional)", domView.element("select", [{
      "name": "project"
    }], [domView.element("option", [{
      "value": domView.text([])
    }, domView.spread(!t.project ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], ["Studio testimonial"], false), domView.join(data.draft.projects.map(p => domView.element("option", [{
      "value": p.id
    }, domView.spread(p.id === t.project ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [p.title], false)), '')], false)], false)]), domView.element("label", [], ["Placement", domView.element("select", [{
      "name": "placement"
    }], [domView.join([['both', 'Home and project page'], ['home', 'Home testimonials section'], ['project', 'With this project']].map(([id, label]) => domView.element("option", [{
      "value": id
    }, domView.spread(id === t.placement ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [label], false)), '')], false)], false), field('YouTube video link (optional)', 'video', t.video, 2048), domView.element("label", [], ["Photo (optional)", domView.element("input", [{
      "name": "photo"
    }, {
      "type": "file"
    }, {
      "accept": "image/jpeg,image/png,image/webp"
    }], [], false)], false), portrait ? domView.element("label", [], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "remove_photo"
    }], [], false), " Remove current photo"], false) : '', domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "name": "approved"
    }, {
      "type": "checkbox"
    }, domView.spread(t.approved ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), " I have permission to publish this testimonial and its media."], false), footer('Save testimonial')], false));
  }
  async function projectQuotesModal(pid) {
    projectQuotes = await api('project_testimonials', {
      project_id: pid
    });
    showProjectQuotes();
  }
  function showProjectQuotes() {
    openModal(domView.concat('Testimonials · ', projectQuotes.project.name), domView.fragment([domView.element("p", [], ["These testimonials belong to this project. Website copies are updated only when you select them in the website editor."], false), btn('Add testimonial', 'edit-project-testimonial', 'primary'), domView.element("div", [{
      "class": "website-items"
    }], [domView.join(projectQuotes.testimonials.map(t => domView.element("article", [{
      "class": "website-item"
    }], [domView.element("div", [], [domView.element("strong", [], [t.name], false), domView.element("p", [], [t.content], false), domView.element("small", [], [Number(t.approved) ? 'Permission to publish confirmed' : 'Not approved for publication'], false)], false), domView.element("div", [], [domView.fragment([btn('Edit', 'edit-project-testimonial', 'small', domView.attributes([{
      "data-id": t.id
    }])), btn('Remove', 'delete-project-testimonial', 'small ghost', domView.attributes([{
      "data-id": t.id
    }]))])], false)], false)), '') || domView.element("p", [], ["No testimonials for this project yet."], false)], false)]), true);
  }
  function projectQuoteForm(id) {
    const t = projectQuotes.testimonials.find(t => t.id === id) || ({
      id: '',
      revision: 0,
      name: '',
      title: '',
      content: '',
      video: '',
      approved: 0,
      has_photo: 0
    });
    openModal(t.id ? 'Edit project testimonial' : 'Add project testimonial', domView.element("form", [{
      "data-form": "website-project-testimonial"
    }, {
      "data-id": t.id
    }, {
      "data-revision": t.revision
    }], [domView.element("p", [], ["Project: ", domView.element("strong", [], [projectQuotes.project.name], false)], false), domView.fragment([field('Name', 'name', t.name, 120), field('Title / role', 'title', t.title, 120), field('Quote', 'content', t.content, 2000, true), field('YouTube video link (optional)', 'video', t.video, 2048), Number(t.has_photo) ? domView.fragment([domView.element("img", [{
      "class": "website-testimonial-portrait"
    }, {
      "src": endpoint('project_testimonial_photo', {
        project_id: projectQuotes.project.id,
        id: t.id
      })
    }, {
      "alt": t.name
    }], [], false), domView.element("label", [], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "remove_photo"
    }], [], false), " Remove photo"], false)]) : '']), domView.element("label", [], ["Photo (optional)", domView.element("input", [{
      "name": "photo"
    }, {
      "type": "file"
    }, {
      "accept": "image/jpeg,image/png,image/webp"
    }], [], false)], false), domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "name": "approved"
    }, domView.spread(Number(t.approved) ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), " I have permission to publish this testimonial and its media."], false), domView.element("p", [{
      "class": "form-hint"
    }], ["Saving here does not change the website draft or live website."], false), footer('Save testimonial')], false));
  }
  async function encodedPhoto(file) {
    if (file.size > 20 * 1024 * 1024) throw Error('Choose an image smaller than 20 MB.');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  async function upload(file) {
    if (file.size > 20 * 1024 * 1024) throw Error('Choose an image smaller than 20 MB.');
    const encoded = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result.split(',')[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    return (await api('website_upload', {
      data: encoded
    })).id;
  }
  async function action(a, el) {
    if (busy) return;
    busy = true;
    freeze(true);
    el.disabled = true;
    try {
      const act = a.replace(/^website-?/, '');
      if (act === 'project-testimonials') {
        await projectQuotesModal(el.dataset.project);
        return;
      }
      if (act === 'edit-project-testimonial') {
        projectQuoteForm(el.dataset.id);
        return;
      }
      if (act === 'delete-project-testimonial') {
        const t = projectQuotes.testimonials.find(t => t.id === el.dataset.id);
        openModal('Remove project testimonial?', domView.fragment([domView.element("p", [], ["Remove this original testimonial? Existing website copies stay unchanged until explicitly updated."], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button('Cancel', 'close-modal', 'ghost'), btn('Remove testimonial', 'confirm-delete-project-testimonial', 'danger-text', domView.attributes([{
          "data-id": t.id
        }, {
          "data-revision": t.revision
        }]))])], false)]));
        return;
      }
      if (act === 'confirm-delete-project-testimonial') {
        projectQuotes = await api('project_testimonial_delete', {
          project_id: projectQuotes.project.id,
          id: el.dataset.id,
          revision: Number(el.dataset.revision)
        });
        showProjectQuotes();
        return;
      }
      if (!act || act === 'open-project') {
        if (data && studio === state.studio.id) await save();
        closeModal();
        state.data = null;
        state.present = false;
        state.tab = 'website';
        state.websiteEditing = false;
        await load();
        render();
        if (act === 'open-project') await importModal(el.dataset.id);
        return;
      }
      if (!data || studio !== state.studio.id) await load();
      if (act === 'enter') {
        closeModal();
        state.websiteEditing = true;
        tab = 'chat';
        render();
      }
      if (act === 'leave') {
        await save();
        destroyCode();
        state.websiteEditing = false;
        render();
      }
      if (act === 'manage-projects') {
        await save();
        manageProjects('projects');
      }
      if (act === 'materials-tab') {
        manageProjects(el.dataset.tab);
        document.getElementById(domView.concat('website-materials-tab-', materialsTab))?.focus();
      }
      if (act === 'pages') {
        await save();
        managePages();
      }
      if (act === 'add-page') {
        await save();
        pageForm();
      }
      if (act === 'page-details') {
        await save();
        pageForm('update', el.dataset.id);
      }
      if (act === 'duplicate-page') {
        await save();
        pageForm('duplicate', el.dataset.id);
      }
      if (act === 'open-page') {
        closeModal();
        await selectPage(el.dataset.id);
      }
      if (act === 'project-page') {
        await save();
        const p = data.draft.pages.find(p => p.project === el.dataset.id);
        if (p) {
          closeModal();
          await selectPage(p.id);
        } else pageForm('add', '', el.dataset.id);
      }
      if (act === 'move-page') {
        await changePage({
          operation: 'move',
          id: el.dataset.id,
          direction: Number(el.dataset.direction)
        });
        managePages();
      }
      if (act === 'delete-page') {
        const p = data.draft.pages.find(p => p.id === el.dataset.id);
        openModal('Delete this page?', domView.fragment([domView.element("p", [], [domView.fragment(["Remove ", p.name, " from the draft? Links to it will go to Home. Connected projects and testimonials stay in your library. You can undo this change."])], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button('Cancel', 'close-modal', 'ghost'), btn('Delete page', 'confirm-delete-page', 'danger-text', domView.attributes([{
          "data-id": p.id
        }]))])], false)]));
      }
      if (act === 'confirm-delete-page') {
        await changePage({
          operation: 'delete',
          id: el.dataset.id
        });
        managePages();
      }
      if (act === 'source-scope') {
        sourceScope = el.dataset.scope;
        switchPanel('source');
      }
      if (act === 'images') openModal('Website images', imageLibrary(), true);
      if (act === 'reset') {
        openModal('Remove website and start from scratch?', domView.fragment([domView.element("p", [], ["This permanently removes your current website design, chat, website images, project copies, testimonials, and all saved versions. Your published website will be taken offline."], false), domView.element("p", [], ["Your original StudioDeck projects stay safe. Your domain connection and studio subscription are kept; this does not cancel billing."], false), domView.element("p", [], ["You’ll return to the welcome screen to choose a new starting point. This cannot be undone."], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button('Keep my website', 'close-modal', 'ghost'), btn('Remove website & start over', 'confirm-reset', 'danger-text')])], false)]));
      }
      if (act === 'confirm-reset') {
        const result = await api('website_reset', {
          revision: data.revision,
          confirm: true
        });
        closeModal();
        galleryOpen = false;
        previewTemplate = '';
        renderGallery();
        state.websiteEditing = false;
        tab = 'chat';
        sourceFile = 'index.html';
        chatDraft = '';
        message = '';
        source = null;
        portrait = '';
        pendingPrompt = '';
        accept(result);
        toast('Website removed. Choose a new starting point.');
      }
      if (act === 'save') {
        await save();
        toast('Website draft saved.');
      }
      if (act === 'tab') switchPanel(el.dataset.tab);
      if (act === 'gallery') {
        await save();
        closeModal();
        galleryOpen = true;
        previewTemplate = '';
        renderGallery();
      }
      if (act === 'gallery-close') {
        galleryOpen = false;
        renderGallery();
      }
      if (act === 'filter-style') {
        styleFilter = el.dataset.style;
        renderGallery();
        document.querySelector(domView.text(["[data-style=\"", styleFilter, "\"]"]))?.focus();
      }
      if (act === 'gallery-back') {
        previewTemplate = '';
        renderGallery();
      }
      if (act === 'example') {
        previewTemplate = el.dataset.template;
        renderGallery();
      }
      if (act === 'choose-template') await chooseTemplate(el.dataset.template);
      if (act === 'start') {
        closeModal();
        state.websiteEditing = true;
        accept(await api('website_start', {
          template: el.dataset.template,
          revision: data.revision
        }));
      }
      if (act === 'file') {
        sourceFile = el.dataset.file;
        switchPanel('source');
      }
      if (act === 'format-source') {
        if (!codeView) throw Error('Wait for the code editor to load.');
        try {
          const {formatEditor} = await import('./vendor/website-editor.js');
          const result = await formatEditor(codeView, sourceFile);
          toast(result === 'formatted' ? 'Code formatted. Save to update the preview.' : result === 'stale' ? 'Code changed while formatting. Try again.' : 'Code is already formatted.');
        } catch (error) {
          throw Error(domView.concat('Could not format this file. ', error.message));
        }
      }
      if (act === 'copy-source') {
        await navigator.clipboard.writeText(data.draft.files[sourceFile]);
        toast('Source copied.');
      }
      if (act === 'prompt') {
        const input = document.getElementById('website-prompt');
        input.value = el.dataset.prompt;
        chatDraft = input.value;
        setTimeout(() => input.focus(), 0);
      }
      if (act === 'device') {
        device = el.dataset.size;
        document.querySelector('.website-preview').classList.toggle('mobile', device === 'mobile');
        document.querySelectorAll('[data-action="website-device"]').forEach(b => {
          b.classList.toggle('active', b.dataset.size === device);
          b.setAttribute('aria-pressed', String(b.dataset.size === device));
        });
      }
      if (act === 'section') {
        const i = Number(el.dataset.index), j = domView.concat(i, Number(el.dataset.direction));
        [data.draft.sections[i], data.draft.sections[j]] = [data.draft.sections[j], data.draft.sections[i]];
        dirty = true;
        await save();
      }
      if (act === 'remove-logo') {
        data.draft.logo = '';
        dirty = true;
        await save();
      }
      if (act === 'choose-project') {
        await save();
        openModal('Add a project', domView.fragment([domView.element("p", [], ["Choose a project, then review the text, photographs and testimonials to include."], false), domView.element("div", [{
          "class": "website-project-picker"
        }], [domView.join(data.projects.map(p => btn(domView.concat(domView.concat(p.name, p.archived ? ' · Archived' : ''), data.draft.projects.some(c => c.source_id === p.id) ? ' · Already added' : ''), 'import', '', domView.attributes([{
          "data-id": p.id
        }]))), '') || domView.element("p", [], ["Create a project in StudioDeck first."], false)], false)]));
      }
      if (act === 'import') await importModal(el.dataset.id);
      if (act === 'edit-project') {
        await save();
        editProject(el.dataset.id);
      }
      if (act === 'toggle-project') {
        data.draft.projects.find(p => p.id === el.dataset.id).included = !data.draft.projects.find(p => p.id === el.dataset.id).included;
        dirty = true;
        await save();
        manageProjects('projects');
      }
      if (act === 'testimonial') {
        await save();
        testimonialModal(el.dataset.id);
      }
      if (act === 'remove-testimonial') {
        data.draft.testimonials = data.draft.testimonials.filter(t => t.id !== el.dataset.id);
        dirty = true;
        await save();
        manageProjects('testimonials');
      }
      if (act === 'undo') {
        accept(await api('website_undo', {
          revision: data.revision
        }));
      }
      if (act === 'publish' || act === 'review-publish') await reviewPublication();
      if (act === 'publish-tab') {
        showPublishing(el.dataset.tab);
        document.getElementById(domView.concat('website-publish-tab-', publishTab))?.focus();
      }
      if (act === 'confirm-publish') {
        if (!publishChecks || publishChecks.checking || publishChecks.errors.length || publishChecks.revision !== data.revision) {
          await reviewPublication();
          return;
        }
        const result = await api('website_publish', {
          revision: data.revision
        });
        accept(result);
        publishChecks = null;
        showPublishing('versions');
        toast('Your website is published.');
      }
      if (act === 'restore') {
        await save();
        accept(await api('website_restore', {
          release: el.dataset.id,
          revision: data.revision
        }));
        publishChecks = null;
        showPublishing('versions');
        toast('Earlier version restored to draft. Preview before publishing.');
      }
      if (act === 'checkout') {
        await save();
        const result = await api('website_checkout');
        location.assign(safeUrl(result.url, 'href'));
      }
      if (act === 'refresh-billing') {
        accept(await api('website_refresh_billing'));
        toast(data.billing.active ? 'Website access active.' : 'Payment is not confirmed yet.');
      }
    } finally {
      busy = false;
      freeze(false);
      el.disabled = false;
      if (a === 'website-format-source') codeView?.focus();
    }
  }
  async function submit(type, form) {
    if (busy) return;
    busy = true;
    freeze(true);
    const submit = form.querySelector('[type=submit]');
    if (submit) submit.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form));
      if (type === 'website-page') {
        await changePage({
          operation: form.dataset.operation,
          id: form.dataset.id,
          name: values.name,
          slug: values.slug || '',
          navigation: values.navigation === 'on',
          kind: form.dataset.project ? 'project' : values.kind || 'custom',
          project: form.dataset.project
        });
        closeModal();
        toast('Page saved.');
        return;
      }
      if (type === 'website-project-testimonial') {
        const file = form.elements.photo.files[0];
        projectQuotes = await api('project_testimonial_save', {
          project_id: projectQuotes.project.id,
          id: form.dataset.id,
          revision: Number(form.dataset.revision),
          name: values.name,
          title: values.title,
          content: values.content,
          video: values.video,
          approved: values.approved === 'on',
          remove_photo: values.remove_photo === 'on',
          ...file ? {
            photo: await encodedPhoto(file)
          } : {}
        });
        showProjectQuotes();
        return;
      }
      if (type === 'website-details') {
        await save();
        toast('Draft saved. Preview updated.');
      }
      if (type === 'website-chat') {
        chatDraft = values.prompt;
        await save();
        message = 'Working on your draft…';
        toast(message);
        const result = await api('website_chat', {
          prompt: values.prompt,
          revision: data.revision,
          page: selectedPage,
          scope: editScope
        });
        message = result.message;
        chatDraft = '';
        accept(result.website);
        if (result.project_id) await importModal(result.project_id, result.prompt);
      }
      if (type === 'website-import') {
        const ids = new FormData(form).getAll('image');
        if (ids.length > 20) throw Error('Select up to 20 images.');
        const result = await api('website_import', {
          project_id: source.project.id,
          revision: data.revision,
          title: values.title,
          description: values.description,
          testimonials: new FormData(form).getAll('testimonial'),
          images: ids.map(id => ({
            id,
            alt: values[domView.concat('alt_', id)]
          }))
        });
        closeModal();
        tab = 'chat';
        state.websiteEditing = !!result.draft.started;
        accept(result);
        if (pendingPrompt && data.ai) {
          const prompt = pendingPrompt;
          pendingPrompt = '';
          try {
            const changed = await api('website_chat', {
              prompt: domView.concat(prompt, ' Use the newly reviewed public project copy already in the library; integrate it into the current page.'),
              revision: data.revision,
              page: selectedPage,
              scope: editScope
            });
            message = changed.message;
            tab = 'chat';
            accept(changed.website);
          } catch (e) {
            message = domView.concat('The public project copy is saved. ', e.message);
            toast(message);
            render();
          }
        }
      }
      if (type === 'website-project') {
        const next = copy(data.draft), p = next.projects.find(p => p.id === form.dataset.id);
        for (const key of ['title', 'description', 'category', 'location']) p[key] = values[key];
        p.images = p.images.map((im, n) => ({
          ...im,
          alt: values[domView.concat('alt_', n)],
          remove: values[domView.concat('remove_', n)] === 'on'
        })).filter(im => !im.remove);
        for (const file of form.elements.images.files) {
          const asset = await upload(file);
          p.images.push({
            asset,
            alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
          });
        }
        const result = await api('website_save', {
          draft: next,
          revision: data.revision
        });
        closeModal();
        accept(result);
      }
      if (type === 'website-testimonial') {
        const file = form.elements.photo.files[0];
        const t = {
          id: form.dataset.id,
          source_testimonial: data.draft.testimonials.find(t => t.id === form.dataset.id)?.source_testimonial || '',
          name: values.name,
          title: values.title,
          content: values.content,
          project: values.project,
          video: values.video,
          placement: values.placement,
          approved: values.approved === 'on',
          photo: file ? await upload(file) : values.remove_photo === 'on' ? '' : portrait
        };
        const next = copy(data.draft), index = next.testimonials.findIndex(x => x.id === t.id);
        if (index < 0) next.testimonials.push(t); else next.testimonials[index] = t;
        const result = await api('website_save', {
          draft: next,
          revision: data.revision
        });
        closeModal();
        accept(result);
      }
      if (type === 'website-domain') {
        accept(await api('website_domain', {
          name: values.name
        }));
        publishChecks = null;
        showPublishing('domain');
      }
    } finally {
      busy = false;
      freeze(false);
      if (submit) submit.disabled = false;
    }
  }
  document.addEventListener('input', e => {
    if (e.target.id === 'website-prompt') chatDraft = e.target.value;
    if (e.target.name === 'name' && e.target.form?.dataset.form === 'website-page' && e.target.form.dataset.operation !== 'update' && !e.target.form.elements.slug.dataset.edited) e.target.form.elements.slug.value = domView.concat(e.target.form.dataset.project ? 'work/' : '', slugify(e.target.value));
    if (e.target.name === 'slug' && e.target.form?.dataset.form === 'website-page') e.target.dataset.edited = 'true';
    const file = e.target.dataset.websiteFile;
    if (data && file) updateSource(file, e.target.value);
  });
  document.addEventListener('change', async e => {
    if (e.target.hasAttribute('data-website-page')) {
      if (busy) return;
      busy = true;
      freeze(true);
      try {
        await selectPage(e.target.value);
      } catch (error) {
        toast(error.message);
        render();
      } finally {
        busy = false;
        freeze(false);
      }
      return;
    }
    if (e.target.hasAttribute('data-website-edit-scope')) {
      editScope = e.target.value;
      return;
    }
    if (e.target.hasAttribute('data-website-page-kind')) {
      const form = e.target.form, name = ({
        about: 'About',
        contact: 'Contact',
        projects: 'Projects',
        custom: 'New page'
      })[e.target.value];
      form.elements.name.value = name;
      form.elements.slug.value = slugify(name);
      return;
    }
    if (e.target.dataset.websiteFilter === 'business') {
      businessFilter = e.target.value;
      renderGallery();
      document.querySelector('[data-website-filter="business"]')?.focus();
      return;
    }
    if (!e.target.hasAttribute('data-website-files') || busy) return;
    try {
      for (const f of e.target.files) {
        const target = sharedLayout() && sourceScope === 'page' ? pageFile(selectedPage, f.name.split('.').pop()) : f.name;
        if (!editableFiles().includes(target)) throw Error('Choose HTML, CSS or JavaScript files for the selected scope.');
        if (f.size > 160000) throw Error('This source file is too large.');
        data.draft.files[target] = await f.text();
      }
      dirty = true;
      render();
      toast('Files loaded into the editor. Save to update the preview.');
    } catch (error) {
      toast(error.message);
    }
  });
  window.addEventListener('message', async e => {
    const frame = document.querySelector('.website-preview iframe');
    if (!frame || e.source !== frame.contentWindow || e.data?.channel !== previewChannel) return;
    if (e.data.type === 'website-page-navigation') {
      if (busy) return;
      busy = true;
      freeze(true);
      try {
        await selectPage(e.data.page, String(e.data.fragment || ''));
      } catch (error) {
        toast(error.message);
      } finally {
        busy = false;
        freeze(false);
      }
      return;
    }
    if (e.data.type !== 'website-preview-report') return;
    previewReport = e.data;
    const status = document.querySelector('.website-preview-health');
    if (status) status.textContent = e.data.errors?.length ? domView.concat('Preview issue: ', String(e.data.errors[0]).slice(0, 250)) : e.data.missingImages ? 'Some images did not load.' : e.data.overflow ? 'This layout is wider than the preview.' : 'Preview loaded · Interactions are ready to try';
  });
  document.addEventListener('keydown', e => {
    if (e.target.matches('[data-action="website-publish-tab"],[data-action="website-materials-tab"]') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const tabs = [...e.target.closest('[role="tablist"]').querySelectorAll('[role="tab"]')], index = tabs.indexOf(e.target), next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : domView.concat(domView.concat(index, e.key === 'ArrowRight' ? 1 : -1), tabs.length) % tabs.length;
      tabs[next].click();
      return;
    }
    const gallery = document.getElementById('website-gallery');
    if (!gallery) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      galleryOpen = false;
      renderGallery();
    }
    if (e.key === 'Tab') {
      const nodes = [...gallery.querySelectorAll('button:not([disabled]),select,iframe.website-full-example')];
      const first = nodes[0], last = nodes.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  window.addEventListener('beforeunload', e => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  return {
    page,
    load,
    action,
    submit,
    active,
    afterRender,
    save,
    destroyCode
  };
}
