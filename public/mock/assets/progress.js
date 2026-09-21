import {tr} from './i18n.js';
const processingStepKeys=["studio_read_pages_text", "studio_understand_page_layouts", "studio_extract_images_colors", "studio_find_the_design_direction", "studio_build_presentation"];
export const processingSteps=processingStepKeys.map(()=>'');
processingStepKeys.forEach((key,index)=>Object.defineProperty(processingSteps,index,{get:()=>tr(key)}));
export const extractionStages={get uploading(){return tr("studio_uploading_your_files");},get queued(){return tr("studio_waiting_to_start");},get reading_pages(){return tr("studio_reading_document_pages");},get extracting_text(){return tr("studio_reading_pages_extracting_text");},get classifying_pages(){return tr("studio_understanding_page_layouts_identifying_logos");},get extracting_images(){return tr("studio_extracting_complete_images");},get extracting_colors(){return tr("studio_extracting_colors");},get analyzing_moodboard(){return tr("studio_analyzing_moodboards_materials");},get finding_style(){return tr("studio_finding_the_design_direction");},get classifying_images(){return tr("studio_classifying_images_detecting_before_concept");},get matching_subquotes(){return tr("studio_matching_subcontractor_quotes");},get applying_results(){return tr("studio_assembling_your_presentation");},get complete(){return tr("studio_ready_to_review");}};
export function extractionProgress(job={}){
    const p=job.progress||{},stage=job.status==='done'?'complete':job.status==='queued'?'queued':p.stage||'reading_pages';
    const steps={uploading:0,queued:0,reading_pages:0,extracting_text:0,classifying_pages:1,extracting_images:2,extracting_colors:2,analyzing_moodboard:3,finding_style:3,classifying_images:3,applying_results:4,matching_subquotes:4,complete:4};
    const step=steps[stage]??0;
    const ranges={reading_pages:[0,0],extracting_text:[0,20],classifying_pages:[20,80],extracting_images:[80,89],extracting_colors:[89,90],analyzing_moodboard:[90,93],finding_style:[93,94],classifying_images:[94,98],applying_results:[98,99],matching_subquotes:[99,100]};
    const [from,to]=ranges[stage]||[0,0];
    const page=Number(p.page),total=Number(p.total),image=Number(p.image),images=Number(p.total_images);
    const hasPage=page>0&&total>=page,hasImage=image>0&&images>=image;
    // Announced counters describe the item currently being processed, not completed work.
    const fraction=hasPage?(page-1)/total:hasImage?(image-1)/images:0;
    const percent=stage==='complete'?100:Math.floor(from+(to-from)*fraction);
    const action=step===0?tr("studio_reading"):step===1?tr("studio_classifying"):step===2?tr("studio_cropping"):tr("studio_reviewing");
    const counter=hasPage?tr("studio_page_of_2",{v0:action,v1:page,v2:total}):hasImage?tr("studio_reviewing_image_of",{v0:image,v1:images}):'';
    return {stage,step,percent,title:extractionStages[stage]||tr("studio_processing_your_files"),get detail(){return tr("studio_step_of",{v0:step+1,v1:processingSteps.length,v2:counter?' · '+counter:''});}};
}
