import { Check } from 'lucide-react';
import type { RideRequest } from '../types';

const labels=['Received','Priced','Awaiting payment','Paid','Scheduled','Completed'];
const closedStatuses=new Set(['declined','cancelled','expired','refunded']);

export function requestProgressIndex(request:RideRequest){
  if(request.status==='completed')return 5;
  if(request.status==='confirmed'||request.status==='in_progress')return 4;
  if(request.paymentStatus==='paid'||request.status==='deposit_paid')return 3;
  if(request.paymentStatus==='pending'||request.paymentStatus==='authorized'||['quote_sent','deposit_pending','payment_failed'].includes(request.status))return 2;
  if((request.quoteAmount||0)>0||request.status==='quote_ready')return 1;
  return 0;
}

export function RequestProgress({request}:{request:RideRequest}){
  const current=requestProgressIndex(request);
  return <div className="request-progress" aria-label="Ride request progress">
    <ol>{labels.map((label,index)=><li key={label} className={index<current?'is-complete':index===current?'is-current':''} aria-current={index===current?'step':undefined}><span>{index<current?<Check aria-hidden/>:index+1}</span><strong>{label}</strong></li>)}</ol>
    {closedStatuses.has(request.status)&&<p>This request is closed. System details remain available below for the record.</p>}
  </div>;
}
