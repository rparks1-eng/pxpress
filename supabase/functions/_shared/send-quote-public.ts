// Pure public receipt validation shared by server and Owner Desk. No credentials,
// database client, provider transport, or authority-granting code belongs here.
export const QUOTE_SCHEMA='pxpress-owner-quote-release-v2';
export const QUOTE_PRODUCER='pxpress-send-quote-v2';
export type QuoteScope={requestId:string;quoteId:string;requestVersion:number;customerId:string;ownerId:string;recipientFingerprint:string};
export type QuoteAmounts={subtotalMinor:number;taxMinor:number;totalMinor:number};
export type CheckoutReceipt={schemaVersion:typeof QUOTE_SCHEMA;producerId:typeof QUOTE_PRODUCER;status:'provider_verified_link';scope:QuoteScope;emailStatus:'not_sent';verification:{
 evidenceClass:'provider_verified_checkout_link_v2';binding:{jobId:string;generation:number;contactId:string;purchaseFlowId:string;appId:string;siteId:string;instanceId:string};
 order:{id:string;currency:'USD';subtotalMinor:number;taxMinor:number;totalMinor:number;paymentStatus:'unpaid'};
 link:{id:string;url:string;urlDigest:string;status:'active';usageLimit:1;uses:number|null;receivedMinor:number|null;expiresAt:string};
 readbacks:{contact:{id:string;digest:string};order:{id:string;digest:string};link:{id:string;digest:string}};
 workflow:{chargeRequested:false;wixEmailRequested:false};scopeDigest:string;observedAt:string;expiresAt:string;
}};
type Obj=Record<string,unknown>;
export const canonicalQuoteJson=(v:unknown):string=>JSON.stringify(sort(v));
const sort=(v:unknown):unknown=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort((v as Obj)[k])])):v;
export async function quoteHash(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('')}
export const quoteDigest=(v:unknown)=>quoteHash(canonicalQuoteJson(v));
const object=(v:unknown):Obj=>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('SEND_QUOTE_PROOF_INVALID');return v as Obj};
const exact=(v:unknown,keys:string[])=>{const o=object(v);if(Object.keys(o).length!==keys.length||!keys.every(k=>Object.hasOwn(o,k)))throw Error('SEND_QUOTE_PROOF_INVALID');return o};
const hex=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const time=(v:unknown)=>typeof v==='string'?Date.parse(v):NaN;
const deny=()=>{throw Error('SEND_QUOTE_PROOF_INVALID')};
export function checkoutUrl(raw:unknown,hosts:readonly string[]):string{
 if(typeof raw!=='string'||raw.length>2048||/[\\\s\u0000-\u001f\u007f]/.test(raw))return deny();
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.href!==raw||
  !hosts.includes(u.hostname)||!/^\/(?:[A-Za-z0-9_-]+\/)*_paylink\/[A-Za-z0-9_-]{1,128}$/.test(u.pathname))return deny();
 return raw;
}
export async function validateCheckoutReceipt(value:unknown,scope:QuoteScope,amounts:QuoteAmounts,hosts:readonly string[],now=Date.now()):Promise<CheckoutReceipt>{
 if(JSON.stringify(value).length>16384)deny();
 const p=exact(value,['schemaVersion','producerId','status','scope','emailStatus','verification']);
 if(p.schemaVersion!==QUOTE_SCHEMA||p.producerId!==QUOTE_PRODUCER||p.status!=='provider_verified_link'||p.emailStatus!=='not_sent'||canonicalQuoteJson(p.scope)!==canonicalQuoteJson(scope))deny();
 exact(p.scope,['requestId','quoteId','requestVersion','customerId','ownerId','recipientFingerprint']);
 const v=exact(p.verification,['evidenceClass','binding','order','link','readbacks','workflow','scopeDigest','observedAt','expiresAt']);
 const b=exact(v.binding,['jobId','generation','contactId','purchaseFlowId','appId','siteId','instanceId']);
 const o=exact(v.order,['id','currency','subtotalMinor','taxMinor','totalMinor','paymentStatus']);
 const l=exact(v.link,['id','url','urlDigest','status','usageLimit','uses','receivedMinor','expiresAt']);
 const reads=exact(v.readbacks,['contact','order','link']),workflow=exact(v.workflow,['chargeRequested','wixEmailRequested']);
 if(v.evidenceClass!=='provider_verified_checkout_link_v2'||workflow.chargeRequested!==false||workflow.wixEmailRequested!==false||
  !Object.entries(b).every(([k,x])=>k==='generation'?Number.isSafeInteger(x)&&Number(x)>0:uuid(x))||
  !uuid(o.id)||o.currency!=='USD'||o.subtotalMinor!==amounts.subtotalMinor||o.taxMinor!==amounts.taxMinor||o.totalMinor!==amounts.totalMinor||o.paymentStatus!=='unpaid'||
  !uuid(l.id)||l.status!=='active'||l.usageLimit!==1||![0,null].includes(l.uses as number|null)||![0,null].includes(l.receivedMinor as number|null)||!hex(l.urlDigest))deny();
 checkoutUrl(l.url,hosts);
 const observed=time(v.observedAt),expiry=time(v.expiresAt);
 if(!(observed<=now&&now-observed<=120000&&now<expiry&&expiry-observed<=120000&&expiry<=time(l.expiresAt)))deny();
 for(const [name,id] of [['contact',b.contactId],['order',o.id],['link',l.id]]){
  const read=exact(reads[String(name)],['id','digest']);if(read.id!==id||!hex(read.digest))deny();
 }
 if(await quoteHash(String(l.url))!==l.urlDigest||await quoteDigest({scope:p.scope,binding:b,order:o,link:l,readbacks:reads,workflow})!==v.scopeDigest||Date.now()>=expiry)deny();
 return value as CheckoutReceipt;
}
