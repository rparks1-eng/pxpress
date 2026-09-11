import { describe, expect, it } from 'vitest';
import { finderReadinessSummary, planningFilingDueDate, taxCenterSnapshot, taxLedgerToCsv } from './domain';
import type { FinderUsageStatus, RideTaxRecordView, TaxAdjustmentViewEntry, TaxLedgerViewEntry } from './types';

const entry: TaxLedgerViewEntry = {
  id: 'ledger-1', paidAt: '2026-09-02T13:00:00Z', taxPointStatus: 'confirmed',
  taxPointAt: '2026-09-04T13:00:00Z', taxPointBasis: 'service_completed', filingPeriod: '2026-09', filingReady: true,
  jurisdictionLabel: 'Summit County', taxableSubtotalMinor: 11_628, taxMinor: 872,
  totalMinor: 12_500, reconciliationState: 'reconciled',
};

const confirmedAdjustment: TaxAdjustmentViewEntry = {
  id: 'adjust-1', ledgerEntryId: 'ledger-1', kind: 'partial_refund', taxTreatmentStatus: 'confirmed',
  taxableSubtotalDeltaMinor: -2_000, taxDeltaMinor: -150, totalDeltaMinor: -2_150,
  effectiveAt: '2026-10-03T13:00:00Z', originalFilingPeriod: '2026-09', adjustmentFilingPeriod: '2026-10',
  jurisdictionLabel: 'Summit County', filingReady: true, reason: 'Partial service refund',
};

describe('Tax Center domain', () => {
  it('attributes confirmed cross-period adjustments to their adjustment period and jurisdiction', () => {
    expect(taxCenterSnapshot([entry], [confirmedAdjustment], { assignedFrequency: 'monthly', assignmentVerified: false }, '2026-09-04')).toMatchObject({
      filingPeriod: '2026-09', taxableSalesMinor: 11_628, taxCollectedMinor: 872, adjustmentCount: 0,
      manualReviewAdjustmentCount: 0, zeroReturnReminder: false,
    });
    expect(taxCenterSnapshot([entry], [confirmedAdjustment], { assignedFrequency: 'monthly', assignmentVerified: false }, '2026-10-04', 800)).toMatchObject({
      filingPeriod: '2026-10', taxableSalesMinor: -2_000, taxCollectedMinor: -150, fundsReservedMinor: 800,
      varianceMinor: 950, adjustmentCount: 1, manualReviewAdjustmentCount: 0, zeroReturnReminder: false,
      byJurisdiction: [{ jurisdiction: 'Summit County', taxableSalesMinor: -2_000, taxMinor: -150 }],
    });
  });

  it('excludes unconfirmed adjustments from totals and places them in manual review', () => {
    const manual: TaxAdjustmentViewEntry = {
      ...confirmedAdjustment, id: 'manual-1', taxTreatmentStatus: 'manual_review', filingReady: false,
      taxableSubtotalDeltaMinor: 0, taxDeltaMinor: 0, totalDeltaMinor: 0,
      adjustmentFilingPeriod: undefined, manualReviewReason: 'No-show tax treatment unconfirmed', kind: 'no_show_fee',
    };
    expect(taxCenterSnapshot([], [manual], { assignedFrequency: 'monthly', assignmentVerified: false }, '2026-10-04')).toMatchObject({
      taxableSalesMinor: 0, taxCollectedMinor: 0, adjustmentCount: 0, manualReviewAdjustmentCount: 1,
      exceptionCount: 1, zeroReturnReminder: true,
    });
  });

  it('excludes unresolved tax points from filing-ready totals', () => {
    const unresolved: TaxLedgerViewEntry = { ...entry, taxPointStatus: 'manual_review', taxPointAt: undefined, taxPointBasis: undefined, filingPeriod: undefined, filingReady: false, reconciliationState: 'exception', manualReviewReason: 'Tax point unresolved' };
    expect(taxCenterSnapshot([unresolved], [], { assignedFrequency: 'monthly', assignmentVerified: false }, '2026-09-04')).toMatchObject({ taxableSalesMinor: 0, taxCollectedMinor: 0, exceptionCount:1, zeroReturnReminder: true });
  });

  it('excludes paid records until filing and payment reconciliation is complete', () => {
    expect(taxCenterSnapshot([{ ...entry, reconciliationState:'pending' }], [], { assignedFrequency:'monthly', assignmentVerified:false }, '2026-09-04')).toMatchObject({ taxableSalesMinor:0, taxCollectedMinor:0, zeroReturnReminder:true });
  });

  it('requires the complete Finder activation matrix', () => {
    const partial:FinderUsageStatus={connected:false,availability:'partial',used:0,hardCap:200,cacheStatus:'empty',stages:{adapterEnabled:true,rateProviderEnabled:true,runtimeCredentialsReady:false,repositoryReady:true,sourcingConfirmed:false}};
    expect(finderReadinessSummary(partial)).toEqual({ready:false,missing:['runtimeCredentialsReady','sourcingConfirmed']});
    expect(finderReadinessSummary({...partial,connected:true,availability:'ready',stages:{adapterEnabled:true,rateProviderEnabled:true,runtimeCredentialsReady:true,repositoryReady:true,sourcingConfirmed:true}})).toEqual({ready:true,missing:[]});
  });

  it('shows a zero-return reminder and rejects an inferred semiannual schedule', () => {
    expect(taxCenterSnapshot([], [], { assignedFrequency: 'monthly', assignmentVerified: false }, '2026-09-04').zeroReturnReminder).toBe(true);
    expect(() => taxCenterSnapshot([], [], { assignedFrequency: 'semiannual', assignmentVerified: false }, '2026-09-04')).toThrow(/verified Ohio assignment/i);
  });

  it('uses day 23 and shifts a weekend for filing preparation', () => {
    expect(planningFilingDueDate('2026-09', 'monthly')).toBe('2026-10-23');
    expect(planningFilingDueDate('2026-12', 'monthly')).toBe('2027-01-25');
  });

  it('exports tax point and both filing periods and neutralizes spreadsheet formulas', () => {
    const csv = taxLedgerToCsv([{ ...entry, jurisdictionLabel: ' =CMD()' }], [{ ...confirmedAdjustment, reason: '@IMPORTDATA(x)' }]);
    expect(csv).toContain('Tax point at');
    expect(csv).toContain('Original filing period');
    expect(csv).toContain('Adjustment filing period');
    expect(csv).toContain("' =CMD()");
    expect(csv).toContain("'@IMPORTDATA(x)");
  });

  it('exports per-ride eligibility without customer contact or route PII', () => {
    const ride:RideTaxRecordView={rideRequestId:'ride-1',publicReference:'PXR-SAFE0001',guestLabel:'Guest · 0001',serviceLabel:'Airport',rideDate:'2026-09-02',paymentStatus:'unpaid',filingStatus:'pending',taxPointStatus:'not_recorded',jurisdictionLabel:'Summit County',rateBasisPoints:675,serviceSubtotalMinor:11628,taxMinor:872,totalMinor:12500,eligibleForFiling:false,exclusionReason:'Payment not verified.',adjustmentSummary:{confirmedSubtotalDeltaMinor:0,confirmedTaxDeltaMinor:0,confirmedTotalDeltaMinor:0,manualReviewCount:0,items:[]},sourceReadiness:{kind:'quote_tax_projection'}};
    const csv=taxLedgerToCsv([],[],[ride]);
    expect(csv).toContain('Eligible for filing totals');
    expect(csv).toContain('Payment not verified.');
    expect(csv).not.toMatch(/email|phone|pickup address|destination address/i);
  });
});
