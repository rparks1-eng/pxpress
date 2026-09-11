export type TaxLedgerReconciliationState = 'pending' | 'reconciled' | 'exception';
export type TaxAdjustmentKind = 'partial_refund' | 'full_refund' | 'void' | 'correction' | 'retained_fee' | 'cancellation_fee' | 'no_show_fee';

export interface TaxLedgerViewEntry {
  id: string;
  paidAt: string;
  taxPointStatus: 'confirmed' | 'manual_review';
  taxPointAt?: string;
  taxPointBasis?: 'payment_received' | 'service_completed' | 'other_confirmed';
  filingPeriod?: string;
  filingReady: boolean;
  jurisdictionLabel: string;
  taxableSubtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  reconciliationState: TaxLedgerReconciliationState;
  manualReviewReason?: string;
}

export interface TaxAdjustmentViewEntry {
  id: string;
  ledgerEntryId: string;
  kind: TaxAdjustmentKind;
  taxTreatmentStatus: 'confirmed' | 'manual_review';
  taxableSubtotalDeltaMinor: number;
  taxDeltaMinor: number;
  totalDeltaMinor: number;
  effectiveAt: string;
  originalFilingPeriod?: string;
  adjustmentFilingPeriod?: string;
  jurisdictionLabel: string;
  filingReady: boolean;
  reason: string;
  manualReviewReason?: string;
}

export interface TaxCenterFilingConfiguration {
  assignedFrequency: 'monthly' | 'semiannual';
  assignmentVerified: boolean;
  assignmentSource?: string;
}

export interface FinderUsageStatus {
  connected: boolean;
  availability: 'unavailable' | 'partial' | 'ready';
  used: number | null;
  hardCap: 200;
  cacheStatus: 'hit' | 'miss' | 'empty' | 'unavailable';
  stages: {
    adapterEnabled: boolean;
    rateProviderEnabled: boolean;
    runtimeCredentialsReady: boolean;
    repositoryReady: boolean;
    sourcingConfirmed: boolean;
  };
  providerVersion?: string;
  lastObservedAt?: string;
  expiresAt?: string;
  sourceReference?: string;
}

export interface RideTaxAdjustmentSummary {
  confirmedSubtotalDeltaMinor: number;
  confirmedTaxDeltaMinor: number;
  confirmedTotalDeltaMinor: number;
  manualReviewCount: number;
  items: Array<{
    kind: TaxAdjustmentKind;
    filingReady: boolean;
    taxTreatmentStatus: 'confirmed' | 'manual_review';
    originalFilingPeriod?: string;
    adjustmentFilingPeriod?: string;
    subtotalDeltaMinor: number;
    taxDeltaMinor: number;
    totalDeltaMinor: number;
    reason: string;
    manualReviewReason?: string;
  }>;
}

export interface RideTaxRecordView {
  rideRequestId: string;
  publicReference: string;
  guestLabel: string;
  serviceLabel: string;
  rideDate: string;
  paymentStatus: 'unpaid' | 'authorized' | 'paid' | 'refunded' | 'void';
  filingStatus: 'filing_ready' | 'manual_review' | 'pending' | 'voided';
  taxPointStatus: 'confirmed' | 'manual_review' | 'not_recorded';
  taxPointAt?: string;
  filingPeriod?: string;
  jurisdictionLabel: string;
  rateBasisPoints: number;
  serviceSubtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  eligibleForFiling: boolean;
  exclusionReason?: string;
  adjustmentSummary: RideTaxAdjustmentSummary;
  sourceReadiness: Record<string, unknown>;
}

export interface TransportationSourcingStatus {
  confirmed: boolean;
  sourceReference?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface PricingAssumptionStatus {
  status: 'not_saved' | 'current' | 'stale';
  modelVersion?: string;
  reviewedAt?: string;
}
