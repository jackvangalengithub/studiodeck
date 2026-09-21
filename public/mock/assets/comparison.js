import {tr} from './i18n.js';
const positions=new Map();
export const comparisonPosition=id=>positions.get(id)??50;
export const resetComparisonPosition=id=>positions.delete(id);
export function installComparisonControls(){
    document.addEventListener('input',event=>{
        const input=event.target.closest('[data-comparison-range]');if(!input)return;
        const id=input.dataset.comparisonRange,value=Math.max(0,Math.min(100,Number(input.value)));
        positions.set(id,value);
        document.querySelectorAll('[data-comparison]').forEach(root=>{
            if(root.dataset.comparison!==id)return;
            root.style.setProperty('--comparison',value+'%');
            const range=root.querySelector('input');range.value=value;range.setAttribute('aria-valuetext',tr('comparison_value',{original:value,generated:100-value}));
        });
    });
}
export function latestSlideImageJob(jobs,id){return [...(jobs||[])].reverse().find(job=>job.type==='slide_image_edit'&&job.slide_id===id);}
