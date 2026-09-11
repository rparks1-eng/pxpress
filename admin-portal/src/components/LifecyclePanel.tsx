import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { wixReconciliationEnabled } from '../lib/supabase';
import type {
  LifecycleEffect,
  LifecycleEffectState,
  LifecycleEffectType,
  RideRequest,
  WixReconciliationAction,
  WixReconciliationIdentity,
} from '../types';
import { WixPaymentRecovery } from './WixPaymentRecovery';

type FlowStep = {
  key: string;
  label: string;
  effectType?: LifecycleEffectType;
  complete?: (request: RideRequest) => boolean;
  completeCopy?: string;
};

const steps: FlowStep[] = [
  { key: 'request', label: 'Request received', effectType: 'customer_request_acknowledgement' },
  { key: 'approval', label: 'Owner quote approval', complete: request => Boolean(request.quoteAmount && request.quoteAmount > 0), completeCopy: 'Owner price recorded' },
  { key: 'contact', label: 'Wix contact', effectType: 'wix_contact' },
  { key: 'payment-link', label: 'Wix Payment Link created', effectType: 'payment_link_creation' },
  { key: 'delivery', label: 'Customer payment email', effectType: 'customer_payment_link_delivery' },
  { key: 'paid', label: 'Authoritative paid verification', complete: request => request.paymentStatus === 'paid', completeCopy: 'Verified by signed event and Wix readback' },
  { key: 'booking', label: 'Wix Booking confirmed PAID', effectType: 'wix_paid_booking_confirmation' },
  { key: 'calendar', label: 'Calendar finalized', effectType: 'calendar_finalization' },
  { key: 'receipt', label: 'Customer paid receipt', effectType: 'customer_payment_receipt' },
];

const legacyTypes: LifecycleEffectType[] = ['wix_invoice_payment', 'wix_booking_checkout'];
const legacyLabels: Record<string, string> = {
  wix_invoice_payment: 'Legacy Wix invoice lane (disabled)',
  wix_booking_checkout: 'Legacy prepayment Booking checkout lane',
};
const stateCopy: Record<LifecycleEffectState, string> = {
  held: 'Disabled by safety switch', ready: 'Queued', leased: 'In progress', retry: 'Retry scheduled',
  delivered: 'Completed', dead_letter: 'Stopped', reconciliation_required: 'Authoritative reconciliation required', cancelled: 'Cancelled',
};

type Props = {
  request: RideRequest;
  onReconcile: (effect: LifecycleEffect, action: WixReconciliationAction, reason: string, identity: WixReconciliationIdentity) => Promise<void>;
  onVerifyPayment: (reason: string) => Promise<void>;
};
const wixIdPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';

export function LifecyclePanel({ request, onReconcile, onVerifyPayment }: Props) {
  const [selected, setSelected] = useState<LifecycleEffect>();
  const [action, setAction] = useState<WixReconciliationAction>('provider_absent_retry');
  const [reason, setReason] = useState('');
  const [providerInvoiceId, setProviderInvoiceId] = useState('');
  const [paymentRequestId, setPaymentRequestId] = useState('');
  const [providerBookingId, setProviderBookingId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const effects = useMemo(() => new Map((request.lifecycleEffects || []).map(effect => [effect.effectType, effect])), [request.lifecycleEffects]);
  const legacy = (request.lifecycleEffects || []).filter(effect => legacyTypes.includes(effect.effectType));

  function open(effect: LifecycleEffect) {
    setSelected(effect);
    setAction(effect.effectType === 'wix_paid_booking_confirmation' ? 'bind_paid_booking' : 'bind_invoice_payment_request');
    setReason(''); setProviderInvoiceId(''); setPaymentRequestId(''); setProviderBookingId(''); setError('');
  }

  async function save() {
    if (!selected) return;
    if (reason.trim().length < 8) { setError('Enter at least 8 characters explaining the verified decision.'); return; }
    setBusy(true); setError('');
    try {
      await onReconcile(selected, action, reason, {
        providerInvoiceId: providerInvoiceId.trim() || undefined,
        paymentRequestId: paymentRequestId.trim() || undefined,
        providerBookingId: providerBookingId.trim() || undefined,
      });
      setSelected(undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The reconciliation request could not be recorded.');
    } finally { setBusy(false); }
  }

  const invoiceIds = action === 'bind_invoice_payment_request' || (action === 'provider_observed_cancel' && selected?.effectType === 'wix_invoice_payment');
  const bookingId = action === 'bind_paid_booking' || (action === 'provider_observed_cancel' && selected?.effectType === 'wix_paid_booking_confirmation');

  return <details className="detail-card lifecycle-panel system-status">
    <summary><ShieldCheck aria-hidden/><span><strong>System status</strong><small>Provider checks and repair tools</small></span></summary>
    <div className="system-status-body">
    <div className="card-title"><ShieldCheck aria-hidden /><div><p className="eyebrow">Provider record</p><h2>Payment Links and booking lifecycle</h2></div></div>
    <p className="guard-note">Wix Payment Links are the current payment path. Approval is not payment, and payment is not confirmed until Wix is read back authoritatively. The older invoice lane is disabled.</p>
    <WixPaymentRecovery request={request} onVerify={onVerifyPayment}/>
    <ol className="lifecycle-chain">{steps.map(step => {
      const effect = step.effectType ? effects.get(step.effectType) : undefined;
      const complete = step.complete?.(request) ?? effect?.state === 'delivered';
      const attention = effect?.state === 'reconciliation_required';
      const canOpen = attention && (effect.effectType === 'wix_invoice_payment' || effect.effectType === 'wix_paid_booking_confirmation');
      return <li key={step.key} className={attention ? 'needs-reconciliation' : ''}>
        <span className="lifecycle-icon">{complete ? <CheckCircle2 aria-hidden /> : attention ? <AlertTriangle aria-hidden /> : <Clock3 aria-hidden />}</span>
        <div><strong>{step.label}</strong><span>{complete ? step.completeCopy || stateCopy.delivered : effect ? stateCopy[effect.state] : 'Not queued'}</span>{effect && <small>{effect.attemptCount} of {effect.maxAttempts} attempts used</small>}</div>
        {canOpen && <button className="button reconciliation" onClick={() => open(effect)}>Inspect reconciliation</button>}
      </li>;
    })}</ol>
    {!wixReconciliationEnabled && <p className="guard-note">Operator reconciliation is disabled until the exact Wix-site readback worker and owner-controlled canary are approved.</p>}
    {legacy.length > 0 && <div className="legacy-lifecycle"><p className="eyebrow">Legacy / inactive records</p><ul>{legacy.map(effect => <li key={effect.id}><strong>{legacyLabels[effect.effectType]}</strong><span>{stateCopy[effect.state]}</span></li>)}</ul></div>}
    {selected && <div className="reconciliation-box" role="region" aria-label="Request authoritative Wix reconciliation">
      <h3>Request authoritative Wix readback</h3>
      <p>Enter provider IDs only after checking the exact Wix record. This screen never accepts a payment URL or card data.</p>
      <label>Verified action<select value={action} onChange={event => setAction(event.target.value as WixReconciliationAction)}>
        <option value="provider_absent_retry">Provider confirms absent — controlled retry</option>
        <option value="provider_observed_cancel">Provider object exists — cancel duplicate retry</option>
        {selected.effectType === 'wix_invoice_payment' && <option value="bind_invoice_payment_request">Bind exact invoice and payment request</option>}
        {selected.effectType === 'wix_paid_booking_confirmation' && <option value="bind_paid_booking">Bind exact paid Booking</option>}
      </select></label>
      {invoiceIds && <><label>Wix invoice ID<input pattern={wixIdPattern} title="Canonical Wix UUID" value={providerInvoiceId} onChange={event => setProviderInvoiceId(event.target.value)} autoComplete="off" /></label>{action === 'bind_invoice_payment_request' && <label>Wix payment request ID<input pattern={wixIdPattern} title="Canonical Wix UUID" value={paymentRequestId} onChange={event => setPaymentRequestId(event.target.value)} autoComplete="off" /></label>}</>}
      {bookingId && <label>Wix Booking ID<input pattern={wixIdPattern} title="Canonical Wix UUID" value={providerBookingId} onChange={event => setProviderBookingId(event.target.value)} autoComplete="off" /></label>}
      <label>Owner reason<textarea rows={4} minLength={8} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
      <p className="guard-note">Submitting only requests a fenced readback. A service-role worker must prove zero or exactly one matching provider record before anything can retry or bind.</p>
      {error && <p role="alert" className="dialog-error">{error}</p>}
      <div className="decision-actions"><button className="button secondary" onClick={() => setSelected(undefined)}>Cancel</button><button className="button primary" disabled={busy || !wixReconciliationEnabled} onClick={save}>{busy ? 'Recording…' : 'Request readback'}</button></div>
    </div>}
    </div>
  </details>;
}
