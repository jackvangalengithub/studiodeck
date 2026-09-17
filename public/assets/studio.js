export const studioPalettes={
  sage:{name:'Sage & linen',colors:['#465441','#eef0e8','#f7f7f3','#c1c6b4']},
  clay:{name:'Clay & cream',colors:['#794f40','#f0e5dc','#faf6f0','#cda993']},
  slate:{name:'Slate & mist',colors:['#3d566c','#e7edf2','#f5f7fa','#a9bacb']},
  ink:{name:'Ink & chalk',colors:['#303239','#e9e9eb','#f6f6f7','#b4b4bd']},
  ocean:{name:'Ocean & salt',colors:['#285b6b','#e1eef0','#f3f8f8','#8ebcc3']},
  plum:{name:'Plum & blush',colors:['#68445f','#efe5ed','#faf6f9','#c8a3bd']},
  rust:{name:'Rust & sand',colors:['#86482f','#f3e5db','#fbf6f0','#d2a385']},
  forest:{name:'Forest & moss',colors:['#30564a','#e2ece5','#f5f8f3','#94b3a0']},
  mustard:{name:'Ochre & ivory',colors:['#776022','#f0ecd9','#faf9f1','#c9b875']},
  rose:{name:'Rose & stone',colors:['#80515b','#f2e6e8','#fbf6f7','#d4aeb5']},
  lavender:{name:'Lavender & pearl',colors:['#57527d','#eae8f3','#f7f6fb','#b4aed1']},
  espresso:{name:'Espresso & oat',colors:['#58483a','#ece6de','#faf7f2','#b8a691']},
  grayscale:{name:'Pure grayscale',colors:['#454545','#eeeeee','#fafafa','#bdbdbd'],ink:'#2b2b2b',muted:'#666666',surface:'#ffffff'},
  warmgray:{name:'Warm grayscale',colors:['#55534f','#efede9','#faf9f6','#c7c3bc'],ink:'#2e2d2a',muted:'#69665f',surface:'#fffefb'}
};
export const studioStyles={classic:'Classic',modern:'Modern',minimal:'Minimal',editorial:'Editorial'};
export function cleanStudioTheme(theme={}){return {palette:studioPalettes[theme.palette]?theme.palette:'sage',style:studioStyles[theme.style]?theme.style:'modern',font:['serif','sans'].includes(theme.font)?theme.font:['classic','editorial'].includes(theme.style)?'serif':'sans'};}
export function applyStudioTheme(theme,active){const root=document.documentElement;delete root.dataset.studioPalette;delete root.dataset.studioStyle;if(active){const value=cleanStudioTheme(theme),palette=studioPalettes[value.palette],colors=palette.colors;root.dataset.studioPalette=value.palette;root.dataset.studioStyle=value.style;Object.entries({'--green':colors[0],'--soft':colors[1],'--bg':colors[2],'--accent':colors[3],'--line':colors[3]+'66','--ink':palette.ink||'#292d2a','--muted':palette.muted||'#636b65','--surface':palette.surface||'#ffffff','--heading':value.font==='serif'?"Georgia,'Times New Roman',serif":'Arial,sans-serif','--studio-radius':({classic:'6px',modern:'12px',minimal:'2px',editorial:'0px'})[value.style],'--on-accent':'#ffffff'}).forEach(([k,v])=>root.style.setProperty(k,v));}}
