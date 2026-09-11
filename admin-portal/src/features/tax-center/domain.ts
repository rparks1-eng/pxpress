import { csvRows } from '../../lib/csv';
import type { FinderUsageStatus, RideTaxRecordView, TaxAdjustmentViewEntry, TaxCenterFilingConfiguration, TaxLedgerViewEntry } from './types';

export interface TaxCenterSnapshot {
  filingPeriod: string;
  taxableSalesMinor: number;
  taxCollectedMinor: number;
  fundsReservedMinor: number | null;
  varianceMinor: number | null;
  exceptionCount: number;
  adjustmentCount: number;
  manualReviewAdjustmentCount: number;
  byJurisdiction: Array<{ jurisdiction: string; taxableSalesMinor: number; taxMinor: number }>;
  zeroReturnReminder: boolean;
}

const nextDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 12));

export function planningFilingDueDate(period: string, frequency: TaxCenterFilingConfiguration['assignedFrequency']) {
  let year: number;
  let monthIndex: number;
  if (frequency === 'monthly') {
    const match = /^(\d{4})-(\d{2})$/.exec(period);
    if (!match) throw new Error('Invalid monthly filing period.');
    year = Number(match[1]);
    monthIndex = Number(match[2]);
  } else {
    const match = /^(\d{4})-H([12])$/.exec(period);
    if (!match) throw new Error('Invalid semiannual filing period.');
    year = Number(match[1]);
    monthIndex = match[2] === '1' ? 6 : 12;
  }
  let due = new Date(Date.UTC(year, monthIndex, 23, 12));
  while (due.getUTCDay() === 0 || due.getUTCDay() === 6) due = nextDay(due);
  return due.toISOString().slice(0, 10);
}

const currentPeriod = (asOf: string, frequency: TaxCenterFilingConfiguration['assignedFrequency']) => {
  const year = asOf.slice(0, 4);
  const month = Number(asOf.slice(5, 7));
  return frequency === 'monthly' ? asOf.slice(0, 7) : `${year}-H${month <= 6 ? '1' : '2'}`;
};

function effectivePeriod(adjustment: TaxAdjustmentViewEntry, frequency: TaxCenterFilingConfiguration['assignedFrequency']) {
  return adjustment.adjustmentFilingPeriod ?? currentPeriod(adjustment.effectiveAt.slice(0, 10), frequency);
}

export function taxCenterSnapshot(entries: readonly TaxLedgerViewEntry[], adjustments: readonly TaxAdjustmentViewEntry[], config: TaxCenterFilingConfiguration, asOf: string, recordedReserveBalanceMinor: number | null = null): TaxCenterSnapshot {
  if (config.assignedFrequency === 'semiannual' && (!config.assignmentVerified || !config.assignmentSource?.trim())) throw new Error('Semiannual filing requires a verified Ohio assignment source.');
  const filingPeriod = currentPeriod(asOf, config.assignedFrequency);
  const periodEntries = entries.filter((entry) => entry.filingReady && entry.taxPointStatus === 'confirmed' && entry.reconciliationState === 'reconciled' && entry.filingPeriod === filingPeriod);
  const reviewEntries = entries.filter((entry) => !(entry.filingReady && entry.taxPointStatus === 'confirmed' && entry.reconciliationState === 'reconciled') && currentPeriod(entry.paidAt.slice(0, 10), config.assignedFrequency) === filingPeriod);
  const confirmedAdjustments = adjustments.filter((entry) => entry.filingReady && entry.taxTreatmentStatus === 'confirmed' && entry.adjustmentFilingPeriod === filingPeriod);
  const reviewAdjustments = adjustments.filter((entry) => !entry.filingReady && entry.taxTreatmentStatus === 'manual_review' && effectivePeriod(entry, config.assignedFrequency) === filingPeriod);
  const taxableSalesMinor = periodEntries.reduce((sum, entry) => sum + entry.taxableSubtotalMinor, 0) + confirmedAdjustments.reduce((sum, entry) => sum + entry.taxableSubtotalDeltaMinor, 0);
  const taxCollectedMinor = periodEntries.reduce((sum, entry) => sum + entry.taxMinor, 0) + confirmedAdjustments.reduce((sum, entry) => sum + entry.taxDeltaMinor, 0);
  const jurisdictions = new Map<string, { jurisdiction: string; taxableSalesMinor: number; taxMinor: number }>();
  for (const entry of periodEntries) {
    const value = jurisdictions.get(entry.jurisdictionLabel) ?? { jurisdiction: entry.jurisdictionLabel, taxableSalesMinor: 0, taxMinor: 0 };
    value.taxableSalesMinor += entry.taxableSubtotalMinor;
    value.taxMinor += entry.taxMinor;
    jurisdictions.set(entry.jurisdictionLabel, value);
  }
  for (const adjustment of confirmedAdjustments) {
    const value = jurisdictions.get(adjustment.jurisdictionLabel) ?? { jurisdiction: adjustment.jurisdictionLabel, taxableSalesMinor: 0, taxMinor: 0 };
    value.taxableSalesMinor += adjustment.taxableSubtotalDeltaMinor;
    value.taxMinor += adjustment.taxDeltaMinor;
    jurisdictions.set(adjustment.jurisdictionLabel, value);
  }
  const fundsReservedMinor = recordedReserveBalanceMinor !== null && Number.isSafeInteger(recordedReserveBalanceMinor) && recordedReserveBalanceMinor >= 0 ? recordedReserveBalanceMinor : null;
  return {
    filingPeriod, taxableSalesMinor, taxCollectedMinor, fundsReservedMinor,
    varianceMinor: fundsReservedMinor === null ? null : fundsReservedMinor - taxCollectedMinor,
    exceptionCount: reviewEntries.length + reviewAdjustments.length,
    adjustmentCount: confirmedAdjustments.length, manualReviewAdjustmentCount: reviewAdjustments.length,
    byJurisdiction: [...jurisdictions.values()].sort((a, b) => b.taxMinor - a.taxMinor),
    zeroReturnReminder: periodEntries.length === 0 && confirmedAdjustments.length === 0,
  };
}

export function finderReadinessSummary(finder: FinderUsageStatus) {
  const missing = Object.entries(finder.stages).filter(([, ready]) => !ready).map(([stage]) => stage);
  return { ready: finder.availability === 'ready' && finder.connected && missing.length === 0, missing };
}

export function taxLedgerToCsv(entries: readonly TaxLedgerViewEntry[], adjustments: readonly TaxAdjustmentViewEntry[], rideRecords: readonly RideTaxRecordView[] = []): string {
  const headings = ['Record type', 'Record ID', 'Ride request ID', 'Public reference', 'Guest label', 'Service', 'Ride date', 'Payment status', 'Filing status', 'Tax point status', 'Tax point at', 'Original filing period', 'Adjustment filing period', 'Jurisdiction', 'Rate basis points', 'Service subtotal cents', 'Tax cents', 'Total cents', 'Eligible for filing totals', 'Exclusion reason', 'Adjustment or refund summary', 'Source and readiness evidence'];
  const rideRows = rideRecords.map((record) => ['ride_tax_record', record.publicReference, record.rideRequestId, record.publicReference, record.guestLabel, record.serviceLabel, record.rideDate, record.paymentStatus, record.filingStatus, record.taxPointStatus, record.taxPointAt ?? '', record.filingPeriod ?? '', '', record.jurisdictionLabel, record.rateBasisPoints, record.serviceSubtotalMinor, record.taxMinor, record.totalMinor, record.eligibleForFiling, record.exclusionReason ?? '', JSON.stringify(record.adjustmentSummary), JSON.stringify(record.sourceReadiness)]);
  const adjustmentRows = adjustments.map((entry) => ['adjustment', entry.id, entry.ledgerEntryId, '', '', '', entry.effectiveAt.slice(0, 10), '', entry.filingReady ? 'filing_ready' : 'manual_review', entry.taxTreatmentStatus, entry.effectiveAt, entry.originalFilingPeriod ?? '', entry.adjustmentFilingPeriod ?? '', entry.jurisdictionLabel, '', entry.taxableSubtotalDeltaMinor, entry.taxDeltaMinor, entry.totalDeltaMinor, entry.filingReady && entry.taxTreatmentStatus === 'confirmed', entry.manualReviewReason ?? entry.reason, entry.kind, 'append_only_adjustment_ledger']);
  const unresolvedWithoutRideProjection = entries.filter((entry) => !rideRecords.some((record) => record.sourceReadiness.ledgerEntryId === entry.id)).map((entry) => ['ledger_audit_only', entry.id, '', '', '', '', entry.paidAt.slice(0, 10), 'paid', entry.filingReady ? 'filing_ready' : 'manual_review', entry.taxPointStatus, entry.taxPointAt ?? '', entry.filingPeriod ?? '', '', entry.jurisdictionLabel, '', entry.taxableSubtotalMinor, entry.taxMinor, entry.totalMinor, entry.filingReady && entry.taxPointStatus === 'confirmed' && entry.reconciliationState === 'reconciled', entry.manualReviewReason ?? '', '', entry.reconciliationState]);
  return csvRows([headings, ...rideRows, ...unresolvedWithoutRideProjection, ...adjustmentRows]);
}
