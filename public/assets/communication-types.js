export const threadTypes=[['conversation','Conversation'],['todo','To do'],['approval','Approval']];
export const normalizeThreadType=type=>({discussion:'conversation',question:'conversation',confirmation:'approval',price_adjustment:'approval'}[type]||type||'conversation');
