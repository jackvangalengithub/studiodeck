import {parseHTML} from 'linkedom';
import {nodes} from '../../public/assets/render.js';
const {window}=parseHTML('<!doctype html><html><head></head><body></body></html>');
Object.assign(globalThis,{window,document:window.document,Node:window.Node,MutationObserver:window.MutationObserver,DocumentFragment:window.DocumentFragment,location:new URL('https://studiodeck.test/')});
Object.defineProperty(document,'baseURI',{value:location.href});
export function renderNode(view){const root=document.createElement('div');root.append(...nodes(view));return root;}
export const renderMarkup=view=>renderNode(view).innerHTML;
