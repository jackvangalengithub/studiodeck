export const MAX_FILE_BYTES=100*1024*1024;
export const MAX_BATCH_BYTES=120*1024*1024;
export function uploadSelectionError(files){
    if(files.length>20)return 'Please choose up to 20 files at a time. You can upload the rest afterwards.';
    const large=files.find(file=>file.size>MAX_FILE_BYTES);
    if(large)return `“${large.name}” is ${(Math.ceil(large.size/1024/1024*10)/10).toFixed(1)} MB. Each file can be up to 100 MB. Please compress it or split it into smaller files, then try again.`;
    if(files.reduce((total,file)=>total+file.size,0)>MAX_BATCH_BYTES)return 'These files add up to more than 120 MB. Please select fewer files and upload the rest in another batch. Each file can be up to 100 MB.';
    return '';
}
