export type EmailAddress={name?:string;email:string};
export type EmailLabel='inbox'|'sent'|'draft'|'starred'|'archive'|'important'|'trash'|'spam'|string;
export type EmailAttachment={id:string;name:string;mimeType:string;size:number;inlineCid?:string};
export type EmailMessage={
  id:string;threadId:string;providerMessageId:string;rfcMessageId:string;
  inReplyTo?:string;references:string[];from:EmailAddress;to:EmailAddress[];cc:EmailAddress[];
  subject:string;sentAt:string;direction:'received'|'sent';plainText:string;html?:string;
  unread:boolean;attachments:EmailAttachment[];
};
export type EmailThread={
  id:string;providerThreadId:string;historyId:string;subject:string;participants:EmailAddress[];
  snippet:string;lastMessageAt:string;unread:boolean;starred:boolean;labels:EmailLabel[];
  messageCount:number;matchedCustomerId?:string;matchedRequestIds:string[];
};
export type EmailPage={items:EmailThread[];nextPageToken?:string};
export type EmailConnection={
  connected:boolean;accountEmail?:string;readEnabled:boolean;composeEnabled:boolean;modifyEnabled:boolean;
  lastSyncedAt?:string;status:'disconnected'|'active'|'paused'|'error';safeError?:string;
};
export type ComposeDraft={
  id?:string;threadId?:string;to:EmailAddress[];cc:EmailAddress[];bcc:EmailAddress[];
  subject:string;plainText:string;inReplyTo?:string;references:string[];attachments:EmailAttachment[];
};
export type SendReceipt={idempotencyKey:string;providerMessageId:string;providerThreadId:string;verifiedAt:string};
export type MessageAction='mark_read'|'mark_unread'|'star'|'unstar'|'archive'|'restore'|'trash'|'untrash';
