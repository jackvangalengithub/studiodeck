import {tr} from './i18n.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const playMark='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>';
export function youtubeDetails(value){
 if(value?.provider!=='youtube'||typeof value.id!=='string'||!/^[A-Za-z0-9_-]{11}$/.test(value.id))return null;
 const start=Number.isInteger(value.start)?Math.max(0,Math.min(86400,value.start)):0;
 return {id:value.id,start,url:`https://www.youtube.com/watch?v=${value.id}${start?'&t='+start:''}`};
}
export const videoThumbnail=title=>`<span class="video-thumbnail">${playMark}<small>YouTube</small><span class="sr-only">${esc(title)}</span></span>`;
export function videoSlide(def){
 const video=youtubeDetails(def.record?.metadata?.video);
 return `<section class="video-slide"><p class="slide-label">${tr("youtube_video")}</p><h1 class="slide-heading">${esc(def.title)}</h1>${def.record?.description?`<p class="slide-description">${esc(def.record.description)}</p>`:''}${video?`<div class="video-player"><button class="youtube-play" type="button" data-play-youtube="${video.id}" data-video-start="${video.start}" data-video-title="${esc(def.title)}" aria-label="${tr("play_video")} ${esc(def.title)}">${playMark}<strong>${tr("play_video_")}</strong><small>YouTube</small></button></div><a class="video-external-link" href="${esc(video.url)}" target="_blank" rel="noopener noreferrer">${tr("watch_on_youtube")}</a>`:`<p class="notice">${tr("add_a_youtube_link_using_edit_slide")}</p>`}</section>`;
}
export function installVideoPlayers(){
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-play-youtube]');if(!button)return;
  const video=youtubeDetails({provider:'youtube',id:button.dataset.playYoutube,start:Number(button.dataset.videoStart)});if(!video)return;
  const player=button.closest('.video-player');if(!player||player.querySelector('iframe'))return;
  const frame=document.createElement('iframe');frame.dataset.youtubePlayer='';frame.title=button.dataset.videoTitle||tr("youtube_video");
  frame.src=`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&playsinline=1&rel=0${video.start?'&start='+video.start:''}`;
  frame.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;
  frame.referrerPolicy='strict-origin-when-cross-origin';button.hidden=true;player.append(frame);frame.focus();
 });
}
