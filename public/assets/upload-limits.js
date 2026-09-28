// The platform permits 25 MiB/file, but its current 32 MiB JSON body ceiling
// includes base64 overhead. 23 MiB leaves space for filenames and JSON framing.
export const MAX_FILE_BYTES=23*1024*1024;
export const MAX_BATCH_BYTES=23*1024*1024;
export function uploadSelectionError(files){
  if(files.length>25)return 'Choose up to 25 files at a time.';
  const large=files.find(file=>file.size>MAX_FILE_BYTES);
  if(large)return `${large.name} exceeds the current 23 MiB upload limit.`;
  if(files.reduce((sum,file)=>sum+file.size,0)>MAX_BATCH_BYTES)return 'Choose at most 23 MiB of files per upload.';
  return '';
}
