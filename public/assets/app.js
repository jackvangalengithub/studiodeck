import {commentPreviewImage} from './comment-preview.js';
import {safeUrl, setDomAttribute} from './dom.js';
import * as domView from "./render.js";
import {e} from './dom.js';
import {createDataLayer, sendBatch, viewResources} from './data-layer.js';
import {platform} from './platform/client.js';
import {platformFetch, platformUrl, uploadPlatformFiles, uploadDecoration} from './platform/files.js';
import {contextActions, jsonFormBody} from './api-batch.js';
import {openItemsUi} from './open-items.js';
import {installToolbarTooltips} from './toolbar-tooltips.js';
import {presentationComments} from './presentation-view.js';
import {createCommunicationControls} from './communication-controls.js';
import {productFeedbackUi} from './product-feedback.js';
import {installIconTooltips} from './icon-tooltips.js';
import {presentationModeSwitch, scrollPresentation, mountScrollPresentation, stopScrollPresentation, scrollPosition, scrollToSlide} from './presentation-scroll.js';
import {mountErrorPage} from '../auth/error-page.js';
import {annotationUi} from './annotations.js';
import {studioSetupUi} from './studio-setup.js';
import {businessTypeField} from './studio-business.js';
import {installMentions, mentionData, mentionBody} from './mentions.js';
import {communicationUi} from './communication.js';
import {websiteUi} from './website.js';
import {createAppTourData, appTourGuide} from './app-tour.js';
import {onboardingUi} from './onboarding.js';
import {tr, translateError, languages, resolveLanguage, setLanguage, getLanguage, numberLocale, dateLocale} from './i18n.js';
import {projectAccessUi} from './project-access.js';
import {billingUi} from './billing.js';
import {openQuestions} from './open-questions.js';
import {consistencyUi} from './consistency.js';
import {installProjectMemberPopovers} from './project-member-popover.js';
import {commentThreads} from './comment-threads.js';
import {openShareDialog} from './share-dialog.js';
import {fileType, fileTypeLogo, sortDownloadFiles} from './file-types.js';
import {csvPreview} from './csv-preview.js';
import {projectClients} from './project-clients.js';
import {destinationPage, readClientRoute, clientProjectUrl} from './destinations.js';
import {projectPeople, presentationPeople} from './project-people.js';
import {uploadDialog} from './upload-dialog.js';
import {installImageUploads, imageUploadData} from './image-upload.js';
import {createSlideTypeFilter} from './slide-type-filter.js';
import {startingPack} from './starting-pack.js';
import {videoSlide, videoThumbnail, installVideoPlayers} from './video.js';
import {canMovePhoto, currentMotion, motionPhoto, videoFields, configureMedia, clearMediaCache, syncSlideMedia, stopSlideMedia, photoMotionUi} from './slide-media.js';
import {presentationSidebar, syncPresentationNavigation} from './presentation-navigation.js';
import {syncBudgetLayout, scrollToBudgetRow} from './budget-layout.js';
import {installSectionMenus} from './section-menu.js';
import {installFullPhotoContrast} from './full-photo.js';
import {budgetIsRange, budgetAmount, budgetEnabled, budgetTotal, budgetLineTotal} from './budget.js';
import {uploadSelectionError} from './upload-limits.js';
import {isPresentationFullscreen, justExitedFullscreen, syncPresentationFullscreen, exitPresentationFullscreen, togglePresentationFullscreen} from './fullscreen.js';
import {installGroupOrdering} from './group-order.js';
import {imagePresets, customImagePlaceholder} from './image-presets.js';
import {installFloorplans} from './floorplan.js';
import {installSlideOrdering} from './slide-order.js';
import {readWorkspaceRoute, workspaceUrl} from './routes.js';
import {animateSlideChange, cancelSlideMotion} from './slide-motion.js';
import {projectThemeVariables, projectThemeStyle, clearPresentationTheme, applyPresentationTheme} from './project-theme.js';
import {comparisonPosition, resetComparisonPosition, installComparisonControls, latestSlideImageJob} from './comparison.js';
import {extractionStages, processingSteps, extractionProgress} from './progress.js';
import {studioPalettes, cleanStudioTheme, applyStudioTheme, studioThemeStyle} from './studio.js';
import {demoRequest, demoFile} from './demo.js';
import {systemSlides, presentationSlides, visualSlides, visualTypes, canAiEditSlide, situations, slideSections, groupSlideOrder} from './slides.js';
installImageUploads();
installVideoPlayers();
const TOUR_MODE = new URLSearchParams(location.search).get('app-tour') === '1';
const tourData = TOUR_MODE ? createAppTourData(new URLSearchParams(location.search).get('language') === 'nl' ? 'nl' : 'en') : null;
const DEMO = window.STUDIODECK_DEMO === true || TOUR_MODE;
const $ = s => document.querySelector(s);
const esc = value => String(value ?? '');
const money = c => new Intl.NumberFormat(numberLocale(), {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: Number(c) % 100 ? 2 : 0
}).format(Number(c) / 100);
const bytes = n => n > 1024 * 1024 ? domView.concat((n / 1024 / 1024).toFixed(1), ' MB') : domView.concat(Math.max(1, Math.round(n / 1024)), ' KB');
const date = s => s ? new Intl.DateTimeFormat(dateLocale(), {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date(s)) : '';
const iterationLabel = i => domView.text(["", tr("iteration"), " ", String(i.number).padStart(2, '0'), "", i.title?.trim() ? domView.concat(' · ', i.title.trim()) : '', ""]);
const initials = s => domView.join(String(s || tr("studio_studio")).split(/[ @]+/).slice(0, 2).map(x => x[0]?.toUpperCase()), '');
const cats = {
  get moodboard() {
    return tr("moodboards");
  },
  get renders() {
    return tr("images_renders");
  },
  get drawings() {
    return tr("drawings_details");
  },
  get budget() {
    return tr("budgets_quotes");
  },
  get legal() {
    return tr("legal_scope");
  },
  get presentation() {
    return tr("design_presentations");
  },
  get other() {
    return tr("other_files");
  }
};
const icons = {
  brush: 'M14 6l4-4a2.8 2.8 0 0 1 4 4l-9 9-4-4 5-5zM8 12c-5 0-2 6-6 7 5 4 11 1 9-4',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z',
  filter: 'M3 4h18l-7 8v7l-4 2v-9z',
  camera: 'M3 6h4l2-3h6l2 3h4v15H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  cart: 'M2 3h3l3 12h11l3-9H6M8 15l-1 3h13M10 21a1 1 0 1 1-2 0 1 1 0 0 1 2 0M20 21a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
  compass: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M16 8l-2.5 5.5L8 16l2.5-5.5z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  folder: 'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  slide: 'M3 3h18v13H3zM12 16v5M7 21h10',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  left: 'M14 6l-6 6 6 6',
  right: 'M10 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  up: 'M12 19V5M5 12l7-7 7 7',
  upload: 'M12 16V3M7 8l5-5 5 5M4 16v4h16v-4',
  download: 'M12 3v13M7 11l5 5 5-5M4 17v4h16v-4',
  'eye-off': 'M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.8 5.2A11 11 0 0 1 12 5c7 0 10 7 10 7a17 17 0 0 1-4 4M6.2 6.2A19 19 0 0 0 2 12s3 7 10 7a11 11 0 0 0 5.8-1.8',
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  check: 'M5 12l4 4L19 6',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M12 6v6l4 2',
  chat: 'M21 11a8 8 0 0 1-8 8H6l-4 3V9a8 8 0 0 1 8-8h3a8 8 0 0 1 8 8z',
  spark: 'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3zM20 1v4M18 3h4',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0zM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  pushpin: 'M16 9V3H8v6l-2 3v2h12v-2zM12 14v8M7 3h10',
  mail: 'M3 4h18v16H3zM3 5l9 8 9-8',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  close: 'M6 6l12 12M6 18L18 6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  play: 'M8 5l11 7-11 7z',
  history: 'M3 11a9 9 0 1 1 2 7M3 3v8h8M12 7v5l4 2',
  image: 'M3 3h18v18H3zM3 17l6-6 4 4 3-3 5 5M9 7h.01',
  budget: 'M3 4h18v16H3zM3 9h18M8 9v11M16 13h2M16 17h2',
  settings: 'M9.93 4.79L10.26 2.15L13.74 2.15L14.07 4.79L15.64 5.44L17.74 3.81L20.19 6.26L18.56 8.36L19.21 9.93L21.85 10.26L21.85 13.74L19.21 14.07L18.56 15.64L20.19 17.74L17.74 20.19L15.64 18.56L14.07 19.21L13.74 21.85L10.26 21.85L9.93 19.21L8.36 18.56L6.26 20.19L3.81 17.74L5.44 15.64L4.79 14.07L2.15 13.74L2.15 10.26L4.79 9.93L5.44 8.36L3.81 6.26L6.26 3.81L8.36 5.44zM15.25 12a3.25 3.25 0 1 1-6.5 0 3.25 3.25 0 0 1 6.5 0z',
  help: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0M9 8a3 3 0 1 1 5 3c-2 1-2 2-2 3M12 18h.01',
  lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',
  unlock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
  copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
  edit: 'M16 3l5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z',
  warning: 'M12 3L1 21h22zM12 9v5M12 17h.01',
  phone: 'M7 3H3v4c0 8 6 14 14 14h4v-5l-5-2-2 3a14 14 0 0 1-7-7l3-2z',
  expand: 'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
  minus: 'M5 12h14',
  menu: 'M3 6h18M3 12h18M3 18h18',
  leaf: 'M20 3C5 2 2 10 6 16s15 3 14-13zM4 21l11-11',
  send: 'M22 2L9 15M22 2l-7 20-6-7-7-6z',
  logout: 'M9 3H3v18h6M9 12h12M16 7l5 5-5 5'
};
const icon = (n, cls = '') => domView.element("svg", [{
  "class": domView.text(["icon ", cls])
}, {
  "viewBox": "0 0 24 24"
}, {
  "aria-hidden": "true"
}], [domView.element("path", [{
  "d": icons[n] || icons.file
}], [], true)], true);
const button = (label, act, kind = '', extra = '', ico = '') => domView.element("button", [{
  "type": "button"
}, {
  "class": domView.text(["button ", kind])
}, {
  "data-action": act
}, domView.spread(extra)], [domView.fragment([ico ? icon(ico) : '', label])], false);
const iconBtn = (n, act, title, extra = '') => domView.element("button", [{
  "type": "button"
}, {
  "class": "icon-button"
}, {
  "data-action": act
}, {
  "aria-label": title
}, {
  "title": title
}, domView.spread(extra)], [icon(n)], false);
const quickIcon = (name, action, label, extra = '', className = '') => domView.element("span", [{
  "class": domView.text(["quick-action ", className])
}], [domView.element("button", [{
  "type": "button"
}, {
  "class": "icon-button"
}, {
  "data-action": action
}, {
  "aria-label": label
}, domView.spread(extra)], [icon(name)], false), domView.element("span", [{
  "class": "quick-tooltip"
}, {
  "role": "tooltip"
}], [label], false)], false);
const peopleUi = projectPeople({
  getData: () => state.data,
  api,
  openModal,
  closeModal,
  button,
  formFooter,
  esc,
  personAvatar,
  refresh,
  toast,
  addTeam: () => projectTeamModal()
});
const defaultBrand = () => domView.element("span", [{
  "class": "brand"
}], ["studio", domView.element("span", [], ["deck"], false), domView.element("i", [], ["®"], false)], false);
const brand = () => state.present || state.client ? state.data?.branding?.logo ? domView.element("img", [{
  "class": "studio-logo presentation-logo"
}, {
  "src": state.data.branding.logo
}, {
  "alt": domView.text([state.data.branding.name, " logo"])
}], [], false) : defaultBrand() : !state.present && !state.client && state.studio?.has_logo ? domView.element("img", [{
  "class": "studio-logo"
}, {
  "src": studioLogoUrl()
}, {
  "alt": domView.text([state.studio.name, " logo"])
}], [], false) : domView.element("span", [{
  "class": "brand"
}], ["studio", domView.element("span", [], ["deck"], false), domView.element("i", [], ["®"], false)], false);
const state = {
  user: null,
  csrf: null,
  data: null,
  projects: [],
  tab: 'overview',
  present: false,
  hiddenPreview: '',
  presentationMode: 'slides',
  client: false,
  shareToken: '',
  slide: 0,
  imageIndex: 0,
  fileCategories: null,
  search: '',
  openCosts: new Set(),
  zoom: 1,
  poll: null,
  chat: [],
  busy: false
};
const projectData = createDataLayer({
  context: () => ({
    userId: state.user?.id,
    studioId: state.studio?.id,
    csrf: state.csrf
  }),
  transport: args => platform.resources(args)
});
const useProjectData = () => !DEMO && !TOUR_MODE && !state.client && !!state.user?.id && !!state.studio?.id && state.capabilities?.batch_reads === true;
let projectLoadSequence = 0;
const projectView = () => state.present ? 'presentation' : viewResources[state.tab] ? state.tab : 'overview';
const withAppContext = data => ({
  ...data,
  capabilities: state.capabilities,
  profile: state.profile || state.user?.profile
});
async function readProjectView(projectId, iterationId, view) {
  if (!useProjectData()) return api('project', {
    id: projectId,
    iteration: iterationId
  });
  try {
    const data = withAppContext(await projectData.loadProjectView({
      projectId,
      iterationId,
      view,
      fileSearch: state.search,
      fileCategories: state.fileCategories ? [...state.fileCategories] : null,
      communication: communication.params
    }));
    return data;
  } catch (error) {
    if ([401, 403, 404].includes(error.status)) {
      projectData.invalidate({
        projectId
      });
      if (state.data?.project.id === projectId) {
        state.data = null;
        routeError(error);
      }
    }
    throw error;
  }
}
async function selectProjectTab(view) {
  if (!state.data) return;
  if (view !== 'files') clearTimeout(fileSearchTimer);
  const projectId = state.data.project.id, iterationId = state.data.iteration.id, request = ++projectLoadSequence;
  if (!useProjectData()) {
    state.tab = view;
    state.present = false;
    if (view === 'comments') await loadFeed();
    if (view === 'overview') await refresh(true);
    render();
    return;
  }
  try {
    const filters = view === 'comments' ? JSON.stringify(communication.params) : null;
    const data = await readProjectView(projectId, iterationId, view);
    if (filters !== null && filters !== JSON.stringify(communication.params)) return;
    if (request !== projectLoadSequence || state.data?.project.id !== projectId || state.data?.iteration.id !== iterationId) return;
    state.data = data;
    state.tab = view;
    state.present = false;
    state.projectLoading = false;
    state.projectLoadError = null;
    render();
    pollJobs();
  } catch (error) {
    if (request !== projectLoadSequence || error.superseded) return;
    console.error('Project view failed', error);
    if ([401, 403, 404].includes(error.status)) {
      projectData.invalidate({
        projectId
      });
      state.data = null;
      routeError(error);
      return;
    }
    toast(error.message);
  }
}
async function refreshCommunicationGrid() {
  const focused = document.activeElement?.dataset.commSearch === 'project', start = focused ? document.activeElement.selectionStart : null, end = focused ? document.activeElement.selectionEnd : null;
  state.communicationParams = communication.params;
  syncWorkspaceUrl(true);
  if (state.present) {
    const request = ++projectLoadSequence, projectId = state.data.project.id, iteration = state.data.iteration.id, signature = JSON.stringify(communication.params);
    const result = await api('comments_feed', {
      project_id: projectId,
      iteration,
      ...communication.params
    });
    if (request !== projectLoadSequence || !state.present || state.data?.project.id !== projectId || signature !== JSON.stringify(communication.params)) return;
    const previous = state.data.communication;
    state.data.comments = result.comments;
    state.data.communication = {
      ...previous,
      ...result.communication,
      recipients: previous?.recipients || [],
      iteration_files: previous?.iteration_files || ({}),
      iteration_slides: previous?.iteration_slides || ({})
    };
    render();
  } else await selectProjectTab('comments');
  if (focused && document.activeElement === document.body) {
    const input = $('[data-comm-search="project"]');
    input?.focus({
      preventScroll: true
    });
    input?.setSelectionRange(start, end);
  }
}
function projectViewNotice() {
  if (!useProjectData()) return '';
  if (state.projectLoadError && state.data?._loadedView !== projectView()) return domView.element("p", [{
    "class": "notice"
  }, {
    "role": "alert"
  }], [domView.fragment([state.projectLoadError, " ", button(tr('studio_retry'), 'retry-project-view', 'small')])], false);
  if (state.projectLoading && state.data?._loadedView !== projectView()) return domView.element("p", [{
    "class": "notice"
  }, {
    "role": "status"
  }], [tr('studio_loading_view')], false);
  return '';
}
async function ensureProjectResource(view) {
  if (!useProjectData()) return true;
  const projectId = state.data?.project.id, iterationId = state.data?.iteration.id, request = projectLoadSequence;
  if (!projectId) return false;
  const data = await readProjectView(projectId, iterationId, view);
  if (request !== projectLoadSequence || state.data?.project.id !== projectId || state.data?.iteration.id !== iterationId) return false;
  state.data = {
    ...state.data,
    ...data,
    _loadedView: state.data._loadedView
  };
  return true;
}
async function shareProject() {
  if (!await ensureProjectResource('people')) return;
  openShareDialog({
    state,
    pending,
    toast,
    openModal,
    button,
    projectClientUi,
    esc,
    iterationLabel,
    formFooter
  });
}
const commentView = {
  sort: 'newest',
  showAnswered: false
};
let communicationFilter = 'open', feedRequest = 0;
const commentReplyDrafts = new Map();
const imageCache = new Map();
let activeModal = null, previousFocus = null;
let clientPresentationHelpShown = false, clientPresentationHelpCleanup = null;
installProjectMemberPopovers({
  getMembers: id => state.projects.find(p => p.id === id)?.members || [],
  esc,
  personAvatar
});
const projectClientUi = projectClients({
  getData: () => state.data,
  api,
  openModal,
  button,
  formFooter,
  esc,
  refresh,
  toast
});
const accountActions = new Set(['session', 'destinations', 'client_project', 'logout']);
const getActions = new Set(['product_feedback_inbox', 'attention', 'mention_people', 'project_testimonials', 'website', 'website_sources', 'project_access', 'billing', 'billing_invoices', 'destinations', 'client_project', 'drive_status', 'drive_list', 'studio_starting_pack', 'project_starting_pack', 'session', 'projects', 'project', 'deck', 'document_page', 'file', 'studio_users', 'comments_feed', 'resolve_slide', 'profile']);
async function api(action, body = {}) {
  if (action === 'session' && useProjectData()) return projectData.loadAppContext();
  if (TOUR_MODE) return tourData.request(action, body);
  if (DEMO && action === 'drive_status') return {
    configured: false,
    connected: false,
    email: ''
  };
  if (DEMO) return demoRequest(action, body);
  let result;
  try {
    if (body instanceof FormData && ['upload', 'communication_upload'].includes(action)) result = await uploadPlatformFiles(platform, body); else if (body instanceof FormData && ['upload_avatar', 'upload_studio_logo', 'upload_project_logo'].includes(action)) result = await uploadDecoration(platform, action, body); else {
      body = jsonFormBody(action, body);
      if (body instanceof FormData) {
        if ([...body.values()].some(v => v instanceof Blob && v.size)) throw Error('Uploading files through this form needs platform integration.');
        body = Object.fromEntries([...body].filter(([, v]) => !(v instanceof Blob)));
      }
      result = await platform.request(action, body);
    }
  } catch (error) {
    if (!getActions.has(action)) projectData.invalidate();
    throw error;
  }
  if (!getActions.has(action)) {
    projectData.invalidate();
    if (result?.notice) toast(result.notice);
  }
  if (contextActions.has(action)) projectData.reset();
  return result;
}
function toast(message, {action, label = tr('studio_undo')} = {}) {
  const el = $('#toast');
  clearTimeout(toast.timer);
  el.replaceChildren();
  el.inert = false;
  el.classList.add('show');
  el.classList.toggle('has-action', !!action);
  const hide = () => {
    el.classList.remove('show');
    el.inert = true;
  };
  const text = document.createElement('span');
  text.textContent = message;
  el.append(text);
  if (!action) {
    toast.timer = setTimeout(hide, 6500);
    return;
  }
  const undo = document.createElement('button');
  undo.type = 'button';
  undo.className = 'toast-action';
  undo.textContent = label;
  el.append(undo);
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'toast-dismiss';
  dismiss.setAttribute('aria-label', tr('dismiss'));
  domView.mount(dismiss, icon('close'));
  el.append(dismiss);
  dismiss.onclick = hide;
  undo.onclick = async () => {
    if (undo.disabled) return;
    undo.disabled = true;
    try {
      await action();
      if (el.contains(undo)) hide();
    } catch (error) {
      if (el.contains(undo)) text.textContent = error.message; else toast(error.message);
    } finally {
      undo.disabled = false;
    }
  };
}
const hideToolbarTooltip = installToolbarTooltips();
const billing = billingUi({
  state,
  api,
  esc,
  button,
  openModal,
  closeModal,
  render,
  applySession,
  resetStudio,
  toast,
  isModalOpen: () => !!activeModal,
  resourceHeaders,
  resumeAccess: () => projectAccess.resume(),
  hasIntent: () => projectAccess.hasIntent(),
  purchaseStarted: data => projectAccess.purchaseStarted(data),
  createProject: intent => newProjectModal('', intent)
});
const projectAccess = projectAccessUi({
  state,
  api,
  esc,
  button,
  openModal,
  closeModal,
  toast,
  billing,
  openProject: async (pid, options = {}) => {
    state.tab = options.tab || 'overview';
    await loadProjects();
    await openProject(pid, options.iteration, options.preview, true);
    if (options.slide) {
      state.inspectHidden = false;
      const n = slideDefs().findIndex(s => s.id === options.slide || s.record?.id === options.slide);
      if (n >= 0) {
        state.slide = n;
        state.present = true;
        render();
      }
    }
  },
  newProject: newProjectModal,
  back: async () => {
    state.data = null;
    state.present = false;
    state.tab = 'projects';
    await loadProjects();
    render();
  }
});
const productFeedback = productFeedbackUi({
  state,
  api,
  esc,
  icon,
  openModal,
  closeModal,
  resourceHeaders,
  demo: DEMO
});
const studioSetup = studioSetupUi({
  state,
  esc,
  brand: defaultBrand,
  api,
  applySession,
  render
});
const onboarding = onboardingUi({
  state,
  esc,
  icon,
  button,
  openModal,
  closeModal,
  render,
  onError: toast,
  startProject: beginNewProject,
  upload: chooseFiles,
  preview: startPresentation,
  share: shareProject
});
const communication = communicationUi({
  state,
  onFilterChange: refreshCommunicationGrid,
  loadBudget: () => ensureProjectResource('budget'),
  api,
  render,
  refresh,
  openModal,
  closeModal,
  toast,
  button,
  icon,
  esc,
  personAvatar,
  slideDefs,
  startPresentation,
  markCommentsRead,
  openProject: (pid, iid) => state.client ? openClientProject(pid, iid) : openProject(pid, iid)
});
installMentions({
  actor: () => state.data?.communication?.actor || state.user?.email,
  load: async context => {
    const people = await api('mention_people', context);
    return state.present ? people.filter(p => !p.invitable && p.available !== false) : people;
  },
  context: form => {
    if (DEMO || !form) return null;
    if ((form.getAttribute('id') || '').startsWith('comm-')) return communication.mentionContext(form);
    if (['feedback', 'comment-reply'].includes(form.dataset.form)) return {
      iteration: form.elements.iteration?.value || form.dataset.iteration || state.data?.iteration.id,
      parent_id: form.elements.parent_id?.value || ''
    };
    return null;
  }
});
const website = websiteUi({
  state,
  api,
  esc,
  button,
  openModal,
  closeModal,
  render,
  toast,
  resourceHeaders
});
const pack = startingPack({
  api,
  state,
  esc,
  button,
  openModal,
  closeModal,
  refresh,
  toast
});
const uploader = uploadDialog({
  api,
  state,
  esc,
  button,
  icon,
  openModal,
  closeModal,
  toast,
  onCancel: () => projectWizardFiles(),
  onComputer: async (files, options) => {
    if (options.chooseOnly) {
      addWizardFiles(files);
      return;
    }
    closeModal(true);
    await uploadFiles(files, options.asset, options.category);
  },
  onDrive: async (selection, options) => {
    if (options.chooseOnly) {
      newProjectWizard.driveSelection = selection;
      newProjectWizard.files = [];
      projectWizardFiles();
      return;
    }
    closeModal(true);
    await uploadDriveFiles(selection, options.asset, options.category);
  }
});
const annotations = annotationUi({
  state,
  esc,
  button,
  context: annotationContext,
  openFeedback: (annotation, id) => {
    if (communication.enabled()) {
      if (id) communication.open(id); else communication.feedback(annotation?.slide || slideDefs()[state.slide]?.id || 'general', annotation);
      return;
    }
    if (id) commentView.showAnswered = true;
    feedbackModal(annotation);
    if (id) revealComment(id);
  }
});
function annotationContext(def = state.present ? slideDefs()[state.slide] : null) {
  if (typeof def === 'string') def = slideDefs().find(slide => slide.id === def);
  if (DEMO || !state.present || !def?.record?.source_version_id || !def.visual || def.record.legacy || !['floorplan', 'moodboard', 'fullphoto'].includes(def.type) && comparingImage(def)) return null;
  const r = def.record;
  return {
    slide: def.id,
    source_version_id: r.source_version_id,
    page_number: Number(r.page_number),
    image_number: Number(r.image_number),
    image_version_id: showOriginalSlides.has(r.id) ? '' : selectedImageVersion(def)
  };
}
const openItems = openItemsUi({
  state,
  esc,
  icon,
  render
});
const questionUi = openQuestions({
  state,
  esc,
  button,
  openModal,
  closeModal,
  formFooter,
  api,
  refresh,
  toast,
  editable: () => editable(),
  requestApproval: q => communication.requestForChecklist(q),
  openConversation: id => communication.open(id)
});
const checksUi = consistencyUi({
  state,
  esc,
  button,
  openModal,
  closeModal,
  api,
  refresh,
  toast,
  editable: () => editable(),
  resourceHeaders,
  discuss: id => questionUi.discuss(id)
});
const motionUi = photoMotionUi({
  state,
  openModal,
  closeModal,
  api,
  refresh,
  toast,
  hydrateImages,
  resourceHeaders,
  editable: () => editable(),
  imageMarkup: s => img({
    id: s.source_version_id,
    slide_id: s.id,
    slide_image_version: s.image_version_id || '',
    page_number: s.page_number,
    image_number: s.image_number
  }, s.title)
});
function syncCurrentMedia() {
  if (!state.present) {
    stopSlideMedia();
    return;
  }
  const defs = slideDefs(), def = defs[state.slide];
  if (!def) return;
  configureMedia(domView.concat(domView.concat(domView.concat(state.client ? 'client:' : 'studio:', state.clientShareId || state.shareToken || state.studio?.id || ''), ':'), state.data.iteration.id), resourceHeaders);
  const following = defs[domView.concat(state.slide, 1)], m = following?.type === 'video' ? following.record?.metadata?.video : currentMotion(following?.record || ({})), next = m?.media_id ? {
    slide: following.record.id,
    id: m.media_id
  } : null;
  const root = state.presentationMode === 'scroll' ? document.getElementById(domView.concat('scroll-slide-', def.id)) : document.querySelector('.presentation .slide-area');
  syncSlideMedia({
    root,
    iteration: state.data.iteration.id,
    slide: def.id,
    next
  });
}
const pending = () => state.data?.jobs?.some(j => ['queued', 'running'].includes(j.status));
const editable = () => !!state.data && !state.client && state.data.can_edit !== false && !Number(state.data.iteration.locked);
function normalizedProjectTheme(value, fallback = {}) {
  const parse = v => {
    if (typeof v === 'string') try {
      return JSON.parse(v) || ({});
    } catch {
      return {};
    }
    return v || ({});
  };
  let t = parse(value);
  if (!Object.keys(t).length) t = parse(fallback);
  return {
    light_background: t.light_background || '',
    mode: t.mode || 'light',
    background: t.background || '#152235',
    style: t.style || tr("studio_your_design_direction"),
    font: t.font || 'serif',
    colors: (t.colors?.length ? t.colors : ['#e8e3d7', '#b99f7d', '#756b59', '#626f55', '#3c4134']).filter(x => (/^#[a-f0-9]{6}$/i).test(x))
  };
}
const theme = () => normalizedProjectTheme(state.data?.project.theme);
installFullPhotoContrast();
const photoFiles = (category = 'renders') => visualSlides(state.data || ({
  files: []
})).filter(s => s.type === (({
  renders: 'render',
  photos: 'photo',
  drawings: 'drawing'
})[category] || category)).map(s => s.visual);
function imageParams(f, iteration = state.data?.iteration.id, size = 'large') {
  return {
    size,
    action: f.slide_id && !f.slide_id.startsWith('legacy-') ? 'slide_image' : Number(f.page_number) > 0 ? 'document_page' : 'file',
    id: f.id,
    iteration,
    slide_id: f.slide_id,
    image_version_id: f.show_original ? '' : f.slide_image_version,
    original: f.show_original ? 1 : 0,
    page: f.page_number,
    image: f.image_number,
    preview: 1
  };
}
function imageUrl(f, iteration, size = 'large') {
  if (!f) return '';
  const resolved = !DEMO ? platform.media.url(imageParams(f, iteration, size)) : '';
  const url = resolved || !f.slide_image_version && !f.page_number && f.preview_url || imageCache.get(imageKey(f, size)) || (!f.slide_image_version && !f.page_number && f.url && f.mime?.startsWith('image/') ? f.url : '');
  return sizeImageUrl(url, size);
}
function sizeImageUrl(url, size) {
  if (!url || !(/^\/[^/]+\/userfiles\/[^/?]+(?:\?|$)/).test(url)) return url;
  const parsed = new URL(url, location.origin);
  if (size) parsed.searchParams.set('size', size); else parsed.searchParams.delete('size');
  return domView.concat(parsed.pathname, parsed.search);
}
function img(f, alt = '', extra = '', size = 'large') {
  const url = imageUrl(f, undefined, size);
  return url ? domView.element("img", [{
    "src": url
  }, {
    "alt": alt || f.name
  }, {
    "loading": url.startsWith('blob:') ? 'eager' : 'lazy'
  }, domView.spread(extra)], [], false) : domView.element("div", [{
    "class": "image-pending"
  }, {
    "data-image": imageKey(f, size)
  }, {
    "data-size": size
  }, {
    "data-version": f.id
  }, {
    "data-slide": f.slide_id || ''
  }, {
    "data-variant": f.slide_image_version || ''
  }, {
    "data-original": f.show_original ? '1' : ''
  }, {
    "data-page": f.page_number || ''
  }, {
    "data-crop": f.image_number || ''
  }, {
    "data-alt": alt || f.name
  }, domView.spread(extra)], [icon('image')], false);
}
const hydratingImages = new Set();
let scrollImageObserver;
async function hydrateImages(nearby = false) {
  if (DEMO) return;
  const d = state.data;
  if (!d) return;
  if (!nearby) {
    scrollImageObserver?.disconnect();
    scrollImageObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.dataset.imageReady = '1';
        scrollImageObserver.unobserve(entry.target);
      }
      hydrateImages(true);
    }, {
      rootMargin: '800px'
    });
  }
  await Promise.all([...document.querySelectorAll('[data-image]')].map(async placeholder => {
    if (!placeholder.isConnected) return;
    if (placeholder.closest('.presentation-scroll') && !placeholder.dataset.imageReady) {
      if (!nearby) scrollImageObserver.observe(placeholder);
      return;
    }
    const key = placeholder.dataset.image;
    if (hydratingImages.has(key)) return;
    const p = new URLSearchParams({
      action: placeholder.dataset.slide && !placeholder.dataset.slide.startsWith('legacy-') ? 'slide_image' : placeholder.dataset.page ? 'document_page' : 'file',
      id: placeholder.dataset.version,
      iteration: d.iteration.id,
      preview: 1
    });
    if (placeholder.dataset.size) p.set('size', placeholder.dataset.size);
    if (state.capabilities?.platform) p.set('cached_only', '1');
    if (placeholder.dataset.slide) p.set('slide_id', placeholder.dataset.slide);
    if (placeholder.dataset.original === '1') p.set('original', '1'); else if (placeholder.dataset.variant) p.set('image_version_id', placeholder.dataset.variant);
    if (placeholder.dataset.page) p.set('page', placeholder.dataset.page);
    if (placeholder.dataset.crop) p.set('image', placeholder.dataset.crop);
    hydratingImages.add(key);
    try {
      let url = imageCache.get(key);
      if (!url) {
        const r = await platformFetch(p, {
          credentials: 'same-origin',
          headers: resourceHeaders()
        });
        if (!r.ok) return;
        url = URL.createObjectURL(await r.blob());
        const decoded = new Image();
        decoded.src = safeUrl(url, 'src');
        await decoded.decode();
        imageCache.set(key, url);
      }
      document.querySelectorAll(domView.text(["[data-image=\"", CSS.escape(key), "\"]"])).forEach(el => {
        const im = document.createElement('img');
        im.src = safeUrl(url, 'src');
        im.alt = el.dataset.alt;
        im.loading = 'lazy';
        im.className = el.className.replace('image-pending', '');
        im.style.cssText = el.style.cssText;
        el.replaceWith(im);
      });
    } catch {} finally {
      hydratingImages.delete(key);
    }
  }));
}
function resetChangedEnhancements(previous, updated) {
  const old = new Map((previous?.slides || []).map(s => [s.id, s.image_version_id]));
  for (const slide of updated.slides || []) if (slide.image_version_id !== old.get(slide.id)) selectedEnhancements.delete(slide.id);
}
async function openProject(pid, iid = null, preview = false, bypass = false, options = {}) {
  const request = ++projectLoadSequence, studio = state.studio?.id;
  if (!DEMO && !state.capabilities?.platform && !bypass && !await projectAccess.gate(pid, 'open', {
    iteration: iid,
    preview,
    ...options
  })) return false;
  if (request !== projectLoadSequence || studio !== state.studio?.id) return false;
  if (!options.fromRoute && state.data?.project.id !== pid) {
    state.slideTypes = null;
    state.slideView = 'list';
    state.search = '';
    state.fileCategories = null;
    communication.restore({});
  }
  state.slideGroup = options.fromRoute ? state.slideGroup || '' : '';
  state.present = false;
  state.hiddenPreview = '';
  state.communicationOpen = false;
  state.inspectHidden = false;
  state.client = false;
  state.shareToken = '';
  state.clientShareId = '';
  state.accountClientProject = '';
  state.projectLoadError = null;
  const view = preview ? 'presentation' : projectView();
  const data = await readProjectView(pid, iid, view);
  if (request !== projectLoadSequence || studio !== state.studio?.id) return false;
  state.data = data;
  state.projectLoading = false;
  state.slide = 0;
  state.imageIndex = 0;
  state.chat = [];
  if (preview) await startPresentation(0, {
    loaded: true
  });
  if (!options.deferRender) {
    if (!state.present) render();
    pollJobs();
  }
  return true;
}
async function refresh(force = false) {
  if (!state.data) return;
  const request = projectLoadSequence, projectId = state.data.project.id, iterationId = state.data.iteration.id, view = projectView(), scroll = window.scrollY;
  const previous = JSON.stringify(state.data), updated = state.client ? await api('deck') : await readProjectView(projectId, iterationId, view);
  if (request !== projectLoadSequence || state.data?.project.id !== projectId || state.data?.iteration.id !== iterationId || view !== projectView()) return;
  const scanPending = [...state.data.jobs || [], ...updated.jobs || []].some(j => j.type === 'consistency' && ['queued', 'running'].includes(j.status));
  if (!force && (scanPending && document.activeElement?.closest('input,textarea,select,[contenteditable="true"]') || document.activeElement?.closest('#comm-reply-form') || document.querySelector('[data-uploading]') || budgetChoiceSaving.size || state.reordering || document.activeElement?.matches('[data-budget-range]') || document.activeElement?.closest('[data-form="inline-slide-labels"]'))) {
    if (scanPending) {
      state.data.jobs = [...(state.data.jobs || []).filter(j => j.type !== 'consistency'), ...(updated.jobs || []).filter(j => j.type === 'consistency')];
      state.data.checks = updated.checks;
      checksUi.sync();
    }
    pollJobs();
    return;
  }
  const accessExpired = !state.client && state.data.billing?.active && updated.billing && !updated.billing.active;
  resetChangedEnhancements(state.data, updated);
  if (!state.client && updated.slides?.some(s => s.metadata?.motion_candidate?.media_id && s.metadata.motion_candidate.media_id !== state.data.slides?.find(old => old.id === s.id)?.metadata?.motion_candidate?.media_id)) toast(tr('media_ready'));
  state.data = updated;
  checksUi.sync();
  updateEnhancementAllowance();
  if (JSON.stringify(updated) !== previous) {
    render();
    renderProcessing();
    if (magnifiedPhoto) renderPhotoLightbox();
  }
  window.scrollTo(0, scroll);
  pollJobs();
  if (accessExpired) {
    state.present = false;
    render();
    await projectAccess.gate(updated.project.id);
  }
}
function pollJobs() {
  clearTimeout(state.poll);
  if (state.tab === 'projects' && !state.present) {
    if (state.projects.some(p => p.processing)) state.poll = setTimeout(async () => {
      try {
        await loadProjects();
        const grid = $('#project-grid');
        if (grid) {
          domView.mount(grid, projectTiles());
          hydrateProjectCovers();
        }
      } catch (error) {
        toast(error.message);
      }
      pollJobs();
    }, 2200);
    return;
  }
  if (pending()) state.poll = setTimeout(() => (state.reordering ? Promise.resolve() : pollProjectJobs()).catch(e => {
    toast(e.message);
    pollJobs();
  }), 1800);
}
function slideDefs() {
  syncLanguage();
  const hidden = !state.client && state.hiddenPreview;
  return presentationSlides(state.data, {
    includeHidden: !!hidden
  }).filter(def => !def.hidden || def.id === hidden);
}
async function pollProjectJobs() {
  if (!useProjectData()) return refresh();
  const d = state.data, request = projectLoadSequence;
  if (!d) return;
  const result = await projectData.loadJobs({
    projectId: d.project.id,
    iterationId: d.iteration.id
  });
  if (request !== projectLoadSequence || state.data?.iteration.id !== d.iteration.id) return;
  const changed = JSON.stringify(d.jobs) !== JSON.stringify(result.jobs);
  state.data.jobs = result.jobs;
  if (changed) await refresh(); else pollJobs();
}
function slideFiles(id) {
  const def = slideDefs().find(s => s.id === id);
  id = def?.systemType || id;
  if (id === 'summary' || id === 'intro') return state.data.files;
  if (id === 'changes') return state.data.files.filter(f => f.number > 1);
  if (def?.visual) return state.data.files.filter(f => f.id === def.visual.id);
  return state.data.files.filter(f => f.category === id);
}
function resourceHeaders() {
  return {};
}
async function showDestinations(autoOpen = false) {
  if (DEMO) {
    await loadProjects();
    state.tab = 'projects';
    state.present = false;
    render();
    return;
  }
  if (activeModal) closeModal();
  if (magnifiedPhoto) closePhotoLightbox(false);
  clearTimeout(state.poll);
  state.client = false;
  state.present = false;
  state.shareToken = '';
  state.clientShareId = '';
  state.accountClientProject = '';
  state.data = null;
  state.profile = null;
  state.inspectHidden = false;
  const data = await api('destinations');
  state.destinations = data;
  if (autoOpen && domView.concat(data.studios.length, data.projects.length) === 1 && !data.conversations?.length) {
    if (data.studios.length) return openDestinationStudio(data.studios[0].id);
    return openClientProject(data.projects[0].id);
  }
  state.tab = 'destinations';
  render();
}
async function openDestinationStudio(id, project = '') {
  if (activeModal) closeModal();
  state.client = false;
  state.shareToken = '';
  state.clientShareId = '';
  state.accountClientProject = '';
  applySession(await api('switch_studio', {
    studio_id: id
  }));
  await resetStudio();
  if (project) {
    state.tab = 'overview';
    await openProject(project);
  }
}
async function openClientProject(project, iteration = null, slide = null, presentationMode = state.presentationMode) {
  state.presentationMode = presentationMode;
  if (activeModal) closeModal();
  clearTimeout(state.poll);
  if (magnifiedPhoto) closePhotoLightbox(false);
  const selected = await api('client_project', {
    project_id: project,
    iteration
  });
  state.shareToken = '';
  state.clientShareId = selected.share_id;
  state.accountClientProject = selected.project_id;
  state.client = true;
  state.present = true;
  state.hiddenPreview = '';
  state.communicationOpen = false;
  state.inspectHidden = false;
  state.chat = [];
  state.imageIndex = 0;
  state.profile = null;
  state.data = await api('deck');
  state.slide = Math.max(0, slideDefs().findIndex(s => s.id === slide));
  render();
  if (state.presentationMode === 'scroll') scrollToSlide(slideDefs()[state.slide]?.id, {
    smooth: false
  }); else window.scrollTo(0, 0);
}
function syncLanguage() {
  const project = state.present || state.client ? state.data?.project : null;
  setLanguage(resolveLanguage({
    user: project ? '' : (state.client ? state.data?.profile : state.user?.profile)?.language,
    project: project?.language,
    studio: project?.studio_language || state.studio?.language
  }));
  document.querySelector('.skip-link')?.replaceChildren(tr('skip_to_content'));
}
function languageSelect(value = '', inherit = true) {
  return domView.element("select", [{
    "name": "language"
  }], [domView.fragment([inherit ? domView.element("option", [{
    "value": domView.text([])
  }, domView.spread(!value ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr('same_as_studio')], false) : '', domView.join(Object.entries(languages).map(([code, label]) => domView.element("option", [{
    "value": code
  }, domView.spread(value === code ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [label], false)), '')])], false);
}
function accountMenu() {
  openModal(tr("your_account"), domView.element("div", [{
    "class": "account-menu"
  }], [domView.fragment([button(tr("your_profile"), 'profile', '', '', 'users'), state.user ? domView.text(["", button(tr("switch_workspace_project"), 'destinations', '', '', 'grid'), "", button(tr("log_out"), 'logout', 'ghost', '', 'logout'), ""]) : button(tr("sign_in_to_see_all_your_projects"), 'account-sign-in', 'primary', '', 'arrow')])], false));
}
function render() {
  hideToolbarTooltip();
  if (!state.present) stopSlideMedia();
  state.routeFailed = false;
  syncLanguage();
  document.body.classList.toggle('presentation-reading', state.present && state.presentationMode === 'scroll');
  if (!state.present) {
    stopScrollPresentation();
    scrollImageObserver?.disconnect();
  }
  if (!DEMO && state.user && state.tab !== 'destinations' && studioSetup.required()) {
    document.body.classList.remove('presenting', 'website-editing');
    clearPresentationTheme();
    applyStudioTheme(state.studioTheme, true);
    domView.mount($('#app'), studioSetup.page());
    studioSetup.afterRender();
    syncWorkspaceUrl();
    return;
  }
  document.body.classList.toggle('website-editing', !!website.active());
  if (!website.active()) website.destroyCode();
  if (!state.present && isPresentationFullscreen()) exitPresentationFullscreen().catch(e => toast(e.message));
  document.body.classList.toggle('presenting', state.present && (!!state.user || state.client));
  cancelSlideMotion();
  clearPresentationTheme();
  applyStudioTheme(state.studioTheme, !state.present && !state.client);
  $('#overlay').style.cssText = state.client || state.present ? '' : studioThemeStyle(state.studioTheme);
  if (!state.present) state.inspectHidden = false;
  if (!state.user && !state.client) {
    renderLogin();
    return;
  }
  if (state.tab === 'destinations' && !state.present) {
    domView.mount($('#app'), destinationPage(state.destinations, defaultBrand()));
    syncPresentationNavigation();
    syncBudgetLayout();
    syncWorkspaceUrl();
    return;
  }
  if (state.present && state.communicationOpen && communication.enabled()) {
    applyPresentationTheme(theme());
    domView.mount($('#app'), communication.clientPage());
    communication.afterRender();
    return;
  }
  if (website.active()) {
    const trialBar = DEMO ? '' : billing.trialBar();
    domView.mount($('#app'), domView.element("div", [{
      "class": trialBar ? 'billing-bar-layout' : ''
    }], [domView.fragment([trialBar, website.page()])], false));
    website.afterRender();
    syncWorkspaceUrl();
    return;
  }
  if (state.present) {
    renderPresentation();
    communication.afterRender();
    checksUi.sync();
    syncWorkspaceUrl();
    return;
  }
  renderWorkspace();
  syncPresentationNavigation();
  syncBudgetLayout();
  hydrateImages();
  hydrateProjectCovers();
  communication.afterRender();
  checksUi.sync();
  syncWorkspaceUrl();
}
function sidebar() {
  return domView.element("aside", [{
    "class": "sidebar"
  }], [domView.element("button", [{
    "data-action": "projects"
  }, {
    "aria-label": tr("studio_your_projects")
  }], [brand()], false), domView.element("div", [{
    "class": "studio-switch"
  }, {
    "title": state.studio?.name || tr("studio_current_studio")
  }], [domView.element("span", [{
    "class": "studio-mark"
  }], [initials(state.studio?.name || tr("studio_studio"))], false), domView.element("select", [{
    "id": "studio-select"
  }, {
    "aria-label": tr("studio_current_studio")
  }], [domView.fragment([domView.join((state.studios || [{
    id: 'demo',
    get name() {
      return tr("studio_your_design_studio");
    }
  }]).map(s => domView.element("option", [{
    "value": s.id
  }, domView.spread(s.id === state.studio?.id ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [s.name], false)), ''), !DEMO ? domView.element("option", [{
    "value": "new-studio"
  }], [domView.fragment(["＋ ", tr('studio_create_new_environment')])], false) : ''])], false)], false), domView.element("p", [{
    "class": "sidebar-caption"
  }], [tr("studio_workspace")], false), domView.element("button", [{
    "aria-label": tr("studio_all_projects", {
      v4: ''
    })
  }, {
    "title": tr("studio_all_projects", {
      v4: ''
    })
  }, {
    "class": domView.text(["side-link ", state.tab === 'projects' ? 'active' : ''])
  }, {
    "data-action": "projects"
  }], [icon('grid'), domView.element("span", [{
    "class": "side-link-label"
  }], [tr("studio_all_projects", {
    v4: ''
  })], false)], false), domView.element("button", [{
    "aria-label": tr("studio_current_project", {
      v7: ''
    })
  }, {
    "title": tr("studio_current_project", {
      v7: ''
    })
  }, {
    "class": domView.text(["side-link ", state.data?.project && !['projects', 'studio-users', 'all-comments', 'profile', 'billing', 'website'].includes(state.tab) ? 'active' : ''])
  }, {
    "data-action": "tab"
  }, {
    "data-tab": "overview"
  }, domView.spread(state.data?.project ? '' : domView.attributes([{
    "disabled": domView.text([])
  }]))], [icon('folder'), domView.element("span", [{
    "class": "side-link-label"
  }], [tr("studio_current_project", {
    v7: ''
  })], false)], false), domView.element("button", [{
    "aria-label": DEMO ? tr("studio_comments", {
      v11: ''
    }) : communication.t('Communication')
  }, {
    "title": DEMO ? tr("studio_comments", {
      v11: ''
    }) : communication.t('Communication')
  }, {
    "class": domView.text(["side-link ", state.tab === 'all-comments' ? 'active' : ''])
  }, {
    "data-action": "all-comments"
  }], [icon('chat'), domView.element("span", [{
    "class": "side-link-label"
  }], [DEMO ? tr("studio_comments", {
    v11: ''
  }) : communication.t('Communication')], false), " ", domView.element("span", [{
    "class": "unread-total"
  }], [state.unreadCount ? tr("studio_unread", {
    v0: state.unreadCount
  }) : ''], false)], false), !DEMO && state.studio?.role === 'admin' ? domView.element("button", [{
    "class": domView.text(["side-link ", state.tab === 'website' ? 'active' : ''])
  }, {
    "data-action": "website"
  }, {
    "title": "Website"
  }, {
    "aria-label": "Website"
  }], [icon('compass'), domView.element("span", [{
    "class": "side-link-label"
  }], ["Website"], false)], false) : '', domView.element("div", [{
    "class": "sidebar-bottom"
  }], [!DEMO && state.studio?.role === 'admin' ? domView.element("button", [{
    "aria-label": tr("studio_billing", {
      v1: ''
    })
  }, {
    "title": tr("studio_billing", {
      v1: ''
    })
  }, {
    "class": domView.text(["side-link ", state.tab === 'billing' ? 'active' : ''])
  }, {
    "data-action": "billing"
  }], [icon('budget'), domView.element("span", [{
    "class": "side-link-label"
  }], [tr("studio_billing", {
    v1: ''
  })], false)], false) : '', domView.element("button", [{
    "aria-label": tr("studio_studio_users", {
      v14: ''
    })
  }, {
    "title": tr("studio_studio_users", {
      v14: ''
    })
  }, {
    "class": domView.text(["side-link ", state.tab === 'studio-users' ? 'active' : ''])
  }, {
    "data-action": "studio-users"
  }], [icon('users'), domView.element("span", [{
    "class": "side-link-label"
  }], [tr("studio_studio_users", {
    v14: ''
  })], false)], false), domView.element("button", [{
    "aria-label": tr("studio_studio_settings", {
      v16: ''
    })
  }, {
    "title": tr("studio_studio_settings", {
      v16: ''
    })
  }, {
    "class": "side-link"
  }, {
    "data-action": "settings"
  }], [icon('settings'), domView.element("span", [{
    "class": "side-link-label"
  }], [tr("studio_studio_settings", {
    v16: ''
  })], false)], false), productFeedback.navigation(), domView.element("div", [{
    "class": "profile"
  }], [domView.element("button", [{
    "class": "profile-open"
  }, {
    "data-action": "profile"
  }, {
    "title": tr("user_profile")
  }, {
    "aria-label": tr("user_profile")
  }], [personAvatar(state.user?.profile, state.user?.name), domView.element("span", [], [state.user?.profile?.name || state.user?.name || tr("studio_your_studio"), domView.element("small", [], [tr("user_profile")], false)], false)], false), domView.element("button", [{
    "data-action": "logout"
  }, {
    "title": tr("studio_sign_out")
  }, {
    "aria-label": tr("studio_sign_out")
  }], [icon('logout')], false)], false)], false)], false);
}
function renderWorkspace() {
  const d = state.data, p = d?.project, tab = state.tab, trialBar = DEMO ? '' : billing.trialBar();
  domView.mount($('#app'), domView.fragment([trialBar, domView.element("div", [{
    "class": domView.text(["workspace ", trialBar ? 'billing-bar-layout' : ''])
  }], [sidebar(), domView.element("div", [{
    "class": "workspace-body"
  }], [domView.element("header", [{
    "class": "topbar"
  }], [domView.element("div", [{
    "class": "row"
  }], [iconBtn('menu', 'menu', tr("studio_open_navigation")), domView.element("div", [{
    "class": "breadcrumbs"
  }], [domView.element("button", [{
    "data-action": "projects"
  }], [tr("studio_projects")], false), p && !['projects', 'studio-users', 'all-comments', 'profile', 'billing', 'website'].includes(tab) ? domView.fragment([icon('right'), domView.element("span", [], [p.name], false)]) : ''], false)], false), domView.element("div", [{
    "class": "row"
  }], [DEMO ? domView.element("button", [{
    "class": "demo-indicator"
  }, {
    "data-action": "demo-info"
  }], [domView.fragment([tr("studio_interactive_demo"), " "]), icon('help')], false) : ''], false)], false), domView.element("main", [{
    "class": "main-content"
  }, {
    "id": "main"
  }], [domView.fragment([DEMO || tab === 'projects' && state.studioEmpty && state.billing?.needs_onboarding ? '' : billing.banner(), tab === 'website' ? website.page() : tab === 'billing' ? billing.page() : tab === 'all-comments' ? feedPage() : tab === 'profile' ? profilePage() : tab === 'studio-users' ? studioUsersPage() : tab === 'projects' ? projectList() : d ? projectPage() : empty(tr("studio_your_next_project_starts_here"), tr("studio_create_a_project_and_drop_in_your_design_files"), 'new-project', tr("studio_create_a_project"))])], false)], false)], false)]));
  const m = $('[data-action="menu"]');
  if (m) m.classList.add('mobile-menu');
}
function empty(title, description, action = '', label = '') {
  return domView.element("div", [{
    "class": "empty"
  }], [icon('folder'), domView.element("h2", [], [title], false), domView.element("p", [], [description], false), action ? button(label, action, 'primary', '', 'plus') : ''], false);
}
function projectMemberStack(project) {
  const members = project.members || [];
  if (!members.length) return '';
  return domView.element("div", [{
    "class": "tile-members"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "tile-members-trigger"
  }, {
    "data-project-members": project.id
  }, {
    "aria-haspopup": "dialog"
  }, {
    "aria-expanded": "false"
  }, {
    "aria-label": tr("studio_view_all_project_team_members", {
      v1: members.length
    })
  }], [domView.element("span", [{
    "class": "tile-avatar-stack"
  }, {
    "aria-hidden": "true"
  }], [domView.join(members.slice(0, 5).map(member => personAvatar(member.profile, member.name)), '')], false), domView.element("span", [{
    "class": "tile-members-count"
  }], [members.length > 5 ? tr("studio_more", {
    v0: members.length - 5
  }) : domView.text(["", members.length, " ", members.length === 1 ? 'member' : 'members', ""])], false)], false)], false);
}
function projectCard(p) {
  const t = normalizedProjectTheme(p.iteration?.theme, p.theme);
  const badges = domView.text(["", p.billing?.source === 'project_pass' ? billing.badge(p.billing) : '', "", p.archived ? domView.element("span", [{
    "class": "tag"
  }], [tr("studio_archived")], false) : '', "", p.processing ? domView.element("span", [{
    "class": "project-processing"
  }, {
    "role": "status"
  }], [domView.element("span", [{
    "class": "loading-inline"
  }], [], false), tr("studio_processing_files")], false) : '', ""]);
  return domView.element("article", [{
    "class": "project-tile project-themed-tile"
  }, {
    "style": projectThemeStyle(t)
  }], [domView.element("button", [{
    "class": "project-tile-open"
  }, {
    "data-action": "open-project"
  }, {
    "data-id": p.id
  }], [domView.element("div", [{
    "class": "project-art"
  }], [p.cover_key ? domView.element("img", [{
    "data-project-cover": p.id
  }, {
    "data-cover-key": p.cover_key
  }, {
    "alt": tr("studio_concept", {
      v2: p.name
    })
  }, {
    "loading": "lazy"
  }], [], false) : icon(p.archived ? 'history' : 'folder')], false), domView.element("div", [], [domView.element("div", [{
    "class": "project-tile-heading"
  }], [domView.element("h2", [{
    "title": p.name
  }], [p.name], false), domView.element("span", [{
    "class": "tile-swatches"
  }, {
    "aria-label": tr("studio_project_palette")
  }], [domView.join(t.colors.map(c => domView.element("i", [{
    "style": domView.text(["background:", c])
  }], [], false)), '')], false)], false), badges ? domView.element("div", [{
    "class": "project-tile-status row wrap"
  }], [badges], false) : ''], false)], false), domView.element("div", [{
    "class": "project-tile-footer"
  }], [projectMemberStack(p), domView.element("details", [{
    "class": "project-tile-actions"
  }], [domView.element("summary", [{
    "aria-label": tr('studio_project_actions', {
      name: p.name
    })
  }, {
    "title": tr('studio_project_actions', {
      name: p.name
    })
  }], [domView.element("span", [{
    "aria-hidden": "true"
  }], ["···"], false)], false), domView.element("div", [{
    "class": "project-actions-menu"
  }], [domView.fragment([button(tr("studio_preview"), 'preview-project', 'small ghost', domView.attributes([{
    "data-id": p.id
  }]), 'play'), button(p.pinned ? tr("studio_unpin") : tr("studio_pin"), 'pin-project', 'small ghost', domView.attributes([{
    "data-id": p.id
  }, {
    "data-pinned": p.pinned ? '0' : '1'
  }]), 'pushpin'), p.can_manage ?? p.can_edit ? button(p.archived ? tr("restore") : tr("studio_archive"), 'archive-project', 'small ghost', domView.attributes([{
    "data-id": p.id
  }, {
    "data-archived": p.archived ? '0' : '1'
  }]), 'history') : '', state.studio?.role === 'admin' && (p.can_manage ?? p.can_edit) ? button(tr("delete"), 'delete-project', 'small ghost danger-text', domView.attributes([{
    "data-id": p.id
  }, {
    "aria-label": tr('studio_delete_project', {
      v0: p.name
    })
  }]), 'trash') : ''])], false)], false)], false)], false);
}
document.addEventListener('click', e => {
  document.querySelectorAll('.project-tile-actions[open]').forEach(menu => {
    if (!menu.contains(e.target) || e.target.closest('[data-action]')) {
      if (menu.contains(document.activeElement)) menu.querySelector('summary').focus();
      menu.open = false;
    }
  });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const menu = document.querySelector('.project-tile-actions[open]');
  if (menu) {
    menu.open = false;
    menu.querySelector('summary').focus();
    e.preventDefault();
  }
});
const projectDate = value => new Intl.DateTimeFormat(dateLocale(), {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
}).format(new Date(domView.concat(value, 'T12:00:00')));
function projectTiles() {
  const search = (state.projectSearch || '').trim().toLowerCase(), projects = state.projects, pinned = projects.filter(p => p.pinned), rest = projects.filter(p => !p.pinned);
  if (!projects.length) return empty(search ? tr("studio_no_matching_projects") : tr("studio_no_projects_to_show"), search ? tr("studio_try_another_name_or_location") : tr("studio_create_a_project_or_turn_on_show_archived"));
  return pinned.length ? domView.fragment([domView.element("section", [{
    "class": "pinned-projects"
  }], [domView.element("h2", [], [tr("studio_pinned", {
    v0: icon('pushpin')
  })], false), domView.element("div", [{
    "class": "project-grid"
  }], [domView.join(pinned.map(projectCard), '')], false)], false), domView.element("hr", [{
    "class": "project-divider"
  }], [], false), domView.element("section", [], [domView.element("h2", [{
    "class": "projects-section-title"
  }], [tr("studio_all_other_projects")], false), domView.element("div", [{
    "class": "project-grid"
  }], [domView.join(rest.map(projectCard), '') || domView.element("p", [{
    "class": "muted"
  }], [tr("studio_all_matching_projects_are_pinned")], false)], false)], false)]) : domView.element("div", [{
    "class": "project-grid"
  }], [domView.join(projects.map(projectCard), '')], false);
}
function projectList() {
  if (!DEMO && state.studioEmpty) return onboarding.welcome();
  return domView.fragment([domView.element("div", [{
    "class": "project-head"
  }], [domView.element("div", [], [domView.element("h1", [], [tr("studio_your_projects")], false)], false), button(tr("studio_new_project"), 'new-project', 'primary', '', 'plus')], false), domView.element("div", [{
    "class": "project-filters"
  }], [domView.element("label", [{
    "class": "project-search"
  }], [icon('search'), domView.element("input", [{
    "id": "project-search"
  }, {
    "type": "search"
  }, {
    "placeholder": tr("studio_search_projects")
  }, {
    "aria-label": tr("studio_search_projects")
  }, {
    "value": state.projectSearch || ''
  }], [], false)], false), domView.element("label", [{
    "class": "check-label"
  }], [domView.element("input", [{
    "id": "show-archived"
  }, {
    "type": "checkbox"
  }, domView.spread(state.showArchived ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), tr("studio_show_archived")], false)], false), domView.element("div", [{
    "id": "project-grid"
  }], [projectTiles()], false)]);
}
function hydrateProjectCovers() {
  for (const im of document.querySelectorAll('[data-project-cover]')) {
    const url = state.projects.find(p => p.id === im.dataset.projectCover)?.cover_url;
    if (url) im.src = safeUrl(url, 'src');
  }
}
let projectsRequest = 0, projectSearchTimer;
async function loadProjects() {
  const request = ++projectsRequest, studio = state.studio?.id, search = state.projectSearch || '', archived = !!state.showArchived;
  const r = await api('projects', {
    archived: archived ? 1 : 0,
    search
  });
  if (request !== projectsRequest || studio !== state.studio?.id || search !== (state.projectSearch || '') || archived !== !!state.showArchived) return false;
  state.projects = r.projects;
  state.studioEmpty = r.studio_empty === true;
  if (r.billing) state.billing = r.billing;
  return true;
}
async function refreshProjectGrid() {
  try {
    if (!await loadProjects() || state.tab !== 'projects') return;
    const grid = $('#project-grid');
    if (grid) {
      domView.mount(grid, projectTiles());
      hydrateProjectCovers();
    }
    pollJobs();
  } catch (error) {
    toast(error.message);
  }
}
function projectPage() {
  const d = state.data, p = d.project, i = d.iteration;
  const tabs = [['overview', tr("studio_overview")], ['slides', tr("studio_presentation")], ['files', tr("studio_files_2")], ['budget', tr("studio_budget")], ['people', tr("studio_people")], ['comments', useProjectData() || communication.enabled() ? communication.t('Communication') : tr("studio_comments_2")]];
  return domView.fragment([domView.element("div", [{
    "class": "project-head"
  }], [domView.element("div", [], [domView.element("h1", [{
    "class": "user-title"
  }], [p.name], false)], false), domView.element("div", [{
    "class": "row project-actions"
  }], [domView.fragment([state.data.can_edit !== false ? quickIcon('settings', 'project-settings', tr("studio_project_settings")) : '', editable() ? quickIcon('brush', 'theme', tr("studio_project_style")) : '', quickIcon('eye', 'preview', tr("studio_preview")), state.data.can_edit !== false ? button(tr("studio_send_to_clients"), 'share', 'primary', '', 'send') : ''])], false)], false), domView.element("div", [{
    "class": "tabs-row"
  }], [domView.element("nav", [{
    "class": "tabs"
  }, {
    "aria-label": tr("studio_project_sections")
  }], [domView.join(tabs.map(([key, title]) => domView.element("button", [{
    "class": domView.text(["tab ", key === state.tab ? 'active' : ''])
  }, {
    "data-action": "tab"
  }, {
    "data-tab": key
  }], [domView.fragment([title, key === 'checks' && d.checks?.findings.some(f => f.status === 'open' && !f.stale) ? domView.element("small", [{
    "class": "check-warning"
  }], [d.checks.findings.filter(f => f.status === 'open' && !f.stale).length], false) : ''])], false)), '')], false), domView.element("div", [{
    "class": "iteration-controls"
  }], [domView.element("select", [{
    "class": "iteration-select"
  }, {
    "aria-label": tr("studio_select_project_iteration")
  }, {
    "id": "iteration-select"
  }], [domView.join((d.iterations || [i]).map(x => domView.element("option", [{
    "value": x.id
  }, domView.spread(x.id === i.id ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [domView.fragment([iterationLabel(x), " · ", Number(x.locked) ? tr('studio_status_locked') : ['draft', 'shared'].includes(x.status) ? tr(domView.concat('studio_status_', x.status)) : x.status])], false)), '')], false), domView.fragment([d.can_edit !== false && state.studio?.role === 'admin' ? quickIcon(Number(i.locked) ? 'lock' : 'unlock', 'lock-iteration', Number(i.locked) ? tr("studio_unlock_iteration") : tr("studio_lock_iteration"), domView.attributes([{
    "aria-pressed": !!Number(i.locked)
  }, domView.spread(!Number(i.locked) && pending() ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')])) : '', d.can_edit !== false ? quickIcon('plus', 'iteration', tr("studio_new_iteration")) : ''])], false)], false), domView.fragment([state.tab === 'overview' && !projectViewNotice() ? onboarding.checklist() : '', processingBanner(), state.tab === 'overview' ? jobStatusNotice() : '', state.projectLoadError && state.data?._loadedView === projectView() ? domView.element("p", [{
    "class": "notice"
  }, {
    "role": "alert"
  }], [domView.fragment([state.projectLoadError, " ", button(tr('studio_retry'), 'retry-project-view', 'small')])], false) : '', projectViewNotice() || (state.tab === 'overview' ? overview() : state.tab === 'slides' ? allSlides() : state.tab === 'files' ? filePage() : state.tab === 'checks' ? communication.page() : state.tab === 'budget' ? budgetPage() : state.tab === 'people' ? peopleUi.page() : state.tab === 'comments' ? communication.enabled() ? communication.page() : feedPage(true) : overview())])]);
}
function overview() {
  const d = state.data, i = d.iteration, summary = d.overview, fileCount = (summary?.file_count ?? d.files?.length) ?? 0, slideCount = summary?.slide_count ?? slideDefs().length;
  const hero = summary ? summary.cover : visualSlides(d).find(s => s.record?.id === d.cover_slide_id)?.visual || photoFiles()[0] || photoFiles('photos')[0] || photoFiles('moodboard')[0];
  const ready = (fileCount > 0 || (summary ? slideCount > 6 : d.slides.length > 0 || d.slide_content.length > 0)) && !pending();
  const clients = summary ? summary.client_count ? [{
    name: summary.client_name
  }] : [] : projectClientUi.clients();
  const clientCount = summary?.client_count ?? clients.length;
  return domView.fragment([domView.element("div", [{
    "class": "overview-grid"
  }], [domView.element("div", [], [domView.element("div", [{
    "class": "cover-card project-preview"
  }, {
    "style": projectThemeStyle(theme())
  }], [hero ? img(hero, tr("studio_interior_design_concept")) : '', domView.element("span", [{
    "class": "cover-badge"
  }], [tr("studio_concept_number", {
    number: String(i.number).padStart(2, '0')
  })], false), editable() ? quickIcon('camera', 'choose-project-cover', tr("studio_choose_cover"), '', 'cover-change') : '', domView.element("div", [{
    "class": "cover-caption"
  }], [domView.element("div", [], [domView.element("p", [{
    "class": "eyebrow"
  }], [d.project.location || tr("studio_your_next_chapter")], false), domView.element("h2", [], [domView.fragment([tr("a_place_to"), " ", tr("come_home_to")])], false)], false), domView.element("button", [{
    "class": "round-play"
  }, {
    "data-action": "preview"
  }, {
    "aria-label": tr("studio_preview_the_client_presentation")
  }], [icon('play')], false)], false)], false), domView.element("div", [{
    "class": "cover-meta"
  }], [domView.element("span", [], [tr("studio_slides", {
    v7: icon('slide'),
    v8: slideCount
  }), domView.element("span", [], ["·"], false), tr("studio_source_files", {
    v9: fileCount
  })], false)], false), domView.element("div", [{
    "class": "section-title"
  }], [domView.element("h2", [], [tr("studio_your_presentation")], false), domView.element("button", [{
    "class": "text-button"
  }, {
    "data-action": "tab"
  }, {
    "data-tab": "slides"
  }], [tr("studio_view_all_slides", {
    v12: icon('arrow')
  })], false)], false), domView.element("div", [{
    "class": "slide-cards"
  }], [summary ? domView.join(summary.previews.map(s => domView.element("button", [{
    "class": "slide-thumb"
  }, {
    "data-action": "open-editor-slide"
  }, {
    "data-id": s.id
  }], [domView.element("div", [{
    "class": "thumb-art project-preview"
  }], [img(s.visual, s.title, '', 'small')], false), domView.element("div", [{
    "class": "thumb-title user-title"
  }], [s.title], false)], false)), '') : domView.join(slideDefs().filter(s => s.visual || s.type === 'budget').slice(0, 4).map(s => slideThumb(s.id)), '')], false)], false), domView.element("div", [{
    "class": "overview-right"
  }], [summary ? domView.element("div", [{
    "class": "comm-overview-note"
  }], [domView.element("div", [], [icon('chat'), domView.element("span", [], [domView.element("strong", [], [communication.t('Communication')], false), domView.element("small", [], [domView.fragment([summary.pending_confirmation_count, " ", communication.t('pending'), " · ", communication.t('Slide comments included')])], false)], false)], false), button(communication.t('View pending confirmations'), 'project-pending', domView.concat('small', summary.pending_confirmation_count ? ' has-pending-confirmations' : ''))], false) : communication.overview(), domView.element("div", [{
    "class": "review-panel"
  }], [domView.element("div", [{
    "class": "row between"
  }], [domView.element("h2", [{
    "class": "panel-heading"
  }], [i.status === 'shared' ? tr("studio_out_in_the_world") : tr("studio_a_little_check_before_sharing")], false)], false), domView.element("div", [{
    "class": "review-steps"
  }], [domView.join([[true, tr("studio_project_created"), tr("studio_a_home_for_your_ideas")], [fileCount > 0, tr("studio_files_added"), domView.concat(fileCount, domView.text([" ", tr("studio_originals_kept_safely"), ""]))], [ready, tr("studio_presentation_assembled"), ready ? tr("studio_ready_for_your_review") : pending() ? tr("studio_processing_files_slides_appear_when_finished") : tr("studio_add_files_to_get_started")], [i.status === 'shared', tr("studio_shared_with_your_clients"), Number(i.locked) ? tr("studio_this_iteration_is_locked") : i.status === 'shared' ? tr("studio_edits_update_the_client_presentation") : tr("studio_your_preview_comes_first")]].map(([done, title, sub]) => domView.element("div", [{
    "class": domView.text(["review-step ", done ? 'is-done' : ''])
  }], [domView.element("span", [{
    "class": domView.text(["step-check ", done ? 'done' : ''])
  }], [done ? icon('check') : ''], false), domView.element("div", [], [title, domView.element("small", [], [sub], false)], false)], false)), '')], false), button(tr("studio_preview_presentation"), 'preview', 'primary wide', '', 'play'), domView.element("button", [{
    "type": "button"
  }, {
    "class": "client-mini"
  }, {
    "data-action": "tab"
  }, {
    "data-tab": "people"
  }], [domView.element("span", [{
    "class": "avatar"
  }], [initials(clients[0]?.name || tr("client"))], false), domView.element("span", [], [domView.fragment([clients.length ? clients[0].name : tr("studio_add_your_clients"), clientCount > 1 ? domView.concat(' +', clientCount - 1) : ''])], false), icon('users')], false)], false)], false)], false), domView.element("div", [{
    "class": "upload-theme-row"
  }], [domView.fragment([dropzone(), themeCard()])], false)]);
}
function dropzone() {
  if (state.data?.can_edit === false) return domView.element("p", [{
    "class": "notice"
  }], [tr("studio_you_re_viewing_a_public_studio_project_only_its_project_team_can_upload_files_and_edit")], false);
  return domView.element("div", [{
    "class": "dropzone"
  }, {
    "data-dropzone": domView.text([])
  }, {
    "tabindex": "0"
  }, {
    "role": "button"
  }, {
    "aria-label": tr("studio_upload_project_files")
  }], [domView.element("div", [{
    "class": "drop-icon"
  }], [icon('upload')], false), domView.element("div", [], [domView.element("h3", [], [editable() ? domView.fragment([domView.fragment([tr("studio_drop_your_files_here_or"), " "]), domView.element("span", [], [tr("browse")], false)]) : tr("studio_ready_for_the_next_chapter")], false), domView.element("p", [], [editable() ? 'PDF, presentations, spreadsheets and images · up to 23 MiB per upload' : tr("studio_create_an_iteration_to_add_or_replace_files")], false)], false), domView.element("input", [{
    "type": "file"
  }, {
    "id": "upload-input"
  }, {
    "hidden": domView.text([])
  }, {
    "multiple": domView.text([])
  }, {
    "accept": ".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
  }], [], false)], false);
}
async function projectCoverModal() {
  if (!requireDraft() || !await ensureProjectResource('slides')) return;
  const candidates = visualSlides(state.data).filter(s => s.visual);
  openModal(tr('studio_choose_cover'), domView.fragment([domView.element("div", [{
    "class": "project-cover-picker"
  }], [domView.join(candidates.map(s => domView.element("button", [{
    "type": "button"
  }, {
    "class": "project-cover-option"
  }, {
    "data-action": "select-project-cover"
  }, {
    "data-slide": s.record.id
  }, {
    "aria-pressed": s.record.id === state.data.cover_slide_id
  }], [img(s.visual, s.title, '', 'small'), domView.element("span", [], [s.title], false)], false)), '') || domView.element("p", [{
    "class": "muted"
  }], [tr('studio_cover_no_images')], false)], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr('cancel'), 'close-modal', 'ghost')], false)]), true);
  hydrateImages();
}
function themeCard() {
  const t = theme();
  return domView.element("div", [{
    "class": "theme-card"
  }], [domView.element("div", [{
    "class": "row between"
  }], [domView.element("h3", [], [tr("studio_your_project_s_look_feel")], false), editable() ? domView.element("button", [{
    "data-action": "theme"
  }, {
    "aria-label": tr("studio_edit_project_styling")
  }], [icon('brush')], false) : ''], false), domView.element("div", [{
    "class": "swatches"
  }], [domView.join(t.colors.map(c => domView.element("span", [{
    "class": "swatch"
  }, {
    "style": domView.text(["background:", c])
  }, {
    "title": c
  }], [], false)), '')], false), domView.element("div", [{
    "class": "row"
  }], [domView.element("span", [], [t.font === 'serif' ? tr("studio_editorial_serif") : tr("studio_modern_sans")], false)], false)], false);
}
function slideThumb(id) {
  const defs = slideDefs(), idx = defs.findIndex(x => x.id === id), def = defs[idx];
  if (!def) return '';
  const f = def.visual || (def.type === 'intro' ? photoFiles()[0] || photoFiles('photos')[0] : null);
  return domView.element("button", [{
    "class": "slide-thumb"
  }, {
    "data-action": "go-slide"
  }, {
    "data-slide": idx
  }], [domView.element("div", [{
    "style": projectThemeStyle(theme())
  }, {
    "class": "thumb-art project-preview"
  }], [domView.fragment([f ? img(f, '', '', 'small') : def.type === 'budget' ? domView.element("div", [{
    "class": "mini-budget"
  }], [domView.element("strong", [], [money(state.data.total_cents)], false), domView.element("div", [{
    "class": "mini-bars"
  }], [domView.element("i", [], [], false), domView.element("i", [], [], false), domView.element("i", [], [], false)], false)], false) : icon(def.icon), def.record ? domView.element("span", [{
    "class": "tag"
  }], [domView.fragment([visualTypes[def.type], def.situation !== 'unknown' ? domView.concat(' · ', ({
    get before() {
      return tr("studio_before");
    },
    get concept() {
      return tr("studio_concept_3");
    },
    get after() {
      return tr("studio_after");
    },
    get reference() {
      return tr("studio_reference");
    }
  })[def.situation]) : ''])], false) : ''])], false), domView.element("div", [{
    "class": "thumb-title"
  }], [domView.element("small", [], [String(domView.concat(idx, 1)).padStart(2, '0')], false), domView.element("span", [{
    "class": def.record || def.customContent || def.sourceOnly ? 'user-title' : ''
  }], [def.title], false)], false)], false);
}
const slideTypeName = s => (s.type === 'video' && s.record?.metadata?.video?.provider === 'youtube' ? tr('studio_video_youtube') : null) || visualTypes[s.type] || ({
  get text() {
    return tr("studio_text");
  },
  get video() {
    return tr("media_video");
  },
  get intro() {
    return tr("studio_introduction");
  },
  get source() {
    return tr("studio_document_page");
  },
  get changes() {
    return tr("studio_changes");
  },
  get budget() {
    return tr("studio_budget");
  },
  get 'open-questions'() {
    return tr("open_questions");
  },
  get contacts() {
    return tr("studio_contacts");
  },
  get summary() {
    return tr("studio_summary");
  }
})[s.type] || tr("image");
const slideTypeFilter = createSlideTypeFilter({
  types: () => ({
    ...visualTypes,
    get text() {
      return tr("studio_text");
    },
    get video() {
      return tr("media_video");
    },
    get intro() {
      return tr("studio_introduction");
    },
    get source() {
      return tr("studio_document_page");
    },
    get changes() {
      return tr("studio_changes");
    },
    get budget() {
      return tr("studio_budget");
    },
    get 'open-questions'() {
      return tr("open_questions");
    },
    get contacts() {
      return tr("studio_contacts");
    },
    get summary() {
      return tr("studio_summary");
    }
  }),
  openModal,
  closeModal,
  getSelected: () => state.slideTypes ?? null,
  onApply: applySlideTypes,
  onError: error => toast(error.message)
});
function editorSlides() {
  return presentationSlides(state.data, {
    includeHidden: true
  });
}
function applySlideTypes(types) {
  state.slideTypes = types;
  render();
  return true;
}
async function openEditorSlide(id, zoom = false) {
  await startPresentation(0, {
    editorSlide: id
  });
  if (zoom && state.present) openPhotoLightbox();
}
const currentGroups = () => {
  const groups = state.data?.slide_groups || slideSections;
  return {
    ...Object.fromEntries(Object.entries(groups).map(([key, label]) => [key, Object.hasOwn(slideSections, key) ? slideSections[key] : label]))
  };
};
installIconTooltips({
  enabled: () => ['slides', 'people'].includes(state.tab) && !state.present
});
function allSlides() {
  const defs = editorSlides().filter(s => !state.slideTypes || state.slideTypes.includes(s.type)), list = state.slideView !== 'grid';
  return domView.fragment([domView.element("div", [{
    "class": "section-title slide-editor-heading"
  }], [domView.element("div", [], [domView.element("h2", [], [tr("studio_your_client_s_journey")], false)], false), domView.element("div", [{
    "class": "row wrap"
  }], [domView.fragment([slideTypeFilter.button(), editable() ? iconBtn('plus', 'add-slide', tr("studio_add_slide")) : '', iconBtn('menu', 'slide-view', tr("studio_list"), domView.attributes([{
    "data-view": "list"
  }, {
    "aria-pressed": list
  }])), iconBtn('grid', 'slide-view', tr("studio_grid"), domView.attributes([{
    "data-view": "grid"
  }, {
    "aria-pressed": !list
  }]))])], false)], false), domView.fragment([!editable() ? domView.element("p", [{
    "class": "notice"
  }], [tr("studio_this_shared_iteration_is_preserved_create_a_new_iteration_to_edit_the_slides")], false) : '', pending() ? domView.element("p", [{
    "class": "notice"
  }], [tr("studio_your_files_are_still_being_processed_new_slides_will_appear_here_automatically_when_each_file_finish")], false) : '']), domView.element("div", [{
    "class": "section-index editor-section-index"
  }], [sectionIndex(defs, false)], false), domView.element("p", [{
    "class": "sr-only"
  }, {
    "id": "slide-order-status"
  }, {
    "role": "status"
  }, {
    "aria-live": "polite"
  }], [], false), domView.element("div", [{
    "class": domView.text(["slide-editor ", list ? 'slide-editor-list' : 'all-slides'])
  }], [domView.join(defs.filter(s => !state.slideGroup || s.section === state.slideGroup).map((s, n) => {
    const f = s.visual, origin = f ? domView.text(["", f.source_name || f.name, "", f.page_number ? domView.concat(' · Page ', f.page_number) : '', "", f.image_number ? domView.concat(' · Image ', f.image_number) : '', ""]) : s.type === 'video' ? domView.concat(domView.text(["", tr("studio_youtube"), " "]), s.record?.metadata?.video?.url || tr("studio_video_link")) : Number(s.record?.manual) ? tr("studio_created_manually") : tr("studio_project_information");
    const preview = s.type === 'video' ? videoThumbnail(s.title, s.record?.metadata?.video?.provider) : f ? domView.concat(img(f, s.title, '', 'small'), s.type === 'fullphoto' ? domView.element("span", [{
      "class": "manual-thumb-title"
    }], [s.title], false) : '') : s.type === 'text' ? domView.element("span", [{
      "class": "manual-thumb-title"
    }], [s.title], false) : s.type === 'budget' ? domView.element("strong", [], [money(state.data.total_cents)], false) : icon(s.icon);
    return domView.element("article", [{
      "class": domView.text(["slide-editor-row slide-card-item ", s.hidden ? 'is-hidden' : ''])
    }, {
      "data-slide-id": s.id
    }, {
      "data-slide-section": s.section
    }], [domView.element("div", [{
      "class": "slide-order"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "class": "slide-drag-handle"
    }, {
      "data-drag-slide": s.id
    }, {
      "aria-label": tr("studio_reorder", {
        v4: s.title
      })
    }, domView.spread(editable() ? '' : domView.attributes([{
      "disabled": domView.text([])
    }])), {
      "title": tr("studio_drag_to_reorder_space_for_keyboard_controls")
    }], ["⠿"], false), domView.element("small", [], [String(domView.concat(n, 1)).padStart(2, '0')], false)], false), domView.element("button", [{
      "class": "editor-slide-preview project-preview"
    }, {
      "style": projectThemeStyle(theme())
    }, {
      "data-action": "open-editor-slide"
    }, {
      "data-id": s.id
    }, {
      "aria-label": tr("studio_preview_2", {
        v9: s.title
      })
    }], [preview], false), domView.element("div", [{
      "class": "editor-slide-details"
    }], [domView.element("div", [{
      "class": "row wrap"
    }], [domView.element("span", [{
      "class": "tag outline"
    }], [domView.fragment([s.record ? Number(s.record.manual) ? domView.text(["", tr("studio_manual"), " "]) : domView.concat(tr('detected_type'), ' ') : '', slideTypeName(s)])], false), s.hidden ? domView.element("span", [{
      "class": "tag"
    }], [tr("studio_hidden")], false) : ''], false), domView.element("h3", [{
      "class": s.record || s.customContent || s.sourceOnly ? 'user-title' : ''
    }], [s.title], false), domView.element("p", [], [s.record?.description || situations[s.situation] || tr("studio_presentation_section")], false), domView.element("small", [{
      "class": "slide-origin"
    }], [origin], false)], false), domView.element("div", [{
      "class": "editor-slide-actions"
    }], [editable() ? domView.text(["", !s.sourceOnly && !s.record?.legacy ? iconBtn('edit', 'edit-slide', domView.concat(domView.text(["", tr("studio_edit_slide"), " "]), s.title), domView.attributes([{
      "data-id": s.record?.id || s.id
    }])) : '', "", iconBtn(s.hidden ? 'eye-off' : 'eye', 'visibility-slide', domView.concat(domView.concat(s.hidden ? tr("studio_show") : tr("studio_hide"), ' slide: '), s.title), domView.attributes([{
      "data-id": s.id
    }, {
      "data-operation": s.hidden ? 'show' : 'hide'
    }])), "", iconBtn('trash', 'delete-slide', domView.concat(domView.text(["", tr("studio_delete_slide"), " "]), s.title), domView.attributes([{
      "data-id": s.id
    }])), ""]) : ''], false)], false);
  }), '') || slideTypeFilter.empty()], false), state.slideGroup && editable() ? domView.element("div", [{
    "class": "editor-group-footer"
  }], [button(tr('studio_remove_group'), 'remove-slide-group', 'danger-text', Object.keys(currentGroups()).length < 2 ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '', 'trash')], false) : '']);
}
async function changeSlideLayout(operation, extra = {}) {
  if (!requireDraft()) return;
  const selected = state.present ? slideDefs()[state.slide]?.id : null;
  if (selected && operation === 'hide') state.hiddenPreview = '';
  await api('slide_layout', {
    iteration: state.data.iteration.id,
    operation,
    ...extra
  });
  await refresh(true);
  if (selected && state.present) {
    const index = slideDefs().findIndex(s => s.id === selected);
    if (index >= 0) state.slide = index;
    render();
  }
  return true;
}
installSlideOrdering({
  getOrder: () => editorSlides().map(s => s.id),
  saveOrder: order => changeSlideLayout('reorder', {
    order
  }),
  assignGroup: (slide_id, section) => changeSlideLayout('section', {
    slide_id,
    section
  }),
  setBusy: value => {
    state.reordering = value;
    if (!value) pollJobs();
  },
  onError: toast
});
document.addEventListener('change', async e => {
  if (e.target.matches('[data-slide-section-select]')) try {
    await changeSlideLayout('section', {
      slide_id: e.target.dataset.slideSectionSelect,
      section: e.target.value
    });
  } catch (error) {
    toast(error.message);
  }
});
installGroupOrdering({
  getOrder: () => Object.keys(currentGroups()),
  saveOrder: async order => {
    if (!requireDraft()) return;
    await api('reorder_slide_groups', {
      iteration: state.data.iteration.id,
      order
    });
    await refresh(true);
  },
  setBusy: value => {
    state.reordering = value;
    if (!value) pollJobs();
  },
  onError: toast
});
function sectionIndex(defs, presentation = true) {
  const active = presentation ? defs[state.slide]?.section : state.slideGroup, edit = !presentation && editable();
  const groups = domView.join(Object.entries(currentGroups()).filter(([key]) => !presentation || defs.some(s => s.section === key)).map(([key, label]) => {
    const button = domView.element("button", [{
      "type": "button"
    }, {
      "class": active === key ? 'active' : ''
    }, {
      "data-action": presentation ? 'jump-section' : 'editor-section'
    }, {
      "data-section": key
    }, domView.spread(active === key ? domView.attributes([{
      "aria-current": "true"
    }]) : '')], [label, domView.element("small", [], [defs.filter(s => s.section === key).length], false)], false);
    if (presentation) return domView.element("span", [{
      "class": domView.text(["section-split ", active === key ? 'active' : ''])
    }, {
      "role": "group"
    }, {
      "aria-label": label
    }], [button, domView.element("button", [{
      "type": "button"
    }, {
      "class": "section-foldout"
    }, {
      "data-section-menu": key
    }, {
      "aria-label": tr('slides_in', {
        group: label
      })
    }, {
      "aria-haspopup": "menu"
    }, {
      "aria-expanded": "false"
    }, {
      "aria-controls": "section-slide-menu"
    }], [icon('down')], false)], false);
    return edit ? domView.element("span", [{
      "class": "slide-group"
    }, {
      "data-group-id": key
    }, {
      "data-drop-group": key
    }], [domView.element("span", [{
      "class": "slide-group-controls"
    }], [domView.element("button", [{
      "type": "button"
    }, {
      "class": "group-drag-handle"
    }, {
      "data-drag-group": key
    }, {
      "aria-label": tr("studio_reorder_group", {
        v3: label
      })
    }, {
      "title": tr("studio_drag_group_space_for_keyboard_controls")
    }], ["⠿"], false), button], false)], false) : button;
  }), '');
  if (presentation) return groups;
  return domView.fragment([domView.element("div", [{
    "class": "editor-section-all"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": !active ? 'active' : ''
  }, {
    "data-action": "editor-section"
  }, {
    "data-section": domView.text([])
  }], [tr("studio_all_slides"), domView.element("small", [], [defs.length], false)], false)], false), domView.element("div", [{
    "class": "editor-group-scroll"
  }], [domView.element("button", [{
    "class": "group-scroll-arrow"
  }, {
    "type": "button"
  }, {
    "data-group-scroll": "-1"
  }, {
    "aria-label": tr("scroll_groups_left")
  }, {
    "hidden": domView.text([])
  }], [icon('left')], false), domView.element("nav", [{
    "class": "editor-group-list"
  }, {
    "aria-label": tr("presentation_sections")
  }], [groups], false), domView.element("button", [{
    "class": "group-scroll-arrow"
  }, {
    "type": "button"
  }, {
    "data-group-scroll": "1"
  }, {
    "aria-label": tr("scroll_groups_right")
  }, {
    "hidden": domView.text([])
  }], [icon('right')], false)], false), edit ? domView.element("div", [{
    "class": "editor-section-add"
  }], [button(tr("studio_add_group"), 'add-slide-group', 'small', '', 'plus')], false) : '']);
}
installSectionMenus({
  getSlides: slideDefs,
  onNavigate: id => {
    const index = slideDefs().findIndex(s => s.id === id);
    if (index >= 0) {
      $('.presentation-sidebar')?.dispatchEvent(new CustomEvent('presentation-navigation-guide', {
        detail: false
      }));
      moveSlide(index - state.slide);
    }
  }
});
const expandedFiles = new Set();
function extractedAssets(file) {
  const stem = file.name.replace(/\.[^.]+$/, '');
  return (file.pages || []).flatMap(page => {
    const prefix = domView.text(["", stem, "-page-", String(page.number).padStart(3, '0'), ""]);
    const assets = [];
    if (page.has_preview) assets.push({
      page: page.number,
      image: 0,
      kind: 'page',
      name: domView.concat(prefix, '.jpg'),
      get type() {
        return tr("studio_page_preview");
      }
    });
    for (const im of page.images || []) {
      const slide = state.data.slides?.find(s => s.source_version_id === file.id && s.page_number === page.number && s.image_number === im.number);
      assets.push({
        page: page.number,
        image: im.number,
        kind: 'image',
        name: domView.text(["", prefix, "-image-", String(im.number).padStart(3, '0'), ".jpg"]),
        size: im.size,
        slide,
        type: visualTypes[slide?.type] || tr("studio_image_to_review")
      });
    }
    if (page.has_text) assets.push({
      page: page.number,
      image: 0,
      kind: 'text',
      name: domView.concat(prefix, '.txt'),
      get type() {
        return tr("studio_extracted_text");
      }
    });
    return assets.map(a => ({
      ...a,
      id: domView.text(["", file.id, ":", a.page, ":", a.kind, ":", a.image, ""]),
      source: file
    }));
  });
}
function findExtractedAsset(id) {
  return state.data.files.flatMap(extractedAssets).find(a => a.id === id);
}
function assetImage(a) {
  return {
    ...a.source,
    name: a.name,
    page_number: a.page,
    image_number: a.image,
    has_preview: true
  };
}
function extractedRows(file, assets) {
  return domView.element("div", [{
    "class": "extracted-file-list"
  }, {
    "role": "group"
  }, {
    "aria-label": tr("studio_files_extracted_from", {
      v0: file.name
    })
  }], [domView.join(assets.map(a => domView.element("div", [{
    "class": "extracted-file-row"
  }], [domView.element("button", [{
    "class": "extracted-file-thumb"
  }, {
    "data-action": "preview-extracted"
  }, {
    "data-id": a.id
  }, {
    "aria-label": tr("studio_preview_3", {
      v1: a.name
    })
  }], [a.kind === 'text' ? icon('file') : img(assetImage(a), a.name, '', 'small')], false), domView.element("div", [{
    "class": "extracted-file-name"
  }], [domView.element("strong", [], [a.name], false), domView.element("small", [], [tr("studio_page", {
    v4: a.page,
    v5: a.image ? domView.concat(' · Image ', a.image) : '',
    v6: a.size ? domView.concat(' · ', bytes(a.size)) : '',
    v7: a.slide?.title ? domView.concat(' · ', a.slide.title) : ''
  })], false)], false), domView.element("div", [{
    "class": "extracted-file-classification"
  }], [domView.element("span", [{
    "class": "tag outline"
  }], [a.type], false), a.slide ? domView.element("small", [], [situations[a.slide.situation]], false) : ''], false), domView.element("div", [{
    "class": "file-actions"
  }], [domView.fragment([a.slide && editable() ? iconBtn('edit', 'edit-slide', tr("studio_edit_extracted_image_classification"), domView.attributes([{
    "data-id": a.slide.id
  }])) : '', iconBtn('eye', 'preview-extracted', tr("studio_preview_extracted_file"), domView.attributes([{
    "data-id": a.id
  }])), iconBtn('download', 'download-extracted', tr("studio_download_extracted_file"), domView.attributes([{
    "data-id": a.id
  }]))])], false)], false)), '')], false);
}
function explorerFileRow(f) {
  const assets = extractedAssets(f), expanded = expandedFiles.has(f.id);
  return domView.element("div", [{
    "class": "file-group"
  }], [domView.element("div", [{
    "class": "file-row"
  }], [domView.element("div", [{
    "class": "file-name"
  }], [domView.fragment([assets.length ? domView.element("button", [{
    "class": "icon-button extraction-toggle"
  }, {
    "data-action": "toggle-extracted"
  }, {
    "data-id": f.id
  }, {
    "aria-label": tr("studio_extracted_files_for", {
      v1: expanded ? tr("studio_collapse") : tr("studio_expand"),
      v2: f.name
    })
  }, {
    "aria-expanded": expanded
  }], [icon(expanded ? 'down' : 'right')], false) : ``, fileTypeLogo(f)]), domView.element("span", [], [domView.element("strong", [], [f.name], false), domView.element("small", [], [tr("studio_original_source", {
    v3: bytes(f.size),
    v4: assets.length ? domView.concat(domView.concat(' · ', assets.length), ' extracted files') : ''
  })], false)], false)], false), domView.element("select", [{
    "class": "file-category"
  }, {
    "data-category": f.asset_id
  }, {
    "aria-label": tr("studio_category_for", {
      v6: f.name
    })
  }, domView.spread(editable() ? '' : domView.attributes([{
    "disabled": domView.text([])
  }]))], [domView.join(Object.entries(cats).map(([c, t]) => domView.element("option", [{
    "value": c
  }, domView.spread(c === f.category ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [t], false)), '')], false), domView.element("span", [{
    "class": "file-version"
  }], [domView.fragment(["v", f.number])], false), domView.element("div", [{
    "class": "file-actions"
  }], [domView.fragment([filePreviewButton(f), (/\.(pdf|pptx?)$/i).test(f.name) ? iconBtn('eye', 'review-pages', tr("studio_view_extracted_pages"), domView.attributes([{
    "data-id": f.id
  }])) : '', iconBtn('history', 'history', tr("studio_version_history"), domView.attributes([{
    "data-id": f.id
  }])), state.data.can_edit !== false ? iconBtn('upload', 'replace', tr("studio_replace_file"), domView.attributes([{
    "data-id": f.id
  }])) : '', iconBtn('download', 'download', tr("download_original"), domView.attributes([{
    "data-id": f.id
  }]))])], false)], false), expanded ? extractedRows(f, assets) : ''], false);
}
let fileSearchTimer;
const fileFilterActive = () => state.fileCategories !== null;
const fileFilterSummary = () => fileFilterActive() ? tr('studio_file_categories_selected', {
  v0: state.fileCategories.size,
  v1: Object.keys(cats).length
}) : tr('studio_all_file_categories_shown');
function updateFileFilter() {
  syncWorkspaceUrl();
  refreshFileGrid();
  const status = document.querySelector('[data-file-filter-status]');
  if (status) status.textContent = fileFilterSummary();
}
function fileFilterModal() {
  openModal(tr('studio_filter_files'), domView.fragment([domView.element("p", [], [tr('studio_file_filter_hint')], false), domView.element("div", [{
    "class": "row slide-filter-actions"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "button small"
  }, {
    "data-file-filter-select": "all"
  }], [tr('studio_select_all')], false), domView.element("button", [{
    "type": "button"
  }, {
    "class": "button small"
  }, {
    "data-file-filter-select": "none"
  }], [tr('studio_clear_selection')], false)], false), domView.element("fieldset", [{
    "class": "slide-type-options file-category-options"
  }], [domView.element("legend", [{
    "class": "sr-only"
  }], [tr('studio_category')], false), domView.join(Object.entries(cats).map(([key, name]) => domView.element("label", [{
    "class": "check-label"
  }], [domView.element("input", [{
    "type": "checkbox"
  }, {
    "name": "file-category"
  }, {
    "value": key
  }, domView.spread(!state.fileCategories || state.fileCategories.has(key) ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), domView.element("span", [], [name], false)], false)), '')], false), domView.element("p", [{
    "class": "form-hint"
  }, {
    "data-file-filter-status": domView.text([])
  }, {
    "role": "status"
  }], [fileFilterSummary()], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr('studio_done'), 'close-modal', 'primary')], false)]));
}
document.addEventListener('click', e => {
  const select = e.target.closest('[data-file-filter-select]');
  if (!select) return;
  state.fileCategories = select.dataset.fileFilterSelect === 'all' ? null : new Set();
  document.querySelectorAll('[name="file-category"]').forEach(input => input.checked = !state.fileCategories);
  updateFileFilter();
});
document.addEventListener('change', e => {
  const input = e.target;
  if (!input.matches('[name="file-category"]')) return;
  if (!state.fileCategories) state.fileCategories = new Set(Object.keys(cats));
  if (input.checked) state.fileCategories.add(input.value); else state.fileCategories.delete(input.value);
  if (state.fileCategories.size === Object.keys(cats).length) state.fileCategories = null;
  updateFileFilter();
});
async function refreshFileGrid() {
  if (state.tab !== 'files' || !state.data) return;
  const focused = document.activeElement?.id === 'file-search', position = focused ? document.activeElement.selectionStart : null;
  await selectProjectTab('files');
  if (focused && state.tab === 'files' && document.activeElement === document.body) {
    const input = $('#file-search');
    input?.focus({
      preventScroll: true
    });
    input?.setSelectionRange(position, position);
  }
}
function filePage() {
  const d = state.data, visible = d.files;
  return domView.fragment([domView.element("div", [{
    "class": "file-tools"
  }], [domView.element("div", [{
    "class": "file-search-tools"
  }], [domView.element("div", [{
    "class": "search"
  }], [icon('search'), domView.element("input", [{
    "id": "file-search"
  }, {
    "value": state.search
  }, {
    "placeholder": tr("studio_find_a_project_file")
  }, {
    "aria-label": tr("studio_search_project_files")
  }], [], false)], false), domView.element("button", [{
    "type": "button"
  }, {
    "class": domView.text(["icon-button slide-type-filter file-category-filter ", fileFilterActive() ? 'is-active' : ''])
  }, {
    "data-action": "file-filter"
  }, {
    "aria-label": tr('studio_filter_files')
  }, {
    "title": fileFilterActive() ? fileFilterSummary() : tr('studio_filter_files')
  }, {
    "aria-haspopup": "dialog"
  }], [domView.fragment([icon('filter'), fileFilterActive() ? domView.element("span", [{
    "class": "slide-filter-dot"
  }, {
    "aria-hidden": "true"
  }], [], false) : ''])], false)], false), domView.element("div", [{
    "class": "row wrap"
  }], [domView.fragment([d.jobs?.some(j => j.status === 'failed' && j.dismissed_at) ? button(tr('studio_view_dismissed_processing'), 'job-status', 'ghost', domView.attributes([{
    "data-view": "dismissed"
  }])) : "", button(tr("studio_upload_files"), 'upload', 'primary', '', 'upload')])], false)], false), visible.length ? domView.fragment([domView.element("p", [{
    "class": "file-explorer-hint"
  }], [tr("studio_expand_a_source_document_to_browse_its_extracted_images_page_previews_and_text_files")], false), domView.element("div", [{
    "class": "file-table"
  }], [domView.element("div", [{
    "class": "file-row header"
  }], [domView.element("span", [], [tr("studio_file_name")], false), domView.element("span", [], [tr("studio_category")], false), domView.element("span", [], [tr("version")], false), domView.element("span", [], [], false)], false), domView.join(sortDownloadFiles(visible).map(explorerFileRow), '')], false)]) : empty(state.search || fileFilterActive() ? tr("studio_no_matching_files") : tr("studio_bring_your_ideas_together"), state.search || fileFilterActive() ? tr("studio_try_another_category_or_file_name") : tr("studio_drop_in_a_moodboard_a_render_a_drawing_or_a_quote")), domView.element("div", [{
    "style": "margin-top:24px"
  }], [dropzone()], false), domView.fragment([d.files.some(f => f.metadata?.warnings?.length) ? domView.element("details", [{
    "class": "file-review"
  }], [domView.element("summary", [], [tr("studio_files_that_need_a_closer_look")], false), domView.element("ul", [], [domView.join(d.files.flatMap(f => (f.metadata?.warnings || []).map(w => domView.element("li", [], [domView.element("strong", [], [domView.fragment([f.name, ":"])], false), domView.fragment([" ", w])], false))), '')], false)], false) : '', !DEMO ? checksUi.sources() : ''])]);
}
async function previewExtracted(id) {
  const a = findExtractedAsset(id);
  if (!a) return;
  let content;
  if (a.kind === 'text') {
    const page = await api('document_page', {
      id: a.source.id,
      iteration: state.data.iteration.id,
      page: a.page
    });
    content = domView.element("pre", [{
      "class": "extracted-text"
    }], [page.text], false);
  } else content = domView.element("div", [{
    "class": "extracted-asset-preview"
  }], [img(assetImage(a), a.name)], false);
  openModal(a.name, domView.fragment([domView.element("p", [], [tr("studio_page_2", {
    v0: a.source.name,
    v1: a.page,
    v2: a.type
  })], false), content, domView.element("div", [{
    "class": "modal-footer"
  }], [domView.fragment([a.slide && editable() ? button(tr("studio_edit_classification"), 'edit-slide', 'small', domView.attributes([{
    "data-id": a.slide.id
  }]), 'edit') : '', button(tr("studio_download_file"), 'download-extracted', 'primary', domView.attributes([{
    "data-id": a.id
  }]), 'download')])], false)]), true);
  hydrateImages();
}
async function downloadExtracted(id) {
  const a = findExtractedAsset(id);
  if (!a) return;
  let blob;
  if (a.kind === 'text') {
    const p = await api('document_page', {
      id: a.source.id,
      iteration: state.data.iteration.id,
      page: a.page
    });
    blob = new Blob([p.text], {
      type: 'text/plain;charset=utf-8'
    });
  } else {
    const params = new URLSearchParams({
      action: 'document_page',
      id: a.source.id,
      iteration: state.data.iteration.id,
      page: a.page,
      ...a.image ? {
        image: a.image
      } : {
        preview: 1
      }
    });
    const r = await platformFetch(params, {
      credentials: 'same-origin',
      headers: resourceHeaders()
    });
    if (!r.ok) throw Error(tr("studio_this_extracted_file_is_unavailable"));
    blob = await r.blob();
  }
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.download = a.name;
  link.href = safeUrl(url, 'href', link.download !== undefined && link.hasAttribute?.("download"));
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 20000);
}
const budgetChoiceSaving = new Set();
const canChooseBudget = () => !Number(state.data?.iteration.locked) && (state.client || state.data?.can_edit !== false);
function budgetChoiceControls(item) {
  const disabled = !canChooseBudget() || budgetChoiceSaving.has(item.id), range = budgetIsRange(item);
  if (!Number(item.is_optional) && !range) return '';
  return domView.element("div", [{
    "class": "budget-choice-controls"
  }], [domView.fragment([Number(item.is_optional) ? domView.element("label", [{
    "class": "check-label"
  }], [domView.element("input", [{
    "type": "checkbox"
  }, {
    "data-budget-option": item.id
  }, domView.spread(item.selected ? domView.attributes([{
    "checked": domView.text([])
  }]) : ''), domView.spread(disabled ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')], [], false), tr("include_this_option_in_my_budget")], false) : '', range ? domView.element("div", [{
    "class": "budget-range-control"
  }], [domView.element("div", [{
    "class": "row between"
  }], [domView.element("span", [], [domView.fragment([tr("selected"), " "]), domView.element("strong", [{
    "data-budget-amount": item.id
  }], [money(budgetAmount(item))], false)], false), domView.element("span", [{
    "data-budget-percent": item.id
  }], [domView.fragment([item.range_percent || 0, "%"])], false)], false), domView.element("input", [{
    "type": "range"
  }, {
    "min": "0"
  }, {
    "max": "100"
  }, {
    "step": "1"
  }, {
    "value": item.range_percent || 0
  }, {
    "data-budget-range": item.id
  }, {
    "aria-label": domView.text([tr("budget_to_luxury_for"), " ", item.label])
  }, {
    "aria-valuetext": money(budgetAmount(item))
  }, domView.spread(disabled ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')], [], false), domView.element("div", [{
    "class": "row between budget-range-labels"
  }], [domView.element("span", [], [domView.fragment([tr("budget"), " ", money(item.min_amount_cents)])], false), domView.element("span", [], [domView.fragment([tr("luxury"), " ", money(item.max_amount_cents)])], false)], false)], false) : ''])], false);
}
function budgetRow(item, depth = 0) {
  if (depth > 8) return '';
  const children = state.data.budget.filter(x => x.parent_id === item.id), open = state.openCosts.has(item.id), amount = budgetLineTotal(item, state.data.budget);
  return domView.element("div", [{
    "class": domView.text(["budget-row ", Number(item.is_optional) ? 'optional-budget-row' : ''])
  }, {
    "data-budget-row": item.id
  }, {
    "tabindex": "-1"
  }], [domView.element("div", [{
    "class": "budget-line"
  }], [domView.element("button", [{
    "class": "budget-disclosure"
  }, {
    "data-action": children.length ? 'toggle-cost' : 'cost'
  }, {
    "data-id": item.id
  }, domView.spread(children.length ? domView.attributes([{
    "aria-expanded": open
  }]) : '')], [children.length ? domView.element("span", [{
    "class": "budget-foldout"
  }], [icon(open ? 'down' : 'right')], false) : '', domView.element("div", [], [domView.element("h3", [], [domView.fragment([item.label, item.relationship_origin === 'auto' ? domView.element("span", [{
    "class": "tag"
  }], [tr("auto_linked")], false) : '', Number(item.included) ? domView.element("span", [{
    "class": "tag"
  }], [tr("included_in_parent")], false) : '', Number(item.is_optional) ? domView.element("span", [{
    "class": "tag"
  }], [tr("optional")], false) : ''])], false), domView.element("p", [], [domView.fragment([item.vendor || tr("vendor_to_be_confirmed"), children.length ? domView.concat(' · ', tr('subquote_count', {
    count: children.length
  })) : '', budgetIsRange(item) ? tr('price_range_suffix') : item.kind === 'estimate' ? tr('estimate_suffix') : ''])], false)], false)], false), domView.element("div", [{
    "class": "row"
  }], [domView.element("span", [{
    "class": "amount"
  }, {
    "data-budget-line-total": item.id
  }], [amount === null ? tr("to_be_specified") : money(amount)], false), domView.element("button", [{
    "class": "budget-source"
  }, {
    "data-action": "cost"
  }, {
    "data-id": item.id
  }, {
    "aria-label": domView.text([tr("view_details_of"), " ", item.label])
  }], [icon('search')], false)], false)], false), domView.fragment([budgetChoiceControls(item), children.length && open ? domView.element("div", [{
    "class": "budget-children"
  }], [domView.join(children.map(x => budgetRow(x, domView.concat(depth, 1))), '')], false) : ''])], false);
}
function toggleBudgetLine(button) {
  const id = button.dataset.id, open = !state.openCosts.has(id), area = button.closest('.slide-area'), scrollTop = area?.scrollTop;
  if (open) state.openCosts.add(id); else state.openCosts.delete(id);
  const children = state.data.budget.filter(item => item.parent_id === id);
  document.querySelectorAll(domView.text(["[data-budget-row=\"", CSS.escape(id), "\"]"])).forEach(row => {
    row.querySelector(':scope > .budget-children')?.remove();
    const disclosure = row.querySelector(':scope > .budget-line .budget-disclosure');
    disclosure.setAttribute('aria-expanded', String(open));
    domView.mount(disclosure.querySelector('.budget-foldout'), icon(open ? 'down' : 'right'));
    if (open) {
      let depth = 1, parent = row.parentElement.closest('.budget-row');
      while (parent) {
        depth++;
        parent = parent.parentElement.closest('.budget-row');
      }
      domView.insert(row, 'beforeend', domView.element("div", [{
        "class": "budget-children"
      }], [domView.join(children.map(item => budgetRow(item, depth)), '')], false));
    }
  });
  if (area) area.scrollTop = scrollTop;
}
function budgetChart() {
  return domView.join(state.data.budget.map((item, n) => {
    const amount = !Number(item.included) && budgetEnabled(item, state.data.budget) ? Math.max(0, budgetAmount(item) || 0) : 0;
    if (!amount) return '';
    const label = tr('studio_go_to_budget_cost', {
      v0: item.label,
      v1: money(amount)
    });
    return domView.element("button", [{
      "type": "button"
    }, {
      "class": "budget-chart-segment"
    }, {
      "data-action": "budget-jump"
    }, {
      "data-id": item.id
    }, {
      "style": domView.text(["flex:", amount, ";--segment-opacity:", domView.concat(.4, n % 5 * .15)])
    }, {
      "aria-label": label
    }, {
      "title": domView.concat(domView.concat(item.label, ' · '), money(amount))
    }], [], false);
  }), '');
}
function jumpToBudgetItem(button) {
  const layout = button.closest('.budget-layout'), items = state.data.budget, ancestors = [], seen = new Set([button.dataset.id]);
  let item = items.find(item => item.id === button.dataset.id);
  while (item?.parent_id && !seen.has(item.parent_id)) {
    seen.add(item.parent_id);
    ancestors.unshift(item.parent_id);
    item = items.find(parent => parent.id === item.parent_id);
  }
  for (const id of ancestors) {
    const disclosure = layout?.querySelector(domView.text(["[data-budget-row=\"", CSS.escape(id), "\"] > .budget-line [data-action=\"toggle-cost\"]"]));
    if (disclosure?.getAttribute('aria-expanded') === 'false') toggleBudgetLine(disclosure);
  }
  const row = layout?.querySelector(domView.text(["[data-budget-row=\"", CSS.escape(button.dataset.id), "\"]"]));
  if (row) scrollToBudgetRow(row);
}
const startingSubquoteChecks = new Set();
function subquoteCheckModal() {
  const iteration = state.data.iteration.id, busy = startingSubquoteChecks.has(iteration);
  openModal(tr('check_subquotes'), domView.element("div", [{
    "class": "subquote-check-intro"
  }, {
    "data-subquote-check": iteration
  }], [domView.element("img", [{
    "class": "subquote-check-art"
  }, {
    "src": "assets/subquote-check.svg"
  }, {
    "alt": domView.text([])
  }, {
    "width": "320"
  }, {
    "height": "190"
  }], [], false), domView.element("h3", [], [tr('studio_subquote_intro_title')], false), domView.element("p", [{
    "class": "subquote-check-description"
  }], [tr('studio_subquote_intro_description')], false), domView.element("div", [{
    "class": "subquote-check-details"
  }], [domView.element("p", [], [icon('link'), domView.element("span", [], [tr('studio_subquote_intro_automatic')], false)], false), domView.element("p", [], [icon('chat'), domView.element("span", [], [tr('studio_subquote_intro_review')], false)], false)], false), domView.element("p", [{
    "class": "form-hint subquote-check-background"
  }], [tr('studio_subquote_intro_background')], false), domView.element("p", [{
    "class": "form-error"
  }, {
    "data-subquote-check-error": domView.text([])
  }, {
    "role": "alert"
  }, {
    "hidden": domView.text([])
  }], [], false), domView.element("div", [{
    "class": "modal-footer"
  }], [domView.fragment([button(tr('cancel'), 'close-modal', 'ghost'), button(tr(busy ? 'studio_subquote_starting' : 'studio_subquote_start'), 'start-subquote-check', 'primary', domView.attributes([{
    "data-iteration": iteration
  }, domView.spread(busy || pending() || !editable() || !state.data.capabilities.ai ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')]), 'spark')])], false)], false));
}
async function startSubquoteCheck(el) {
  const iteration = el.dataset.iteration;
  if (iteration !== state.data?.iteration.id || startingSubquoteChecks.has(iteration) || pending() || !editable() || !state.data.capabilities.ai) return;
  startingSubquoteChecks.add(iteration);
  el.disabled = true;
  el.textContent = tr('studio_subquote_starting');
  const dialog = () => {
    const node = document.querySelector('[data-subquote-check]');
    return node?.dataset.subquoteCheck === iteration ? node : null;
  };
  const error = dialog()?.querySelector('[data-subquote-check-error]');
  if (error) error.hidden = true;
  try {
    await api('match_subquotes', {
      iteration
    });
    if (dialog()) closeModal();
    if (state.data?.iteration.id === iteration) {
      await refresh();
      toast(tr('studio_checking_relationships_across_your_quote_files'));
    }
  } catch (error) {
    const message = dialog()?.querySelector('[data-subquote-check-error]');
    if (message) {
      message.textContent = error.message;
      message.hidden = false;
    } else toast(error.message);
  } finally {
    startingSubquoteChecks.delete(iteration);
    const start = dialog()?.querySelector('[data-action="start-subquote-check"]');
    if (start) {
      start.disabled = pending() || !editable() || !state.data.capabilities.ai;
      domView.mount(start, domView.concat(icon('spark'), tr('studio_subquote_start')));
    }
  }
}
function subquoteReview() {
  if (!editable()) return '';
  const matches = state.data.subquote_suggestions || [], automatic = state.data.budget.filter(x => x.relationship_origin === 'auto');
  const check = state.data.subquote_check;
  return domView.text(["", check?.warning ? domView.element("p", [{
    "class": "notice"
  }], [check.warning], false) : check && !pending() ? domView.element("p", [{
    "class": "budget-choice-notice"
  }], [tr("studio_subquote_check_complete_new_quote_uploads_are_checked_automatically")], false) : '', "", automatic.length ? domView.element("p", [{
    "class": "budget-choice-notice"
  }], [tr("studio_subquote_linked_automatically_open_a_cost_to_see_the_source_evidence_or_undo_its_link", {
    v0: automatic.length,
    v1: automatic.length === 1 ? ' was' : 's were'
  })], false) : '', "", matches.length ? domView.element("section", [{
    "class": "subquote-review"
  }], [domView.element("h3", [], [domView.fragment([tr("studio_possible_subquotes"), " "]), domView.element("span", [{
    "class": "tag"
  }], [matches.length], false)], false), domView.element("p", [], [tr("studio_the_source_doesn_t_make_the_relationship_certain_these_costs_stay_separate_until_you_choose")], false), domView.join(matches.map(m => domView.element("article", [], [domView.element("strong", [], [domView.fragment([m.child_label, " → ", m.parent_label])], false), domView.element("details", [], [domView.element("summary", [], [tr("studio_why_these_may_belong_together")], false), domView.element("p", [{
    "class": "subquote-evidence"
  }], [m.evidence], false)], false), domView.element("div", [{
    "class": "row wrap"
  }], [domView.fragment([button(tr("studio_included_in_parent_total"), 'review-subquote', 'small', domView.attributes([{
    "data-id": m.id
  }, {
    "data-decision": "included"
  }])), button(tr("studio_additional_to_parent_total"), 'review-subquote', 'small', domView.attributes([{
    "data-id": m.id
  }, {
    "data-decision": "additional"
  }])), button(tr("studio_keep_separate"), 'review-subquote', 'small ghost', domView.attributes([{
    "data-id": m.id
  }, {
    "data-decision": "dismiss"
  }]))])], false)], false)), '')], false) : '', ""]);
}
function budgetPage() {
  const d = state.data, items = d.budget, roots = items.filter(x => !x.parent_id && budgetAmount(x) !== null), base = roots.filter(x => !Number(x.is_optional)), options = roots.filter(x => Number(x.is_optional)), unknown = items.filter(x => budgetAmount(x) === null), ranges = items.some(budgetIsRange), interactive = ranges || items.some(x => Number(x.is_optional));
  return domView.fragment([domView.element("div", [{
    "class": "budget-top budget-sticky-summary"
  }], [domView.element("div", [], [domView.element("span", [{
    "class": "eyebrow muted"
  }], [interactive ? tr("your_selected_budget") : tr("known_project_total")], false), domView.element("div", [{
    "class": "budget-total"
  }, {
    "data-budget-total": domView.text([])
  }], [money(budgetTotal(items))], false), ranges ? domView.element("p", [{
    "data-budget-bounds": domView.text([])
  }], [domView.fragment([tr("selected_scope"), " ", money(budgetTotal(items, 0)), " – ", money(budgetTotal(items, 100))])], false) : '', domView.element("p", [], [domView.fragment([unknown.length ? tr('unspecified_costs', {
    count: unknown.length
  }) : tr("based_on_the_recorded_budget"), " · ", iterationLabel(d.iteration)])], false)], false), editable() && !state.present ? domView.element("div", [{
    "class": "row wrap project-tab-actions"
  }], [domView.fragment([state.data.files.filter(f => f.category === 'budget').length >= 2 ? button(pending() ? tr("processing_quotes") : tr("check_subquotes"), 'match-subquotes', 'ghost', pending() || !d.capabilities.ai ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '', 'spark') : '', button(tr("add_cost"), 'add-cost', 'primary', '', 'plus')])], false) : ''], false), domView.element("div", [{
    "class": domView.text(["budget-layout ", state.present ? '' : 'budget-admin-layout'])
  }], [domView.element("section", [], [domView.fragment([!state.present ? subquoteReview() : '', interactive ? domView.element("p", [{
    "class": "budget-choice-notice"
  }, {
    "data-budget-save-status": domView.text([])
  }, {
    "role": "status"
  }], [canChooseBudget() ? tr("options_and_slider_choices_save_automatically_for_this_iteration_and_are_visible_to_your_design_team") : tr("viewing_the_saved_choices_for_this_project")], false) : '', roots.length ? domView.element("div", [{
    "class": "budget-chart"
  }, {
    "data-budget-chart": domView.text([])
  }, {
    "role": "group"
  }, {
    "aria-label": tr("cost_breakdown")
  }], [budgetChart()], false) : '', base.length ? domView.fragment([domView.element("div", [{
    "class": "budget-section-label"
  }], [tr("cost_breakdown")], false), domView.element("div", [{
    "class": "budget-rows"
  }], [domView.join(base.map(x => budgetRow(x)), '')], false)]) : '', options.length ? domView.fragment([domView.element("div", [{
    "class": "budget-section-label"
  }], [tr("optional_additions")], false), domView.element("div", [{
    "class": "budget-rows"
  }], [domView.join(options.map(x => budgetRow(x)), '')], false)]) : '', unknown.length ? domView.element("section", [{
    "class": "unknown-box"
  }], [domView.element("h3", [], [domView.fragment([icon('warning'), tr("still_to_be_specified"), " "]), domView.element("span", [{
    "class": "tag"
  }], [unknown.length], false)], false), domView.element("p", [], [tr("these_items_have_no_recorded_price_yet_their_labels_stay_visible_and_their_cost_is_excluded_from_the_total_until_specified")], false), domView.element("div", [{
    "class": "budget-rows"
  }], [domView.join(unknown.map(x => budgetRow(x)), '')], false)], false) : '', !items.length ? empty(tr("your_budget_starts_with_a_source"), tr("upload_a_quote_or_budget_workbook_or_add_a_cost_yourself"), editable() && !state.present ? 'add-cost' : '', editable() && !state.present ? tr("add_a_cost") : '') : '']), domView.element("p", [{
    "class": "budget-note"
  }], [tr("included_subquotes_are_counted_once_within_their_parent_quote_unselected_options_are_excluded_range_sliders_select_a_planning_amount_check_source_notes_for_vat_exclusions_and_validity")], false)], false), state.present ? chatPanel() : ''], false)]);
}
function updateBudgetChoiceDisplay(message = tr("preview_release_the_slider_to_save")) {
  const items = state.data.budget;
  state.data.total_cents = budgetTotal(items);
  document.querySelectorAll('[data-budget-chart]').forEach(el => domView.mount(el, budgetChart()));
  document.querySelectorAll('[data-budget-total]').forEach(el => el.textContent = money(state.data.total_cents));
  document.querySelectorAll('[data-budget-bounds]').forEach(el => el.textContent = domView.text(["", tr("selected_scope"), " ", money(budgetTotal(items, 0)), " – ", money(budgetTotal(items, 100)), ""]));
  for (const item of items) {
    document.querySelectorAll(domView.text(["[data-budget-line-total=\"", CSS.escape(item.id), "\"]"])).forEach(el => {
      const amount = budgetLineTotal(item, items);
      el.textContent = amount === null ? tr("to_be_specified") : money(amount);
    });
    document.querySelectorAll(domView.text(["[data-budget-amount=\"", CSS.escape(item.id), "\"]"])).forEach(el => el.textContent = budgetAmount(item) === null ? tr("to_be_specified") : money(budgetAmount(item)));
    document.querySelectorAll(domView.text(["[data-budget-percent=\"", CSS.escape(item.id), "\"]"])).forEach(el => el.textContent = domView.text(["", item.range_percent || 0, "%"]));
    document.querySelectorAll(domView.text(["[data-budget-range=\"", CSS.escape(item.id), "\"]"])).forEach(el => {
      el.value = item.range_percent || 0;
      el.setAttribute('aria-valuetext', money(budgetAmount(item)));
    });
    document.querySelectorAll(domView.text(["[data-budget-option=\"", CSS.escape(item.id), "\"]"])).forEach(el => el.checked = !!item.selected);
  }
  document.querySelectorAll('[data-budget-save-status]').forEach(el => el.textContent = message);
}
async function saveBudgetChoice(id, patch) {
  if (budgetChoiceSaving.has(id) || !canChooseBudget()) return;
  const iid = state.data.iteration.id;
  budgetChoiceSaving.add(id);
  document.querySelectorAll(domView.text(["[data-budget-row=\"", CSS.escape(id), "\"] input"])).forEach(el => el.disabled = true);
  updateBudgetChoiceDisplay(tr("saving_your_budget_choices"));
  try {
    const result = await api('budget_choice', {
      iteration: iid,
      id,
      ...patch
    });
    if (state.data?.iteration.id !== iid) return;
    const row = result.budget.find(x => x.id === id);
    const index = state.data.budget.findIndex(x => x.id === id);
    if (index >= 0 && row) state.data.budget[index] = row;
    updateBudgetChoiceDisplay(tr("saved_your_design_team_can_see_these_budget_choices"));
  } catch (error) {
    if (state.data?.iteration.id === iid) {
      try {
        await refresh(true);
      } catch {}
      updateBudgetChoiceDisplay(tr("not_saved_please_try_again"));
    }
    toast(error.message);
  } finally {
    budgetChoiceSaving.delete(id);
    if (state.data?.iteration.id === iid) document.querySelectorAll(domView.text(["[data-budget-row=\"", CSS.escape(id), "\"] input"])).forEach(el => el.disabled = !canChooseBudget());
  }
}
document.addEventListener('input', e => {
  const id = e.target.dataset.budgetRange;
  if (!id || !canChooseBudget()) return;
  const item = state.data.budget.find(x => x.id === id);
  if (item) {
    item.range_percent = Number(e.target.value);
    updateBudgetChoiceDisplay();
  }
});
document.addEventListener('change', e => {
  const range = e.target.dataset.budgetRange, option = e.target.dataset.budgetOption, id = range || option;
  if (!id || !canChooseBudget()) return;
  const item = state.data.budget.find(x => x.id === id);
  if (!item) return;
  const patch = range ? {
    range_percent: Number(e.target.value)
  } : {
    selected: e.target.checked
  };
  Object.assign(item, patch);
  saveBudgetChoice(id, patch);
});
function downloadFile(id) {
  return state.data.files.flatMap(f => [f, ...f.history || []]).find(f => f.id === id) || ({
    id,
    get name() {
      return tr("source_file");
    }
  });
}
function chatPanel() {
  return domView.element("aside", [{
    "class": "chat-panel"
  }], [domView.element("div", [{
    "class": "chat-heading"
  }], [domView.element("h3", [], [domView.fragment([icon('spark'), tr("project_questions")])], false), domView.element("p", [], [tr("ask_about_costs_scope_and_your_project_reference_documents")], false)], false), domView.element("div", [{
    "class": "chat-body"
  }, {
    "id": "chat-messages"
  }, {
    "data-chat-messages": domView.text([])
  }], [domView.fragment([state.chat.length ? domView.join(state.chat.map(m => domView.element("div", [{
    "class": domView.text(["chat-message ", m.role])
  }], [domView.fragment([m.text, m.citations?.length ? domView.element("div", [{
    "class": "sources"
  }], [domView.join(m.citations.map(c => domView.element("button", [{
    "data-action": "legal-citation"
  }, {
    "data-version": c.version_id
  }, {
    "data-page": c.page
  }], [domView.fragment([fileTypeLogo(c), c.name, " · p. ", c.page])], false)), '')], false) : '', m.sources?.length ? domView.element("div", [{
    "class": "sources"
  }], [domView.join(sortDownloadFiles(m.sources.map(downloadFile)).map(f => domView.element("button", [{
    "data-action": "download"
  }, {
    "data-id": f.id
  }], [domView.fragment([fileTypeLogo(f), f.name])], false)), '')], false) : ''])], false)), '') : domView.element("p", [{
    "class": "chat-empty"
  }], [tr("ask_about_your_project_s_costs_scope_or_studio_terms")], false), state.busy ? domView.element("span", [{
    "class": "loading-inline"
  }, {
    "aria-label": tr("preparing_answer")
  }], [], false) : ''])], false), domView.element("form", [{
    "class": "chat-form"
  }, {
    "data-form": "chat"
  }], [domView.element("input", [{
    "name": "question"
  }, {
    "placeholder": tr("ask_a_question")
  }, {
    "aria-label": tr("ask_about_costs_and_scope")
  }, {
    "required": domView.text([])
  }, {
    "maxlength": "2000"
  }], [], false), domView.element("button", [{
    "aria-label": tr("send_question")
  }, domView.spread(state.busy ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')], [icon('up')], false)], false), domView.element("p", [{
    "class": "chat-footer"
  }], [state.data.capabilities.ai ? tr("ai_answers_check_linked_sources") : tr("budget_helper_ai_connection_not_enabled")], false)], false);
}
function presentationAction(iconName, action, label, classes = '') {
  const id = domView.text(["presentation-tooltip-", action, ""]);
  return domView.element("button", [{
    "type": "button"
  }, {
    "class": domView.text(["icon-button presentation-action ", classes])
  }, {
    "data-action": action
  }, {
    "aria-label": label
  }, {
    "aria-describedby": id
  }], [icon(iconName), domView.element("span", [{
    "class": "presentation-action-tooltip"
  }, {
    "role": "tooltip"
  }, {
    "id": id
  }], [label], false)], false);
}
function renderPresentation() {
  applyPresentationTheme(theme());
  if (state.presentationMode === 'scroll') {
    renderScrollPresentation();
    return;
  }
  stopScrollPresentation();
  scrollImageObserver?.disconnect();
  const defs = slideDefs();
  state.slide = Math.max(0, Math.min(state.slide, defs.length - 1));
  if (!defs.length) {
    domView.mount($('#app'), domView.element("div", [{
      "class": "empty-state"
    }], [domView.element("h1", [], [tr("no_visible_slides")], false), !state.client ? button(tr("back_to_studio"), 'exit-preview') : ''], false));
    return;
  }
  const def = defs[state.slide], d = state.data, t = theme();
  domView.mount($('#app'), domView.element("div", [{
    "class": "presentation"
  }], [domView.fragment([previewBar(), presentationSidebar(sectionIndex(defs), domView.fragment([iconBtn('left', 'prev-slide', tr("previous_slide"), state.slide === 0 ? domView.attributes([{
    "disabled": domView.text([])
  }]) : ''), domView.element("span", [{
    "class": "slide-counter"
  }], [domView.fragment([String(domView.concat(state.slide, 1)).padStart(2, '0'), " / ", String(defs.length).padStart(2, '0')])], false), iconBtn('right', 'next-slide', tr("next_slide"), state.slide === defs.length - 1 ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '')]), {
    branding: domView.element("div", [{
      "class": "presentation-brand"
    }], [brand(), domView.element("small", [{
      "class": "presented-by"
    }], [tr("presented_by_studiodeck")], false)], false),
    identity: domView.element("div", [{
      "class": "presentation-identity"
    }], [domView.element("strong", [], [iterationLabel(d.iteration)], false), domView.element("span", [{
      "class": "project-label"
    }], [domView.fragment([d.project.name, d.project.location ? domView.concat(' · ', d.project.location) : ''])], false)], false),
    actions: domView.fragment([domView.fragment([presentationModeSwitch('slides'), button(tr("your_account"), 'account-menu', 'small', '', 'users')]), domView.element("div", [{
      "class": "presentation-action-row"
    }], [domView.fragment([presentationAction('file', 'project-documents', tr('project_documents')), communication.enabled() ? presentationAction('mail', 'comm-show', communication.t('Communication')) : '', presentationAction('chat', 'feedback', domView.concat(tr('comment_count', {
      count: presentationComments(d).filter(c => c.slide === def.id).length
    }), presentationComments(d).some(c => c.slide === def.id && c.unread) ? tr('unread_suffix') : ''), 'comment-balloon'), presentationAction('expand', 'toggle-fullscreen', tr('show_fullscreen'))])], false), domView.element("button", [{
      "class": "slide-originals"
    }, {
      "data-action": "originals"
    }, {
      "aria-label": tr("source_files")
    }, {
      "title": tr("source_files")
    }], [icon('download'), domView.element("span", [{
      "class": "source-files-label"
    }], [tr("source_files")], false), " ", domView.element("span", [{
      "class": "tag outline"
    }], [slideFiles(def.id).length], false)], false)])
  })]), domView.element("main", [{
    "class": "slide-area"
  }, {
    "id": "main"
  }, {
    "tabindex": "-1"
  }], [slideContent(def.id)], false), !state.client && def.hidden ? domView.element("div", [{
    "class": "slide-hidden-overlay"
  }, {
    "role": "status"
  }], [domView.element("span", [], [domView.fragment([icon('eye-off'), tr("studio_hidden")])], false)], false) : ''], false));
  hydrateImages();
  syncPresentationFullscreen();
  syncPresentationNavigation();
  syncBudgetLayout(d.iteration.id);
  annotations.mount();
  syncCurrentMedia();
  showClientPresentationHelp();
}
function renderScrollPresentation() {
  const position = scrollPosition(), defs = slideDefs();
  state.slide = Math.max(0, Math.min(state.slide, defs.length - 1));
  if (!defs.length) {
    domView.mount($('#app'), domView.element("main", [{
      "id": "main"
    }, {
      "class": "empty-state"
    }], [domView.element("h1", [], [tr('no_visible_slides')], false), domView.fragment([!state.client ? button(tr('back_to_studio'), 'exit-preview') : '', presentationModeSwitch('scroll')])], false));
    stopScrollPresentation();
    return;
  }
  const d = state.data;
  domView.mount($('#app'), scrollPresentation({
    slides: defs,
    groups: currentGroups(),
    project: d.project.name,
    iteration: d.iteration.id,
    branding: brand(),
    preview: previewBar(),
    navigation: sectionIndex(defs),
    actions: domView.text(["", iconBtn('users', 'account-menu', tr('your_account')), "", iconBtn('file', 'project-documents', tr('project_documents')), "", communication.enabled() ? iconBtn('mail', 'comm-show', communication.t('Communication')) : '', "", iconBtn('chat', 'feedback', tr('comment_count', {
      count: presentationComments(d).filter(c => c.slide === defs[state.slide]?.id).length
    })), "", button(tr('source_files'), 'originals', 'small ghost', '', 'download'), "", iconBtn('expand', 'toggle-fullscreen', tr('show_fullscreen')), ""]),
    content: slideContent,
    footer: def => domView.text(["", def.type === 'fullphoto' ? button(tr('zoom_in'), 'magnify-photo', 'small ghost', '', 'expand') : '', "", button(tr('comment_count', {
      count: presentationComments(d).filter(c => c.slide === def.id).length
    }), 'feedback', 'small ghost', '', 'chat'), "", button(tr('source_files'), 'originals', 'small ghost', '', 'download'), "", def.hidden ? domView.element("span", [{
      "class": "tag"
    }], [tr('studio_hidden')], false) : '', ""])
  }));
  mountScrollPresentation({
    selected: defs[state.slide]?.id,
    position,
    canTrack: () => !activeModal && !magnifiedPhoto && !document.querySelector('.annotation-layer.placing'),
    onActive: id => {
      const index = defs.findIndex(def => def.id === id);
      if (index >= 0) {
        const changed = index !== state.slide;
        state.slide = index;
        syncScrollPresentationContext();
        if (changed) syncWorkspaceUrl(true);
      }
    }
  });
  syncPresentationNavigation();
  syncPresentationFullscreen();
  syncBudgetLayout();
  hydrateImages();
  annotations.mount();
  syncCurrentMedia();
}
function syncScrollPresentationContext() {
  syncCurrentMedia();
  const header = $('.scroll-header'), def = slideDefs()[state.slide];
  if (!header || !def) return;
  if (header.dataset.activeSlide === def.id) return;
  header.dataset.activeSlide = def.id;
  const comments = header.querySelector('[data-action="feedback"]'), label = tr('comment_count', {
    count: (state.present ? presentationComments(state.data) : state.data.comments).filter(c => c.slide === def.id).length
  });
  comments?.setAttribute('aria-label', label);
  comments?.setAttribute('title', label);
  const bar = header.querySelector('.preview-bar');
  if (bar) syncPreviewBar(bar);
}
function selectScrollContext(target) {
  const section = target.closest('[data-scroll-slide]');
  if (!section) return;
  const index = slideDefs().findIndex(def => def.id === section.dataset.scrollSlide);
  if (index >= 0) {
    state.slide = index;
    syncScrollPresentationContext();
  }
}
for (const type of ['click', 'pointerdown', 'focusin', 'change', 'submit']) document.addEventListener(type, event => {
  if (state.present && state.presentationMode === 'scroll' && !activeModal && !magnifiedPhoto) selectScrollContext(event.target);
}, true);
function setPresentationMode(mode) {
  if (!['slides', 'scroll'].includes(mode) || mode === state.presentationMode) return;
  const id = slideDefs()[state.slide]?.id;
  state.presentationMode = mode;
  if (mode === 'scroll') {
    state.inspectHidden = false;
    state.hiddenPreview = '';
    state.slide = Math.max(0, slideDefs().findIndex(def => def.id === id));
  }
  render();
  (mode === 'slides' ? document.querySelector('.presentation-sidebar-handle') : document.querySelector('[data-mode=scroll]'))?.focus({
    preventScroll: true
  });
}
function slideContent(id) {
  const d = state.data, t = theme(), def = slideDefs().find(s => s.id === id);
  if (def?.type === 'video') return videoSlide(def);
  if (def?.type === 'text') return domView.element("section", [{
    "class": "manual-text-slide"
  }], [domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false), domView.element("p", [{
    "class": "slide-description"
  }], [def.record.description], false)], false);
  if (def?.visual) return individualVisualSlide(def);
  if (def?.type === 'intro') {
    const f = photoFiles()[0] || photoFiles('photos')[0] || photoFiles('moodboard')[0];
    return domView.element("section", [{
      "class": "cover-slide"
    }], [domView.element("div", [], [domView.element("p", [{
      "class": "slide-label"
    }], [domView.fragment([tr("a_new_chapter_concept"), " ", String(d.iteration.number).padStart(2, '0')])], false), domView.element("h1", [{
      "class": "slide-heading"
    }], [def.customContent ? def.title : domView.fragment([tr("a_place_to"), domView.element("br", [], [], false), tr("come_home_to")])], false), domView.element("p", [{
      "class": "project-name"
    }], [d.project.name], false), domView.element("p", [{
      "class": "slide-description"
    }], [def.description ?? (d.project.description || tr("an_invitation_to_explore_the_possibilities_for_your_space"))], false), button(tr("explore_your_home"), 'next-slide', 'primary start-presentation', '', 'arrow')], false), domView.element("div", [{
      "class": "cover-slide-image"
    }], [f ? img(f, tr("your_interior_design_concept")) : empty(tr("your_concept_coming_together"), tr("add_a_render_or_a_moodboard_to_bring_this_page_to_life"))], false)], false);
  }
  if (def?.type === 'open-questions') return openItems.slide(def);
  if (def?.type === 'budget') return domView.element("section", [{
    "class": "presentation-budget"
  }], [domView.element("p", [{
    "class": "slide-label"
  }], [tr("a_clear_view_of_the_numbers")], false), domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false), domView.fragment([def.description ? domView.element("p", [{
    "class": "slide-description"
  }], [def.description], false) : '', budgetPage()])], false);
  if (def?.type === 'changes') {
    const delta = d.previous_total_cents !== null ? d.total_cents - d.previous_total_cents : null;
    return domView.fragment([domView.element("p", [{
      "class": "slide-label"
    }], [domView.fragment([tr("making_it_yours_iteration"), " ", d.iteration.number])], false), domView.element("h1", [{
      "class": "slide-heading"
    }], [def.customContent ? def.title : domView.fragment([tr("a_little_closer"), domView.element("br", [], [], false), tr("to_your_kind_of_home_")])], false), def.description ? domView.element("p", [{
      "class": "slide-description"
    }], [def.description], false) : '', domView.element("div", [{
      "class": "changes-grid"
    }], [domView.element("div", [], [d.changes.length ? domView.join(d.changes.map(c => domView.element("div", [{
      "class": "change-item"
    }], [domView.element("span", [{
      "class": "change-mark"
    }], [icon(c.type === 'added' ? 'plus' : c.type === 'removed' ? 'minus' : 'check')], false), domView.element("span", [], [c.name], false), domView.element("span", [{
      "class": "tag outline"
    }], [['added', 'updated', 'removed'].includes(c.type) ? tr(c.type) : c.type], false)], false)), '') : domView.element("p", [{
      "class": "slide-description"
    }], [d.iteration.number === 1 ? tr("this_is_the_first_concept_future_iterations_will_show_what_has_changed_here") : tr("no_source_files_have_changed_since_the_previous_iteration")], false), domView.element("p", [{
      "class": "budget-note"
    }], [tr("all_unchanged_files_carry_forward_earlier_iterations_remain_available_in_your_studio")], false)], false), domView.element("aside", [{
      "class": "change-card"
    }], [domView.element("h3", [], [tr("budget_movement")], false), domView.element("strong", [], [delta === null ? tr("first_concept") : domView.concat(delta > 0 ? '+' : '', money(delta))], false), domView.element("p", [], [delta === null ? tr("your_starting_point_for_the_project") : tr("compared_with_the_previous_iteration_s_known_costs")], false), domView.element("p", [], [tr('remaining_costs', {
      count: d.budget.filter(x => budgetAmount(x) === null).length
    })], false)], false)], false)]);
  }
  if (def?.type === 'contacts') return domView.fragment([domView.element("p", [{
    "class": "slide-label"
  }], [tr("good_design_is_a_conversation")], false), domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false), domView.element("p", [{
    "class": "slide-description"
  }], [def.description ?? tr("a_question_an_idea_a_small_change_we_re_here")], false), domView.element("div", [{
    "class": "presentation-people"
  }], [domView.join(Object.entries(presentationPeople(d)).filter(([, people]) => people.length).map(([group, people]) => domView.element("section", [{
    "class": "presentation-people-group"
  }, {
    "aria-label": ({
      get team() {
        return tr("team_members");
      },
      get clients() {
        return tr("clients");
      },
      get other() {
        return tr("other_people");
      }
    })[group]
  }], [domView.element("h2", [{
    "class": "people-group-title"
  }], [({
    get team() {
      return tr("team_members");
    },
    get clients() {
      return tr("clients");
    },
    get other() {
      return tr("other_people");
    }
  })[group]], false), domView.element("div", [{
    "class": "contacts-grid"
  }], [domView.join(people.map(c => domView.element("article", [{
    "class": "contact-card"
  }], [personAvatar(c.profile, c.name), domView.element("h3", [], [c.name], false), domView.fragment([c.role || group !== 'other' ? domView.element("p", [], [c.role || (group === 'clients' ? tr("client") : tr("design_team"))], false) : '', c.email ? domView.element("a", [{
    "href": domView.text(["mailto:", encodeURIComponent(c.email)])
  }], [domView.fragment([icon('mail'), c.email])], false) : '', c.phone ? domView.element("a", [{
    "href": domView.text(["tel:", c.phone.replace(/[^\d+]/g, '')])
  }], [domView.fragment([icon('phone'), c.phone])], false) : ''])], false)), '')], false)], false)), '')], false)]);
  return domView.fragment([domView.element("p", [{
    "class": "slide-label"
  }], [tr("your_next_chapter")], false), domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false), domView.element("div", [{
    "class": "summary-layout"
  }], [domView.element("div", [], [domView.element("p", [{
    "class": "slide-description"
  }], [def.description ?? tr("take_a_little_time_to_imagine_yourself_here_your_design_the_details_and_the_numbers_are_all_in_one_place")], false), domView.element("div", [{
    "class": "summary-stats"
  }], [domView.element("div", [], [domView.element("strong", [], [money(d.total_cents)], false), domView.element("span", [], [tr("known_investment")], false)], false), domView.element("div", [], [domView.element("strong", [], [d.files.length], false), domView.element("span", [], [tr("source_files")], false)], false)], false), button(tr("share_your_thoughts"), 'feedback', 'primary', '', 'chat'), domView.element("p", [{
    "class": "budget-note"
  }], [domView.fragment([tr('remaining_costs', {
    count: d.budget.filter(x => budgetAmount(x) === null).length
  }), " ", tr('presentation_disclaimer')])], false)], false), domView.element("div", [{
    "class": "download-list"
  }], [domView.element("h3", [], [tr("yours_to_keep")], false), downloadRows(d.files, {
    description: f => domView.text(["", cats[f.category] || tr("source_file"), " · ", tr("version"), " ", f.number, " · ", tr("originals_history"), ""])
  }) || domView.element("p", [{
    "class": "budget-note"
  }], [tr("files_will_appear_here_once_added")], false)], false)], false)]);
}
const showOriginalSlides = new Set(), showGeneratedSlides = new Set(), showMotionComparisons = new Set(), selectedEnhancements = new Map();
installComparisonControls();
installFloorplans();
function enhancementRemaining() {
  return state.data?.enhancements?.remaining ?? (DEMO ? 10 : 0);
}
function enhancementAllowanceMarkup() {
  const a = state.data?.enhancements;
  if (!a) return '';
  const reset = a.resets_at ? new Intl.DateTimeFormat(dateLocale(), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(new Date(a.resets_at)) : '';
  return domView.fragment([domView.element("strong", [], [tr("studio_ai_enhancement_left", {
    v0: a.remaining,
    v1: a.remaining === 1 ? '' : 's'
  })], false), domView.element("span", [], [domView.fragment([a.plan_type === 'project_pass' ? tr("studio_10_included_for_this_project") : domView.concat(domView.concat(domView.text(["", tr("studio_10_per_project_per_month_resets"), " "]), reset), ' (UTC)'), a.reserved ? domView.concat(domView.concat(' · ', a.reserved), domView.text([" ", tr("studio_in_progress_2"), ""])) : ''])], false), a.remaining === 0 ? domView.element("small", [], [tr("studio_your_original_and_saved_enhancements_remain_available")], false) : '']);
}
function enhancementAllowance() {
  return domView.element("div", [{
    "class": "enhancement-allowance"
  }, {
    "data-enhancement-allowance": domView.text([])
  }, {
    "role": "status"
  }], [enhancementAllowanceMarkup()], false);
}
function updateEnhancementAllowance() {
  document.querySelectorAll('[data-enhancement-allowance]').forEach(el => domView.mount(el, enhancementAllowanceMarkup()));
  document.querySelectorAll('[data-enhancement-submit]').forEach(el => el.disabled = enhancementRemaining() <= 0 || !state.data?.capabilities.ai);
}
function imageVariants(def) {
  return def.record?.image_variants || [];
}
function selectedImageVersion(def) {
  return def.record?.image_version_id || '';
}
function selectedSlideVisual(def, original = false) {
  return {
    ...def.visual,
    show_original: original,
    slide_image_version: original ? '' : selectedImageVersion(def)
  };
}
function imageVersionPicker(def) {
  const variants = imageVariants(def), selected = selectedEnhancements.get(def.record?.id) || selectedImageVersion(def);
  if (!variants.length) return '';
  const canApply = editable() && selected !== def.record.image_version_id && !imageWorking(slideImageJob(def.record.id));
  return domView.element("div", [{
    "class": "image-version-picker"
  }], [domView.element("label", [], [domView.element("span", [{
    "class": "sr-only"
  }], [tr("ai_enhanced_version")], false), domView.element("select", [{
    "data-image-variant": def.record.id
  }, {
    "aria-label": tr("ai_enhanced_version")
  }], [domView.join(variants.map((v, n) => domView.element("option", [{
    "value": v.id
  }, domView.spread(v.id === selected ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [domView.fragment([variants.length - n, ". ", v.summary])], false)), '')], false)], false), canApply ? button(tr("use_this_version"), 'use-image-version', 'small', domView.attributes([{
    "data-id": def.record.id
  }, {
    "data-version": selected
  }]), 'check') : ''], false);
}
function slideImageJob(id) {
  return latestSlideImageJob(state.data?.jobs, id);
}
function imageWorking(job) {
  return job && ['queued', 'running'].includes(job.status);
}
function comparisonVisual(def, fullScreen = false) {
  const id = def.record.id, f = selectedSlideVisual(def), value = comparisonPosition(id), original = selectedSlideVisual(def, true);
  return domView.element("div", [{
    "class": "image-comparison"
  }, {
    "data-comparison": id
  }, {
    "style": domView.text(["--comparison:", value, "%"])
  }], ["\n        ", domView.element("div", [{
    "class": "comparison-layer comparison-generated"
  }], [img(f, domView.concat(domView.concat(tr('generated'), ' '), def.title), '', fullScreen ? '' : 'large')], false), "\n        ", domView.element("div", [{
    "class": "comparison-layer comparison-original"
  }], [img(original, domView.concat(domView.concat(tr('original'), ' '), def.title), '', fullScreen ? '' : 'large')], false), "\n        ", domView.element("span", [{
    "class": "comparison-label comparison-label-original"
  }], [tr("original_")], false), domView.element("span", [{
    "class": "comparison-label comparison-label-generated"
  }], [tr("ai_variation")], false), "\n        ", domView.element("span", [{
    "class": "comparison-divider"
  }, {
    "aria-hidden": "true"
  }], [domView.element("span", [], ["‹ ⋮ ›"], false)], false), "\n        ", domView.element("input", [{
    "type": "range"
  }, {
    "min": "0"
  }, {
    "max": "100"
  }, {
    "value": value
  }, {
    "data-comparison-range": id
  }, {
    "aria-label": tr("compare_original_and_ai_variation")
  }, {
    "aria-valuetext": tr('comparison_value', {
      original: value,
      generated: 100 - value
    })
  }], [], false), domView.fragment(["\n        ", !fullScreen ? domView.element("button", [{
    "class": "comparison-zoom icon-button"
  }, {
    "data-action": "magnify-photo"
  }, {
    "aria-label": tr("zoom_in_comparison")
  }], [icon('expand')], false) : '', "\n    "])], false);
}
function comparingImage(def) {
  return !!def.record && showMotionComparisons.has(def.record.id) && !!selectedImageVersion(def) && !showOriginalSlides.has(def.record.id) && !showGeneratedSlides.has(def.record.id);
}
function visualImageArea(def, f, fullScreen = false) {
  const content = comparingImage(def) ? comparisonVisual(def, fullScreen) : fullScreen ? img(f, def.title, '', '') : domView.element("button", [{
    "class": "photo-magnify visual-image-button"
  }, {
    "data-action": "magnify-photo"
  }, {
    "aria-label": domView.text([tr("zoom_in"), ": ", def.title])
  }], [motionPhoto(def, img(f, def.title), {
    enabled: !showOriginalSlides.has(def.record?.id) && (!selectedImageVersion(def) || selectedImageVersion(def) === def.record?.image_version_id)
  }), domView.element("span", [{
    "class": "photo-magnify-hint"
  }], [domView.fragment([icon('expand'), tr("zoom_in")])], false)], false);
  return domView.element("div", [{
    "class": domView.text(["visual-image-area ", fullScreen ? 'fullscreen-image-area' : domView.concat('single-visual ', def.type === 'render' ? 'render-visual' : 'photo-visual')])
  }], [content], false);
}
function individualVisualSlide(def) {
  const r = def.record || ({}), t = theme(), original = showOriginalSlides.has(r.id), f = selectedSlideVisual(def, original);
  const sourceControls = domView.text(["", r.image_version_id ? domView.text(["", button(original ? tr("show_generated_image") : tr("show_original"), 'toggle-slide-original', 'small ghost', domView.attributes([{
    "data-id": r.id
  }]), 'eye'), "", button(comparingImage(def) ? tr("show_generated_image") : tr("compare_original_generated"), 'toggle-slide-comparison', 'small ghost', domView.attributes([{
    "data-id": r.id
  }]), 'image'), ""]) : '', "", button(tr("source_versions"), 'history', 'small ghost', domView.attributes([{
    "data-id": f.id
  }]), 'history'), ""]);
  const caption = domView.element("div", [{
    "class": "image-action-toolbar visual-caption"
  }], [domView.fragment([annotations.toolbar(def), sourceControls])], false);
  if (def.type === 'fullphoto') return domView.fragment([domView.element("section", [{
    "class": "full-photo-slide"
  }], [motionPhoto(def, img(f, def.title), {
    enabled: !original && selectedImageVersion(def) === (def.record.image_version_id || '')
  }), domView.element("div", [{
    "class": "full-photo-copy"
  }], [domView.element("h1", [], [def.title], false), r.description ? domView.element("p", [], [r.description], false) : ''], false)], false), domView.element("div", [{
    "class": "full-photo-versions image-action-toolbar"
  }], [domView.fragment([annotations.toolbar(def), r.image_version_id ? button(original ? tr("show_generated_image") : tr("show_original"), 'toggle-slide-original', 'small ghost', domView.attributes([{
    "data-id": r.id
  }]), 'eye') : ''])], false)]);
  if (def.type === 'floorplan') return domView.fragment([domView.element("div", [{
    "class": "render-top"
  }], [domView.element("div", [], [domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false)], false)], false), domView.element("section", [{
    "class": "floorplan-interactive"
  }], [domView.element("div", [{
    "class": "floorplan-controls"
  }], [domView.element("span", [], [tr("explore_the_floorplan")], false), domView.element("div", [{
    "class": "row"
  }], [domView.element("button", [{
    "class": "icon-button"
  }, {
    "type": "button"
  }, {
    "data-plan-zoom": "-.25"
  }, {
    "aria-label": tr("zoom_floorplan_out")
  }], [icon('minus')], false), domView.element("output", [{
    "aria-live": "polite"
  }], ["100%"], false), domView.element("button", [{
    "class": "icon-button"
  }, {
    "type": "button"
  }, {
    "data-plan-zoom": ".25"
  }, {
    "aria-label": tr("zoom_floorplan_in")
  }], [icon('plus')], false), domView.element("button", [{
    "class": "button small"
  }, {
    "type": "button"
  }, {
    "data-plan-zoom": "fit"
  }], [tr("fit_to_view")], false)], false)], false), domView.element("div", [{
    "class": "floorplan-viewport"
  }, {
    "tabindex": "0"
  }, {
    "role": "region"
  }, {
    "aria-label": tr("floorplan_zoom_with_plus_or_minus_drag_or_use_arrow_keys_to_pan")
  }], [domView.element("div", [{
    "class": "floorplan-image"
  }], [img(f, def.title, domView.attributes([{
    "draggable": "false"
  }, {
    "data-full-size": imageUrl(f, undefined, '')
  }]))], false)], false), domView.element("p", [{
    "class": "form-hint"
  }], [tr("zoom_in_to_explore_details_then_drag_to_pan_keyboard_to_zoom_arrow_keys_to_pan_0_to_fit")], false)], false), caption]);
  if (def.type === 'moodboard') {
    const colors = (r.metadata?.palette || []).map(c => c.hex).filter(c => (/^#[a-f0-9]{6}$/i).test(c));
    return domView.fragment([domView.element("section", [{
      "class": "mood-slide individual-mood"
    }], [domView.element("div", [], [domView.element("p", [{
      "class": "slide-label"
    }], [tr("mood_materials")], false), domView.element("h1", [{
      "class": "slide-heading"
    }], [def.title], false), domView.element("p", [{
      "class": "slide-description"
    }], [r.description || ''], false), domView.element("div", [{
      "class": "swatches"
    }], [domView.join((colors.length ? colors : t.colors).map(c => domView.element("span", [{
      "class": "swatch"
    }, {
      "style": domView.text(["background:", c])
    }, {
      "title": c
    }], [], false)), '')], false)], false), domView.element("div", [{
      "class": "mood-annotation-host"
    }], [domView.element("button", [{
      "class": "photo-magnify mood-magnify"
    }, {
      "data-action": "magnify-photo"
    }, {
      "aria-label": domView.text([tr("zoom_in"), ": ", def.title])
    }], [img(f, def.title, domView.attributes([{
      "class": "mood-image"
    }])), domView.element("span", [{
      "class": "photo-magnify-hint"
    }], [domView.fragment([icon('expand'), tr("zoom_in")])], false)], false)], false)], false), caption]);
  }
  return domView.fragment([domView.element("div", [{
    "class": "render-top"
  }], [domView.element("div", [], [domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false), r.description ? domView.element("p", [{
    "class": "slide-description"
  }], [r.description], false) : ''], false)], false), domView.fragment([f.has_preview || f.mime.startsWith('image/') ? visualImageArea(def, f) : empty(tr("source_document"), tr("download_the_original_to_see_its_contents"), 'download-current', tr("download_original")), caption])]);
}
function editSlideModal(id = '', templates = '') {
  if (!requireDraft()) return;
  const def = editorSlides().find(s => s.id === id || s.record?.id === id), s = def?.record, builtin = !!def && !s, types = builtin ? {
    [def.type]: slideTypeName(def)
  } : {
    ...visualTypes,
    ...!s || Number(s.manual) ? {
      get text() {
        return tr("studio_text");
      },
      get video() {
        return tr("media_video");
      }
    } : {}
  };
  const content = state.data.slide_content?.find(c => c.slide_id === (def?.systemType || id)), selected = s?.type || def?.type || 'fullphoto', sources = visualSlides(state.data).filter(s => s.visual && !s.record?.legacy), sourceFiles = state.data.files.filter(f => f.mime.startsWith('image/') && f.category !== 'legal');
  const form = domView.element("form", [{
    "data-form": "slide-editor"
  }], [domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "slide_id"
  }, {
    "value": s?.id || id
  }], [], false), domView.element("div", [{
    "class": "field-row"
  }], [domView.element("label", [], [tr("studio_slide_type"), domView.element("select", [{
    "name": "type"
  }, {
    "data-manual-type": domView.text([])
  }], [domView.join(Object.entries(types).map(([key, label]) => domView.element("option", [{
    "value": key
  }, domView.spread(key === selected ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [label], false)), '')], false)], false), domView.element("label", [], [tr("studio_group"), domView.element("select", [{
    "name": "section"
  }], [domView.join(Object.entries(currentGroups()).map(([key, label]) => domView.element("option", [{
    "value": key
  }, domView.spread(key === (def?.section || state.slideGroup || 'story') ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [label], false)), '')], false)], false)], false), domView.element("label", [], [tr("studio_title"), domView.element("input", [{
    "name": "title"
  }, {
    "value": s?.title || content?.title || ({
      get intro() {
        return tr("studio_a_place_to_come_home_to");
      },
      get changes() {
        return tr("studio_a_little_closer_to_your_kind_of_home");
      },
      get budget() {
        return tr("studio_the_investment");
      },
      get contacts() {
        return tr("studio_your_project_team");
      },
      get summary() {
        return tr("studio_everything_together");
      }
    })[def?.systemType || def?.id] || def?.title || ''
  }, {
    "maxlength": "160"
  }, {
    "placeholder": tr("studio_a_new_perspective")
  }, {
    "required": domView.text([])
  }], [], false)], false), domView.element("label", [], [builtin ? tr("studio_introduction_text") : tr("studio_text_caption"), domView.element("textarea", [{
    "name": "description"
  }, {
    "rows": "4"
  }, {
    "maxlength": "1600"
  }, {
    "placeholder": tr("studio_add_a_short_introduction_or_describe_this_slide")
  }], [s?.description || content?.description || ''], false)], false), domView.fragment([!builtin ? domView.fragment([domView.element("div", [{
    "data-slide-video-fields": domView.text([])
  }, domView.spread(selected === 'video' ? '' : domView.attributes([{
    "hidden": domView.text([])
  }]))], [videoFields(s?.metadata?.video)], false), domView.element("div", [{
    "data-slide-image-fields": domView.text([])
  }, domView.spread(['text', 'video'].includes(selected) ? domView.attributes([{
    "hidden": domView.text([])
  }]) : '')], [s && canMovePhoto(selected) ? button(tr('media_add_motion'), 'photo-motion', 'small', domView.attributes([{
    "data-id": s.id
  }]), 'play') : '', domView.element("label", [], [tr("studio_project_image"), domView.element("select", [{
    "name": "image_source"
  }], [domView.element("option", [{
    "value": domView.text([])
  }], [s?.source_version_id ? tr("studio_keep_current_image") : tr("studio_choose_an_image")], false), domView.fragment([domView.join(sources.map(item => domView.element("option", [{
    "value": domView.text(["slide:", item.record.id])
  }], [domView.fragment([item.title, " · ", item.visual.source_name || item.visual.name])], false)), ''), domView.join(sourceFiles.map(f => domView.element("option", [{
    "value": domView.text(["file:", f.id])
  }], [tr("studio_original_image", {
    v1: f.name
  })], false)), '')])], false)], false), domView.element("div", [{
    "class": "slide-upload-field"
  }], [domView.element("div", [{
    "class": "slide-upload-label"
  }], [domView.element("label", [{
    "for": "slide-photo-upload"
  }], [tr("studio_or_upload_a_photo")], false), domView.element("span", [{
    "class": "logo-help"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "icon-button"
  }, {
    "aria-label": tr("studio_or_upload_a_photo")
  }, {
    "aria-describedby": "slide-photo-upload-tooltip"
  }], [icon('help')], false), domView.element("span", [{
    "role": "tooltip"
  }, {
    "id": "slide-photo-upload-tooltip"
  }], [tr("studio_jpg_png_or_webp_up_to_100_mb_a_new_upload_takes_priority_over_the_selected_image")], false)], false)], false), domView.element("input", [{
    "id": "slide-photo-upload"
  }, {
    "name": "image"
  }, {
    "type": "file"
  }, {
    "accept": "image/jpeg,image/png,image/webp"
  }, {
    "aria-describedby": "slide-photo-upload-tooltip"
  }], [], false)], false), domView.element("label", [], [tr("studio_situation"), domView.element("select", [{
    "name": "situation"
  }], [domView.join(Object.entries(situations).map(([key, label]) => domView.element("option", [{
    "value": key
  }, domView.spread(key === (s?.situation || 'unknown') ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [label], false)), '')], false)], false)], false)]) : domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_system_slides_shared_edit_hint")], false), formFooter(id ? tr("studio_save_slide") : tr("studio_create_slide"))])], false);
  const tabs = domView.element("div", [{
    "class": "add-slide-tabs"
  }, {
    "role": "tablist"
  }, {
    "aria-label": tr("studio_add_slide_method")
  }], [domView.join([['manual', tr("studio_add_manually")], ['template', tr("studio_add_from_studio_template")], ['system', tr("studio_system_slides")]].map(([key, label]) => domView.element("button", [{
    "type": "button"
  }, {
    "role": "tab"
  }, {
    "id": domView.text(["add-slide-tab-", key])
  }, {
    "aria-controls": domView.text(["add-slide-panel-", key])
  }, {
    "aria-selected": key === 'manual'
  }, {
    "tabindex": key === 'manual' ? 0 : -1
  }, {
    "data-action": "add-slide-tab"
  }, {
    "data-tab": key
  }], [label], false)), '')], false);
  const removed = id ? [] : presentationSlides(state.data, {
    includeHidden: true,
    includeDeleted: true
  }).filter(s => s.deleted && !s.systemType);
  const restore = removed.length ? domView.element("section", [{
    "class": "removed-slides"
  }], [domView.element("h3", [], [tr("studio_removed_slides")], false), domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_restore_removed_slide_hint")], false), domView.join(removed.map(s => domView.element("div", [{
    "class": "row between wrap"
  }], [domView.element("p", [], [domView.fragment([s.title, " "]), domView.element("span", [{
    "class": "muted"
  }], [domView.fragment(["· ", slideTypeName(s)])], false)], false), button(tr("restore"), 'restore-slide', 'small', domView.attributes([{
    "data-id": s.id
  }]), 'history')], false)), '')], false) : '';
  const systems = domView.fragment([domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_system_slides_hint")], false), domView.element("div", [{
    "class": "system-slide-list"
  }], [domView.join(systemSlides().map(s => domView.element("article", [{
    "class": "system-slide-option"
  }], [domView.element("span", [{
    "class": "system-slide-icon"
  }], [icon(s.icon)], false), domView.element("div", [], [domView.element("h3", [], [slideTypeName(s)], false), domView.element("p", [], [tr(domView.concat(domView.concat('studio_system_slide_', s.type.replaceAll('-', '_')), '_description'))], false)], false), button(tr("studio_add_slide"), 'add-system-slide', 'small', domView.attributes([{
    "data-type": s.type
  }, {
    "aria-label": tr('studio_add_system_slide_named', {
      name: slideTypeName(s)
    })
  }]), 'plus')], false)), '')], false)]);
  openModal(id ? tr("studio_edit_slide_2") : tr("studio_add_slide"), id ? form : domView.fragment([tabs, domView.element("div", [{
    "id": "add-slide-panel-manual"
  }, {
    "role": "tabpanel"
  }, {
    "aria-labelledby": "add-slide-tab-manual"
  }], [domView.fragment([restore, form])], false), domView.element("div", [{
    "id": "add-slide-panel-template"
  }, {
    "role": "tabpanel"
  }, {
    "aria-labelledby": "add-slide-tab-template"
  }, {
    "tabindex": "0"
  }, {
    "hidden": domView.text([])
  }], [templates || domView.element("p", [{
    "class": "notice"
  }], [tr("studio_no_studio_templates_are_available_to_add_to_this_project")], false)], false), domView.element("div", [{
    "id": "add-slide-panel-system"
  }, {
    "role": "tabpanel"
  }, {
    "aria-labelledby": "add-slide-tab-system"
  }, {
    "tabindex": "0"
  }, {
    "hidden": domView.text([])
  }], [systems], false)]), !id);
}
function selectAddSlideTab(key) {
  const tabs = [...document.querySelectorAll('.add-slide-tabs [role=tab]')];
  for (const tab of tabs) {
    const selected = tab.dataset.tab === key;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
  }
  tabs.find(tab => tab.dataset.tab === key)?.focus();
}
document.addEventListener('keydown', e => {
  if (!e.target.matches('[data-action=add-slide-tab]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const tabs = [...document.querySelectorAll('.add-slide-tabs [role=tab]')], index = tabs.indexOf(e.target), next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : domView.concat(domView.concat(index, e.key === 'ArrowRight' ? 1 : -1), tabs.length) % tabs.length;
  selectAddSlideTab(tabs[next].dataset.tab);
});
document.addEventListener('change', e => {
  if (e.target.matches('[data-manual-type]')) {
    const form = e.target.form;
    form.querySelector('[data-slide-image-fields]')?.toggleAttribute('hidden', ['text', 'video'].includes(e.target.value));
    form.querySelector('[data-slide-video-fields]')?.toggleAttribute('hidden', e.target.value !== 'video');
    const url = form.querySelector('[name=video_url]');
    if (url) url.required = false;
  }
});
function imagePromptForm(form, hidden) {
  return domView.fragment([domView.element("p", [], [tr("studio_every_variation_starts_from_the_original_image_choose_a_starting_point_then_adjust_the_prompt_if_you")], false), domView.fragment([enhancementAllowance(), !state.data.capabilities.ai ? domView.element("p", [{
    "class": "notice"
  }], [tr("studio_image_enhancement_is_temporarily_unavailable")], false) : '']), domView.element("form", [{
    "data-form": form
  }], [hidden, domView.element("div", [{
    "class": "ai-preset-buttons"
  }, {
    "role": "group"
  }, {
    "aria-label": tr("studio_image_edit_presets")
  }], [domView.join(Object.entries(imagePresets).map(([key, p]) => domView.element("button", [{
    "type": "button"
  }, {
    "class": domView.text(["button small ", key === 'photorealistic' ? 'active' : ''])
  }, {
    "data-action": "image-preset"
  }, {
    "data-preset": key
  }, {
    "aria-pressed": key === 'photorealistic'
  }], [p.label], false)), '')], false), domView.element("label", [], [tr("studio_what_would_you_like_to_change"), domView.element("textarea", [{
    "name": "prompt"
  }, {
    "rows": "7"
  }, {
    "maxlength": "2000"
  }, {
    "placeholder": customImagePlaceholder()
  }, {
    "required": domView.text([])
  }], [imagePresets.photorealistic.prompt], false)], false), domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_review_ai_variations_before_sharing_a_new_viewpoint_interprets_areas_the_original_image_does_not_sho")], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("cancel"), 'close-modal', 'ghost'), domView.element("button", [{
    "class": "button primary"
  }, {
    "type": "submit"
  }, {
    "data-enhancement-submit": domView.text([])
  }, domView.spread(state.data.capabilities.ai && enhancementRemaining() > 0 ? '' : domView.attributes([{
    "disabled": domView.text([])
  }]))], [tr("studio_create_variation", {
    v9: icon('spark')
  })], false)], false)], false)]);
}
function enhanceSlideModal(id) {
  const s = state.data.slides?.find(s => s.id === id);
  if (!s || !canAiEditSlide(s.type) || !requireDraft()) return;
  openModal(tr("change_with_ai"), imagePromptForm('slide-image-edit', domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "slide_id"
  }, {
    "value": id
  }], [], false)), true);
}
function showClientPresentationHelp() {
  if (!state.present || activeModal || clientPresentationHelpShown) return;
  const key = 'studiodeck.clientPresentationHelp.hidden';
  try {
    if (localStorage.getItem(key) === '1') return;
  } catch {}
  clientPresentationHelpShown = true;
  let hidden = false;
  const showStep = step => {
    openModal(tr(step === 1 ? 'presentation_help_title' : 'presentation_help_options_title'), domView.element("div", [{
      "class": "client-presentation-help"
    }], [domView.element("div", [{
      "class": "presentation-help-progress"
    }, {
      "aria-label": tr('presentation_help_step', {
        step
      })
    }], [domView.element("span", [{
      "class": step === 1 ? 'current' : ''
    }], [], false), domView.element("span", [{
      "class": step === 2 ? 'current' : ''
    }], [], false), domView.element("small", [], [tr('presentation_help_step', {
      step
    })], false)], false), step === 1 ? domView.element("div", [{
      "class": "presentation-help-keys"
    }, {
      "aria-hidden": "true"
    }], [domView.element("kbd", [], ["←"], false), domView.element("kbd", [], ["→"], false)], false) : '', domView.element("p", [], [tr(step === 1 ? 'presentation_help_arrows' : matchMedia('(hover: hover)').matches ? 'presentation_help_options' : 'presentation_help_options_touch')], false), domView.element("label", [{
      "class": "check-label"
    }], [domView.element("input", [{
      "type": "checkbox"
    }, {
      "role": "switch"
    }, {
      "data-presentation-help-hide": domView.text([])
    }, domView.spread(hidden ? domView.attributes([{
      "checked": domView.text([])
    }]) : '')], [], false), tr('presentation_help_dont_show_again')], false), domView.element("div", [{
      "class": "modal-footer"
    }], [domView.fragment([step === 2 ? domView.element("button", [{
      "type": "button"
    }, {
      "class": "button ghost"
    }, {
      "data-presentation-help-back": domView.text([])
    }], [tr('presentation_help_back')], false) : '', step === 1 ? domView.element("button", [{
      "type": "button"
    }, {
      "class": "button primary"
    }, {
      "data-presentation-help-next": domView.text([])
    }], [tr('presentation_help_next'), icon('right')], false) : button(tr('dismiss'), 'close-modal', 'primary')])], false)], false));
    $('[data-presentation-help-hide]').addEventListener('change', event => {
      hidden = event.target.checked;
      try {
        if (hidden) localStorage.setItem(key, '1'); else localStorage.removeItem(key);
      } catch {}
    });
    $('[data-presentation-help-next]')?.addEventListener('click', () => showStep(2));
    $('[data-presentation-help-back]')?.addEventListener('click', () => showStep(1));
    const focusTimer = setTimeout(() => $('.client-presentation-help .modal-footer .primary')?.focus(), 20);
    clientPresentationHelpCleanup = () => {
      clearTimeout(focusTimer);
      clientPresentationHelpCleanup = null;
    };
    if (step !== 2) return;
    const sidebar = $('.presentation-sidebar'), handle = $('.presentation-sidebar-handle'), backdrop = $('.modal-backdrop'), modal = $('.modal');
    if (!handle) return;
    sidebar.classList.add('presentation-help-target');
    backdrop.classList.add('presentation-help-spotlight');
    const highlight = document.createElement('div');
    highlight.className = 'presentation-help-highlight';
    highlight.setAttribute('aria-hidden', 'true');
    backdrop.prepend(highlight);
    const position = () => {
      const rect = handle.getBoundingClientRect(), left = domView.concat(rect.right, 26), top = Math.max(12, Math.min(rect.top - 12, innerHeight - modal.offsetHeight - 12));
      Object.assign(highlight.style, {
        left: domView.text(["", rect.left - 5, "px"]),
        top: domView.text(["", rect.top - 5, "px"]),
        width: domView.text(["", domView.concat(rect.width, 10), "px"]),
        height: domView.text(["", domView.concat(rect.height, 10), "px"])
      });
      Object.assign(modal.style, {
        left: domView.text(["", left, "px"]),
        top: domView.text(["", top, "px"]),
        width: domView.text(["", Math.min(400, innerWidth - left - 16), "px"])
      });
      modal.style.setProperty('--help-pointer-top', domView.text(["", domView.concat(rect.top, rect.height / 2) - top, "px"]));
    };
    const observer = new ResizeObserver(position);
    observer.observe(modal);
    observer.observe(handle);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    position();
    clientPresentationHelpCleanup = () => {
      clearTimeout(focusTimer);
      observer.disconnect();
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      sidebar.classList.remove('presentation-help-target');
      clientPresentationHelpCleanup = null;
    };
  };
  showStep(1);
}
function openModal(title, content, wide = false) {
  motionUi.close();
  clientPresentationHelpCleanup?.();
  if (!activeModal) previousFocus = document.activeElement;
  activeModal = true;
  const close = e('button', {
    type: 'button',
    className: 'icon-button',
    'data-action': 'close-modal',
    'aria-label': tr('close_dialog'),
    title: tr('close_dialog')
  });
  domView.mount(close, icon('close'));
  const dialog = e('section', {
    className: domView.text(["modal ", wide ? 'wide' : '', ""]),
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'modal-title'
  }, [e('div', {
    className: 'modal-header'
  }, [e('h2', {
    id: 'modal-title'
  }, String(title ?? '')), close])]);
  domView.append(dialog, content);
  $('#overlay').replaceChildren(e('div', {
    className: 'modal-backdrop'
  }, dialog));
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('.modal input:not([type="hidden"]),.modal textarea,.modal button')?.focus(), 20);
}
function closeModal(force = false) {
  if (productFeedback.busy() || newProjectWizard?.busy || !force && uploader.busy()) return;
  motionUi.close();
  clientPresentationHelpCleanup?.();
  newProjectWizard = null;
  if (state.settingsOpen) {
    state.settingsOpen = false;
    syncWorkspaceUrl(true);
  }
  activeModal = false;
  domView.mount($('#overlay'), '');
  document.body.style.overflow = '';
  previousFocus?.focus();
}
function formFooter(label = tr("save"), iconName = 'check') {
  return domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("cancel"), 'close-modal', 'ghost'), domView.element("button", [{
    "class": "button primary"
  }, {
    "type": "submit"
  }], [domView.fragment([icon(iconName), label])], false)], false);
}
function requireDraft() {
  if (state.data?.can_edit === false) {
    toast(tr("studio_only_project_team_members_can_edit_this_project"));
    return false;
  }
  if (!editable()) {
    iterationModal();
    return false;
  }
  return true;
}
let newProjectWizard = null;
function wizardSteps(step) {
  return domView.element("ol", [{
    "class": "project-wizard-steps"
  }, {
    "aria-label": tr("studio_create_project_progress")
  }], [domView.join([tr("studio_how_it_works"), tr("studio_project_details"), tr("studio_upload_files")].map((label, index) => domView.element("li", [domView.spread(step === domView.concat(index, 1) ? domView.attributes([{
    "aria-current": "step"
  }]) : '')], [domView.element("span", [], [domView.concat(index, 1)], false), label], false)), '')], false);
}
function prepareAppTourStep(step) {
  closeModal(true);
  state.tab = step === 0 ? 'overview' : 'slides';
  state.present = step >= 4;
  state.slideGroup = '';
  state.slide = step >= 5 ? Math.max(0, slideDefs().findIndex(s => s.id === 'budget')) : 0;
  render();
  if (step === 2) editSlideModal('intro');
  if (step >= 7) feedbackModal();
}
async function beginNewProject() {
  if (!DEMO && state.billing?.needs_onboarding) {
    await billing.action('billing-onboarding');
    const form = $('[data-form="billing-onboard"]');
    if (form) form.dataset.continueProject = '1';
    return;
  }
  if (DEMO || state.capabilities?.platform || await projectAccess.gate()) await newProjectModal();
}
async function newProjectModal(archiveProjectId = '', billingIntent = '') {
  const items = DEMO ? [] : (await api('studio_starting_pack')).items;
  newProjectWizard = {
    archiveProjectId,
    billingIntent,
    details: {
      visibility: 'team'
    },
    items,
    selected: items.filter(i => i.default_enabled).map(i => i.version_id),
    files: [],
    created: null,
    busy: false,
    firstProject: state.studioEmpty
  };
  projectWizardIntro();
}
function projectWizardIntro() {
  const w = newProjectWizard;
  if (!w || w.busy || w.created) return;
  const form = $('[data-form="new-project"]');
  if (form) {
    const data = new FormData(form);
    w.details = Object.fromEntries(data);
    w.selected = data.getAll('pack_version');
  }
  openModal(tr("studio_start_your_project"), domView.fragment([wizardSteps(1), domView.element("p", [], [tr("studio_bring_your_ideas_let_studiodeck_do_the_organising")], false), domView.element("ul", [{
    "class": "wizard-benefits"
  }], [domView.element("li", [], [icon('spark'), domView.element("div", [], [domView.element("strong", [], [tr("studio_a_little_ai_magic")], false), domView.element("p", [], [tr("studio_we_extract_pages_images_and_text_from_your_uploads_then_use_ai_to_create_slides_a_budget_and_an_onli")], false)], false)], false), domView.element("li", [], [icon('edit'), domView.element("div", [], [domView.element("strong", [], [tr("studio_always_yours_to_shape")], false), domView.element("p", [], [tr("studio_add_remove_or_change_slides_whenever_you_wish")], false)], false)], false), domView.element("li", [], [icon('chat'), domView.element("div", [], [domView.element("strong", [], [tr("studio_answers_for_your_customer")], false), domView.element("p", [], [tr("studio_customers_can_ask_ai_about_the_project_and_budget_right_in_the_presentation")], false)], false)], false)], false), domView.element("div", [{
    "class": "modal-footer wizard-footer"
  }], [domView.fragment([button(tr("cancel"), 'close-modal', 'ghost'), button(tr("studio_next_project_details"), 'wizard-details', 'primary', '', 'arrow')])], false)]));
}
function projectWizardDetails() {
  const w = newProjectWizard;
  if (!w || w.busy || w.created) return;
  const d = w.details;
  openModal(tr("studio_start_your_project"), domView.fragment([wizardSteps(2), domView.element("p", [], [tr("studio_first_tell_us_a_little_about_the_project_next_add_your_design_files")], false), domView.element("form", [{
    "data-form": "new-project"
  }], [domView.element("label", [], [tr("studio_project_name"), domView.element("input", [{
    "name": "name"
  }, {
    "value": d.name || ''
  }, {
    "placeholder": tr("studio_familie_van_galen_werkhoven")
  }, {
    "required": domView.text([])
  }, {
    "maxlength": "160"
  }, {
    "autocomplete": "off"
  }], [], false)], false), domView.element("label", [], [domView.fragment([tr("studio_a_short_description"), " "]), domView.element("span", [{
    "class": "muted"
  }], [tr("studio_optional")], false), domView.element("input", [{
    "name": "description"
  }, {
    "value": d.description || ''
  }, {
    "placeholder": tr("studio_a_warm_considered_family_home")
  }, {
    "maxlength": "2000"
  }], [], false)], false), pack.wizard(w.items, w.selected), domView.element("div", [{
    "class": "modal-footer wizard-footer"
  }], [button(tr("studio_back"), 'wizard-intro', 'ghost', '', 'left'), domView.element("button", [{
    "class": "button primary"
  }, {
    "type": "submit"
  }], [tr("studio_next_upload_files", {
    v5: icon('arrow')
  })], false)], false)], false)]));
}
function projectWizardFiles(error = '') {
  const w = newProjectWizard;
  if (!w) return;
  const displayFiles = w.driveSelection ? w.driveSelection.names.map(name => ({
    name,
    size: 0
  })) : w.files;
  openModal(tr("studio_bring_your_ideas_together"), domView.fragment([wizardSteps(3), domView.element("p", [], [domView.fragment([tr("studio_add_files_for"), " "]), domView.element("strong", [], [w.details.name], false), tr("studio_we_ll_extract_the_pages_images_and_text_then_open_your_project_when_processing_finishes")], false), domView.element("form", [{
    "data-form": "new-project-files"
  }], [error ? domView.element("p", [{
    "class": "form-error"
  }, {
    "role": "alert"
  }], [error], false) : '', domView.element("div", [{
    "class": "dropzone wizard-dropzone"
  }, {
    "data-wizard-dropzone": domView.text([])
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "wizard-file-picker"
  }, {
    "data-action": "wizard-browse"
  }], [icon('upload'), domView.element("strong", [], [tr("studio_drop_your_files_here_or_browse")], false), domView.element("span", [], [tr("studio_pdf_powerpoint_excel_images")], false), domView.element("small", [], ['Up to 25 files, 23 MiB total per upload'], false)], false), domView.element("input", [{
    "type": "file"
  }, {
    "id": "wizard-file-input"
  }, {
    "hidden": domView.text([])
  }, {
    "multiple": domView.text([])
  }, {
    "accept": ".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
  }], [], false)], false), button(tr("studio_from_google_drive"), 'wizard-drive', 'ghost', '', 'folder'), domView.element("div", [{
    "class": "wizard-file-list"
  }, {
    "aria-live": "polite"
  }], [displayFiles.length ? domView.fragment([domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_file_selected", {
    v0: displayFiles.length,
    v1: displayFiles.length === 1 ? '' : 's',
    v2: w.driveSelection ? 'Google Drive' : bytes(displayFiles.reduce((total, f) => domView.concat(total, f.size), 0))
  })], false), domView.join(displayFiles.map((f, n) => domView.element("div", [{
    "class": "wizard-file-row"
  }], [icon('file'), domView.element("span", [], [domView.element("strong", [], [f.name], false), domView.element("small", [], [w.driveSelection ? tr("studio_from_google_drive") : bytes(f.size)], false)], false), iconBtn('close', 'wizard-remove-file', tr("studio_remove", {
    v0: f.name
  }), domView.attributes([{
    "data-index": n
  }]))], false)), '')]) : domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_choose_one_or_more_files_you_can_add_more_later")], false)], false), domView.element("div", [{
    "class": "modal-footer wizard-footer"
  }], [!w.created ? button(tr("studio_back"), 'wizard-back', 'ghost', '', 'left') : '', domView.element("button", [{
    "type": "submit"
  }, {
    "name": "finish"
  }, {
    "value": "skip"
  }, {
    "class": "button ghost"
  }], [tr("studio_add_files_later")], false), domView.element("button", [{
    "type": "submit"
  }, {
    "name": "finish"
  }, {
    "value": "upload"
  }, {
    "class": "button primary"
  }, domView.spread(displayFiles.length ? '' : domView.attributes([{
    "disabled": domView.text([])
  }]))], [domView.fragment([icon('arrow'), w.created ? tr("studio_retry_upload") : tr("studio_create_process_files")])], false)], false)], false)]));
  const input = $('#wizard-file-input'), zone = $('[data-wizard-dropzone]');
  input.addEventListener('change', () => addWizardFiles([...input.files]));
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragging');
  });
  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('dragging');
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    addWizardFiles([...e.dataTransfer.files]);
  });
}
function addWizardFiles(files) {
  const w = newProjectWizard;
  if (!w || w.busy) return;
  const next = [...w.files];
  for (const file of files) if (!next.some(f => f.name === file.name && f.size === file.size && f.lastModified === file.lastModified)) next.push(file);
  const unsupported = next.find(f => !(/\.(pdf|pptx?|xlsx?|csv|jpe?g|png|webp)$/i).test(f.name));
  const error = unsupported ? tr("studio_isn_t_a_supported_file_please_choose_pdf_powerpoint_excel_csv_jpg_png_or_webp_files", {
    v0: unsupported.name
  }) : uploadSelectionError(next);
  if (error) {
    projectWizardFiles(error);
    return;
  }
  w.files = next;
  w.driveSelection = null;
  projectWizardFiles();
}
async function finishProjectWizard(skip = false) {
  const w = newProjectWizard;
  if (!w || w.busy) return;
  if (!skip) {
    const error = !w.files.length && !w.driveSelection?.files.length ? tr("studio_choose_at_least_one_file_or_select_add_files_later") : uploadSelectionError(w.files);
    if (error) {
      projectWizardFiles(error);
      return;
    }
  }
  w.busy = true;
  document.querySelectorAll('.modal button,.modal input').forEach(el => el.disabled = true);
  const status = document.createElement('p');
  status.className = 'form-hint';
  status.setAttribute('role', 'status');
  status.textContent = w.created ? tr("studio_opening_your_project") : tr("studio_creating_your_project");
  $('.wizard-file-list').prepend(status);
  try {
    if (!w.created) {
      w.created = await api('create_project', {
        name: w.details.name,
        description: w.details.description,
        visibility: 'team',
        starting_pack: w.selected,
        archive_project_id: w.archiveProjectId,
        billing_intent: w.billingIntent
      });
      if (w.firstProject) onboarding.created(w.created.project_id);
      state.studioEmpty = false;
    }
    state.tab = 'overview';
    await openProject(w.created.project_id, w.created.iteration_id);
    await loadProjects();
    w.busy = false;
    closeModal();
    if (skip) {
      toast(tr("studio_your_project_is_ready_add_files_whenever_you_re_ready"));
      return;
    }
    if (w.driveSelection) await uploadDriveFiles(w.driveSelection, '', '', true); else await uploadFiles(w.files, '', '', true);
  } catch (error) {
    w.busy = false;
    if (processingView.visible) hideProcessing();
    newProjectWizard = w;
    projectWizardFiles(error.message);
  }
}
function iterationModal() {
  if (state.data?.can_edit === false) {
    toast(tr("studio_only_project_team_members_can_create_iterations"));
    return;
  }
  const d = state.data;
  openModal(tr("studio_room_for_the_next_iteration"), domView.fragment([domView.element("p", [], [tr("studio_create_a_new_version_of_your_presentation_all_files_carry_forward_replace_only_what_has_changed", {
    v0: d.file_count ?? d.files.length
  })], false), domView.element("form", [{
    "data-form": "iteration"
  }], [domView.element("label", [], [tr("studio_iteration_name"), domView.element("input", [{
    "name": "title"
  }, {
    "value": "Design development"
  }, {
    "required": domView.text([])
  }, {
    "maxlength": "120"
  }], [], false)], false), domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_current_client_links_stay_attached_to_the_iteration_you_shared")], false), formFooter(tr("studio_create_iteration"), 'plus')], false)]));
}
const filePreviewKind = file => fileType(file) === 'csv' ? 'csv' : (/^(jpe?g|png|webp|gif|svg)$/).test(fileType(file)) ? 'image' : '';
function filePreviewButton(file) {
  const kind = filePreviewKind(file);
  return kind ? iconBtn('eye', domView.concat('preview-', kind), kind === 'csv' ? tr("preview_csv") : tr("preview_image"), domView.attributes([{
    "data-id": file.id
  }])) : '';
}
async function previewFile(id) {
  const file = downloadFile(id), kind = filePreviewKind(file);
  if (!kind) return;
  const label = kind === 'csv' ? 'CSV' : tr('image_lowercase');
  openModal(file.name, domView.fragment([domView.element("div", [{
    "data-file-preview": domView.text([])
  }, {
    "role": "status"
  }], [domView.element("p", [{
    "class": "notice"
  }], [tr('loading_preview', {
    type: label
  })], false)], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("download_original"), 'download', 'primary', domView.attributes([{
    "data-id": id
  }]), 'download')], false)]), true);
  $('.modal').classList.add('file-preview-dialog', domView.concat(kind, '-preview-dialog'));
  const target = $('[data-file-preview]'), params = new URLSearchParams({
    action: 'file',
    id,
    iteration: state.data.iteration.id
  });
  if (kind === 'image') params.set('size', 'large');
  let imageUrl;
  try {
    const response = await (DEMO ? fetch(demoFile(id).url) : platformFetch(params));
    if (!response.ok) throw Error(tr("preview_unavailable"));
    if (kind === 'csv') {
      const text = await response.text();
      if (target.isConnected) {
        target.removeAttribute('role');
        domView.mount(target, csvPreview(text, esc));
      }
    } else {
      imageUrl = URL.createObjectURL(await response.blob());
      const image = new Image();
      image.alt = file.name;
      image.src = safeUrl(imageUrl, 'src');
      await image.decode();
      if (target.isConnected) {
        target.removeAttribute('role');
        target.classList.add('extracted-asset-preview');
        target.replaceChildren(image);
      }
    }
  } catch {
    if (target.isConnected) domView.mount(target, domView.element("p", [{
      "class": "notice"
    }], [tr('preview_failed', {
      type: label
    })], false));
  } finally {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }
}
function downloadRows(files, {title = f => f.name, description = f => domView.text(["", tr("version"), " ", f.number, " · ", tr('saved_versions', {
  count: (f.history || []).length
}), ""]), arrow = 'download'} = {}) {
  return domView.join(sortDownloadFiles(files, title).map(f => domView.element("button", [{
    "class": "download-file-row"
  }, {
    "data-action": "history"
  }, {
    "data-id": f.id
  }], [fileTypeLogo(f), domView.element("span", [{
    "class": "download-file-copy"
  }], [title(f), domView.element("small", [], [description(f)], false)], false), icon(arrow)], false)), '');
}
function projectDocumentsModal() {
  const files = state.data.files.filter(f => f.category === 'legal' || f.studio_reference);
  openModal(tr("project_documents"), domView.fragment([domView.element("p", [], [tr("reference_documents_attached_to_this_presentation_answers_use_these_versions_with_links_to_the_source_pages")], false), domView.element("div", [{
    "class": "download-list"
  }], [downloadRows(files, {
    title: f => f.studio_reference?.title || f.name,
    description: f => domView.text(["", f.name, "", f.studio_reference ? domView.concat(domView.concat(' · ', f.studio_reference.modified ? domView.concat(tr('customised_from_studio_version'), ' ') : domView.concat(tr('studio_version'), ' ')), f.studio_reference.revision) : '', " · ", f.pages?.length ? tr("ready_for_questions") : tr("text_processing_or_unavailable"), ""])
  }) || domView.element("p", [{
    "class": "muted"
  }], [tr("no_reference_documents_attached_yet")], false)], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("ask_about_documents"), 'ask-documents', 'primary', '', 'spark')], false)]));
}
function originalsModal() {
  const id = slideDefs()[state.slide].id;
  openModal(tr("the_files_behind_this_slide"), domView.fragment([domView.element("p", [], [tr("download_the_source_or_explore_its_version_history")], false), domView.element("div", [{
    "class": "download-list"
  }], [downloadRows(slideFiles(id), {
    arrow: 'right'
  }) || domView.element("p", [{
    "class": "budget-note"
  }], [tr("no_source_files_on_this_slide")], false)], false)]));
}
function historyModal(id) {
  const f = state.data.files.find(x => x.id === id);
  if (!f) return;
  openModal(tr("every_version_kept_safe"), domView.fragment([domView.element("p", [], [f.name], false), domView.fragment([domView.join(f.history.map((v, n) => domView.element("div", [{
    "class": "history-item file-history-item"
  }], [fileTypeLogo(v), domView.element("div", [{
    "class": "download-file-copy"
  }], [domView.fragment([tr("version"), " ", v.number, " ", n === 0 ? domView.element("span", [{
    "class": "tag green"
  }], [tr("in_this_iteration")], false) : '']), domView.element("small", [], [domView.fragment([v.enhancement_summary || v.name, n === f.history.length - 1 ? domView.concat(' · ', tr('original_upload')) : ''])], false)], false), domView.fragment([filePreviewButton(v), button(tr("download"), 'download', 'small', domView.attributes([{
    "data-id": v.id
  }]), 'download')])], false)), ''), f.metadata?.generated ? domView.element("p", [{
    "class": "budget-note"
  }], [domView.fragment([tr("ai_change"), " ", f.metadata.prompt])], false) : ''])]));
}
function budgetModal(id = '') {
  const item = state.data.budget.find(x => x.id === id);
  if (id && !item) return;
  if (item && communication.budgetSource(item)) return;
  if (!id) {
    editCostModal({});
    return;
  }
  openModal(item.label, domView.fragment([domView.element("p", [], [item.vendor || tr("vendor_to_be_confirmed")], false), domView.element("div", [{
    "class": "budget-total"
  }], [budgetAmount(item) === null ? tr("to_be_specified") : money(budgetAmount(item))], false), budgetIsRange(item) ? domView.element("p", [], [domView.fragment([tr("source_range"), " ", money(item.min_amount_cents), " – ", money(item.max_amount_cents), " · ", tr('towards_luxury', {
    percent: item.range_percent || 0
  })])], false) : '', domView.element("div", [{
    "class": "row wrap"
  }], [domView.element("span", [{
    "class": "tag"
  }], [['estimate', 'quote', 'unknown'].includes(item.kind) ? tr(item.kind) : item.kind], false), domView.fragment([Number(item.is_optional) ? domView.element("span", [{
    "class": "tag"
  }], [domView.fragment([tr("optional"), " · ", item.selected ? tr("selected") : tr("not_selected")])], false) : '', Number(item.included) ? domView.element("span", [{
    "class": "tag"
  }], [tr("already_included_in_parent")], false) : ''])], false), domView.element("p", [], [item.note || tr("no_additional_source_notes_have_been_recorded")], false), item.relationship_evidence ? domView.element("details", [{
    "class": "subquote-review"
  }], [domView.element("summary", [], [item.relationship_origin === 'auto' ? tr("automatically_linked_source_evidence") : tr("quote_relationship_source_evidence")], false), domView.element("p", [{
    "class": "subquote-evidence"
  }], [item.relationship_evidence], false), editable() && !state.present && item.relationship_origin === 'auto' ? button(tr("undo_automatic_link"), 'unlink-subquote', 'small', domView.attributes([{
    "data-id": item.id
  }])) : ''], false) : '', domView.element("div", [{
    "class": "modal-footer"
  }], [domView.fragment([item.source_version_id ? button(domView.concat(fileTypeLogo(downloadFile(item.source_version_id)), tr("source_quote")), 'download', '', domView.attributes([{
    "data-id": item.source_version_id
  }]), 'download') : '', editable() && !state.present ? button(tr("edit_cost"), 'edit-cost', 'primary', domView.attributes([{
    "data-id": item.id
  }]), 'edit') : state.present ? button(tr("ask_a_question_"), 'feedback', 'primary', '', 'chat') : ''])], false)]));
}
function editCostModal(item) {
  if (item.confirmation) {
    communication.budgetSource(item);
    return;
  }
  if (!requireDraft()) return;
  const excluded = new Set([item.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const x of state.data.budget) if (excluded.has(x.parent_id) && !excluded.has(x.id)) {
      excluded.add(x.id);
      changed = true;
    }
  }
  const type = budgetIsRange(item) ? 'range' : item.amount_cents != null ? 'fixed' : 'unknown';
  openModal(item.id ? tr("studio_refine_this_cost") : tr("studio_make_the_numbers_clearer"), domView.element("form", [{
    "data-form": "budget"
  }], [domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "id"
  }, {
    "value": item.id || ''
  }], [], false), domView.element("label", [], [tr("studio_cost_or_quote"), domView.element("input", [{
    "name": "label"
  }, {
    "value": item.label || ''
  }, {
    "placeholder": tr("studio_custom_kitchen_cabinetry")
  }, {
    "required": domView.text([])
  }, {
    "maxlength": "300"
  }], [], false)], false), domView.element("label", [], [tr("studio_vendor"), domView.element("input", [{
    "name": "vendor"
  }, {
    "value": item.vendor || ''
  }, {
    "maxlength": "200"
  }], [], false)], false), domView.element("label", [], [tr("studio_price_type"), domView.element("select", [{
    "name": "price_type"
  }, {
    "id": "budget-price-type"
  }], [domView.join([['fixed', tr("studio_fixed_price")], ['range', tr("studio_price_range")], ['unknown', tr("still_to_be_specified")]].map(([v, t]) => domView.element("option", [{
    "value": v
  }, domView.spread(v === type ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [t], false)), '')], false)], false), domView.element("div", [{
    "data-budget-fields": "fixed"
  }, domView.spread(type !== 'fixed' ? domView.attributes([{
    "hidden": domView.text([])
  }]) : '')], [domView.element("label", [], [tr("studio_fixed_price_2"), domView.element("input", [{
    "name": "amount"
  }, {
    "type": "number"
  }, {
    "step": "0.01"
  }, {
    "value": item.amount_cents != null ? item.amount_cents / 100 : ''
  }], [], false)], false)], false), domView.element("div", [{
    "class": "field-row"
  }, {
    "data-budget-fields": "range"
  }, domView.spread(type !== 'range' ? domView.attributes([{
    "hidden": domView.text([])
  }]) : '')], [domView.element("label", [], [tr("studio_budget_price"), domView.element("input", [{
    "name": "min_amount"
  }, {
    "type": "number"
  }, {
    "min": "0"
  }, {
    "step": "0.01"
  }, {
    "value": item.min_amount_cents != null ? item.min_amount_cents / 100 : ''
  }], [], false)], false), domView.element("label", [], [tr("studio_luxury_price"), domView.element("input", [{
    "name": "max_amount"
  }, {
    "type": "number"
  }, {
    "min": "0"
  }, {
    "step": "0.01"
  }, {
    "value": item.max_amount_cents != null ? item.max_amount_cents / 100 : ''
  }], [], false)], false)], false), domView.element("label", [{
    "class": "check-label"
  }], [domView.element("input", [{
    "type": "checkbox"
  }, {
    "name": "is_optional"
  }, domView.spread(Number(item.is_optional) ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), tr("studio_optional_item_only_count_when_selected")], false), domView.element("label", [], [tr("studio_status"), domView.element("select", [{
    "name": "kind"
  }], [domView.element("option", [{
    "value": "estimate"
  }, domView.spread(item.kind !== 'quote' ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr("studio_estimate")], false), domView.element("option", [{
    "value": "quote"
  }, domView.spread(item.kind === 'quote' ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr("studio_quoted")], false)], false)], false), domView.element("label", [], [tr("studio_part_of_another_quote"), domView.element("select", [{
    "name": "parent_id"
  }], [domView.element("option", [{
    "value": domView.text([])
  }], [tr("studio_separate_project_cost")], false), domView.join(state.data.budget.filter(x => !excluded.has(x.id) && !x.confirmation).map(x => domView.element("option", [{
    "value": x.id
  }, domView.spread(x.id === item.parent_id ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [x.label], false)), '')], false)], false), domView.element("label", [{
    "class": "check-label"
  }], [domView.element("input", [{
    "name": "included"
  }, {
    "type": "checkbox"
  }, domView.spread(Number(item.included) ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), tr("studio_included_in_the_parent_quote_s_total")], false), domView.element("label", [], [tr("studio_notes_exclusions"), domView.element("textarea", [{
    "name": "note"
  }, {
    "rows": "3"
  }, {
    "maxlength": "2000"
  }], [item.note || ''], false)], false), formFooter(tr("studio_save_cost"))], false));
  syncBudgetPriceFields();
}
function syncBudgetPriceFields() {
  const type = $('#budget-price-type')?.value;
  document.querySelectorAll('[data-budget-fields]').forEach(el => {
    el.hidden = el.dataset.budgetFields !== type;
    el.querySelectorAll('input').forEach(input => {
      input.disabled = el.hidden;
      input.required = !el.hidden;
    });
  });
}
document.addEventListener('change', e => {
  if (e.target.id === 'budget-price-type') syncBudgetPriceFields();
});
function studioLogoUrl() {
  if (DEMO && state.studio?.logo) return state.studio.logo;
  return platformUrl({
    action: 'studio_logo'
  });
}
function imageUploadField(kind, preview, showFormats = true) {
  const avatar = kind === 'avatar';
  return domView.fragment([domView.element("div", [{
    "class": "dropzone project-logo-dropzone"
  }, {
    "data-image-upload": kind
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "project-logo-picker"
  }, {
    "data-image-upload-picker": domView.text([])
  }, {
    "aria-label": avatar ? tr('choose_avatar') : tr('choose_logo')
  }], [domView.element("span", [{
    "class": "project-settings-logo-preview"
  }, {
    "data-image-upload-preview": domView.text([])
  }], [preview], false), domView.element("span", [], [domView.fragment([tr(avatar ? 'drop_photo' : 'drop_logo'), " "]), domView.element("u", [], [tr('browse')], false)], false), showFormats ? domView.element("small", [], [tr('image_formats')], false) : ''], false), domView.element("input", [{
    "type": "file"
  }, {
    "name": avatar ? 'avatar' : 'logo'
  }, {
    "data-image-upload-input": domView.text([])
  }, {
    "accept": "image/png,image/jpeg,image/webp"
  }, {
    "hidden": domView.text([])
  }], [], false)], false), domView.element("p", [{
    "class": "form-hint"
  }, {
    "data-image-upload-status": domView.text([])
  }, {
    "role": "status"
  }], [], false)]);
}
function settingsLogoUpload(studio = false) {
  return domView.element("section", [{
    "class": "project-settings-logo"
  }], ["\n            ", domView.element("div", [{
    "class": "settings-heading"
  }], [domView.element("h3", [], [tr(studio ? 'studio_logo_label' : 'studio_presentation_logo')], false), settingsHelp('logo-priority-tooltip', tr(studio ? 'studio_logo_label' : 'studio_presentation_logo'), domView.join([...studio ? [] : [tr('studio_project_logo_first_then_studio_logo_then_studiodeck')], tr('image_formats'), tr('studio_click_the_logo_to_change_it_changes_are_applied_when_you_save')], '\n'), studio ? tr('studio_setting_help', {
    name: tr('studio_logo_label')
  }) : tr('studio_how_the_presentation_logo_is_chosen'))], false), "\n            ", domView.element("div", [{
    "class": "dropzone project-logo-dropzone"
  }, {
    "data-project-logo-drop": domView.text([])
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "project-logo-picker"
  }, {
    "data-action": "choose-project-logo"
  }, {
    "aria-label": tr(studio ? 'choose_logo' : 'studio_choose_presentation_logo')
  }], [domView.element("span", [{
    "class": "project-settings-logo-preview"
  }, {
    "data-logo-preview": domView.text([])
  }], [studio ? state.studio?.has_logo ? domView.element("img", [{
    "class": "studio-logo"
  }, {
    "src": studioLogoUrl()
  }, {
    "alt": tr('studio_current_studio_logo')
  }], [], false) : defaultBrand() : state.data.branding?.logo ? domView.element("img", [{
    "class": "studio-logo"
  }, {
    "src": state.data.branding.logo
  }, {
    "alt": tr('studio_current_presentation_logo')
  }], [], false) : defaultBrand()], false), domView.element("span", [], [domView.fragment([tr("drop_logo"), " "]), domView.element("u", [], [tr("browse")], false)], false)], false), domView.element("input", [{
    "type": "file"
  }, {
    "id": "project-logo-input"
  }, {
    "name": "logo"
  }, {
    "accept": "image/png,image/jpeg,image/webp"
  }, {
    "hidden": domView.text([])
  }], [], false)], false), "\n            ", domView.element("small", [{
    "data-logo-status": domView.text([])
  }, {
    "role": "status"
  }], [], false), domView.fragment(["\n            ", button(tr(studio ? 'studio_remove_logo' : 'studio_remove_project_logo'), 'clear-project-logo', 'small ghost', (studio ? state.studio?.has_logo : state.data.branding?.has_project_logo) ? '' : domView.attributes([{
    "hidden": domView.text([])
  }])), "\n        "])], false);
}
function settingsHelp(id, label, text, accessibleLabel = tr('studio_setting_help', {
  name: label
})) {
  return domView.element("span", [{
    "class": "settings-help"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "settings-help-button"
  }, {
    "aria-label": accessibleLabel
  }, {
    "aria-describedby": id
  }], [icon('help')], false), domView.element("span", [{
    "class": "settings-help-tooltip"
  }, {
    "role": "tooltip"
  }, {
    "id": id
  }], [text], false)], false);
}
function studioSettings() {
  if (!DEMO && state.studio?.role !== 'admin') {
    openModal(tr("studio_studio_settings_2"), domView.fragment([domView.element("p", [], [domView.element("strong", [], [state.studio?.name || ''], false)], false), domView.element("p", [], [tr("studio_a_studio_admin_can_update_the_name_logo_and_starting_pack")], false)]));
    state.settingsOpen = true;
    syncWorkspaceUrl();
    return;
  }
  const fontHelp = domView.join([tr('studio_font_hint'), domView.text(["", tr('studio_font_classic'), ": ", tr('studio_font_classic_description'), "."]), domView.text(["", tr('studio_font_modern'), ": ", tr('studio_font_modern_description'), "."])], '\n');
  openModal(tr("studio_studio_settings_2"), domView.element("form", [{
    "data-form": "studio-theme"
  }, {
    "class": "studio-settings-content"
  }], [domView.fragment([settingsLogoUpload(true), !DEMO ? domView.element("div", [{
    "class": "notice pack-summary"
  }], [domView.element("div", [{
    "class": "settings-heading"
  }], [domView.element("strong", [], [tr("studio_studio_starting_pack")], false), settingsHelp('studio-pack-help', tr('studio_studio_starting_pack'), tr('studio_reusable_slides_and_client_reference_documents_for_every_new_project'))], false), button(tr("studio_manage_starting_pack"), 'pack-library', 'small')], false) : '', businessTypeField(state.studio?.business_type || 'interior', esc, settingsHelp)]), domView.element("div", [{
    "class": "settings-field"
  }], [domView.element("div", [{
    "class": "settings-heading"
  }], [domView.element("label", [{
    "for": "studio-language"
  }], [tr("studio_language")], false), settingsHelp('studio-language-help', tr('studio_language'), tr('projects_use_the_studio_language_unless_a_project_has_its_own_language'))], false), domView.withProps(languageSelect(state.studio?.language || 'en', false), {
    "id": "studio-language"
  })], false), domView.element("label", [], [tr("studio_studio_name"), domView.element("input", [{
    "name": "name"
  }, {
    "value": state.studio?.name || ''
  }, {
    "maxlength": "100"
  }, {
    "required": domView.text([])
  }], [], false)], false), domView.element("fieldset", [{
    "class": "studio-options"
  }, {
    "aria-labelledby": "studio-font-label"
  }], [domView.element("legend", [], [domView.element("span", [{
    "class": "settings-heading"
  }], [domView.element("span", [{
    "id": "studio-font-label"
  }], [tr('studio_font_style')], false), settingsHelp('studio-font-help', tr('studio_font_style'), fontHelp)], false)], false), domView.element("div", [{
    "class": "studio-font-options"
  }], [domView.join(['serif', 'sans'].map(font => domView.element("label", [{
    "class": domView.text(["studio-choice studio-font-", font])
  }], [domView.element("input", [{
    "type": "radio"
  }, {
    "name": "font"
  }, {
    "value": font
  }, domView.spread(cleanStudioTheme(state.studioTheme).font === font ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), domView.element("strong", [], [tr(font === 'serif' ? 'studio_font_classic' : 'studio_font_modern')], false)], false)), '')], false)], false), formFooter(tr("studio_save_studio_settings"))], false));
  bindSettingsLogoUpload($('[data-form="studio-theme"]'));
  state.settingsOpen = true;
  syncWorkspaceUrl();
}
function commentThreadList(comments, feed = false) {
  const canReply = feed || state.client || state.data?.can_edit !== false;
  return domView.join(commentThreads(comments, commentView).map(({comment: c, replies}) => domView.element("section", [{
    "class": "comment-thread"
  }, {
    "data-thread-id": c.id
  }], [domView.element("article", [{
    "class": domView.text([feed ? 'timeline-item' : 'feedback-item', " comment-card"])
  }, {
    "data-comment-id": c.id
  }], [commentPreview(c), domView.element("div", [{
    "class": "comment-content"
  }], [domView.element("div", [{
    "class": "comment-heading"
  }], [commentAuthor(c), domView.element("div", [{
    "class": "comment-heading-actions"
  }], [canReply ? button(tr("reply"), 'reply-comment', 'small ghost', domView.attributes([{
    "data-id": c.id
  }]), 'chat') : ''], false)], false), domView.fragment([feed ? domView.element("h3", [], [domView.fragment([c.project_name, " · ", tr("iteration"), " ", c.iteration_number])], false) : '', c.annotation ? domView.element("span", [{
    "class": "annotation-label"
  }], [tr(c.annotation.image_version_id ? "pin_on_variation" : "pin_on_original")], false) : ""]), domView.element("p", [{
    "class": "comment-body"
  }], [mentionBody(c.body, c.mentions)], false), domView.fragment([communication.badge(c), editable() && !state.present && c.iteration_id === state.data?.iteration.id ? button(tr("checklist_add"), "checklist-from-comment", "small ghost", domView.attributes([{
    "data-id": c.id
  }])) : '']), domView.element("div", [{
    "class": "comment-status"
  }, domView.spread(c.confirmation ? domView.attributes([{
    "hidden": domView.text([])
  }]) : '')], [button(tr(Number(c.answered) ? "mark_as_unanswered" : "mark_as_answered"), 'toggle-comment-answered', domView.text(["small comment-answered ", Number(c.answered) ? 'is-answered' : '', ""]), domView.attributes([{
    "data-id": c.id
  }, {
    "aria-pressed": !!Number(c.answered)
  }, {
    "aria-label": Number(c.answered) ? tr("mark_as_unanswered") : tr("mark_as_answered")
  }]), 'check')], false)], false)], false), domView.element("div", [{
    "class": "comment-replies"
  }, {
    "aria-label": tr("replies")
  }], [domView.join(replies.map(reply => domView.element("article", [{
    "class": "comment-reply"
  }, {
    "data-comment-id": reply.id
  }], [commentAuthor(reply), domView.element("p", [{
    "class": "comment-body"
  }], [mentionBody(reply.body, reply.mentions)], false), communication.badge(reply)], false)), '')], false)], false)), '');
}
function commentControls() {
  return domView.element("div", [{
    "class": "comment-controls"
  }], [domView.element("button", [{
    "type": "button"
  }, {
    "class": "comment-show-answered"
  }, {
    "role": "switch"
  }, {
    "aria-checked": commentView.showAnswered
  }, {
    "data-action": "show-answered"
  }], [domView.element("span", [{
    "class": "comment-switch"
  }, {
    "aria-hidden": "true"
  }], [], false), tr("show_answered")], false), button(domView.text(["", tr("sort"), " ", commentView.sort === 'newest' ? tr("newest_first") : tr("oldest_first"), ""]), 'sort-comments', 'small', domView.attributes([{
    "title": tr(commentView.sort === 'newest' ? 'switch_sort_oldest' : 'switch_sort_newest')
  }]), commentView.sort === 'newest' ? 'down' : 'up')], false);
}
function saveCommentDrafts() {
  for (const form of document.querySelectorAll('[data-form="comment-reply"]')) commentReplyDrafts.set(form.elements.parent_id.value, form);
}
function restoreCommentDrafts() {
  for (const [id, form] of commentReplyDrafts) {
    const thread = document.querySelector(domView.text(["", activeModal ? '.modal ' : '', "[data-thread-id=\"", CSS.escape(id), "\"]"]));
    if (thread && !thread.querySelector('[data-form="comment-reply"]')) thread.querySelector('.comment-replies').append(form);
  }
}
async function changeCommentView(control, property) {
  const modal = !!control.closest('.modal'), previous = commentView[property], controls = control.closest('.comment-controls').querySelectorAll('button');
  saveCommentDrafts();
  controls.forEach(b => b.disabled = true);
  commentView[property] = property === 'sort' ? previous === 'newest' ? 'oldest' : 'newest' : !previous;
  try {
    if (modal) feedbackModal(); else {
      await loadFeed();
      render();
      restoreCommentDrafts();
    }
  } catch (error) {
    commentView[property] = previous;
    throw error;
  } finally {
    controls.forEach(b => b.disabled = false);
  }
}
async function toggleCommentAnswered(control) {
  const modal = !!control.closest('.modal'), comment = (modal ? state.data.comments : state.feedItems).find(c => c.id === control.dataset.id);
  if (!comment || comment.parent_id) return;
  saveCommentDrafts();
  control.disabled = true;
  try {
    const result = await api('comment_answered', {
      iteration: comment.iteration_id || state.data.iteration.id,
      id: comment.id,
      answered: !Number(comment.answered)
    });
    for (const c of [...state.data?.comments || [], ...state.data?.communication?.comments || [], ...state.feedItems || []]) if (c.id === result.id) c.answered = result.answered;
    annotations.redraw();
    if (modal) feedbackModal(); else {
      await reloadCommentFeed();
      restoreCommentDrafts();
    }
    toast(result.answered ? tr("studio_marked_answered") : tr("studio_comment_reopened"));
  } finally {
    control.disabled = false;
  }
}
function feedbackModal(annotation = null) {
  if (communication.enabled()) {
    communication.feedback(state.present ? slideDefs()[state.slide].id : 'general', annotation);
    return;
  }
  const slide = state.present ? slideDefs()[state.slide].id : 'general', comments = (state.present ? presentationComments(state.data) : state.data.comments).filter(c => c.slide === slide || slide === 'general'), existing = $('[data-form="feedback"]'), draft = existing?.dataset.iteration === state.data.iteration.id && existing.elements.slide.value === slide ? existing.elements.body.value : '';
  annotation ??= existing?.dataset.annotation ? JSON.parse(existing.dataset.annotation) : null;
  saveCommentDrafts();
  const visible = commentThreads(comments, commentView).flatMap(t => [t.comment, ...t.replies]);
  openModal(tr('comment_count', {
    count: comments.length
  }), domView.fragment([domView.fragment([communication.enabled() && !state.present ? button(communication.t('Communication'), 'comm-show', 'small', '', 'chat') : '', state.present ? domView.element("p", [], [slideDefs()[state.slide].title], false) : domView.element("p", [], [tr("comments_on_this_iteration")], false), commentControls()]), domView.element("div", [{
    "class": "feedback-list"
  }], [commentThreadList(comments) || domView.element("p", [{
    "class": "muted"
  }], [comments.length && !commentView.showAnswered ? tr("no_unanswered_comments_turn_on_show_answered_to_include_completed_threads") : tr("no_comments_yet")], false)], false), state.client || state.data.can_edit !== false ? domView.element("form", [{
    "data-form": "feedback"
  }, {
    "data-iteration": state.data.iteration.id
  }, domView.spread(annotation ? domView.attributes([{
    "data-annotation": JSON.stringify(annotation)
  }]) : "")], [annotation ? domView.element("p", [{
    "class": "notice"
  }], [tr("feedback_pin_selected")], false) : "", domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "slide"
  }, {
    "value": slide
  }], [], false), domView.element("label", [], [tr("add_a_comment"), domView.element("textarea", [{
    "name": "body"
  }, {
    "rows": "3"
  }, {
    "maxlength": "4000"
  }, {
    "required": domView.text([])
  }], [draft], false)], false), formFooter(tr("add_comment"), 'chat')], false) : '']));
  restoreCommentDrafts();
  markCommentsRead(visible).catch(e => toast(e.message));
}
function replyComment(buttonElement) {
  const thread = buttonElement.closest('.comment-thread');
  if (!thread) return;
  const existing = thread.querySelector('[data-form="comment-reply"]');
  if (existing) {
    existing.querySelector('textarea').focus();
    return;
  }
  const modal = !!thread.closest('.modal'), comments = modal ? state.data.comments : state.feedItems;
  const comment = comments.find(c => c.id === buttonElement.dataset.id);
  if (!comment || comment.parent_id) return;
  const iid = comment.iteration_id || state.data?.iteration.id;
  domView.insert(thread.querySelector('.comment-replies'), 'beforeend', domView.element("form", [{
    "data-form": "comment-reply"
  }, {
    "class": "comment-reply-form"
  }], [domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "parent_id"
  }, {
    "value": comment.id
  }], [], false), domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "iteration"
  }, {
    "value": iid
  }], [], false), domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "slide"
  }, {
    "value": comment.slide
  }], [], false), domView.element("label", [], [domView.fragment([tr("reply_to"), " ", comment.profile?.name || comment.author]), domView.element("textarea", [{
    "name": "body"
  }, {
    "rows": "3"
  }, {
    "maxlength": "4000"
  }, {
    "required": domView.text([])
  }, {
    "placeholder": tr("write_a_reply")
  }], [], false)], false), domView.element("div", [{
    "class": "comment-actions"
  }], [button(tr("cancel"), 'cancel-comment-reply', 'small ghost'), domView.element("button", [{
    "type": "submit"
  }, {
    "class": "button primary small"
  }], [domView.fragment([icon('send'), tr("post_reply")])], false)], false)], false));
  thread.querySelector('textarea').focus();
}
function revealComment(id) {
  if (id) document.querySelector(domView.text(["[data-comment-id=\"", CSS.escape(id), "\"]"]))?.scrollIntoView({
    block: 'nearest'
  });
}
async function reloadCommentFeed() {
  const count = state.feedOffset || 100;
  await loadFeed();
  while (state.feedMore && state.feedOffset < count) await loadFeed(true);
  render();
}
function previewBar() {
  if (state.client) return '';
  const def = slideDefs()[state.slide], record = def?.record, edit = editable() && !!def;
  const visual = !!record && !record.legacy, job = slideImageJob(record?.id), working = imageWorking(job);
  const tool = (name, action, label, enabled = true, extra = '') => {
    const hint = enabled ? label : domView.text(["", label, " · ", tr('studio_tool_unavailable'), ""]);
    return domView.element("span", [{
      "class": "preview-tool"
    }, {
      "data-tooltip": hint
    }, domView.spread(enabled ? '' : domView.attributes([{
      "tabindex": "0"
    }, {
      "role": "group"
    }, {
      "aria-label": hint
    }]))], [domView.withProps(iconBtn(name, action, hint, domView.text(["", enabled ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]), " ", extra, ""])), {
      "title": null
    })], false);
  };
  return domView.element("div", [{
    "class": "preview-bar"
  }], [domView.element("div", [{
    "class": "preview-toolbar"
  }, {
    "role": "group"
  }, {
    "aria-label": tr('studio_tools')
  }], [domView.fragment(["\n  ", tool('left', 'exit-preview', tr('back_to_studio')), "\n  ", tool('edit', 'edit-slide', tr('studio_edit_slide_2'), edit && !def.sourceOnly && !record?.legacy, domView.attributes([{
    "data-id": record?.id || def?.id || ''
  }])), "\n  ", tool('eye', 'visibility-slide', tr(def?.hidden ? 'studio_show' : 'studio_hide'), edit, domView.attributes([{
    "data-id": def?.id || ''
  }, {
    "data-operation": def?.hidden ? 'show' : 'hide'
  }])), "\n  ", tool('trash', 'delete-slide', tr('studio_delete_slide_2'), edit, domView.attributes([{
    "data-id": def?.id || ''
  }])), "\n  ", tool('play', 'photo-motion', tr(record?.metadata?.motion_candidate ? 'media_review_motion' : 'media_add_motion'), edit && visual && canMovePhoto(def.type), domView.attributes([{
    "data-id": record?.id || ''
  }])), "\n  ", tool('spark', 'enhance-slide', working ? tr('changing_image') : job?.status === 'failed' ? domView.text(["", tr('change_with_ai'), " · ", job.error || tr('the_ai_variation_could_not_be_created'), ""]) : tr('change_with_ai'), edit && visual && canAiEditSlide(def.type) && !working && enhancementRemaining() > 0 && !!state.data.capabilities.ai, domView.attributes([{
    "data-id": record?.id || ''
  }])), "\n  ", tool('image', 'review-image-versions', tr('studio_image_versions'), !!imageVariants(def || ({})).length, domView.attributes([{
    "data-id": record?.id || ''
  }])), "\n  ", tool('check', 'studio-checklist', tr('open_items_communication'), def?.type === 'open-questions'), "\n  ", tool('budget', 'studio-budget', tr('studio_manage_budget'), def?.type === 'budget'), "\n  ", tool('mail', 'studio-communication', tr('studio_internal_communication')), "\n "])], false)], false);
}
function syncPreviewBar(bar) {
  hideToolbarTooltip();
  const template = document.createElement('template');
  domView.mount(template, previewBar());
  const next = template.content.querySelectorAll('.preview-tool');
  bar.querySelectorAll('.preview-tool').forEach((item, index) => {
    for (const [current, replacement] of [[item, next[index]], [item.firstElementChild, next[index]?.firstElementChild]]) {
      if (!replacement) continue;
      for (const attr of [...current.attributes]) if (!replacement.hasAttribute(attr.name)) current.removeAttribute(attr.name);
      for (const attr of replacement.attributes) setDomAttribute(current, attr.name, attr.value);
    }
  });
}
function reviewImageVersions(id) {
  if (state.client || !state.present) return;
  const def = slideDefs().find(s => s.record?.id === id);
  if (!def) return;
  const selected = selectedEnhancements.get(id) || def.record.image_version_id;
  openModal(tr('studio_image_versions'), domView.fragment([domView.element("p", [{
    "class": "notice"
  }], [domView.fragment([tr('studio_editor_only'), " · ", tr('studio_version_preview_hint')])], false), imageVersionPicker(def), domView.element("div", [{
    "class": "studio-version-preview"
  }], [img({
    ...def.visual,
    slide_image_version: selected
  }, def.title)], false)]), true);
  hydrateImages();
}
function studioBudget() {
  if (state.client || !state.present) return;
  openModal(tr('studio_manage_budget'), domView.fragment([domView.element("p", [{
    "class": "notice"
  }], [tr('studio_editor_only')], false), domView.element("div", [{
    "class": "row wrap"
  }], [editable() ? domView.text(["", button(tr('add_cost'), 'add-cost', 'small', '', 'plus'), "", state.data.capabilities.ai ? button(tr('check_subquotes'), 'match-subquotes', 'small', pending() ? domView.attributes([{
    "disabled": domView.text([])
  }]) : '', 'spark') : '', ""]) : ''], false), subquoteReview(), domView.element("div", [{
    "class": "studio-budget-items"
  }], [domView.join(state.data.budget.map(item => domView.element("div", [{
    "class": "row between"
  }], [domView.element("span", [], [item.label], false), editable() ? button(tr('edit_cost'), 'edit-cost', 'small', domView.attributes([{
    "data-id": item.id
  }]), 'edit') : ''], false)), '')], false)]), true);
}
function projectStylePreview(t) {
  return domView.element("div", [{
    "class": "project-style-sample project-preview"
  }, {
    "data-project-style-preview": domView.text([])
  }, {
    "style": projectThemeStyle(t)
  }], [domView.element("small", [], [tr("studio_your_presentation_2")], false), domView.element("h3", [], [tr("studio_a_space_to_feel_at_home")], false), domView.element("div", [], [domView.join(t.colors.map(c => domView.element("i", [{
    "style": domView.text(["background:", c])
  }], [], false)), ''), domView.element("span", [], [tr("studio_explore_the_concept")], false)], false)], false);
}
function updateProjectStylePreview(e) {
  const form = e.target.closest('[data-form="theme"]');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form)), colors = Object.entries(data).filter(([key]) => key.startsWith('color')).map(([, value]) => value);
  domView.replace(form.querySelector('[data-project-style-preview]'), projectStylePreview({
    ...data,
    colors
  }));
  form.querySelectorAll('[data-background-mode]').forEach(el => el.hidden = el.dataset.backgroundMode !== data.mode);
}
document.addEventListener('input', updateProjectStylePreview);
document.addEventListener('change', updateProjectStylePreview);
function themeModal() {
  if (!requireDraft()) return;
  const t = theme(), designWhite = projectThemeVariables({
    ...t,
    mode: 'light',
    light_background: ''
  })['--deck-bg'];
  const choices = (name, options, selected) => domView.join(options.map(([value, label]) => domView.element("label", [{
    "class": "style-choice"
  }], [domView.element("input", [{
    "type": "radio"
  }, {
    "name": name
  }, {
    "value": value
  }, domView.spread(selected === value ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), domView.element("span", [domView.spread(name === 'font' ? domView.attributes([{
    "style": domView.text(["font-family:", value === 'serif' ? 'Georgia,serif' : 'Arial,sans-serif'])
  }]) : '')], [label], false)], false)), '');
  const colors = (name, options, selected) => domView.join(options.map(([value, label]) => domView.element("label", [{
    "class": "background-choice"
  }], [domView.element("input", [{
    "type": "radio"
  }, {
    "name": name
  }, {
    "value": value
  }, domView.spread(selected === value ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), domView.element("i", [{
    "style": domView.text(["background:", value])
  }], [], false), domView.element("span", [], [label], false)], false)), '');
  const light = [[designWhite, tr("studio_design_white")], ['#f6f0e5', tr("studio_ivory")], ['#edf1f3', tr("studio_mist")], ['#f4eaea', tr("studio_blush")], ['#edf1e8', tr("studio_sage")]];
  const dark = [['#152235', tr("studio_midnight")], ['#111314', tr("studio_soft_black")], ['#253128', tr("studio_pine")], ['#302838', tr("studio_plum")], ['#322a25', tr("studio_espresso")]];
  if (t.light_background && !light.some(([color]) => color === t.light_background)) light[0] = [t.light_background, tr("studio_current_light")];
  if (!dark.some(([color]) => color === t.background)) dark[0] = [t.background, tr("studio_current_dark")];
  openModal(tr("studio_project_presentation_style"), domView.element("form", [{
    "data-form": "theme"
  }, {
    "class": "project-style-layout"
  }], [domView.element("aside", [{
    "class": "style-preview-column"
  }], [projectStylePreview({
    ...t,
    light_background: t.light_background || designWhite
  }), domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_live_preview_changes_apply_when_you_save")], false)], false), domView.element("div", [{
    "class": "style-settings"
  }], [domView.element("fieldset", [{
    "class": "style-options"
  }], [domView.element("legend", [], [tr("studio_presentation_typography")], false), domView.element("div", [{
    "class": "style-choice-row"
  }], [choices('font', [['serif', tr("studio_editorial_serif")], ['sans', tr("studio_modern_sans")]], t.font)], false)], false), domView.element("fieldset", [{
    "class": "style-options"
  }], [domView.element("legend", [], [tr("studio_presentation_background")], false), domView.element("div", [{
    "class": "style-choice-row"
  }], [choices('mode', [['light', tr("studio_light_background")], ['dark', tr("studio_dark_background")]], t.mode)], false)], false), domView.element("fieldset", [{
    "class": "style-options"
  }, {
    "data-background-mode": "light"
  }, domView.spread(t.mode === 'light' ? '' : domView.attributes([{
    "hidden": domView.text([])
  }]))], [domView.element("legend", [], [tr("studio_light_color")], false), domView.element("div", [{
    "class": "background-choices"
  }], [colors('light_background', light, t.light_background || designWhite)], false)], false), domView.element("fieldset", [{
    "class": "style-options"
  }, {
    "data-background-mode": "dark"
  }, domView.spread(t.mode === 'dark' ? '' : domView.attributes([{
    "hidden": domView.text([])
  }]))], [domView.element("legend", [], [tr("studio_dark_color")], false), domView.element("div", [{
    "class": "background-choices"
  }], [colors('background', dark, t.background)], false)], false), domView.element("label", [], [tr("studio_project_palette_extracted_from_your_designs")], false), domView.element("div", [{
    "class": "theme-editor-swatches"
  }], [domView.join(t.colors.map((c, n) => domView.element("input", [{
    "type": "color"
  }, {
    "name": domView.text(["color", n])
  }, {
    "value": c
  }, {
    "aria-label": tr("studio_palette_color", {
      v2: domView.concat(n, 1)
    })
  }], [], false)), '')], false), formFooter(tr("studio_apply_to_presentation"), 'check')], false)], false), true);
  $('.modal').classList.add('style-dialog');
}
function editImageModal(id) {
  const f = state.data.files.find(x => x.id === id);
  if (!f || !requireDraft()) return;
  openModal(tr("change_with_ai"), imagePromptForm('image-edit', domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "version_id"
  }, {
    "value": id
  }], [], false)), true);
}
function manageLinks() {
  const shares = state.data.shares || [];
  openModal(tr("studio_your_shared_presentations"), domView.fragment([domView.element("p", [], [tr("studio_each_link_opens_only_the_iteration_it_was_created_for_revoke_a_link_to_stop_access")], false), domView.join(shares.map(s => domView.element("div", [{
    "class": "history-item"
  }], [domView.element("span", [], [s.email, domView.element("small", [], [s.revoked ? tr("studio_revoked") : domView.concat(domView.text(["", tr("studio_expires"), " "]), new Date(s.expires_at * 1000).toLocaleDateString(dateLocale()))], false)], false), s.revoked ? '' : button(tr("studio_revoke"), 'revoke-share', 'small', domView.attributes([{
    "data-id": s.id
  }]))], false)), '') || domView.element("p", [{
    "class": "muted"
  }], [tr("studio_there_are_no_active_links_recorded_for_this_iteration")], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("studio_share_presentation"), 'share', 'primary', '', 'send')], false)]));
}
async function download(id) {
  let name, url;
  if (DEMO) {
    const f = demoFile(id);
    if (!f) throw Error(tr('error_this_source_is_not_available'));
    name = f.name;
    url = f.url;
  } else {
    const f = state.data.files.flatMap(f => [f, ...f.history || []]).find(v => v.id === id);
    if (!f) throw Error(tr('error_this_source_is_not_part_of_this_iteration'));
    const p = new URLSearchParams({
      action: 'file',
      id,
      iteration: state.data.iteration.id
    }), headers = resourceHeaders();
    const r = await platformFetch(p, {
      credentials: 'same-origin',
      headers
    });
    if (!r.ok) {
      const b = await r.json();
      throw Error(translateError(b.error || 'Download unavailable.'));
    }
    name = f.name;
    url = URL.createObjectURL(await r.blob());
  }
  const a = document.createElement('a');
  a.download = name;
  a.href = safeUrl(url, 'href', a.download !== undefined && a.hasAttribute?.("download"));
  a.click();
  if (!DEMO) setTimeout(() => URL.revokeObjectURL(url), 20000);
}
async function uploadFiles(files, asset = '', category = '', projectSetup = false) {
  if (!files.length || !requireDraft()) return;
  const sizeError = uploadSelectionError(files);
  if (sizeError) {
    openModal(tr("studio_upload_needs_attention"), domView.fragment([domView.element("p", [], [sizeError], false), domView.element("div", [{
      "class": "modal-footer"
    }], [button(tr("studio_got_it"), 'close-modal', 'primary')], false)]));
    return;
  }
  const fd = new FormData();
  fd.append('iteration', state.data.iteration.id);
  if (category) fd.append('category', category);
  if (asset) fd.append('replace_asset', asset);
  for (const f of files) fd.append('files[]', f);
  showProcessing(true, [], projectSetup);
  try {
    const result = await api('upload', fd);
    processingView.uploading = false;
    processingView.ids = result.ids || [];
    state.tab = 'overview';
    await refresh();
    if (result.processing === false) {
      hideProcessing();
      toast(result.notice || 'Files uploaded.');
    } else renderProcessing();
  } catch (e) {
    processingView.uploading = false;
    processingView.error = e.message;
    renderProcessing();
    throw e;
  }
}
function chooseFiles(asset = '', category = '') {
  if (requireDraft()) uploader.open({
    asset,
    category
  });
}
async function uploadDriveFiles(selection, asset = '', category = '', projectSetup = false) {
  if (!requireDraft()) return;
  const iid = state.data.iteration.id;
  showProcessing(true, [], projectSetup);
  try {
    const result = await api('drive_import', {
      iteration: iid,
      folder: selection.folder,
      files: selection.files,
      replace_asset: asset,
      category
    });
    processingView.uploading = false;
    processingView.ids = result.ids || [];
    state.tab = 'overview';
    await refresh();
    renderProcessing();
  } catch (e) {
    processingView.uploading = false;
    processingView.error = e.message;
    renderProcessing();
    throw e;
  }
}
async function askBudget(q) {
  if (state.busy) return;
  const context = {
    iteration: state.data.iteration.id,
    slide: state.present ? slideDefs()[state.slide]?.id || 'budget' : 'budget'
  };
  state.chat.push({
    role: 'user',
    text: q
  });
  state.busy = true;
  render();
  try {
    const r = await api('budget_chat', {
      ...context,
      question: q
    });
    if (state.data?.iteration.id !== context.iteration) return;
    state.chat.push({
      role: 'assistant',
      text: r.answer,
      sources: r.sources,
      citations: r.citations
    });
  } catch (e) {
    if (state.data?.iteration.id === context.iteration) state.chat.push({
      role: 'assistant',
      text: e.message
    });
  } finally {
    state.busy = false;
    render();
    document.querySelectorAll('[data-chat-messages]').forEach(el => el.scrollTo(0, 99999));
  }
}
async function startPresentation(slide = 0, {editorSlide = '', loaded = false} = {}) {
  if (!loaded && !await ensureProjectResource('presentation')) return;
  if (activeModal) closeModal();
  state.communicationOpen = false;
  state.hiddenPreview = !state.client ? editorSlide : '';
  selectedEnhancements.clear();
  showOriginalSlides.clear();
  showGeneratedSlides.clear();
  showMotionComparisons.clear();
  if (editorSlide) {
    slide = slideDefs().findIndex(s => s.id === editorSlide);
    if (slide < 0) {
      toast(tr('studio_this_slide_is_no_longer_available_in_this_iteration'));
      return;
    }
  }
  if (!slideDefs().length) {
    toast(tr("studio_show_a_slide_in_the_editor_before_previewing"));
    return;
  }
  if (!state.client) onboarding.reviewed();
  state.present = true;
  state.slide = Math.max(0, slide);
  state.imageIndex = 0;
  state.zoom = 1;
  render();
  if (state.presentationMode === 'scroll') scrollToSlide(slideDefs()[state.slide]?.id, {
    smooth: false
  }); else window.scrollTo(0, 0);
}
function moveSlide(n) {
  const next = Math.max(0, Math.min(domView.concat(state.slide, n), slideDefs().length - 1));
  if (state.presentationMode === 'scroll' && state.present) {
    state.slide = next;
    scrollToSlide(slideDefs()[next]?.id, {
      focus: !magnifiedPhoto,
      smooth: !magnifiedPhoto
    });
    syncScrollPresentationContext();
    syncWorkspaceUrl(true);
    return;
  }
  if (next === state.slide) return;
  animateSlideChange(() => {
    state.slide = next;
    state.imageIndex = 0;
    state.zoom = 1;
    render();
    window.scrollTo(0, 0);
  }, n);
}
function showInfo(kind) {
  if (kind === 'demo') openModal(tr("studio_meet_studiodeck"), domView.fragment([domView.element("p", [], [tr("studio_this_is_a_working_interface_demo_with_a_fictional_family_project_explore_the_presentation_expand_the")], false), domView.element("div", [{
    "class": "notice"
  }], [tr("studio_demo_changes_last_for_this_page_session_emails_document_extraction_and_ai_image_generation_are_not_c")], false), domView.element("p", [], [tr("studio_the_accompanying_php_application_stores_records_and_file_versions_in_sqlite_processes_uploaded_docum")], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr("studio_explore_the_client_view"), 'preview', 'primary', '', 'play')], false)]));
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const a = el.dataset.action;
  try {
    if (a === 'website' || a.startsWith('website-')) {
      await website.action(a, el);
      return;
    }
    if (a.startsWith('onboarding-')) {
      await onboarding.action(a);
      return;
    }
    if (a.startsWith('billing-access-')) {
      await projectAccess.action(a, el);
      return;
    }
    if (a.startsWith('billing')) {
      await billing.action(a, el);
      return;
    }
    if (a.startsWith('upload-') || a.startsWith('drive-')) {
      await uploader.action(a, el);
      return;
    }
    switch (a) {
      case 'product-feedback':
        productFeedback.open();
        break;
      case 'product-feedback-inbox':
        await productFeedback.inbox();
        break;
      case 'close-modal':
        pageReviewSequence++;
        closeModal();
        break;
      case 'show-processing':
        showProcessing();
        break;
      case 'hide-processing':
        hideProcessing();
        break;
      case 'review-processed':
        hideProcessing();
        await selectProjectTab('files');
        break;
      case 'toggle-extracted':
        expandedFiles.has(el.dataset.id) ? expandedFiles.delete(el.dataset.id) : expandedFiles.add(el.dataset.id);
        render();
        document.querySelector(domView.text(["[data-action=\"toggle-extracted\"][data-id=\"", CSS.escape(el.dataset.id), "\"]"]))?.focus();
        break;
      case 'preview-csv':
      case 'preview-image':
        await previewFile(el.dataset.id);
        break;
      case 'preview-extracted':
        await previewExtracted(el.dataset.id);
        break;
      case 'download-extracted':
        await downloadExtracted(el.dataset.id);
        break;
      case 'review-pages':
        await reviewPage(el.dataset.id);
        break;
      case 'add-slide':
        if (requireDraft()) editSlideModal('', DEMO ? '' : await pack.slidePicker());
        break;
      case 'add-system-slide':
        {
          if (!requireDraft()) break;
          el.disabled = true;
          try {
            await api('add_system_slide', {
              iteration: state.data.iteration.id,
              type: el.dataset.type,
              section: state.slideGroup || ''
            });
            await refresh(true);
            toast(tr("studio_system_slide_added"));
          } finally {
            el.disabled = false;
          }
          break;
        }
      case 'add-slide-tab':
        selectAddSlideTab(el.dataset.tab);
        break;
      case 'edit-slide':
        editSlideModal(el.dataset.id);
        break;
      case 'slide-view':
        state.slideView = el.dataset.view;
        render();
        break;
      case 'open-editor-slide':
        await openEditorSlide(el.dataset.id);
        break;
      case 'zoom-editor-slide':
        await openEditorSlide(el.dataset.id, true);
        break;
      case 'visibility-slide':
        {
          const operation = el.dataset.operation, slide_id = el.dataset.id, iteration = state.data.iteration.id;
          const title = editorSlides().find(slide => slide.id === slide_id)?.title || '';
          el.disabled = true;
          try {
            if (await changeSlideLayout(operation, {
              slide_id
            }) && operation === 'hide') {
              toast(tr('studio_slide_hidden_undo', {
                title
              }), {
                action: async () => {
                  await api('slide_layout', {
                    iteration,
                    operation: 'show',
                    slide_id
                  });
                  if (state.data?.iteration.id === iteration && !state.client) {
                    await refresh(true);
                    if (state.present) {
                      state.slide = Math.max(0, slideDefs().findIndex(slide => slide.id === slide_id));
                      render();
                      if (state.presentationMode === 'scroll') scrollToSlide(slide_id, {
                        smooth: false
                      });
                      document.querySelector('.preview-toolbar [data-action="visibility-slide"]')?.focus({
                        preventScroll: true
                      });
                    }
                  }
                }
              });
            }
          } finally {
            if (el.isConnected) el.disabled = false;
          }
          break;
        }
      case 'group-slides':
        await changeSlideLayout('reorder', {
          order: groupSlideOrder(editorSlides(), currentGroups())
        });
        break;
      case 'jump-section':
        {
          const index = slideDefs().findIndex(s => s.section === el.dataset.section);
          if (index >= 0) moveSlide(index - state.slide);
          break;
        }
      case 'editor-section':
        state.slideGroup = el.dataset.section;
        render();
        break;
      case 'remove-slide-group':
        {
          if (!requireDraft() || !state.slideGroup) break;
          const groups = currentGroups(), gid = state.slideGroup, remaining = Object.entries(groups).filter(([key]) => key !== gid);
          if (!remaining.length) break;
          if (!editorSlides().some(slide => slide.section === gid)) {
            await api('remove_slide_group', {
              iteration: state.data.iteration.id,
              group: gid
            });
            state.slideGroup = '';
            await refresh(true);
            toast(tr('studio_empty_group_removed'));
            break;
          }
          openModal(tr('studio_remove_group'), domView.element("form", [{
            "data-form": "remove-slide-group"
          }], [domView.element("input", [{
            "type": "hidden"
          }, {
            "name": "group"
          }, {
            "value": gid
          }], [], false), domView.element("p", [], [tr('studio_remove_group_move_slides', {
            group: groups[gid]
          })], false), domView.element("label", [], [tr('studio_move_slides_to_group'), domView.element("select", [{
            "name": "destination"
          }, {
            "required": domView.text([])
          }], [domView.element("option", [{
            "value": domView.text([])
          }], [tr('studio_choose_destination_group')], false), domView.join(remaining.map(([key, label]) => domView.element("option", [{
            "value": key
          }], [label], false)), '')], false)], false), formFooter(tr('studio_remove_group'), 'trash')], false));
          break;
        }
      case 'add-slide-group':
        openModal(tr("studio_add_slide_group"), domView.element("form", [{
          "data-form": "slide-group"
        }], [domView.element("label", [], [tr("studio_group_name"), domView.element("input", [{
          "name": "label"
        }, {
          "required": domView.text([])
        }, {
          "maxlength": "60"
        }, {
          "placeholder": tr("studio_materials_finishes")
        }], [], false)], false), formFooter(tr("studio_add_group"), 'plus')], false));
        break;
      case 'delete-slide':
        {
          const s = editorSlides().find(s => s.id === el.dataset.id);
          if (!s || !requireDraft()) break;
          openModal(tr("studio_delete_this_slide"), domView.fragment([domView.element("p", [], [domView.fragment([tr("studio_remove_2"), " "]), domView.element("strong", [], [s.title], false), domView.fragment([" ", tr("studio_from_this_presentation_the_original_file_stays_in_files")])], false), domView.element("div", [{
            "class": "modal-footer"
          }], [domView.fragment([button(tr("cancel"), 'close-modal', 'ghost'), button(tr("studio_delete_slide_2"), 'confirm-delete-slide', 'danger-text', domView.attributes([{
            "data-id": s.id
          }]))])], false)]));
          break;
        }
      case 'restore-slide':
        {
          if (!requireDraft()) break;
          await changeSlideLayout('restore', {
            slide_id: el.dataset.id
          });
          state.slideGroup = '';
          closeModal();
          render();
          toast(tr("studio_slide_restored"));
          break;
        }
      case 'confirm-delete-slide':
        await changeSlideLayout('delete', {
          slide_id: el.dataset.id
        });
        closeModal();
        toast(tr("studio_slide_removed_the_original_file_is_still_available"));
        break;
      case 'magnify-photo':
        openPhotoLightbox();
        break;
      case 'close-photo':
        closePhotoLightbox();
        break;
      case 'next-photo-slide':
        navigatePhotoLightbox(1);
        break;
      case 'previous-photo-slide':
        navigatePhotoLightbox(-1);
        break;
      case 'image-preset':
        {
          const preset = imagePresets[el.dataset.preset], form = el.closest('form');
          if (!preset || !form) break;
          form.querySelector('textarea[name=prompt]').value = preset.prompt;
          form.querySelectorAll('[data-preset]').forEach(button => {
            const selected = button === el;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
          });
          form.querySelector('textarea').focus();
          break;
        }
      case 'photo-motion':
        motionUi.open(el.dataset.id);
        break;
      case 'enhance-slide':
        enhanceSlideModal(el.dataset.id);
        break;
      case 'use-image-version':
        {
          if (!requireDraft()) break;
          await api('select_slide_image', {
            iteration: state.data.iteration.id,
            slide_id: el.dataset.id,
            image_version_id: el.dataset.version
          });
          selectedEnhancements.delete(el.dataset.id);
          closeModal();
          await refresh(true);
          toast(tr("studio_this_image_version_is_now_used_in_the_presentation"));
          break;
        }
      case 'toggle-slide-comparison':
        {
          const def = slideDefs().find(s => s.record?.id === el.dataset.id);
          if (def && comparingImage(def)) {
            showGeneratedSlides.add(el.dataset.id);
            showMotionComparisons.delete(el.dataset.id);
          } else {
            resetComparisonPosition(el.dataset.id);
            showOriginalSlides.delete(el.dataset.id);
            showGeneratedSlides.delete(el.dataset.id);
            showMotionComparisons.add(el.dataset.id);
          }
          render();
          if (magnifiedPhoto) renderPhotoLightbox();
          break;
        }
      case 'toggle-slide-original':
        if (showOriginalSlides.has(el.dataset.id)) {
          showOriginalSlides.delete(el.dataset.id);
          showGeneratedSlides.add(el.dataset.id);
        } else showOriginalSlides.add(el.dataset.id);
        render();
        if (magnifiedPhoto) renderPhotoLightbox();
        break;
      case 'reprocess':
        {
          if (!requireDraft()) break;
          const r = await api('reprocess', {
            iteration: state.data.iteration.id,
            version_id: el.dataset.id
          });
          showProcessing(false, [r.id]);
          await refresh();
          break;
        }
      case 'demo-info':
        showInfo('demo');
        break;
      case 'account-menu':
        accountMenu();
        break;
      case 'destinations':
        await showDestinations();
        break;
      case 'destination-studio':
        await openDestinationStudio(el.dataset.id, el.dataset.project || '');
        break;
      case 'destination-client':
        await openClientProject(el.dataset.id);
        break;
      case 'account-sign-in':
        closeModal();
        sessionStorage.setItem('studiodeck.returnTo', '/choose');
        state.present = false;
        state.client = false;
        state.shareToken = '';
        state.clientShareId = '';
        state.accountClientProject = '';
        history.pushState(null, '', '/choose');
        render();
        break;
      case 'profile':
        await showProfile();
        break;
      case 'remove-avatar':
        await api('remove_avatar');
        await reloadProfile();
        break;
      case 'choose-project-logo':
        el.closest('form').querySelector('#project-logo-input').click();
        break;
      case 'clear-project-logo':
        {
          const form = el.closest('form');
          form._logoPick = domView.concat(form._logoPick || 0, 1);
          form._logoLoading = false;
          form.querySelector('[type="submit"]').disabled = false;
          form._logoFile = null;
          form._removeLogo = true;
          form.querySelector('#project-logo-input').value = '';
          domView.mount(form.querySelector('[data-logo-preview]'), form.dataset.form === 'studio-theme' ? defaultBrand() : projectLogoFallback());
          form.querySelector('[data-logo-status]').textContent = tr(form.dataset.form === 'studio-theme' ? 'studio_logo_will_be_removed_when_you_save' : 'studio_project_logo_will_be_removed_when_you_save');
          el.hidden = true;
          break;
        }
      case 'pack-library':
      case 'pack-new-slide':
      case 'pack-new-document':
      case 'pack-edit':
      case 'pack-archive':
      case 'pack-examples':
      case 'pack-download':
        await pack.action(a, el);
        break;
      case 'project-documents':
        projectDocumentsModal();
        break;
      case 'ask-documents':
        closeModal();
        openModal(tr("ask_about_your_project"), chatPanel());
        break;
      case 'settings':
        studioSettings();
        break;
      case 'remove-studio-logo':
        await api('remove_studio_logo', {});
        state.logoVersion = Date.now();
        applySession(await api('session'));
        closeModal();
        if (state.data) await refresh(); else render();
        studioSettings();
        break;
      case 'studio-users':
        await loadStudioUsers();
        state.tab = 'studio-users';
        state.present = false;
        render();
        break;
      case 'edit-studio-user':
        if (!el.dataset.id && studioTeamFull()) {
          await billing.open();
          break;
        }
        studioUserModal(el.dataset.id);
        break;
      case 'remove-studio-user':
        openModal(tr("studio_remove_studio_member"), domView.fragment([domView.element("p", [], [tr("studio_this_removes_access_to_this_studio_and_its_project_teams_their_account_in_other_studios_is_preserved")], false), domView.element("form", [{
          "data-form": "remove-studio-user"
        }], [domView.element("input", [{
          "type": "hidden"
        }, {
          "name": "id"
        }, {
          "value": el.dataset.id
        }], [], false), formFooter(tr("studio_remove_member"))], false)]));
        break;
      case 'team-add':
        teamPicker.selected.add(el.dataset.id);
        renderTeamPicker();
        break;
      case 'team-remove':
        teamPicker.selected.delete(el.dataset.id);
        renderTeamPicker();
        break;
      case 'project-team':
        await projectTeamModal();
        break;
      case 'project-clients':
        closeModal();
        await selectProjectTab('people');
        break;
      case 'edit-project-client':
        projectClientUi.edit(el.dataset.email);
        break;
      case 'remove-project-client':
        projectClientUi.remove(el.dataset.email);
        break;
      case 'communication-filter':
        {
          const previous = communicationFilter;
          communicationFilter = ['open', 'attention', 'all'].includes(el.dataset.filter) ? el.dataset.filter : 'open';
          communicationControls.firstPage();
          try {
            await loadFeed();
            render();
          } catch (error) {
            communicationFilter = previous;
            toast(error.message);
          }
          break;
        }
      case 'all-comments':
        state.tab = a;
        state.present = false;
        communicationControls.firstPage();
        await loadFeed();
        render();
        break;
      case 'more-feed':
        await loadFeed(true);
        render();
        break;
      case 'comment-slide':
        await openCommentSlide(el.dataset);
        break;
      case 'menu':
        $('.sidebar')?.classList.toggle('open');
        break;
      case 'projects':
        projectLoadSequence++;
        await loadProjects();
        state.tab = 'projects';
        state.present = false;
        render();
        pollJobs();
        break;
      case 'project-location':
        if (state.data.can_edit !== false) openModal(tr("studio_project_location_2"), domView.element("form", [{
          "data-form": "project-location"
        }], [domView.element("label", [], [domView.fragment([tr("studio_location_2"), " "]), domView.element("span", [{
          "class": "muted"
        }], [tr("studio_optional")], false), domView.element("input", [{
          "name": "location"
        }, {
          "value": state.data.project.location || ''
        }, {
          "maxlength": "160"
        }, {
          "placeholder": tr("studio_city_neighbourhood_or_address")
        }, {
          "autocomplete": "off"
        }], [], false)], false), formFooter(tr("studio_save_location"))], false));
        break;
      case 'choose-project-cover':
        await projectCoverModal();
        break;
      case 'select-project-cover':
        {
          if (!editable() || el.disabled) break;
          const controls = el.closest('.project-cover-picker').querySelectorAll('button');
          controls.forEach(b => b.disabled = true);
          try {
            await api('set_project_cover', {
              iteration: state.data.iteration.id,
              slide_id: el.dataset.slide
            });
            closeModal();
            await loadProjects();
            await refresh();
            toast(tr('studio_cover_updated'));
          } finally {
            controls.forEach(b => b.disabled = false);
          }
          break;
        }
      case 'project-settings':
        projectSettingsModal();
        break;
      case 'delete-project':
        {
          const p = el.dataset.id ? state.projects.find(p => p.id === el.dataset.id) : state.data?.project;
          if (p) deleteProjectModal(p);
          break;
        }
      case 'prepare-delete-project':
        {
          const projectId = el.dataset.id;
          const r = await api('prepare_delete_project', {
            project_id: projectId
          });
          openModal(tr("studio_final_check_delete_permanently"), domView.fragment([domView.element("p", [], [domView.fragment([tr("studio_you_are_deleting"), " "]), domView.element("strong", [], [r.name], false), tr("studio_iteration_s_and_file_version_s_including_their_extracted_images_and_text", {
            v1: r.iterations,
            v2: r.files
          })], false), domView.element("form", [{
            "data-form": "delete-project"
          }], [domView.element("input", [{
            "type": "hidden"
          }, {
            "name": "project_id"
          }, {
            "value": projectId
          }], [], false), domView.element("input", [{
            "type": "hidden"
          }, {
            "name": "confirmation"
          }, {
            "value": r.confirmation
          }], [], false), domView.element("label", [], [tr("studio_type_the_exact_project_name"), domView.element("input", [{
            "name": "name"
          }, {
            "required": domView.text([])
          }, {
            "autocomplete": "off"
          }, {
            "placeholder": r.name
          }], [], false)], false), domView.element("label", [{
            "class": "checkbox-label"
          }], [domView.element("input", [{
            "type": "checkbox"
          }, {
            "name": "acknowledged"
          }, {
            "required": domView.text([])
          }], [], false), domView.fragment([" ", tr("studio_i_understand_this_permanently_deletes_the_project_and_disables_all_client_links")])], false), formFooter(tr("studio_permanently_delete_project"), 'minus')], false)]));
          break;
        }
      case 'pin-project':
        await api('pin_project', {
          project_id: el.dataset.id,
          pinned: el.dataset.pinned === '1'
        });
        await loadProjects();
        render();
        break;
      case 'archive-project':
        if (el.dataset.archived === '0' && !DEMO) {
          await projectAccess.gate(el.dataset.id, 'reactivate');
          break;
        }
        await api('project_settings', {
          project_id: el.dataset.id,
          archived: el.dataset.archived === '1'
        });
        await loadProjects();
        render();
        break;
      case 'open-project':
        state.tab = 'overview';
        await openProject(el.dataset.id);
        break;
      case 'preview-project':
        state.tab = 'overview';
        await openProject(el.dataset.id, null, true);
        break;
      case 'tab':
        if (!state.data) {
          state.tab = 'projects';
          state.present = false;
          await loadProjects();
          render();
          break;
        }
        await selectProjectTab(el.dataset.tab);
        break;
      case 'retry-project-view':
        await selectProjectTab(state.tab);
        break;
      case 'project-pending':
        await communication.showPending();
        break;
      case 'new-project':
        await beginNewProject();
        break;
      case 'wizard-intro':
        projectWizardIntro();
        break;
      case 'wizard-details':
      case 'wizard-back':
        projectWizardDetails();
        break;
      case 'wizard-drive':
        if (!newProjectWizard?.busy) uploader.open({
          chooseOnly: true,
          tab: 'drive'
        });
        break;
      case 'wizard-browse':
        if (!newProjectWizard?.busy) $('#wizard-file-input')?.click();
        break;
      case 'wizard-remove-file':
        if (newProjectWizard && !newProjectWizard.busy) {
          const n = Number(el.dataset.index);
          if (newProjectWizard.driveSelection) {
            newProjectWizard.driveSelection.files.splice(n, 1);
            newProjectWizard.driveSelection.names.splice(n, 1);
            if (!newProjectWizard.driveSelection.files.length) newProjectWizard.driveSelection = null;
          } else newProjectWizard.files.splice(n, 1);
          projectWizardFiles();
        }
        break;
      case 'review-image-versions':
        reviewImageVersions(el.dataset.id);
        break;
      case 'open-items-view':
        openItems.select(el);
        break;
      case 'studio-checklist':
        if (!state.client && state.present) communication.show();
        break;
      case 'studio-budget':
        studioBudget();
        break;
      case 'studio-communication':
        if (!state.client && state.present) {
          state.present = false;
          state.communicationOpen = false;
          await selectProjectTab('comments');
        }
        break;
      case 'preview':
        state.inspectHidden = false;
        await startPresentation();
        break;
      case 'go-slide':
        {
          const next = Number(el.dataset.slide);
          if (state.present) moveSlide(next - state.slide); else await startPresentation(next);
          break;
        }
      case 'toggle-fullscreen':
        await togglePresentationFullscreen();
        break;
      case 'presentation-mode':
        setPresentationMode(el.dataset.mode);
        break;
      case 'scroll-top':
        scrollToSlide(slideDefs()[0]?.id, {
          focus: true
        });
        break;
      case 'next-slide':
        moveSlide(1);
        break;
      case 'prev-slide':
        moveSlide(-1);
        break;
      case 'exit-preview':
        document.documentElement.style.removeProperty('--heading');
        await selectProjectTab(state.tab);
        break;
      case 'upload':
        chooseFiles();
        break;
      case 'replace':
        {
          const f = state.data.files.find(x => x.id === el.dataset.id);
          chooseFiles(f.asset_id);
          break;
        }
      case 'file-filter':
        fileFilterModal();
        break;
      case 'download':
        await download(el.dataset.id);
        break;
      case 'download-current':
        {
          const fs = slideFiles(slideDefs()[state.slide].id);
          if (fs.length) await download(fs[0].id);
          break;
        }
      case 'history':
        historyModal(el.dataset.id);
        break;
      case 'originals':
        originalsModal();
        break;
      case 'lock-iteration':
        {
          if (state.client || !state.data || state.data.can_edit === false || state.studio?.role !== 'admin') break;
          const locked = !Number(state.data.iteration.locked), label = locked ? tr("studio_lock_iteration") : tr("studio_unlock_iteration");
          openModal(locked ? tr("studio_lock_this_iteration") : tr("studio_unlock_this_iteration"), domView.fragment([domView.element("p", [], [iterationLabel(state.data.iteration)], false), domView.element("p", [], [locked ? tr("studio_locking_disables_changes_to_this_iteration_s_content_and_budget_choices_an_admin_can_unlock_it_later") : tr("studio_unlocking_allows_changes_to_this_iteration_s_content_and_budget_choices_changes_will_also_appear_in_")], false), domView.element("div", [{
            "class": "modal-footer"
          }], [domView.fragment([button(tr("cancel"), 'close-modal', 'ghost'), button(label, 'confirm-iteration-lock', 'primary', domView.attributes([{
            "data-iteration": state.data.iteration.id
          }, {
            "data-locked": locked
          }]), locked ? 'lock' : 'unlock')])], false)]));
          break;
        }
      case 'confirm-iteration-lock':
        {
          if (state.client || state.data?.can_edit === false || state.studio?.role !== 'admin' || state.data?.iteration.id !== el.dataset.iteration) break;
          const locked = el.dataset.locked === 'true';
          el.disabled = true;
          try {
            await api('lock_iteration', {
              iteration: el.dataset.iteration,
              locked
            });
            closeModal();
            await refresh(true);
            toast(locked ? tr("studio_iteration_locked_an_admin_can_unlock_it_to_allow_changes") : tr("studio_iteration_unlocked_you_can_edit_it_again"));
          } catch (error) {
            el.disabled = false;
            throw error;
          }
          break;
        }
      case 'iteration':
        iterationModal();
        break;
      case 'switch-iteration':
        closeModal();
        await openProject(state.data.project.id, el.dataset.id);
        break;
      case 'theme':
        themeModal();
        break;
      case 'share':
        await shareProject();
        break;
      case 'copy-link':
        await navigator.clipboard.writeText(el.dataset.url);
        toast(tr("studio_link_copied"));
        break;
      case 'client-view':
        if (!await ensureProjectResource('presentation')) break;
        closeModal();
        state.client = true;
        state.shareToken = DEMO ? '' : state.shareToken;
        await startPresentation(0, {
          loaded: true
        });
        break;
      case 'contacts':
        await selectProjectTab('people');
        break;
      case 'add-project-person':
        await peopleUi.add(el.dataset.group);
        break;
      case 'edit-project-person':
        peopleUi.edit(el.dataset.group, el.dataset.key);
        break;
      case 'remove-project-person':
        peopleUi.remove(el.dataset.group, el.dataset.key);
        break;
      case 'add-contact':
        peopleUi.add('other');
        break;
      case 'suggest-open-questions':
      case 'check-start':
      case 'check-run':
      case 'check-role':
      case 'check-review':
      case 'check-evidence':
      case 'check-question':
        if (!await ensureProjectResource('checks')) break;
        await checksUi.action(a, el);
        break;
      case 'checklist-from-comment':
      case 'checklist-request-approval':
      case 'edit-open-question':
      case 'discuss-open-question':
      case 'change-open-question':
      case 'add-client-question':
        await questionUi.action(a, el);
        break;
      case 'feedback':
        feedbackModal();
        break;
      case 'show-answered':
        await changeCommentView(el, 'showAnswered');
        break;
      case 'sort-comments':
        await changeCommentView(el, 'sort');
        break;
      case 'toggle-comment-answered':
        await toggleCommentAnswered(el);
        break;
      case 'reply-comment':
        replyComment(el);
        break;
      case 'cancel-comment-reply':
        {
          const thread = el.closest('.comment-thread');
          commentReplyDrafts.delete(el.closest('form').elements.parent_id.value);
          el.closest('form').remove();
          thread.querySelector('[data-action=reply-comment]')?.focus();
          break;
        }
      case 'add-cost':
        budgetModal();
        break;
      case 'cost':
        budgetModal(el.dataset.id);
        break;
      case 'edit-cost':
        editCostModal(state.data.budget.find(x => x.id === el.dataset.id));
        break;
      case 'budget-jump':
        jumpToBudgetItem(el);
        break;
      case 'toggle-cost':
        toggleBudgetLine(el);
        break;
      case 'ask':
        await askBudget(el.dataset.question);
        break;
      case 'legal-citation':
        {
          const p = await api('document_page', {
            iteration: state.data.iteration.id,
            id: el.dataset.version,
            page: el.dataset.page
          });
          const f = state.data.files.find(f => f.id === el.dataset.version);
          openModal(domView.text(["", f?.name || tr('source_document'), "", tr('file_page', {
            page: p.number
          }), ""]), domView.fragment([domView.element("pre", [{
            "class": "extracted-text"
          }], [p.text], false), domView.element("div", [{
            "class": "modal-footer"
          }], [button(domView.concat(fileTypeLogo(downloadFile(el.dataset.version)), tr('download_original')), 'download', 'small', domView.attributes([{
            "data-id": el.dataset.version
          }]), 'download')], false)]), true);
          break;
        }
      case 'enhance':
        editImageModal(el.dataset.id, true);
        break;
      case 'match-subquotes':
        subquoteCheckModal();
        break;
      case 'start-subquote-check':
        await startSubquoteCheck(el);
        break;
      case 'review-subquote':
        await api('review_subquote', {
          iteration: state.data.iteration.id,
          id: el.dataset.id,
          decision: el.dataset.decision
        });
        await refresh();
        toast(tr("studio_quote_relationship_saved"));
        break;
      case 'unlink-subquote':
        await api('unlink_subquote', {
          iteration: state.data.iteration.id,
          id: el.dataset.id
        });
        closeModal();
        await refresh();
        toast(tr("studio_link_removed_this_cost_will_stay_separate"));
        break;
      case 'image-edit':
        editImageModal(el.dataset.id);
        break;
      case 'image-index':
        state.imageIndex = Number(el.dataset.index);
        state.zoom = 1;
        render();
        break;
      case 'next-image':
        state.imageIndex = domView.concat(state.imageIndex, 1) % photoFiles().length;
        render();
        break;
      case 'prev-image':
        state.imageIndex = domView.concat(state.imageIndex - 1, photoFiles().length) % photoFiles().length;
        render();
        break;
      case 'zoom-in':
        state.zoom = Math.min(3, domView.concat(state.zoom, .25));
        render();
        break;
      case 'zoom-out':
        state.zoom = Math.max(.5, state.zoom - .25);
        render();
        break;
      case 'zoom-reset':
        state.zoom = 1;
        render();
        break;
      case 'manage-links':
        if (await ensureProjectResource('people')) manageLinks();
        break;
      case 'revoke-share':
        await api('revoke_share', {
          id: el.dataset.id
        });
        closeModal();
        await refresh();
        toast(tr("studio_client_link_revoked"));
        break;
      case 'job-status':
        {
          const view = el.dataset.view === 'dismissed' ? 'dismissed' : 'open';
          openModal(tr('studio_a_closer_look_at_your_files'), domView.element("div", [{
            "data-job-status": state.data.iteration.id
          }, {
            "data-view": view
          }], [jobStatusContent(view)], false));
          break;
        }
      case 'job-status-tab':
        {
          const dialog = el.closest('[data-job-status]'), view = el.dataset.view === 'dismissed' ? 'dismissed' : 'open';
          if (dialog) {
            dialog.dataset.view = view;
            domView.mount(dialog, jobStatusContent(view));
            dialog.querySelector(domView.text(["[data-action=\"job-status-tab\"][data-view=\"", view, "\"]"]))?.focus();
          }
          break;
        }
      case 'dismiss-job':
      case 'restore-job':
        {
          const iteration = state.data.iteration.id;
          el.disabled = true;
          try {
            await api(a === 'restore-job' ? 'restore_job' : 'dismiss_job', {
              id: el.dataset.id
            });
            if (state.data?.iteration.id === iteration) {
              await refresh(true);
              const dialog = document.querySelector('[data-job-status]');
              if (dialog?.dataset.jobStatus === iteration) {
                domView.mount(dialog, jobStatusContent(dialog.dataset.view));
                dialog.querySelector('[role="tab"][aria-selected="true"]')?.focus({
                  preventScroll: true
                });
              }
            }
          } finally {
            el.disabled = false;
          }
          break;
        }
      case 'retry-job':
        await api('retry_job', {
          id: el.dataset.id
        });
        closeModal();
        await refresh();
        toast(tr("studio_processing_queued_again"));
        break;
      case 'logout':
        openModal(tr("studio_log_out_of_studiodeck"), domView.fragment([domView.element("p", [], [tr("studio_you_can_sign_in_again_with_your_email_file_processing_will_continue_in_the_background")], false), domView.element("div", [{
          "class": "modal-footer"
        }], [domView.fragment([button(tr("studio_stay_signed_in"), 'close-modal', 'ghost'), button(tr("log_out"), 'confirm-logout', 'primary', '', 'logout')])], false)]));
        break;
      case 'confirm-logout':
        commentReplyDrafts.clear();
        commentView.sort = 'newest';
        commentView.showAnswered = false;
        if (DEMO) {
          closeModal();
          showInfo('demo');
          break;
        }
        await api('logout');
        projectData.reset();
        projectLoadSequence++;
        closeModal();
        history.replaceState(null, '', '/');
        sessionStorage.removeItem('studiodeck.returnTo');
        clearTimeout(state.poll);
        state.user = null;
        state.data = null;
        state.studio = null;
        state.studios = [];
        state.projects = [];
        state.present = false;
        state.client = false;
        state.shareToken = '';
        state.clientShareId = '';
        state.accountClientProject = '';
        state.destinations = null;
        imageCache.forEach(url => {
          if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        });
        imageCache.clear();
        clearMediaCache();
        stopSlideMedia();
        location.replace(safeUrl('/login', 'href'));
        break;
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener('submit', async e => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form)), type = form.dataset.form;
  if (type === 'chat') {
    const inModal = !!form.closest('.modal');
    const answering = askBudget(data.question);
    if (inModal) openModal(tr("ask_about_your_project"), chatPanel());
    await answering;
    if (inModal && activeModal && document.querySelector('.modal [data-form="chat"]')) openModal(tr("ask_about_your_project"), chatPanel());
    return;
  }
  form.querySelector('.form-error')?.remove();
  const submit = form.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const iid = state.data?.iteration.id;
    if (type === 'new-studio') {
      applySession(await api('create_studio', {
        name: data.name.trim()
      }));
      closeModal();
      await resetStudio();
      return;
    }
    if (type.startsWith('website-')) {
      await website.submit(type, form);
      return;
    }
    if (type.startsWith('billing-')) {
      const continueProject = type === 'billing-onboard' && form.dataset.continueProject === '1';
      await billing.form(type, data);
      if (continueProject) await beginNewProject();
      return;
    }
    if (type === 'check-role') await checksUi.submit(data);
    if (['open-question', 'open-question-reply', 'client-open-question'].includes(type)) await questionUi.submit(type, data);
    if (type === 'drive-folder') await uploader.submit(form);
    if (type.startsWith('pack-')) await pack.submit(type, form);
    if (type === 'photo-motion') await motionUi.submit(data);
    if (type === 'slide-editor') {
      const body = new FormData(form);
      body.set('iteration', iid);
      body.set('video_autoplay', form.querySelector('[name=video_autoplay]')?.checked ? '1' : '0');
      if (data.type !== 'video') body.delete('video_file');
      if (['text', 'video'].includes(data.type)) {
        body.delete('image');
        body.delete('image_source');
      }
      const file = body.get('image');
      if (file?.size) {
        const error = uploadSelectionError([file]);
        if (error) throw Error(error);
      }
      const result = await api('save_slide', body);
      const wasPresent = state.present;
      if (!wasPresent) state.slideGroup = data.section;
      closeModal();
      await refresh(true);
      if (wasPresent) {
        state.slide = slideDefs().findIndex(s => s.id === result.id);
        render();
      }
      toast(tr("studio_slide_saved"));
    }
    if (type === 'remove-slide-group') {
      if (!requireDraft()) return;
      await api('remove_slide_group', {
        iteration: iid,
        group: data.group,
        destination: data.destination
      });
      state.slideGroup = data.destination;
      closeModal();
      await refresh(true);
      toast(tr('studio_group_removed'));
    }
    if (type === 'slide-group') {
      const r = await api('add_slide_group', {
        iteration: iid,
        label: data.label
      });
      state.slideGroup = r.id;
      closeModal();
      await refresh(true);
    }
    if (type === 'profile') {
      const r = await api('save_profile', {
        name: data.name,
        language: data.language,
        email_comments: data.email_comments === 'on',
        email_mentions_only: data.email_mentions_only === '1'
      });
      state.profile = r.profile;
      if (state.data) state.data.profile = r.profile;
      if (state.user) state.user.profile = r.profile;
      render();
      if (state.present || state.client || state.tab === 'destinations') openModal(tr('your_profile'), profilePage(true));
      toast(tr('profile_saved'));
    }
    if (type === 'avatar') {
      await api('upload_avatar', imageUploadData(form));
      await reloadProfile();
      toast(tr("avatar_saved"));
    }
    if (type === 'delete-project') {
      await api('delete_project', {
        project_id: data.project_id,
        confirmation: data.confirmation,
        name: data.name,
        acknowledged: data.acknowledged === 'on'
      });
      closeModal();
      state.data = null;
      state.present = false;
      state.tab = 'projects';
      state.slideGroup = '';
      state.chat = [];
      await loadProjects();
      render();
      toast(tr("studio_project_permanently_deleted"));
    }
    if (type === 'project-location') {
      await api('project_settings', {
        project_id: state.data.project.id,
        location: data.location
      });
      closeModal();
      await refresh();
      toast(tr("studio_project_location_saved"));
    }
    if (type === 'project-settings') {
      if (form._logoLoading) throw Error(tr("studio_please_wait_while_the_logo_preview_loads"));
      const body = new FormData(form);
      body.set('project_id', state.data.project.id);
      body.set('visibility', data.team_only === 'on' ? 'team' : 'public');
      body.delete('team_only');
      body.delete('logo');
      if (form._logoFile) body.set('logo', form._logoFile);
      if (form._removeLogo) body.set('remove_logo', '1');
      await api('project_settings', body);
      closeModal();
      await refresh();
      toast(tr("studio_project_settings_saved"));
    }
    if (type === 'studio-user') {
      state.studioUsers = (await api('save_studio_user', data)).users;
      closeModal();
      applySession(await api('session'));
      render();
    }
    if (type === 'remove-studio-user') {
      await api('remove_studio_user', data);
      closeModal();
      if (data.id === state.user.id) {
        state.studio = null;
        applySession(await api('session'));
        await resetStudio();
      } else {
        await loadStudioUsers();
        state.tab = 'studio-users';
        state.present = false;
        render();
      }
    }
    if (type === 'project-team') {
      await api('project_members', {
        project_id: state.data.project.id,
        user_ids: [...teamPicker.selected],
        roles: Object.fromEntries([...teamPicker.selected].map(id => [id, teamPicker.roles[id] || '']))
      });
      closeModal();
      if (teamPicker.selected.has(state.user.id)) {
        state.tab = 'people';
        await refresh(true);
      } else await resetStudio();
    }
    if (type === 'project-person' || type === 'remove-project-person') await peopleUi.submit(type, form);
    if (type === 'project-client' || type === 'remove-project-client') await projectClientUi.submit(type, form);
    if (type === 'new-project') {
      newProjectWizard.selected = new FormData(form).getAll('pack_version');
      newProjectWizard.details = data;
      projectWizardFiles();
    }
    if (type === 'new-project-files') await finishProjectWizard(e.submitter?.value === 'skip');
    if (type === 'iteration') {
      const r = await api('new_iteration', {
        iteration: iid,
        title: data.title
      });
      closeModal();
      await openProject(state.data.project.id, r.id);
      toast(tr("studio_new_iteration_created_all_existing_files_carried_forward"));
    }
    if (type === 'budget') {
      if (data.parent_id && data.parent_id === data.id) throw Error(tr("studio_a_quote_cannot_contain_itself"));
      await api('save_budget', {
        ...data,
        iteration: iid,
        included: data.included === 'on',
        is_optional: data.is_optional === 'on'
      });
      closeModal();
      await refresh();
      toast(tr("studio_cost_saved"));
    }
    if (type === 'contact') {
      await api('save_contact', {
        ...data,
        project_id: state.data.project.id
      });
      closeModal();
      await refresh();
      toast(tr("studio_contact_added"));
    }
    if (type === 'studio-theme') {
      if (form._logoLoading) throw Error(tr('studio_please_wait_while_the_logo_preview_loads'));
      let body = {
        name: data.name,
        language: data.language,
        business_type: data.business_type,
        theme: cleanStudioTheme(data)
      };
      if (form._logoFile || form._removeLogo) {
        const fields = new FormData();
        for (const [key, value] of Object.entries(body)) fields.set(key, key === 'theme' ? JSON.stringify(value) : value);
        if (form._logoFile) fields.set('logo', form._logoFile); else fields.set('remove_logo', '1');
        body = fields;
      }
      await api('studio_theme', body);
      state.logoVersion = Date.now();
      applySession(await api('session'));
      closeModal();
      if (state.data) await refresh(true); else render();
      toast(tr("studio_studio_settings_saved"));
    }
    if (type === 'studio-logo') {
      await api('upload_studio_logo', imageUploadData(form));
      state.logoVersion = Date.now();
      applySession(await api('session'));
      closeModal();
      if (state.data) await refresh(); else render();
      studioSettings();
      toast(tr("studio_studio_logo_saved"));
    }
    if (type === 'theme') {
      const colors = Object.entries(data).filter(([k]) => k.startsWith('color')).map(([, v]) => v);
      await api('theme', {
        iteration: iid,
        theme: {
          style: theme().style,
          font: data.font,
          mode: data.mode,
          background: data.background,
          light_background: data.light_background,
          colors
        }
      });
      closeModal();
      await refresh();
      toast(tr("studio_presentation_styling_updated"));
    }
    if (type === 'feedback') {
      const result = await api('comment', {
        iteration: iid,
        slide: data.slide,
        body: data.body,
        annotation: form.dataset.annotation ? JSON.parse(form.dataset.annotation) : null,
        mentions: mentionData(form)
      });
      closeModal();
      await refresh();
      feedbackModal();
      revealComment(result.id);
      toast(DEMO ? tr("studio_feedback_saved_for_this_demo_session") : tr("your_comment_has_been_added"));
    }
    if (type === 'comment-reply') {
      const modal = !!form.closest('.modal'), result = await api('comment', {
        iteration: data.iteration,
        slide: data.slide,
        parent_id: data.parent_id,
        body: data.body,
        mentions: mentionData(form)
      });
      commentReplyDrafts.delete(data.parent_id);
      if (modal) {
        closeModal();
        await refresh();
        feedbackModal();
      } else {
        await refresh();
        await reloadCommentFeed();
      }
      revealComment(result.id);
      toast(tr("your_reply_has_been_added"));
    }
    if (type === 'share') {
      const emails = projectClientUi.selected(form);
      if (!emails.length || emails.length > 20) throw Error(tr("studio_choose_between_1_and_20_clients"));
      const r = await api('share', {
        iteration: iid,
        client_emails: emails,
        message: data.message
      });
      await refresh();
      openModal(r.links.every(x => x.sent) ? tr("studio_it_s_on_its_way") : tr("studio_your_client_links_are_ready"), domView.fragment([domView.fragment([DEMO ? domView.element("div", [{
        "class": "notice"
      }], [tr("studio_demo_links_open_the_example_presentation_no_email_was_sent_new_project_data_is_not_shared_across_bro")], false) : domView.element("p", [], [tr("studio_copy_any_link_to_send_it_yourself_these_links_require_the_invited_client_to_sign_in_private_sign_in_")], false), domView.join(r.links.map(l => domView.element("div", [{
        "class": "link-result"
      }], [domView.element("strong", [], [l.email], false), domView.element("small", [], [l.sent ? tr("studio_sent_by_email") : tr("studio_not_emailed_copy_this_link_to_send")], false), domView.element("div", [{
        "class": "row"
      }], [domView.element("input", [{
        "value": l.url
      }, {
        "readonly": domView.text([])
      }, {
        "aria-label": tr("studio_client_presentation_link")
      }], [], false), button(tr("studio_copy"), 'copy-link', 'small', domView.attributes([{
        "data-url": l.url
      }]), 'copy')], false)], false)), '')]), domView.element("div", [{
        "class": "modal-footer"
      }], [DEMO ? button(tr("studio_try_the_client_view"), 'client-view', 'primary', '', 'eye') : button(tr("studio_done"), 'close-modal', 'primary', '', 'check')], false)]));
    }
    if (type === 'inline-slide-labels') {
      await api('save_slide', {
        ...data,
        iteration: iid
      });
      await refresh(true);
      toast(tr("studio_slide_labels_updated"));
    }
    if (type === 'slide-labels') {
      await api('save_slide', {
        ...data,
        iteration: iid
      });
      closeModal();
      await refresh();
      toast(tr("studio_slide_labels_updated"));
    }
    if (type === 'slide-image-edit') {
      showOriginalSlides.delete(data.slide_id);
      showGeneratedSlides.delete(data.slide_id);
      await api('slide_image_edit', {
        ...data,
        iteration: iid,
        mode: 'edit'
      });
      closeModal();
      await refresh();
      toast(tr("studio_creating_an_ai_variation_from_the_original_image"));
    }
    if (type === 'image-edit') {
      await api('image_edit', {
        iteration: iid,
        version_id: data.version_id,
        prompt: data.prompt
      });
      closeModal();
      await refresh();
      toast(tr("studio_your_image_variation_is_being_created"));
    }
    if (type === 'login') {
      const r = await api('request_login', {
        email: data.email,
        name: data.email.split('@')[0]
      });
      domView.mount(form, domView.element("div", [{
        "class": "notice"
      }], [r.message], false));
    }
    if (type === 'consume-login') {
      await api('consume_login', {
        token: data.token
      });
      history.replaceState(null, '', sessionStorage.getItem('studiodeck.returnTo') || '/');
      sessionStorage.removeItem('studiodeck.returnTo');
      await start();
    }
  } catch (error) {
    if (['slide-image-edit', 'image-edit'].includes(type)) {
      try {
        const current = await readProjectView(state.data.project.id, state.data.iteration.id, projectView());
        state.data.enhancements = current.enhancements;
        updateEnhancementAllowance();
      } catch {}
    }
    const div = document.createElement('div');
    div.className = 'form-error';
    div.setAttribute('role', 'alert');
    div.textContent = error.message;
    form.prepend(div);
  } finally {
    if (submit) submit.disabled = ['slide-image-edit', 'image-edit'].includes(type) && (enhancementRemaining() <= 0 || !state.data.capabilities.ai);
    if (type === 'share') projectClientUi.updateSelection(form);
  }
});
document.addEventListener('change', async e => {
  try {
    if (e.target.id === 'document-page-select') await reviewPage(e.target.dataset.version, Number(e.target.value));
    if (e.target.id === 'iteration-select') await openProject(state.data.project.id, e.target.value);
    if (e.target.matches('[data-category]')) {
      await api('category', {
        iteration: state.data.iteration.id,
        asset_id: e.target.dataset.category,
        category: e.target.value
      });
      if (e.target.value === 'legal') {
        const file = state.data.files.find(f => f.asset_id === e.target.dataset.category);
        await api('reprocess', {
          iteration: state.data.iteration.id,
          version_id: file.id
        });
      }
      await refresh();
      toast(e.target.value === 'legal' ? tr("studio_legal_text_extraction_queued") : tr("studio_category_updated"));
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'file-search') {
    state.search = e.target.value;
    projectLoadSequence++;
    clearTimeout(fileSearchTimer);
    syncWorkspaceUrl(true);
    fileSearchTimer = setTimeout(refreshFileGrid, 250);
  }
});
document.addEventListener('click', e => {
  if (e.target.closest('[data-action]')) return;
  const dz = e.target.closest('[data-dropzone]');
  if (dz) {
    chooseFiles();
    return;
  }
});
document.addEventListener('dragover', e => {
  const dz = e.target.closest('[data-dropzone]');
  if (dz) {
    e.preventDefault();
    dz.classList.add('dragging');
  }
});
document.addEventListener('dragleave', e => {
  const dz = e.target.closest('[data-dropzone]');
  if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('dragging');
});
document.addEventListener('drop', e => {
  const dz = e.target.closest('[data-dropzone]');
  if (dz) {
    e.preventDefault();
    dz.classList.remove('dragging');
    uploadFiles([...e.dataTransfer.files]).catch(error => toast(error.message));
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (activeModal) closeModal(); else if (isPresentationFullscreen()) {
      exitPresentationFullscreen().catch(e => toast(e.message));
    } else if (state.present && !state.client && !justExitedFullscreen()) {
      selectProjectTab(state.tab).catch(error => toast(error.message));
    }
    $('.sidebar')?.classList.remove('open');
  }
  if (activeModal && e.key === 'Tab') {
    const list = [...document.querySelectorAll('.modal button:not(:disabled),.modal input:not([type="hidden"]):not(:disabled),.modal select,.modal textarea,.modal a,.modal summary,.modal video[controls]')].filter(el => el.getClientRects().length && !el.closest('[hidden]'));
    if (!list.length) return;
    const first = list[0], last = list.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  if (e.target.closest('input,textarea,select') || activeModal) return;
  if (state.present && state.presentationMode !== 'scroll' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault();
    moveSlide(e.key === 'ArrowRight' ? 1 : -1);
  }
  if (e.target.matches('[data-dropzone]') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    chooseFiles();
  }
});
function renderLogin(token = '') {
  const hasToken = !!token;
  domView.mount($('#app'), domView.element("main", [{
    "class": "login"
  }, {
    "id": "main"
  }], [domView.element("div", [{
    "class": "login-image"
  }], [domView.element("img", [{
    "src": "assets/interior.webp"
  }, {
    "alt": tr("error_a_warm_light_filled_interior")
  }], [], false)], false), domView.element("div", [{
    "class": "login-content"
  }], [brand(), domView.element("h1", [], [hasToken ? tr("welcome_back") : domView.fragment([tr("good_design"), domView.element("br", [], [], false), tr("beautifully_together")])], false), domView.element("p", [], [hasToken ? tr("continue_to_your_studios_and_shared_projects") : tr("your_projects_presentations_and_clients_one_considered_space")], false), domView.element("form", [{
    "data-form": hasToken ? 'consume-login' : 'login'
  }], [hasToken ? domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "token"
  }, {
    "value": token
  }], [], false) : domView.element("label", [], [tr("your_email_address"), domView.element("input", [{
    "type": "email"
  }, {
    "name": "email"
  }, {
    "placeholder": "you@yourstudio.com"
  }, {
    "autocomplete": "email"
  }, {
    "required": domView.text([])
  }], [], false)], false), domView.element("button", [{
    "class": "button primary wide"
  }, {
    "type": "submit"
  }], [domView.fragment([hasToken ? tr("continue") : tr("email_me_a_sign_in_link"), icon('arrow')])], false), domView.element("small", [], [tr("no_password_to_remember_your_sign_in_lasts_14_days_on_this_device")], false)], false)], false)], false));
}
let routeLoading = false;
async function start() {
  routeLoading = true;
  let success = false;
  try {
    const match = location.hash.match(/^#\/(view|login|preview)\/([^/]+)$/);
    if (match?.[1] === 'login' || match?.[1] === 'view') {
      location.replace(safeUrl(domView.concat('/login', location.hash), 'href'));
      return;
    }
    state.client = false;
    state.shareToken = '';
    state.clientShareId = '';
    state.accountClientProject = '';
    const session = await api('session');
    applySession(session);
    if (TOUR_MODE) {
      await loadProjects();
      state.tab = 'overview';
      await openProject('tour-project', null, false, true);
      appTourGuide({
        state,
        stats: tourData.stats,
        esc,
        prepare: prepareAppTourStep
      }).start();
      success = true;
      return;
    }
    const route = readWorkspaceRoute(location), clientRoute = readClientRoute(location);
    if (!state.user) {
      if (route || clientRoute || location.pathname === '/choose') sessionStorage.setItem('studiodeck.returnTo', domView.concat(location.pathname, location.search));
      location.replace(safeUrl('/login', 'href'));
      return;
    }
    if (clientRoute) {
      await openClientProject(clientRoute.projectId, clientRoute.iteration, clientRoute.slide, clientRoute.presentationMode || 'slides');
      success = true;
      return;
    }
    if (location.pathname === '/choose') {
      await showDestinations();
      success = true;
      return;
    }
    if (match?.[1] === 'preview') {
      const d = await api('deck', {
        iteration: match[2]
      });
      await loadProjects();
      state.tab = 'overview';
      await openProject(d.project.id, d.iteration.id, true);
      success = true;
      return;
    }
    if (route) await openWorkspaceRoute(route); else await showDestinations(true);
    success = true;
  } catch (error) {
    routeError(error);
  } finally {
    routeLoading = false;
    if (success) syncWorkspaceUrl(true);
  }
}
function routeError(error) {
  if (activeModal) closeModal();
  if (magnifiedPhoto) closePhotoLightbox(false);
  clearTimeout(state.poll);
  stopSlideMedia();
  stopScrollPresentation();
  cancelSlideMotion();
  scrollImageObserver?.disconnect();
  state.present = false;
  state.routeFailed = true;
  clearPresentationTheme();
  document.body.classList.remove('presenting', 'presentation-reading', 'website-editing');
  if (isPresentationFullscreen()) exitPresentationFullscreen().catch(() => {});
  mountErrorPage($('#app'), error, {
    language: getLanguage(),
    signedIn: !!state.user,
    email: state.user?.email
  });
}
function syncWorkspaceUrl(replace = false) {
  if (TOUR_MODE) return;
  if (routeLoading || !state.user || state.present && state.hiddenPreview && slideDefs()[state.slide]?.hidden) return;
  const accountPath = state.client && state.accountClientProject ? clientProjectUrl(state.accountClientProject, state.data?.iteration.id, slideDefs()[state.slide]?.id, state.presentationMode) : state.tab === 'destinations' && !state.present ? '/choose' : null;
  if (accountPath) {
    if (accountPath !== domView.concat(location.pathname, location.search) || location.hash) history[replace ? 'replaceState' : 'pushState'](null, '', accountPath);
    return;
  }
  if (state.client || !state.studio?.id) return;
  const globalViews = ['projects', 'studio-users', 'all-comments', 'profile', 'billing', 'website'];
  const view = state.settingsOpen ? 'settings' : state.present ? 'slide' : globalViews.includes(state.tab) ? state.tab : state.data ? 'project' : 'projects';
  const path = workspaceUrl({
    studioId: state.studio.id,
    view,
    presentationMode: state.presentationMode,
    websiteEditing: !!state.websiteEditing,
    communicationFilter,
    projectId: state.data?.project.id,
    iteration: state.data?.iteration.id,
    tab: state.tab,
    slide: state.present ? slideDefs()[state.slide]?.id : undefined,
    search: state.projectSearch,
    archived: state.showArchived,
    slideTypes: state.slideTypes,
    slideView: state.slideView,
    slideGroup: state.slideGroup,
    fileSearch: state.search,
    fileCategories: state.fileCategories ? [...state.fileCategories] : null,
    userSearch: state.studioUserSearch,
    communication: state.tab === 'all-comments' ? {
      filter: communicationFilter,
      ...communicationControls.params
    } : communication.params
  });
  if (path !== domView.concat(location.pathname, location.search) || location.hash) history[replace ? 'replaceState' : 'pushState'](null, '', path);
}
async function openWorkspaceRoute(route) {
  if (website.active()) await website.save();
  clearTimeout(projectSearchTimer);
  clearTimeout(fileSearchTimer);
  clearTimeout(studioUserSearchTimer);
  projectsRequest++;
  studioUsersRequest++;
  const prior = routeLoading;
  routeLoading = true;
  try {
    clearTimeout(state.poll);
    if (activeModal) closeModal();
    if (magnifiedPhoto) closePhotoLightbox(false);
    state.client = false;
    state.shareToken = '';
    state.clientShareId = '';
    state.accountClientProject = '';
    state.settingsOpen = false;
    state.feedItems = [];
    if (state.studio?.id !== route.studioId) applySession(await api('switch_studio', {
      studio_id: route.studioId
    }));
    state.projectSearch = route.search || '';
    state.showArchived = !!route.archived;
    state.slideTypes = route.slideTypes ?? null;
    state.slideView = route.slideView || 'list';
    state.slideGroup = route.slideGroup || '';
    state.search = route.fileSearch || '';
    state.fileCategories = route.fileCategories ? new Set(route.fileCategories) : null;
    state.studioUserSearch = route.userSearch || '';
    communication.restore(route.communication || ({}));
    communicationControls.restore(route.communication || ({}));
    if (state.capabilities?.batch_json ? ['projects', 'settings'].includes(route.view) : !useProjectData() || !['project', 'slide'].includes(route.view)) await loadProjects();
    if (!DEMO && studioSetup.required()) {
      state.data = null;
      state.present = false;
      state.websiteEditing = false;
      state.tab = 'projects';
      render();
      return;
    }
    if (route.view === 'project' || route.view === 'slide') {
      let projectId = route.projectId, iteration = route.iteration;
      if (route.view === 'slide' && !projectId) {
        const found = await api('resolve_slide', {
          slide: route.slide,
          iteration
        });
        projectId = found.project_id;
        iteration = found.iteration_id;
      }
      state.presentationMode = route.presentationMode || 'slides';
      state.tab = route.view === 'project' ? route.tab : 'slides';
      if (!await openProject(projectId, iteration, route.view === 'slide', false, {
        slide: route.slide,
        tab: route.tab,
        fromRoute: true
      })) return;
      if (route.view === 'slide') {
        state.inspectHidden = false;
        const defs = slideDefs(), index = defs.findIndex(s => s.id === route.slide || s.record?.id === route.slide);
        if (index < 0) throw Object.assign(Error(tr("studio_this_slide_is_no_longer_available_in_this_iteration")), {
          status: 404
        });
        state.slide = index;
        state.present = true;
        render();
        if (state.presentationMode === 'scroll') scrollToSlide(defs[index].id, {
          smooth: false
        });
      } else if (state.tab === 'comments' && !useProjectData()) {
        await loadFeed();
        render();
      }
    } else {
      state.data = null;
      state.present = false;
      state.tab = route.view === 'settings' ? 'projects' : route.view;
      if (route.view === 'profile') state.profile = (await api('profile')).profile;
      state.websiteEditing = route.view === 'website' && !!route.editing;
      if (route.view === 'website') await website.load();
      if (route.view === 'billing') await billing.load();
      if (route.view === 'all-comments') communicationFilter = route.filter || 'open';
      if (route.view === 'studio-users') await loadStudioUsers();
      if (route.view === 'all-comments') await loadFeed();
      render();
      if (route.view === 'settings') studioSettings();
      if (route.view === 'billing') await billing.returned();
    }
  } finally {
    routeLoading = prior;
    pollJobs();
  }
}
window.addEventListener('popstate', async () => {
  try {
    const route = readWorkspaceRoute(location);
    if (route && !readClientRoute(location) && state.user) {
      await openWorkspaceRoute(route);
      syncWorkspaceUrl(true);
    } else await start();
  } catch (error) {
    routeError(error);
  }
});
let processingView = {
  visible: false,
  uploading: false,
  ids: [],
  iteration: null
};
let processingFocus = null;
function processingJobs() {
  return (state.data?.jobs || []).filter(j => !processingView.ids.length || processingView.ids.includes(j.version_id));
}
function processingDescription() {
  const job = (state.data?.jobs || []).find(j => j.status === 'running') || (state.data?.jobs || []).find(j => j.status === 'queued');
  if (job?.type === 'slide_video') return tr('media_generating');
  if (job?.type === 'slide_image_edit' || job?.type === 'image_edit') return tr("studio_changing_your_image_with_ai_the_result_will_appear_on_its_slide");
  const p = extractionProgress(job);
  return domView.text(["", p.title, " · ", p.detail, " · ", p.percent, "%"]);
}
function jobStatusNotice() {
  const failed = (state.data.jobs || []).filter(j => j.status === 'failed');
  if (failed.some(j => !j.dismissed_at)) return domView.element("div", [{
    "class": "notice"
  }], [tr('studio_some_files_need_attention', {
    v0: button(tr('studio_review_processing'), 'job-status', 'small')
  })], false);
  return '';
}
function jobStatusContent(view = 'open') {
  const failed = (state.data.jobs || []).filter(j => j.status === 'failed'), dismissed = view === 'dismissed', visible = failed.filter(j => !!j.dismissed_at === dismissed);
  return domView.fragment([domView.element("div", [{
    "class": "job-status-tabs"
  }, {
    "role": "tablist"
  }, {
    "aria-label": tr('studio_review_processing')
  }], [domView.join(['open', 'dismissed'].map(key => domView.element("button", [{
    "type": "button"
  }, {
    "class": domView.text(["tab ", view === key ? 'active' : ''])
  }, {
    "role": "tab"
  }, {
    "id": domView.text(["job-status-", key])
  }, {
    "aria-selected": view === key
  }, {
    "aria-controls": "job-status-panel"
  }, {
    "tabindex": view === key ? 0 : -1
  }, {
    "data-action": "job-status-tab"
  }, {
    "data-view": key
  }], [domView.fragment([tr(domView.concat('studio_processing_', key)), " "]), domView.element("span", [], [failed.filter(j => !!j.dismissed_at === (key === 'dismissed')).length], false)], false)), '')], false), domView.element("div", [{
    "id": "job-status-panel"
  }, {
    "role": "tabpanel"
  }, {
    "aria-labelledby": domView.text(["job-status-", view])
  }, {
    "tabindex": "0"
  }], [domView.join(visible.map(j => domView.element("div", [{
    "class": "history-item job-review-item"
  }], [domView.element("span", [], [domView.element("strong", [], [j.name || j.type.replaceAll('_', ' ')], false), domView.element("small", [], [j.error], false)], false), domView.element("div", [{
    "class": "job-review-actions"
  }], [domView.fragment([!dismissed && editable() ? j.type === 'slide_video' ? button(tr('media_add_motion'), 'photo-motion', 'small', domView.attributes([{
    "data-id": j.slide_id
  }])) : button(tr('studio_retry'), 'retry-job', 'small', domView.attributes([{
    "data-id": j.id
  }])) : '', state.data.can_edit !== false ? button(tr(dismissed ? 'restore' : 'dismiss'), dismissed ? 'restore-job' : 'dismiss-job', 'small ghost', domView.attributes([{
    "data-id": j.id
  }])) : ''])], false)], false)), '') || domView.element("p", [{
    "class": "muted job-status-empty"
  }, {
    "role": "status"
  }], [tr(dismissed ? 'studio_no_dismissed_processing' : 'studio_no_files_need_attention')], false)], false), domView.element("div", [{
    "class": "modal-footer"
  }], [button(tr('close_dialog'), 'close-modal', 'ghost')], false)]);
}
document.addEventListener('keydown', event => {
  if (!event.target.matches('[data-action="job-status-tab"]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...event.target.closest('[role="tablist"]').querySelectorAll('[role="tab"]')], index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : domView.concat(domView.concat(tabs.indexOf(event.target), event.key === 'ArrowRight' ? 1 : -1), tabs.length) % tabs.length;
  tabs[index].click();
});
function processingBanner() {
  return pending() ? domView.element("div", [{
    "class": "notice processing-banner"
  }], [domView.element("span", [{
    "class": "loading-inline"
  }, {
    "aria-hidden": "true"
  }], [], false), domView.element("span", [{
    "role": "status"
  }], [processingDescription()], false), button(tr("studio_view_progress"), 'show-processing', 'small')], false) : '';
}
function showProcessing(uploading = false, ids = [], projectSetup = false) {
  processingFocus = document.activeElement;
  processingView = {
    visible: true,
    uploading,
    ids,
    projectSetup,
    iteration: state.data?.iteration.id
  };
  if (activeModal) closeModal();
  renderProcessing();
  $('#processing-overlay [data-action="hide-processing"]')?.focus();
}
function hideProcessing() {
  processingView.visible = false;
  $('#processing-overlay')?.remove();
  $('#app').inert = false;
  $('#overlay').inert = false;
  document.body.classList.remove('processing-open');
  if (processingFocus?.isConnected) processingFocus.focus();
}
function renderProcessing() {
  if (!processingView.visible) return;
  if (processingView.iteration !== state.data?.iteration.id) {
    hideProcessing();
    return;
  }
  let root = $('#processing-overlay');
  if (!root) {
    root = document.createElement('div');
    root.id = 'processing-overlay';
    root.className = 'processing-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'processing-title');
    domView.mount(root, domView.fragment([domView.element("button", [{
      "class": "icon-button processing-close"
    }, {
      "data-action": "hide-processing"
    }, {
      "aria-label": tr("studio_close_processing_overlay")
    }], [icon('close')], false), domView.element("div", [{
      "class": "processing-content"
    }], [], false)]));
    document.body.append(root);
  }
  $('#app').inert = true;
  $('#overlay').inert = true;
  document.body.classList.add('processing-open');
  const jobs = processingJobs(), active = jobs.find(j => j.status === 'running') || jobs.find(j => j.status === 'queued'), complete = jobs.length && !active && !processingView.uploading, failed = jobs.filter(j => j.status === 'failed'), done = jobs.filter(j => j.status === 'done').length;
  if (processingView.projectSetup && !processingView.uploading && !processingView.error && (complete && !failed.length || DEMO && state.data.files.length)) {
    hideProcessing();
    selectProjectTab('overview').catch(error => toast(error.message));
    toast(tr("studio_your_project_is_ready_to_explore"));
    return;
  }
  const warningCount = jobs.reduce((n, j) => domView.concat(n, j.progress?.warning_count || 0), 0);
  const videoJob = active?.type === 'slide_video';
  const imageJob = active && ['slide_image_edit', 'image_edit', 'slide_video'].includes(active.type);
  const progress = active?.progress, stage = processingView.uploading ? 'uploading' : active?.status === 'queued' ? 'queued' : progress?.stage || 'reading_pages';
  const heading = processingView.error ? tr("studio_upload_needs_attention") : complete ? failed.length ? tr("studio_some_files_need_your_attention") : tr("studio_your_files_are_ready_to_review") : videoJob ? tr('media_generating') : imageJob ? tr("studio_changing_your_image_with_ai") : extractionStages[stage] || tr("studio_processing_your_files");
  const overall = extractionProgress(active), section = overall.step;
  const content = domView.fragment([domView.element("div", [{
    "class": domView.text(["processing-art ", complete || processingView.error ? 'is-complete' : ''])
  }, {
    "aria-hidden": "true"
  }], [domView.element("span", [], [], false), domView.element("span", [], [], false), domView.element("span", [], [icon(complete ? 'check' : 'file')], false), domView.element("i", [], [], false)], false), domView.element("p", [{
    "class": "eyebrow"
  }], [tr("studio_bringing_your_project_together")], false), domView.element("h1", [{
    "id": "processing-title"
  }], [heading], false), domView.element("p", [{
    "class": "processing-detail"
  }, {
    "role": "status"
  }], [domView.fragment([processingView.error || (complete ? tr("studio_file_processed_explore_the_extracted_pages_images_and_palette", {
    v0: done,
    v1: done === 1 ? '' : 's'
  }) : active?.name || tr("studio_your_originals_are_being_safely_stored")), !complete && !processingView.uploading ? domView.fragment([domView.element("br", [], [], false), videoJob ? tr('media_ai_hint') : imageJob ? tr("studio_refining_light_textures_shadows_the_result_will_appear_on_its_slide") : overall.detail]) : ''])], false), domView.fragment([!imageJob ? domView.element("ol", [{
    "class": "processing-stages"
  }], [domView.join(processingSteps.map((label, n) => domView.element("li", [{
    "class": !complete && n === section ? 'current' : complete || n < section ? 'finished' : ''
  }], [domView.element("span", [], [complete || n < section ? icon('check') : domView.concat(n, 1)], false), label], false)), '')], false) : '', !complete && !processingView.error && !processingView.uploading && !imageJob ? domView.fragment([domView.element("div", [{
    "class": "processing-track determinate"
  }, {
    "role": "progressbar"
  }, {
    "aria-label": tr("studio_file_processing_progress")
  }, {
    "aria-valuemin": "0"
  }, {
    "aria-valuemax": "100"
  }, {
    "aria-valuenow": overall.percent
  }, {
    "aria-valuetext": overall.detail
  }], [domView.element("span", [{
    "style": domView.text(["width:", overall.percent, "%"])
  }], [], false)], false), domView.element("p", [{
    "class": "processing-percent"
  }], [tr("studio_of_this_file_larger_documents_can_take_several_minutes", {
    v3: overall.percent
  })], false)]) : '']), domView.element("p", [{
    "class": "processing-count"
  }], [jobs.length ? tr("studio_of_files_completed", {
    v0: done,
    v1: jobs.length
  }) : processingView.uploading ? tr("studio_uploading") : ''], false), domView.fragment([complete && warningCount ? domView.element("p", [{
    "class": "notice"
  }], [tr("studio_extraction_note_to_review_in_files", {
    v0: warningCount,
    v1: warningCount === 1 ? '' : 's'
  })], false) : '', domView.join(failed.map(j => domView.element("p", [{
    "class": "form-error"
  }], [domView.fragment([j.name, ": ", j.error])], false)), '')]), domView.element("div", [{
    "class": "processing-footer"
  }], [complete ? button(tr("studio_review_files"), 'review-processed', 'primary', '', 'arrow') : button(tr("studio_continue_working"), 'hide-processing', 'primary', '', 'arrow'), domView.element("p", [], [complete ? tr("studio_open_any_document_to_inspect_its_pages_and_images") : tr("studio_slides_appear_when_each_file_finishes_you_can_close_this_view_processing_continues_in_the_background")], false)], false)]);
  const target = root.querySelector('.processing-content');
  domView.update(target, content);
}
function pageVisuals(category) {
  return (state.data?.files || []).flatMap(f => {
    const pages = (f.pages || []).filter(p => p.has_preview && (p.category === category || f.category === category && (!p.category || ['other', 'presentation'].includes(p.category)) || category === 'presentation' && f.category === category));
    return pages.length ? pages.map(p => ({
      ...f,
      page_number: p.number,
      get name() {
        return tr("studio_page_3", {
          v0: f.name,
          v1: p.number
        });
      },
      has_preview: true
    })) : f.category === category && !f.pages?.length ? [f] : [];
  });
}
const imageKey = (f, size = 'large') => domView.text(["", size || 'original', ":", f.id, "", f.show_original ? '@original' : '', "", f.page_number ? domView.concat('@', f.page_number) : '', "", f.image_number ? domView.concat('@', f.image_number) : '', "", f.slide_image_version && !f.show_original ? domView.concat('@variant-', f.slide_image_version) : '', ""]);
function imageSlideCaption(version, page, image) {
  const defs = slideDefs(), index = defs.findIndex(s => s.record && s.record.source_version_id === version && s.record.page_number === page && s.record.image_number === image);
  if (index < 0) return '';
  const s = defs[index];
  return domView.fragment([domView.element("div", [{
    "class": "image-slide-label"
  }], [domView.fragment([visualTypes[s.type], " · ", situations[s.situation]])], false), button(tr("studio_view_slide_2"), 'go-slide', 'small ghost', domView.attributes([{
    "data-slide": index
  }]), 'slide')]);
}
let pageReviewSequence = 0;
async function reviewPage(id, number = 1) {
  const f = state.data.files.find(f => f.id === id);
  if (!f) return;
  const sequence = ++pageReviewSequence;
  openModal(tr("studio_inside_your_document"), domView.fragment([domView.element("p", [], [f.name], false), domView.element("p", [], [domView.element("span", [{
    "class": "loading-inline"
  }], [], false), domView.fragment([" ", tr("studio_opening_page", {
    v1: number
  })])], false)]));
  if (!f.pages?.length) {
    openModal(tr("studio_inside_your_document"), domView.fragment([domView.element("p", [], [f.name], false), domView.element("p", [], [tr("studio_this_file_has_no_extracted_pages_yet")], false), domView.fragment([editable() ? button(tr("studio_extract_pages_images"), 'reprocess', 'primary', domView.attributes([{
      "data-id": id
    }]), 'spark') : '', domView.join((f.metadata?.warnings || []).map(w => domView.element("p", [{
      "class": "notice"
    }], [w], false)), '')])]));
    return;
  }
  const p = await api('document_page', {
    iteration: state.data.iteration.id,
    id,
    page: number
  });
  if (sequence !== pageReviewSequence || !activeModal) return;
  const meta = p.metadata || ({}), suggestion = meta.analysis || ({}), pageImage = {
    ...f,
    page_number: number
  };
  openModal(tr("studio_inside_your_document"), domView.fragment([domView.element("p", [], [f.name], false), domView.element("div", [{
    "class": "page-review-nav"
  }], [domView.element("label", [], [tr("studio_page_4"), domView.element("select", [{
    "id": "document-page-select"
  }, {
    "data-version": id
  }], [domView.join(f.pages.map(page => domView.element("option", [{
    "value": page.number
  }, domView.spread(page.number === number ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr("studio_of", {
    v2: page.number,
    v3: f.metadata?.page_count || f.pages.length
  })], false)), '')], false)], false), domView.element("span", [], [tr("studio_extracted_image_2", {
    v3: p.images.length,
    v4: p.images.length === 1 ? '' : 's'
  })], false), editable() ? button(tr("studio_extract_again"), 'reprocess', 'small', domView.attributes([{
    "data-id": id
  }]), 'spark') : ''], false), meta.extraction_plan ? domView.element("div", [{
    "class": "notice page-plan-note"
  }], [domView.element("strong", [], [tr("studio_page_type", {
    v0: meta.extraction_plan.content_type,
    v1: meta.extraction_plan.strategy === 'preserve' ? tr("studio_composition_kept_intact") : meta.extraction_plan.strategy === 'separate' ? tr("studio_independent_images") : tr("studio_no_project_images")
  })], false), domView.element("p", [], [meta.extraction_plan.reason], false), meta.extraction_plan.excluded?.length ? domView.element("small", [], [tr("studio_branding_decorative_region_s_excluded", {
    v0: meta.extraction_plan.excluded.length
  })], false) : ''], false) : '', domView.element("div", [{
    "class": "page-review-grid"
  }], [domView.element("div", [{
    "class": "page-review-preview"
  }], [p.has_preview ? img(pageImage, domView.concat(domView.concat(domView.concat(domView.text(["", tr("studio_page_4"), " "]), number), ' of '), f.name)) : domView.element("p", [{
    "class": "notice"
  }], [tr("studio_slide_preview_unavailable_extracted_text_and_images_are_below")], false)], false), domView.element("div", [], [domView.element("h3", [], [tr("studio_text_on_this_page")], false), meta.text_blocks?.some(b => b.source === 'ocr') ? domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_includes_text_read_from_images_check_it_against_the_page")], false) : '', domView.element("pre", [{
    "class": "extracted-text"
  }], [p.text || tr("studio_no_readable_text_found_on_this_page")], false), domView.element("h3", [], [tr("studio_colors_from_this_page")], false), domView.element("div", [{
    "class": "extracted-palette"
  }], [domView.join((meta.palette || []).map(c => domView.element("span", [], [domView.element("i", [{
    "style": domView.text(["background:", c.hex])
  }], [], false), c.hex], false)), '') || domView.element("p", [{
    "class": "muted"
  }], [tr("studio_no_material_colors_detected")], false)], false), suggestion.summary ? domView.fragment([domView.element("h3", [], [suggestion.style || tr("studio_page_observations")], false), domView.element("p", [], [suggestion.summary], false), domView.element("p", [{
    "class": "muted"
  }], [domView.fragment([suggestion.evidence, suggestion.confidence ? domView.concat(domView.concat(' · ', suggestion.confidence), ' confidence') : ''])], false)]) : ''], false)], false), domView.fragment([p.images.length ? domView.fragment([domView.element("h3", [], [tr("studio_images_from_page", {
    v0: number
  })], false), domView.element("div", [{
    "class": "extracted-images"
  }], [domView.join(p.images.map(im => domView.element("figure", [], [img({
    ...pageImage,
    image_number: im.number
  }, domView.concat(domView.text(["", tr("studio_extracted_image"), " "]), im.number)), domView.element("figcaption", [], [tr("studio_image", {
    v1: im.number,
    v2: im.kind === 'composed_visual' ? tr("studio_complete_composition") : im.kind === 'independent_visual' ? tr("studio_independent_image") : tr("studio_page_crop"),
    v3: imageSlideCaption(id, number, im.number)
  })], false)], false)), '')], false)]) : '', domView.join((meta.warnings || []).map(w => domView.element("p", [{
    "class": "notice"
  }], [w], false)), '')])]));
  $('.modal')?.classList.add('document-modal');
  hydrateImages();
}
document.addEventListener('keydown', e => {
  if (!processingView.visible) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    hideProcessing();
  }
  if (e.key === 'Tab') {
    const controls = [...document.querySelectorAll('#processing-overlay button')];
    const first = controls[0], last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
}, true);
let magnifiedPhoto = false;
function activePhotoButton() {
  return state.presentationMode === 'scroll' ? document.getElementById(domView.concat('scroll-slide-', slideDefs()[state.slide]?.id))?.querySelector('.photo-magnify') : document.querySelector('.photo-magnify');
}
function photoContentRect(im) {
  const r = im.getBoundingClientRect(), ratio = im.naturalWidth / im.naturalHeight;
  if (!Number.isFinite(ratio) || ratio <= 0) return r;
  const width = Math.min(r.width, r.height * ratio), height = width / ratio;
  return {
    left: domView.concat(r.left, (r.width - width) / 2),
    top: domView.concat(r.top, (r.height - height) / 2),
    width,
    height
  };
}
function photoTransform(from, to) {
  return domView.text(["translate(", domView.concat(from.left, from.width / 2) - to.left - to.width / 2, "px,", domView.concat(from.top, from.height / 2) - to.top - to.height / 2, "px) scale(", from.width / to.width, ",", from.height / to.height, ")"]);
}
function openPhotoLightbox() {
  const def = slideDefs()[state.slide];
  if (!def?.visual) return;
  const source = activePhotoButton()?.querySelector('img'), from = source?.complete && source.naturalWidth ? photoContentRect(source) : null;
  magnifiedPhoto = true;
  renderPhotoLightbox();
  const im = $('#photo-lightbox img');
  if (from && im && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const to = photoContentRect(im);
    if (to.width && to.height) im.animate([{
      transform: photoTransform(from, to)
    }, {
      transform: 'none'
    }], {
      duration: 240,
      easing: 'cubic-bezier(.2,.75,.25,1)'
    });
  }
  $('#photo-lightbox [data-action="close-photo"]')?.focus();
}
function renderPhotoLightbox() {
  if (!magnifiedPhoto) return;
  const defs = slideDefs(), def = defs[state.slide];
  if (!def?.visual) {
    closePhotoLightbox(false);
    return;
  }
  let root = $('#photo-lightbox');
  if (!root) {
    root = document.createElement('div');
    root.id = 'photo-lightbox';
    root.className = 'photo-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', tr("full_screen_image"));
    document.body.append(root);
  }
  const original = showOriginalSlides.has(def.record?.id), f = selectedSlideVisual(def, original);
  const key = domView.concat(domView.concat(domView.concat(domView.concat(domView.concat(domView.concat(domView.concat(domView.concat(getLanguage(), '-'), def.id), '-'), imageKey(f)), '-'), comparingImage(def)), '-'), slideImageJob(def.record?.id)?.status || '');
  if (root.dataset.photo !== key) {
    const focusAction = root.contains(document.activeElement) ? document.activeElement.dataset.action : 'close-photo';
    domView.mount(root, domView.fragment([domView.element("header", [{
      "class": "photo-lightbox-header"
    }], [domView.element("div", [], [domView.element("strong", [], [def.title], false)], false), domView.element("button", [{
      "class": "icon-button"
    }, {
      "data-action": "close-photo"
    }, {
      "aria-label": tr("close_full_screen_image")
    }], [icon('close')], false)], false), domView.element("div", [{
      "class": "photo-lightbox-stage"
    }], [domView.element("button", [{
      "class": "icon-button photo-lightbox-prev"
    }, {
      "data-action": "previous-photo-slide"
    }, {
      "aria-label": tr("previous_slide")
    }, domView.spread(state.slide === 0 ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], [icon('left')], false), domView.element("figure", [], [visualImageArea(def, f, true)], false), domView.element("button", [{
      "class": "icon-button photo-lightbox-next"
    }, {
      "data-action": "next-photo-slide"
    }, {
      "aria-label": tr("next_slide")
    }, domView.spread(state.slide === defs.length - 1 ? domView.attributes([{
      "disabled": domView.text([])
    }]) : '')], [icon('right')], false)], false), domView.element("footer", [], [domView.element("span", [], [domView.fragment([domView.concat(state.slide, 1), " / ", defs.length])], false), domView.element("span", [], [tr("navigate_slides_esc_to_close")], false), domView.element("small", [], [tr("presented_by_studiodeck")], false)], false)]));
    root.dataset.photo = key;
    root.querySelector(domView.text(["[data-action=\"", focusAction || 'close-photo', "\"]"]))?.focus();
  }
  $('#app').inert = true;
  $('#overlay').inert = true;
  document.body.classList.add('photo-lightbox-open');
  hydrateImages();
}
function closePhotoLightbox(animate = true) {
  const root = $('#photo-lightbox');
  if (!root) return;
  magnifiedPhoto = false;
  const im = root.querySelector('img'), target = activePhotoButton()?.querySelector('img');
  const finish = () => {
    root.remove();
    $('#app').inert = false;
    $('#overlay').inert = false;
    document.body.classList.remove('photo-lightbox-open');
    activePhotoButton()?.focus({
      preventScroll: true
    });
  };
  if (animate && im && target && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const from = photoContentRect(im), to = photoContentRect(target);
    root.style.pointerEvents = 'none';
    if (from.width && to.width) {
      im.animate([{
        transform: 'none'
      }, {
        transform: photoTransform(to, from)
      }], {
        duration: 180,
        easing: 'ease-in',
        fill: 'forwards'
      }).finished.then(finish, finish);
      return;
    }
  }
  finish();
}
function navigatePhotoLightbox(direction) {
  const defs = slideDefs(), next = domView.concat(state.slide, direction);
  if (next < 0 || next >= defs.length) return;
  if (defs[next].type === 'photo') {
    moveSlide(direction);
    renderPhotoLightbox();
  } else {
    closePhotoLightbox(false);
    moveSlide(direction);
  }
}
document.addEventListener('keydown', e => {
  if (!magnifiedPhoto || e.target.closest('[data-comparison-range], [data-image-variant]')) return;
  if (['ArrowLeft', 'ArrowRight', 'Escape'].includes(e.key)) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Escape') closePhotoLightbox(); else navigatePhotoLightbox(e.key === 'ArrowRight' ? 1 : -1);
    return;
  }
  if (e.key === 'Tab') {
    const controls = [...document.querySelectorAll('#photo-lightbox button:not(:disabled),#photo-lightbox input')], first = controls[0], last = controls.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
}, true);
start();
function applySession(session) {
  if (state.user?.id !== session.user?.id || state.studio?.id !== session.studio?.id) {
    projectLoadSequence++;
    projectData.reset();
    state.data = null;
  }
  state.profile = null;
  state.user = session.user;
  state.capabilities = session.capabilities;
  state.billing = session.billing;
  state.unreadCount = session.unread_count || 0;
  state.csrf = session.csrf;
  state.studio = session.studio;
  state.studios = session.studios;
  state.studioTheme = cleanStudioTheme(session.studio_theme || ({}));
  projectData.primeAppContext(session);
  syncLanguage();
}
async function resetStudio() {
  projectLoadSequence++;
  clearTimeout(state.poll);
  imageCache.forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  });
  imageCache.clear();
  state.data = null;
  state.present = false;
  state.tab = 'projects';
  state.studioUsers = [];
  state.studioUserSearch = '';
  state.projectSearch = '';
  state.showArchived = false;
  state.studioEmpty = false;
  await loadProjects();
  render();
  pollJobs();
}
let studioUsersRequest = 0, studioUserSearchTimer;
async function loadStudioUsers() {
  const request = ++studioUsersRequest, studio = state.studio?.id, search = state.studioUserSearch || '';
  const result = await api('studio_users', {
    search
  });
  if (request !== studioUsersRequest || studio !== state.studio?.id || search !== (state.studioUserSearch || '')) return false;
  state.studioUsers = result.users;
  state.studioUserTotal = result.total ?? result.users.length;
  if (result.billing) state.billing = result.billing;
  return true;
}
async function refreshStudioUserGrid() {
  try {
    if (await loadStudioUsers() && state.tab === 'studio-users') {
      domView.mount($('#studio-user-list'), studioUserRows());
      $('#studio-user-count').textContent = studioUserCount();
    }
  } catch (error) {
    toast(error.message);
  }
}
function studioTeamFull() {
  const limit = state.billing?.limits?.seats;
  return limit != null && (state.studioUserTotal ?? (state.studioUsers || []).length) >= limit;
}
document.addEventListener('input', e => billing.capacityChanged(e.target.form));
function matchingStudioUsers() {
  return state.studioUsers || [];
}
function studioUserRows() {
  return domView.join(matchingStudioUsers().map(u => domView.element("article", [{
    "class": "member-row"
  }], [personAvatar(u.profile, u.name), domView.element("div", [], [domView.element("strong", [], [u.name], false), domView.element("small", [], [u.email], false)], false), domView.element("span", [{
    "class": "tag"
  }], [['admin', 'member'].includes(u.role) ? tr(domView.concat('studio_role_', u.role)) : u.role], false), state.studio?.role === 'admin' ? domView.element("div", [{
    "class": "member-actions"
  }], [domView.fragment([button(tr("edit"), 'edit-studio-user', 'small', domView.attributes([{
    "data-id": u.id
  }])), button(tr("studio_remove_2"), 'remove-studio-user', 'small danger-text', domView.attributes([{
    "data-id": u.id
  }]))])], false) : ''], false)), '') || domView.element("p", [{
    "class": "notice"
  }], [tr("studio_no_users_match_your_search")], false);
}
function studioUserCount() {
  return tr("studio_of_studio_users", {
    v0: matchingStudioUsers().length,
    v1: state.studioUserTotal ?? (state.studioUsers || []).length
  });
}
function studioUsersPage() {
  return domView.fragment([domView.element("div", [{
    "class": "project-head"
  }], [domView.element("div", [], [domView.element("h1", [], [tr("studio_studio_users_2")], false), domView.element("p", [{
    "class": "muted"
  }], [tr("studio_admins_can_manage_members_project_access_comes_from_project_teams", {
    v0: state.studio?.name
  })], false)], false), state.studio?.role === 'admin' ? studioTeamFull() ? button(tr('billing_manage_team_capacity'), 'billing', 'small') : button(tr("studio_add_user"), 'edit-studio-user', 'primary', '', 'plus') : ''], false), domView.element("p", [{
    "class": "notice"
  }], [domView.fragment([tr('billing_team_usage', {
    used: state.studioUserTotal ?? (state.studioUsers || []).length,
    limit: state.billing?.limits?.seats ?? '∞'
  }), " ", tr('billing_team_counting_hint')])], false), domView.element("div", [{
    "class": "file-tools studio-user-tools"
  }], [domView.element("div", [{
    "class": "search"
  }], [icon('search'), domView.element("input", [{
    "type": "search"
  }, {
    "id": "studio-user-search"
  }, {
    "value": state.studioUserSearch || ''
  }, {
    "placeholder": tr("studio_search_by_name_or_email")
  }, {
    "aria-label": tr("studio_search_studio_users")
  }], [], false)], false), domView.element("span", [{
    "class": "form-hint"
  }, {
    "id": "studio-user-count"
  }, {
    "role": "status"
  }], [studioUserCount()], false)], false), domView.element("div", [{
    "class": "member-list"
  }, {
    "id": "studio-user-list"
  }], [studioUserRows()], false)]);
}
document.addEventListener('input', e => {
  if (e.target.id === 'studio-user-search') {
    state.studioUserSearch = e.target.value;
    studioUsersRequest++;
    clearTimeout(studioUserSearchTimer);
    syncWorkspaceUrl(true);
    studioUserSearchTimer = setTimeout(refreshStudioUserGrid, 250);
  }
});
function studioUserModal(id) {
  const u = (state.studioUsers || []).find(u => u.id === id) || ({});
  openModal(u.id ? tr("studio_edit_studio_member") : tr("studio_add_studio_member"), domView.fragment([domView.element("p", [], [tr("studio_members_sign_in_with_their_own_email_existing_accounts_can_belong_to_several_studios")], false), domView.element("form", [{
    "data-form": "studio-user"
  }], [domView.element("input", [{
    "type": "hidden"
  }, {
    "name": "id"
  }, {
    "value": u.id || ''
  }], [], false), domView.element("label", [], [tr("studio_name_in_this_studio"), domView.element("input", [{
    "name": "name"
  }, {
    "value": u.name || ''
  }, {
    "required": domView.text([])
  }, {
    "maxlength": "100"
  }], [], false)], false), domView.element("label", [], [tr("studio_email"), domView.element("input", [{
    "type": "email"
  }, {
    "name": "email"
  }, {
    "value": u.email || ''
  }, domView.spread(u.id ? domView.attributes([{
    "readonly": domView.text([])
  }]) : ''), {
    "required": domView.text([])
  }], [], false)], false), domView.element("label", [], [tr("studio_phone_optional"), domView.element("input", [{
    "type": "tel"
  }, {
    "name": "phone"
  }, {
    "value": u.phone || ''
  }, {
    "maxlength": "40"
  }, {
    "autocomplete": "tel"
  }], [], false)], false), domView.element("label", [], [tr("studio_studio_role"), domView.element("select", [{
    "name": "role"
  }], [domView.element("option", [{
    "value": "member"
  }, domView.spread(u.role !== 'admin' ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr("studio_member")], false), domView.element("option", [{
    "value": "admin"
  }, domView.spread(u.role === 'admin' ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr("studio_admin_can_manage_users")], false)], false)], false), formFooter(u.id ? tr("studio_save_member") : tr("studio_add_member"))], false)]));
}
let teamPicker = {
  users: [],
  selected: new Set(),
  roles: {}
};
async function projectTeamModal() {
  teamPicker = {
    users: (await api('studio_users')).users,
    selected: new Set((state.data.members || []).map(u => u.id)),
    roles: Object.fromEntries((state.data.people?.team || state.data.team || []).map(u => [u.id, u.role || '']))
  };
  openModal(tr("studio_project_team"), domView.fragment([domView.element("p", [], [tr("studio_select_existing_studio_members_and_set_their_role_in_this_project_studio_admins_manage_member_detail")], false), domView.element("form", [{
    "data-form": "project-team"
  }], [domView.element("div", [{
    "id": "team-selected"
  }, {
    "class": "team-selected"
  }], [], false), domView.element("div", [{
    "class": "team-search-panel"
  }], [domView.element("label", [], [tr("studio_find_studio_members"), domView.element("input", [{
    "id": "team-search"
  }, {
    "type": "search"
  }, {
    "placeholder": tr("studio_search_name_or_email")
  }, {
    "autocomplete": "off"
  }], [], false)], false), domView.element("div", [{
    "id": "team-results"
  }, {
    "class": "team-results"
  }], [], false)], false), formFooter(tr("studio_save_team"))], false)]));
  renderTeamPicker();
}
function renderTeamPicker() {
  const search = ($('#team-search')?.value || '').trim().toLowerCase(), selected = teamPicker.users.filter(u => teamPicker.selected.has(u.id)), matches = teamPicker.users.filter(u => !teamPicker.selected.has(u.id) && domView.text(["", u.name, " ", u.email, ""]).toLowerCase().includes(search));
  domView.mount($('#team-selected'), domView.fragment([domView.element("p", [], [tr("studio_team_member", {
    v0: selected.length,
    v1: selected.length === 1 ? '' : 's'
  })], false), domView.element("div", [{
    "class": "team-role-list"
  }], [domView.join(selected.map(u => domView.element("div", [{
    "class": "team-role-row"
  }], [personAvatar(u.profile, u.name), domView.element("div", [], [domView.element("strong", [], [u.name], false), domView.element("small", [], [u.email], false), domView.element("label", [], [tr("studio_role_in_this_project"), domView.element("input", [{
    "data-team-role": u.id
  }, {
    "value": teamPicker.roles[u.id] || ''
  }, {
    "maxlength": "80"
  }, {
    "placeholder": tr("studio_for_example_project_architect")
  }, {
    "aria-label": tr("studio_role_for", {
      v5: u.name
    })
  }], [], false)], false)], false), iconBtn('close', 'team-remove', tr("studio_remove_from_team", {
    v0: u.name
  }), domView.attributes([{
    "data-id": u.id
  }]))], false)), '')], false)]));
  domView.mount($('#team-results'), domView.concat(domView.join(matches.slice(0, 20).map(u => domView.element("button", [{
    "type": "button"
  }, {
    "class": "team-result"
  }, {
    "data-action": "team-add"
  }, {
    "data-id": u.id
  }], [personAvatar(u.profile, u.name), domView.element("span", [], [domView.element("strong", [], [u.name], false), domView.element("small", [], [u.email], false)], false), icon('plus')], false)), ''), matches.length > 20 ? domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_matches_refine_your_search_to_find_more_people", {
    v0: matches.length
  })], false) : matches.length ? '' : domView.element("p", [{
    "class": "form-hint"
  }], [tr("studio_no_matching_members")], false)));
}
document.addEventListener('input', e => {
  if (e.target.matches('[data-team-role]')) teamPicker.roles[e.target.dataset.teamRole] = e.target.value;
  if (e.target.id === 'team-search') renderTeamPicker();
});
document.addEventListener('change', async e => {
  if (e.target.id === 'studio-select') {
    if (e.target.value === 'new-studio') {
      e.target.value = state.studio.id;
      openModal(tr('studio_create_new_environment'), domView.element("form", [{
        "data-form": "new-studio"
      }], [domView.element("p", [], [tr('studio_new_environment_description')], false), domView.element("label", [], [tr('studio_studio_name'), domView.element("input", [{
        "name": "name"
      }, {
        "required": domView.text([])
      }, {
        "maxlength": "100"
      }, {
        "autocomplete": "organization"
      }], [], false)], false), formFooter(tr('studio_create_studio'), 'plus')], false));
      return;
    }
    try {
      applySession(await api('switch_studio', {
        studio_id: e.target.value
      }));
      await resetStudio();
    } catch (error) {
      toast(error.message);
    }
  }
});
function deleteProjectModal(project) {
  if (state.client || state.studio?.role !== 'admin' || !(project.can_edit ?? state.data?.can_edit)) return;
  openModal(tr("studio_permanently_delete_this_project"), domView.fragment([domView.element("p", [], [domView.fragment([tr("studio_this_removes"), " "]), domView.element("strong", [], [project.name], false), tr("studio_every_iteration_uploaded_and_generated_file_comment_and_client_sharing_link_this_cannot_be_undone_in")], false), domView.element("p", [], [tr("studio_archive_the_project_instead_if_you_may_need_it_later")], false), domView.element("div", [{
    "class": "modal-footer"
  }], [domView.fragment([button(tr("cancel"), 'close-modal', 'ghost'), button(tr("studio_continue_to_final_check"), 'prepare-delete-project', 'danger-text', domView.attributes([{
    "data-id": project.id
  }]))])], false)]));
}
function projectLogoFallback() {
  return state.studio?.has_logo ? domView.element("img", [{
    "class": "studio-logo"
  }, {
    "src": studioLogoUrl()
  }, {
    "alt": tr("studio_studio_logo")
  }], [], false) : defaultBrand();
}
function projectSettingsModal() {
  const p = state.data.project;
  openModal(tr("studio_project_settings"), domView.element("form", [{
    "data-form": "project-settings"
  }, {
    "class": "project-settings-content"
  }], ["\n        ", domView.element("div", [{
    "class": "project-settings-fields"
  }], [domView.element("div", [], [domView.element("div", [{
    "class": "settings-heading"
  }], [domView.element("label", [{
    "for": "project-language"
  }], [tr("presentation_language")], false), settingsHelp('project-language-help', tr('presentation_language'), tr('clients_see_this_language_unless_they_choose_their_own_in_their_profile'))], false), domView.withProps(languageSelect(p.language), {
    "id": "project-language"
  })], false), "\n            ", domView.element("div", [{
    "class": "project-visibility"
  }], [domView.element("div", [{
    "class": "settings-heading"
  }], [domView.element("label", [{
    "class": "check-label"
  }], [domView.element("input", [{
    "type": "checkbox"
  }, {
    "role": "switch"
  }, {
    "name": "team_only"
  }, domView.spread(p.visibility !== 'public' ? domView.attributes([{
    "checked": domView.text([])
  }]) : ''), {
    "aria-describedby": "visibility-description"
  }], [], false), tr("studio_team_members_only")], false), settingsHelp('visibility-description', tr('studio_team_members_only'), tr('studio_only_the_project_team_can_edit', {
    v5: p.visibility === 'public' ? tr('studio_everyone_in_the_studio_can_view') : tr('studio_only_the_project_team_can_view')
  }))], false)], false), "\n        "], false), domView.fragment(["\n        ", settingsLogoUpload(), "\n        ", formFooter(tr("studio_save_settings")), "\n    "])], false));
  const form = $('[data-form="project-settings"]');
  form.querySelector('[name="team_only"]').addEventListener('change', e => {
    form.querySelector('#visibility-description').textContent = domView.concat(e.target.checked ? tr("studio_only_the_project_team_can_view") : tr("studio_everyone_in_the_studio_can_view"), domView.text([" ", tr("studio_only_the_project_team_can_edit_2"), ""]));
  });
  bindSettingsLogoUpload(form);
}
function bindSettingsLogoUpload(form) {
  const zone = form.querySelector('[data-project-logo-drop]');
  form.querySelector('#project-logo-input').addEventListener('change', e => stageProjectLogo([...e.target.files], form));
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragging');
  });
  zone.addEventListener('dragleave', e => {
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('dragging');
  });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragging');
    stageProjectLogo([...e.dataTransfer.files], form);
  });
}
async function stageProjectLogo(files, form) {
  const status = form.querySelector('[data-logo-status]'), file = files[0];
  if (!file) return;
  if (files.length !== 1) {
    status.textContent = tr("studio_choose_one_logo_image_at_a_time");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    status.textContent = tr("studio_this_logo_is_too_large_choose_an_image_up_to_2_mb");
    return;
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    status.textContent = tr("studio_choose_a_png_jpeg_or_webp_logo");
    return;
  }
  const pick = form._logoPick = domView.concat(form._logoPick || 0, 1), submit = form.querySelector('[type="submit"]');
  form._logoLoading = true;
  submit.disabled = true;
  status.textContent = tr("studio_preparing_logo_preview");
  try {
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const image = new Image();
    image.src = safeUrl(url, 'src');
    await image.decode();
    if (image.naturalWidth * image.naturalHeight > 12000000) throw Error(tr("choose_an_image_up_to_12_megapixels"));
    if (!form.isConnected || pick !== form._logoPick) return;
    form._logoFile = file;
    form._removeLogo = false;
    image.alt = tr(form.dataset.form === 'studio-theme' ? 'selected_studio_logo' : 'studio_selected_presentation_logo');
    image.className = 'studio-logo';
    form.querySelector('[data-logo-preview]').replaceChildren(image);
    form.querySelector('[data-action="clear-project-logo"]').hidden = false;
    status.textContent = tr("studio_ready_to_save", {
      v0: file.name,
      v1: bytes(file.size)
    });
  } catch (error) {
    if (form.isConnected && pick === form._logoPick) status.textContent = error.message || tr("studio_this_image_could_not_be_opened_please_choose_another_logo");
  } finally {
    if (pick === form._logoPick) {
      form._logoLoading = false;
      submit.disabled = false;
    }
  }
}
document.addEventListener('input', e => {
  if (e.target.id === 'project-search') {
    state.projectSearch = e.target.value;
    projectsRequest++;
    clearTimeout(projectSearchTimer);
    syncWorkspaceUrl(true);
    projectSearchTimer = setTimeout(refreshProjectGrid, 250);
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'show-archived') {
    state.showArchived = e.target.checked;
    clearTimeout(projectSearchTimer);
    syncWorkspaceUrl();
    refreshProjectGrid();
  }
});
const builtinSlideTitles = {
  get intro() {
    return tr("welcome_home");
  },
  get changes() {
    return tr("what_s_new");
  },
  get budget() {
    return tr("the_investment");
  },
  get 'open-questions'() {
    return tr("open_questions");
  },
  get contacts() {
    return tr("your_project_team");
  },
  get summary() {
    return tr("everything_together");
  },
  get general() {
    return tr("studio_general_comment");
  }
};
const communicationControls = createCommunicationControls({
  id: 'studio',
  esc,
  icon,
  typeLabel: type => communication.typeLabel(type),
  openModal,
  onChange: async () => {
    syncWorkspaceUrl(true);
    await loadFeed();
    communicationControls.render(render);
  },
  onError: toast,
  onViewAll: async () => {
    communicationFilter = 'all';
    await loadFeed();
    render();
  }
});
async function loadFeed(more = false) {
  const request = ++feedRequest, studio = !DEMO && state.tab === 'all-comments', project = state.tab === 'comments' ? state.data.project.id : null, offset = studio ? communicationControls.offset : more ? state.feedOffset ?? (state.feedItems || []).length : 0;
  const signature = studio ? JSON.stringify({
    filter: communicationFilter,
    ...communicationControls.params
  }) : '';
  const result = await api('comments_feed', {
    offset,
    project_id: project,
    sort: commentView.sort,
    show_answered: !DEMO || commentView.showAnswered ? 1 : 0,
    ...studio ? {
      filter: communicationFilter,
      ...communicationControls.params
    } : {}
  });
  if (request !== feedRequest || studio && signature !== JSON.stringify({
    filter: communicationFilter,
    ...communicationControls.params
  })) return;
  state.feedItems = more && !studio ? [...state.feedItems || [], ...result.items] : result.items;
  state.feedOffset = result.next_offset ?? domView.concat(offset, result.items.length);
  state.feedMore = result.has_more;
  if (studio) {
    state.communicationTotal = result.total;
    state.communicationViewCounts = result.view_counts;
    communicationControls.setOffset(result.offset ?? offset);
  }
  state.unreadCount = result.unread_count ?? state.unreadCount;
}
function feedPage(projectOnly = false) {
  const items = state.feedItems || [];
  if (!DEMO) {
    const subjects = commentThreads(items, {
      sort: communicationControls.sort,
      showAnswered: true
    });
    return domView.fragment([domView.element("div", [{
      "class": "section-title"
    }], [domView.element("div", [], [domView.element("h1", [], [communication.t('Communication')], false), domView.element("p", [{
      "class": "muted"
    }], [tr('studio_across_projects_you_belong_to_in_this_studio')], false)], false)], false), domView.element("div", [{
      "class": "comm-view-controls"
    }], [domView.element("div", [{
      "class": "filter-chips comm-view-tabs"
    }, {
      "aria-label": communication.t('Communication views')
    }], [domView.join([['open', communication.t('Open')], ['attention', communication.t('Needs my attention')], ['all', communication.t('All')]].map(([key, label]) => button(communication.viewLabel(label, key === 'all' ? undefined : state.communicationViewCounts?.[key] ?? 0), 'communication-filter', communicationFilter === key ? 'primary' : '', domView.attributes([{
      "data-filter": key
    }, {
      "aria-pressed": communicationFilter === key
    }]))), '')], false)], false), domView.fragment([communicationControls.toolbar(), subjects.length ? domView.fragment([domView.element("div", [{
      "class": "timeline"
    }], [domView.join(subjects.map(({comment: c, replies}) => domView.element("article", [{
      "class": "timeline-item comment-card comm-feed-card"
    }, {
      "data-thread-type": c.thread_details?.type || (c.confirmation ? 'approval' : 'conversation')
    }], [commentPreview(c), domView.element("div", [{
      "class": "comment-content"
    }], [domView.element("small", [], [domView.fragment([c.project_name, " · V", c.iteration_number])], false), domView.element("h3", [], [c.thread_title || c.body.slice(0, 100)], false), domView.element("span", [{
      "class": "comm-feed-type"
    }], [domView.element("i", [{
      "class": "comm-type-dot"
    }, {
      "aria-hidden": "true"
    }], [], false), communication.typeLabel(c.thread_details?.type || (c.confirmation ? 'approval' : 'conversation'))], false), " ", domView.element("small", [{
      "class": "muted"
    }], [communication.statusLabel(c)], false), domView.element("p", [], [(replies.at(-1) || c).body], false), domView.element("div", [{
      "class": "row wrap"
    }], [[c, ...replies].some(m => m.unread) ? domView.element("span", [{
      "class": "tag"
    }], [communication.t('Unread')], false) : '', domView.element("span", [{
      "class": "muted"
    }], [domView.fragment([replies.length, " ", tr('replies')])], false), button(communication.t('Open conversation'), 'comm-location', 'small', domView.attributes([{
      "data-id": c.id
    }, {
      "data-project": c.project_id
    }, {
      "data-iteration": c.iteration_id
    }]), 'chat')], false)], false)], false)), '')], false), communicationControls.pagination(state.communicationTotal || subjects.length)]) : communicationControls.empty(communicationFilter)])]);
  }
  return domView.fragment([domView.element("div", [{
    "class": "section-title"
  }], [domView.element("div", [], [domView.element(domView.text(["h", projectOnly ? '2' : '1']), [], [tr("studio_comments_2"), domView.element("p", [{
    "class": "muted"
  }], [domView.fragment([tr("studio_replies_grouped_by_comment"), " · ", projectOnly ? tr("studio_all_iterations_of_this_project") : tr("studio_across_projects_you_belong_to_in_this_studio")])], false)], false)], false)], false), commentControls(), domView.element("div", [{
    "class": "timeline"
  }], [commentThreadList(items, true) || domView.element("p", [{
    "class": "notice"
  }], [!commentView.showAnswered ? tr("no_unanswered_comments_turn_on_show_answered_to_include_completed_threads") : tr("studio_nothing_here_yet")], false)], false), state.feedMore ? button(tr("studio_load_more"), 'more-feed', '', '', 'down') : '']);
}
async function openCommentSlide(data) {
  state.tab = 'slides';
  await openProject(data.project, data.iteration);
  if (data.slide === 'general') {
    if (communication.enabled() || useProjectData()) {
      await selectProjectTab('comments');
    } else feedbackModal();
    return;
  }
  const defs = editorSlides(), index = defs.findIndex(s => s.id === data.slide);
  if (index < 0) {
    openModal(tr("studio_source_slide_unavailable"), domView.element("p", [], [tr("studio_this_slide_was_removed_from_its_iteration_its_comment_remains_in_the_comments_list")], false));
    return;
  }
  await startPresentation(0, {
    editorSlide: data.slide
  });
  feedbackModal();
}
function personAvatar(profile = {}, name = '') {
  return domView.element("span", [{
    "class": "avatar person-avatar"
  }], [profile?.avatar ? domView.element("img", [{
    "src": profile.avatar
  }, {
    "alt": domView.text([])
  }], [], false) : initials(profile?.name || name)], false);
}
function profilePage(client = false) {
  const p = state.profile || state.user?.profile || ({});
  return domView.element("div", [{
    "class": "profile-page"
  }], [domView.element(domView.text(["h", client ? '2' : '1']), [], [client ? tr("your_preferences") : tr("user_profile"), domView.element("p", [{
    "class": "muted"
  }], [tr("your_name_avatar_and_communication_preferences")], false), domView.element("div", [{
    "class": "profile-avatar-editor"
  }], [domView.element("form", [{
    "data-form": "avatar"
  }], [imageUploadField('avatar', personAvatar(p, p.name)), domView.element("div", [{
    "class": "row"
  }], [domView.element("button", [{
    "class": "button small"
  }, {
    "type": "submit"
  }, {
    "disabled": domView.text([])
  }], [tr("save_avatar")], false), p.avatar ? button(tr("remove_avatar"), 'remove-avatar', 'small') : ''], false)], false)], false), domView.element("form", [{
    "data-form": "profile"
  }], [domView.element("label", [], [domView.fragment([tr("your_language"), languageSelect(p.language)])], false), domView.element("p", [{
    "class": "form-hint"
  }], [tr("your_choice_applies_to_your_own_view_otherwise_presentations_follow_the_project_language_or_the_studio_language_if_none_is_set")], false), domView.element("label", [], [tr("display_name"), domView.element("input", [{
    "name": "name"
  }, {
    "value": p.name || state.user?.name || ''
  }, {
    "required": domView.text([])
  }, {
    "maxlength": "100"
  }], [], false)], false), domView.element("fieldset", [], [domView.element("legend", [], [tr("communication_preferences")], false), domView.element("label", [{
    "class": "check-label"
  }], [domView.element("input", [{
    "type": "checkbox"
  }, {
    "name": "email_comments"
  }, domView.spread(p.email_comments !== false ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), tr("email_me_when_someone_else_comments_on_my_projects")], false), domView.element("label", [], [tr("notify_me_about"), domView.element("select", [{
    "name": "email_mentions_only"
  }], [domView.element("option", [{
    "value": "0"
  }, domView.spread(!p.email_mentions_only ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr("all_conversation_messages")], false), domView.element("option", [{
    "value": "1"
  }, domView.spread(p.email_mentions_only ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr("only_explicit_mentions")], false)], false)], false), domView.element("p", [{
    "class": "form-hint"
  }], [tr("mentions_only_explanation")], false)], false), formFooter(tr("save_profile"))], false)], false)], false);
}
async function showProfile() {
  const r = await api('profile');
  state.profile = r.profile;
  if (state.present || state.client || state.tab === 'destinations') openModal(tr("your_profile"), profilePage(true)); else {
    state.present = false;
    state.tab = 'profile';
    render();
  }
}
async function reloadProfile() {
  const r = await api('profile');
  state.profile = r.profile;
  if (state.present || state.client || state.tab === 'destinations') {
    if (state.data) state.data.profile = r.profile;
    if (state.user) state.user.profile = r.profile;
    render();
    openModal(tr("your_profile"), profilePage(true));
  } else {
    state.user.profile = r.profile;
    render();
  }
}
function commentAuthor(c) {
  return domView.element("div", [{
    "class": "comment-author"
  }], [personAvatar(c.profile, c.author), domView.element("small", [], [domView.element("strong", [], [c.profile?.name || c.author], false), domView.fragment([" · ", date(c.created_at)])], false), c.unread ? domView.element("span", [{
    "class": "unread-badge"
  }, {
    "data-unread": c.id
  }], [tr("unread")], false) : ''], false);
}
function commentPreview(c) {
  const attrs = c.project_id ? domView.attributes([{
    "data-action": "comment-slide"
  }, {
    "data-project": c.project_id
  }, {
    "data-iteration": c.iteration_id
  }, {
    "data-slide": c.slide
  }]) : domView.attributes([{
    "disabled": domView.text([])
  }]);
  return domView.element("button", [{
    "class": "comment-preview"
  }, {
    "type": "button"
  }, domView.spread(attrs), {
    "aria-label": tr("open_commented_slide")
  }], [commentPreviewImage(c,c.slide_title || builtinSlideTitles[c.system_slide_type || c.slide] || tr('slide_preview'))], false);
}
async function markCommentsRead(comments) {
  const ids = comments.filter(c => c.unread).map(c => c.id);
  for (const iteration of new Set(comments.filter(c => c.unread).map(c => c.iteration_id))) {
    const group = comments.filter(c => c.unread && c.iteration_id === iteration).map(c => c.id);
    for (let n = 0; n < group.length; n = domView.concat(n, 100)) await api('read_comments', {
      iteration,
      ids: group.slice(n, domView.concat(n, 100))
    });
  }
  if (!ids.length) return;
  for (const c of [...state.data?.comments || [], ...state.data?.communication?.comments || [], ...state.feedItems || []]) if (ids.includes(c.id)) c.unread = false;
  document.querySelectorAll('[data-unread]').forEach(el => {
    if (ids.includes(el.dataset.unread)) el.remove();
  });
  if (!state.client) state.unreadCount = (useProjectData() ? await projectData.loadStatus() : await api('session')).unread_count || 0;
  const balloon = $('.comment-balloon');
  if (balloon) {
    const all = (state.present ? presentationComments(state.data) : state.data.comments).filter(c => c.slide === slideDefs()[state.slide]?.id);
    domView.mount(balloon, domView.concat(domView.concat(icon('chat'), tr('comment_count', {
      count: all.length
    })), all.some(c => c.unread) ? tr('unread_suffix') : ''));
  }
}
document.addEventListener('change', e => {
  if (!e.target.matches('input[type=file]') || e.target.matches('[data-image-upload-input]') || ['wizard-file-input', 'project-logo-input'].includes(e.target.id)) return;
  const label = e.target.closest('label') || e.target.parentElement;
  label.querySelector('.upload-selection')?.remove();
  if (e.target.files.length) {
    const summary = document.createElement('span');
    summary.className = 'upload-selection';
    summary.setAttribute('role', 'status');
    summary.textContent = domView.join([...e.target.files].map(f => domView.text(["", f.name, " · ", bytes(f.size), ""])), ', ');
    label.append(summary);
  }
});
document.addEventListener('change', event => {
  const select = event.target.closest('[data-image-variant]');
  if (!select) return;
  const id = select.dataset.imageVariant, record = state.data.slides.find(s => s.id === id);
  if (!record?.image_variants?.some(v => v.id === select.value)) return;
  selectedEnhancements.set(id, select.value);
  reviewImageVersions(id);
  document.querySelector('[data-image-variant]')?.focus({
    preventScroll: true
  });
});
setInterval(async () => {
  if (DEMO || state.routeFailed || !state.user || state.client || !state.studio?.id || document.hidden || activeModal || state.tab === 'destinations') return;
  try {
    if (useProjectData() && state.data && viewResources[state.tab]) {
      await refresh();
      return;
    }
    const before = JSON.stringify(state.billing), wasEmpty = state.studioEmpty;
    await loadProjects();
    if (state.tab === 'projects' && wasEmpty !== state.studioEmpty) render(); else if (state.data) await refresh(); else if (before !== JSON.stringify(state.billing)) render();
  } catch {}
}, 60000);
