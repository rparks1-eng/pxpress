import type { Customer, RequestStatus, RideRequest } from '../types';
import { PXPRESS_TIME_ZONE } from './business-date';
export const formatMoney=(value?:number)=>value==null?'Not quoted':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(value);
export const formatDate=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value+'T12:00:00'));
export const formatTime=(value='')=>{
  const match=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if(!match)return value;
  const hour=Number(match[1]);
  if(hour<0||hour>23)return value;
  const minute=Number(match[2]);
  if(minute<0||minute>59)return value;
  return `${hour%12||12}:${match[2]} ${hour<12?'AM':'PM'}`;
};
export const formatDateTime=(value:string)=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true,timeZone:PXPRESS_TIME_ZONE}).format(new Date(value));
export const terminalRequestStatuses=new Set<RequestStatus>(['completed','declined','cancelled','expired','refunded']);
export const approvalStatuses=new Set<RequestStatus>(['new','triaged','quote_ready','quote_sent','scheduling_conflict','notification_failed','payment_failed']);
export const hasReconciliation=(request:RideRequest)=>request.lifecycleEffects?.some(effect=>effect.state==='reconciliation_required')===true;
export const isOwnerActionRequest=(request:RideRequest)=>{
  if(hasReconciliation(request))return true;
  if(terminalRequestStatuses.has(request.status))return false;
  if(request.paymentStatus==='paid'||request.status==='confirmed'||request.status==='in_progress')return false;
  return approvalStatuses.has(request.status)||request.status==='deposit_pending'||request.status==='deposit_paid';
};
export const filterRequests=(items:RideRequest[],query:string,status:string,service:string)=>items.filter(r=>{
  const hay=[r.requestNumber,r.customerName,r.email,r.phone,r.pickupAddress,r.destinationAddress].join(' ').toLowerCase();
  const statusMatch=status==='__active'?isOwnerActionRequest(r):status==='__archive'?!isOwnerActionRequest(r):(!status||r.status===status);
  return (!query||hay.includes(query.toLowerCase()))&&statusMatch&&(!service||r.service===service);
});
export const toCustomers=(items:RideRequest[]):Customer[]=>Array.from(items.reduce((map,r)=>{
  if(r.customerDeleted)return map;
  const key=r.customerId||r.email;const old=map.get(key); map.set(key,{id:key,email:r.email,name:r.customerName,phone:r.phone,rides:(old?.rides||0)+1,lastRide:!old||r.pickupDate>old.lastRide?r.pickupDate:old.lastRide,totalQuoted:(old?.totalQuoted||0)+(r.quoteAmount||0)}); return map;
},new Map<string,Customer>()).values()).sort((a,b)=>b.lastRide.localeCompare(a.lastRide));

export const allowedTransitions:Record<string,RequestStatus[]>={
  new:['triaged','declined','cancelled'],triaged:['quote_ready','declined','cancelled','scheduling_conflict'],quote_ready:['quote_sent','triaged','declined','cancelled'],
  quote_sent:['deposit_pending','expired','declined','cancelled'],deposit_pending:['payment_failed','declined','cancelled'],deposit_paid:['refunded','cancelled'],
  confirmed:['in_progress','cancelled','scheduling_conflict'],in_progress:['completed','cancelled'],payment_failed:['deposit_pending','declined','cancelled'],
  scheduling_conflict:['triaged','declined','cancelled'],notification_failed:['triaged','quote_sent','declined','cancelled'],
};
