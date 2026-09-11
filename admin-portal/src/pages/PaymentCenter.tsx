import { AlertCircle, BadgeCheck, CircleDollarSign, Clock3, ExternalLink, RefreshCw, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../components/StatePanel';
import { useRequests } from '../hooks';
import { buildPaymentRows, paymentLaneCounts, paymentLaneLabels, recordedPaidTotalsByCurrency, type PaymentLane } from '../features/payment-center/selectors';
import { formatDate } from '../lib/selectors';
import { serviceLabels } from '../components/RequestTable';
import '../features/payment-center/payment-center.css';

const money = (amount: number | null, currency: string | null) => amount === null ? 'Price not recorded' : currency ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount) : `${amount.toFixed(2)} · currency missing`;
const icons: Record<PaymentLane, typeof Clock3> = { awaiting_payment: Clock3, paid: BadgeCheck, failed: AlertCircle, refunded: RotateCcw, not_requested: CircleDollarSign };

export function PaymentCenter() {
  const requests = useRequests();
  if (requests.loading) return <StatePanel kind="loading" title="Loading payment records"/>;
  if (requests.error) return <StatePanel kind="error" title="Payment records could not be loaded" body={requests.error} retry={requests.reload}/>;
  const rows = buildPaymentRows(requests.data);
  const counts = paymentLaneCounts(rows);
  const paidTotals = recordedPaidTotalsByCurrency(rows);
  const paidSummary = paidTotals.totals.length ? paidTotals.totals.map((row) => `${row.currency} ${row.amount.toFixed(2)}`).join(' · ') : `${counts.paid} paid record${counts.paid === 1 ? '' : 's'}`;
  return <div className="page payment-center-page">
    <header className="page-head"><div><p className="eyebrow">Commercial control</p><h1>Payment center</h1><p>A read-only view of payment states already recorded on each ride request. Provider activity is never inferred.</p></div><span className="payment-provider-state"><span aria-hidden/> Wix provider actions off</span></header>
    <section className="payment-lane-rail" aria-label="Recorded payment state totals"><div><span>Awaiting payment</span><strong>{counts.awaiting_payment}</strong><small>Pending or authorized records</small></div><div><span>Paid</span><strong>{counts.paid}</strong><small>{paidSummary}{paidTotals.missingCurrencyCount ? ` · ${paidTotals.missingCurrencyCount} missing currency` : ''}</small></div><div><span>Failed</span><strong>{counts.failed}</strong><small>Requires provider investigation</small></div><div><span>Refunded / void</span><strong>{counts.refunded}</strong><small>Recorded status only</small></div></section>
    <aside className="payment-boundary"><AlertCircle aria-hidden/><div><strong>Payment link delivery is unavailable</strong><span>Resend and provider-detail actions stay disabled until the exact Wix invoice/payment provider is active and its identifiers are read back.</span></div></aside>
    <section className="payment-board" aria-label="Payment records">{rows.length ? rows.map((row) => { const Icon = icons[row.lane]; return <article key={row.request.id} className={`payment-record payment-${row.lane}`}>
      <header><div><Icon aria-hidden/><span><strong>{paymentLaneLabels[row.lane]}</strong><small>{row.request.requestNumber}</small></span></div><b>{money(row.amount, row.currency)}</b></header>
      <div className="payment-guest"><strong>{row.request.customerName}</strong><span>{serviceLabels[row.request.service]} · {formatDate(row.request.pickupDate)}</span></div>
      <dl><div><dt>Recorded status</dt><dd>{row.request.paymentStatus.replaceAll('_', ' ')}</dd></div><div><dt>Price source</dt><dd>{row.amount === null ? 'Missing' : 'Owner quote'}</dd></div><div><dt>Currency</dt><dd>{row.currency ?? 'Missing'}</dd></div><div><dt>Provider transaction</dt><dd>Not available</dd></div></dl>
      <p className={`payment-completeness completeness-${row.completeness}`}>{row.completeness === 'complete_for_display' ? 'Display fields complete' : row.completeness.replaceAll('_', ' ')}</p>
      <p className="payment-source-note">{row.sourceNote}</p>
      <footer><Link className="button secondary" to={`/requests/${row.request.id}`}><ExternalLink aria-hidden/> Open request</Link><button className="button secondary" type="button" disabled title="Wix payment provider is not active"><RefreshCw aria-hidden/> Resend unavailable</button></footer>
    </article>; }) : <StatePanel kind="empty" title="No payment records yet"/>}</section>
  </div>;
}
