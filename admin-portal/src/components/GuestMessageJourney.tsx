import type { LifecycleEffect,RideRequest } from '../types';
import { CheckCircle2,Clock3,AlertTriangle } from 'lucide-react';
const stages=[['customer_request_acknowledgement','Request received'],['customer_payment_link_delivery','Quote & payment link'],['customer_payment_receipt','Payment receipt'],['customer_post_ride_thank_you','Thank-you & feedback link'],['customer_feedback_receipt','Feedback received']] as const;
export function messageDeliveryLabel(effect?:LifecycleEffect){
 if(!effect)return 'Not prepared';
 if(effect.state==='delivered')return 'Delivery recorded';
 if(effect.state==='held')return 'Prepared · sending on hold';
 if(effect.state==='reconciliation_required')return 'Checking delivery · do not resend';
 if(effect.state==='dead_letter')return 'Delivery needs attention';
 if(effect.state==='cancelled')return 'Cancelled';
 return effect.state==='leased'?'Sending':effect.state==='retry'?'Retry scheduled':'Queued';
}
export function GuestMessageJourney({request}:{request:RideRequest}){
 return <section className="desk-message-journey" aria-label="Customer email progress"><h2>Customer emails</h2><p>Payment, ride completion, and email delivery are tracked separately.</p><ol>{stages.map(([key,label])=>{const e=request.lifecycleEffects?.filter(e=>e.effectType===key).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0],attention=e&&['reconciliation_required','dead_letter'].includes(e.state),Icon=e?.state==='delivered'?CheckCircle2:attention?AlertTriangle:Clock3;return <li key={key} className={attention?'needs-attention':''}><Icon aria-hidden/><div><strong>{label}</strong><span>{messageDeliveryLabel(e)}</span></div></li>})}</ol><small>A delivery record does not guarantee Inbox placement. Held messages have not been sent.</small></section>;
}
