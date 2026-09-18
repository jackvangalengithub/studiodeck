const types={
 pdf:['coral','document'],ppt:['amber','presentation'],pptx:['amber','presentation'],
 xls:['green','table'],xlsx:['green','table'],csv:['green','table'],
 doc:['blue','document'],docx:['blue','document'],txt:['blue','document'],
 jpg:['violet','image'],jpeg:['violet','image'],png:['violet','image'],webp:['violet','image'],gif:['violet','image'],svg:['violet','image'],
 mp4:['pink','presentation'],mov:['pink','presentation'],zip:['slate','table']
};
const mimeTypes={'application/pdf':'pdf','application/vnd.ms-powerpoint':'ppt','application/vnd.openxmlformats-officedocument.presentationml.presentation':'pptx','application/vnd.ms-excel':'xls','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'xlsx','text/csv':'csv','application/msword':'doc','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','text/plain':'txt','image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg','video/mp4':'mp4','video/quicktime':'mov','application/zip':'zip'};
const shapes={
 document:'<rect x="6" y="5" width="17" height="23" rx="4" fill="currentColor" opacity=".25"/><path d="M16 8h13v20H16z" fill="currentColor"/><path d="M19 14h7M19 19h7M19 24h4" stroke="white" stroke-width="1.7" stroke-linecap="round"/>',
 presentation:'<circle cx="15" cy="15" r="9" fill="currentColor" opacity=".3"/><path d="m18 8 11 16H10z" fill="currentColor"/>',
 table:'<rect x="7" y="6" width="10" height="10" rx="3" fill="currentColor"/><rect x="20" y="6" width="10" height="10" rx="3" fill="currentColor" opacity=".3"/><rect x="7" y="19" width="10" height="10" rx="3" fill="currentColor" opacity=".3"/><rect x="20" y="19" width="10" height="10" rx="3" fill="currentColor"/>',
 image:'<circle cx="25" cy="10" r="5" fill="currentColor" opacity=".4"/><path d="m5 27 11-17 11 17z" fill="currentColor"/><path d="m17 27 7-10 8 10z" fill="currentColor" opacity=".4"/>'
};
export function fileType(file){
 const extension=String(file.name||'').match(/\.([a-z0-9]{1,8})$/i)?.[1].toLowerCase();
 return extension||mimeTypes[String(file.mime||'').split(';')[0].toLowerCase()]||'file';
}
export function fileTypeLogo(file){
 const type=fileType(file),[color,shape]=types[type]||['slate','document'];
 return `<span class="file-type-logo file-type-${color}" aria-hidden="true"><svg viewBox="0 0 38 34">${shapes[shape]}</svg><b>${type.toUpperCase()}</b></span>`;
}
const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
export function sortDownloadFiles(files,title=file=>file.name||''){
 return [...files].sort((a,b)=>collator.compare(fileType(a),fileType(b))||collator.compare(title(a),title(b)));
}
