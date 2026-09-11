import {validateCheckoutReceipt,QUOTE_SCHEMA,QUOTE_PRODUCER} from '../../../supabase/functions/_shared/send-quote-public';
import type { RideRequest } from '../types';
import { quotePresentationPolicy } from './quote-presentation-policy';

export type ReleaseTarget = Readonly<{
  requestId:string; quoteId:string; requestVersion:number; customerId:string; ownerId:string;
  email:string; subtotalMinor:number; taxMinor:number; totalMinor:number;
}>;
type Scope = {requestId:string;quoteId:string;requestVersion:number;customerId:string;ownerId:string;recipientFingerprint:string};
export type ReleaseReason = 'checking'|'producer_unavailable'|'not_ready'|'invalid_response'|'outcome_unknown'|'server_failed'|'context_changed'|'review_expired';
type BaseResult = Readonly<{ target:ReleaseTarget|null; emailStatus:'not_sent'|'unknown'|'provider_accepted'|'delivered'; emailEvidence:'unconfirmed'|'provider_observed_zero'|'provider_readback' }>;
export type QuoteReleaseResult =
  | (BaseResult & Readonly<{status:'pending'|'unavailable'|'failed';reason:ReleaseReason}>)
  | (BaseResult & Readonly<{status:'delivery_unknown';reason:'outcome_unknown'}>)
  | (BaseResult & Readonly<{status:'provider_verified_link'|'email_accepted'|'delivered';expiresAt:number}>);

// Consumer provenance guard, NOT provider proof or an authorization boundary.
// Plain JSON, storage hydration, or asserted component props cannot mint a link.
const presentable = new WeakMap<object,{url:string;deadline:number;targetKey:string}>();
const record=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const exact=(r:Record<string,unknown>|null,keys:string[]):r is Record<string,unknown>=>Boolean(r&&Object.keys(r).length===keys.length&&keys.every(k=>Object.hasOwn(r,k)));
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const time=(v:unknown):number=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(v)?Date.parse(v):NaN;
const targetKey=(t:ReleaseTarget)=>JSON.stringify([t.requestId,t.quoteId,t.requestVersion,t.customerId,t.ownerId,t.email,t.subtotalMinor,t.taxMinor,t.totalMinor]);
export const unavailableRelease=(target:ReleaseTarget|null,reason:ReleaseReason='producer_unavailable'):QuoteReleaseResult=>Object.freeze({status:'unavailable',target,emailStatus:'not_sent',emailEvidence:'unconfirmed',reason});
export const pendingRelease=(target:ReleaseTarget):QuoteReleaseResult=>Object.freeze({status:'pending',target,emailStatus:'not_sent',emailEvidence:'unconfirmed',reason:'checking'});
export const failedRelease=(target:ReleaseTarget|null):QuoteReleaseResult=>Object.freeze({status:'failed',target,emailStatus:'unknown',emailEvidence:'unconfirmed',reason:'outcome_unknown'});

export function releaseTarget(request:RideRequest,ownerId:string|undefined):ReleaseTarget|null {
  const draft=request.manualQuoteDraft;
  // `paymentLinkReady` is a non-authoritative list/read cache. A saved,
  // current quote may request server evaluation when that hint is stale; the
  // authenticated `admin_send_quote` transaction is the sole payment gate.
  if(!id(ownerId)||!id(request.id)||!id(request.customerId)||!integer(request.version,1)||!draft?.isCurrent||!id(draft.quoteId)||
    (request.currency!==undefined&&request.currency!=='USD')||!['not_requested','pending'].includes(request.paymentStatus)||
    request.customerDeleted||typeof request.email!=='string'||request.email.length>254||!/^\S+@\S+\.\S+$/.test(request.email)||
    !integer(draft.serviceSubtotalMinor,1)||!integer(draft.salesTaxMinor)||!integer(draft.customerTotalMinor,1)||
    draft.serviceSubtotalMinor+draft.salesTaxMinor!==draft.customerTotalMinor)return null;
  return Object.freeze({requestId:request.id,quoteId:draft.quoteId,requestVersion:request.version,customerId:request.customerId,
    ownerId,email:request.email.trim().toLowerCase(),subtotalMinor:draft.serviceSubtotalMinor,taxMinor:draft.salesTaxMinor,totalMinor:draft.customerTotalMinor});
}

export function presentationProducerConfigured():boolean {
  return id(quotePresentationPolicy.producerId)&&quotePresentationPolicy.allowedDestinations.length>0&&quotePresentationPolicy.allowedDestinations.length<=8&&
    Number.isFinite(quotePresentationPolicy.maxVerificationAgeMs)&&quotePresentationPolicy.maxVerificationAgeMs>0&&quotePresentationPolicy.maxVerificationAgeMs<=120_000;
}
function safeDestination(raw:unknown):raw is string {
  if(typeof raw!=='string'||raw.length>2048||/[\s\\\u0000-\u001f\u007f]/.test(raw))return false;
  try{
    const url=new URL(raw);
    return url.protocol==='https:'&&!url.username&&!url.password&&!url.hash&&!url.search&&!url.port&&url.pathname!=='/'&&
      url.href===raw&&quotePresentationPolicy.allowedDestinations.some(rule=>url.origin===rule.origin&&
        /^\/[A-Za-z0-9_/-]*\/$/.test(rule.pathPrefix)&&url.pathname.startsWith(rule.pathPrefix)&&
        /^[A-Za-z0-9_-]{1,128}$/.test(url.pathname.slice(rule.pathPrefix.length)));
  }catch{return false}
}
async function sha256(text:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function canonical(value:unknown):unknown {
  if(Array.isArray(value))return value.map(canonical);
  const r=record(value);return r?Object.fromEntries(Object.keys(r).sort().map(k=>[k,canonical(r[k])])):value;
}
function freshReceipt(value:unknown,resourceId:unknown,scopeDigest:unknown,start:number,end:number,coverage:boolean):boolean {
  const r=record(value);
  const keys=['collectorId','resourceId','scopeDigest','digest','providerRevision','observedAt',...(coverage?['complete','hasMore','count','windowStart','windowEnd']:[])];
  if(!exact(r,keys)||!id(r.collectorId)||r.resourceId!==resourceId||r.scopeDigest!==scopeDigest||!hex(r.digest)||!id(r.providerRevision))return false;
  const observed=time(r.observedAt);
  if(!(observed>=start&&observed<=end))return false;
  return !coverage||(r.complete===true&&r.hasMore===false&&r.count===0&&time(r.windowStart)<=start&&
    time(r.windowStart)>=start-quotePresentationPolicy.maxVerificationAgeMs&&time(r.windowEnd)>=start&&time(r.windowEnd)<=observed);
}

/** ONLY called with data returned by the existing authenticated repository transport.
 * TLS/authentication, ownership and independent provider collection remain server duties.
 * These checks detect mismatches; they cannot turn an untrusted assertion into proof.
 */
export async function decodeReleaseResponse(value:unknown,target:ReleaseTarget,now=Date.now()):Promise<QuoteReleaseResult> {
  const reject=()=>unavailableRelease(target,'invalid_response');
  try{
    if(!presentationProducerConfigured())return unavailableRelease(target);
    // Bound parser work before expensive hashing. No truncation or repair.
    const serialized=JSON.stringify(value);
    if(!serialized||serialized.length>16_384)return reject();
    const r=record(value),scope=record(r?.scope);
    if(r?.schemaVersion===QUOTE_SCHEMA&&r.producerId===QUOTE_PRODUCER&&quotePresentationPolicy.producerId===QUOTE_PRODUCER){
      const expected={requestId:target.requestId,quoteId:target.quoteId,requestVersion:target.requestVersion,customerId:target.customerId,ownerId:target.ownerId,recipientFingerprint:await sha256(target.email)};
      const proof=await validateCheckoutReceipt(r,expected,target,quotePresentationPolicy.allowedDestinations.map(x=>new URL(x.origin).hostname),now);
      if(!safeDestination(proof.verification.link.url))return reject();
      const expiry=Date.parse(proof.verification.expiresAt);
      const result=Object.freeze({status:'provider_verified_link' as const,target,emailStatus:'not_sent' as const,emailEvidence:'unconfirmed' as const,expiresAt:expiry});
      presentable.set(result,{url:proof.verification.link.url,deadline:expiry,targetKey:targetKey(target)});
      return result;
    }
    const common=['schemaVersion','producerId','status','scope','emailStatus'];
    if(!r||r.schemaVersion!=='pxpress-owner-quote-release-v1'||r.producerId!==quotePresentationPolicy.producerId||
      !exact(scope,['requestId','quoteId','requestVersion','customerId','ownerId','recipientFingerprint'])||
      scope.requestId!==target.requestId||scope.quoteId!==target.quoteId||scope.requestVersion!==target.requestVersion||
      scope.customerId!==target.customerId||scope.ownerId!==target.ownerId||
      scope.recipientFingerprint!==await sha256(target.email))return reject();
    if(r.status==='email_accepted'||r.status==='delivered'){
      const event=r.status==='email_accepted'?'accepted':'delivered';
      if(!exact(r,[...common,'emailProof'])||r.emailStatus!==(event==='accepted'?'provider_accepted':'delivered'))return reject();
      const p=record(r.emailProof);
      if(!exact(p,['evidenceClass','authorizationId','effectId','messageId','event','eventAt','observedAt','expiresAt','scopeDigest','readback'])||
        p.evidenceClass!=='provider_observed_email_v1'||p.event!==event||!id(p.authorizationId)||!id(p.effectId)||!id(p.messageId)||!hex(p.scopeDigest))return reject();
      const observed=time(p.observedAt),expiry=time(p.expiresAt),eventAt=time(p.eventAt);
      if(!(Number.isFinite(now)&&eventAt<=observed&&observed<=now&&now<expiry&&now-observed<=quotePresentationPolicy.maxVerificationAgeMs&&expiry-observed<=quotePresentationPolicy.maxVerificationAgeMs))return reject();
      const digest=await sha256(JSON.stringify(canonical({scope,authorizationId:p.authorizationId,effectId:p.effectId,messageId:p.messageId,event:p.event,eventAt:p.eventAt})));
      if(digest!==p.scopeDigest||!freshReceipt(p.readback,p.messageId,digest,observed,now,false)||Date.now()>=expiry)return reject();
      return Object.freeze({status:r.status,target,emailStatus:event==='accepted'?'provider_accepted':'delivered',emailEvidence:'provider_readback',expiresAt:expiry});
    }
    if(r.status==='delivery_unknown'){
      if(!exact(r,[...common,'reason'])||r.emailStatus!=='unknown'||r.reason!=='outcome_unknown')return reject();
      return Object.freeze({status:'delivery_unknown',target,emailStatus:'unknown',emailEvidence:'unconfirmed',reason:'outcome_unknown'});
    }
    if(r.status==='pending'||r.status==='unavailable'||r.status==='failed'){
      if(!exact(r,[...common,'reason'])||r.emailStatus!==(r.status==='failed'?'unknown':'not_sent'))return reject();
      const reasons:ReleaseReason[]=r.status==='pending'?['checking']:r.status==='unavailable'?['producer_unavailable','not_ready','context_changed','review_expired']:['server_failed','outcome_unknown'];
      if(!reasons.includes(r.reason as ReleaseReason))return reject();
      const reason=r.reason as ReleaseReason;
      return Object.freeze({status:r.status,target,emailStatus:r.status==='failed'?'unknown':'not_sent',emailEvidence:'unconfirmed',reason});
    }
    if(r.status!=='provider_verified_link'||r.emailStatus!=='not_sent'||!exact(r,[...common,'verification']))return reject();
    const v=record(r.verification),binding=record(v?.binding),order=record(v?.order),link=record(v?.link),reads=record(v?.readbacks);
    if(!exact(v,['evidenceClass','binding','order','link','readbacks','scopeDigest','observedAt','expiresAt','chargeCount','emailSendCount'])||
      v.evidenceClass!=='provider_verified_usable_link_v1'||
      !exact(binding,['contactId','siteId','appId','instanceId','sourceRevision','credentialRevision','deploymentId','authorizationId','effectId','attempt','generation'])||
      !Object.entries(binding).every(([k,x])=>k==='attempt'||k==='generation'?integer(x,1):id(x))||
      !exact(order,['id','currency','subtotalMinor','taxMinor','totalMinor','paymentStatus','fulfillmentStatus'])||
      !id(order.id)||order.currency!=='USD'||order.subtotalMinor!==target.subtotalMinor||order.taxMinor!==target.taxMinor||
      order.totalMinor!==target.totalMinor||order.paymentStatus!=='unpaid'||order.fulfillmentStatus!=='unfulfilled'||
      !exact(link,['id','url','urlDigest','status','usageLimit','uses','expiresAt'])||!id(link.id)||!safeDestination(link.url)||!hex(link.urlDigest)||
      link.status!=='active'||link.usageLimit!==1||link.uses!==0||v.chargeCount!==0||v.emailSendCount!==0||
      !exact(reads,['order','link','payments','notifications'])||!hex(v.scopeDigest))return reject();
    const observed=time(v.observedAt),expiry=time(v.expiresAt),linkExpiry=time(link.expiresAt);
    if(!Number.isFinite(now)||!(observed<=now&&now-observed<=quotePresentationPolicy.maxVerificationAgeMs&&now<expiry&&
      expiry-observed<=quotePresentationPolicy.maxVerificationAgeMs&&expiry<=linkExpiry))return reject();
    // Binds every receipt to the full exact target, approved attempt/runtime and amounts.
    const digest=await sha256(JSON.stringify(canonical({scope:scope as Scope,binding,order,linkId:link.id})));
    if(digest!==v.scopeDigest||await sha256(link.url)!==link.urlDigest||
      !freshReceipt(reads.order,order.id,digest,observed,now,false)||!freshReceipt(reads.link,link.id,digest,observed,now,false)||
      !freshReceipt(reads.payments,order.id,digest,observed,now,true)||!freshReceipt(reads.notifications,link.id,digest,observed,now,true))return reject();
    // Recheck trusted runtime clock after asynchronous digest work.
    if(Date.now()>=expiry)return reject();
    const result=Object.freeze({status:'provider_verified_link' as const,target,emailStatus:'not_sent' as const,emailEvidence:'provider_observed_zero' as const,expiresAt:expiry});
    presentable.set(result,{url:link.url,deadline:expiry,targetKey:targetKey(target)});
    return result;
  }catch{return reject()}
}

export function readPresentableLink(result:QuoteReleaseResult,current:ReleaseTarget|null,now=Date.now()):string|null {
  const entry=presentable.get(result);
  if(!entry||!current||result.status!=='provider_verified_link'||targetKey(current)!==entry.targetKey||!Number.isFinite(now)||now>=entry.deadline||!safeDestination(entry.url))return null;
  return entry.url;
}
export function sameReleaseTarget(a:ReleaseTarget|null,b:ReleaseTarget|null):boolean {return Boolean(a&&b&&targetKey(a)===targetKey(b))}

export function canReviewExpiredQuote(result:QuoteReleaseResult|null,request:RideRequest,ownerId:string|undefined):boolean {
  return request.status==='deposit_pending'&&request.manualQuoteDraft?.status==='approved'&&
    result?.status==='unavailable'&&result.reason==='review_expired'&&sameReleaseTarget(result.target,releaseTarget(request,ownerId));
}
