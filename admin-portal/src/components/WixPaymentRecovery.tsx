import { RefreshCw,ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { wixPayLinkReconciliationEnabled } from '../lib/supabase';
import type { RideRequest } from '../types';

export const wixPaymentRecoveryEligible=(request:RideRequest)=>request.status==='deposit_pending'&&request.paymentStatus==='pending'&&Number.isSafeInteger(request.version)&&Number(request.version)>0&&request.lifecycleEffects?.some(effect=>effect.effectType==='payment_link_creation'&&effect.state==='delivered')===true&&request.lifecycleEffects.some(effect=>effect.effectType==='customer_payment_link_delivery'&&effect.state==='delivered');

type Props={request:RideRequest;onVerify:(reason:string)=>Promise<void>};
export function WixPaymentRecovery({request,onVerify}:Props){
  const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!wixPaymentRecoveryEligible(request))return null;
  async function submit(){if(!confirmed||reason.trim().length<8)return;setBusy(true);setError('');try{await onVerify(reason.trim());setOpen(false);setReason('');setConfirmed(false)}catch(caught){setError(caught instanceof Error?caught.message:'Wix payment could not be verified.')}finally{setBusy(false)}}
  return <section className="wix-payment-recovery" aria-labelledby="wix-payment-recovery-title">
    <div><ShieldCheck aria-hidden/><span><strong id="wix-payment-recovery-title">Payment still showing as pending?</strong><small>Use this only after Wix shows that this exact payment was completed.</small></span></div>
    {!open?<button type="button" className="button secondary" disabled={!wixPayLinkReconciliationEnabled} onClick={()=>setOpen(true)}><RefreshCw aria-hidden/> Verify Wix payment</button>:<div className="wix-payment-recovery-form">
      <p>The server will re-check the exact Wix payment link and payment. Nothing you enter here can mark it paid.</p>
      <label>Reason for verification<textarea rows={3} minLength={8} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Example: Wix shows payment complete, but this request still says pending."/></label>
      <label className="recovery-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/><span>I checked the exact Wix payment and want Pxpress to verify it directly.</span></label>
      {error&&<p className="dialog-error" role="alert">{error}</p>}
      <div className="decision-actions"><button type="button" className="button secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancel</button><button type="button" className="button primary" disabled={busy||!confirmed||reason.trim().length<8} onClick={submit}>{busy?'Checking Wix…':'Verify exact payment'}</button></div>
    </div>}
    {!wixPayLinkReconciliationEnabled&&<small className="guard-note">Recovery is currently off. Enable it only for one approved request.</small>}
  </section>;
}
