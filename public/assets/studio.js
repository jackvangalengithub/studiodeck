export const studioPalettes={
  sage:{name:'Sage & linen',colors:['#465441','#eef0e8','#f7f7f3','#c1c6b4']},
  clay:{name:'Clay & cream',colors:['#794f40','#f0e5dc','#faf6f0','#cda993']},
  slate:{name:'Slate & mist',colors:['#3d566c','#e7edf2','#f5f7fa','#a9bacb']},
  ink:{name:'Ink & chalk',colors:['#303239','#e9e9eb','#f6f6f7','#b4b4bd']}
};
export const studioStyles={classic:'Classic',modern:'Modern',minimal:'Minimal',editorial:'Editorial'};
export function cleanStudioTheme(theme={}){return {palette:studioPalettes[theme.palette]?theme.palette:'sage',style:studioStyles[theme.style]?theme.style:'modern'};}
export function applyStudioTheme(theme,active){const root=document.documentElement;delete root.dataset.studioPalette;delete root.dataset.studioStyle;if(active){const value=cleanStudioTheme(theme);root.dataset.studioPalette=value.palette;root.dataset.studioStyle=value.style;}}
