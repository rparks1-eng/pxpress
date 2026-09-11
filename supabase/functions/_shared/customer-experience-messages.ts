import {rideServiceLabel} from './ride-service-label.ts';
import {withAdaptiveEmailAppearance} from './email-appearance.ts';

export type ExperienceMessageKind =
  | 'customer_request_receipt' | 'owner_request_alert' | 'customer_quote_invitation'
  | 'customer_paid_receipt' | 'owner_payment_alert' | 'customer_post_ride_day'
  | 'customer_post_ride_night' | 'customer_feedback_receipt'
  | 'customer_ride_day_reminder' | 'customer_ride_hour_reminder';

export type ExperienceMessageInput = {
  kind:ExperienceMessageKind;recipient:string;firstName:string;requestReference:string;
  service:string;pickup:string;subtotal:string;taxLabel:string;tax:string;total:string;
  actionUrl?:string;imageUrl?:string;sinkOnly?:boolean;allowedPaymentHosts?:readonly string[];
};
export type RenderedExperienceMessage={templateKey:string;subject:string;recipient:string;text:string;html:string};
const HOME='https://pxpressllc.com/';
const SERVICES='https://pxpressllc.com/services';
const LOGO='https://pxpressllc.com/admin/assets/pxpress-header-logo-transparent-v2-DbKum852.png';
// Customer-facing email actions must never escape to the staging hostname.
// Wix-hosted payment URLs are admitted separately and only for quote emails.
const SITE_HOSTS=new Set(['pxpressllc.com']);
const escape=(value:string)=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const safeActionUrl=(value:string|undefined,input:ExperienceMessageInput)=>{
  if(!value)return '';
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password)throw new Error('UNSAFE_MESSAGE_URL');
  const host=url.hostname.toLowerCase();
  if(input.sinkOnly&&host==='example.invalid')return url.toString();
  const allowed=new Set(SITE_HOSTS);
  if(input.kind==='customer_quote_invitation')for(const candidate of input.allowedPaymentHosts||[]){const exact=candidate.trim().toLowerCase();if(exact&&!exact.includes('/')&&!exact.includes(':')&&!exact.includes('*'))allowed.add(exact)}
  if(!allowed.has(host))throw new Error('UNSAFE_MESSAGE_URL');
  return url.toString();
};
const safeImageUrl=(value:string|undefined)=>{
  if(!value)return '';
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||!new Set([...SITE_HOSTS,'static.wixstatic.com']).has(url.hostname.toLowerCase()))throw new Error('UNSAFE_MESSAGE_IMAGE_URL');
  return url.toString();
};

const copy:Record<ExperienceMessageKind,{subject:string;eyebrow:string;title:string;intro:(input:ExperienceMessageInput)=>string;notice:string;action:string;money:boolean;image:boolean}>={
  customer_ride_day_reminder:{subject:'Your Pxpress ride is in 24 hours',eyebrow:'Upcoming ride · Confirmed',title:'We look forward to seeing you.',intro:i=>`Hi ${i.firstName}, this is a reminder that your confirmed ride is scheduled in approximately 24 hours. Your pickup details are below.`,notice:'Need to update your plans? Reply to this email or call/text (234) 200-6969. We will confirm any change with you.',action:'',money:false,image:false},
  customer_ride_hour_reminder:{subject:'Your Pxpress ride is in one hour',eyebrow:'Upcoming ride · Confirmed',title:'Your pickup is coming up.',intro:i=>`Hi ${i.firstName}, your confirmed ride is scheduled in approximately one hour. Your pickup details are below.`,notice:'Need to update your plans? Reply to this email or call/text (234) 200-6969. We will confirm any change with you.',action:'',money:false,image:false},
  customer_request_receipt:{subject:'We received your Pxpress ride request',eyebrow:'Request received · Pending review',title:'We received your request.',intro:i=>`Hi ${i.firstName}, we’ll review the route, timing, and availability before sending a decision and final price.`,notice:'This is a receipt only. Your ride is not approved or confirmed, and no payment is due.',action:'',money:false,image:false},
  owner_request_alert:{subject:'New Pxpress ride request',eyebrow:'Owner Desk · Review needed',title:'A new request is ready.',intro:i=>`${i.requestReference} is waiting for route, mileage, schedule, tax, and price review.`,notice:'Opening this notice does not approve the ride or contact the customer.',action:'Review, route & price',money:false,image:false},
  customer_quote_invitation:{subject:'Your Pxpress quote and secure payment link',eyebrow:'Request approved · Payment required',title:'Your ride is approved.',intro:i=>`Hi ${i.firstName}, review the final price and pay on the secure Wix-hosted page to confirm your ride.`,notice:'Approval is not a paid receipt. The ride is confirmed only after Pxpress verifies payment.',action:'Pay securely',money:true,image:false},
  customer_paid_receipt:{subject:'Pxpress payment received and ride confirmed',eyebrow:'Payment received · Ride confirmed',title:'Your ride is confirmed.',intro:i=>`Hi ${i.firstName}, we verified your payment and confirmed your ride.`,notice:'Keep this receipt with your request number. Contact Pxpress promptly if anything is incorrect.',action:'',money:true,image:false},
  owner_payment_alert:{subject:'Pxpress payment verified',eyebrow:'Owner Desk · Payment verified',title:'Payment received.',intro:i=>`${i.requestReference} is paid and ready for final schedule review.`,notice:'Verify the calendar and itinerary before service.',action:'Open request',money:true,image:false},
  customer_post_ride_day:{subject:'Thank you for riding with Pxpress',eyebrow:'With appreciation',title:'Thank you for choosing Pxpress.',intro:i=>`Hi ${i.firstName}, it was a pleasure serving you today. Take a moment to reflect on your experience. We would love to hear your thoughts.`,notice:'Your star rating contributes only to anonymous totals. Your written comment stays private unless you explicitly allow Pxpress to consider it for public display.',action:'Share your experience',money:false,image:true},
  customer_post_ride_night:{subject:'Thank you for riding with Pxpress',eyebrow:'With appreciation',title:'Thank you for choosing Pxpress.',intro:i=>`Hi ${i.firstName}, it was a pleasure serving you this evening. Take a moment to reflect on your experience. We would love to hear your thoughts.`,notice:'Your star rating contributes only to anonymous totals. Your written comment stays private unless you explicitly allow Pxpress to consider it for public display.',action:'Share your experience',money:false,image:true},
  customer_feedback_receipt:{subject:'Thank you for your Pxpress feedback',eyebrow:'Feedback received',title:'Thank you for your comment.',intro:i=>`Hi ${i.firstName}, your feedback was saved and will help us improve the Pxpress experience.`,notice:'Public-consent comments still require owner review before they can appear on the website.',action:'Reserve a Ride',money:false,image:false},
};

export function renderExperienceMessage(input:ExperienceMessageInput):RenderedExperienceMessage{
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipient))throw new Error('INVALID_RECIPIENT');
  input={...input,firstName:input.firstName.trim().split(/\s+/)[0]||'there'};
  const message=copy[input.kind];
  const actionUrl=message.action?safeActionUrl(input.actionUrl||(input.kind==='customer_feedback_receipt'?SERVICES:''),input):'';
  if(message.image&&!actionUrl)throw new Error('FEEDBACK_ACTION_URL_REQUIRED');
  const details=[['Request',input.requestReference],['Service',rideServiceLabel(input.service)],['Pickup',input.pickup],...(message.money?[['Service subtotal',input.subtotal],[input.taxLabel,input.tax],['Total',input.total]]:[])];
  const rows=(message.image?details.slice(0,1):details).map(([label,value])=>`<tr><th scope="row">${escape(label)}</th><td>${escape(value)}</td></tr>`).join('');
  const image=message.image&&input.imageUrl?`<div class="hero" style="margin:-40px -36px 30px"><img src="${escape(safeImageUrl(input.imageUrl))}" width="640" alt="Pxpress vehicle with the Cleveland skyline" style="display:block;width:100%;max-width:640px;height:auto;border:0"></div>`:'';
  const appreciation=message.image?`<p style="margin:30px 8px 26px;color:#d9bd80;font:italic 500 36px/1.12 Georgia,'Times New Roman',serif;letter-spacing:.2px;text-align:center">Your business is sincerely appreciated.</p>`:'';
  const primaryAction=actionUrl?`<a href="${escape(actionUrl)}" style="display:inline-block;margin:6px 4px;min-height:44px;box-sizing:border-box;line-height:16px;padding:14px 21px;border-radius:999px;background:#d9bd80;color:#090908;font:700 13px Arial,sans-serif;text-decoration:none">${escape(message.action)}</a>`:'';
  const reserve=message.image?`<a href="${SERVICES}" style="display:inline-block;margin:6px 4px;padding:13px 20px;border:1px solid #d9bd80;border-radius:999px;color:#d9bd80;font:700 13px Arial,sans-serif;text-decoration:none">Reserve a Ride</a>`:'';
  const actions=primaryAction||reserve?`<p style="margin:24px 0 8px;text-align:center">${primaryAction}${reserve}</p>`:'';
  // A contact request, not a cancellation/refund transaction. Do not promise
  // self-service until a verified, request-bound management endpoint exists.
  const changeReference=input.requestReference.replace(/[\r\n]/g,' ').slice(0,100);
  const changeUrl='mailto:pxpressmedia@gmail.com?subject='+encodeURIComponent('Ride cancellation request: '+changeReference)+'&body='+encodeURIComponent('Request: '+changeReference+'\n\nPlease describe your cancellation request:\n');
  const changeHelp=input.kind==='customer_paid_receipt'?`<p style="margin:24px 0 8px;line-height:1.6;color:#c8c3ba"><a href="${escape(changeUrl)}" style="color:#d9bd80;text-decoration:underline">Request cancellation</a><br>We’ll confirm any change, cancellation, and applicable refund in writing. Opening this link does not cancel your ride.</p>`:'';
  const text=[message.title,'',message.intro(input),'',...details.map(detail=>`${detail[0]}: ${detail[1]}`),'',message.notice,...(actionUrl?['',`${message.action}: ${actionUrl}`]:[]),...(message.image?['',`Reserve a Ride: ${SERVICES}`]:[]),...(changeHelp?['',`Request cancellation: ${changeUrl}`,'We’ll confirm any change, cancellation, and applicable refund in writing. Opening this link does not cancel your ride.']:[]),'','Pxpress LLC · Professional Transportation Services','pxpressmedia@gmail.com · (234) 200-6969'].join('\n');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><style>body{margin:0;background:#000000!important;color:#f3f0e8;font-family:Arial,sans-serif}th,td{padding:7px 0;text-align:left;vertical-align:top}th{width:145px;color:#a9a49b;font-size:11px;text-transform:uppercase;letter-spacing:1px}td{font-size:14px}@media(max-width:620px){.shell{padding:10px!important}.message{width:100%!important;max-width:360px!important}.card{padding:24px 18px!important}h1{font-size:34px!important;overflow-wrap:anywhere}th,td{display:block;width:auto}.brand{width:190px!important}.hero{margin-inline:-18px!important}}</style></head><body bgcolor="#000000" style="margin:0;background-color:#000000!important;color:#f3f0e8"><table role="presentation" width="100%" bgcolor="#000000" style="width:100%;background-color:#000000!important"><tr><td class="shell" align="center" bgcolor="#000000" style="padding:34px 14px;background-color:#000000!important"><table class="message" role="presentation" width="100%" bgcolor="#000000" style="width:100%;max-width:640px;background-color:#000000!important"><tr><td bgcolor="#000000" style="padding:0 0 14px;background-color:#000000!important"><a href="${HOME}" aria-label="Visit the Pxpress homepage"><img class="brand" src="${LOGO}" width="220" alt="Pxpress" style="display:block;max-width:72%;height:auto;border:0"></a></td></tr><tr><td class="card" bgcolor="#000000" style="padding:40px 36px;background-color:#000000!important;border-top:2px solid #d9bd80">${image}<p style="margin:0 0 12px;color:#d9bd80;text-transform:uppercase;letter-spacing:1.6px;font-size:10px">${escape(message.eyebrow)}</p><h1 style="margin:0 0 18px;color:#f3f0e8;font:italic 500 44px/1.1 Georgia,'Times New Roman',serif">${escape(message.title)}</h1><p style="color:#c8c3ba;line-height:1.7">${escape(message.intro(input))}</p><table role="presentation" width="100%">${rows}</table><p style="padding:14px 16px;border-left:2px solid #d9bd80;background:#17140e;color:#f3f0e8;line-height:1.6">${escape(message.notice)}</p>${appreciation}${actions}</td></tr><tr><td bgcolor="#000000" style="padding:18px;text-align:center;background-color:#000000!important;color:#8f8b84;font-size:11px">Pxpress LLC · Professional Transportation Services · Northeast Ohio<br><a href="mailto:pxpressmedia@gmail.com" style="color:#d9bd80">pxpressmedia@gmail.com</a> · <a href="tel:+12342006969" style="color:#d9bd80">(234) 200-6969</a></td></tr></table></td></tr></table></body></html>`;
  const footerBoundary='</td></tr><tr><td bgcolor="#000000" style="padding:18px;text-align:center';
  let finalHtml=changeHelp?html.replace(footerBoundary,changeHelp+footerBoundary):html;
  if(message.image){
    const buttonStyle='display:block;box-sizing:border-box;height:54px;line-height:54px;padding:0 4px;border:1px solid #d9bd80;border-radius:999px;text-align:center;font-family:Arial,sans-serif;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap';
    const pairedActions=`<table role="presentation" width="100%" style="table-layout:fixed;width:100%;margin:24px 0 8px"><tr><td style="display:table-cell!important;width:50%!important;padding:0 4px 0 0"><a href="${escape(actionUrl)}" style="${buttonStyle};background:#d9bd80;color:#090908">Share your experience</a></td><td style="display:table-cell!important;width:50%!important;padding:0 0 0 4px"><a href="${SERVICES}" style="${buttonStyle};color:#d9bd80">Reserve a Ride</a></td></tr></table><p style="margin:14px 4px 0;color:#8f8b84;text-align:center;font:12px/1.6 Arial,sans-serif">Your star rating contributes only to anonymous totals. Comments stay private unless you consent to public display after owner review.</p>`;
    finalHtml=finalHtml.replace(actions,pairedActions).replace(`<p style="padding:14px 16px;border-left:2px solid #d9bd80;background:#17140e;color:#f3f0e8;line-height:1.6">${escape(message.notice)}</p>`,'');
  }
  return{templateKey:input.kind,subject:message.subject,recipient:input.recipient,text,html:withAdaptiveEmailAppearance(finalHtml)};
}
