import { AlertTriangle, ArrowDownToLine, CalendarClock, Landmark, LockKeyhole, ReceiptText, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../components/StatePanel';
import { finderReadinessSummary, planningFilingDueDate, taxCenterSnapshot, taxLedgerToCsv } from '../features/tax-center/domain';
import type { FinderUsageStatus, PricingAssumptionStatus, RideTaxRecordView, TaxAdjustmentViewEntry, TaxLedgerViewEntry, TransportationSourcingStatus } from '../features/tax-center/types';
import '../features/tax-center/tax-center.css';
import { businessDateKey } from '../lib/business-date';
import { getTaxCenterData, type TaxCenterRepositoryData } from '../lib/repository';
import { formatDateTime } from '../lib/selectors';

const EMPTY_ENTRIES: TaxLedgerViewEntry[] = [];
const EMPTY_ADJUSTMENTS: TaxAdjustmentViewEntry[] = [];
const EMPTY_RIDES: RideTaxRecordView[] = [];
const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(minor / 100);
const DEFAULT_FINDER: FinderUsageStatus = {
  connected: false, availability: 'unavailable', used: null, hardCap: 200, cacheStatus: 'unavailable',
  stages: { adapterEnabled: false, rateProviderEnabled: false, runtimeCredentialsReady: false, repositoryReady: false, sourcingConfirmed: false },
};
const DEFAULT_SOURCING: TransportationSourcingStatus = { confirmed: false };
const DEFAULT_PRICING: PricingAssumptionStatus = { status: 'not_saved' };
type Filter = 'all' | 'filing_ready' | 'needs_review';
const readinessLabels:Record<string,string>={adapterEnabled:'Finder connection',rateProviderEnabled:'rate lookup',runtimeCredentialsReady:'secure credentials',repositoryReady:'tax records',sourcingConfirmed:'sourcing approval'};

function statusLabel(record: RideTaxRecordView) {
  if (record.filingStatus === 'filing_ready') return 'Filing-ready';
  if (record.filingStatus === 'manual_review') return 'Needs review';
  if (record.filingStatus === 'voided') return 'Voided / refunded';
  return 'Pending payment';
}

export function TaxCenterView({
  entries = EMPTY_ENTRIES, adjustments = EMPTY_ADJUSTMENTS, rideRecords = EMPTY_RIDES,
  finder = DEFAULT_FINDER, sourcing = DEFAULT_SOURCING, pricing = DEFAULT_PRICING,
  filingConfiguration = { assignedFrequency: 'monthly', assignmentVerified: false },
  reserveBalanceMinor = null, repositoryConnected = false,
}: {
  entries?: TaxLedgerViewEntry[]; adjustments?: TaxAdjustmentViewEntry[]; rideRecords?: RideTaxRecordView[];
  finder?: FinderUsageStatus; sourcing?: TransportationSourcingStatus; pricing?: PricingAssumptionStatus;
  filingConfiguration?: TaxCenterRepositoryData['filingConfiguration']; reserveBalanceMinor?: number | null; repositoryConnected?: boolean;
}) {
  const today = businessDateKey();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const snapshot = taxCenterSnapshot(entries, adjustments, filingConfiguration, today, reserveBalanceMinor);
  const planningDue = planningFilingDueDate(snapshot.filingPeriod, filingConfiguration.assignedFrequency);
  const planningDueLabel = new Date(`${planningDue}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const finderReadiness = finderReadinessSummary(finder);
  const visibleRides = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rideRecords.filter((record) => {
      const matchesFilter = filter === 'all' || (filter === 'filing_ready' ? record.eligibleForFiling : !record.eligibleForFiling);
      const matchesSearch = !query || [record.publicReference, record.guestLabel, record.serviceLabel, record.jurisdictionLabel].some((value) => value.toLowerCase().includes(query));
      return matchesFilter && matchesSearch;
    });
  }, [filter, rideRecords, search]);

  function exportPreparation() {
    if (!repositoryConnected) return;
    const blob = new Blob([taxLedgerToCsv(entries, adjustments, rideRecords)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pxpress-ohio-tax-${snapshot.filingPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return <div className="page tax-center-page">
    <header className="page-head"><div><p className="eyebrow">Filing preparation</p><h1>Tax Center</h1><p>Review every ride tax record while keeping filing-ready totals separate from pending and manual-review work.</p></div></header>
    <aside className="tax-center-banner" role="status"><LockKeyhole aria-hidden/><div><strong>Tax automation is off</strong><span>This workspace cannot file or pay Ohio. Unresolved rides remain visible below, but contribute $0 to filing-ready sales and tax totals.</span></div></aside>
    <section className="tax-scoreboard" aria-label="Tax filing summary">
      <article><span>Assigned schedule</span><strong>{filingConfiguration.assignedFrequency === 'monthly' ? 'Monthly' : 'Semiannual'} · {filingConfiguration.assignmentVerified ? 'verified' : 'unverified'}</strong><small>{filingConfiguration.assignmentSource || 'Semiannual requires an explicit Ohio assignment.'}</small></article>
      <article><span>Taxable sales</span><strong>{repositoryConnected ? money(snapshot.taxableSalesMinor) : 'Not connected'}</strong><small>Paid, confirmed, reconciled records only.</small></article>
      <article><span>Tax collected</span><strong>{repositoryConnected ? money(snapshot.taxCollectedMinor) : 'Not connected'}</strong><small>Confirmed adjustments included once.</small></article>
      <article><span>Funds reserved</span><strong>{snapshot.fundsReservedMinor === null ? 'Not recorded' : money(snapshot.fundsReservedMinor)}</strong><small>Never inferred from tax collected.</small></article>
      <article><span>Variance</span><strong>{snapshot.varianceMinor === null ? 'Not available' : money(snapshot.varianceMinor)}</strong><small>Requires a recorded reserve balance.</small></article>
    </section>
    <section className="tax-readiness" aria-label="Tax and pricing readiness">
      <article><span>Finder readiness</span><strong>{finder.availability === 'ready' ? 'Ready' : finder.availability === 'partial' ? 'Partially configured' : 'Unavailable'}</strong><small>{finder.connected && finder.used !== null ? `${finder.hardCap - finder.used} of ${finder.hardCap} lookups remaining · cache ${finder.cacheStatus}` : `Missing: ${finderReadiness.missing.map((stage)=>readinessLabels[stage]||stage).join(', ') || 'runtime connection'}`}</small></article>
      <article><span>Transportation sourcing</span><strong>{sourcing.confirmed ? 'Confirmed with evidence' : 'Review required'}</strong><small>{sourcing.confirmed ? `${sourcing.reviewedBy} · ${sourcing.reviewedAt ? formatDateTime(sourcing.reviewedAt) : 'review time unavailable'}` : 'Pickup sourcing is not active until Ohio or a CPA confirms it.'}</small></article>
      <article><span>Pricing assumptions</span><strong>{pricing.status === 'current' ? 'Current' : pricing.status === 'stale' ? 'Stale — review' : 'Not saved'}</strong><small>{pricing.modelVersion ? `${pricing.modelVersion}${pricing.reviewedAt ? ` · ${formatDateTime(pricing.reviewedAt)}` : ''}` : 'Fare recommendations remain advisory.'}</small></article>
    </section>

    <section className="tax-ride-section" aria-labelledby="ride-tax-title">
      <header><div><p className="eyebrow">Per-ride evidence</p><h2 id="ride-tax-title">Ride tax records</h2><p>Pending, unresolved, and voided rides stay visible without increasing collected-tax totals.</p></div><div className="tax-ride-tools"><label><Search aria-hidden/><span className="sr-only">Search ride tax records</span><input aria-label="Search ride tax records" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Request, service, jurisdiction"/></label><div role="group" aria-label="Filter ride tax records"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button><button type="button" aria-pressed={filter === 'filing_ready'} onClick={() => setFilter('filing_ready')}>Filing-ready</button><button type="button" aria-pressed={filter === 'needs_review'} onClick={() => setFilter('needs_review')}>Needs review</button></div></div></header>
      {visibleRides.length ? <div className="tax-ride-list">{visibleRides.map((record) => <article className={`tax-ride-record ${record.eligibleForFiling ? 'is-ready' : 'is-excluded'}`} key={`${record.rideRequestId}:${record.publicReference}`}>
        <header><div><Link to={`/requests/${record.rideRequestId}`}>{record.publicReference}</Link><span>{record.guestLabel} · {record.serviceLabel} · {record.rideDate}</span></div><b data-status={record.filingStatus}>{statusLabel(record)}</b></header>
        <div className="tax-ride-money"><div><span>Service subtotal</span><strong>{money(record.serviceSubtotalMinor)}</strong></div><div><span>Ohio tax</span><strong>{money(record.taxMinor)}</strong></div><div><span>Total</span><strong>{money(record.totalMinor)}</strong></div></div>
        <dl><div><dt>Payment</dt><dd>{record.paymentStatus.replace('_', ' ')}</dd></div><div><dt>Jurisdiction</dt><dd>{record.jurisdictionLabel} · {(record.rateBasisPoints / 100).toFixed(2)}%</dd></div><div><dt>Tax point</dt><dd>{record.taxPointStatus.replace('_', ' ')}{record.taxPointAt ? ` · ${record.taxPointAt.slice(0, 10)}` : ''}</dd></div><div><dt>Adjustments</dt><dd>{record.adjustmentSummary.confirmedTotalDeltaMinor ? money(record.adjustmentSummary.confirmedTotalDeltaMinor) : 'None confirmed'}{record.adjustmentSummary.manualReviewCount ? ` · ${record.adjustmentSummary.manualReviewCount} to review` : ''}</dd></div></dl>
        {!record.eligibleForFiling && <p className="tax-exclusion"><AlertTriangle aria-hidden/><span><strong>Excluded from filing totals</strong>{record.exclusionReason || 'Required paid-tax evidence is incomplete.'}</span></p>}
      </article>)}</div> : <StatePanel kind="empty" title={rideRecords.length ? 'No records match this view' : 'No ride tax records are connected'} body={rideRecords.length ? 'Change the filter or search to see other tax records.' : 'No amount is assumed to be zero or filing-ready.'}/>}
    </section>

    <section className="tax-layout">
      <article className="tax-card"><p className="eyebrow">By jurisdiction</p><h2>Where tax was sourced</h2>{snapshot.byJurisdiction.length ? <ul>{snapshot.byJurisdiction.map((row) => <li key={row.jurisdiction}><strong>{row.jurisdiction}</strong> · {money(row.taxableSalesMinor)} taxable · {money(row.taxMinor)} tax</li>)}</ul> : <div className="tax-empty"><strong>No filing-ready paid records</strong><span>Visible exceptions above contribute nothing to these totals.</span></div>}</article>
      <article className="tax-card"><p className="eyebrow">Adjustments</p><h2>Refunds, voids &amp; corrections</h2><p>Original paid entries stay unchanged. Only confirmed treatment changes filing totals in its recorded adjustment period.</p>{adjustments.length ? <ul>{adjustments.map((item) => <li key={item.id}><strong>{item.kind.replaceAll('_', ' ')}</strong> · {item.filingReady ? `confirmed for ${item.adjustmentFilingPeriod}` : `manual review — ${item.manualReviewReason ?? item.reason}`}</li>)}</ul> : <div className="tax-empty"><strong>No adjustment ledger connected</strong><span>Unconfirmed refunds never reduce filing totals automatically.</span></div>}</article>
      <article className="tax-card"><p className="eyebrow">Next filing</p><h2>{planningDueLabel} · planning date</h2><p>{snapshot.zeroReturnReminder ? 'No filing-ready records are connected for this period. Verify whether a zero return is due.' : `${snapshot.exceptionCount} items need human review; ${snapshot.adjustmentCount} confirmed adjustments are included.`}</p><div className="tax-due"><CalendarClock aria-hidden/><span>Ohio filing preparation uses day 23 after the assigned period. Verify weekend, holiday, and account-specific instructions before filing.</span></div></article>
      <article className="tax-card tax-owner-actions"><div><p className="eyebrow">Filing-prep export</p><h2>Download reviewed records</h2><p>The CSV includes every ride’s eligibility and exclusion reason. Filing and payment remain Raishawn’s actions.</p></div><button className="button secondary" type="button" onClick={exportPreparation} disabled={!repositoryConnected} title={!repositoryConnected ? 'No paid tax ledger is connected' : undefined}><ArrowDownToLine aria-hidden/> {repositoryConnected ? 'Export filing-prep CSV' : 'Export unavailable'}</button></article>
      <article className="tax-card tax-owner-actions"><div><p className="eyebrow">Activation boundary</p><h2>Nothing here changes Wix or Ohio</h2><p><AlertTriangle aria-hidden/> Rate lookup, Wix tax groups, paid reconciliation, filing, and payment remain behind independent gates.</p></div><span aria-label="Tax gates disabled"><Landmark aria-hidden/> <ReceiptText aria-hidden/> Off</span></article>
    </section>
  </div>;
}

export function TaxCenter() {
  const [data, setData] = useState<TaxCenterRepositoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    setLoading(true); setError('');
    getTaxCenterData().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'Tax Center could not be loaded.')).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  if (loading) return <StatePanel kind="loading" title="Loading verified tax records" body="Reading paid records, visible exceptions, adjustments, Finder usage, and sourcing controls."/>;
  if (error || !data) return <StatePanel kind="error" title="Tax records are unavailable" body={error || 'The repository returned no verified tax data.'} retry={load}/>;
  return <TaxCenterView {...data} repositoryConnected/>;
}
