import assert from 'node:assert/strict';
import {test} from 'node:test';
import {presentationComments,presentationQuestions,presentationCommunication} from '../public/assets/presentation-view.js';

test('Public presentation excludes private roots, replies, drafts and hidden slide links without mutating editor data',()=>{
 const data={iteration:{id:'current'},slide_layout:[{slide_id:'hidden',hidden:1},{slide_id:'deleted',deleted:1}],communication:{
  comments:[{id:'shared',iteration_id:'current',audience:'shared'},{id:'reply',parent_id:'shared',iteration_id:'current'},
   {id:'private',iteration_id:'current',audience:'studio'},{id:'private-reply',parent_id:'private',iteration_id:'current'},
   {id:'earlier',iteration_id:'previous',audience:'shared'}],
  items:[{id:'published',iteration_id:'current',published:1,thread_id:'shared'},
   {id:'draft',iteration_id:'current',published:0,accepted:1},{id:'dismissed',iteration_id:'current',published:1,dismissed:1},
   {id:'private-linked',iteration_id:'current',published:1,thread_id:'private'},
   {id:'previous-item',iteration_id:'previous',published:1}],
  threads:[{id:'shared'},{id:'private'}],confirmations:[{comment_id:'shared'},{comment_id:'private'}],
  attachments:[{comment_id:'reply'},{comment_id:'private-reply'}],guests:[{id:'guest'}],
  iterations:[{id:'current'},{id:'previous'}],recipients:[{email:'member',invitable:false},{email:'invite',invitable:true}],
  iteration_recipients:{current:[{email:'invite',invitable:true}]},
  iteration_slides:{current:[{id:'visible'},{id:'hidden'},{id:'deleted'}]},
 }};
 const original=structuredClone(data);
 assert.deepEqual(presentationComments(data).map(c=>c.id),['shared','reply']);
 assert.deepEqual(presentationQuestions(data).map(q=>q.id),['published']);
 const view=presentationCommunication(data);
 assert.deepEqual(view.threads,[{id:'shared'}]);
 assert.deepEqual(view.confirmations,[{comment_id:'shared'}]);
 assert.deepEqual(view.attachments,[{comment_id:'reply'}]);
 assert.deepEqual(view.iteration_slides.current,[{id:'visible'}]);
 assert.deepEqual(view.guests,[]);
 assert.deepEqual(view.recipients.map(p=>p.email),['member']);
 assert.deepEqual(data,original);
});

test('Open items include authorized shared history, all thread types, and one row per thread',async()=>{
 const {presentationThreads}=await import('../public/assets/presentation-view.js');
 const root=(id,extra={})=>({id,iteration_id:'current',audience:'shared',body:id,created_at:'2026-09-25',answered:0,...extra});
 const data={iteration:{id:'current',number:2},communication:{
  iterations:[{id:'current',number:2},{id:'old',number:1,presentation_visible:true},{id:'draft',presentation_visible:false}],
  comments:[root('conversation'),root('todo',{iteration_id:'old',thread_details:{type:'todo',assignee_name:'Client'}}),
   root('approval',{thread_details:{type:'approval'}}),root('done',{answered:1}),root('confirmed',{thread_details:{type:'approval'}}),
   root('withdrawn',{thread_details:{type:'approval'}}),root('reopened',{answered:1}),root('child',{parent_id:'reopened'}),
   root('draft',{iteration_id:'draft'}),root('private',{audience:'studio'}),root('private-reply',{parent_id:'private'})],
  threads:[{id:'todo',title:'Choose the finish'}],
  items:[{id:'q',iteration_id:'old',thread_id:'todo',published:1,accepted:1,resolved:0}],
  confirmations:[{comment_id:'approval',status:'pending',recipient_name:'Client'},
   {comment_id:'confirmed',status:'confirmed'},{comment_id:'withdrawn',status:'withdrawn'},
   {comment_id:'child',parent_id:'reopened',status:'pending',recipient_name:'Alex Client'}],
  public_iteration_slides:{old:[{id:'old-slide',title:'Original concept'}]},
 }};
 const items=presentationThreads(data),byId=Object.fromEntries(items.map(item=>[item.id,item]));
 assert.deepEqual(items.filter(item=>item.open).map(item=>item.id).sort(),['approval','conversation','reopened','todo']);
 assert.deepEqual(items.filter(item=>!item.open).map(item=>item.id).sort(),['confirmed','done','withdrawn']);
 assert.equal(byId.todo.iteration_id,'old');assert.equal(byId.todo.iteration,1);assert.equal(byId.todo.title,'Choose the finish');
 assert.equal(byId.approval.status,'awaiting_approval');assert.equal(byId.reopened.status,'awaiting_approval');
 assert.equal(byId.reopened.person,'Alex Client');
 assert.equal(byId.confirmed.status,'confirmed');assert.equal(byId.withdrawn.status,'withdrawn');
 data.communication.items[0].resolved=1;
 data.communication.confirmations[0].status='confirmed';
 const updated=presentationThreads(data);
 assert.equal(updated.find(item=>item.id==='todo').open,false);
 assert.equal(updated.find(item=>item.id==='approval').open,false);
});

test('Shared completion ignores private work and keeps published unfinished work open',async()=>{
 const {presentationThreads}=await import('../public/assets/presentation-view.js');
 const data={iteration:{id:'current',number:1},communication:{
  comments:[{id:'root',iteration_id:'current',audience:'shared',answered:1,is_open:true,presentation_is_open:false,body:'Public conversation'}],
  items:[{id:'private-work',iteration_id:'current',thread_id:'root',published:0,accepted:1,resolved:0}],
 }};
 assert.equal(presentationThreads(data)[0].open,false);
 data.communication.items[0].published=1;
 assert.equal(presentationThreads(data)[0].open,true);
});
