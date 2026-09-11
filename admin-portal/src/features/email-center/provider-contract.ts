import type { ComposeDraft,EmailConnection,EmailMessage,EmailPage,EmailThread,MessageAction,SendReceipt } from './types';

export type EmailListQuery={query?:string;label?:string;pageToken?:string;pageSize:number};
export type AttachmentAccess={url:string;expiresAt:string;contentDisposition:'attachment'|'inline'};

export interface OwnerEmailProvider{
  connection():Promise<EmailConnection>;
  listThreads(query:EmailListQuery):Promise<EmailPage>;
  readThread(threadId:string):Promise<{thread:EmailThread;messages:EmailMessage[]}>;
  saveDraft(draft:ComposeDraft,expectedRevision?:string):Promise<{id:string;revision:string}>;
  discardDraft(draftId:string,expectedRevision:string):Promise<void>;
  sendDraft(draft:ComposeDraft,idempotencyKey:string,confirmationToken:string):Promise<SendReceipt>;
  modifyThread(threadId:string,action:MessageAction,idempotencyKey:string):Promise<void>;
  attachmentAccess(messageId:string,attachmentId:string):Promise<AttachmentAccess>;
}

export class DisconnectedEmailProvider implements OwnerEmailProvider{
  async connection():Promise<EmailConnection>{return{connected:false,readEnabled:false,composeEnabled:false,modifyEnabled:false,status:'disconnected'}}
  private unavailable():never{throw new Error('Gmail is not connected to the Pxpress Owner Desk.');}
  async listThreads():Promise<EmailPage>{return{items:[]}}
  async readThread():Promise<never>{return this.unavailable()}
  async saveDraft():Promise<never>{return this.unavailable()}
  async discardDraft():Promise<never>{return this.unavailable()}
  async sendDraft():Promise<never>{return this.unavailable()}
  async modifyThread():Promise<never>{return this.unavailable()}
  async attachmentAccess():Promise<never>{return this.unavailable()}
}

export const EMAIL_FEATURE_FLAGS={
  connect:import.meta.env.VITE_OWNER_EMAIL_CONNECT_ENABLED==='true',
  read:import.meta.env.VITE_OWNER_EMAIL_READ_ENABLED==='true',
  compose:import.meta.env.VITE_OWNER_EMAIL_COMPOSE_ENABLED==='true',
  modify:import.meta.env.VITE_OWNER_EMAIL_MODIFY_ENABLED==='true',
  attachments:import.meta.env.VITE_OWNER_EMAIL_ATTACHMENTS_ENABLED==='true',
  sync:import.meta.env.VITE_OWNER_EMAIL_SYNC_ENABLED==='true',
} as const;

export function assertEmailActionsDisabledByDefault(flags:Record<string,boolean>=EMAIL_FEATURE_FLAGS){
  return Object.values(flags).every(value=>value===false);
}
