import type { AuditEvent, LifecycleEffect, LifecycleEffectType, RideRequest } from '../../types';

const communicationEffects = new Set<LifecycleEffectType>([
  'customer_request_acknowledgement',
  'owner_request_notification',
  'owner_payment_notification',
  'customer_payment_link_delivery',
  'customer_payment_receipt',
  'customer_post_ride_thank_you',
  'customer_feedback_receipt',
]);

export type CommunicationHistoryRow = {
  id: string;
  requestId: string;
  requestNumber: string;
  customerName: string;
  channel: 'lifecycle_effect' | 'audit_event';
  label: string;
  state: string;
  at: string;
  enabledWhenRecorded?: boolean;
  safeErrorCode?: string;
  attemptCount?: number;
};

export type MessageTemplatePreview = {
  key: string;
  audience: 'customer' | 'owner';
  label: string;
  subject: string;
  preview: string;
  actionLabel?: string;
  status: 'preview_only';
  availability?: 'proposed';
};

export const messageTemplatePreviews: MessageTemplatePreview[] = [
  { key: 'request-received', audience: 'customer', label: 'Request received', subject: 'We received your Pxpress ride request', preview: 'Your request is in review. We will confirm availability and send the approved price before payment is requested.', status: 'preview_only' },
  { key: 'owner-new-request', audience: 'owner', label: 'Owner alert', subject: 'New Pxpress ride request', preview: 'A new request is ready for owner review, mileage checking, and pricing in the private request detail.', actionLabel: 'Review request', status: 'preview_only' },
  { key: 'payment-ready', audience: 'customer', label: 'Price approved', subject: 'Your Pxpress payment link', preview: 'Your ride price has been approved. Use the unique secure Wix payment link in this message to continue.', actionLabel: 'Pay securely', status: 'preview_only' },
  { key: 'request-declined', audience: 'customer', label: 'Request declined', subject: 'Update on Pxpress request {{request_number}}', preview: 'We are unable to accept this request. No payment is due from this notice. Contact Pxpress if you would like help with another time.', status: 'preview_only', availability: 'proposed' },
  { key: 'request-cancelled', audience: 'customer', label: 'Cancellation', subject: 'Pxpress request {{request_number}} was cancelled', preview: 'This ride has been cancelled. Any separate refund status must be confirmed from the payment provider record.', status: 'preview_only', availability: 'proposed' },
  { key: 'payment-receipt', audience: 'customer', label: 'Payment received', subject: 'Pxpress payment received', preview: 'A receipt with the request reference, service subtotal, Ohio sales tax, total paid, and itinerary. Payment and ride confirmation must both be verified before this message can confirm the ride.', status: 'preview_only' },
  { key: 'post-ride-thank-you', audience: 'customer', label: 'Ride completed', subject: 'Thank you for riding with Pxpress', preview: 'A branded day or night thank-you message with a private feedback link and a Reserve a Ride action.', actionLabel: 'Share your experience', status: 'preview_only' },
  { key: 'post-ride-thank-you-night', audience: 'customer', label: 'Ride completed · evening', subject: 'Thank you for riding with Pxpress', preview: 'The evening version of the post-ride thank-you.', status: 'preview_only' },
  { key: 'owner-payment-alert', audience: 'owner', label: 'Owner payment alert', subject: 'Pxpress payment verified', preview: 'A sample payment-verification alert for the owner.', status: 'preview_only' },
  { key: 'feedback-receipt', audience: 'customer', label: 'Feedback received', subject: 'Thank you for your Pxpress feedback', preview: 'A short acknowledgement with a Reserve a Ride action after feedback is received. Public comments still require owner review.', actionLabel: 'Reserve a Ride', status: 'preview_only' },
];

export function communicationStatus(state: string): { label: string; detail: string } {
  const labels: Record<string, [string, string]> = {
    held: ['On hold', 'Waiting for sending approval or another requirement; no completed send is established.'],
    ready: ['Queued', 'Waiting for a sending attempt.'],
    leased: ['Processing', 'An attempt is in progress; the result is not confirmed.'],
    retry: ['Retry scheduled', 'The previous attempt did not establish delivery.'],
    delivered: ['Delivery recorded', 'This record does not verify Inbox placement or that the customer read the email.'],
    dead_letter: ['Needs attention', 'Automatic attempts stopped. Review the existing message before any resend.'],
    reconciliation_required: ['Checking outcome', 'A send may have occurred. Confirm the existing message outcome before any resend.'],
    cancelled: ['Stopped', 'Further attempts stopped. This does not recall any email already sent.'],
  };
  const [label, detail] = labels[state] ?? ['Activity recorded', 'An activity entry alone does not establish that an email was sent or delivered.'];
  return { label, detail };
}

const effectLabel: Record<LifecycleEffectType, string> = {
  owner_payment_notification: 'Owner payment alert',
  customer_request_acknowledgement: 'Customer request receipt', owner_request_notification: 'Owner new-request alert', tentative_calendar: 'Tentative calendar', wix_contact: 'Wix contact', wix_invoice_payment: 'Wix invoice and payment request', customer_payment_link_delivery: 'Customer payment-ready message', wix_paid_booking_confirmation: 'Wix paid booking confirmation', customer_payment_receipt: 'Customer payment receipt', customer_post_ride_thank_you: 'Customer post-ride thank-you', customer_feedback_receipt: 'Customer feedback receipt', calendar_finalization: 'Calendar finalization', payment_link_creation: 'Historical payment link', wix_booking_checkout: 'Historical Wix checkout',
};

export function buildCommunicationHistory(requests: RideRequest[], auditEvents: AuditEvent[]): CommunicationHistoryRow[] {
  const requestById = new Map(requests.map((request) => [request.id, request]));
  const effects = requests.flatMap((request) => (request.lifecycleEffects ?? []).filter((effect) => communicationEffects.has(effect.effectType)).map((effect: LifecycleEffect) => ({
    id: effect.id, requestId: request.id, requestNumber: request.requestNumber, customerName: request.customerName, channel: 'lifecycle_effect' as const,
    label: effectLabel[effect.effectType], state: effect.state, at: effect.deliveredAt ?? effect.updatedAt, enabledWhenRecorded: effect.enabledSnapshot, safeErrorCode: effect.lastSafeErrorCode, attemptCount: effect.attemptCount,
  })));
  const audits = auditEvents.filter((event) => /message|email|notification|receipt|communication/i.test(`${event.action} ${event.detail}`)).map((event) => {
    const request = requestById.get(event.requestId);
    return { id: event.id, requestId: event.requestId, requestNumber: request?.requestNumber ?? 'Unknown request', customerName: request?.customerName ?? 'Unknown guest', channel: 'audit_event' as const, label: event.action, state: 'recorded audit', at: event.at };
  });
  return [...effects, ...audits].sort((a, b) => b.at.localeCompare(a.at));
}
