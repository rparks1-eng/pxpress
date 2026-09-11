export const PXPRESS_CANONICAL_SERVICES_URL =
  'https://pxpressllc.com/services' as const;

export const RESERVE_A_RIDE_CTA = {
  label: 'Reserve a Ride',
  url: PXPRESS_CANONICAL_SERVICES_URL,
} as const;

export type PlannedFollowUpKind =
  | 'post_ride_thank_you'
  | 'review_submission_confirmation';

export interface PlannedFollowUpContract {
  status: 'implemented_disabled';
  kind: PlannedFollowUpKind;
  subject: string;
  cta: typeof RESERVE_A_RIDE_CTA;
  effectType: 'customer_post_ride_thank_you' | 'customer_feedback_receipt';
  reason: string;
}

const FOLLOW_UPS: Record<PlannedFollowUpKind, PlannedFollowUpContract> = {
  post_ride_thank_you: {
    status: 'implemented_disabled',
    kind: 'post_ride_thank_you',
    subject: 'Thank you for riding with Pxpress',
    cta: RESERVE_A_RIDE_CTA,
    effectType: 'customer_post_ride_thank_you',
    reason: 'The replay-safe effect and template exist. Broad provider delivery remains disabled; only a separate exact-ride, exact-recipient owner canary may exercise this message.',
  },
  review_submission_confirmation: {
    status: 'implemented_disabled',
    kind: 'review_submission_confirmation',
    subject: 'Thank you for your Pxpress feedback',
    cta: RESERVE_A_RIDE_CTA,
    effectType: 'customer_feedback_receipt',
    reason: 'The replay-safe database effect and template exist, but the provider delivery lane remains disabled pending activation evidence.',
  },
};

export function plannedFollowUpContract(kind: PlannedFollowUpKind): PlannedFollowUpContract {
  return {
    ...FOLLOW_UPS[kind],
    cta: { ...FOLLOW_UPS[kind].cta },
  };
}
