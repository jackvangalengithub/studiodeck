import {safeUrl, e} from '../../assets/dom.js';
import * as domView from "../../assets/render.js";
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
export const videoThumbnail = title => domView.element("span", [{
  "class": "video-thumbnail"
}], [playMark, domView.element("small", [], ["YouTube"], false), domView.element("span", [{
  "class": "sr-only"
}], [title], false)], false);
export function videoSlide(def) {
  const video = youtubeDetails(def.record?.metadata?.video);
  return domView.element("section", [{
    "class": "video-slide"
  }], [domView.element("p", [{
    "class": "slide-label"
  }], [tr("youtube_video")], false), domView.element("h1", [{
    "class": "slide-heading"
  }], [def.title], false), domView.fragment([def.record?.description ? domView.element("p", [{
    "class": "slide-description"
  }], [def.record.description], false) : '', video ? domView.fragment([domView.element("div", [{
    "class": "video-player"
  }], [domView.element("button", [{
    "class": "youtube-play"
  }, {
    "type": "button"
  }, {
    "data-play-youtube": video.id
  }, {
    "data-video-start": video.start
  }, {
    "data-video-title": def.title
  }, {
    "aria-label": domView.text([tr("play_video"), " ", def.title])
  }], [playMark, domView.element("strong", [], [tr("play_video_")], false), domView.element("small", [], ["YouTube"], false)], false)], false), domView.element("a", [{
    "class": "video-external-link"
  }, {
    "href": video.url
  }, {
    "target": "_blank"
  }, {
    "rel": "noopener noreferrer"
  }], [tr("watch_on_youtube")], false)]) : domView.element("p", [{
    "class": "notice"
  }], [tr("add_a_youtube_link_using_edit_slide")], false)])], false);
}
export function installVideoPlayers() {
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-play-youtube]');
    if (!button) return;
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
    frame.title = button.dataset.videoTitle || tr("youtube_video");
    frame.src = safeUrl(domView.text(["https://www.youtube-nocookie.com/embed/", video.id, "?autoplay=1&playsinline=1&rel=0", video.start ? domView.concat('&start=', video.start) : '', ""]), 'src');
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    button.hidden = true;
    player.append(frame);
    frame.focus();
  });
}
