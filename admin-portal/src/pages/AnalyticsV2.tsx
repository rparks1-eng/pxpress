import { BadgeDollarSign, CarFront, DatabaseZap, Gauge, ReceiptText, ShieldCheck, UsersRound } from 'lucide-react';
import { StatePanel } from '../components/StatePanel';
import { computeBusinessInsights } from '../features/analytics-v2/selectors';
import { disconnectedInsightsInput } from '../features/analytics-v2/fixtures';
import { localExpenseFixtures } from '../features/expenses/fixtures';
import { useRequests } from '../hooks';
import { isSupabaseConfigured } from '../lib/supabase';
import type { RideRequest } from '../types';
import type { BusinessInsightsInput } from '../features/analytics-v2/types';
import { HistoricalBaselineReview } from '../features/analytics-v2/HistoricalBaselineReview';
import '../features/analytics-v2/analytics-v2.css';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
const pct = (value: number | null) => value === null ? 'Not enough data' : `${Math.round(value * 100)}%`;
const serviceLabels = { airport: 'Airport transfers', appointment: 'Appointments', point: 'Point-to-point', events: 'Event operations', hourly: 'Hourly transportation' } as const;

export function analyticsInputForRequests(requests: RideRequest[], connected = isSupabaseConfigured): BusinessInsightsInput {
  return {
    requests,
    expenses: connected ? [] : structuredClone(localExpenseFixtures),
    source: connected ? 'live_requests_expenses_disconnected' : 'local_preview',
    periodLabel: connected ? 'Live requests · expense ledger off' : 'Local example records',
  };
}

const sourceDisclosure = (source: BusinessInsightsInput['source']) => {
  if (source === 'live_requests_expenses_disconnected') return {
    title: 'Live requests · expense ledger not connected',
    detail: 'Request, quote, payment-status, and customer figures come from the owner request repository. Expense, contribution, and cost figures stay unavailable instead of mixing in local examples.',
  };
  if (source === 'local_preview') return {
    title: 'Local preview data',
    detail: 'Every figure below is computed from labeled example records. It is not a claim about Pxpress performance.',
  };
  return {
    title: 'Live business data is not connected',
    detail: 'The page intentionally shows zeroes until request and expense repositories are passed into this component.',
  };
};

export function AnalyticsV2Route() {
  const requests = useRequests();
  if (requests.loading) return <StatePanel kind="loading" title="Loading business insights" body="Reading the latest owner request records."/>;
  if (requests.error) return <StatePanel kind="error" title="Business insights could not load" body={`${requests.error} No local figures are substituted for the unavailable request repository.`} retry={requests.reload}/>;
  return <AnalyticsV2 input={analyticsInputForRequests(requests.data)}/>;
}

export function AnalyticsV2({ input = disconnectedInsightsInput }: { input?: BusinessInsightsInput }) {
  const insights = computeBusinessInsights(input);
  const hasData = input.requests.length > 0 || input.expenses.length > 0;
  const disclosure = sourceDisclosure(input.source);
  const expensesDisconnected = input.source === 'live_requests_expenses_disconnected';
  return <div className="page insights-page">
    <header className="page-head insights-head"><div><p className="eyebrow">Owner intelligence</p><h1>Business insights</h1><p>Request movement, collected revenue, reviewed expenses, customer patterns, and the gaps that still need better records.</p></div><span className={`insights-source source-${input.source}`}><DatabaseZap aria-hidden/>{input.periodLabel}</span></header>
    {input.source !== 'live_repository' && <aside className="insights-truth-note" role="status"><ShieldCheck aria-hidden/><div><strong>{disclosure.title}</strong><span>{disclosure.detail}</span></div></aside>}

    <section className="insights-scoreboard" aria-label="Business performance summary">
      <article><BadgeDollarSign aria-hidden/><span>Recorded paid revenue</span><strong>{money(insights.revenue.paidRevenue)}</strong><small>{insights.revenue.paidRideCount} paid ride{insights.revenue.paidRideCount === 1 ? '' : 's'}</small></article>
      <article><ReceiptText aria-hidden/><span>Reviewed operating expense</span><strong>{expensesDisconnected ? 'Not connected' : money(insights.efficiency.reviewedOperatingExpense)}</strong><small>{expensesDisconnected ? 'Local examples stay on the Expenses page' : 'Informational ledger candidate'}</small></article>
      <article><Gauge aria-hidden/><span>Contribution before gaps</span><strong>{insights.efficiency.contributionBeforeUntrackedCosts === null ? 'Not available' : money(insights.efficiency.contributionBeforeUntrackedCosts)}</strong><small>{expensesDisconnected ? 'Requires a connected expense ledger' : 'Paid revenue less reviewed expenses'}</small></article>
      <article><UsersRound aria-hidden/><span>Repeat customer share</span><strong>{pct(insights.customers.repeatCustomerRate)}</strong><small>{insights.customers.repeatCustomers} of {insights.customers.uniqueCustomers} customers</small></article>
    </section>

    <section className="insights-layout">
      <article className="insights-card insights-funnel">
        <header><div><p className="eyebrow">Request pipeline</p><h2>From request to completed ride</h2></div><span>Counts only recorded states</span></header>
        <div>{insights.funnel.map((stage, index) => <section key={stage.key}><span>{stage.label}</span><strong>{stage.count}</strong><i aria-hidden style={{ width: `${insights.funnel[0].count ? Math.max(4, stage.count / insights.funnel[0].count * 100) : 0}%` }}/>{index > 0 && <small>{pct(stage.rateFromPrior)} from prior stage</small>}</section>)}</div>
      </article>
      <article className="insights-card insights-efficiency">
        <header><div><p className="eyebrow">Operating lens</p><h2>Efficiency</h2></div><Gauge aria-hidden/></header>
        <dl><div><dt>Expense to paid revenue</dt><dd>{pct(insights.efficiency.expenseToPaidRevenueRate)}</dd></div><div><dt>Cost per completed ride</dt><dd>{insights.efficiency.costPerCompletedRide === null ? 'Not available' : money(insights.efficiency.costPerCompletedRide)}</dd></div><div><dt>Completed rides</dt><dd>{insights.efficiency.completedRides}</dd></div><div><dt>Cached route miles</dt><dd>{insights.efficiency.recordedRouteMiles === null ? 'Not available' : insights.efficiency.recordedRouteMiles.toFixed(1)}</dd></div></dl>
        <p>Only reviewed expenses, recorded paid amounts, completed statuses, and cached route mileage are used. Missing costs or miles are not estimated.</p>
      </article>
      <article className="insights-card insights-services">
        <header><div><p className="eyebrow">Service mix</p><h2>What customers request</h2></div><CarFront aria-hidden/></header>
        {insights.services.length ? <div>{insights.services.map((service) => <section key={service.service}><span><strong>{serviceLabels[service.service]}</strong><small>{service.requests} request{service.requests === 1 ? '' : 's'} · {service.completed} completed</small></span><b>{money(service.paidRevenue)}</b></section>)}</div> : <p className="insights-empty">No service records are available.</p>}
      </article>
      <article className="insights-card insights-customers">
        <header><div><p className="eyebrow">Customer picture</p><h2>Relationships</h2></div><UsersRound aria-hidden/></header>
        <div className="customer-insight-number"><strong>{insights.customers.uniqueCustomers}</strong><span>unique recorded customers</span></div>
        <div className="customer-insight-number"><strong>{insights.customers.repeatCustomers}</strong><span>customers with more than one request</span></div>
        <p>Customers are grouped by the stored internal customer ID. Names or contact details are not guessed or merged.</p>
      </article>
      <article className="insights-card insights-completeness">
        <header><div><p className="eyebrow">Data health</p><h2>Can these numbers be trusted?</h2></div><ShieldCheck aria-hidden/></header>
        <div>{insights.completeness.map((item) => <section key={item.key}><span><strong>{item.label}</strong><small>{item.note}</small></span><b>{item.total ? `${item.complete} / ${item.total}` : 'No records'}</b><i aria-hidden><em style={{ width: `${(item.rate ?? 0) * 100}%` }}/></i></section>)}</div>
      </article>
      <HistoricalBaselineReview/>
    </section>
    {!hasData && <p className="insights-empty-page">Add the existing request hook and the future expense repository at the route boundary to populate this page. No values are fabricated while those sources are absent.</p>}
    <p className="insights-disclaimer">Business insight only. This view does not provide tax, accounting, or financial advice, and it does not treat incomplete records as zero activity.</p>
  </div>;
}
