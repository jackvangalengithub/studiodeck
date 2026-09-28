import {element} from './render.js';

// The view batch supplies the URL. Image loading never triggers metadata calls.
export function commentPreviewImage(comment,title=''){
 const props={'data-comment-preview':comment.id};
 return comment.preview_url
  ?element('img',[{...props,src:comment.preview_url,alt:title,loading:'lazy'}],[])
  :element('span',[{...props,class:'comment-preview-fallback',role:'img','aria-label':title}],
    [element('span',[{'aria-hidden':'true'}],[title])]);
}
