import * as domView from "./render.js";
import {platformFetch} from './platform/files.js';
import {getLanguage, tr} from './i18n.js';
const labels = {
  checking_sources: ['Classifying sources and reading design details', 'Bronnen classificeren en ontwerpdetails lezen'],
  comparing_sources: ['Comparing specifications and images', 'Specificaties en afbeeldingen vergelijken'],
  verifying_mismatch: ['Reviewing a possible mismatch', 'Een mogelijk verschil beoordelen'],
  checks: ['Checks', 'Controles'],
  run: ['Scan for inconsistencies', 'Scannen op tegenstrijdigheden'],
  running: ['Checking sources…', 'Bronnen controleren…'],
  intro: ['Compare specifications, detailed designs and project images. Inspiration and before photos normally do not create warnings.', 'Vergelijk specificaties, uitgewerkte ontwerpen en projectbeelden. Inspiratie en voorfoto’s leveren normaal geen waarschuwingen op.'],
  unavailable: ['Connect AI to enable consistency checks.', 'Verbind AI om consistentiecontroles in te schakelen.'],
  notRun: ['These sources have not been checked yet.', 'Deze bronnen zijn nog niet gecontroleerd.'],
  stale: ['Sources or their roles changed. Run checks again to review the current design.', 'Bronnen of hun rollen zijn gewijzigd. Voer de controles opnieuw uit voor het huidige ontwerp.'],
  partial: ['Some evidence could not be checked. These results are incomplete.', 'Niet al het bewijs kon worden gecontroleerd. Deze resultaten zijn onvolledig.'],
  empty: ['No mismatches found in the evidence checked.', 'Geen verschillen gevonden in het gecontroleerde bewijs.'],
  none: ['No source files yet. Upload files to compare them.', 'Nog geen bronbestanden. Upload bestanden om ze te vergelijken.'],
  mismatch: ['Possible mismatch', 'Mogelijk verschil'],
  clarification: ['Needs clarification', 'Verduidelijking nodig'],
  resolved: ['Resolved', 'Opgelost'],
  dismissed: ['Hidden', 'Verborgen'],
  open: ['Open', 'Open'],
  resolve: ['Mark resolved', 'Markeer als opgelost'],
  dismiss: ['Hide as irrelevant', 'Verbergen als niet relevant'],
  reopen: ['Restore finding', 'Bevinding terugzetten'],
  question: ['Create conversation', 'Gesprek starten'],
  linked: ['Open conversation', 'Gesprek openen'],
  history: ['Hidden and resolved findings', 'Verborgen en opgeloste bevindingen'],
  evidence: ['View evidence', 'Bekijk bewijs'],
  written: ['Written requirement', 'Geschreven vereiste'],
  visual: ['Visual observation', 'Visuele waarneming'],
  price: ['Price', 'Prijs'],
  scope: ['Scope', 'Omvang'],
  inclusion: ['Inclusion', 'Inbegrepen'],
  suggestions: ['Inconsistency suggestions', 'Suggesties bij tegenstrijdigheden'],
  explainTitle: ['Suggested items', 'Voorgestelde items'],
  explain: ['We will compare details extracted from your current files: materials, dimensions, prices and what is included. Images can also reveal differences from written specifications.', 'We vergelijken details uit je huidige bestanden: materialen, afmetingen, prijzen en wat is inbegrepen. Ook afbeeldingen kunnen verschillen met geschreven specificaties laten zien.'],
  limits: ['Suggestions require conflicting evidence about the same detail. Missing information, routine tasks and normal design changes do not create suggestions. There may be no inconsistencies to report.', 'Suggesties vereisen tegenstrijdig bewijs over hetzelfde detail. Ontbrekende informatie, gewone taken en normale ontwerpwijzigingen leveren geen suggesties op. Er zijn mogelijk geen tegenstrijdigheden te melden.'],
  control: ['Each suggestion shows both sources. You decide whether to discuss it, hide it as irrelevant or mark it resolved. Nothing is sent to clients or added to the budget automatically. File extraction continues as usual.', 'Elke suggestie toont beide bronnen. Jij bepaalt of je deze bespreekt, als niet relevant verbergt of als opgelost markeert. Er wordt niets automatisch naar klanten verstuurd of aan het budget toegevoegd. Het uitlezen van bestanden gaat gewoon door.'],
  start: ['Scan for inconsistencies', 'Scannen op tegenstrijdigheden'],
  cancel: ['Cancel', 'Annuleren'],
  roles: ['Source roles', 'Bronrollen'],
  rolesHint: ['AI suggests a role for each page and image. Correct it here when needed. An approved specification requires recorded approval.', 'AI stelt een rol voor per pagina en afbeelding. Corrigeer die hier indien nodig. Een goedgekeurde specificatie vereist vastgelegde goedkeuring.'],
  fileRole: ['Document role', 'Documentrol'],
  editRole: ['Edit role', 'Rol wijzigen'],
  automatic: ['Automatic', 'Automatisch'],
  save: ['Save role', 'Rol opslaan'],
  sources: ['sources', 'bronnen'],
  source: ['Source', 'Bron'],
  page: ['Page', 'Pagina'],
  image: ['Image', 'Afbeelding'],
  checked: ['Last checked', 'Laatst gecontroleerd'],
  queued: ['Checks queued.', 'Controles ingepland.'],
  questionSaved: ['Conversation started privately with the source evidence.', 'Privégesprek gestart met de broninformatie.'],
  outdated: ['Earlier evidence — run checks again before using this finding.', 'Eerder bewijs — voer de controles opnieuw uit voordat je deze bevinding gebruikt.'],
  imageUnavailable: ['Image unavailable. Open the original source to review it.', 'Afbeelding niet beschikbaar. Open de oorspronkelijke bron om die te bekijken.'],
  original: ['Download original', 'Origineel downloaden'],
  inspiration: ['Inspiration / moodboard', 'Inspiratie / moodboard'],
  concept: ['Concept', 'Concept'],
  alternative: ['Unselected alternative', 'Niet-geselecteerd alternatief'],
  detailed_design: ['Detailed design', 'Uitgewerkt ontwerp'],
  specification: ['Specification', 'Specificatie'],
  approved_specification: ['Approved specification', 'Goedgekeurde specificatie'],
  before: ['Before / existing', 'Voor / bestaand'],
  progress: ['Work in progress', 'Werk in uitvoering'],
  completed: ['Completed work', 'Opgeleverd werk'],
  unknown: ['Unknown', 'Onbekend'],
  colour: ['Colour', 'Kleur'],
  material: ['Material', 'Materiaal'],
  finish: ['Finish', 'Afwerking'],
  model: ['Product / model', 'Product / model'],
  dimension: ['Written dimension', 'Geschreven maat'],
  found: ['Findings to review', 'Te beoordelen bevindingen'],
  allReviewed: ['All findings have been hidden or resolved. You can restore them below.', 'Alle bevindingen zijn verborgen of opgelost. Je kunt ze hieronder terugzetten.'],
  background: ['The scan runs in the background. You can close this window and keep working. Open it again to see progress and results.', 'De scan draait op de achtergrond. Je kunt dit venster sluiten en doorwerken. Open het opnieuw voor de voortgang en resultaten.'],
  scanQueued: ['Scan queued…', 'Scan ingepland…'],
  scanRunning: ['Scanning for inconsistencies…', 'Scannen op tegenstrijdigheden…'],
  scanFailed: ['The scan could not finish. Your earlier findings are still available. Try scanning again.', 'De scan kon niet worden voltooid. Je eerdere bevindingen zijn nog beschikbaar. Probeer opnieuw te scannen.'],
  keepWorking: ['Continue working', 'Verder werken'],
  close: ['Close', 'Sluiten'],
  readyQuestion: ['Question to discuss', 'Vraag om te bespreken'],
  noSuggestions: ['No suggestions this time', 'Deze keer geen suggesties'],
  noSuggestionsHint: ['We couldn’t find any inconsistencies in the files we checked.', 'We konden geen tegenstrijdigheden vinden in de bestanden die we hebben bekeken.'],
  readyTitle: ['Something worth discussing?', 'Iets om te bespreken?'],
  readyHint: ['Scan your project files to find differences worth a conversation.', 'Scan je projectbestanden om verschillen te vinden die een gesprek waard zijn.'],
  caughtUp: ['You’re all caught up', 'Je bent helemaal bij'],
  caughtUpHint: ['Your reviewed findings are saved below if you need them again.', 'Je beoordeelde bevindingen staan hieronder als je ze weer nodig hebt.']
};
export const checkText = key => labels[key]?.[getLanguage() === 'nl' ? 1 : 0] || key;
export function consistencyUi({state, esc, button, openModal, closeModal, api, refresh, toast, editable, resourceHeaders, discuss}) {
  const t = checkText, roles = ['inspiration', 'concept', 'alternative', 'detailed_design', 'specification', 'approved_specification', 'before', 'progress', 'completed', 'unknown'];
  const data = () => state.data.checks || ({
    sources: [],
    findings: [],
    roles: {}
  });
  const starting = new Set();
  const jobs = () => state.data?.jobs?.filter(j => j.type === 'consistency') || [];
  const pending = () => starting.has(state.data?.iteration.id) || jobs().some(j => ['queued', 'running'].includes(j.status));
  const attrs = f => domView.attributes([{
    "data-id": f.id
  }]);
  function finding(f) {
    const question = f.question || (getLanguage() === 'nl' ? domView.text(["Welke keuze moeten we aanhouden voor “", f.title, "”?"]) : domView.text(["Which choice should we use for “", f.title, "”?"]));
    return domView.element("article", [{
      "class": domView.text(["check-finding ", f.stale ? 'is-stale' : ''])
    }], [domView.element("h3", [], [f.title], false), domView.element("p", [{
      "class": "check-finding-summary"
    }], [f.explanation], false), f.stale ? domView.element("p", [{
      "class": "notice"
    }], [t('outdated')], false) : '', domView.element("div", [{
      "class": "check-question-preview"
    }], [domView.element("small", [], [t('readyQuestion')], false), domView.element("p", [], [question], false)], false), domView.element("details", [{
      "class": "check-finding-sources"
    }, {
      "data-check-details": f.id
    }], [domView.element("summary", [], [t('evidence')], false), domView.element("div", [{
      "class": "check-evidence"
    }], [domView.join(f.evidence.map((e, n) => domView.element("div", [], [domView.element("small", [], [domView.fragment([t(e.basis === 'text' ? 'written' : 'visual'), " · ", t(e.role)])], false), domView.element("p", [], [domView.element("strong", [], [domView.fragment([e.object, e.room ? domView.concat(' · ', e.room) : ''])], false), domView.element("br", [], [], false), domView.fragment([t(e.property), ": ", e.value])], false), e.quote ? domView.element("blockquote", [], [e.quote], false) : '', domView.element("small", [], [domView.fragment([e.name, e.page ? domView.concat(domView.concat(domView.concat(' · ', t('page')), ' '), Number(e.page)) : ''])], false), !f.stale ? button(t('evidence'), 'check-evidence', 'small ghost', domView.concat(attrs(f), domView.attributes([{
      "data-evidence": n
    }]))) : ''], false)), '')], false)], false), editable() ? domView.element("div", [{
      "class": "row wrap check-finding-actions"
    }], [domView.fragment([f.question_id ? button(t('linked'), 'check-question', 'small primary', attrs(f), 'chat') : !f.stale ? button(t('question'), 'check-review', 'small primary', domView.concat(attrs(f), domView.attributes([{
      "data-operation": "question"
    }])), 'chat') : '', f.status === 'open' ? button(t('dismiss'), 'check-review', 'small ghost', domView.concat(attrs(f), domView.attributes([{
      "data-operation": "dismissed"
    }]))) : button(t('reopen'), 'check-review', 'small ghost', domView.concat(attrs(f), domView.attributes([{
      "data-operation": "open"
    }])))])], false) : ''], false);
  }
  function emptyState(reviewed) {
    const d = data(), title = reviewed ? 'caughtUp' : !d.sources.length || !d.run ? 'readyTitle' : 'noSuggestions', hint = reviewed ? 'caughtUpHint' : !d.sources.length ? 'none' : !d.run ? 'readyHint' : 'noSuggestionsHint';
    return domView.element("div", [{
      "class": "check-empty"
    }], [domView.element("svg", [{
      "class": "check-empty-art"
    }, {
      "viewBox": "0 0 240 160"
    }, {
      "fill": "none"
    }, {
      "aria-hidden": "true"
    }], [domView.element("ellipse", [{
      "cx": "120"
    }, {
      "cy": "142"
    }, {
      "rx": "76"
    }, {
      "ry": "8"
    }, {
      "fill": "currentColor"
    }, {
      "opacity": ".06"
    }], [], true), domView.element("circle", [{
      "cx": "118"
    }, {
      "cy": "77"
    }, {
      "r": "65"
    }, {
      "fill": "currentColor"
    }, {
      "opacity": ".05"
    }], [], true), domView.element("rect", [{
      "x": "56"
    }, {
      "y": "33"
    }, {
      "width": "74"
    }, {
      "height": "98"
    }, {
      "rx": "9"
    }, {
      "transform": "rotate(-12 56 33)"
    }, {
      "fill": "var(--surface,#fff)"
    }, {
      "stroke": "currentColor"
    }, {
      "opacity": ".35"
    }], [], true), domView.element("rect", [{
      "x": "81"
    }, {
      "y": "24"
    }, {
      "width": "77"
    }, {
      "height": "104"
    }, {
      "rx": "9"
    }, {
      "fill": "var(--surface,#fff)"
    }, {
      "stroke": "currentColor"
    }, {
      "stroke-width": "2"
    }], [], true), domView.element("path", [{
      "d": "M97 44h37M97 56h29M97 70h17"
    }, {
      "stroke": "currentColor"
    }, {
      "stroke-width": "3"
    }, {
      "stroke-linecap": "round"
    }, {
      "opacity": ".3"
    }], [], true), domView.element("circle", [{
      "cx": "149"
    }, {
      "cy": "98"
    }, {
      "r": "27"
    }, {
      "fill": "var(--surface,#fff)"
    }, {
      "stroke": "currentColor"
    }, {
      "stroke-width": "3"
    }], [], true), domView.element("path", [{
      "d": "m169 119 19 20"
    }, {
      "stroke": "currentColor"
    }, {
      "stroke-width": "7"
    }, {
      "stroke-linecap": "round"
    }], [], true), domView.element("path", [{
      "d": "M139 98h20M181 36v12M175 42h12M48 94v8M44 98h8"
    }, {
      "stroke": "currentColor"
    }, {
      "stroke-width": "2"
    }, {
      "stroke-linecap": "round"
    }, {
      "opacity": ".5"
    }], [], true)], true), domView.element("h3", [], [t(title)], false), domView.element("p", [], [t(hint)], false)], false);
  }
  function scanStatus() {
    const job = jobs().find(j => j.status === 'running') || jobs().find(j => j.status === 'queued');
    if (pending()) return domView.element("div", [{
      "class": "notice check-scan-status"
    }, {
      "role": "status"
    }], [domView.element("strong", [], [t(job?.status === 'running' ? 'scanRunning' : 'scanQueued')], false), job?.progress?.stage && labels[job.progress.stage] ? domView.element("p", [], [t(job.progress.stage)], false) : '', domView.element("p", [], [t('background')], false), domView.element("span", [{
      "class": "check-scan-track"
    }, {
      "aria-hidden": "true"
    }], [], false)], false);
    if (jobs().at(-1)?.status === 'failed') return domView.element("p", [{
      "class": "notice"
    }, {
      "role": "status"
    }], [t('scanFailed')], false);
    return '';
  }
  function page() {
    const d = data(), active = d.findings.filter(f => f.status === 'open'), reviewed = d.findings.filter(f => f.status !== 'open');
    return domView.element("section", [{
      "class": "consistency-panel"
    }], [domView.fragment([!d.available ? domView.element("p", [{
      "class": "notice"
    }], [t('unavailable')], false) : '', domView.join(active.map(finding), ''), !active.length && !pending() && jobs().at(-1)?.status !== 'failed' ? emptyState(reviewed.length) : '', reviewed.length ? domView.element("details", [{
      "class": "check-reviewed"
    }, {
      "data-check-details": "reviewed"
    }], [domView.element("summary", [], [domView.fragment([t('history'), " (", reviewed.length, ")"])], false), domView.join(reviewed.map(finding), '')], false) : ''])], false);
  }
  function sources() {
    const d = data();
    return domView.element("details", [{
      "class": "check-sources"
    }], [domView.element("summary", [], [domView.fragment([t('roles'), " (", d.sources.length, ")"])], false), domView.element("p", [{
      "class": "muted"
    }], [t('rolesHint')], false), domView.join(state.data.files.map(file => domView.element("section", [{
      "class": "check-source-file"
    }], [domView.element("div", [{
      "class": "row between wrap"
    }], [domView.element("h3", [], [file.name], false), editable() ? button(domView.concat(domView.concat(t('fileRole'), ': '), t(d.roles[domView.concat(file.id, ':file')] || 'automatic')), 'check-role', 'small ghost', domView.attributes([{
      "data-key": domView.concat(file.id, ':file')
    }])) : ''], false), domView.join(d.sources.filter(s => s.version_id === file.id).map(s => domView.element("div", [{
      "class": "check-source row between wrap"
    }], [domView.element("div", [], [domView.element("strong", [], [s.slide_id ? s.name : s.page ? domView.concat(domView.concat(t('page'), ' '), s.page) : s.name], false), domView.element("span", [{
      "class": "tag outline"
    }], [t(s.role)], false), s.reason ? domView.element("p", [{
      "class": "muted"
    }], [s.reason], false) : ''], false), editable() ? button(t('editRole'), 'check-role', 'small ghost', domView.attributes([{
      "data-key": s.key
    }])) : ''], false)), '')], false)), '')], false);
  }
  function footer() {
    const d = data();
    return domView.element("div", [{
      "class": "modal-footer"
    }], [domView.fragment([button(t(pending() ? 'keepWorking' : 'close'), 'close-modal', 'ghost'), editable() ? button(t(pending() ? 'scanRunning' : 'start'), 'check-start', 'primary', pending() || !d.available || !d.sources.length ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '', 'spark') : ''])], false);
  }
  function explain() {
    openModal(t('explainTitle'), domView.element("div", [{
      "data-check-dialog": state.data.iteration.id
    }], [domView.element("div", [{
      "data-check-status": domView.text([])
    }], [], false), domView.element("div", [{
      "data-check-results": domView.text([])
    }], [], false), domView.element("div", [{
      "data-check-footer": domView.text([])
    }], [], false)], false), true);
    sync();
  }
  function sync() {
    const busy = pending();
    document.querySelectorAll('[data-action="check-run"],[data-action="suggest-open-questions"]').forEach(el => {
      el.classList.toggle('is-scanning', busy);
      el.title = busy ? t('scanRunning') : tr('checklist_suggest');
    });
    const dialog = document.querySelector('[data-check-dialog]');
    if (!dialog || dialog.dataset.checkDialog !== state.data?.iteration.id) return;
    for (const [key, html] of [['status', scanStatus()], ['results', page()], ['footer', footer()]]) {
      const target = dialog.querySelector(domView.text(["[data-check-", key, "]"]));
      if (target.checkHtml === html) continue;
      const expanded = [...target.querySelectorAll('details[open]')].map(el => el.dataset.checkDetails);
      const focused = target.contains(document.activeElement) ? document.activeElement : null;
      const action = focused?.dataset.action, id = focused?.dataset.id, operation = focused?.dataset.operation;
      domView.mount(target, html);
      target.checkHtml = html;
      target.querySelectorAll('details').forEach(el => {
        el.open = expanded.includes(el.dataset.checkDetails);
      });
      if (focused) {
        const replacement = [...target.querySelectorAll('button')].find(el => el.dataset.action === action && el.dataset.id === id && el.dataset.operation === operation);
        (replacement || dialog.querySelector('[data-action="close-modal"]'))?.focus({
          preventScroll: true
        });
      }
    }
  }
  async function action(action, el) {
    const d = data(), iteration = state.data.iteration.id, f = d.findings.find(f => f.id === el.dataset.id);
    if (action === 'check-run' || action === 'suggest-open-questions') {
      explain();
    }
    if (action === 'check-start') {
      if (pending() || !editable() || !d.available || !d.sources.length) return;
      starting.add(iteration);
      closeModal();
      sync();
      try {
        await api('run_consistency_checks', {
          iteration
        });
        if (state.data?.iteration.id === iteration) {
          await refresh();
          toast(t('queued'));
        }
      } finally {
        starting.delete(iteration);
        sync();
      }
    }
    if (action === 'check-role') {
      const key = el.dataset.key, source = d.sources.find(s => s.key === key), file = state.data.files.find(f => key === domView.concat(f.id, ':file'));
      openModal(t('editRole'), domView.fragment([domView.element("p", [], [domView.fragment([source?.name || file?.name || '', source?.page ? domView.concat(domView.concat(domView.concat(' · ', t('page')), ' '), source.page) : ''])], false), domView.element("p", [], [t('rolesHint')], false), domView.element("form", [{
        "data-form": "check-role"
      }], [domView.element("input", [{
        "type": "hidden"
      }, {
        "name": "source_key"
      }, {
        "value": key
      }], [], false), domView.element("label", [], [t('source'), domView.element("select", [{
        "name": "role"
      }], [domView.element("option", [{
        "value": domView.text([])
      }], [t('automatic')], false), domView.join(roles.map(role => domView.element("option", [{
        "value": role
      }, domView.spread(d.roles[key] === role ? domView.attributes([{
        "selected": domView.text([])
      }]) : '')], [t(role)], false)), '')], false)], false), domView.element("button", [{
        "type": "submit"
      }, {
        "class": "button primary"
      }], [t('save')], false)], false)]));
    }
    if (action === 'check-review' && f) {
      const r = await api('review_consistency_finding', {
        iteration,
        id: f.id,
        operation: el.dataset.operation
      });
      await refresh(true);
      sync();
      if (el.dataset.operation === 'question') {
        closeModal();
        toast(t('questionSaved'));
        if (r.question_id) discuss(r.question_id);
      }
    }
    if (action === 'check-question' && f?.question_id) {
      closeModal();
      discuss(f.question_id);
    }
    if (action === 'check-evidence' && f && !f.stale) {
      const e = f.evidence[Number(el.dataset.evidence)];
      if (!e) return;
      let src = '';
      if (e.has_image) {
        try {
          const response = await platformFetch(new URLSearchParams({
            action: 'check_image',
            iteration,
            source_key: e.source_key
          }), {
            credentials: 'same-origin',
            headers: resourceHeaders()
          });
          if (response.ok) {
            src = URL.createObjectURL(await response.blob());
            setTimeout(() => URL.revokeObjectURL(src), 60000);
          }
        } catch {}
      }
      const box = e.bbox, overlay = box ? domView.element("span", [{
        "class": "check-region"
      }, {
        "style": domView.text(["left:", box[0] * 100, "%;top:", box[1] * 100, "%;width:", (box[2] - box[0]) * 100, "%;height:", (box[3] - box[1]) * 100, "%"])
      }], [], false) : '';
      openModal(t('evidence'), domView.fragment([domView.element("p", [], [domView.element("strong", [], [e.name], false), e.page ? domView.concat(domView.concat(domView.concat(' · ', t('page')), ' '), e.page) : ''], false), domView.element("p", [], [domView.fragment([t(e.role), " · ", e.object, " · ", e.value])], false), domView.fragment([e.quote ? domView.element("blockquote", [], [e.quote], false) : '', src ? domView.element("div", [{
        "class": "check-image"
      }], [domView.element("img", [{
        "src": src
      }, {
        "alt": e.object
      }], [], false), overlay], false) : e.has_image ? domView.element("p", [{
        "class": "notice"
      }], [t('imageUnavailable')], false) : '', button(t('original'), 'download', 'small ghost', domView.attributes([{
        "data-id": e.version_id
      }]))])]), true);
    }
  }
  async function submit(fields) {
    await api('check_source_role', {
      ...fields,
      iteration: state.data.iteration.id
    });
    closeModal();
    await refresh(true);
  }
  return {
    page,
    sources,
    action,
    submit,
    sync
  };
}
