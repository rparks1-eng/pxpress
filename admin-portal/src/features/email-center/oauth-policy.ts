export const GMAIL_SCOPES={
  read:'https://www.googleapis.com/auth/gmail.readonly',
  compose:'https://www.googleapis.com/auth/gmail.compose',
  modify:'https://www.googleapis.com/auth/gmail.modify',
} as const;
export type EmailCapability='read'|'compose'|'modify';
export const GMAIL_SYNC_LIMITS={pageSize:30,maxPages:10,maxThreadsPerRun:300,maxRetries:3,requestTimeoutMs:10_000,pollMinutes:15,watchRenewalHoursBeforeExpiry:24} as const;

export function scopesFor(capabilities:EmailCapability[]){
  const set=new Set(capabilities);
  // gmail.modify already authorizes reading, composing, sending, and label
  // changes. Do not add redundant restricted scopes to the consent request.
  if(set.has('modify'))return[GMAIL_SCOPES.modify];
  return [...set].map(capability=>GMAIL_SCOPES[capability]);
}
export function validOauthState(value:string){return /^[A-Za-z0-9_-]{32,180}$/.test(value)}
export function validPkceVerifier(value:string){return /^[A-Za-z0-9._~-]{43,128}$/.test(value)}
export function assertRedirectAllowed(raw:string,allowedOrigins:string[]){
  const url=new URL(raw);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('gmail-redirect-https-required');
  if(!allowedOrigins.includes(url.origin))throw new Error('gmail-redirect-origin-not-allowed');
  if(url.pathname!=='/api/email/google/callback')throw new Error('gmail-redirect-path-not-allowed');
  return url.toString();
}
export function gmailRetryDelay(attempt:number,retryAfterSeconds?:number){
  if(!Number.isInteger(attempt)||attempt<0||attempt>=GMAIL_SYNC_LIMITS.maxRetries)throw new Error('gmail-retry-limit');
  const boundedRetryAfter=Math.min(Math.max(retryAfterSeconds||0,0),60);
  return Math.max(boundedRetryAfter*1000,Math.min(1000*2**attempt,30_000));
}
export function planHistoryRecovery(input:{savedHistoryId?:string;providerHistoryId?:string;watchExpiresAt?:string;now?:Date}){
  const now=input.now||new Date(),expires=input.watchExpiresAt?Date.parse(input.watchExpiresAt):0;
  if(!input.savedHistoryId)return{mode:'bounded_full_sync' as const,reason:'no_cursor'};
  if(!input.providerHistoryId)return{mode:'bounded_full_sync' as const,reason:'history_gap'};
  if(expires<=now.getTime())return{mode:'bounded_history_sync' as const,reason:'watch_expired'};
  return{mode:'bounded_history_sync' as const,reason:'cursor_current'};
}
export function lockScreenEmailNotification(input:{threadId:string;senderName?:string}){
  return{title:'New Pxpress email',body:'Open the Owner Desk to read it.',route:`/email?thread=${encodeURIComponent(input.threadId)}`};
}
