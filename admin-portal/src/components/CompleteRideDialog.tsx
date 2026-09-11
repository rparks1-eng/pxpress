import { CheckCircle2, MoonStar, Sun, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatDate, formatTime } from '../lib/selectors';
import type { FollowUpPresentation, RideRequest } from '../types';
export type { FollowUpPresentation } from '../types';

export function automaticFollowUpPresentation(request:Pick<RideRequest,'pickupTime'>):'day'|'night'{
  const match=/^(\d{1,2}):(\d{2})/.exec(request.pickupTime||'');
  const hour=match?Number(match[1]):-1;
  return hour>=6&&hour<18?'day':'night';
}

export function CompleteRideDialog({request,busy,onDismiss,onConfirm}:{
  request:RideRequest;busy:boolean;onDismiss:()=>void;
  onConfirm:(presentation:FollowUpPresentation)=>Promise<void>;
}){
  const closeButtonRef=useRef<HTMLButtonElement>(null),titleId=useId();
  const [presentation,setPresentation]=useState<FollowUpPresentation>('auto');
  const [error,setError]=useState('');
  const automatic=automaticFollowUpPresentation(request);
  useEffect(()=>{closeButtonRef.current?.focus()},[]);
  async function submit(event:React.FormEvent){
    event.preventDefault();setError('');
    try{await onConfirm(presentation)}catch(cause){setError(cause instanceof Error?cause.message:'The ride could not be completed. Try again.')}
  }
  return <dialog open aria-modal="true" className="price-dialog complete-ride-dialog" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();if(!busy)onDismiss()}}>
    <form onSubmit={submit}>
      <header><div><p className="eyebrow">Finish the ride</p><h2 id={titleId}>Mark ride complete</h2></div><button ref={closeButtonRef} type="button" className="dialog-close" onClick={onDismiss} disabled={busy} aria-label="Close complete ride dialog"><X aria-hidden/></button></header>
      <p className="dialog-lede"><strong>{request.requestNumber} · {request.customerName}</strong> Confirm the service is finished. This records the completion and prepares one thank-you message with a private feedback link.</p>
      <div className="completion-proof" role="status"><CheckCircle2 aria-hidden/><span><strong>Paid ride verified in this view</strong>{formatDate(request.pickupDate)} at {formatTime(request.pickupTime)}</span></div>
      <fieldset className="followup-choice"><legend>Thank-you image</legend>
        <label><input type="radio" name="presentation" value="auto" checked={presentation==='auto'} onChange={()=>setPresentation('auto')}/><span><strong>Choose automatically</strong>Uses the {automatic==='day'?'daytime':'nighttime'} image for this ride’s scheduled time.</span></label>
        <label><input type="radio" name="presentation" value="day" checked={presentation==='day'} onChange={()=>setPresentation('day')}/><Sun aria-hidden/><span><strong>Daytime</strong>Bright Cleveland skyline.</span></label>
        <label><input type="radio" name="presentation" value="night" checked={presentation==='night'} onChange={()=>setPresentation('night')}/><MoonStar aria-hidden/><span><strong>Evening or night</strong>Illuminated Cleveland skyline.</span></label>
      </fieldset>
      <p className="completion-note">Completing a ride never charges the customer again. Email delivery remains controlled separately and is protected against duplicate sends.</p>
      {error&&<p role="alert" className="dialog-error">{error}</p>}
      <footer><button type="button" className="button secondary" onClick={onDismiss} disabled={busy}>Not yet</button><button className="button primary" disabled={busy}><CheckCircle2 aria-hidden/>{busy?'Completing…':'Complete Ride'}</button></footer>
    </form>
  </dialog>;
}
