export function commentThreads(comments,{sort='newest',showAnswered=false}={}){
 const direction=sort==='oldest'?1:-1;
 const ordered=[...comments].sort((a,b)=>direction*(String(a.created_at).localeCompare(String(b.created_at))||Number(a.comment_order||0)-Number(b.comment_order||0)));
 const threads=ordered.filter(c=>!c.parent_id&&(showAnswered||!Number(c.answered))).map(comment=>({comment,replies:[]}));
 const byId=new Map(threads.map(thread=>[thread.comment.id,thread]));
 for(const comment of ordered)if(comment.parent_id){const thread=byId.get(comment.parent_id);if(thread)thread.replies.push(comment);}
 return threads;
}
