const valid=c=>typeof c==='string'&&/^#[a-f0-9]{6}$/i.test(c);
const rgb=c=>[1,3,5].map(n=>parseInt(c.slice(n,n+2),16));
const mix=(a,b,t)=>'#'+rgb(a).map((v,n)=>Math.round(v*(1-t)+rgb(b)[n]*t).toString(16).padStart(2,'0')).join('');
const luminance=c=>rgb(c).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,n)=>s+v*[.2126,.7152,.0722][n],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
export function projectThemeVariables(theme={}){
    const colors=(theme.colors||[]).filter(valid),sorted=[...colors].sort((a,b)=>luminance(a)-luminance(b));
    const bg=theme.mode==='dark'?(valid(theme.background)?theme.background:'#152235'):mix(sorted.at(-1)||'#e8e3d7','#ffffff',.88);
    const ink=luminance(bg)<.18?'#f5f5f2':'#262b26',accent=colors.find(c=>contrast(c,bg)>=4.5)||ink;
    return {'--deck-bg':bg,'--bg':bg,'--ink':ink,'--green':accent,'--on-accent':contrast(accent,'#ffffff')>=4.5?'#ffffff':'#151915','--muted':mix(ink,bg,.28),'--soft':mix(bg,ink,.07),'--surface':mix(bg,ink,.025),'--line':mix(bg,ink,.2),'--accent':accent,'--heading':theme.font==='sans'?'Arial,sans-serif':"Georgia,'Times New Roman',serif"};
}
export const projectThemeStyle=theme=>Object.entries(projectThemeVariables(theme)).map(([key,value])=>`${key}:${value}`).join(';');
export function clearPresentationTheme(){const root=document.documentElement;delete root.dataset.projectMode;Object.keys(projectThemeVariables()).forEach(key=>root.style.removeProperty(key));}
export function applyPresentationTheme(theme){clearPresentationTheme();document.documentElement.dataset.projectMode=theme.mode==='dark'?'dark':'light';Object.entries(projectThemeVariables(theme)).forEach(([key,value])=>document.documentElement.style.setProperty(key,value));}
