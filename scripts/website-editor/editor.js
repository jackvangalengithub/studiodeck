import {EditorView,basicSetup} from 'codemirror';
import {keymap} from '@codemirror/view';
import {indentWithTab,isolateHistory} from '@codemirror/commands';
import {html} from '@codemirror/lang-html';
import {css} from '@codemirror/lang-css';
import {javascript} from '@codemirror/lang-javascript';
import {oneDark} from '@codemirror/theme-one-dark';
export async function formatEditor(view,filename){
 const before=view.state, value=before.doc.toString();
 const {formatSource}=await import('./website-formatter.js');
 const result=await formatSource(filename,value,before.selection.main.head);
 // A slow formatter must never replace newer typing or a different file.
 if(!view.dom.isConnected||view.state.doc!==before.doc||!view.state.selection.eq(before.selection))return 'stale';
 if(result.formatted===value)return 'unchanged';
 applyFormatting(view,result);
 return 'formatted';
}
function applyFormatting(view,result){
 view.dispatch({changes:{from:0,to:view.state.doc.length,insert:result.formatted},selection:{anchor:result.cursorOffset},annotations:isolateHistory.of('full'),userEvent:'input.format'});
}
export function mountEditor(parent,{filename,value,onChange,onSave,onFormat,state,formatted}){
 const view=new EditorView({parent,...(state&&state.doc.toString()===value?{state}:{doc:value,extensions:[basicSetup,oneDark,filename==='index.html'?html():filename==='styles.css'?css():javascript(),EditorView.lineWrapping,EditorView.contentAttributes.of({'aria-label':filename+' source'}),EditorView.theme({'&':{height:'100%'},'.cm-scroller':{overflow:'auto',fontFamily:'ui-monospace, SFMono-Regular, Consolas, monospace',fontSize:'13px'},'.cm-content':{padding:'16px 0'},'.cm-gutters':{paddingLeft:'6px'}}),keymap.of([{key:'Mod-s',run:()=>{onSave();return true;}},{key:'Alt-Shift-f',run:()=>{onFormat();return true;}},indentWithTab]),EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString());})]})});
 if(formatted&&formatted.formatted!==value)applyFormatting(view,formatted);
 return view;
}
