import {tr} from './i18n.js';
export const MAX_FILE_BYTES=100*1024*1024;
export const MAX_BATCH_BYTES=120*1024*1024;
export function uploadSelectionError(files){
    if(files.length>20)return tr("studio_please_choose_up_to_20_files_at_a_time_you_can_upload_the_rest_afterwards");
    const large=files.find(file=>file.size>MAX_FILE_BYTES);
    if(large)return tr("studio_is_mb_each_file_can_be_up_to_100_mb_please_compress_it_or_split_it_into_smaller_files_then_try_again",{v0:large.name,v1:(Math.ceil(large.size/1024/1024*10)/10).toFixed(1)});
    if(files.reduce((total,file)=>total+file.size,0)>MAX_BATCH_BYTES)return tr("studio_these_files_add_up_to_more_than_120_mb_please_select_fewer_files_and_upload_the_rest_in_another_batc");
    return '';
}
