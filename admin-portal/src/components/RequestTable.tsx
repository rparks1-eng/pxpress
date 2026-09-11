import { ChevronRight } from 'lucide-react';
import { Link,useLocation } from 'react-router-dom';
import type { RideRequest } from '../types';
import { formatDate, formatDateTime, formatMoney, formatTime, hasReconciliation } from '../lib/selectors';
export const serviceLabels={airport:'Airport',appointment:'Appointment',point:'Point-to-point',events:'Event',hourly:'Hourly'};
export const statusLabels:Record<string,string>={new:'New',triaged:'In review',quote_ready:'Price ready',quote_sent:'Quote sent',deposit_pending:'Awaiting payment',deposit_paid:'Deposit paid',confirmed:'Confirmed',in_progress:'In progress',completed:'Completed',declined:'Declined',expired:'Expired',cancelled:'Cancelled',payment_failed:'Payment failed',refunded:'Refunded',notification_failed:'Email needs attention',scheduling_conflict:'Schedule conflict'};
export function RequestTable({items}:{items:RideRequest[]}){
 const location=useLocation();
 return <ul className="desk-request-list touch-request-list" aria-label="Pxpress ride requests">{items.map(r=><li key={r.id}>
   <Link className="touch-request-row" to={'/requests/'+r.id} state={{ownerReturn:location.pathname}} aria-label={'Open '+r.requestNumber+' for '+r.customerName}>
     <div className="touch-request-content"><div className="touch-request-title"><h2>{r.customerName}</h2><span className="touch-request-pickup-time"><span>Pickup time</span><time dateTime={r.pickupDate+'T'+r.pickupTime}>{formatTime(r.pickupTime)}</time></span></div>
       <p className="touch-request-date">{formatDate(r.pickupDate)} · {serviceLabels[r.service]}{r.quoteAmount!=null?' · '+formatMoney(r.quoteAmount):''}</p>
       <div className="touch-request-route" aria-label="Trip route"><p><span>Pickup</span><b>{r.pickupAddress||'Not provided'}</b></p><p><span>{r.service==='hourly'?'Final destination':'Drop-off'}</span><b>{r.destinationAddress||r.airport||'Not provided'}</b></p>{r.service==='hourly'&&<p><span>Hourly end</span><b>{r.hourlyEnd?formatTime(r.hourlyEnd):'Not provided'}</b></p>}</div>
       <div className="touch-request-received"><span>Received</span><time dateTime={r.createdAt}>{formatDateTime(r.createdAt)} Eastern</time></div>
       <span className={'touch-request-state state-'+r.status}>{hasReconciliation(r)?'Needs review':statusLabels[r.status]||'Needs review'}</span>
     </div><ChevronRight aria-hidden/>
   </Link>
 </li>)}</ul>;
}
