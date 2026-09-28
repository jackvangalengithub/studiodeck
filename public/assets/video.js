import {safeUrl, e} from './dom.js';
import * as domView from "./render.js";
import {tr} from './i18n.js';
const esc = value => String(value ?? '');
const playMark = domView.element("svg", [{
  "viewBox": "0 0 24 24"
}, {
  "aria-hidden": "true"
}], [domView.element("path", [{
  "d": "M8 5l11 7-11 7z"
}], [], true)], true);
export function youtubeDetails(value) {
  if (value?.provider !== 'youtube' || typeof value.id !== 'string' || !(/^[A-Za-z0-9_-]{11}$/).test(value.id)) return null;
  const start = Number.isInteger(value.start) ? Math.max(0, Math.min(86400, value.start)) : 0;
  return {
    id: value.id,
    start,
    url: domView.text(["https://www.youtube.com/watch?v=", value.id, "", start ? domView.concat('&t=', start) : '', ""])
  };
}
export const videoThumbnail = (title, provider = 'youtube') => domView.element("span", [{
  "class": "video-thumbnail"
}], [playMark, domView.element("small", [], [provider === 'upload' ? tr('media_video') : 'YouTube'], false), domView.element("span", [{
  "class": "sr-only"
}], [title], false)], false);
export function videoSlide(def) {
  const config = def.record?.metadata?.video || ({}), video = youtubeDetails(config), upload = config.provider === 'upload' && (/^[a-f0-9]{32}$/).test(config.media_id), full = config.layout === 'full';
  const player = upload ? domView.element("div", [{
    "class": "video-player uploaded-video"
  }, {
    "data-uploaded-video": domView.text([])
  }, {
    "data-media-slide": def.record.id
  }, {
    "data-media-id": config.media_id
  }, {
    "data-autoplay": !!config.autoplay
  }], [domView.element("video", [{
    "muted": domView.text([])
  }, {
    "playsinline": domView.text([])
  }, domView.spread(full ? '' : 'controls'), {
    "preload": "none"
  }, {
    "aria-label": def.title
  }, {
    "style": domView.text(["object-fit:", config.fit === 'cover' ? 'cover' : 'contain'])
  }], [], false), domView.element("button", [{
    "type": "button"
  }, {
    "class": "media-play"
  }, {
    "data-play-upload": domView.text([])
  }, {
    "aria-label": domView.text([tr('play_video'), " ", def.title])
  }], [playMark, domView.element("span", [], [tr('play_video_')], false)], false), domView.element("span", [{
    "data-media-status": domView.text([])
  }, {
    "role": "status"
  }], [tr('media_loading')], false)], false) : video ? domView.element("div", [{
    "class": "video-player"
  }, {
    "data-fit": config.fit === 'cover' ? 'cover' : 'contain'
  }], [domView.element("button", [{
    "class": "youtube-play"
  }, {
    "type": "button"
  }, {
    "data-play-youtube": video.id
  }, {
    "data-autoplay": !!config.autoplay
  }, {
    "data-video-start": video.start
  }, {
    "data-video-title": def.title
  }, {
    "aria-label": domView.text([tr('play_video'), " ", def.title])
  }], [playMark, domView.element("strong", [], [tr('play_video_')], false), domView.element("small", [], ["YouTube"], false)], false)], false) : domView.element("p", [{
    "class": "notice"
  }], [tr('add_a_youtube_link_using_edit_slide')], false);
  return domView.element("section", [{
    "class": domView.text(["video-slide ", full ? 'full-video-slide' : ''])
  }], [domView.fragment([!full ? domView.fragment([domView.element("p", [{
    "class": "slide-label"
  }], [upload ? tr('media_video') : tr('youtube_video')], false), domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false), def.record?.description ? domView.element("p", [{
    "class": "slide-description"
  }], [def.record.description], false) : '']) : '', player, full && def.record?.description ? domView.element("p", [{
    "class": "full-video-caption"
  }], [def.record.description], false) : '', video && !full ? domView.element("a", [{
    "class": "video-external-link"
  }, {
    "href": video.url
  }, {
    "target": "_blank"
  }, {
    "rel": "noopener noreferrer"
  }], [tr('watch_on_youtube')], false) : ''])], false);
}
export function startYoutube(button, muted = false) {
  const video = youtubeDetails({
    provider: 'youtube',
    id: button.dataset.playYoutube,
    start: Number(button.dataset.videoStart)
  });
  if (!video) return;
  const player = button.closest('.video-player');
  if (!player || player.querySelector('iframe')) return;
  const frame = e('iframe', {sandbox:'allow-scripts allow-presentation'});
  frame.dataset.youtubePlayer = '';
  frame.title = button.dataset.videoTitle || tr('youtube_video');
  frame.src = safeUrl(domView.text(["https://www.youtube-nocookie.com/embed/", video.id, "?autoplay=1&playsinline=1&rel=0", video.start ? domView.concat('&start=', video.start) : '', "", muted ? '&mute=1' : '', ""]), 'src');
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.referrerPolicy = 'strict-origin-when-cross-origin';
  button.hidden = true;
  player.append(frame);
  if (!muted) frame.focus();
}
export function installVideoPlayers() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-play-youtube]');
    if (button) startYoutube(button);
  });
}
