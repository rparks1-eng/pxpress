export const PXPRESS_BASE_ADDRESS = '10273 Maryland St, Reminderville, OH 44202' as const;
export const DEFAULT_INSURANCE_MONTHLY_MINOR = 75_000 as const;
export const DEFAULT_OWNER_COMPENSATION_ANNUAL_MINOR = 8_000_000 as const;
export const FARE_MODEL_VERSION = 'pxpress-fare-recommendation-v1' as const;

export type RoundingIncrement = 500 | 1000;
export type CapacityMode = 'rides' | 'billable_hours';

export interface FareRouteLeg {
  kind: 'base_to_pickup' | 'pickup_to_destination' | 'return_trip' | 'return_to_base';
  origin: string;
  destination: string;
  miles: number;
  driveMinutes: number;
}

export interface FareBenchmark {
  minimumMinor: number;
  maximumMinor: number;
  source: string;
  observedDate: string;
}

export interface FareRecommendationInput {
  serviceType: string;
  routeLegs: FareRouteLeg[];
  waitMinutes: number;
  fuelCostPerMileMinor: number;
  maintenanceCostPerMileMinor: number;
  depreciationCostPerMileMinor: number;
  tollsMinor: number;
  parkingMinor: number;
  airportFeeMinor: number;
  lateNightFeeMinor: number;
  otherDirectCostMinor: number;
  insuranceMonthlyMinor: number;
  ownerCompensationAnnualMinor: number;
  otherAnnualOverheadMinor: number;
  capacityMode: CapacityMode;
  availableRidesPerYear?: number;
  availableBillableHoursPerYear?: number;
  utilizationBasisPoints: number;
  desiredMarginBasisPoints: number;
  incomeTaxReserveEnabled: boolean;
  incomeTaxReserveBasisPoints: number;
  benchmark?: FareBenchmark;
  evaluatedAt: string;
}

export interface FareRecommendation {
  schemaVersion: typeof FARE_MODEL_VERSION;
  status: 'ready';
  currency: 'USD';
  serviceType: string;
  route: { baseAddress: typeof PXPRESS_BASE_ADDRESS; totalMiles: number; driveMinutes: number; waitMinutes: number; legs: FareRouteLeg[] };
  directRideCostMinor: number;
  mileageCostMinor: number;
  addOnCostMinor: number;
  allocatedInsuranceMinor: number;
  allocatedOtherOverheadMinor: number;
  allocatedOwnerCompensationMinor: number;
  economicCostMinor: number;
  recommendedPreTaxMinor: number;
  plannedProfitMinor: number;
  incomeTaxReservePlanningMinor: number;
  incomeReserveEnabled: boolean;
  incomeTaxReserveEnabled: boolean;
  incomeTaxReserveIncludedInCustomerTax: false;
  benchmarkStatus: 'missing' | 'current' | 'stale';
  benchmark?: FareBenchmark;
  assumptions: FareRecommendationInput;
}

export type FareRecommendationResult = FareRecommendation | {
  status: 'configuration_required';
  code: 'INVALID_INPUT' | 'CAPACITY_REQUIRED' | 'ROUTE_REQUIRED';
};

const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const nonnegativeMinor = (value: number) => Number.isSafeInteger(value) && value >= 0;
const validDate = (value: string) => Number.isFinite(Date.parse(value));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function allocationShare(input: FareRecommendationInput, rideHours: number): number | undefined {
  const utilization = input.utilizationBasisPoints / 10_000;
  if (utilization <= 0 || utilization > 1) return undefined;
  if (input.capacityMode === 'rides') {
    const rides = input.availableRidesPerYear ?? 0;
    return Number.isFinite(rides) && rides > 0 ? 1 / (rides * utilization) : undefined;
  }
  const hours = input.availableBillableHoursPerYear ?? 0;
  return Number.isFinite(hours) && hours > 0 && rideHours > 0 ? rideHours / (hours * utilization) : undefined;
}

export function recommendFare(input: FareRecommendationInput): FareRecommendationResult {
  if (!input.routeLegs.length) return { status: 'configuration_required', code: 'ROUTE_REQUIRED' };
  const numeric = [input.waitMinutes, input.fuelCostPerMileMinor, input.maintenanceCostPerMileMinor,
    input.depreciationCostPerMileMinor, input.tollsMinor, input.parkingMinor, input.airportFeeMinor,
    input.lateNightFeeMinor, input.otherDirectCostMinor, input.insuranceMonthlyMinor,
    input.ownerCompensationAnnualMinor, input.otherAnnualOverheadMinor];
  const minorValues = numeric.slice(1);
  if (
    !input.serviceType.trim() || !validDate(input.evaluatedAt) || !nonnegative(input.waitMinutes) ||
    !minorValues.every(nonnegativeMinor) ||
    !Number.isInteger(input.utilizationBasisPoints) || input.utilizationBasisPoints <= 0 || input.utilizationBasisPoints > 10_000 ||
    !Number.isInteger(input.desiredMarginBasisPoints) || input.desiredMarginBasisPoints < 0 || input.desiredMarginBasisPoints >= 9_500 ||
    !Number.isInteger(input.incomeTaxReserveBasisPoints) || input.incomeTaxReserveBasisPoints < 0 || input.incomeTaxReserveBasisPoints > 10_000 ||
    input.routeLegs.some((leg) => !leg.origin.trim() || !leg.destination.trim() || !nonnegative(leg.miles) || !nonnegative(leg.driveMinutes))
  ) return { status: 'configuration_required', code: 'INVALID_INPUT' };

  const totalMiles = sum(input.routeLegs.map((leg) => leg.miles));
  const driveMinutes = sum(input.routeLegs.map((leg) => leg.driveMinutes));
  if (totalMiles <= 0 || driveMinutes <= 0) return { status: 'configuration_required', code: 'ROUTE_REQUIRED' };
  const rideHours = (driveMinutes + input.waitMinutes) / 60;
  const share = allocationShare(input, rideHours);
  if (!share) return { status: 'configuration_required', code: 'CAPACITY_REQUIRED' };

  const perMileMinor = input.fuelCostPerMileMinor + input.maintenanceCostPerMileMinor + input.depreciationCostPerMileMinor;
  const mileageCostMinor = Math.ceil(totalMiles * perMileMinor);
  const addOnCostMinor = input.tollsMinor + input.parkingMinor + input.airportFeeMinor + input.lateNightFeeMinor + input.otherDirectCostMinor;
  const directRideCostMinor = mileageCostMinor + addOnCostMinor;
  const allocatedInsuranceMinor = Math.ceil(input.insuranceMonthlyMinor * 12 * share);
  const allocatedOtherOverheadMinor = Math.ceil(input.otherAnnualOverheadMinor * share);
  const allocatedOwnerCompensationMinor = Math.ceil(input.ownerCompensationAnnualMinor * share);
  const economicCostMinor = directRideCostMinor + allocatedInsuranceMinor + allocatedOtherOverheadMinor + allocatedOwnerCompensationMinor;
  const recommendedPreTaxMinor = Math.ceil(economicCostMinor / (1 - input.desiredMarginBasisPoints / 10_000));
  const plannedProfitMinor = recommendedPreTaxMinor - economicCostMinor;
  const incomeTaxReservePlanningMinor = input.incomeTaxReserveEnabled
    ? Math.ceil((allocatedOwnerCompensationMinor + plannedProfitMinor) * input.incomeTaxReserveBasisPoints / 10_000)
    : 0;
  let benchmarkStatus: FareRecommendation['benchmarkStatus'] = 'missing';
  if (input.benchmark) {
    const observed = Date.parse(`${input.benchmark.observedDate}T12:00:00Z`);
    const ageDays = (Date.parse(input.evaluatedAt) - observed) / 86_400_000;
    benchmarkStatus = !input.benchmark.source.trim() || !Number.isSafeInteger(input.benchmark.minimumMinor) ||
      !Number.isSafeInteger(input.benchmark.maximumMinor) || input.benchmark.minimumMinor < 0 ||
      input.benchmark.maximumMinor < input.benchmark.minimumMinor || !Number.isFinite(observed) || ageDays < 0 || ageDays > 90
      ? 'stale' : 'current';
  }
  return {
    schemaVersion: FARE_MODEL_VERSION, status: 'ready', currency: 'USD', serviceType: input.serviceType,
    route: { baseAddress: PXPRESS_BASE_ADDRESS, totalMiles, driveMinutes, waitMinutes: input.waitMinutes, legs: input.routeLegs.map((leg) => ({ ...leg })) },
    directRideCostMinor, mileageCostMinor, addOnCostMinor, allocatedInsuranceMinor,
    allocatedOtherOverheadMinor, allocatedOwnerCompensationMinor, economicCostMinor,
    recommendedPreTaxMinor, plannedProfitMinor, incomeTaxReservePlanningMinor,
    incomeReserveEnabled: input.incomeTaxReserveEnabled,
    incomeTaxReserveEnabled: input.incomeTaxReserveEnabled,
    incomeTaxReserveIncludedInCustomerTax: false, benchmarkStatus,
    ...(input.benchmark ? { benchmark: { ...input.benchmark } } : {}), assumptions: structuredClone(input),
  };
}

export function roundCustomerTotalUp(amountMinor: number, increment: RoundingIncrement): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0 || ![500, 1000].includes(increment)) throw new RangeError('Invalid rounding input.');
  return Math.ceil(amountMinor / increment) * increment;
}

export interface ManualOwnerTaxQuote {
  sourceKind: 'owner_entered_manual';
  inputSemantics: 'final_customer_total_tax_included';
  enteredCustomerTotalMinor: number;
  rateBasisPoints: number;
  serviceSubtotalMinor: number;
  salesTaxMinor: number;
  customerTotalMinor: number;
  roundingIncrementMinor: 500;
}

/** The owner enters the final customer total. Tax is already inside that price. */
export function manualOwnerTaxIncludedQuote(enteredCustomerTotalMinor: number, ratePercent: number): ManualOwnerTaxQuote | undefined {
  if (!Number.isSafeInteger(enteredCustomerTotalMinor) || enteredCustomerTotalMinor <= 0 || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 30) return undefined;
  const rateBasisPoints = Math.round(ratePercent * 100);
  if (!Number.isSafeInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 3_000) return undefined;
  // Preserve an exact $5 total. Only a non-multiple moves up before tax is split.
  const customerTotalMinor = roundCustomerTotalUp(enteredCustomerTotalMinor, 500);
  const serviceSubtotalMinor = Math.round(customerTotalMinor * 10_000 / (10_000 + rateBasisPoints));
  return { sourceKind: 'owner_entered_manual', inputSemantics: 'final_customer_total_tax_included', enteredCustomerTotalMinor, rateBasisPoints, serviceSubtotalMinor, salesTaxMinor: customerTotalMinor - serviceSubtotalMinor, customerTotalMinor, roundingIncrementMinor: 500 };
}

export function exactCustomerTaxProjection(preTaxMinor: number, rateBasisPoints: number, increment: RoundingIncrement) {
  if (!Number.isSafeInteger(preTaxMinor) || preTaxMinor <= 0 || !Number.isInteger(rateBasisPoints) || rateBasisPoints <= 0 || rateBasisPoints > 3000) return undefined;
  const unroundedTaxMinor = Math.floor((preTaxMinor * rateBasisPoints + 5_000) / 10_000);
  const totalMinor = roundCustomerTotalUp(preTaxMinor + unroundedTaxMinor, increment);
  let low = 1;
  let high = totalMinor;
  while (low <= high) {
    const subtotalMinor = Math.floor((low + high) / 2);
    const taxMinor = Math.floor((subtotalMinor * rateBasisPoints + 5_000) / 10_000);
    if (subtotalMinor + taxMinor === totalMinor) {
      return {
        recommendedPreTaxServiceMinor: preTaxMinor,
        unroundedTaxMinor,
        unroundedCustomerTotalMinor: preTaxMinor + unroundedTaxMinor,
        preTaxServiceSubtotalMinor: subtotalMinor,
        salesTaxMinor: taxMinor,
        customerTotalMinor: totalMinor,
        roundingAdjustmentMinor: totalMinor - preTaxMinor - unroundedTaxMinor,
      };
    }
    if (subtotalMinor + taxMinor < totalMinor) low = subtotalMinor + 1;
    else high = subtotalMinor - 1;
  }
  return undefined;
}

/**
 * Splits an already-selected customer total into a tax-exclusive subtotal and
 * sales tax. This is used only by the exact $5 canary: it never guesses a rate
 * and it never turns the tax-inclusive total back into base fare.
 */
export function exactTaxProjectionForCustomerTotal(customerTotalMinor: number, rateBasisPoints: number) {
  if (!Number.isSafeInteger(customerTotalMinor) || customerTotalMinor < 500 || customerTotalMinor % 500 !== 0 ||
    !Number.isInteger(rateBasisPoints) || rateBasisPoints <= 0 || rateBasisPoints > 3000) return undefined;
  let low = 1;
  let high = customerTotalMinor;
  while (low <= high) {
    const serviceSubtotalMinor = Math.floor((low + high) / 2);
    const salesTaxMinor = Math.floor((serviceSubtotalMinor * rateBasisPoints + 5_000) / 10_000);
    const total = serviceSubtotalMinor + salesTaxMinor;
    if (total === customerTotalMinor) {
      return {
        recommendedPreTaxServiceMinor: serviceSubtotalMinor,
        unroundedTaxMinor: salesTaxMinor,
        unroundedCustomerTotalMinor: customerTotalMinor,
        preTaxServiceSubtotalMinor: serviceSubtotalMinor,
        salesTaxMinor,
        customerTotalMinor,
        roundingAdjustmentMinor: 0,
      };
    }
    if (total < customerTotalMinor) low = serviceSubtotalMinor + 1;
    else high = serviceSubtotalMinor - 1;
  }
  return undefined;
}

export interface ApprovedTaxProjection {
  schemaVersion: 'pxpress-approved-tax-projection-v1';
  finderAuditId: string;
  serviceSubtotalMinor: number;
  salesTaxMinor: number;
  customerTotalMinor: number;
  recommendedPreTaxServiceMinor: number;
  unroundedTaxMinor: number;
  unroundedCustomerTotalMinor: number;
  roundingAdjustmentMinor: number;
  rateBasisPoints: number;
  jurisdiction: Record<string, string>;
  jurisdictionLabel: string;
  source: string;
  sourceReference: string;
  effectiveDate: string;
  lookupStatus: 'lookup' | 'cached';
  observedAt: string;
  expiresAt: string;
  taxGroupId: string;
  providerTaxMode: 'wix-calculates-once-from-tax-exclusive-subtotal';
}

export type OwnerPriceDecision = {
  currency: 'USD';
  serviceSubtotalMinor: number;
  salesTaxMinor: number;
  customerTotalMinor: number;
  taxProjection?: ApprovedTaxProjection;
  manualTaxQuote?: ManualOwnerTaxQuote;
};

export function manualOwnerPriceDecision(quote: ManualOwnerTaxQuote): OwnerPriceDecision {
  if (quote.serviceSubtotalMinor <= 0 || quote.salesTaxMinor < 0 || quote.serviceSubtotalMinor + quote.salesTaxMinor !== quote.customerTotalMinor || quote.customerTotalMinor % 500 !== 0) throw new RangeError('The manual tax-inclusive quote does not reconcile.');
  return { currency: 'USD', serviceSubtotalMinor: quote.serviceSubtotalMinor, salesTaxMinor: quote.salesTaxMinor, customerTotalMinor: quote.customerTotalMinor, manualTaxQuote: { ...quote } };
}

export function ownerPriceDecision(serviceSubtotalMinor: number, taxProjection?: ApprovedTaxProjection): OwnerPriceDecision {
  if (!Number.isSafeInteger(serviceSubtotalMinor) || serviceSubtotalMinor <= 0) throw new RangeError('A positive service subtotal is required.');
  if (!taxProjection) return { currency: 'USD', serviceSubtotalMinor, salesTaxMinor: 0, customerTotalMinor: serviceSubtotalMinor };
  if (
    taxProjection.schemaVersion !== 'pxpress-approved-tax-projection-v1' ||
    taxProjection.serviceSubtotalMinor !== serviceSubtotalMinor ||
    taxProjection.serviceSubtotalMinor + taxProjection.salesTaxMinor !== taxProjection.customerTotalMinor ||
    taxProjection.recommendedPreTaxServiceMinor + taxProjection.unroundedTaxMinor !== taxProjection.unroundedCustomerTotalMinor ||
    taxProjection.unroundedCustomerTotalMinor + taxProjection.roundingAdjustmentMinor !== taxProjection.customerTotalMinor ||
    taxProjection.customerTotalMinor < 500 || taxProjection.customerTotalMinor % 500 !== 0 ||
    !taxProjection.taxGroupId ||
    taxProjection.providerTaxMode !== 'wix-calculates-once-from-tax-exclusive-subtotal' ||
    !taxProjection.finderAuditId || !taxProjection.sourceReference.trim() || !taxProjection.jurisdictionLabel.trim()
  ) throw new RangeError('The verified tax projection does not match the service subtotal.');
  return {
    currency: 'USD',
    serviceSubtotalMinor,
    salesTaxMinor: taxProjection.salesTaxMinor,
    customerTotalMinor: taxProjection.customerTotalMinor,
    taxProjection: structuredClone(taxProjection),
  };
}

export interface FareApprovalAudit {
  schemaVersion: 'pxpress-fare-approval-v1';
  recommendationVersion: typeof FARE_MODEL_VERSION;
  requestId: string;
  recommendationMinor: number;
  approvedPreTaxMinor: number;
  currency: 'USD';
  approvedBy: string;
  approvedAt: string;
  ownerEdited: boolean;
}

export function buildFareApprovalAudit(recommendation: FareRecommendation, requestId: string, approvedPreTaxMinor: number, approvedBy: string, approvedAt: string): FareApprovalAudit {
  if (!requestId.trim() || !approvedBy.trim() || !validDate(approvedAt) || !Number.isSafeInteger(approvedPreTaxMinor) || approvedPreTaxMinor <= 0) throw new RangeError('Invalid owner approval audit.');
  return { schemaVersion: 'pxpress-fare-approval-v1', recommendationVersion: recommendation.schemaVersion, requestId, recommendationMinor: recommendation.recommendedPreTaxMinor, approvedPreTaxMinor, currency: 'USD', approvedBy, approvedAt, ownerEdited: approvedPreTaxMinor !== recommendation.recommendedPreTaxMinor };
}
