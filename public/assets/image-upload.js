import {tr} from './i18n.js';
// Shared single-image picker for studio logos and profile avatars.
export function imageUploadData(form){
 if(!form._imageFile)throw Error(tr("choose_an_image_before_saving"));
 const body=new FormData(form);body.set(form.querySelector('[data-image-upload-input]').name,form._imageFile);return body;
}
export function installImageUploads(){
 async function stage(files,zone){
  const form=zone.closest('form'),status=form.querySelector('[data-image-upload-status]'),submit=form.querySelector('[type="submit"]'),file=files[0];if(!file)return;
  const pick=form._imagePick=(form._imagePick||0)+1;form._imageFile=null;submit.disabled=true;
  if(files.length!==1){status.textContent=tr("choose_one_image_at_a_time");return;}
  if(file.size>2*1024*1024){status.textContent=tr("this_image_is_too_large_choose_an_image_up_to_2_mb");return;}
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){status.textContent=tr("choose_a_png_jpeg_or_webp_image");return;}
  status.textContent=tr("preparing_image_preview");
  try{
   const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
   const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>12000000)throw Error(tr("choose_an_image_up_to_12_megapixels"));
   if(!form.isConnected||pick!==form._imagePick)return;
   const preview=zone.querySelector('[data-image-upload-preview]');image.alt=zone.dataset.imageUpload==='avatar'?tr("selected_avatar"):tr("selected_studio_logo");
   if(zone.dataset.imageUpload==='avatar'){const circle=document.createElement('span');circle.className='avatar person-avatar';circle.append(image);preview.replaceChildren(circle);}else{image.className='studio-logo';preview.replaceChildren(image);}
   form._imageFile=file;submit.disabled=false;status.textContent=file.name+' · '+tr('ready_to_save');
  }catch(error){if(form.isConnected&&pick===form._imagePick)status.textContent=error.message||tr("this_image_could_not_be_opened_please_choose_another_image");}
 }
 document.addEventListener('click',e=>{const picker=e.target.closest('[data-image-upload-picker]');if(picker)picker.closest('[data-image-upload]').querySelector('input').click();});
 document.addEventListener('change',e=>{if(e.target.matches('[data-image-upload-input]'))stage([...e.target.files],e.target.closest('[data-image-upload]'));});
 document.addEventListener('dragover',e=>{const zone=e.target.closest('[data-image-upload]');if(zone){e.preventDefault();zone.classList.add('dragging');}});
 document.addEventListener('dragleave',e=>{const zone=e.target.closest('[data-image-upload]');if(zone&&!zone.contains(e.relatedTarget))zone.classList.remove('dragging');});
 document.addEventListener('drop',e=>{const zone=e.target.closest('[data-image-upload]');if(zone){e.preventDefault();zone.classList.remove('dragging');stage([...e.dataTransfer.files],zone);}});
}
