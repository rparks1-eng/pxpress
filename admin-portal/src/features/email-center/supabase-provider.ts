import {supabase} from '../../lib/supabase';
import type {AttachmentAccess,EmailListQuery,OwnerEmailProvider} from './provider-contract';
import type {ComposeDraft,EmailConnection,EmailMessage,EmailPage,EmailThread,MessageAction,SendReceipt} from './types';

type ApiEnvelope<T>={data?:T;message?:string;code?:string};
async function invoke<T>(action:string,input:Record<string,unknown>={}):Promise<T>{
  if(!supabase)throw new Error('Owner email is not connected.');
  const{data,error,response}=await supabase.functions.invoke<ApiEnvelope<T>>('owner-email-admin',{body:{action,...input}});
  if(error||data?.data===undefined){let code=data?.code;try{const errorResponse=(error as {context?:{clone?:()=>Response}}|null)?.context;if(!code&&typeof errorResponse?.clone==='function')code=String((await errorResponse.clone().json())?.code||'');if(!code&&response)code=String((await response.clone().json())?.code||'')}catch{/* generic error below */}throw new Error(code||'Owner email operation could not be verified.');}
  return data.data;
}
export function beginOwnerGmailOAuth(){return invoke<{authorizationUrl:string}>('beginOAuth')}
export function completeOwnerGmailOAuth(code:string,state:string){return invoke<{connected:false;status:'paused';accountEmail:string}>('completeOAuth',{code,state})}
export function activateOwnerGmailConnection(){return invoke<EmailConnection>('activateConnection')}
export class SupabaseOwnerEmailProvider implements OwnerEmailProvider{
  connection(){return invoke<EmailConnection>('connection')}
  listThreads(query:EmailListQuery){return invoke<EmailPage>('listThreads',query)}
  readThread(threadId:string){return invoke<{thread:EmailThread;messages:EmailMessage[]}>('readThread',{threadId})}
  saveDraft(draft:ComposeDraft,expectedRevision?:string){return invoke<{id:string;revision:string}>('saveDraft',{draft,expectedRevision})}
  discardDraft(draftId:string,expectedRevision:string){return invoke<void>('discardDraft',{draftId,expectedRevision})}
  sendDraft(draft:ComposeDraft,idempotencyKey:string,confirmationToken:string){return invoke<SendReceipt>('sendDraft',{draft,idempotencyKey,confirmationToken})}
  modifyThread(threadId:string,messageAction:MessageAction,idempotencyKey:string){return invoke<void>('modifyThread',{threadId,messageAction,idempotencyKey})}
  attachmentAccess(messageId:string,attachmentId:string){return invoke<AttachmentAccess>('attachmentAccess',{messageId,attachmentId})}
}
