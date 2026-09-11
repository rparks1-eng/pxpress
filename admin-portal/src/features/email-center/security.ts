import type { EmailAddress,EmailAttachment,SendReceipt } from './types';

const allowedTags=new Set(['P','BR','STRONG','B','EM','I','U','S','A','UL','OL','LI','BLOCKQUOTE','PRE','CODE','DIV','SPAN','TABLE','THEAD','TBODY','TFOOT','TR','TH','TD','IMG','H1','H2','H3','H4','H5','H6','HR','CENTER','SECTION','ARTICLE','HEADER','FOOTER','MAIN','SMALL','SUP','SUB']);
const droppedTags=new Set(['SCRIPT','STYLE','IFRAME','FORM','INPUT','BUTTON','OBJECT','EMBED','SVG','MATH','LINK','META']);
const dangerousExtensions=new Set(['exe','com','bat','cmd','msi','scr','js','jse','vbs','vbe','ps1','sh','app','dmg','pkg','jar','iso','lnk','html','htm','xhtml','svg','xml','mhtml','mht']);
const dangerousMimePrefixes=['application/x-msdownload','application/x-sh','application/x-bat','application/java-archive','text/html','image/svg+xml','application/xhtml+xml','application/xml','text/xml','multipart/related'];
export const MAX_ATTACHMENT_BYTES=20*1024*1024;
export const MAX_COMPOSE_RECIPIENTS=25;

export type SafeEmailLink={href:string;domain:string;external:boolean};
export type SafeEmailBody={html:string;documentHtml:string;plainText:string;blockedRemoteImages:number;inlineImages:number;links:SafeEmailLink[]};

const presentationAttributes=new Set(['align','valign','width','height','bgcolor','cellpadding','cellspacing','border','colspan','rowspan','role','aria-label','title']);
const transparentPixel='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function sanitizeCss(value:string){
  return value
    .replace(/\/\*[\s\S]*?\*\//g,'')
    .replace(/@import[\s\S]*?(?:;|$)/gi,'')
    .replace(/@font-face\s*\{[\s\S]*?\}/gi,'')
    .replace(/url\s*\([^)]*\)/gi,'none')
    .replace(/(?:expression|behavior|-moz-binding)\s*:[^;}]+[;}]/gi,'')
    .replace(/(?:https?:|data:|\/\/)[^\s;'"})]+/gi,'')
    .replace(/:visited/gi,':link')
    .replace(/<\/?style/gi,'');
}

function sanitizeClass(value:string){return value.split(/\s+/).filter(token=>/^[A-Za-z_-][A-Za-z0-9_-]{0,63}$/.test(token)).slice(0,24).join(' ')}
function sanitizeDimension(value:string){return /^\d{1,4}(?:\.\d+)?(?:px|%|em|rem)?$/i.test(value.trim())?value.trim():''}
function safeInlineImageUrl(value:string){return /^blob:https?:\/\//i.test(value)||(/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(value)&&value.length<=2_800_000)}
function documentShell(body:string,styles:string,loadRemoteImages:boolean){
  const imagePolicy=loadRemoteImages?'https: data: blob:':'data: blob:';
  const csp=`default-src 'none'; img-src ${imagePolicy}; style-src 'unsafe-inline'; font-src 'none'; media-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>${styles}\nhtml,body{margin:0!important;max-width:100%!important;min-width:0!important}body{overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}a{cursor:default}</style></head><body>${body}</body></html>`;
}

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))}
export function normalizeEmail(value:string){return value.trim().toLowerCase()}
export function isValidEmail(value:string){return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalizeEmail(value))&&value.length<=254}
export function parseRecipients(value:string):EmailAddress[]{
  if(!value.trim())return[];
  const items=value.split(/[;,]/).map(item=>item.trim()).filter(Boolean);
  if(items.length>MAX_COMPOSE_RECIPIENTS)throw new Error(`Use no more than ${MAX_COMPOSE_RECIPIENTS} recipients.`);
  const addresses=items.map(item=>{
    const match=item.match(/^\s*(?:"?([^"<]+)"?\s*)?<([^<>]+)>\s*$/);
    const email=normalizeEmail(match?.[2]||item),name=match?.[1]?.trim();
    if(!isValidEmail(email))throw new Error(`Check this email address: ${item}`);
    return name?{name,email}:{email};
  });
  const unique=new Map<string,EmailAddress>();for(const address of addresses)if(!unique.has(address.email))unique.set(address.email,address);return [...unique.values()];
}
export function formatRecipients(items:EmailAddress[]){return items.map(item=>item.name?`${item.name} <${item.email}>`:item.email).join(', ')}
export function safeLinkDetails(raw:string,baseDomain='pxpressllc.com'){
  try{
    const url=new URL(raw);
    if(url.protocol!=='https:'&&url.protocol!=='mailto:')return{safe:false,external:false,suspicious:true,domain:'Blocked'};
    if(url.username||url.password)return{safe:false,external:true,suspicious:true,domain:url.hostname||'Unknown'};
    const domain=url.hostname.toLowerCase();
    const external=Boolean(domain&&domain!==baseDomain&&!domain.endsWith(`.${baseDomain}`));
    const suspicious=/xn--|\d{1,3}(?:\.\d{1,3}){3}/i.test(domain)||url.href.length>2048;
    return{safe:!suspicious,external,suspicious,domain:domain||'Email link'};
  }catch{return{safe:false,external:false,suspicious:true,domain:'Blocked'}}
}
export function attachmentPolicy(attachment:EmailAttachment){
  const extension=attachment.name.includes('.')?attachment.name.split('.').pop()!.toLowerCase():'';
  if(attachment.size<0||attachment.size>MAX_ATTACHMENT_BYTES)return{allowed:false,reason:'Attachment is larger than the 20 MB safety limit.'};
  if(dangerousExtensions.has(extension)||dangerousMimePrefixes.some(prefix=>attachment.mimeType.toLowerCase().startsWith(prefix)))return{allowed:false,reason:'This file type is blocked for safety.'};
  return{allowed:true,reason:''};
}
export function validateAttachmentAccess(url:string,expiresAt:string,now=new Date(),allowedOrigins:string[]=[globalThis.location?.origin].filter(Boolean) as string[]){
  const parsed=new URL(url),expiry=Date.parse(expiresAt),remaining=expiry-now.getTime();
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error('Attachment access URL is not safe.');
  if(!allowedOrigins.includes(parsed.origin)||!parsed.pathname.startsWith('/api/email/attachments/'))throw new Error('Attachment access must use the authenticated Pxpress proxy.');
  if(!Number.isFinite(expiry)||remaining<=0||remaining>5*60_000)throw new Error('Attachment access must expire within five minutes.');
  return parsed.toString();
}
export function validateSendReceipt(receipt:SendReceipt,expectedIdempotencyKey:string,now=new Date()){
  const verified=Date.parse(receipt?.verifiedAt),age=now.getTime()-verified;
  if(receipt?.idempotencyKey!==expectedIdempotencyKey)throw new Error('Send verification did not match this message.');
  if(!receipt?.providerMessageId?.trim()||!receipt?.providerThreadId?.trim())throw new Error('The email provider did not return a complete send receipt.');
  if(!Number.isFinite(verified)||age>10*60_000||age< -2*60_000)throw new Error('The email provider did not return a current send verification.');
  return receipt;
}
export function sanitizeEmailHtml(source:string,plainText:string,cidUrls:Record<string,string>={},loadRemoteImages=false):SafeEmailBody{
  const fallback=`<pre>${escapeHtml(plainText)}</pre>`;
  if(typeof DOMParser==='undefined')return{html:fallback,documentHtml:documentShell(fallback,'',false),plainText,blockedRemoteImages:0,inlineImages:0,links:[]};
  const document=new DOMParser().parseFromString(source||fallback,'text/html');
  const styles=[...document.querySelectorAll('style')].map(node=>sanitizeCss(node.textContent||'')).join('\n');
  let blockedRemoteImages=0,inlineImages=0;const links:SafeEmailLink[]=[];
  const visit=(element:Element)=>{
    for(const child of [...element.children]){
      if(droppedTags.has(child.tagName)){child.remove();continue}
      if(!allowedTags.has(child.tagName)){visit(child);child.replaceWith(...[...child.childNodes]);continue}
      const originalHref=child.tagName==='A'?(child as HTMLAnchorElement).getAttribute('href')||'':'';
      const originalSrc=child.tagName==='IMG'?(child as HTMLImageElement).getAttribute('src')||'':'';
      const originalAlt=child.tagName==='IMG'?(child as HTMLImageElement).getAttribute('alt')||'':'';
      for(const attr of [...child.attributes]){
        const name=attr.name.toLowerCase(),value=attr.value;
        child.removeAttribute(attr.name);
        if(name==='style'){const safeStyle=sanitizeCss(value);if(safeStyle)child.setAttribute('style',safeStyle)}
        else if(name==='class'){const safeClass=sanitizeClass(value);if(safeClass)child.setAttribute('class',safeClass)}
        else if(name==='id'&&/^[A-Za-z_-][A-Za-z0-9_-]{0,63}$/.test(value))child.setAttribute('id',value)
        else if(presentationAttributes.has(name)){
          const safeValue=name==='width'||name==='height'?sanitizeDimension(value):value.replace(/[<>"']/g,'').slice(0,160);
          if(safeValue)child.setAttribute(name,safeValue);
        }
      }
      if(child.tagName==='A'){
        const detail=safeLinkDetails(originalHref);
        if(detail.safe){child.setAttribute('data-destination-domain',detail.domain);child.setAttribute('aria-label',`${child.textContent?.trim()||'Link'} (${detail.domain})`);links.push({href:originalHref,domain:detail.domain,external:detail.external});if(detail.external)child.setAttribute('data-external','true')}
      }
      if(child.tagName==='IMG'){
        const original=originalSrc,cid=original.toLowerCase().startsWith('cid:')?original.slice(4):'';
        if(cid&&cidUrls[cid]&&safeInlineImageUrl(cidUrls[cid])){child.setAttribute('src',cidUrls[cid]);child.setAttribute('alt',originalAlt||'Inline email image');child.setAttribute('loading','lazy');inlineImages++}
        else if(safeInlineImageUrl(original)){child.setAttribute('src',original);child.setAttribute('alt',originalAlt||'Email image')}
        else if(/^https:/i.test(original)&&loadRemoteImages){child.setAttribute('src',original);child.setAttribute('alt',originalAlt||'Remote email image');child.setAttribute('loading','lazy');child.setAttribute('referrerpolicy','no-referrer')}
        else{if(/^https?:/i.test(original))blockedRemoteImages++;child.setAttribute('src',transparentPixel);child.setAttribute('alt',originalAlt||'Remote image blocked');child.setAttribute('data-email-image-blocked','true')}
      }
      visit(child);
    }
  };
  visit(document.body);
  const html=document.body.innerHTML||fallback;
  const uniqueLinks=[...new Map(links.map(link=>[link.href,link])).values()];
  return{html,documentHtml:documentShell(html,styles,loadRemoteImages),plainText,blockedRemoteImages,inlineImages,links:uniqueLinks};
}
export function safeOwnerMatch(ownerEmail:string,allowedEmails:string[]){return allowedEmails.map(normalizeEmail).includes(normalizeEmail(ownerEmail))}
export function redactEmailLog(value:string){return value.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]').replace(/(?:Bearer\s+)?[A-Za-z0-9_-]{24,}/g,'[redacted]')}
