export const budgetIsRange=item=>item.min_amount_cents!=null&&item.max_amount_cents!=null;
export function budgetAmount(item,percent=null){if(budgetIsRange(item))return Number(item.min_amount_cents)+Math.round((Number(item.max_amount_cents)-Number(item.min_amount_cents))*Math.max(0,Math.min(100,percent??Number(item.range_percent||0)))/100);return item.amount_cents==null?null:Number(item.amount_cents);}
export function budgetEnabled(item,items){const seen=new Set();while(item){if(Number(item.is_optional)&&!item.selected)return false;const parent=item.parent_id;if(!parent)return true;if(seen.has(parent))return false;seen.add(parent);item=items.find(row=>row.id===parent);}return true;}
export const budgetTotal=(items,percent=null)=>items.reduce((sum,item)=>sum+(!Number(item.included)&&budgetEnabled(item,items)?budgetAmount(item,percent)??0:0),0);
// A parent shows its source price plus enabled extras beneath it. Included
// subquotes stay within the base price; the grand total still counts each row once.
export function budgetLineTotal(item,items,percent=null){
 let amount=budgetAmount(item,percent),known=amount!==null;amount??=0;
 const byId=new Map(items.map(row=>[row.id,row]));
 for(const row of items){
  if(row.id===item.id||Number(row.included)||!budgetEnabled(row,items))continue;
  let parent=row.parent_id;const seen=new Set();
  while(parent&&!seen.has(parent)){
   if(parent===item.id){const value=budgetAmount(row,percent);if(value!==null){amount+=value;known=true;}break;}
   seen.add(parent);parent=byId.get(parent)?.parent_id;
  }
 }
 return known?amount:null;
}
