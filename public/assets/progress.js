// Page counters belong to a phase. Overall progress continues across those phases.
export const processingSteps=['Read pages & text','Understand page layouts','Extract images & colors','Find the design direction','Build presentation'];
export const extractionStages={uploading:'Uploading your files',queued:'Waiting to start',reading_pages:'Reading document pages',extracting_text:'Reading pages & extracting text',classifying_pages:'Understanding page layouts & identifying logos',extracting_images:'Extracting complete images',extracting_colors:'Extracting colors',analyzing_moodboard:'Analyzing moodboards & materials',finding_style:'Finding the design direction',classifying_images:'Classifying images & detecting before / concept',applying_results:'Assembling your presentation',complete:'Ready to review'};
export function extractionProgress(job={}){
    const p=job.progress||{},stage=job.status==='done'?'complete':job.status==='queued'?'queued':p.stage||'reading_pages';
    const steps={uploading:0,queued:0,reading_pages:0,extracting_text:0,classifying_pages:1,extracting_images:2,extracting_colors:2,analyzing_moodboard:3,finding_style:3,classifying_images:3,applying_results:4,complete:4};
    const step=steps[stage]??0;
    const ranges={reading_pages:[0,0],extracting_text:[0,20],classifying_pages:[20,80],extracting_images:[80,89],extracting_colors:[89,90],analyzing_moodboard:[90,93],finding_style:[93,94],classifying_images:[94,98],applying_results:[98,100]};
    const [from,to]=ranges[stage]||[0,0];
    const page=Number(p.page),total=Number(p.total),image=Number(p.image),images=Number(p.total_images);
    const hasPage=page>0&&total>=page,hasImage=image>0&&images>=image;
    // Announced counters describe the item currently being processed, not completed work.
    const fraction=hasPage?(page-1)/total:hasImage?(image-1)/images:0;
    const percent=stage==='complete'?100:Math.floor(from+(to-from)*fraction);
    const action=step===0?'Reading':step===1?'Classifying':step===2?'Cropping':'Reviewing';
    const counter=hasPage?`${action} page ${page} of ${total}`:hasImage?`Reviewing image ${image} of ${images}`:'';
    return {stage,step,percent,title:extractionStages[stage]||'Processing your files',detail:`Step ${step+1} of ${processingSteps.length}${counter?' · '+counter:''}`};
}
