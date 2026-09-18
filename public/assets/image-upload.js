// Shared single-image picker for studio logos and profile avatars.
export function imageUploadData(form){
 if(!form._imageFile)throw Error('Choose an image before saving.');
 const body=new FormData(form);body.set(form.querySelector('[data-image-upload-input]').name,form._imageFile);return body;
}
export function installImageUploads(){
 async function stage(files,zone){
  const form=zone.closest('form'),status=form.querySelector('[data-image-upload-status]'),submit=form.querySelector('[type="submit"]'),file=files[0];if(!file)return;
  const pick=form._imagePick=(form._imagePick||0)+1;form._imageFile=null;submit.disabled=true;
  if(files.length!==1){status.textContent='Choose one image at a time.';return;}
  if(file.size>2*1024*1024){status.textContent='This image is too large. Choose an image up to 2 MB.';return;}
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)){status.textContent='Choose a PNG, JPEG or WebP image.';return;}
  status.textContent='Preparing image preview…';
  try{
   const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
   const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>12000000)throw Error('Choose an image up to 12 megapixels.');
   if(!form.isConnected||pick!==form._imagePick)return;
   const preview=zone.querySelector('[data-image-upload-preview]');image.alt=zone.dataset.imageUpload==='avatar'?'Selected avatar':'Selected studio logo';
   if(zone.dataset.imageUpload==='avatar'){const circle=document.createElement('span');circle.className='avatar person-avatar';circle.append(image);preview.replaceChildren(circle);}else{image.className='studio-logo';preview.replaceChildren(image);}
   form._imageFile=file;submit.disabled=false;status.textContent=file.name+' · Ready to save';
  }catch(error){if(form.isConnected&&pick===form._imagePick)status.textContent=error.message||'This image could not be opened. Please choose another image.';}
 }
 document.addEventListener('click',e=>{const picker=e.target.closest('[data-image-upload-picker]');if(picker)picker.closest('[data-image-upload]').querySelector('input').click();});
 document.addEventListener('change',e=>{if(e.target.matches('[data-image-upload-input]'))stage([...e.target.files],e.target.closest('[data-image-upload]'));});
 document.addEventListener('dragover',e=>{const zone=e.target.closest('[data-image-upload]');if(zone){e.preventDefault();zone.classList.add('dragging');}});
 document.addEventListener('dragleave',e=>{const zone=e.target.closest('[data-image-upload]');if(zone&&!zone.contains(e.relatedTarget))zone.classList.remove('dragging');});
 document.addEventListener('drop',e=>{const zone=e.target.closest('[data-image-upload]');if(zone){e.preventDefault();zone.classList.remove('dragging');stage([...e.dataTransfer.files],zone);}});
}
