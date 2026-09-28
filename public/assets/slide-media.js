import {safeUrl} from './dom.js';
import * as domView from "./render.js";
import {platformFetch} from './platform/files.js';
import {tr} from './i18n.js';
import {startYoutube} from './video.js';
import {motionPresets} from './motion-presets.js';
const esc = value => String(value ?? '');
export const canMovePhoto = type => ['photo', 'render', 'fullphoto', 'other'].includes(type);
export const motionSourceKey = (s = {}) => domView.join([s.source_version_id || '', Number(s.page_number) || 0, Number(s.image_number) || 0, s.image_version_id || ''], ':');
export const currentMotion = s => s && s.metadata?.motion?.source_key === motionSourceKey(s) ? s.metadata.motion : null;
export function motionPhoto(def, markup, {enabled = true} = {}) {
  const motion = enabled && currentMotion(def.record);
  if (!motion || !canMovePhoto(def.type)) return markup;
  return domView.element("span", [{
    "class": "motion-photo"
  }, {
    "data-photo-motion": motion.mode
  }, {
    "data-movement": motion.movement
  }, {
    "data-duration": Number(motion.duration) || 8
  }, {
    "data-media-id": motion.media_id || ''
  }, {
    "data-media-slide": def.record.id
  }], [domView.fragment([markup, motion.mode === 'ai' ? domView.element("video", [{
    "class": "photo-motion-video"
  }, {
    "muted": domView.text([])
  }, {
    "playsinline": domView.text([])
  }, {
    "preload": "none"
  }, {
    "aria-hidden": "true"
  }, {
    "tabindex": "-1"
  }], [], false) : ''])], false);
}
export function videoFields(video = {}) {
  return domView.fragment([domView.element("label", [], [tr('studio_youtube_video_link'), domView.element("input", [{
    "name": "video_url"
  }, {
    "type": "text"
  }, {
    "inputmode": "url"
  }, {
    "value": video.url || ''
  }, {
    "placeholder": "https://www.youtube.com/watch?v=…"
  }, {
    "maxlength": "2048"
  }], [], false)], false), domView.element("label", [], [tr('media_upload'), domView.element("input", [{
    "name": "video_file"
  }, {
    "type": "file"
  }, {
    "accept": "video/mp4,video/webm"
  }], [], false)], false), video.provider === 'upload' ? domView.element("p", [{
    "class": "form-hint"
  }], [tr('media_current_file', {
    name: video.name
  })], false) : '', domView.element("p", [{
    "class": "form-hint"
  }], [tr('media_upload_hint')], false), domView.element("div", [{
    "class": "form-grid"
  }], [domView.element("label", [], [tr('media_layout'), domView.element("select", [{
    "name": "video_layout"
  }], [domView.element("option", [{
    "value": "standard"
  }, domView.spread(video.layout === 'full' ? '' : domView.attributes([{
    "selected": domView.text([])
  }]))], [tr('media_standard')], false), domView.element("option", [{
    "value": "full"
  }, domView.spread(video.layout === 'full' ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr('media_full')], false)], false)], false), domView.element("label", [], [tr('media_fit'), domView.element("select", [{
    "name": "video_fit"
  }], [domView.element("option", [{
    "value": "contain"
  }, domView.spread(video.fit === 'cover' ? '' : domView.attributes([{
    "selected": domView.text([])
  }]))], [tr('media_contain')], false), domView.element("option", [{
    "value": "cover"
  }, domView.spread(video.fit === 'cover' ? domView.attributes([{
    "selected": domView.text([])
  }]) : '')], [tr('media_cover')], false)], false)], false)], false), domView.element("label", [{
    "class": "checkbox-row"
  }], [domView.element("input", [{
    "type": "checkbox"
  }, {
    "name": "video_autoplay"
  }, {
    "value": "1"
  }, domView.spread(video.autoplay ? domView.attributes([{
    "checked": domView.text([])
  }]) : '')], [], false), tr('media_autoplay')], false), domView.element("p", [{
    "class": "form-hint"
  }], [tr('media_autoplay_hint')], false)]);
}
const cache = new Map();
let cacheScope = '', headersForMedia = () => ({});
export function clearMediaCache() {
  for (const item of cache.values()) {
    item.abort.abort();
    if (item.url) URL.revokeObjectURL(item.url);
  }
  cache.clear();
  cacheScope = '';
}
export function configureMedia(scope, headers) {
  if (scope !== cacheScope) {
    clearMediaCache();
    cacheScope = scope;
  }
  headersForMedia = headers;
}
export async function mediaUrl(iteration, slide, id) {
  const key = domView.join([cacheScope, iteration, slide, id], ':');
  if (cache.has(key)) {
    const item = cache.get(key);
    cache.delete(key);
    cache.set(key, item);
    return item.promise;
  }
  const item = {
    abort: new AbortController(),
    url: ''
  };
  cache.set(key, item);
  item.promise = (async () => {
    try {
      const r = await platformFetch(new URLSearchParams({
        action: 'slide_media',
        iteration,
        slide_id: slide,
        media_id: id
      }), {
        credentials: 'same-origin',
        headers: headersForMedia(),
        signal: item.abort.signal
      });
      if (!r.ok) throw Error(tr('media_unavailable'));
      const blob = await r.blob();
      if (item.abort.signal.aborted) throw Error(tr('media_unavailable'));
      item.url = URL.createObjectURL(blob);
      return item.url;
    } catch (e) {
      if (cache.get(key) === item) cache.delete(key);
      throw e;
    }
  })();
  for (const [oldKey, old] of cache) {
    if (cache.size <= 3) break;
    if (document.querySelector(domView.text(["video[src=\"", old.url, "\"]"]))) continue;
    old.abort.abort();
    if (old.url) URL.revokeObjectURL(old.url);
    cache.delete(oldKey);
  }
  return item.promise;
}
let active = null, scope = '', entry = null;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function stopActive() {
  if (!active) return;
  active.abort.abort();
  active.animation?.cancel();
  active.observer?.disconnect();
  for (const v of active.root.querySelectorAll('video')) {
    v.pause();
    v.removeAttribute('src');
    v.load();
  }
  active.root.querySelectorAll('.motion-playing').forEach(el => el.classList.remove('motion-playing'));
  active.root.querySelectorAll('[data-play-youtube],[data-play-upload]').forEach(el => el.hidden = false);
  for (const iframe of active.root.querySelectorAll('iframe[data-youtube-player]')) iframe.remove();
  active = null;
}
export function stopSlideMedia() {
  stopActive();
  entry = null;
  scope = '';
}
export function syncSlideMedia({root, iteration, slide, next}) {
  const settings = root?.querySelector('[data-photo-motion],[data-uploaded-video],[data-play-youtube]');
  const key = domView.concat(domView.concat(domView.concat(domView.concat(iteration, ':'), slide), ':'), JSON.stringify(settings ? {
    ...settings.dataset
  } : {}));
  if (key !== scope) {
    stopActive();
    scope = key;
    entry = {
      done: false,
      elapsed: 0
    };
  }
  if (!root) {
    stopActive();
    return;
  }
  if (active?.root === root) return;
  stopActive();
  const abort = new AbortController();
  active = {
    root,
    abort
  };
  const run = active, {signal} = abort;
  const motion = root.querySelector('[data-photo-motion]'), uploaded = root.querySelector('[data-uploaded-video]'), youtube = root.querySelector('[data-play-youtube]');
  if (motion) startPhotoMotion(motion, iteration, entry, run);
  if (uploaded) {
    const video = uploaded.querySelector('video'), button = uploaded.querySelector('[data-play-upload]'), status = uploaded.querySelector('[data-media-status]');
    const load = async (play = false) => {
      try {
        video.src = safeUrl(await mediaUrl(iteration, uploaded.dataset.mediaSlide, uploaded.dataset.mediaId), 'src');
        if (signal.aborted) {
          video.pause();
          video.removeAttribute('src');
          video.load();
          return;
        }
        status.textContent = '';
        video.currentTime = entry.elapsed || 0;
        if (play) {
          await video.play();
          button.hidden = true;
        }
      } catch {
        if (!signal.aborted) {
          status.textContent = tr('media_unavailable');
          button.hidden = false;
        }
      }
    };
    button.addEventListener('click', async () => {
      if (!video.src) await load(true); else try {
        await video.play();
        button.hidden = true;
      } catch {
        button.hidden = false;
      }
    }, {
      signal
    });
    video.addEventListener('timeupdate', () => {
      entry.elapsed = video.currentTime;
    }, {
      signal
    });
    video.addEventListener('ended', () => {
      entry.done = true;
    }, {
      signal
    });
    video.addEventListener('error', () => {
      status.textContent = tr('media_unavailable');
      button.hidden = false;
    }, {
      signal
    });
    load(uploaded.dataset.autoplay === 'true' && !entry.done && !reduced());
  }
  if (youtube && youtube.dataset.autoplay === 'true' && !entry.done && !reduced()) {
    startYoutube(youtube, true);
    entry.done = true;
  }
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  preference.addEventListener('change', () => {
    if (preference.matches) {
      entry.done = true;
      run.animation?.cancel();
      root.querySelectorAll('.motion-playing').forEach(el => el.classList.remove('motion-playing'));
      root.querySelectorAll('video').forEach(v => v.pause());
    }
  }, {
    signal
  });
  document.addEventListener('visibilitychange', () => {
    if (signal.aborted) return;
    if (document.hidden) {
      run.animation?.pause();
      for (const video of root.querySelectorAll('video')) {
        video.dataset.wasPlaying = String(!video.paused);
        video.pause();
      }
    } else {
      if (run.animation?.playState === 'paused') run.animation.play();
      for (const video of root.querySelectorAll('video')) if (video.dataset.wasPlaying === 'true') video.play().catch(() => {});
    }
  }, {
    signal
  });
  if (next && !reduced()) mediaUrl(iteration, next.slide, next.id).catch(() => {});
}
async function startPhotoMotion(stage, iteration, record, run) {
  const {signal} = run.abort;
  let launched = false;
  const launch = async () => {
    const img = stage.querySelector('img');
    if (!img || !img.complete || !img.naturalWidth) return;
    if (launched) return;
    launched = true;
    run.observer?.disconnect();
    if (record.done || reduced() && !run.explicit || signal.aborted) return;
    if (stage.dataset.photoMotion === 'simple') {
      const direction = stage.dataset.movement, first = direction === 'pan-right' ? 'translateX(3%) scale(1.10)' : direction === 'pan-left' ? 'translateX(-3%) scale(1.10)' : 'scale(1.12)';
      const duration = Number(stage.dataset.duration) * 1000;
      run.animation = img.animate([{
        transform: first
      }, {
        transform: 'none'
      }], {
        duration,
        easing: 'cubic-bezier(.25,.1,.25,1)',
        fill: 'none'
      });
      run.animation.currentTime = record.elapsed;
      const save = () => {
        record.elapsed = Number(run.animation.currentTime) || 0;
      };
      signal.addEventListener('abort', save, {
        once: true
      });
      run.animation.finished.then(() => {
        record.done = true;
        record.elapsed = duration;
      }).catch(() => {});
      if (document.hidden) run.animation.pause();
      return;
    }
    const video = stage.querySelector('video');
    if (!video) return;
    const size = () => {
      const w = stage.clientWidth, h = stage.clientHeight, iw = img.naturalWidth, ih = img.naturalHeight, scale = (getComputedStyle(img).objectFit === 'cover' ? Math.max : Math.min)(w / iw, h / ih), vw = ih > iw ? 720 : 1280, vh = ih > iw ? 1280 : 720, fit = Math.min(vw / iw, vh / ih);
      video.style.width = domView.concat(vw * scale / fit, 'px');
      video.style.height = domView.concat(vh * scale / fit, 'px');
    };
    const resize = new ResizeObserver(size);
    resize.observe(stage);
    signal.addEventListener('abort', () => resize.disconnect(), {
      once: true
    });
    size();
    const finish = () => {
      record.done = true;
      stage.classList.remove('motion-playing');
      video.pause();
    };
    video.addEventListener('timeupdate', () => {
      record.elapsed = video.currentTime;
      if (video.duration - video.currentTime <= .45) finish();
    }, {
      signal
    });
    video.addEventListener('ended', finish, {
      signal
    });
    video.addEventListener('error', finish, {
      signal
    });
    try {
      video.src = safeUrl(await mediaUrl(iteration, stage.dataset.mediaSlide, stage.dataset.mediaId), 'src');
      if (signal.aborted) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        return;
      }
      video.currentTime = record.elapsed || 0;
      await video.play();
      if (signal.aborted) {
        video.pause();
        return;
      }
      stage.classList.add('motion-playing');
      run.onPreview?.();
      if (document.hidden) {
        video.dataset.wasPlaying = 'true';
        video.pause();
      }
    } catch {
      finish();
    }
  };
  run.observer = new MutationObserver(launch);
  run.observer.observe(stage, {
    childList: true,
    subtree: true
  });
  stage.addEventListener('load', launch, {
    capture: true,
    signal
  });
  launch();
}
export function photoMotionUi({state, openModal, closeModal, api, refresh, toast, hydrateImages, imageMarkup, editable, resourceHeaders}) {
  let preview = null;
  const endPreview = () => {
    preview?.abort.abort();
    preview?.animation?.cancel();
    preview?.observer?.disconnect();
    document.querySelector('.motion-preview video')?.pause();
    document.querySelector('.motion-preview .motion-playing')?.classList.remove('motion-playing');
    preview = null;
  };
  function open(id) {
    if (!editable()) return;
    configureMedia(domView.concat(domView.concat(domView.concat('studio:', state.studio?.id || ''), ':'), state.data.iteration.id), resourceHeaders);
    const slide = state.data.slides.find(s => s.id === id);
    if (!slide || !canMovePhoto(slide.type)) return;
    const motion = currentMotion(slide), candidate = slide.metadata?.motion_candidate?.source_key === motionSourceKey(slide) ? slide.metadata.motion_candidate : motion?.mode === 'ai' ? motion : null;
    const busy = state.data.jobs?.some(j => j.type === 'slide_video' && j.slide_id === id && ['queued', 'running'].includes(j.status));
    const failed = state.data.jobs?.filter(j => j.type === 'slide_video' && j.slide_id === id && j.status === 'failed').at(-1);
    let reviewed = motion?.mode === 'ai' && motion.media_id === candidate?.media_id;
    const initialPrompt = (candidate?.prompt ?? motionPresets[candidate?.movement || motion?.movement || 'pan-right']?.prompt) ?? motionPresets['pan-right'].prompt;
    const candidatePrompt = candidate ? (candidate.prompt ?? initialPrompt).trim() : null;
    const available = state.data.capabilities.video_ai && (state.data.motion_allowance?.remaining ?? 0) > 0 && !busy;
    openModal(tr('media_add_motion'), domView.fragment([domView.element("p", [], [tr('media_motion_hint')], false), domView.element("form", [{
      "data-form": "photo-motion"
    }], [domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "slide_id"
    }, {
      "value": id
    }], [], false), domView.element("input", [{
      "type": "hidden"
    }, {
      "name": "media_id"
    }, {
      "value": candidate?.media_id || ''
    }], [], false), domView.element("label", [], [tr('media_method'), domView.element("select", [{
      "name": "mode"
    }], [domView.element("option", [{
      "value": "none"
    }], [tr('media_none')], false), domView.element("option", [{
      "value": "simple"
    }, domView.spread(motion?.mode === 'simple' || !motion ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [tr('media_gentle')], false), domView.element("option", [{
      "value": "ai"
    }, domView.spread(motion?.mode === 'ai' ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [tr('media_ai')], false)], false)], false), domView.element("div", [{
      "class": "form-grid"
    }, {
      "data-motion-simple": domView.text([])
    }], [domView.element("label", [], [tr('media_movement'), domView.element("select", [{
      "name": "movement"
    }], [domView.join(['pan-right', 'pan-left', 'zoom-out'].map(k => domView.element("option", [{
      "value": k
    }, domView.spread(k === (motion?.movement || candidate?.movement) ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [tr(domView.concat('media_', k))], false)), '')], false)], false), domView.element("label", [{
      "data-motion-duration": domView.text([])
    }], [tr('media_duration'), domView.element("select", [{
      "name": "duration"
    }], [domView.join([4, 6, 8, 10, 12].map(n => domView.element("option", [{
      "value": n
    }, domView.spread(n === (motion?.duration || 8) ? domView.attributes([{
      "selected": domView.text([])
    }]) : '')], [tr('media_seconds', {
      count: n
    })], false)), '')], false)], false)], false), domView.element("div", [{
      "data-motion-ai": domView.text([])
    }, {
      "hidden": domView.text([])
    }], [domView.element("p", [{
      "class": "form-hint"
    }], [tr('media_ai_hint')], false), domView.element("div", [{
      "class": "ai-preset-buttons"
    }, {
      "role": "group"
    }, {
      "aria-label": tr('media_motion_presets')
    }], [domView.join(Object.entries(motionPresets).map(([key, preset]) => domView.element("button", [{
      "class": "button"
    }, {
      "type": "button"
    }, {
      "data-motion-preset": key
    }, {
      "aria-pressed": "false"
    }], [preset.label], false)), '')], false), domView.element("label", [], [tr('media_prompt_label'), domView.element("textarea", [{
      "name": "prompt"
    }, {
      "rows": "7"
    }, {
      "maxlength": "2000"
    }, {
      "placeholder": tr('media_prompt_placeholder')
    }, {
      "aria-describedby": "motion-prompt-hint"
    }], [initialPrompt], false)], false), domView.element("p", [{
      "class": "form-hint"
    }, {
      "id": "motion-prompt-hint"
    }], [tr('media_prompt_hint')], false), domView.fragment([!state.data.capabilities.video_ai ? domView.element("p", [{
      "class": "notice"
    }], [tr('media_ai_unconfigured')], false) : domView.element("p", [{
      "class": "form-hint"
    }], [tr('media_remaining', {
      count: state.data.motion_allowance?.remaining ?? 0
    })], false), busy ? domView.element("p", [{
      "role": "status"
    }], [tr('media_generating')], false) : '', failed ? domView.element("p", [{
      "class": "notice"
    }], [failed.error], false) : '']), domView.element("button", [{
      "class": "button"
    }, {
      "type": "button"
    }, {
      "data-generate-motion": domView.text([])
    }, domView.spread(available ? '' : domView.attributes([{
      "disabled": domView.text([])
    }]))], [tr(candidate ? 'media_regenerate' : 'media_generate')], false), candidate ? domView.element("p", [], [tr('media_ready')], false) : ''], false), domView.element("div", [{
      "class": "motion-preview"
    }], [imageMarkup(slide)], false), domView.element("p", [{
      "class": "form-hint"
    }, {
      "data-motion-feedback": domView.text([])
    }, {
      "role": "status"
    }], [], false), domView.element("div", [{
      "class": "modal-footer"
    }], [domView.element("button", [{
      "class": "button ghost"
    }, {
      "type": "button"
    }, {
      "data-action": "close-modal"
    }], [tr('cancel')], false), domView.element("button", [{
      "class": "button"
    }, {
      "type": "button"
    }, {
      "data-preview-motion": domView.text([])
    }], [tr('media_preview')], false), domView.element("button", [{
      "class": "button primary"
    }, {
      "type": "submit"
    }], [tr('media_apply')], false)], false)], false)]), true);
    hydrateImages();
    const form = document.querySelector('[data-form="photo-motion"]');
    const prompt = form.elements.namedItem('prompt'), feedback = form.querySelector('[data-motion-feedback]');
    const matches = () => candidate && candidatePrompt === prompt.value.trim();
    let generating = false;
    const update = () => {
      endPreview();
      const ai = form.mode.value === 'ai';
      form.querySelector('[data-motion-ai]').hidden = !ai;
      form.querySelector('[data-motion-simple]').hidden = form.mode.value !== 'simple';
      prompt.disabled = !ai;
      prompt.required = ai;
      form.querySelector('[type=submit]').disabled = ai && (!matches() || !reviewed);
      form.querySelector('[data-preview-motion]').disabled = form.mode.value === 'none' || ai && !matches();
      form.querySelector('[data-generate-motion]').disabled = generating || !available || !prompt.value.trim() || prompt.value.length > 2000;
      const selected = Object.keys(motionPresets).find(key => key !== 'custom' && motionPresets[key].prompt === prompt.value) || 'custom';
      form.querySelectorAll('[data-motion-preset]').forEach(button => {
        const active = button.dataset.motionPreset === selected;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      feedback.textContent = ai && candidate && !matches() ? tr('media_prompt_changed') : '';
    };
    form.addEventListener('change', update);
    prompt.addEventListener('input', update);
    form.querySelectorAll('[data-motion-preset]').forEach(button => button.addEventListener('click', () => {
      prompt.value = motionPresets[button.dataset.motionPreset].prompt;
      update();
      prompt.focus();
    }));
    update();
    form.querySelector('[data-preview-motion]').addEventListener('click', async () => {
      endPreview();
      const box = form.querySelector('.motion-preview');
      domView.mount(box, motionPhoto({
        record: {
          ...slide,
          metadata: {
            motion: {
              source_key: motionSourceKey(slide),
              mode: form.mode.value,
              movement: form.movement.value,
              duration: Number(form.duration.value),
              media_id: candidate?.media_id
            }
          }
        },
        type: slide.type
      }, imageMarkup(slide)));
      hydrateImages();
      preview = {
        root: box,
        abort: new AbortController(),
        explicit: true,
        onPreview: () => {
          reviewed = true;
          form.querySelector('[type=submit]').disabled = form.mode.value === 'ai' && !matches();
        }
      };
      startPhotoMotion(box.firstElementChild, state.data.iteration.id, {
        done: false,
        elapsed: 0
      }, preview);
      form.querySelector('[data-motion-feedback]').textContent = reduced() ? tr('media_reduced') : tr('media_preview_hint');
    });
    form.querySelector('[data-generate-motion]').addEventListener('click', async () => {
      if (!prompt.reportValidity() || !prompt.value.trim() || generating) return;
      generating = true;
      update();
      try {
        await api('generate_slide_motion', {
          iteration: state.data.iteration.id,
          slide_id: id,
          prompt: prompt.value.trim()
        });
        closeModal();
        await refresh(true);
        toast(tr('media_generating'));
      } catch (error) {
        generating = false;
        update();
        feedback.textContent = error.message;
      }
    });
  }
  return {
    open,
    close: endPreview,
    async submit(data) {
      await api('save_slide_motion', {
        ...data,
        iteration: state.data.iteration.id
      });
      closeModal();
      await refresh(true);
      toast(tr('media_saved'));
    }
  };
}
