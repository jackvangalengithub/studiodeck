import {commentPreviewImage} from './comment-preview.js';
import * as domView from "./render.js";
import {presentationCommunication} from './presentation-view.js';
import {createCommunicationControls} from './communication-controls.js';
import {summaryPerson, completionCheckbox, audienceSwitch, composerFields, initComposers, selectComposerType, composerText, threadTypes, plainMessageFields, normalizeThreadType} from './communication-composer.js';
import {mentionData, mentionBody} from './mentions.js';
import {getLanguage, tr} from './i18n.js';
export function communicationUi({state, onFilterChange = async () => {}, loadBudget = async () => true, openFile, api, render, refresh, openModal, closeModal, toast, button, icon, esc, personAvatar, slideDefs, startPresentation, markCommentsRead, openProject}) {
  const nl = {
    'Waiting for reply': 'Wacht op reactie',
    'Needs resolution': 'Moet worden opgelost',
    'Resolved': 'Opgelost',
    'Mark resolved': 'Markeer als opgelost',
    'Invite to this conversation': 'Uitnodigen voor dit gesprek',
    'Sending this request invites the selected person to this conversation and its attachments, including earlier messages. They will not receive presentation or project budget access.': 'Met dit verzoek nodig je de geselecteerde persoon uit voor dit gesprek en de bijlagen, inclusief eerdere berichten. Zij krijgen geen toegang tot de presentatie of projectbegroting.',
    'Conversation guests': 'Gasten in dit gesprek',
    'Remove access': 'Toegang intrekken',
    'Remove conversation access?': 'Toegang tot dit gesprek intrekken?',
    'This person will no longer be able to read or reply to this conversation or download its attachments.': 'Deze persoon kan dit gesprek niet meer lezen of beantwoorden en de bijlagen niet meer downloaden.',
    'Access removed.': 'Toegang ingetrokken.',
    'New conversation': 'Nieuw gesprek',
    'Team': 'Team',
    'Clients': 'Opdrachtgevers',
    'Other people involved': 'Overige betrokkenen',
    'Needs access': 'Toegang nodig',
    'Email address missing': 'E-mailadres ontbreekt',
    'Add an email address in People to invite a contact. Only the project team can invite new people to a conversation.': 'Voeg een e-mailadres toe bij Personen om iemand uit te nodigen. Alleen het projectteam kan nieuwe personen uitnodigen voor een gesprek.',
    'Subject': 'Onderwerp',
    'Start conversation': 'Gesprek starten',
    'Conversation started.': 'Gesprek gestart.',
    Communication: 'Communicatie',
    'All communication': 'Alle communicatie',
    Confirmations: 'Bevestigingen',
    'Pending only': 'Alleen openstaand',
    Everyone: 'Iedereen',
    'Needs my confirmation': 'Wacht op mijn bevestiging',
    'Waiting for someone else': 'Wacht op iemand anders',
    'Post reply': 'Reactie plaatsen',
    'Ask for confirmation': 'Om bevestiging vragen',
    'Confirm with': 'Bevestiging vragen aan',
    Message: 'Bericht',
    'Include a budget change': 'Budgetwijziging toevoegen',
    'Budget change (€) · including VAT': 'Budgetwijziging (€) · inclusief btw',
    'including VAT': 'inclusief btw',
    'Added to the budget only after confirmation.': 'Wordt pas na bevestiging aan het budget toegevoegd.',
    'Use a positive amount for extra cost (1000), or a negative amount for a cheaper option (−250). Enter the change, not the new total.': 'Gebruik een positief bedrag voor extra kosten (1000), of een negatief bedrag voor een goedkopere optie (−250). Vul de wijziging in, niet het nieuwe totaal.',
    'Pending confirmation': 'Wacht op bevestiging',
    Confirmed: 'Bevestigd',
    Withdrawn: 'Ingetrokken',
    Confirm: 'Bevestigen',
    Withdraw: 'Intrekken',
    Reply: 'Reageren',
    Cancel: 'Annuleren',
    'Send confirmation request': 'Verstuur bevestigingsverzoek',
    'General conversation': 'Algemeen gesprek',
    Conversations: 'Gesprekken',
    'Slide comments included': 'Inclusief opmerkingen bij dia’s',
    'Discuss the details. Ask for a go-ahead. Keep the answer here.': 'Bespreek de details. Vraag om akkoord. Bewaar het antwoord hier.',
    'Shared with the project team and clients with access to this iteration.': 'Gedeeld met het projectteam en klanten met toegang tot deze iteratie.',
    'No messages yet. Start the conversation below.': 'Nog geen berichten. Begin hieronder een gesprek.',
    'No confirmations match this view.': 'Geen bevestigingen voor dit filter.',
    'Open conversation': 'Gesprek openen',
    'Open original slide': 'Oorspronkelijke dia openen',
    'Attach a file': 'Bestand toevoegen',
    optional: 'optioneel',
    'Choose a project file': 'Kies een projectbestand',
    'No file attached': 'Geen bestand toegevoegd',
    'Or upload and link a file': 'Of upload en koppel een bestand',
    'Linked · processing in the background': 'Gekoppeld · wordt op de achtergrond verwerkt',
    'Uploading…': 'Uploaden…',
    'View confirmation': 'Bevestiging bekijken',
    'Added to budget': 'Toegevoegd aan budget',
    'Budget change': 'Budgetwijziging',
    'Back to presentation': 'Terug naar presentatie',
    'Withdraw this request?': 'Dit verzoek intrekken?',
    'It will remain in the conversation as withdrawn. The budget will not change.': 'Het blijft als ingetrokken in het gesprek staan. Het budget verandert niet.',
    'Request sent.': 'Verzoek verstuurd.',
    'Reply posted.': 'Reactie geplaatst.',
    'Confirmation recorded.': 'Bevestiging vastgelegd.',
    'Request withdrawn.': 'Verzoek ingetrokken.',
    'Waiting for': 'Wacht op',
    'Confirmed by': 'Bevestigd door',
    'Requested by': 'Aangevraagd door',
    'No other participants have access to this iteration yet. Add a team member or share this iteration with a client first.': 'Er hebben nog geen andere deelnemers toegang tot deze iteratie. Voeg een teamlid toe of deel deze iteratie eerst met een klant.',
    'Adding a file is unavailable while this iteration is locked.': 'Een bestand toevoegen kan niet zolang deze iteratie vergrendeld is.',
    'Replying to a confirmation request': 'Reactie op een bevestigingsverzoek',
    'This exact file version stays attached to the message.': 'Deze exacte bestandsversie blijft aan het bericht gekoppeld.',
    'Download file': 'Bestand downloaden',
    pending: 'openstaand',
    'Read-only project access': 'Alleen leestoegang tot dit project',
    'View pending confirmations': 'Openstaande bevestigingen bekijken',
    'Supported files: PDF, PowerPoint, Excel, CSV, JPG, PNG and WebP.': 'Ondersteunde bestanden: PDF, PowerPoint, Excel, CSV, JPG, PNG en WebP.',
    'Maximum file size: 100 MB.': 'Maximale bestandsgrootte: 100 MB.',
    'Linked documents are processed without adding costs to the budget.': 'Gekoppelde documenten worden verwerkt zonder kosten aan het budget toe te voegen.'
  };
  Object.assign(nl, {
    'Edit thread': 'Gesprek bewerken',
    'Sharing makes earlier messages and attachments visible to clients with access.': 'Delen maakt eerdere berichten en bijlagen zichtbaar voor klanten met toegang.',
    'Approval recipients and prices are fixed. Start a linked thread to change them.': 'Ontvangers en bedragen van akkoordverzoeken staan vast. Start een gekoppeld gesprek om deze te wijzigen.',
    'Started by': 'Gestart door',
    'Thread details': 'Gespreksgegevens',
    'Change thread': 'Gesprek wijzigen',
    'New linked thread': 'Nieuw gekoppeld gesprek',
    'Linked conversations': 'Gekoppelde gesprekken',
    'Linked to': 'Gekoppeld aan',
    'Thread history': 'Gespreksgeschiedenis',
    'Open': 'Open',
    'Answered': 'Beantwoord',
    'Mark complete': 'Markeer als afgerond',
    'Reopen': 'Heropenen',
    'This starts a separate conversation. Its approval and completion are tracked independently.': 'Dit start een apart gesprek. Akkoord en afronding worden afzonderlijk bijgehouden.',
    'Needs attention': 'Aandacht nodig',
    'Unread messages, open questions or to dos, and pending approvals.': 'Ongelezen berichten, open vragen of taken en openstaande bevestigingen.',
    'View evidence': 'Bron bekijken',
    'Studio only': 'Alleen studio',
    'Shared': 'Gedeeld',
    'Audience': 'Zichtbaar voor',
    'Team and clients with access to this iteration': 'Team en klanten met toegang tot deze iteratie',
    'Shared with clients who can access the original iteration.': 'Gedeeld met klanten die toegang hebben tot de oorspronkelijke iteratie.',
    'Every subject, from first question to completed work.': 'Elk onderwerp, van eerste vraag tot afgerond werk.',
    'Communication views': 'Communicatieweergaven',
    'Unread': 'Ongelezen',
    'unread': 'ongelezen',
    'Needs my response': 'Wacht op mijn reactie',
    'Open actions': 'Open acties',
    'Open action': 'Open actie',
    'open actions': 'open acties',
    'Awaiting approval': 'Wacht op akkoord',
    'awaiting approval': 'wacht op akkoord',
    'Completed': 'Afgerond',
    'Add action': 'Actie toevoegen',
    'Share conversation': 'Gesprek delen',
    'Reopen discussion': 'Gesprek heropenen',
    'Mark answered': 'Markeren als beantwoord',
    'No conversations match this view.': 'Geen gesprekken voor dit filter.',
    'Keep the whole subject together.': 'Houd het hele onderwerp bij elkaar.',
    'Start a conversation to discuss a question, track actions, or request approval.': 'Start een gesprek om een vraag te bespreken, acties bij te houden of akkoord te vragen.',
    'Share this conversation first to request approval from a client.': 'Deel dit gesprek eerst om akkoord van een klant te vragen.',
    'Clients with access to the original iteration will be able to read all earlier messages and attachments. Studio-only action details stay private until you share those items.': 'Klanten met toegang tot de oorspronkelijke iteratie kunnen alle eerdere berichten en bijlagen lezen. Actiedetails voor de studio blijven privé totdat je die items deelt.'
  });
  Object.assign(nl, {
    'Needs my attention': 'Heeft mijn aandacht nodig',
    'All': 'Alles',
    'All types': 'Alle typen',
    'Type': 'Type',
    'Origin': 'Oorsprong',
    'Link to slide': 'Koppel aan dia',
    'Link to slide (optional)': 'Koppel aan dia (optioneel)',
    'No slide · project-wide': 'Geen dia · projectbreed',
    'Choose a slide': 'Kies een dia',
    'Original slide unavailable': 'Oorspronkelijke dia niet beschikbaar',
    'The original slide stays linked to this presentation version.': 'De oorspronkelijke dia blijft gekoppeld aan deze presentatieversie.',
    'Slide linked.': 'Dia gekoppeld.',
    'Introduction': 'Introductie',
    'Changes': 'Wijzigingen',
    'Budget': 'Begroting',
    'Checklist': 'Checklist',
    'Project team': 'Projectteam',
    'Summary': 'Samenvatting'
  });
  const t = s => getLanguage() === 'nl' ? nl[s] || s : s;
  let thread = '', view = 'open', revealThread = false, scope = '', replyTo = null, highlight = null, busy = false;
  const controls = createCommunicationControls({
    id: 'project',
    esc,
    icon,
    typeLabel: type => typeLabel(type),
    openModal,
    onChange: reloadList,
    onError: toast,
    onViewAll: async () => {
      view = 'all';
      await reloadList();
    }
  });
  async function reloadList() {
    if (state.capabilities?.platform && !state.client) {
      await onFilterChange();
    } else controls.render(render);
  }
  const drafts = new Map();
  const $ = s => document.querySelector(s);
  const data = () => state.present ? presentationCommunication(state.data) : state.data?.communication;
  const enabled = () => !!data();
  const actor = () => data()?.actor;
  const canWrite = () => state.client || state.data?.can_edit !== false;
  const btn = (text, action, kind = '', extra = '', ico = '') => button(t(text), domView.concat('comm-', action), kind, extra, ico);
  const time = s => new Date(s).toLocaleString(getLanguage() === 'nl' ? 'nl-NL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  const signed = n => domView.concat(n > 0 ? '+ ' : n < 0 ? '− ' : '', new Intl.NumberFormat(getLanguage() === 'nl' ? 'nl-NL' : 'en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: n % 100 ? 2 : 0
  }).format(Math.abs(n) / 100));
  const comments = () => data()?.comments || state.data?.comments || [];
  const items = () => data()?.items || state.data?.open_questions || [];
  const root = () => comments().find(c => c.id === thread);
  const topic = c => c?.thread_details;
  const typeLabel = type => composerText(threadTypes.find(([key]) => key === normalizeThreadType(type))?.[1] || 'Conversation');
  const statusLabel = c => t(c.confirmation ? c.confirmation.status === 'confirmed' ? 'Confirmed' : c.confirmation.status === 'withdrawn' ? 'Withdrawn' : 'Pending confirmation' : c.is_open ? 'Open' : threadType(c) === 'conversation' ? 'Resolved' : 'Completed');
  const viewLabel = (label, count) => domView.fragment([domView.element("span", [], [t(label)], false), count === undefined ? '' : domView.element("span", [{
    "class": "comm-view-count"
  }], [new Intl.NumberFormat(getLanguage()).format(count)], false)]);
  const contextIteration = () => root()?.iteration_id || state.data.iteration.id;
  const contextInfo = () => data()?.iterations?.find(i => i.id === contextIteration()) || state.data.iteration;
  const recipients = () => {
    const people = data()?.iteration_recipients?.[contextIteration()] || data()?.recipients || [];
    return state.present ? people.filter(p => !p.invitable) : people;
  };
  const privateThread = () => root()?.audience === 'studio';
  const threadItems = id => items().filter(q => q.thread_id === id && !Number(q.dismissed));
  const openItems = id => threadItems(id).filter(q => !Number(q.resolved) && (Number(q.accepted) || Number(q.published)));
  const threadRequests = id => requests().filter(r => threadFor({
    id: r.comment_id,
    parent_id: r.parent_id
  }) === id && r.status === 'pending');
  const legacyCompleted = c => (!!Number(c.answered) || threadItems(c.id).length > 0) && !openItems(c.id).length && !threadRequests(c.id).length;
  const completed = c => c.is_open === undefined ? legacyCompleted(c) : !c.is_open;
  const threadType = c => normalizeThreadType(topic(c)?.type || c.thread_type || (c.confirmation ? 'approval' : 'conversation'));
  const audienceLabel = () => t(privateThread() ? 'Studio only' : 'Shared with clients who can access the original iteration.');
  const requests = () => data()?.confirmations || [];
  const pendingCount = () => requests().filter(r => r.status === 'pending').length;
  const rootFor = c => comments().find(x => x.id === c.parent_id) || c;
  const threadTitle = id => comments().find(c => c.id === id)?.thread_title || data()?.threads?.find(t => (t.comment_id || t.id) === id)?.title;
  const threadFor = c => rootFor(c).id;
  const inThread = c => threadFor(c) === thread;
  const name = email => recipients().find(p => p.email === email)?.name || comments().find(c => c.author === email)?.profile?.name || email;
  function ensureScope() {
    const key = domView.concat(domView.concat(state.data?.project.id, ':'), state.present ? state.data?.iteration.id : 'studio');
    if (scope !== key) {
      scope = key;
      thread = '';
      replyTo = null;
      highlight = null;
      controls.restore(state.communicationParams || ({}));
      view = state.communicationParams?.filter || 'open';
    }
  }
  function attachment(c) {
    const a = data()?.attachments.find(a => a.comment_id === c.id);
    return a ? domView.element("button", [{
      "class": "comm-attachment"
    }, {
      "data-action": "comm-download"
    }, {
      "data-id": a.id
    }, {
      "data-iteration": c.iteration_id
    }], [icon('file'), domView.element("span", [], [domView.fragment([a.name, " "]), domView.element("small", [], [domView.fragment(["· V", a.number])], false)], false), icon('download')], false) : '';
  }
  function card(r, compact = false) {
    const checklist = items().find(q => q.confirmation_id === r.comment_id && !Number(q.dismissed));
    const c = comments().find(c => c.id === r.comment_id) || ({
      id: r.comment_id
    }), done = r.status === 'confirmed', withdrawn = r.status === 'withdrawn';
    return domView.element("article", [{
      "class": domView.text(["comm-confirmation is-", r.status, highlight === r.comment_id ? ' is-highlighted' : ''])
    }, {
      "data-confirmation": r.comment_id
    }], [domView.element("div", [{
      "class": "comm-confirmation-top"
    }], [domView.element("span", [{
      "class": domView.text(["comm-status ", done ? 'done' : withdrawn ? 'closed' : 'pending'])
    }], [domView.fragment([icon(done ? 'check' : withdrawn ? 'close' : 'clock'), t(done ? 'Confirmed' : withdrawn ? 'Withdrawn' : 'Pending confirmation')])], false), domView.element("small", [], [domView.fragment([name(r.author), " → ", r.recipient_name, " · ", time(r.created_at)])], false)], false), domView.fragment([!topic(c) ? domView.fragment([domView.element("p", [], [mentionBody(r.body, comments().find(c => c.id === r.comment_id)?.mentions)], false), attachment(c)]) : '', r.amount_cents !== null ? domView.element("div", [{
      "class": "comm-budget-change"
    }], [icon('budget'), domView.element("span", [], [domView.fragment([t('Budget change'), " "]), domView.element("strong", [], [signed(r.amount_cents)], false), " ", domView.element("small", [], [t('including VAT')], false)], false)], false) : '']), domView.element("div", [{
      "class": "comm-confirmation-bottom"
    }], [domView.fragment([done ? domView.fragment([domView.element("span", [{
      "class": "comm-confirmed-by"
    }], [domView.fragment([icon('check'), t('Confirmed by'), " ", r.recipient_name, " · ", time(r.decided_at)])], false), r.amount_cents !== null ? btn('Added to budget', 'budget', 'small ghost', domView.attributes([{
      "data-id": r.comment_id
    }])) : '']) : withdrawn ? domView.element("small", [], [domView.fragment([t('Withdrawn'), " · ", time(r.decided_at)])], false) : domView.text(["", canWrite() && r.recipient === actor() ? btn(r.amount_cents !== null ? domView.concat(domView.concat(t('Confirm'), ' · '), signed(r.amount_cents)) : 'Confirm', 'confirm', 'primary small', domView.attributes([{
      "data-id": r.comment_id
    }, domView.spread(r.amount_cents !== null && Number(data().iterations?.find(i => i.id === r.iteration_id)?.locked) ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')]), 'check') : domView.element("small", [{
      "class": "muted"
    }], [domView.fragment([t('Waiting for'), " ", r.recipient_name])], false), "", canWrite() ? btn('Reply', 'reply', 'small ghost', domView.attributes([{
      "data-id": r.comment_id
    }])) : '', "", canWrite() && r.author === actor() ? btn('Withdraw', 'withdraw', 'small ghost', domView.attributes([{
      "data-id": r.comment_id
    }])) : '', ""]), checklist ? button(tr('checklist_view_item'), 'discuss-open-question', 'small ghost', domView.attributes([{
      "data-id": checklist.id
    }])) : '', compact ? btn('Open conversation', 'open', 'small ghost', domView.attributes([{
      "data-id": r.comment_id
    }]), 'arrow') : ''])], false)], false);
  }
  function message(c) {
    const r = requests().find(r => r.comment_id === c.id);
    return r && !topic(c) ? card(r) : domView.element("article", [{
      "class": "comm-message"
    }, {
      "data-message": c.id
    }], [domView.element("div", [{
      "class": "comment-author"
    }], [personAvatar(c.profile, c.author), domView.element("small", [], [domView.element("strong", [], [c.profile?.name || name(c.author)], false), domView.fragment([" · ", time(c.created_at)])], false)], false), domView.element("div", [{
      "class": "comm-message-body"
    }], [domView.element("p", [], [mentionBody(c.body, c.mentions)], false), attachment(c)], false)], false);
  }
  function threadDetails(c) {
    const request = requests().find(r => r.comment_id === c.id), d = topic(c) || ({
      type: request ? 'approval' : 'conversation'
    }), done = d.question_id ? !!d.resolved : !!Number(c.answered), canManage = canWrite() && (!state.client && !state.present || c.author === actor()), canComplete = canWrite() && !Number(contextInfo().locked) && (!state.client && !state.present || c.author === actor() || d.assignee === actor());
    const evidence = items().find(q => q.id === d.question_id)?.citations || [];
    const linked = comments().filter(other => !other.parent_id && (other.thread_details?.related_root_id === c.id || other.id === d.related_root_id));
    const status = request ? request.status === 'confirmed' ? 'Confirmed' : request.status === 'withdrawn' ? 'Withdrawn' : 'Pending confirmation' : done ? d.type === 'conversation' ? 'Resolved' : 'Completed' : 'Open';
    const statusClass = request ? request.status === 'confirmed' ? 'done' : request.status === 'withdrawn' ? 'closed' : 'pending' : done ? 'done' : 'pending';
    const canConfirm = request?.status === 'pending' && canWrite() && request.recipient === actor() && !(request.amount_cents !== null && Number(contextInfo().locked));
    const completion = request ? completionCheckbox({
      checked: request.status === 'confirmed',
      disabled: !canConfirm,
      label: canConfirm ? domView.concat(t('Confirm'), request.amount_cents !== null ? domView.concat(' · ', signed(request.amount_cents)) : '') : request.status === 'pending' ? domView.concat(domView.concat(t('Waiting for'), ' '), request.recipient_name) : t(request.status === 'confirmed' ? 'Confirmed' : 'Withdrawn'),
      attributes: domView.attributes([{
        "data-action": "comm-confirm"
      }, {
        "data-id": c.id
      }])
    }) : completionCheckbox({
      checked: done,
      disabled: !(d.question_id ? canComplete : d.type === 'conversation' && canWrite()),
      attributes: d.question_id ? domView.attributes([{
        "data-action": "comm-work"
      }, {
        "data-id": c.id
      }, {
        "data-resolved": !done
      }]) : domView.attributes([{
        "data-action": "comm-answered"
      }, {
        "data-id": c.id
      }])
    });
    const personName = request ? request.status === 'withdrawn' ? name(request.author) : request.recipient_name : d.assignee_name || name(c.author);
    const personLabel = request ? t(request.status === 'confirmed' ? 'Confirmed by' : request.status === 'withdrawn' ? 'Requested by' : 'Confirm with') : d.assignee_name ? composerText(d.type === 'conversation' ? 'Waiting for' : 'Responsible') : t('Started by');
    const meta = domView.concat(summaryPerson(personLabel, personName, request?.decided_at ? time(request.decided_at) : ''), domView.element("div", [{
      "class": "comm-summary-detail"
    }], [domView.fragment([d.due_date ? domView.element("p", [], [domView.element("span", [], [composerText('Due date (optional)').replace(' (optional)', '').replace(' (optioneel)', '')], false), domView.element("strong", [], [d.due_date], false)], false) : '', request?.amount_cents !== null && request?.amount_cents !== undefined ? domView.element("p", [{
      "class": "comm-summary-amount"
    }], [domView.element("strong", [], [signed(request.amount_cents)], false), domView.element("small", [], [domView.fragment([t('Budget change'), " · ", t('including VAT')])], false)], false) : '', !d.due_date && (request?.amount_cents === null || request?.amount_cents === undefined) ? domView.element("small", [], [domView.fragment([t(privateThread() ? 'Studio only' : 'Shared'), " · V", c.iteration_number || 1])], false) : ''])], false));
    const requestActions = request ? request.status === 'pending' && canWrite() && request.author === actor() ? btn('Withdraw', 'withdraw', 'small ghost', domView.attributes([{
      "data-id": request.comment_id
    }])) : request.status === 'confirmed' && request.amount_cents !== null ? btn('Added to budget', 'budget', 'small ghost', domView.attributes([{
      "data-id": request.comment_id
    }])) : '' : '';
    return domView.element("div", [{
      "class": "comm-thread-details"
    }, {
      "data-thread-type": d.type
    }], [domView.element("article", [{
      "class": domView.text(["comm-thread-summary", request ? domView.concat(' comm-confirmation is-', request.status) : '', highlight === c.id ? ' is-highlighted' : ''])
    }, domView.spread(request ? domView.attributes([{
      "data-confirmation": c.id
    }]) : '')], [domView.element("div", [{
      "class": "comm-summary-main"
    }], [domView.element("div", [{
      "class": "comm-summary-copy"
    }], [domView.element("div", [{
      "class": "comm-summary-eyebrow"
    }], [domView.element("span", [{
      "class": "comm-type-label"
    }], [typeLabel(d.type)], false), domView.element("span", [{
      "class": domView.text(["comm-status ", statusClass])
    }], [t(status)], false)], false), domView.element("div", [{
      "class": "comm-summary-title"
    }], [domView.element("h2", [], [threadTitle(c.id) || c.body.slice(0, 90)], false)], false), domView.element("div", [{
      "class": "comm-summary-body"
    }], [domView.element("p", [], [mentionBody(c.body, c.mentions)], false), domView.element("small", [{
      "class": "comm-summary-attribution"
    }], [domView.fragment([name(c.author), " · ", time(c.created_at)])], false), attachment(c)], false)], false), completion], false), domView.element("div", [{
      "class": "comm-summary-meta"
    }], [meta], false)], false), domView.element("div", [{
      "class": "comm-summary-actions"
    }], [domView.fragment([requestActions, !state.client && canWrite() && privateThread() ? btn('Share conversation', 'share', 'small ghost') : '', canManage && !Number(contextInfo().locked) ? btn('Edit thread', 'edit-thread', 'small ghost') : '', canWrite() ? btn('New linked thread', 'linked', 'small ghost', '', 'plus') : '', c.slide === 'general' && canManage && !Number(contextInfo().locked) ? btn('Link to slide', 'link-slide', 'small ghost') : ''])], false), domView.fragment([linked.length ? domView.element("div", [{
      "class": "comm-linked"
    }], [domView.element("small", [], [t('Linked conversations')], false), domView.join(linked.map(other => btn(threadTitle(other.id) || other.body.slice(0, 90), 'open', 'small ghost', domView.attributes([{
      "data-id": other.id
    }]))), '')], false) : '', evidence.length ? domView.element("details", [{
      "class": "comm-thread-history"
    }], [domView.element("summary", [], [t('View evidence')], false), domView.join(evidence.map(e => domView.element("blockquote", [], [e.quote, domView.element("small", [], [domView.fragment([e.name, e.page ? domView.concat(' · p. ', e.page) : ''])], false), btn('View evidence', 'evidence', 'small ghost', domView.attributes([{
      "data-id": e.version_id
    }, {
      "data-page": Number(e.page) || 0
    }, {
      "data-iteration": c.iteration_id
    }]))], false)), '')], false) : '', d.history?.length ? domView.element("details", [{
      "class": "comm-thread-history"
    }], [domView.element("summary", [], [t('Thread history')], false), domView.join(d.history.map(h => domView.element("p", [], [domView.element("small", [], [domView.fragment([name(h.actor), " · ", time(h.created_at)])], false), domView.element("br", [], [], false), domView.fragment([typeLabel(h.from_type), " → ", typeLabel(h.to_type), h.assignee_name ? domView.concat(' · ', h.assignee_name) : '', h.due_date ? domView.concat(' · ', h.due_date) : ''])], false)), '')], false) : ''])], false);
  }
  function editThread() {
    const c = root(), request = requests().find(r => r.comment_id === c.id), d = topic(c) || ({
      type: request ? 'approval' : 'conversation'
    }), people = [...recipients()];
    if (request && !people.some(p => p.email === request.recipient)) people.push({
      email: request.recipient,
      name: request.recipient_name,
      group: 'other',
      available: true
    });
    const fixedAudience = !!state.client || !!state.present || !!(request && people.find(p => p.email === request.recipient)?.group !== 'team');
    const audience = privateThread() ? 'studio' : 'shared', types = threadTypes.filter(([key]) => d.type === 'approval' ? key === 'approval' : d.type === 'todo' ? key === 'todo' : ['conversation', 'todo'].includes(key));
    openModal(t('Edit thread'), domView.element("form", [{
      "id": "comm-edit-thread-form"
    }, {
      "data-edit-thread": "1"
    }, {
      "data-original-audience": audience
    }], [domView.fragment([composerFields({
      people,
      actor: actor(),
      type: request && request.amount_cents !== null ? 'price_adjustment' : d.type,
      types,
      showBody: false,
      readonlyApproval: !!request,
      details: domView.fragment([domView.element("label", [], [t('Subject'), domView.element("input", [{
        "name": "thread_title"
      }, {
        "value": threadTitle(c.id) || c.body.slice(0, 90)
      }, {
        "maxlength": "160"
      }, {
        "required": domView.text([])
      }], [], false)], false), audienceSwitch(audience, fixedAudience), domView.element("p", [{
        "class": "form-hint"
      }, {
        "data-compose-share-history": domView.text([])
      }, {
        "hidden": domView.text([])
      }], [t('Sharing makes earlier messages and attachments visible to clients with access.')], false)])
    }), request ? domView.element("p", [{
      "class": "form-hint"
    }], [t('Approval recipients and prices are fixed. Start a linked thread to change them.')], false) : '', slidePicker(contextIteration(), c.slide, false, c.slide !== 'general')]), domView.element("p", [{
      "class": "form-error"
    }, {
      "data-comm-error": domView.text([])
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button(t('Cancel'), 'close-modal', 'ghost'), domView.element("button", [{
      "type": "submit"
    }, {
      "class": "button primary"
    }], [composerText('Save thread')], false)], false)], false));
    const form = $('#comm-edit-thread-form');
    form.elements.assignee.value = d.assignee || '';
    form.elements.due_date.value = d.due_date || '';
    if (request) {
      form.elements.recipient.value = request.recipient;
      form.elements.amount.value = request.amount_cents === null ? '' : String(request.amount_cents / 100);
    }
    initComposers(document.querySelector('.modal'));
  }
  function attachFields(fresh = false) {
    return domView.element("details", [{
      "class": "comm-attach-details"
    }], [domView.element("summary", [], [domView.fragment([icon('file'), t('Attach a file'), " "]), domView.element("span", [{
      "class": "muted"
    }], [t('optional')], false)], false), domView.element("div", [{
      "class": "comm-attach-fields"
    }], [domView.element("label", [], [t('Choose a project file'), domView.element("select", [{
      "name": "version_id"
    }], [domView.element("option", [{
      "value": domView.text([])
    }], [t('No file attached')], false), domView.join((fresh ? state.data.files || [] : data()?.iteration_files?.[contextIteration()] || state.data.files || []).map(f => domView.element("option", [{
      "value": f.id
    }], [domView.fragment([f.name, " · V", f.number])], false)), '')], false)], false), !Number(fresh ? state.data.iteration.locked : contextInfo().locked) ? domView.fragment([domView.element("label", [{
      "class": "comm-upload-label"
    }], [domView.fragment([icon('upload'), t('Or upload and link a file')]), domView.element("input", [{
      "type": "file"
    }, {
      "data-comm-upload": domView.text([])
    }, {
      "accept": ".pdf,.png,.jpg,.jpeg,.webp,.ppt,.pptx,.xls,.xlsx,.csv"
    }], [], false)], false), domView.element("small", [{
      "class": "form-hint"
    }], [domView.fragment([t('Supported files: PDF, PowerPoint, Excel, CSV, JPG, PNG and WebP.'), " ", t('Maximum file size: 100 MB.'), " ", t('Linked documents are processed without adding costs to the budget.')])], false)]) : domView.element("small", [], [t('Adding a file is unavailable while this iteration is locked.')], false), domView.element("div", [{
      "data-comm-upload-status": domView.text([])
    }, {
      "role": "status"
    }], [], false)], false)], false);
  }
  function itemCard(q) {
    const source = comments().find(c => c.thread_details?.question_id === q.id), details = source?.thread_details;
    const canComplete = source && canWrite() && !q.locked && (!state.client && !state.present || source.author === actor() || details.assignee === actor());
    const canEdit = !state.client && !state.present && canWrite() && !q.locked;
    return domView.element("article", [{
      "class": domView.text(["comm-work-item ", Number(q.resolved) ? 'is-done' : ''])
    }, {
      "data-thread-type": q.item_type === 'action' ? 'todo' : 'conversation'
    }], [domView.element("div", [{
      "class": "row between"
    }], [domView.element("span", [{
      "class": "tag outline"
    }], [tr(q.item_type === 'action' ? 'checklist_action' : 'question')], false), domView.element("span", [{
      "class": "tag"
    }], [tr(Number(q.published) ? 'checklist_shared' : 'checklist_private')], false)], false), domView.element("h3", [], [q.question], false), domView.fragment([q.responsible ? domView.element("p", [], [domView.fragment([tr('checklist_responsible'), ": ", q.responsible])], false) : '', details?.due_date ? domView.element("p", [], [domView.fragment([composerText('Due date (optional)').replace(' (optional)', '').replace(' (optioneel)', ''), ": ", details.due_date])], false) : '', q.reason ? domView.element("p", [], [q.reason], false) : '', q.answer ? domView.element("p", [{
      "class": "question-answer"
    }], [q.answer], false) : '', q.stale ? domView.element("p", [{
      "class": "notice"
    }], [tr('checklist_stale')], false) : '', domView.join((q.citations || []).map(c => domView.element("blockquote", [], [c.quote, domView.element("small", [], [domView.fragment([c.name, c.page ? domView.concat(' · p. ', c.page) : ''])], false), btn('View evidence', 'evidence', 'small ghost', domView.attributes([{
      "data-id": c.version_id
    }, {
      "data-page": Number(c.page) || 0
    }, {
      "data-iteration": q.iteration_id
    }]))], false)), '')]), domView.element("div", [{
      "class": "row wrap"
    }], [domView.fragment([canComplete ? completionCheckbox({
      checked: !!Number(q.resolved),
      label: tr(Number(q.resolved) ? 'checklist_reopen' : 'checklist_done'),
      attributes: domView.attributes([{
        "data-action": "comm-work"
      }, {
        "data-id": source.id
      }, {
        "data-resolved": !Number(q.resolved)
      }])
    }) : '', canEdit ? domView.concat(!canComplete ? completionCheckbox({
      checked: !!Number(q.resolved),
      label: tr(Number(q.resolved) ? 'checklist_reopen' : 'checklist_done'),
      attributes: domView.attributes([{
        "data-action": "change-open-question"
      }, {
        "data-id": q.id
      }, {
        "data-operation": Number(q.resolved) ? 'reopen' : 'resolve'
      }])
    }) : '', button(tr('edit'), 'edit-open-question', 'small ghost', domView.attributes([{
      "data-id": q.id
    }]))) : domView.element("span", [], [t(Number(q.resolved) ? 'Completed' : 'Open action')], false), canEdit && q.confirmation?.status !== 'pending' ? button(tr('checklist_request_approval'), 'checklist-request-approval', 'small ghost', domView.attributes([{
      "data-id": q.id
    }])) : ''])], false)], false);
  }
  function matches(c, selectedView = view) {
    if (!controls.accepts(threadType(c))) return false;
    if (controls.search) {
      const source = slideOptions(c.iteration_id).find(slide => slide.id === c.slide), text = domView.join([threadTitle(c.id), source?.title, ...comments().filter(m => threadFor(m) === c.id).flatMap(m => [m.body, m.author])], '\n').toLocaleLowerCase();
      if (!text.includes(controls.search.toLocaleLowerCase())) return false;
    }
    return selectedView === 'open' ? !completed(c) : selectedView === 'attention' ? !!c.needs_attention : true;
  }
  const slideOptions = iid => data()?.iteration_slides?.[iid] || [];
  function slidePicker(iid, selected = '', required = false, fixed = false) {
    const slides = slideOptions(iid), missing = selected && selected !== 'general' && !slides.some(slide => slide.id === selected);
    return domView.element("div", [{
      "class": "comm-slide-fields"
    }], [fixed ? domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "slide"
    }, {
      "value": selected
    }], [], false) : '', domView.element("label", [{
      "class": "comm-slide-picker"
    }], [t(required ? 'Link to slide' : 'Link to slide (optional)'), domView.element("select", [domView.spread(fixed ? domView.attributes([{
      "disabled": domView.text([])
    }]) : domView.attributes([{
      "name": "slide"
    }])), domView.spread(required ? domView.attributes([{
      "required": domView.text([])
    }]) : '')], [domView.element("option", [{
      "value": required ? '' : 'general'
    }], [t(required ? 'Choose a slide' : 'No slide · project-wide')], false), domView.fragment([missing ? domView.element("option", [{
      "value": selected
    }, {
      "selected": domView.text([])
    }], [t('Original slide unavailable')], false) : '', domView.join(slides.map(slide => domView.element("option", [{
      "value": slide.id
    }, domView.spread(slide.id === selected ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [t(slide.title)], false)), '')])], false)], false), domView.element("p", [{
      "class": "form-hint"
    }], [t('The original slide stays linked to this presentation version.')], false)], false);
  }
  function origin(c) {
    if (c.slide === 'general') return '';
    const source = slideOptions(c.iteration_id).find(slide => slide.id === c.slide);
    return domView.element("div", [{
      "class": "comm-origin"
    }], [domView.element("small", [], [t('Origin')], false), source ? domView.element("button", [{
      "class": "comm-context"
    }, {
      "data-action": "comm-source"
    }, {
      "data-slide": c.slide
    }, {
      "data-iteration": c.iteration_id
    }], [commentPreviewImage(c,t(source.title)), domView.element("span", [], [domView.element("strong", [], [domView.fragment([t(source.title), " · V", c.iteration_number || 1])], false), domView.element("small", [], [domView.fragment([t('Open original slide'), c.annotation ? domView.concat(' · ', tr(c.annotation.image_version_id ? 'pin_on_variation' : 'pin_on_original')) : ''])], false)], false), icon('arrow')], false) : domView.element("p", [{
      "class": "muted"
    }], [domView.fragment([t('Original slide unavailable'), " · V", c.iteration_number || 1])], false)], false);
  }
  function linkSlide() {
    openModal(t('Link to slide'), domView.element("form", [{
      "id": "comm-slide-form"
    }], [slidePicker(contextIteration(), '', true), domView.element("p", [{
      "class": "form-error"
    }, {
      "data-comm-error": domView.text([])
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button(t('Cancel'), 'close-modal', 'ghost'), domView.element("button", [{
      "class": "button primary"
    }, {
      "type": "submit"
    }], [t('Link to slide')], false)], false)], false));
  }
  function page() {
    ensureScope();
    const roots = comments().filter(c => !c.parent_id).sort((a, b) => {
      const latest = c => comments().filter(m => threadFor(m) === c.id).at(-1)?.created_at || c.created_at;
      return (latest(b).localeCompare(latest(a)) || Number(b.comment_order) - Number(a.comment_order)) * (controls.sort === 'oldest' ? -1 : 1);
    }), server = data()?.server_filtered, filtered = server ? roots : roots.filter(c => matches(c));
    if (revealThread) {
      const index = filtered.findIndex(c => c.id === thread);
      if (index >= 0) controls.setOffset(Math.floor(index / controls.limit) * controls.limit);
      revealThread = false;
    }
    if (server) controls.setOffset(data().offset); else controls.clamp(filtered.length);
    const visible = server ? filtered : filtered.slice(controls.offset, domView.concat(controls.offset, controls.limit));
    if (!visible.some(c => c.id === thread)) thread = visible[0]?.id || '';
    const selected = root(), entries = comments().filter(c => inThread(c) && c.id !== selected?.id).reverse(), work = threadItems(thread).filter(q => q.id !== topic(selected)?.question_id);
    const counts = server ? data().view_counts : {
      open: roots.filter(c => matches(c, 'open')).length,
      attention: roots.filter(c => matches(c, 'attention')).length
    };
    const tabs = [['open', 'Open'], ['attention', 'Needs my attention'], ['all', 'All']];
    const heading = domView.fragment([domView.element("div", [{
      "class": "section-title comm-section-title"
    }], [domView.element("div", [], [domView.element("h2", [], [t('Communication')], false), domView.element("p", [{
      "class": "muted"
    }], [t('Every subject, from first question to completed work.')], false)], false), domView.element("div", [{
      "class": "row wrap project-tab-actions"
    }], [domView.fragment([!state.client && !state.present && canWrite() ? button(tr('checklist_suggest'), 'check-run', 'ghost', '', 'spark') : '', canWrite() ? btn('New conversation', 'new', 'primary', '', 'plus') : ''])], false)], false), domView.element("div", [{
      "class": "filter-chips comm-view-tabs"
    }, {
      "aria-label": t('Communication views')
    }], [domView.join(tabs.map(([key, label]) => btn(viewLabel(label, counts[key]), 'view', view === key ? 'primary' : '', domView.attributes([{
      "data-view": key
    }, {
      "aria-pressed": view === key
    }]))), '')], false), controls.toolbar()]);
    const intro = heading;
    if (!filtered.length) return domView.concat(intro, controls.empty(view, canWrite() ? btn('New conversation', 'new', 'primary', '', 'plus') : ''));
    return domView.concat(domView.concat(intro, domView.element("div", [{
      "class": "comm-hub"
    }], [domView.element("aside", [{
      "class": "comm-topic-list"
    }], [domView.join(visible.map(c => {
      const unread = comments().filter(m => threadFor(m) === c.id && m.unread).length, actions = openItems(c.id).length, pending = threadRequests(c.id).length;
      return domView.element("button", [{
        "class": domView.text(["comm-topic ", thread === c.id ? domView.attributes([{
          "selected": domView.text([])
        }]) : ''])
      }, {
        "data-action": "comm-thread"
      }, {
        "data-thread-type": threadType(c)
      }, {
        "data-id": c.id
      }, {
        "aria-pressed": thread === c.id
      }], [domView.element("span", [{
        "class": "comm-topic-title"
      }], [domView.element("strong", [], [threadTitle(c.id) || c.body.slice(0, 90)], false), completed(c) ? icon('check') : ''], false), domView.element("p", [{
        "class": "comm-topic-preview"
      }], [c.body], false), domView.element("span", [{
        "class": "comm-topic-meta"
      }], [domView.fragment([typeLabel(threadType(c)), " · ", c.audience === 'studio' ? t('Studio only') : t('Shared'), " · V", c.iteration_number || 1])], false), domView.element("span", [], [domView.join([unread ? domView.concat(domView.concat(unread, ' '), t('unread')) : '', actions ? normalizeThreadType(topic(c)?.type) === 'conversation' ? t(topic(c)?.assignee ? 'Waiting for reply' : 'Needs resolution') : domView.concat(domView.concat(actions, ' '), t('open actions')) : '', pending ? domView.concat(domView.concat(pending, ' '), t('awaiting approval')) : '', completed(c) ? statusLabel(c) : ''].filter(Boolean), ' · ')], false)], false);
    }), '') || domView.element("p", [{
      "class": "comm-empty"
    }], [t('No conversations match this view.')], false)], false), domView.element("section", [{
      "class": "comm-thread"
    }], [selected ? domView.fragment([domView.element("header", [{
      "class": "comm-thread-head"
    }], [domView.fragment([threadDetails(selected), origin(selected)])], false), domView.fragment([canWrite() ? domView.element("form", [{
      "id": "comm-reply-form"
    }, {
      "class": "comm-composer"
    }], [domView.fragment([replyTo ? domView.element("div", [{
      "class": "comm-replying"
    }], [domView.fragment([t('Replying to a confirmation request'), btn('Cancel', 'cancel-reply', 'small ghost')])], false) : '', plainMessageFields({
      body: drafts.get(domView.concat(scope, thread)) || '',
      id: 'comm-reply',
      compact: true,
      attachments: attachFields()
    })]), domView.element("div", [{
      "class": "comm-compose-actions"
    }], [domView.element("small", [], [audienceLabel()], false), domView.element("button", [{
      "class": "button primary"
    }, {
      "type": "submit"
    }], [composerText('Send message')], false)], false), domView.element("p", [{
      "class": "form-error"
    }, {
      "data-comm-error": domView.text([])
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false)], false) : domView.element("p", [{
      "class": "notice"
    }], [t('Read-only project access')], false), guestList(), work.length ? domView.element("div", [{
      "class": "comm-work-list"
    }], [domView.join(work.map(itemCard), '')], false) : '']), domView.element("div", [{
      "class": "comm-messages"
    }], [domView.join(entries.map(message), '')], false)]) : domView.element("div", [{
      "class": "comm-empty"
    }], [domView.element("h2", [], [t('Keep the whole subject together.')], false), domView.element("p", [], [t('Start a conversation to discuss a question, track actions, or request approval.')], false)], false)], false)], false)), controls.pagination(server ? data().total : filtered.length));
  }
  function guestList() {
    if (state.client || state.present || !canWrite()) return '';
    const guests = (data().guests || []).filter(g => g.root_id === thread && !Number(g.revoked) && g.expires_at > Date.now() / 1000);
    return guests.length ? domView.element("div", [{
      "class": "comm-guests"
    }], [domView.fragment([t('Conversation guests'), domView.join(guests.map(g => domView.element("div", [{
      "class": "row between"
    }], [domView.element("span", [], [g.name], false), btn('Remove access', 'revoke', 'small ghost', domView.attributes([{
      "data-id": g.id
    }]))], false)), '')])], false) : '';
  }
  function newConversation(slide = '', annotation = null, related = '', type = 'conversation', text = '', checklist = null) {
    replyTo = null;
    const pinImage = annotation ? document.querySelector('.annotation-host img')?.src : '';
    const fresh = !related, iid = fresh ? state.data.iteration.id : contextIteration(), people = (fresh ? data()?.recipients || [] : recipients()).filter(p => fresh || !privateThread() || p.group === 'team');
    openModal(t(related ? 'New linked thread' : 'New conversation'), domView.element("form", [{
      "id": "comm-thread-form"
    }, {
      "data-iteration": iid
    }], [domView.fragment([related ? domView.fragment([domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "related_thread_id"
    }, {
      "value": related
    }], [], false), domView.element("p", [{
      "class": "notice"
    }], [domView.fragment([t('Linked to'), ": ", threadTitle(related) || root()?.body.slice(0, 90), ". ", t('This starts a separate conversation. Its approval and completion are tracked independently.')])], false)]) : '', checklist ? domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "checklist_id"
    }, {
      "value": checklist.id
    }], [], false) : '', pinImage ? domView.element("div", [{
      "class": "comm-pin-preview"
    }], [domView.element("img", [{
      "src": pinImage
    }, {
      "alt": t('Open original slide')
    }], [], false), domView.element("span", [{
      "style": domView.text(["left:", Number(annotation.x) * 100, "%;top:", Number(annotation.y) * 100, "%"])
    }], [], false)], false) : '', composerFields({
      people,
      actor: actor(),
      locked: !!Number(fresh ? state.data.iteration.locked : contextInfo().locked),
      type,
      body: text,
      details: domView.fragment([domView.element("label", [], [t('Subject'), domView.element("input", [{
        "name": "thread_title"
      }, {
        "maxlength": "160"
      }, {
        "required": domView.text([])
      }], [], false)], false), audienceSwitch(related ? privateThread() ? 'studio' : 'shared' : state.client || state.present || slide ? 'shared' : 'studio', !!related || !!state.client || !!state.present)]),
      attachments: attachFields(fresh)
    }), slide ? domView.fragment([domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "annotation"
    }, {
      "value": JSON.stringify(annotation)
    }], [], false), slidePicker(iid, slide, false, true)]) : slidePicker(iid, related ? root()?.slide : '')]), domView.element("p", [{
      "class": "form-error"
    }, {
      "data-comm-error": domView.text([])
    }, {
      "role": "alert"
    }, {
      "hidden": domView.text([])
    }], [], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button(t('Cancel'), 'close-modal', 'ghost'), domView.element("button", [{
      "type": "submit"
    }, {
      "class": "button primary"
    }], [t('Start conversation')], false)], false)], false));
    initComposers(document.querySelector('.modal'));
  }
  function popup(text = '', checklist = null) {
    newConversation('', null, thread, 'approval', text, checklist);
  }
  async function show() {
    try {
      if (state.capabilities?.platform && !state.client && !state.data?.communication?.server_filtered) await reloadList();
      closeModal();
      if (state.client || state.present) {
        state.communicationOpen = true;
        render();
      } else {
        state.present = false;
        state.tab = 'comments';
        render();
      }
    } catch (error) {
      toast(error.message);
    }
  }
  async function open(id) {
    const c = comments().find(c => c.id === id);
    if (!c) throw new Error('This conversation is no longer available.');
    ensureScope();
    thread = threadFor(c);
    view = 'all';
    controls.reset();
    revealThread = true;
    highlight = id;
    await show();
  }
  function budgetSource(item) {
    const r = item.confirmation;
    if (!r) return false;
    openModal(t('View confirmation'), domView.fragment([domView.element("p", [], [mentionBody(r.body, comments().find(c => c.id === r.comment_id)?.mentions)], false), domView.element("div", [{
      "class": "comm-budget-change"
    }], [domView.element("strong", [], [signed(r.amount_cents)], false), domView.fragment([" ", t('including VAT')])], false), domView.element("p", [], [domView.fragment([t('Requested by'), " ", name(r.author)])], false), domView.element("p", [], [domView.fragment([t('Confirmed by'), " ", r.recipient_name, " · ", time(r.decided_at)])], false), r.iteration_id === state.data.iteration.id ? btn('Open conversation', 'open', 'primary', domView.attributes([{
      "data-id": r.comment_id
    }])) : !state.client && !state.present ? btn('Open conversation', 'location', 'primary', domView.attributes([{
      "data-id": r.comment_id
    }, {
      "data-project": state.data.project.id
    }, {
      "data-iteration": r.iteration_id
    }])) : '']));
    return true;
  }
  function afterRender() {
    if (!enabled()) return;
    initComposers();
    const list = document.querySelector('.comm-topic-list'), selected = list?.querySelector('.selected');
    if (list && selected && list.scrollWidth > list.clientWidth) {
      const a = list.getBoundingClientRect(), b = selected.getBoundingClientRect();
      if (b.left < a.left || b.right > a.right) list.scrollLeft += b.left - a.left - (a.width - b.width) / 2;
    }
    const nav = document.querySelector('.tabs'), active = nav?.querySelector('.tab.active');
    if (active) {
      const n = nav.getBoundingClientRect(), a = active.getBoundingClientRect();
      if (a.left < n.left || a.right > n.right) nav.scrollLeft += a.left - n.left - 16;
    }
    for (const row of (state.data.budget || []).filter(b => b.confirmation)) {
      const el = document.querySelector(domView.text(["[data-budget-row=\"", CSS.escape(row.id), "\"]"]));
      if (el && !el.querySelector('.comm-budget-source')) domView.insert(el, 'beforeend', domView.element("div", [{
        "class": "comm-budget-source"
      }], [domView.fragment([icon('check'), t('Confirmed by'), " ", row.confirmation.recipient_name, " ", btn('View confirmation', 'budget-source', 'small ghost', domView.attributes([{
        "data-id": row.id
      }]))])], false));
    }
    if (highlight) document.querySelector(domView.text(["[data-confirmation=\"", CSS.escape(highlight), "\"]"]))?.scrollIntoView({
      block: 'nearest'
    });
    if (state.tab === 'comments' && !state.present || state.communicationOpen) {
      const visible = comments().filter(inThread);
      markCommentsRead(visible).catch(() => {});
    }
  }
  function overview() {
    return enabled() ? domView.element("div", [{
      "class": "comm-overview-note"
    }], [domView.element("div", [], [icon('chat'), domView.element("span", [], [domView.element("strong", [], [t('Communication')], false), domView.element("small", [], [domView.fragment([pendingCount(), " ", t('pending'), " · ", t('Slide comments included')])], false)], false)], false), btn('View pending confirmations', 'pending', domView.concat('small', pendingCount() ? ' has-pending-confirmations' : ''))], false) : '';
  }
  function clientPage() {
    return domView.element("main", [{
      "class": "main-content comm-client-page"
    }], [domView.element("div", [{
      "class": "section-title"
    }], [domView.element("h1", [], [state.data.project.name], false), btn('Back to presentation', 'back', '', '', 'arrow')], false), page()], false);
  }
  async function dispatchCommunicationAction(e) {
    const el = e.target.closest('[data-action]');
    if (!el?.dataset.action.startsWith('comm-') || !enabled() && el.dataset.action !== 'comm-location') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const action = el.dataset.action.slice(5), id = el.dataset.id;
    if (busy) return;
    try {
      if (action === 'location') {
        const project = el.dataset.project;
        if (project && (!state.data || project !== state.data.project.id || el.dataset.iteration !== state.data.iteration.id)) {
          closeModal();
          await openProject(project, el.dataset.iteration);
        }
        await open(id);
      }
      if (action === 'new') newConversation();
      if (action === 'linked') newConversation('', null, thread);
      if (action === 'edit-thread') editThread();
      if (action === 'link-slide') linkSlide();
      if (action === 'show') show();
      if (action === 'back') {
        state.communicationOpen = false;
        render();
      }
      if (action === 'pending') {
        view = 'open';
        controls.reset();
        controls.selectTypes(['approval']);
        await reloadList();
        show();
      }
      if (action === 'view') {
        view = el.dataset.view;
        controls.firstPage();
        await reloadList();
      }
      if (action === 'thread') {
        ensureScope();
        if (!comments().some(c=>c.id===id)) throw new Error('This conversation is no longer available.');
        thread = id;
        replyTo = null;
        highlight = null;
        render();
      }
      if (action === 'ask') popup(drafts.get(domView.concat(scope, thread)) || '');
      if (action === 'ask-existing') popup(comments().find(c => c.id === id)?.body || '');
      if (action === 'open') await open(id);
      if (action === 'reply') {
        await open(id);
        replyTo = id;
        render();
        $('#comm-reply')?.focus();
      }
      if (action === 'cancel-reply') {
        replyTo = null;
        render();
      }
      if (action === 'source') {
        if (el.dataset.iteration !== state.data.iteration.id) await openProject(state.data.project.id, el.dataset.iteration);
        state.communicationOpen = false;
        await startPresentation(0, {
          editorSlide: el.dataset.slide
        });
      }
      if (action === 'revoke') {
        openModal(t('Remove conversation access?'), domView.fragment([domView.element("p", [], [t('This person will no longer be able to read or reply to this conversation or download its attachments.')], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button(t('Cancel'), 'close-modal', 'ghost'), btn('Remove access', 'do-revoke', 'primary', domView.attributes([{
          "data-id": id
        }]))])], false)]));
      }
      if (action === 'do-revoke') {
        busy = true;
        await api('conversation_revoke', {
          id
        });
        closeModal();
        await refresh(true);
        toast(t('Access removed.'));
      }
      if (action === 'withdraw') {
        const r = requests().find(r => r.comment_id === id);
        openModal(t('Withdraw this request?'), domView.fragment([domView.element("p", [], [mentionBody(r.body, comments().find(c => c.id === r.comment_id)?.mentions)], false), domView.element("p", [], [t('It will remain in the conversation as withdrawn. The budget will not change.')], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button(t('Cancel'), 'close-modal', 'ghost'), btn('Withdraw', 'do-withdraw', 'primary', domView.attributes([{
          "data-id": id
        }]))])], false)]));
      }
      if (action === 'share') {
        openModal(t('Share conversation'), domView.fragment([domView.element("p", [], [t('Clients with access to the original iteration will be able to read all earlier messages and attachments. Studio-only action details stay private until you share those items.')], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button(t('Cancel'), 'close-modal', 'ghost'), btn('Share conversation', 'do-share', 'primary')])], false)]));
      }
      if (action === 'do-share') {
        await api('communication_share', {
          iteration: contextIteration(),
          id: thread,
          share_history: true
        });
        closeModal();
        await refresh(true);
      }
      if (action === 'work') {
        busy = true;
        el.disabled = true;
        await api('communication_work_decide', {
          iteration: contextIteration(),
          id,
          resolved: el.dataset.resolved === 'true'
        });
        await refresh(true);
      }
      if (action === 'answered') {
        busy = true;
        el.disabled = true;
        await api('comment_answered', {
          iteration: contextIteration(),
          id: thread,
          answered: !Number(root().answered)
        });
        await refresh(true);
      }
      if (action === 'confirm' || action === 'do-withdraw') {
        busy = true;
        el.disabled = true;
        await api('confirmation_decide', {
          iteration: requests().find(r => r.comment_id === id)?.iteration_id || contextIteration(),
          id,
          decision: action === 'confirm' ? 'confirmed' : 'withdrawn'
        });
        closeModal();
        await refresh(true);
        toast(t(action === 'confirm' ? 'Confirmation recorded.' : 'Request withdrawn.'));
      }
      if (action === 'budget-source') budgetSource(state.data.budget.find(b => b.id === id));
      if (action === 'budget') {
        const r = requests().find(r => r.comment_id === id);
        if (r && r.iteration_id !== state.data.iteration.id) await openProject(state.data.project.id, r.iteration_id);
        if (!await loadBudget()) return;
        const row = state.data.budget.find(b => b.confirmation?.comment_id === id);
        if (state.client || state.present) {
          if (row) budgetSource(row);
        } else {
          state.tab = 'budget';
          render();
        }
      }
      if (action === 'evidence') {
        if (el.dataset.iteration !== state.data.iteration.id) await openProject(state.data.project.id, el.dataset.iteration);
        await openFile(Number(el.dataset.page)?'legal-citation':'download',{id,version:id,page:el.dataset.page});
      }
      if (action === 'download') {
        if (el.dataset.iteration && el.dataset.iteration !== state.data.iteration.id) await openProject(state.data.project.id, el.dataset.iteration);
        await openFile('download',{id});
      }
    } catch (err) {
      toast(err.message);
      return false;
    } finally {
      busy = false;
      if (el.isConnected) el.disabled = false;
    }
  }
  document.addEventListener('click', dispatchCommunicationAction, true);
  document.addEventListener('input', e => {
    if (e.target.id === 'comm-reply') drafts.set(domView.concat(scope, thread), e.target.value);
  });
  document.addEventListener('change', async e => {
    const el = e.target;
    if (el.matches('[data-comm-upload]') && el.files[0]) {
      const form = el.closest('form'), status = form.querySelector('[data-comm-upload-status]'), file = el.files[0], buttons = [...form.querySelectorAll('button')];
      if (file.size > 100 * 1024 * 1024) {
        status.textContent = t('Maximum file size: 100 MB.');
        return;
      }
      buttons.forEach(b => b.disabled = true);
      form.dataset.uploading = '1';
      status.textContent = t('Uploading…');
      try {
        const body = new FormData();
        body.set('iteration', form.dataset.iteration || contextIteration());
        body.append('files[]', file);
        const result = await api('communication_upload', body), select = form.querySelector('[name=version_id]');
        select.add(new Option(domView.concat(file.name, ' · V1'), result.ids[0]));
        select.value = result.ids[0];
        status.textContent = t('Linked · processing in the background');
      } catch (err) {
        status.textContent = err.message;
      } finally {
        delete form.dataset.uploading;
        buttons.forEach(b => b.disabled = false);
      }
    }
  });
  document.addEventListener('submit', async e => {
    const form = e.target;
    if (!['comm-reply-form', 'comm-thread-form', 'comm-edit-thread-form', 'comm-slide-form'].includes(form.id)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (busy || form.dataset.uploading) return;
    busy = true;
    const buttons = [...form.querySelectorAll('button')], disabledStates = buttons.map(b => b.disabled);
    buttons.forEach(b => b.disabled = true);
    try {
      const values = Object.fromEntries(new FormData(form));
      if (form.id === 'comm-slide-form') {
        await api('communication_slide_link', {
          ...values,
          iteration: contextIteration(),
          id: thread
        });
        closeModal();
        await refresh(true);
        toast(t('Slide linked.'));
        return;
      }
      if (values.thread_type !== 'approval') delete values.checklist_id;
      const reply = replyTo && comments().find(c => c.id === replyTo), parent = form.id === 'comm-thread-form' ? '' : reply ? rootFor(reply).id : thread;
      const invite = !!(data()?.iteration_recipients?.[form.dataset.iteration] || recipients()).find(p => p.email === values.recipient)?.invitable;
      if (form.id === 'comm-edit-thread-form') {
        await api('communication_thread_update', {
          ...values,
          share_history: form.dataset.originalAudience === 'studio' && values.audience === 'shared',
          iteration: contextIteration(),
          id: thread
        });
        closeModal();
        await refresh(true);
        return;
      }
      const result = await api('communication_post', {
        ...values,
        ...values.annotation ? {
          annotation: JSON.parse(values.annotation)
        } : {},
        mentions: mentionData(form),
        invite,
        iteration: form.dataset.iteration || contextIteration(),
        parent_id: parent
      });
      if (form.id !== 'comm-thread-form') drafts.delete(domView.concat(scope, thread));
      replyTo = null;
      if (form.id !== 'comm-reply-form') closeModal();
      await refresh(true);
      if (form.id === 'comm-thread-form' || invite || mentionData(form).some(m => m.invite)) open(result.id);
      toast(t(form.id === 'comm-thread-form' ? 'Conversation started.' : form.id === 'comm-confirmation-form' ? 'Request sent.' : 'Reply posted.'));
    } catch (err) {
      const error = form.querySelector('[data-comm-error]');
      if (error) {
        error.hidden = false;
        error.textContent = err.message;
      } else toast(err.message);
    } finally {
      busy = false;
      buttons.forEach((b, index) => b.disabled = disabledStates[index]);
    }
  }, true);
  function badge(c) {
    const r = c.confirmation;
    if (!r) return '';
    return domView.element("div", [{
      "class": "comm-confirmation-bottom"
    }], [domView.element("span", [{
      "class": domView.text(["comm-status ", r.status === 'confirmed' ? 'done' : r.status === 'withdrawn' ? 'closed' : 'pending'])
    }], [domView.fragment([t(r.status === 'confirmed' ? 'Confirmed' : r.status === 'withdrawn' ? 'Withdrawn' : 'Pending confirmation'), r.amount_cents !== null ? domView.concat(' · ', signed(r.amount_cents)) : ''])], false), btn('View confirmation', 'location', 'small ghost', domView.attributes([{
      "data-id": c.id
    }, {
      "data-project": c.project_id || state.data?.project.id || ''
    }, {
      "data-iteration": c.iteration_id
    }]))], false);
  }
  setInterval(() => {
    if (state.present && state.communicationOpen && !document.hidden && !busy && !document.querySelector('.modal') && !document.activeElement?.closest('form')) refresh().catch(() => {});
  }, 15000);
  function mentionContext(form) {
    const reply = replyTo && comments().find(c => c.id === replyTo);
    return {
      iteration: form.dataset.iteration || contextIteration(),
      parent_id: form.id === 'comm-thread-form' ? '' : reply ? rootFor(reply).id : thread,
      audience: form.elements.audience?.value || 'shared'
    };
  }
  return {
    action:dispatchCommunicationAction,
    controls,
    get params() {
      return {
        filter: view,
        ...controls.params
      };
    },
    restore(params = {}) {
      state.communicationParams = params;
      view = params.filter || 'open';
      controls.restore(params);
    },
    show,
    showPending: async () => {
      ensureScope();
      view = 'open';
      controls.reset();
      controls.selectTypes(['approval']);
      await reloadList();
      show();
    },
    feedback: (slide, annotation = null) => {
      ensureScope();
      if (annotation) {
        newConversation(slide, annotation);
        return;
      }
      const c = comments().find(c => !c.parent_id && c.slide === slide && c.iteration_id === state.data.iteration.id);
      if (c) open(c.id); else newConversation(slide);
    },
    requestForChecklist: q => {
      ensureScope();
      if (q.thread_id) thread = q.thread_id;
      replyTo = null;
      popup(q.question, q);
    },
    open,
    mentionContext,
    enabled,
    page,
    afterRender,
    overview,
    clientPage,
    budgetSource,
    badge,
    typeLabel,
    statusLabel,
    viewLabel,
    t
  };
}
