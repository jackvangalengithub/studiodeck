import {safeUrl} from '../../assets/dom.js';
import * as domView from "../../assets/render.js";
export function websiteUi({state, api, esc, button, openModal, closeModal, render, toast, resourceHeaders}) {
  let data = null, studio = '', tab = 'design', dirty = false, busy = false, message = '', source = null, portrait = '';
  const freeze = value => document.querySelectorAll('.workspace,.website-workspace,.modal').forEach(el => {
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
  const endpoint = (action, params = {}) => domView.concat('/api.php?', new URLSearchParams({
    action,
    website_studio: state.studio.id,
    ...params
  }));
  const asset = id => endpoint('website_asset', {
    id
  });
  async function load() {
    const sid = state.studio.id;
    const result = await api('website');
    if (state.studio.id !== sid) return;
    data = result;
    studio = sid;
    dirty = false;
    if (new URLSearchParams(location.search).get('website_checkout') === 'success') {
      message = 'Confirming your payment…';
      data = await api('website_refresh_billing');
      message = data.billing.active ? 'Website activated. You can now publish.' : 'Payment is processing. Use Check payment to refresh.';
    }
  }
  function accept(result) {
    if (result.studio_id !== state.studio.id) return;
    data = result;
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
  function page() {
    if (!data || studio !== state.studio.id) return domView.element("p", [], ["Opening your website…"], false);
    const d = data.draft;
    return domView.element("div", [{
      "class": "website-workspace"
    }, domView.spread(busy ? domView.attributes([{
      "inert": domView.text([])
    }, {
      "aria-busy": "true"
    }]) : '')], [domView.element("div", [{
      "class": "page-heading"
    }], [domView.element("div", [], [domView.element("p", [{
      "class": "website-eyebrow"
    }], ["STUDIODECK WEBSITE · €39 / MONTH"], false), domView.element("h1", [], ["Your work. Your website."], false), domView.element("p", [{
      "class": "muted"
    }], ["Create once. Keep it current in minutes. Publish only when you’re ready."], false)], false), domView.element("div", [{
      "class": "row wrap"
    }], [domView.fragment([btn('Undo', 'undo', 'ghost', data.can_undo ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])), btn('Save draft', 'save', '', dirty ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])), btn(data.live ? 'Publish changes' : 'Publish website', 'publish', 'primary')])], false)], false), domView.element("div", [{
      "class": "website-status"
    }, {
      "role": "status"
    }], [domView.element("span", [], [dirty ? 'Unsaved changes' : data.live ? 'Draft saved · Live website changes only when you publish' : 'Draft saved · Your website is not published yet'], false), data.live ? domView.element("a", [{
      "href": data.url
    }, {
      "target": "_blank"
    }, {
      "rel": "noopener"
    }], ["View live website ↗"], false) : ''], false), domView.element("div", [{
      "class": "website-layout"
    }], [domView.element("aside", [{
      "class": "website-panel"
    }], [domView.element("nav", [{
      "class": "website-tabs"
    }, {
      "aria-label": "Website editor"
    }], [domView.join(['design', 'projects', 'testimonials', 'publish'].map(t => btn(domView.concat(t[0].toUpperCase(), t.slice(1)), 'tab', tab === t ? 'active' : '', domView.attributes([{
      "data-tab": t
    }, {
      "aria-pressed": tab === t
    }]))), '')], false), domView.element("div", [{
      "class": "website-controls"
    }], [tab === 'design' ? design(d) : tab === 'projects' ? projects(d) : tab === 'testimonials' ? testimonials(d) : publishing()], false), domView.element("section", [{
      "class": "website-chat"
    }], [domView.element("h2", [], ["Make it yours"], false), domView.element("p", [], ["Ask for changes to the design, studio copy, or section order."], false), domView.element("form", [{
      "data-form": "website-chat"
    }], [domView.element("label", [{
      "class": "sr-only"
    }, {
      "for": "website-prompt"
    }], ["Describe a website change"], false), domView.element("textarea", [{
      "id": "website-prompt"
    }, {
      "name": "prompt"
    }, {
      "rows": "3"
    }, {
      "maxlength": "2000"
    }, {
      "placeholder": "Make it warmer, and put testimonials before the projects…"
    }, domView.spread(data.ai ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])), {
      "required": domView.text([])
    }], [], false), domView.element("div", [{
      "class": "row"
    }], [domView.element("button", [{
      "class": "button"
    }, {
      "type": "submit"
    }, domView.spread(data.ai ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))], ["Change with AI"], false), domView.element("small", [], [data.ai ? domView.concat(data.ai_remaining, ' edits left this month') : 'AI is not connected'], false)], false)], false), domView.element("p", [{
      "class": "website-chat-message"
    }, {
      "role": "status"
    }], [message], false)], false)], false), domView.element("section", [{
      "class": "website-preview"
    }], [domView.element("div", [{
      "class": "row"
    }], [domView.element("strong", [], ["Website preview"], false), domView.element("span", [{
      "class": "tag"
    }], [dirty ? 'Save draft to refresh' : 'Private draft'], false), domView.fragment([btn('Desktop', 'device', 'small ghost', domView.attributes([{
      "data-size": "desktop"
    }])), btn('Mobile', 'device', 'small ghost', domView.attributes([{
      "data-size": "mobile"
    }]))])], false), domView.element("iframe", [{
      "title": "Your website draft"
    }, {
      "sandbox": "allow-same-origin allow-popups"
    }, {
      "src": endpoint('website_preview', {
        v: data.revision
      })
    }], [], false)], false)], false)], false);
  }
  function design(d) {
    return domView.fragment([domView.element("div", [{
      "class": "website-template-list"
    }], [domView.join([['editorial', 'Editorial', 'Large photographs. A confident serif.'], ['minimal', 'Minimal', 'Clean lines. Room to breathe.'], ['warm', 'Warm', 'Soft tones. A welcoming feel.']].map(([id, name, desc]) => domView.element("button", [{
      "class": domView.text(["website-template ", id, " ", d.template === id ? domView.attributes([{
        "selected": domView.text([])
      }]) : ''])
    }, {
      "data-action": "website-template"
    }, {
      "data-template": id
    }, {
      "aria-pressed": d.template === id
    }], [domView.element("span", [], ["Aa"], false), domView.element("strong", [], [name], false), domView.element("small", [], [desc], false)], false)), '')], false), domView.element("form", [{
      "data-form": "website-details"
    }], [domView.fragment([field('Studio name', 'name', d.name, 120), field('Headline', 'headline', d.headline, 180), field('Introduction', 'intro', d.intro, 2000, true), field('About your studio', 'about', d.about, 6000, true), field('Public contact email', 'email', d.email, 254)]), domView.element("div", [{
      "class": "row"
    }], [domView.element("label", [], ["Accent color", domView.element("input", [{
      "type": "color"
    }, {
      "name": "accent"
    }, {
      "value": d.accent
    }], [], false)], false), domView.element("label", [], ["Website language", domView.element("select", [{
      "name": "language"
    }], [domView.element("option", [{
      "value": "en"
    }, domView.spread(d.language === 'en' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], ["English"], false), domView.element("option", [{
      "value": "nl"
    }, domView.spread(d.language === 'nl' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], ["Nederlands"], false)], false)], false)], false), domView.element("label", [], ["Studio logo", domView.element("input", [{
      "type": "file"
    }, {
      "data-website-upload": "logo"
    }, {
      "accept": "image/jpeg,image/png,image/webp"
    }], [], false)], false), d.logo ? domView.fragment([domView.element("img", [{
      "class": "website-logo"
    }, {
      "src": asset(d.logo)
    }, {
      "alt": "Current logo"
    }], [], false), btn('Remove logo', 'remove-logo', 'small ghost')]) : '', domView.element("details", [], [domView.element("summary", [], ["Search & sharing"], false), domView.fragment([field('Page title', 'title', d.title, 160), field('Search description', 'description', d.description, 320, true)]), domView.element("p", [{
      "class": "form-hint"
    }], ["Titles, sharing previews, a sitemap, and responsive compressed images are included at publish."], false)], false), domView.element("h3", [], ["Section order"], false), domView.join(d.sections.map((s, n) => domView.element("div", [{
      "class": "website-item"
    }], [domView.element("span", [], [s], false), domView.fragment([btn('↑', 'section', 'small ghost', domView.attributes([{
      "data-index": n
    }, {
      "data-direction": "-1"
    }, {
      "aria-label": domView.text(["Move ", s, " up"])
    }, domView.spread(n === 0 ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')])), btn('↓', 'section', 'small ghost', domView.attributes([{
      "data-index": n
    }, {
      "data-direction": "1"
    }, {
      "aria-label": domView.text(["Move ", s, " down"])
    }, domView.spread(n === 3 ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')]))])], false)), ''), domView.element("button", [{
      "type": "submit"
    }, {
      "class": "button primary"
    }], ["Save draft & preview"], false)], false)]);
  }
  function projects(d) {
    return domView.fragment([domView.element("h2", [], ["Your portfolio"], false), domView.element("p", [], ["Choose exactly what visitors see. These copies stay here even if the original project is deleted."], false), btn('Add a project', 'choose-project', 'primary'), domView.element("div", [{
      "class": "website-items"
    }], [domView.join(d.projects.map(p => domView.element("article", [{
      "class": "website-item"
    }], [domView.element("div", [], [p.images[0] ? domView.element("img", [{
      "src": asset(p.images[0].asset)
    }, {
      "alt": domView.text([])
    }, {
      "loading": "lazy"
    }], [], false) : '', domView.element("strong", [], [p.title], false), domView.element("small", [], [p.included ? 'Included in draft' : 'Hidden from next publish'], false)], false), domView.element("div", [], [domView.fragment([btn('Edit', 'edit-project', 'small', domView.attributes([{
      "data-id": p.id
    }])), btn(p.included ? 'Hide' : 'Include', 'toggle-project', 'small ghost', domView.attributes([{
      "data-id": p.id
    }])), data.projects.some(s => s.id === p.source_id) ? btn('Update from project', 'import', 'small ghost', domView.attributes([{
      "data-id": p.source_id
    }])) : domView.element("small", [], ["Source project removed · Website copy retained"], false)])], false)], false)), '') || domView.element("p", [{
      "class": "muted"
    }], ["Your portfolio starts with your first selected project."], false)], false)]);
  }
  function testimonials(d) {
    return domView.fragment([domView.element("h2", [], ["Let your clients speak"], false), domView.element("p", [], ["Add approved quotes and choose where they appear."], false), btn('Add a testimonial', 'testimonial', 'primary'), domView.element("div", [{
      "class": "website-items"
    }], [domView.join(d.testimonials.map(t => domView.element("article", [{
      "class": "website-item"
    }], [domView.element("div", [], [domView.element("strong", [], [t.name], false), domView.element("p", [], [t.content], false), domView.element("small", [], [t.approved ? 'Approved for publication' : 'Private draft'], false)], false), domView.fragment([btn('Edit', 'testimonial', 'small', domView.attributes([{
      "data-id": t.id
    }])), btn('Remove', 'remove-testimonial', 'small ghost', domView.attributes([{
      "data-id": t.id
    }]))])], false)), '')], false)]);
  }
  function publishing() {
    const b = data.billing, domain = data.domain;
    return domView.fragment([domView.element("h2", [], ["Ready when you are"], false), domView.element("p", [], [b.local ? 'Local preview mode · Publishing is enabled for development.' : b.active ? 'Your Website subscription is active.' : 'Build and preview for free. Publish for €39 EUR/month, plus applicable tax.'], false), domView.element("p", [], ["Includes hosting, three templates, projects, testimonials, image optimization, search essentials, and 50 AI edits per month."], false), domView.fragment([!b.active ? btn(b.available ? 'Activate Website · €39/month' : 'Payments not configured', 'checkout', 'primary', b.available ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])) : '', btn('Check payment', 'refresh-billing', 'small ghost'), b.has_subscription ? button('Manage subscription', 'billing', 'small ghost') : '']), domView.element("h3", [], ["Your website address"], false), domView.element("p", [{
      "class": "website-url"
    }], [data.url], false), domView.element("p", [{
      "class": "form-hint"
    }], [!data.live ? 'This address is reserved. Publish your website to make it available here.' : !b.active ? 'Your website is paused until its subscription is active.' : 'Your published website is available at this address.'], false), domView.element("form", [{
      "data-form": "website-domain"
    }], [field('Connect your domain', 'name', domain.name, 253), domView.element("p", [{
      "class": "form-hint"
    }], ["Use a www address. Keep your email DNS records unchanged."], false), domView.element("button", [{
      "class": "button"
    }, {
      "type": "submit"
    }], [domain.name ? 'Check connection' : 'Set domain'], false)], false), domain.name ? domView.element("div", [{
      "class": "website-dns"
    }], [domView.element("p", [], [domain.verified ? 'Ownership verified. Publish to use this domain.' : 'Add these DNS records, then check connection.'], false), domView.element("dl", [], [domView.element("dt", [], [domView.fragment(["CNAME · ", domain.name])], false), domView.element("dd", [], [domain.target || 'Hosting must be configured by the operator first'], false), domView.element("dt", [], [domView.fragment(["TXT · _studiodeck.", domain.name])], false), domView.element("dd", [], [domain.token], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], ["DNS can take time to update. HTTPS is handled by the configured hosting service."], false)], false) : '', domView.element("h3", [], ["Published versions"], false), data.live ? domView.element("a", [{
      "class": "button"
    }, {
      "href": endpoint('website_export')
    }], ["Download static website (.zip)"], false) : '', domView.element("p", [{
      "class": "form-hint"
    }], ["Restore loads an earlier version into your draft. Preview and publish to make it live."], false), domView.join(data.releases.map(r => domView.element("div", [{
      "class": "website-item"
    }], [domView.element("div", [], [domView.element("strong", [], [new Date(r.created_at).toLocaleString()], false), domView.element("small", [], [r.id === data.live?.release ? 'Current live version' : 'Earlier version'], false)], false), btn('Restore to draft', 'restore', 'small ghost', domView.attributes([{
      "data-id": r.id
    }]))], false)), '') || domView.element("p", [], ["No published versions yet."], false)]);
  }
  async function importModal(pid) {
    await save();
    source = await api('website_sources', {
      project_id: pid
    });
    const previous = data.draft.projects.find(p => p.source_id === pid);
    openModal(previous ? 'Update public project copy' : 'Add project to website', domView.element("form", [{
      "data-form": "website-import"
    }], [domView.element("p", [], ["Review the public copy and select photographs. Private documents, budgets, and client details are never included automatically."], false), domView.fragment([field('Public title', 'title', source.project.title, 160), field('Public description', 'description', source.project.description, 6000, true)]), domView.element("p", [{
      "class": "form-hint"
    }], ["Updating replaces this website project’s title, description, and selected gallery. Existing public URL and visibility are kept."], false), domView.element("div", [{
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
    }], [], false)], false)), '') || domView.element("p", [], ["No project photographs available. You can add images after importing."], false)], false), footer(previous ? 'Update draft copy' : 'Add to draft')], false), true);
  }
  function editProject(id) {
    const p = data.draft.projects.find(p => p.id === id);
    openModal('Website project', domView.element("form", [{
      "data-form": "website-project"
    }, {
      "data-id": id
    }], [domView.fragment([field('Public title', 'title', p.title, 160), field('Page URL', 'slug', p.slug, 80), field('Public description', 'description', p.description, 6000, true), field('Category', 'category', p.category, 80), field('Public location (optional)', 'location', p.location, 100)]), domView.element("div", [{
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
    }], [domView.fragment([field('Name', 'name', t.name, 120), field('Title / role', 'title', t.title, 120), field('Quote', 'content', t.content, 2000, true)]), domView.element("label", [], ["Project", domView.element("select", [{
      "name": "project"
    }], [domView.element("option", [{
      "value": domView.text([])
    }], ["Studio testimonial"], false), domView.join(data.draft.projects.map(p => domView.element("option", [{
      "value": p.id
    }, domView.spread(p.id === t.project ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [p.title], false)), '')], false)], false), domView.element("label", [], ["Placement", domView.element("select", [{
      "name": "placement"
    }], [domView.join([['both', 'Homepage and project'], ['home', 'Homepage'], ['project', 'Project page']].map(([id, label]) => domView.element("option", [{
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
      if (!act || act === 'open-project') {
        if (data && studio === state.studio.id) await save();
        closeModal();
        state.data = null;
        state.present = false;
        state.tab = 'website';
        await load();
        render();
        if (act === 'open-project') await importModal(el.dataset.id);
        return;
      }
      if (!data || studio !== state.studio.id) await load();
      if (act === 'save') {
        await save();
        toast('Website draft saved.');
      }
      if (act === 'tab') {
        tab = el.dataset.tab;
        render();
      }
      if (act === 'template') {
        data.draft.template = el.dataset.template;
        dirty = true;
        await save();
      }
      if (act === 'device') {
        document.querySelector('.website-preview').classList.toggle('mobile', el.dataset.size === 'mobile');
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
        openModal('Choose a project', domView.fragment([domView.element("p", [], ["Select a project to prepare its public website copy."], false), domView.join(data.projects.map(p => btn(domView.concat(p.name, p.archived ? ' · Archived' : ''), 'import', '', domView.attributes([{
          "data-id": p.id
        }]))), ' ') || domView.element("p", [], ["Create a project in StudioDeck first."], false)]));
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
      }
      if (act === 'testimonial') {
        await save();
        testimonialModal(el.dataset.id);
      }
      if (act === 'remove-testimonial') {
        data.draft.testimonials = data.draft.testimonials.filter(t => t.id !== el.dataset.id);
        dirty = true;
        await save();
      }
      if (act === 'undo') {
        accept(await api('website_undo', {
          revision: data.revision
        }));
      }
      if (act === 'publish') {
        await save();
        if (data.billing.active && !data.draft.description.trim()) {
          tab = 'design';
          render();
          const description = document.querySelector('[data-form="website-details"] [name="description"]');
          if (description) {
            description.closest('details').open = true;
            setTimeout(() => description.focus(), 0);
          }
          toast('Add a short search description, then publish your website.');
          return;
        }
        if (!data.billing.active) {
          tab = 'publish';
          render();
          toast('Activate Website to publish. Your draft is saved.');
          return;
        }
        openModal('Publish your website', domView.fragment([domView.element("p", [], ["This makes the saved website draft public, including selected projects and approved testimonials. Your current site stays live until the new version is ready."], false), domView.element("p", [], ["Images and search metadata will be optimized automatically."], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button('Keep editing', 'close-modal', 'ghost'), btn('Publish now', 'confirm-publish', 'primary')])], false)]));
      }
      if (act === 'confirm-publish') {
        message = 'Optimizing images and preparing your website…';
        const result = await api('website_publish', {
          revision: data.revision
        });
        closeModal();
        message = 'Your website is published.';
        accept(result);
        toast(message);
      }
      if (act === 'restore') {
        await save();
        accept(await api('website_restore', {
          release: el.dataset.id,
          revision: data.revision
        }));
        toast('Earlier version restored to draft. Preview before publishing.');
      }
      if (act === 'checkout') {
        await save();
        const result = await api('website_checkout');
        location.assign(safeUrl(result.url, 'href'));
      }
      if (act === 'refresh-billing') {
        accept(await api('website_refresh_billing'));
        toast(data.billing.active ? 'Website subscription active.' : 'Payment is not confirmed yet.');
      }
    } finally {
      busy = false;
      freeze(false);
      el.disabled = false;
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
      if (type === 'website-details') {
        await save();
        toast('Draft saved. Preview updated.');
      }
      if (type === 'website-chat') {
        await save();
        message = 'Working on your draft…';
        const result = await api('website_chat', {
          prompt: values.prompt,
          revision: data.revision
        });
        message = result.message;
        accept(result.website);
      }
      if (type === 'website-import') {
        const ids = new FormData(form).getAll('image');
        if (ids.length > 20) throw Error('Select up to 20 images.');
        const result = await api('website_import', {
          project_id: source.project.id,
          revision: data.revision,
          title: values.title,
          description: values.description,
          images: ids.map(id => ({
            id,
            alt: values[domView.concat('alt_', id)]
          }))
        });
        closeModal();
        tab = 'projects';
        accept(result);
      }
      if (type === 'website-project') {
        const next = copy(data.draft), p = next.projects.find(p => p.id === form.dataset.id);
        for (const key of ['title', 'slug', 'description', 'category', 'location']) p[key] = values[key];
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
      }
    } finally {
      busy = false;
      freeze(false);
      if (submit) submit.disabled = false;
    }
  }
  document.addEventListener('input', e => {
    if (!data || !e.target.closest('[data-form="website-details"]') || !e.target.name) return;
    data.draft[e.target.name] = e.target.value;
    dirty = true;
    const status = document.querySelector('.website-status span');
    if (status) status.textContent = 'Unsaved changes · Save draft to refresh preview';
    const b = document.querySelector('[data-action="website-save"]');
    if (b) b.disabled = false;
  });
  document.addEventListener('change', async e => {
    if (e.target.dataset.websiteUpload !== 'logo' || !e.target.files[0] || busy) return;
    busy = true;
    freeze(true);
    try {
      data.draft.logo = await upload(e.target.files[0]);
      dirty = true;
      await save();
    } catch (error) {
      toast(error.message);
    } finally {
      busy = false;
      freeze(false);
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
    submit
  };
}
