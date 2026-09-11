import { renderExperienceMessage, type ExperienceMessageKind } from '../../../../supabase/functions/_shared/customer-experience-messages';
import { plannedFollowUpContract } from '../../../../supabase/functions/_shared/customer-follow-up-contract';

const kinds: Record<string, ExperienceMessageKind> = {
  'request-received': 'customer_request_receipt',
  'owner-new-request': 'owner_request_alert',
  'payment-ready': 'customer_quote_invitation',
  'payment-receipt': 'customer_paid_receipt',
  'owner-payment-alert': 'owner_payment_alert',
  'post-ride-thank-you': 'customer_post_ride_day',
  'post-ride-thank-you-night': 'customer_post_ride_night',
  'feedback-receipt': 'customer_feedback_receipt',
};

// Fixed public assets checked as image/png; never interpolate customer data here.
const dayImage = 'https://pxpressllc.com/email-assets/pxpress-thank-you-day-no-qr.png';
const nightImage = 'https://pxpressllc.com/email-assets/pxpress-thank-you-night-no-qr.png';

// No request data, payment links, delivery tokens, or provider modules enter this preview.
export function renderSampleTemplate(key: string) {
  const kind = kinds[key];
  if (!kind) return null;
  const rendered = renderExperienceMessage({
    kind, recipient: 'sample@example.invalid', firstName: 'Sample guest',
    requestReference: 'SAMPLE-0001', service: 'airport', pickup: 'Sample date · 10:00 AM',
    subtotal: '$100.00', taxLabel: 'Sample tax (illustrative)', tax: '$0.00', total: '$100.00',
    actionUrl: 'https://example.invalid/preview-only', sinkOnly: true,
    imageUrl: kind === 'customer_post_ride_day' ? dayImage : kind === 'customer_post_ride_night' ? nightImage : undefined,
  });
  const followUp = kind.startsWith('customer_post_ride_')
    ? plannedFollowUpContract('post_ride_thank_you')
    : kind === 'customer_feedback_receipt' ? plannedFollowUpContract('review_submission_confirmation') : null;
  // CSP allows only the fixed branding hosts for images. Inert disables links,
  // focus, and interactions; the iframe separately forbids scripts and navigation.
  const html = rendered.html.replace('<head>', '<head><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src https://static.wixstatic.com https://pxpressllc.com; form-action \'none\'; base-uri \'none\'">')
    .replace('<body ', '<body inert ');
  return { ...rendered, html, availabilityNote: followUp?.reason };
}
