import {eq,and,oneOf,now,uuid} from './client.js';
import {unavailable,PlatformError} from './transport.js';
export function installCommunication(c){
  const record=async(table,id)=>{const r=(await c.query(table,eq('id',id)))[0];if(!r)throw new PlatformError('Record not found.',{status:404});return r;};
  async function feed(b={}){
    const specs=[];const add=(id,table,f,fields,extra)=>specs.push(c.querySpec(id,table,f,fields,extra));
    add('projects','projects',and(eq('studio_id',c.studioRecord?.id??null),b.project_id?eq('id',b.project_id):[]),['name']);
    add('iterations','iterations',and(oneOf('project_id','{{projects.entities[].id}}'),b.iteration?eq('id',b.iteration):[]),['project_id','number']);
    c.communicationSpecs(add,b.iteration||null);
    for(const s of specs)if(['comments','questions','findings','runs'].includes(s.id))s.params.filter=oneOf('iteration_id','{{iterations.entities[].id}}');
    const d=await c.graph(specs,{completeScope:{studio_id:c.studioRecord?.id,feed:b}});
    return c.assembleCommunication(d,{id:b.iteration||null},{id:b.project_id||null});
  }
  Object.assign(c.operations,{
    comments_feed:async b=>{const d=await feed(b);return {...d.communication,comments:d.comments,items:d.comments,communication:d.communication};},
    attention:async b=>{const d=await feed(b);return {...d.communication,comments:d.comments,items:d.open_questions};},
    mention_people:async b=>{if(b.conversation)throw unavailable('guest_mentions','Guest profiles and conversation scopes must be configured first.');let pid=b.project_id;if(!pid&&b.iteration)pid=(await record('iterations',b.iteration)).project_id;if(!pid)return [];const [contacts,clients,team]=await Promise.all(['contacts','project_client_members','project_team_contacts'].map(t=>c.query(t,eq('project_id',pid))));return [...contacts,...clients,...team].filter(p=>p.email).map(p=>({...p,available:true,invitable:false}));},
    conversation:async()=>{throw unavailable('conversation','Conversation guest access needs platform guest profiles and inherited, expiring row scopes.');},
    read_comments:async b=>{
      const key='user:'+c.identity.email.toLowerCase(),ids=b.ids||[],existing=await c.query('comment_reads',and(oneOf('comment_id',ids),eq('person_key',key)));await c.atomic(ids.map(id=>c.mutation('comment_reads',{comment_id:id,person_key:key,read_at:now()},existing.find(r=>r.comment_id===id)?.id)));return {ok:true};
    },
    communication_post:async b=>{
      if(b.conversation||b.related_thread_id)throw unavailable('linked_guest_thread','Linked guest threads require inherited grant creation on the platform.');
      const body=String(b.body||'').trim();if(!body)throw Error('Write a message first.');
      const iteration=await record('iterations',b.iteration),id=uuid(),parent=b.parent_id||null,actor=c.identity.email;
      if(parent){const root=await record('comments',parent);if(root.iteration_id!==iteration.id)throw Error('The conversation belongs to another iteration.');}
      const calls=[c.mutation('comments',{id,iteration_id:iteration.id,parent_id:parent,body,author:actor,created_at:now(),slide:b.slide||'general',answered:false,annotation:b.annotation||{}})];
      if(!parent){calls.push(c.mutation('communication_threads',{comment_id:id,title:b.thread_title||body.slice(0,160)}));calls.push(c.mutation('communication_audiences',{root_id:id,audience:b.audience==='studio'?'studio':'shared'}));}
      if(b.recipient){if(b.amount&&iteration.locked)throw Error('This iteration is locked.');const amount=b.amount==null||b.amount===''?null:Math.round(Number(String(b.amount).replace(',','.'))*100);if(amount!==null&&!Number.isFinite(amount))throw Error('Enter a valid budget amount.');calls.push(c.mutation('comment_confirmations',{comment_id:id,recipient:b.recipient,recipient_name:b.recipient_name||b.recipient,amount_cents:amount,status:'pending'}));}
      if(b.version_id)calls.push(c.mutation('comment_attachments',{comment_id:id,version_id:b.version_id}));
      for(const mention of b.mentions||[])calls.push(c.mutation('comment_mentions',{comment_id:id,email:mention.email,label:mention.label||mention.name||mention.email}));
      await c.atomic(calls);return {id,notice:'Message saved. Email notifications are not yet connected on the platform.'};
    },
    comment:b=>c.operations.communication_post(b),
    comment_answered:async b=>{await c.write('comments',{answered:!!b.answered},b.id);return {ok:true};},
    communication_thread_update:async b=>{
      const comment=await record('comments',b.id),calls=[];if(comment.author!==c.identity.email)throw new PlatformError('Only the author can change this thread.',{status:403});
      const threads=await c.query('communication_threads',eq('comment_id',comment.id));if('title'in b||'thread_title'in b)calls.push(c.mutation('communication_threads',{comment_id:comment.id,title:b.title||b.thread_title},threads[0]?.id));
      if('audience'in b)throw unavailable('communication_audience_change','Audience changes must reconcile grants and pending notifications on the platform.');
      const topics=await c.query('communication_topics',eq('root_id',comment.id));const changes=Object.fromEntries(['assignee','assignee_name','due_date','type'].filter(k=>k in b).map(k=>[k,b[k]]));if(Object.keys(changes).length)calls.push(c.mutation('communication_topics',{root_id:comment.id,...changes},topics[0]?.id));await c.atomic(calls);return {ok:true};
    },
    communication_work_decide:async b=>{if(b.conversation)throw unavailable('guest_work_decide');const topic=(await c.query('communication_topics',eq('root_id',b.id)))[0];if(!topic?.question_id)throw Error('This thread has no linked task.');const question=await record('open_questions',topic.question_id),iteration=await record('iterations',question.iteration_id);if(iteration.locked)throw Error('This iteration is locked.');await c.write('open_questions',{resolved:!!b.resolved},question.id);return {ok:true};},
    communication_slide_link:async b=>{await c.write('comments',{slide:b.slide||'general'},b.id);return {ok:true};},
    reply_open_question:async b=>{const question=await record('open_questions',b.id||b.question_id);return c.operations.communication_post({...b,iteration:question.iteration_id,body:b.body||b.answer});},
  });
}
