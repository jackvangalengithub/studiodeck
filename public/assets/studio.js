import {tr} from './i18n.js';
export const studioPalettes={
  sage:{get name(){return tr("studio_sage_linen");},colors:['#465441','#eef0e8','#f7f7f3','#c1c6b4']},
  clay:{get name(){return tr("studio_clay_cream");},colors:['#794f40','#f0e5dc','#faf6f0','#cda993']},
  slate:{get name(){return tr("studio_slate_mist");},colors:['#3d566c','#e7edf2','#f5f7fa','#a9bacb']},
  ink:{get name(){return tr("studio_ink_chalk");},colors:['#303239','#e9e9eb','#f6f6f7','#b4b4bd']},
  ocean:{get name(){return tr("studio_ocean_salt");},colors:['#285b6b','#e1eef0','#f3f8f8','#8ebcc3']},
  plum:{get name(){return tr("studio_plum_blush");},colors:['#68445f','#efe5ed','#faf6f9','#c8a3bd']},
  rust:{get name(){return tr("studio_rust_sand");},colors:['#86482f','#f3e5db','#fbf6f0','#d2a385']},
  forest:{get name(){return tr("studio_forest_moss");},colors:['#30564a','#e2ece5','#f5f8f3','#94b3a0']},
  mustard:{get name(){return tr("studio_ochre_ivory");},colors:['#776022','#f0ecd9','#faf9f1','#c9b875']},
  rose:{get name(){return tr("studio_rose_stone");},colors:['#80515b','#f2e6e8','#fbf6f7','#d4aeb5']},
  lavender:{get name(){return tr("studio_lavender_pearl");},colors:['#57527d','#eae8f3','#f7f6fb','#b4aed1']},
  espresso:{get name(){return tr("studio_espresso_oat");},colors:['#58483a','#ece6de','#faf7f2','#b8a691']},
  grayscale:{get name(){return tr("studio_pure_grayscale");},colors:['#454545','#eeeeee','#fafafa','#bdbdbd'],ink:'#2b2b2b',muted:'#666666',surface:'#ffffff'},
  warmgray:{get name(){return tr("studio_warm_grayscale");},colors:['#55534f','#efede9','#faf9f6','#c7c3bc'],ink:'#2e2d2a',muted:'#69665f',surface:'#fffefb'}
};
export const studioStyles={get classic(){return tr("studio_classic");},get modern(){return tr("studio_modern");},get minimal(){return tr("studio_minimal");},get editorial(){return tr("studio_editorial");}};
export const fixedStudioTheme=Object.freeze({palette:'warmgray',style:'editorial',font:'serif'});
export function cleanStudioTheme(){return {...fixedStudioTheme};}
export function studioThemeVariables(){const p=studioPalettes.warmgray;return {'--green':p.colors[0],'--soft':p.colors[1],'--bg':p.colors[2],'--accent':p.colors[3],'--line':p.colors[3]+'66','--ink':p.ink,'--muted':p.muted,'--surface':p.surface,'--heading':"Georgia,'Times New Roman',serif",'--studio-radius':'0px','--on-accent':'#ffffff'};}
export const studioThemeStyle=()=>Object.entries(studioThemeVariables()).map(([key,value])=>`${key}:${value}`).join(';');
export function applyStudioTheme(theme,active){const root=document.documentElement;delete root.dataset.studioPalette;delete root.dataset.studioStyle;if(active){root.dataset.studioPalette='warmgray';root.dataset.studioStyle='editorial';Object.entries(studioThemeVariables()).forEach(([key,value])=>root.style.setProperty(key,value));}}
