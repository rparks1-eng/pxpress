import { describe, expect, it } from 'vitest';
import { buildFareApprovalAudit, exactCustomerTaxProjection, exactTaxProjectionForCustomerTotal, manualOwnerPriceDecision, manualOwnerTaxIncludedQuote, ownerPriceDecision, recommendFare, roundCustomerTotalUp, type FareRecommendationInput } from './domain';

const base: FareRecommendationInput = {
  serviceType: 'airport',
  routeLegs: [
    { kind: 'base_to_pickup', origin: '10273 Maryland St', destination: 'Pickup', miles: 12, driveMinutes: 20 },
    { kind: 'pickup_to_destination', origin: 'Pickup', destination: 'Destination', miles: 28, driveMinutes: 38 },
    { kind: 'return_to_base', origin: 'Destination', destination: '10273 Maryland St', miles: 30, driveMinutes: 40 },
  ],
  waitMinutes: 15, fuelCostPerMileMinor: 25, maintenanceCostPerMileMinor: 20,
  depreciationCostPerMileMinor: 30, tollsMinor: 500, parkingMinor: 1000, airportFeeMinor: 300,
  lateNightFeeMinor: 0, otherDirectCostMinor: 0, insuranceMonthlyMinor: 75_000,
  ownerCompensationAnnualMinor: 8_000_000, otherAnnualOverheadMinor: 1_200_000,
  capacityMode: 'rides', availableRidesPerYear: 1000,
  utilizationBasisPoints: 8000, desiredMarginBasisPoints: 2000,
  incomeTaxReserveEnabled: false, incomeTaxReserveBasisPoints: 2500,
  evaluatedAt: '2026-09-02T12:00:00.000Z',
};

describe('fare recommendation economics', () => {
  it('allocates $750 monthly insurance, $80k compensation, route legs, add-ons, utilization, and margin deterministically', () => {
    const result = recommendFare(base);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.route.totalMiles).toBe(70);
    expect(result.route.driveMinutes).toBe(98);
    expect(result.mileageCostMinor).toBe(5250);
    expect(result.addOnCostMinor).toBe(1800);
    expect(result.allocatedInsuranceMinor).toBe(1125);
    expect(result.allocatedOwnerCompensationMinor).toBe(10_000);
    expect(result.allocatedOtherOverheadMinor).toBe(1500);
    expect(result.economicCostMinor).toBe(19_675);
    expect(result.recommendedPreTaxMinor).toBe(24_594);
    expect(result.plannedProfitMinor).toBe(4919);
  });

  it('supports hour capacity, wait time, and an optional return leg', () => {
    const result = recommendFare({ ...base, capacityMode: 'billable_hours', availableBillableHoursPerYear: 1600, routeLegs: [...base.routeLegs, { kind: 'return_trip', origin: 'Destination', destination: 'Return stop', miles: 28, driveMinutes: 40 }] });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.route.totalMiles).toBe(98);
    expect(result.allocatedInsuranceMinor).toBeGreaterThan(0);
    expect(result.recommendedPreTaxMinor).toBeGreaterThan(result.economicCostMinor);
  });

  it('requires route and capacity instead of inventing assumptions', () => {
    expect(recommendFare({ ...base, routeLegs: [] })).toEqual({ status: 'configuration_required', code: 'ROUTE_REQUIRED' });
    expect(recommendFare({ ...base, availableRidesPerYear: 0 })).toEqual({ status: 'configuration_required', code: 'CAPACITY_REQUIRED' });
  });

  it('keeps income-tax reserve as planning only and outside customer sales tax', () => {
    const off = recommendFare(base);
    const on = recommendFare({ ...base, incomeTaxReserveEnabled: true });
    expect(off.status).toBe('ready'); expect(on.status).toBe('ready');
    if (off.status !== 'ready' || on.status !== 'ready') return;
    expect(on.recommendedPreTaxMinor).toBe(off.recommendedPreTaxMinor);
    expect(on.incomeTaxReservePlanningMinor).toBeGreaterThan(0);
    expect(on.incomeTaxReserveIncludedInCustomerTax).toBe(false);
  });

  it('labels missing and stale competitor evidence without changing economics', () => {
    const missing = recommendFare(base);
    const stale = recommendFare({ ...base, benchmark: { minimumMinor: 15000, maximumMinor: 22000, source: 'Owner phone quote log', observedDate: '2026-01-01' } });
    expect(missing.status).toBe('ready'); expect(stale.status).toBe('ready');
    if (missing.status !== 'ready' || stale.status !== 'ready') return;
    expect(missing.benchmarkStatus).toBe('missing');
    expect(stale.benchmarkStatus).toBe('stale');
    expect(stale.recommendedPreTaxMinor).toBe(missing.recommendedPreTaxMinor);
  });

  it('rounds only with the owner-selected $5 or $10 policy and preserves exact cents', () => {
    expect(roundCustomerTotalUp(15_001, 500)).toBe(15_500);
    expect(roundCustomerTotalUp(15_001, 1000)).toBe(16_000);
    expect(roundCustomerTotalUp(15_000, 500)).toBe(15_000);
    const projection = exactCustomerTaxProjection(15_001, 675, 500)!;
    expect(projection.recommendedPreTaxServiceMinor).toBe(15_001);
    expect(projection.recommendedPreTaxServiceMinor + projection.unroundedTaxMinor).toBe(projection.unroundedCustomerTotalMinor);
    expect(projection.unroundedCustomerTotalMinor + projection.roundingAdjustmentMinor).toBe(projection.customerTotalMinor);
    expect(projection.customerTotalMinor % 500).toBe(0);
    expect(projection.preTaxServiceSubtotalMinor + projection.salesTaxMinor).toBe(projection.customerTotalMinor);
  });

  it('splits the $5 canary total without guessing a rate or losing cents', () => {
    const projection = exactTaxProjectionForCustomerTotal(500, 675)!;
    expect(projection).toMatchObject({ preTaxServiceSubtotalMinor: 468, salesTaxMinor: 32, customerTotalMinor: 500, roundingAdjustmentMinor: 0 });
    expect(projection.preTaxServiceSubtotalMinor + projection.salesTaxMinor).toBe(500);
    expect(exactTaxProjectionForCustomerTotal(499, 675)).toBeUndefined();
    expect(exactTaxProjectionForCustomerTotal(550, 675)).toBeUndefined();
  });

  it('rounds a non-multiple final total upward and then recomputes the tax-exclusive cents',()=>{
    const noTax=manualOwnerTaxIncludedQuote(5134,0)!;
    expect(noTax).toMatchObject({serviceSubtotalMinor:5500,salesTaxMinor:0,customerTotalMinor:5500,roundingIncrementMinor:500});
    const taxed=manualOwnerTaxIncludedQuote(4801,6.75)!;
    expect(taxed.customerTotalMinor%500).toBe(0);
    expect(taxed.serviceSubtotalMinor+taxed.salesTaxMinor).toBe(taxed.customerTotalMinor);
    expect(manualOwnerPriceDecision(taxed).manualTaxQuote).toEqual(taxed);
  });

  it('uses the entered final customer price and splits tax back out exactly once',()=>{
    // $75 at 6.75% stays $75. The $4.74 tax is inside that total.
    const quote=manualOwnerTaxIncludedQuote(7500,6.75)!;
    expect(quote).toMatchObject({inputSemantics:'final_customer_total_tax_included',enteredCustomerTotalMinor:7500,customerTotalMinor:7500,serviceSubtotalMinor:7026,salesTaxMinor:474,roundingIncrementMinor:500});
    expect(quote.serviceSubtotalMinor+quote.salesTaxMinor).toBe(quote.customerTotalMinor);
    expect(quote.customerTotalMinor%500).toBe(0);
  });

  it('keeps exact $5 totals unchanged and always rounds non-multiples upward',()=>{
    expect(manualOwnerTaxIncludedQuote(5000,0)).toMatchObject({customerTotalMinor:5000,serviceSubtotalMinor:5000,salesTaxMinor:0});
    // $51.34 is closer to $50 than $55, proving this is not nearest-$5 rounding.
    expect(manualOwnerTaxIncludedQuote(5134,0)).toMatchObject({customerTotalMinor:5500,serviceSubtotalMinor:5500,salesTaxMinor:0});
    for (const total of [5000,5500,8500]) expect(total%500).toBe(0);
  });

  it('rejects zero final totals, negative and non-finite manual rates',()=>{
    expect(manualOwnerTaxIncludedQuote(0,0)).toBeUndefined();
    expect(manualOwnerTaxIncludedQuote(100,-0.01)).toBeUndefined();
    expect(manualOwnerTaxIncludedQuote(100,Number.NaN)).toBeUndefined();
    expect(manualOwnerTaxIncludedQuote(100,Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('uses the stated inclusive split after rounding and preserves the final total',()=>{
    const quote=manualOwnerTaxIncludedQuote(7600,6.75)!;
    expect(quote).toMatchObject({customerTotalMinor:8000,serviceSubtotalMinor:7494,salesTaxMinor:506});
    expect(quote.serviceSubtotalMinor+quote.salesTaxMinor).toBe(quote.customerTotalMinor);
  });

  it('rejects tax-backed approvals below $5 or outside a $5 customer-total increment', () => {
    const baseProjection = {schemaVersion:'pxpress-approved-tax-projection-v1' as const,finderAuditId:'00000000-0000-4000-8000-000000000001',serviceSubtotalMinor:468,salesTaxMinor:32,customerTotalMinor:500,recommendedPreTaxServiceMinor:468,unroundedTaxMinor:32,unroundedCustomerTotalMinor:500,roundingAdjustmentMinor:0,rateBasisPoints:675,jurisdiction:{countryCode:'US',subdivisionCode:'OH'},jurisdictionLabel:'Summit County',source:'Ohio Department of Taxation Finder',sourceReference:'Finder evidence',effectiveDate:'2026-09-04',lookupStatus:'lookup' as const,observedAt:'2026-09-04T12:00:00Z',expiresAt:'2026-09-05T12:00:00Z',taxGroupId:'00000000-0000-4000-8000-000000000002',providerTaxMode:'wix-calculates-once-from-tax-exclusive-subtotal' as const};
    expect(ownerPriceDecision(468,baseProjection).customerTotalMinor).toBe(500);
    expect(()=>ownerPriceDecision(374,{...baseProjection,serviceSubtotalMinor:374,salesTaxMinor:26,customerTotalMinor:400,recommendedPreTaxServiceMinor:374,unroundedTaxMinor:26,unroundedCustomerTotalMinor:400})).toThrow(/verified tax projection/i);
    expect(()=>ownerPriceDecision(514,{...baseProjection,serviceSubtotalMinor:514,salesTaxMinor:36,customerTotalMinor:550,recommendedPreTaxServiceMinor:514,unroundedTaxMinor:36,unroundedCustomerTotalMinor:550})).toThrow(/verified tax projection/i);
  });

  it('records explicit owner edits in approval audit', () => {
    const result = recommendFare(base);
    if (result.status !== 'ready') throw new Error('expected recommendation');
    expect(buildFareApprovalAudit(result, 'request-1', 25_000, 'owner-user', '2026-09-02T13:00:00.000Z')).toMatchObject({ ownerEdited: true, recommendationMinor: 24_594, approvedPreTaxMinor: 25_000 });
  });
});
