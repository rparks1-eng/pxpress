import type { AuditEvent,RideRequest } from '../types';

export type OwnerNotificationKind='new_request'|'upcoming'|'payment_pending'|'payment_received'|'payment_failed'|'cancellation'|'tax_review'|'conflict'|'system_error';
export type OwnerNotificationTimeBasis='lifecycle_event'|'scheduled_pickup'|'request_received_fallback'|'record_observed';
export type OwnerNotification={id:string;requestId:string;kind:OwnerNotificationKind;priority:1|2|3;title:string;detail:string;at:string;timeBasis:OwnerNotificationTimeBasis};

const closed=new Set(['cancelled','declined','expired','refunded']);
const scheduled=new Set(['deposit_pending','confirmed','in_progress']);
export const localDateKey=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export const rideDate=(request:RideRequest)=>new Date(`${request.pickupDate}T${request.pickupTime}:00`);

export function todaysRides(items:RideRequest[],now=new Date()){
  const today=localDateKey(now);
  return items.filter(request=>request.pickupDate===today&&!closed.has(request.status)).sort((a,b)=>rideDate(a).getTime()-rideDate(b).getTime());
}

export function nextOperationalRide(items:RideRequest[],now=new Date()){
  return [...items].filter(request=>scheduled.has(request.status)&&(request.status==='in_progress'||rideDate(request).getTime()>=now.getTime())).sort((a,b)=>{
    if(a.status==='in_progress'&&b.status!=='in_progress')return -1;
    if(b.status==='in_progress'&&a.status!=='in_progress')return 1;
    return rideDate(a).getTime()-rideDate(b).getTime();
  })[0];
}

export function rideCountdown(request:RideRequest,now=new Date()){
  if(request.status==='in_progress')return 'Ride in progress';
  const minutes=Math.ceil((rideDate(request).getTime()-now.getTime())/60_000);
  if(minutes<0)return 'Pickup time passed';
  if(minutes<60)return `${Math.max(1,minutes)} min to pickup`;
  if(minutes<1_440){const hours=Math.floor(minutes/60),remainder=minutes%60;return `${hours} hr${hours===1?'':'s'}${remainder?` ${remainder} min`:''} to pickup`}
  const days=Math.floor(minutes/1_440);return `${days} day${days===1?'':'s'} to pickup`;
}

const eventTime=(request:RideRequest,status:string,events:AuditEvent[])=>{
  const at=events.filter(event=>event.requestId===request.id&&event.action.endsWith(`→ ${status}`)).sort((a,b)=>b.at.localeCompare(a.at))[0]?.at;
  return at?{at,timeBasis:'lifecycle_event' as const,suffix:''}:{at:request.createdAt,timeBasis:'request_received_fallback' as const,suffix:' Status time is unavailable; showing the request received time.'};
};

export function buildOwnerNotifications(items:RideRequest[],now=new Date(),events:AuditEvent[]=[]):OwnerNotification[]{
  const notifications:OwnerNotification[]=[];
  for(const request of items){
    if(request.status==='new')notifications.push({id:`new:${request.id}`,requestId:request.id,kind:'new_request',priority:2,title:'New ride request',detail:`${request.customerName} is waiting for review.`,at:request.createdAt,timeBasis:'request_received_fallback'});
    if(request.status==='scheduling_conflict'){const time=eventTime(request,'scheduling_conflict',events);notifications.push({id:`conflict:${request.id}`,requestId:request.id,kind:'conflict',priority:3,title:'Schedule conflict',detail:`${request.requestNumber} needs a scheduling decision.${time.suffix}`,...time})}
    // Quote approval only prepares payment. Do not describe the customer as
    // pending until the payment-link message has verified delivery evidence.
    const paymentLinkDelivered=request.lifecycleEffects?.some(effect=>effect.effectType==='customer_payment_link_delivery'&&effect.state==='delivered')===true;
    if((request.status==='deposit_pending'||request.paymentStatus==='pending')&&paymentLinkDelivered){const time=eventTime(request,'deposit_pending',events);notifications.push({id:`payment:${request.id}`,requestId:request.id,kind:'payment_pending',priority:2,title:'Awaiting customer payment',detail:`The payment link for ${request.requestNumber} was delivered to ${request.customerName}.`,...time})}
    if(request.status==='deposit_paid'&&request.paymentStatus==='paid'){const time=eventTime(request,'deposit_paid',events);notifications.push({id:`payment-received:${request.id}`,requestId:request.id,kind:'payment_received',priority:2,title:'Payment received',detail:`Payment is recorded for ${request.requestNumber}. Confirm the ride details.${time.suffix}`,...time})}
    if(request.status==='payment_failed'||request.paymentStatus==='failed'){const time=eventTime(request,'payment_failed',events);notifications.push({id:`payment-failed:${request.id}`,requestId:request.id,kind:'payment_failed',priority:3,title:'Payment needs attention',detail:`Payment was not completed for ${request.requestNumber}.${time.suffix}`,...time})}
    if(request.status==='cancelled'){const time=eventTime(request,'cancelled',events);notifications.push({id:`cancelled:${request.id}`,requestId:request.id,kind:'cancellation',priority:2,title:'Ride cancelled',detail:`${request.requestNumber} was cancelled. Review the request record for details.${time.suffix}`,...time})}
    if(request.status==='notification_failed'){const time=eventTime(request,'notification_failed',events);notifications.push({id:`system:${request.id}:notification-failed`,requestId:request.id,kind:'system_error',priority:3,title:'Message delivery needs attention',detail:`A message for ${request.requestNumber} was not delivered.${time.suffix}`,...time})}
    if(request.taxProjection?.paymentStatus==='paid'&&!request.taxProjection.filingReady)notifications.push({id:`tax-review:${request.taxProjection.id}`,requestId:request.id,kind:'tax_review',priority:3,title:'Tax review needed',detail:`${request.requestNumber} is paid but not ready for filing.`,at:request.taxProjection.observedAt,timeBasis:'record_observed'});
    for(const effect of request.lifecycleEffects||[])if(effect.state==='dead_letter'||effect.state==='reconciliation_required')notifications.push({id:`system:${effect.id}:${effect.state}`,requestId:request.id,kind:'system_error',priority:3,title:'System action needs review',detail:`${request.requestNumber} has an operation that could not finish safely.`,at:effect.updatedAt,timeBasis:'record_observed'});
    if(scheduled.has(request.status)&&request.status!=='in_progress'){
      const minutes=Math.ceil((rideDate(request).getTime()-now.getTime())/60_000);
      if(minutes>=0&&minutes<=1_440){
        const window=minutes<=30?'30 minutes':minutes<=120?'2 hours':'24 hours';
        notifications.push({id:`upcoming:${window}:${request.id}`,requestId:request.id,kind:'upcoming',priority:minutes<=120?3:1,title:`Ride within ${window}`,detail:`${request.customerName} · ${request.pickupAddress}`,at:rideDate(request).toISOString(),timeBasis:'scheduled_pickup'});
      }
    }
  }
  return notifications.sort((a,b)=>b.priority-a.priority||new Date(a.at).getTime()-new Date(b.at).getTime()||a.id.localeCompare(b.id));
}
