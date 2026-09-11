import type { ComposeDraft,EmailAddress,EmailMessage,EmailThread } from './types';
import { formatRecipients,normalizeEmail,parseRecipients } from './security';

export const PXPRESS_SIGNATURE='\n\nThank you,\nPxpress\nProfessional Transportation Services\n(234) 200-6969\npxpressmedia@gmail.com';

export function buildComposeDraft(input:{draftId?:string;to?:string;cc?:string;bcc?:string;subject?:string;body?:string;threadId?:string;inReplyTo?:string;references?:string[]}):ComposeDraft{
  const raw=(input.body||'').trim(),quoteStart=raw.search(/\nOn .+ wrote:\n/),visible=quoteStart<0?raw:raw.slice(0,quoteStart).trim(),quote=quoteStart<0?'':raw.slice(quoteStart).trim();
  const plainText=`${visible}${PXPRESS_SIGNATURE}${quote?`\n\n${quote}`:''}`;
  return{id:input.draftId,to:parseRecipients(input.to||''),cc:parseRecipients(input.cc||''),bcc:parseRecipients(input.bcc||''),subject:(input.subject||'').trim().slice(0,998),plainText,threadId:input.threadId,inReplyTo:input.inReplyTo,references:[...new Set(input.references||[])],attachments:[]};
}
export function validateDraft(draft:ComposeDraft){
  if(!draft.to.length)return'Add at least one recipient.';
  if(!draft.subject.trim())return'Add a subject.';
  const body=quotedTextParts(draft.plainText.replace(PXPRESS_SIGNATURE,'')).visible.trim();
  if(!body)return'Write a message before sending.';
  if(draft.plainText.length>100_000)return'This message is too long.';
  return'';
}
export function buildReply(message:EmailMessage,mode:'reply'|'reply_all'|'forward'){
  const subject=mode==='forward'?prefixSubject(message.subject,'Fwd:'):prefixSubject(message.subject,'Re:');
  const recipients:EmailAddress[]=mode==='forward'?[]:[message.from,...(mode==='reply_all'?message.to:[])];
  const byEmail=new Map<string,EmailAddress>();for(const recipient of recipients){const key=normalizeEmail(recipient.email);if(!byEmail.has(key))byEmail.set(key,recipient)}const unique=[...byEmail.values()];
  return{to:formatRecipients(unique),subject,threadId:mode==='forward'?undefined:message.threadId,inReplyTo:mode==='forward'?undefined:message.rfcMessageId,references:mode==='forward'?[]:[...message.references,message.rfcMessageId],quotedText:`\n\nOn ${message.sentAt}, ${message.from.name||message.from.email} wrote:\n${message.plainText.split('\n').map(line=>`> ${line}`).join('\n')}`};
}
function prefixSubject(subject:string,prefix:'Re:'|'Fwd:'){return new RegExp(`^${prefix.replace(':','')}:`,'i').test(subject)?subject:`${prefix} ${subject}`}
export function dedupeThreads(items:EmailThread[]){
  const byProviderId=new Map<string,EmailThread>();
  for(const item of items){const previous=byProviderId.get(item.providerThreadId);if(!previous||Date.parse(item.lastMessageAt)>Date.parse(previous.lastMessageAt))byProviderId.set(item.providerThreadId,item)}
  return [...byProviderId.values()].sort((a,b)=>Date.parse(b.lastMessageAt)-Date.parse(a.lastMessageAt)||a.id.localeCompare(b.id));
}
export function matchCustomerByEmail(participants:EmailAddress[],customers:Array<{id:string;email:string}>){
  const lookup=new Map(customers.map(customer=>[normalizeEmail(customer.email),customer.id]));
  return participants.map(participant=>lookup.get(normalizeEmail(participant.email))).find(Boolean);
}
export function createSendIdempotencyKey(draft:ComposeDraft,nonce:string){
  void draft;
  return `pxpress-email-${nonce}`;
}
export function quotedTextParts(value:string){const lines=value.split('\n');const index=lines.findIndex(line=>/^>/.test(line.trim())||/^On .+ wrote:$/.test(line.trim()));return index<0?{visible:value,quoted:''}:{visible:lines.slice(0,index).join('\n').trim(),quoted:lines.slice(index).join('\n')};}
