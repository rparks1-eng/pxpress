import { Calculator, CheckCircle2, CircleAlert, DatabaseZap, LockKeyhole } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { RideRequest, RouteEstimate } from '../../types';
import { formatDateTime } from '../../lib/selectors';
import {
  DEFAULT_INSURANCE_MONTHLY_MINOR,
  DEFAULT_OWNER_COMPENSATION_ANNUAL_MINOR,
  exactCustomerTaxProjection,
  recommendFare,
  type ApprovedTaxProjection,
  type FareRouteLeg,
  type RoundingIncrement,
} from './domain';
import './fare-recommendation.css';

export type FinderReviewEvidence = {
  status: 'verified';
  finderAuditId: string;
  source: string;
  sourceReference: string;
  jurisdiction: Record<string, string>;
  jurisdictionLabel: string;
  rateBasisPoints: number;
  lookupStatus: 'lookup' | 'cached';
  effectiveDate: string;
  observedAt: string;
  expiresAt: string;
  transportationSourcingPolicyConfirmed: boolean;
  humanConfirmationStatus: 'pending' | 'confirmed' | 'rejected';
  sourceEventId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewPolicySource?: string;
  reviewPolicyDate?: string;
  reviewReason?: string;
  onReview?: (decision: 'confirmed' | 'rejected', policySource: string, policyDate: string, reason: string) => Promise<void>;
} | { status: 'unavailable'; reason: string };

type Props = {
  request: RideRequest;
  routeEstimate?: RouteEstimate | null;
  finderEvidence?: FinderReviewEvidence;
  finderBusy?: boolean;
  onLookupFinder?: () => void;
  finderReviewBusy?: boolean;
  onReviewFinder?: (decision: 'confirmed' | 'rejected', policySource: string, policyDate: string, reason: string) => Promise<void>;
  onUsePrice: (selection: FarePriceSelection) => void;
};

export type FarePriceSelection = {
  recommendedPreTaxMinor: number;
  serviceSubtotalMinor: number;
  taxProjection?: ApprovedTaxProjection;
};

const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const decimal = (value: string) => value === '' ? 0 : Math.max(0, Number(value));
const cents = (value: number) => Math.round(value * 100);

const normalizeStop = (value: string) => value.trim().replace(/\s+/g, ' ').toUpperCase();

export function fareRouteLegs(request: RideRequest, estimate?: RouteEstimate | null): FareRouteLeg[] {
  if (!estimate || estimate.totalMiles <= 0 || estimate.totalDurationMinutes <= 0) return [];
  if (estimate.routeLegs?.length) {
    const expectedStops = request.tripType === 'Round trip'
      ? [estimate.baseAddress, request.pickupAddress, request.destinationAddress || request.airport || '', request.returnAddress || '', estimate.baseAddress]
      : [estimate.baseAddress, request.pickupAddress, request.destinationAddress || request.airport || '', estimate.baseAddress];
    if (estimate.routeLegs.length !== expectedStops.length - 1 || expectedStops.some((stop) => !stop)) return [];
    const kinds: FareRouteLeg['kind'][] = request.tripType === 'Round trip'
      ? ['base_to_pickup', 'pickup_to_destination', 'return_trip', 'return_to_base']
      : ['base_to_pickup', 'pickup_to_destination', 'return_to_base'];
    const mapped = estimate.routeLegs.map((leg, index) => {
      if (normalizeStop(leg.origin) !== normalizeStop(expectedStops[index]) || normalizeStop(leg.destination) !== normalizeStop(expectedStops[index + 1])) return undefined;
      return { kind: kinds[index], origin: leg.origin, destination: leg.destination, miles: leg.miles, driveMinutes: leg.durationMinutes };
    }).filter((leg): leg is FareRouteLeg => Boolean(leg));
    return mapped.length === kinds.length ? mapped : [];
  }
  // Legacy three-leg estimates are safe only for one-way rides. A round trip
  // must be recalculated so the final base leg starts at the actual last stop.
  if (request.tripType === 'Round trip') return [];
  const mileage = [estimate.baseToPickupMiles, estimate.pickupToDestinationMiles, estimate.destinationToBaseMiles];
  const kinds: FareRouteLeg['kind'][] = ['base_to_pickup', 'pickup_to_destination', 'return_to_base'];
  let allocated = 0;
  return mileage.map((miles, index) => {
    const driveMinutes = index === mileage.length - 1
      ? Math.max(0, estimate.totalDurationMinutes - allocated)
      : Math.round(estimate.totalDurationMinutes * miles / estimate.totalMiles);
    allocated += driveMinutes;
    const stops = [estimate.baseAddress, estimate.pickupAddress, estimate.destinationAddress, estimate.baseAddress];
    return { kind: kinds[index], origin: stops[index], destination: stops[index + 1], miles, driveMinutes };
  });
}

export function FareRecommendationPanel({ request, routeEstimate, finderEvidence = { status: 'unavailable', reason: 'Ohio Finder is not connected to this owner screen.' }, finderBusy = false, onLookupFinder, finderReviewBusy = false, onReviewFinder, onUsePrice }: Props) {
  const [fuel, setFuel] = useState(0), [maintenance, setMaintenance] = useState(0), [depreciation, setDepreciation] = useState(0);
  const [waitMinutes, setWaitMinutes] = useState(0), [insurance, setInsurance] = useState(DEFAULT_INSURANCE_MONTHLY_MINOR / 100);
  const [ownerComp, setOwnerComp] = useState(DEFAULT_OWNER_COMPENSATION_ANNUAL_MINOR / 100), [overhead, setOverhead] = useState(0);
  const [rides, setRides] = useState(0), [utilization, setUtilization] = useState(75), [margin, setMargin] = useState(20);
  const [capacityMode, setCapacityMode] = useState<'rides' | 'billable_hours'>('rides'), [billableHours, setBillableHours] = useState(0);
  const [incomeReserveEnabled, setIncomeReserveEnabled] = useState(false), [incomeReserve, setIncomeReserve] = useState(0);
  const [tolls, setTolls] = useState(0), [parking, setParking] = useState(0), [airportFee, setAirportFee] = useState(0), [lateNightFee, setLateNightFee] = useState(0), [otherDirectCost, setOtherDirectCost] = useState(0);
  const [benchmarkMin, setBenchmarkMin] = useState(0), [benchmarkMax, setBenchmarkMax] = useState(0), [benchmarkSource, setBenchmarkSource] = useState(''), [benchmarkDate, setBenchmarkDate] = useState('');
  const [rounding, setRounding] = useState<RoundingIncrement>(500);
  const [policySource,setPolicySource]=useState(''),[policyDate,setPolicyDate]=useState(''),[reviewReason,setReviewReason]=useState(''),[reviewError,setReviewError]=useState('');
  const addOnsMinor = { tollsMinor: cents(tolls), parkingMinor: cents(parking), airportFeeMinor: cents(airportFee), lateNightFeeMinor: cents(lateNightFee), otherDirectCostMinor: cents(otherDirectCost) };
  const recommendation = useMemo(() => {
    const legs = fareRouteLegs(request, routeEstimate);
    return recommendFare({
      serviceType: request.service, routeLegs: legs, waitMinutes,
      fuelCostPerMileMinor: cents(fuel), maintenanceCostPerMileMinor: cents(maintenance), depreciationCostPerMileMinor: cents(depreciation),
      ...addOnsMinor, insuranceMonthlyMinor: cents(insurance), ownerCompensationAnnualMinor: cents(ownerComp), otherAnnualOverheadMinor: cents(overhead),
      capacityMode, availableRidesPerYear: rides, availableBillableHoursPerYear: billableHours,
      utilizationBasisPoints: Math.round(utilization * 100), desiredMarginBasisPoints: Math.round(margin * 100),
      incomeTaxReserveEnabled: incomeReserveEnabled, incomeTaxReserveBasisPoints: Math.round(incomeReserve * 100),
      ...(benchmarkSource || benchmarkMin || benchmarkMax ? { benchmark: { minimumMinor: cents(benchmarkMin), maximumMinor: cents(benchmarkMax), source: benchmarkSource, observedDate: benchmarkDate } } : {}),
      evaluatedAt: new Date().toISOString(),
    });
  }, [request, routeEstimate, fuel, maintenance, depreciation, waitMinutes, insurance, ownerComp, overhead, rides, capacityMode, billableHours, utilization, margin, incomeReserveEnabled, incomeReserve, tolls, parking, airportFee, lateNightFee, otherDirectCost, benchmarkMin, benchmarkMax, benchmarkSource, benchmarkDate]);
  const tax = recommendation.status === 'ready' && finderEvidence.status === 'verified'
    ? exactCustomerTaxProjection(recommendation.recommendedPreTaxMinor, finderEvidence.rateBasisPoints, rounding) : undefined;
  const durableConfirmation = finderEvidence.status === 'verified' && finderEvidence.humanConfirmationStatus === 'confirmed' &&
    Boolean(finderEvidence.sourceEventId && finderEvidence.reviewedBy && finderEvidence.reviewedAt && finderEvidence.reviewPolicySource &&
      finderEvidence.reviewPolicyDate && finderEvidence.reviewReason) && Date.parse(finderEvidence.expiresAt) > Date.now();
  const taxEligible = finderEvidence.status === 'verified' && finderEvidence.transportationSourcingPolicyConfirmed && durableConfirmation && Boolean(tax);
  const reviewAction = onReviewFinder ?? (finderEvidence.status === 'verified' ? finderEvidence.onReview : undefined);

  return <section className="fare-panel" aria-labelledby="fare-panel-title">
    <header><div><p className="eyebrow">Owner-only guidance</p><h3 id="fare-panel-title">Fare recommendation</h3></div><Calculator aria-hidden/></header>
    <p className="fare-intro">This model uses Pxpress economics, not invented competitor prices. It recommends a fare; Raishawn still edits and approves the price.</p>
    {!routeEstimate && <div className="fare-state"><CircleAlert aria-hidden/><span>Calculate mileage on the request first. No route cost is guessed.</span></div>}
    <details className="fare-assumptions"><summary>Review pricing assumptions</summary><div className="fare-input-grid">
      <label><span>Fuel per mile</span><input aria-label="Fuel cost per mile" type="number" inputMode="decimal" min="0" step="0.01" value={fuel || ''} onChange={event => setFuel(decimal(event.target.value))}/></label>
      <label><span>Maintenance per mile</span><input aria-label="Maintenance cost per mile" type="number" inputMode="decimal" min="0" step="0.01" value={maintenance || ''} onChange={event => setMaintenance(decimal(event.target.value))}/></label>
      <label><span>Depreciation per mile</span><input aria-label="Depreciation cost per mile" type="number" inputMode="decimal" min="0" step="0.01" value={depreciation || ''} onChange={event => setDepreciation(decimal(event.target.value))}/></label>
      <label><span>Wait time minutes</span><input aria-label="Wait time minutes" type="number" inputMode="numeric" min="0" step="1" value={waitMinutes || ''} onChange={event => setWaitMinutes(decimal(event.target.value))}/></label>
      <label><span>Tolls</span><input aria-label="Tolls" type="number" inputMode="decimal" min="0" step="0.01" value={tolls || ''} onChange={event => setTolls(decimal(event.target.value))}/></label>
      <label><span>Parking</span><input aria-label="Parking" type="number" inputMode="decimal" min="0" step="0.01" value={parking || ''} onChange={event => setParking(decimal(event.target.value))}/></label>
      <label><span>Airport fee</span><input aria-label="Airport fee" type="number" inputMode="decimal" min="0" step="0.01" value={airportFee || ''} onChange={event => setAirportFee(decimal(event.target.value))}/></label>
      <label><span>Late-night cost</span><input aria-label="Late night cost" type="number" inputMode="decimal" min="0" step="0.01" value={lateNightFee || ''} onChange={event => setLateNightFee(decimal(event.target.value))}/></label>
      <label><span>Other ride cost</span><input aria-label="Other direct ride cost" type="number" inputMode="decimal" min="0" step="0.01" value={otherDirectCost || ''} onChange={event => setOtherDirectCost(decimal(event.target.value))}/></label>
      <label><span>Insurance per month</span><input aria-label="Insurance per month" type="number" inputMode="decimal" min="0" step="1" value={insurance} onChange={event => setInsurance(decimal(event.target.value))}/></label>
      <label><span>Owner compensation per year</span><input aria-label="Owner compensation target per year" type="number" inputMode="decimal" min="0" step="100" value={ownerComp} onChange={event => setOwnerComp(decimal(event.target.value))}/></label>
      <label><span>Other overhead per year</span><input aria-label="Other annual overhead" type="number" inputMode="decimal" min="0" step="100" value={overhead || ''} onChange={event => setOverhead(decimal(event.target.value))}/></label>
      <label><span>Available rides per year</span><input aria-label="Available rides per year" type="number" inputMode="numeric" min="1" value={rides || ''} onChange={event => setRides(decimal(event.target.value))}/></label>
      <label><span>Capacity basis</span><select aria-label="Capacity basis" value={capacityMode} onChange={event => setCapacityMode(event.target.value as 'rides'|'billable_hours')}><option value="rides">Available rides</option><option value="billable_hours">Billable hours</option></select></label>
      <label><span>Billable hours per year</span><input aria-label="Available billable hours per year" type="number" inputMode="numeric" min="1" disabled={capacityMode !== 'billable_hours'} value={billableHours || ''} onChange={event => setBillableHours(decimal(event.target.value))}/></label>
      <label><span>Expected utilization %</span><input aria-label="Expected utilization percentage" type="number" inputMode="decimal" min="1" max="100" value={utilization} onChange={event => setUtilization(decimal(event.target.value))}/></label>
      <label><span>Desired margin %</span><input aria-label="Desired margin percentage" type="number" inputMode="decimal" min="0" max="94" value={margin} onChange={event => setMargin(decimal(event.target.value))}/></label>
      <label className="fare-check"><input type="checkbox" checked={incomeReserveEnabled} onChange={event => setIncomeReserveEnabled(event.target.checked)}/><span>Plan an income-tax reserve</span></label>
      <label><span>Income reserve %</span><input aria-label="Income tax planning reserve percentage" type="number" inputMode="decimal" min="0" max="100" disabled={!incomeReserveEnabled} value={incomeReserve || ''} onChange={event => setIncomeReserve(decimal(event.target.value))}/></label>
    </div><p className="fare-planning-note">Income, self-employment, and payroll tax reserves are business planning only. They are never customer sales tax and are excluded from checkout.</p>
    <fieldset className="fare-benchmark"><legend>Optional manual competitor benchmark</legend><div className="fare-input-grid"><label><span>Low</span><input aria-label="Competitor benchmark low" type="number" min="0" step="1" value={benchmarkMin || ''} onChange={event => setBenchmarkMin(decimal(event.target.value))}/></label><label><span>High</span><input aria-label="Competitor benchmark high" type="number" min="0" step="1" value={benchmarkMax || ''} onChange={event => setBenchmarkMax(decimal(event.target.value))}/></label><label><span>Source</span><input aria-label="Competitor benchmark source" value={benchmarkSource} onChange={event => setBenchmarkSource(event.target.value)}/></label><label><span>Observed date</span><input aria-label="Competitor benchmark date" type="date" value={benchmarkDate} onChange={event => setBenchmarkDate(event.target.value)}/></label></div><small>Manual evidence only. Missing or stale benchmarks never change the internal recommendation.</small></fieldset></details>
    {recommendation.status === 'ready' ? <div className="fare-economics" aria-label="Route economics">
      <div><span>Route economics</span><strong>{recommendation.route.totalMiles.toFixed(1)} mi · {recommendation.route.driveMinutes + recommendation.route.waitMinutes} min</strong></div>
      <div><span>Direct ride cost</span><strong>{money(recommendation.directRideCostMinor)}</strong></div>
      <div><span>Insurance + overhead</span><strong>{money(recommendation.allocatedInsuranceMinor + recommendation.allocatedOtherOverheadMinor)}</strong></div>
      <div><span>Owner compensation target</span><strong>{money(recommendation.allocatedOwnerCompensationMinor)}</strong></div>
      <div className="fare-recommended"><span>Recommended pre-tax fare</span><strong>{money(recommendation.recommendedPreTaxMinor)}</strong></div>
      <div><span>Planned margin</span><strong>{money(recommendation.plannedProfitMinor)}</strong></div>
      <div><span>Competitor context</span><strong>{recommendation.benchmarkStatus === 'missing' ? 'Not provided' : recommendation.benchmarkStatus === 'stale' ? 'Stale — review only' : 'Current manual evidence'}</strong></div>
      <div><span>Income-tax planning reserve</span><strong>{recommendation.incomeTaxReserveEnabled ? money(recommendation.incomeTaxReservePlanningMinor) : 'Off'}</strong></div>
    </div> : <div className="fare-state"><CircleAlert aria-hidden/><span>{recommendation.code === 'CAPACITY_REQUIRED' ? 'Enter annual ride capacity to calculate a recommendation.' : 'Verified mileage and valid assumptions are required.'}</span></div>}
    <div className={`finder-review ${finderEvidence.status === 'verified' ? '' : 'finder-unavailable'}`}>
      <header><div><span>Exact pickup sales tax</span><strong>{finderEvidence.status === 'verified' ? `${finderEvidence.jurisdictionLabel} · ${(finderEvidence.rateBasisPoints / 100).toFixed(2)}%` : 'Ohio Finder not available'}</strong></div>{finderEvidence.status === 'verified' ? <DatabaseZap aria-hidden/> : <LockKeyhole aria-hidden/>}</header>
      {finderEvidence.status === 'verified' ? <dl><div><dt>Source</dt><dd>{finderEvidence.source}</dd></div><div><dt>Jurisdiction</dt><dd>{finderEvidence.jurisdictionLabel}</dd></div><div><dt>Effective date</dt><dd>{finderEvidence.effectiveDate}</dd></div><div><dt>Lookup</dt><dd>{finderEvidence.lookupStatus} · {formatDateTime(finderEvidence.observedAt)}</dd></div><div><dt>Expires</dt><dd>{formatDateTime(finderEvidence.expiresAt)}</dd></div><div><dt>Human confirmation</dt><dd>{finderEvidence.humanConfirmationStatus}</dd></div></dl> : <p>{finderEvidence.reason} No ZIP or county estimate is substituted.</p>}
      {finderEvidence.status==='verified'&&finderEvidence.humanConfirmationStatus!=='pending'&&<div className={`finder-review-readback ${finderEvidence.humanConfirmationStatus}`}><strong>{finderEvidence.humanConfirmationStatus==='confirmed'?'Owner-confirmed evidence':'Rejected — manual tax review required'}</strong>{finderEvidence.reviewReason&&<p>{finderEvidence.reviewReason}</p>}<small>{finderEvidence.reviewPolicySource||'Policy source unavailable'}{finderEvidence.reviewPolicyDate?` · policy ${finderEvidence.reviewPolicyDate}`:''}{finderEvidence.reviewedAt?` · reviewed ${formatDateTime(finderEvidence.reviewedAt)}`:''}{finderEvidence.reviewedBy?` · reviewer ${finderEvidence.reviewedBy}`:''}</small></div>}
      {onLookupFinder&&<button type="button" className="button secondary finder-lookup" disabled={finderBusy} onClick={onLookupFinder}>{finderBusy?'Checking exact address…':'Check exact pickup tax'}</button>}
      {finderEvidence.status==='verified'&&finderEvidence.humanConfirmationStatus==='pending'&&reviewAction&&<details className="finder-owner-review"><summary>Review this Finder result</summary><div className="finder-review-fields"><label><span>Policy source</span><input value={policySource} onChange={event=>setPolicySource(event.target.value)} placeholder="Ohio or CPA source reference"/></label><label><span>Policy date</span><input type="date" value={policyDate} onChange={event=>setPolicyDate(event.target.value)}/></label><label><span>Review reason</span><textarea rows={3} value={reviewReason} onChange={event=>setReviewReason(event.target.value)} placeholder="Why this exact result is accepted or rejected"/></label></div>{reviewError&&<p role="alert" className="dialog-error">{reviewError}</p>}<div className="finder-review-actions"><button type="button" className="button secondary" disabled={finderReviewBusy} onClick={async()=>{setReviewError('');try{await reviewAction('rejected',policySource,policyDate,reviewReason)}catch(error){setReviewError(error instanceof Error?error.message:'Finder review could not be saved.')}}}>Reject result</button><button type="button" className="button primary" disabled={finderReviewBusy} onClick={async()=>{setReviewError('');try{await reviewAction('confirmed',policySource,policyDate,reviewReason)}catch(error){setReviewError(error instanceof Error?error.message:'Finder review could not be saved.')}}}>{finderReviewBusy?'Saving review…':'Confirm result'}</button></div></details>}
      {!taxEligible && <small>Review only. Customer tax and Wix payment remain blocked until exact-address evidence and the transportation sourcing policy are confirmed.</small>}
    </div>
    <label className="fare-rounding"><span>Customer-total rounding</span><select aria-label="Customer total rounding policy" value={rounding} onChange={event => setRounding(Number(event.target.value) as RoundingIncrement)}><option value={500}>Round up to next $5</option><option value={1000}>Round up to next $10</option></select></label>
    {tax && <div className="fare-tax-summary" aria-label="Tax and total preview"><div><span>Tax-exclusive service</span><strong>{money(tax.preTaxServiceSubtotalMinor)}</strong></div><div><span>Sales tax</span><strong>{money(tax.salesTaxMinor)}</strong></div><div><span>Rounded customer total</span><strong>{money(tax.customerTotalMinor)}</strong></div></div>}
    <button type="button" className="button secondary fare-use" disabled={recommendation.status !== 'ready'||!taxEligible} title={!taxEligible?'Confirm exact Ohio Finder tax before using this price.':undefined} onClick={() => {
      if (recommendation.status !== 'ready') return;
      if (taxEligible && tax && finderEvidence.status === 'verified') {
        onUsePrice({
          recommendedPreTaxMinor: recommendation.recommendedPreTaxMinor,
          serviceSubtotalMinor: tax.preTaxServiceSubtotalMinor,
          taxProjection: {
            schemaVersion: 'pxpress-approved-tax-projection-v1',
            finderAuditId: finderEvidence.finderAuditId,
            serviceSubtotalMinor: tax.preTaxServiceSubtotalMinor,
            salesTaxMinor: tax.salesTaxMinor,
            customerTotalMinor: tax.customerTotalMinor,
            recommendedPreTaxServiceMinor: tax.recommendedPreTaxServiceMinor,
            unroundedTaxMinor: tax.unroundedTaxMinor,
            unroundedCustomerTotalMinor: tax.unroundedCustomerTotalMinor,
            roundingAdjustmentMinor: tax.roundingAdjustmentMinor,
            rateBasisPoints: finderEvidence.rateBasisPoints,
            jurisdiction: finderEvidence.jurisdiction,
            jurisdictionLabel: finderEvidence.jurisdictionLabel,
            source: finderEvidence.source,
            sourceReference: finderEvidence.sourceReference,
            effectiveDate: finderEvidence.effectiveDate,
            lookupStatus: finderEvidence.lookupStatus,
            observedAt: finderEvidence.observedAt,
            expiresAt: finderEvidence.expiresAt,
            taxGroupId: '13d21c63-b5ec-5912-8397-c3a5ddb27a97',
            providerTaxMode: 'wix-calculates-once-from-tax-exclusive-subtotal',
          },
        });
        return;
      }
    }}><CheckCircle2 aria-hidden/>{taxEligible ? 'Use verified subtotal + tax' : 'Exact tax required'}</button>
  </section>;
}
