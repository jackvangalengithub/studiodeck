import test from 'node:test';
import assert from 'node:assert/strict';
import {configureNavigation,destinationFor,navigationActions,navigationElement,panelActions,readPanel,withPanel} from '../public/assets/navigation.js';
import {readWorkspaceRoute} from '../public/assets/routes.js';
const context={route:{studioId:'200'},current:'/200/projects/p1?tab=files',projectId:'p1',iteration:'i1',tab:'files',slides:[{id:'s1',section:'first'},{id:'s2',section:'last'}],slide:0,presentationMode:'slides',download:()=>({url:'/200/userfiles/f1/download',name:'File.pdf'})};
const parse=path=>new URL(path,'https://example.com');
test('navigation inventory resolves real destinations and leaves mutations as actions',()=>{
 const data={id:'record',project:'p1',iteration:'i1',tab:'slides',slide:'1',section:'last',mode:'scroll',offset:'25'};
 for(const action of navigationActions){const dest=destinationFor(action,data,context);assert.ok(dest?.href,action);assert.ok(dest.href.startsWith('/'),action);assert.ok(!dest.href.includes('undefined'),action);}
 for(const action of ['delete-project','archive-project','save','comm-confirm','website-confirm-publish','upload','billing-checkout'])assert.equal(destinationFor(action,data,context),null,action);
 assert.equal(readWorkspaceRoute(parse(destinationFor('preview-project',data,context).href)).presentation,true);
 assert.equal(parse(destinationFor('next-slide',data,context).href).pathname,'/200/slide/s2');
});
test('all panel selections round trip and reject unregistered operations or data',()=>{
 for(const [action,fields]of Object.entries(panelActions)) {
  const data=Object.fromEntries(fields.map(k=>[k,'literal <&" / value']));
  const url=withPanel('/200/projects/p1?tab=files',{action,data});
  assert.deepEqual(readPanel(parse(url)),{action,data});
  assert.equal(withPanel(url,null),'/200/projects/p1?tab=files');
 }
 for(const url of ['/?panel=delete-project','/?panel=profile&selection=null','/?panel=profile&selection=[]','/?panel=profile&selection=%7B','/?panel=profile&selection={"action":"delete"}','/?panel=history&selection={"id":{}}'])assert.throws(()=>readPanel(parse(url)),url);
});
test('the DOM boundary enforces anchors for registered controls without nested actions',()=>{
 configureNavigation(props=>destinationFor(props['data-action'],{id:'p1',tab:'files'},context));
 try {
  const nav=navigationElement('button',{'data-action':'tab',class:'tab',type:'button'});
  assert.equal(nav.tag,'a');assert.equal(parse(nav.props.href).searchParams.get('tab'),'files');assert.equal(nav.props.type,undefined);
  assert.equal(navigationElement('button',{'data-action':'tab',disabled:''}).tag,'button');
  assert.equal(navigationElement('button',{'data-action':'delete-project'}).tag,'button');
  assert.equal(navigationElement('button',{'data-action':'tab',type:'submit'}).tag,'button');
 }finally {configureNavigation(null);}
});
