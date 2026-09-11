import { AlertTriangle, ClipboardPlus, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatePanel } from '../components/StatePanel';
import { serviceLabels } from '../components/RequestTable';
import { useRequests } from '../hooks';
import { detectScheduleConflicts, timeOptions } from '../lib/schedule';
import { businessDateKey } from '../lib/business-date';
import { detectLocalScheduleConflicts, loadAvailabilityBlocks, loadManualRideDrafts, storeManualRideDrafts, type LocalManualRideDraft } from '../lib/local-schedule';
import { formatDate, formatMoney, formatTime } from '../lib/selectors';
import type { RideRequest } from '../types';
import '../local-workflow.css';

export type ManualRideDraft = LocalManualRideDraft & {
  email: string;
  phone: string;
  service: RideRequest['service'];
  pickupAddress: string;
  destinationAddress: string;
  pickupDate: string;
  pickupTime: string;
  endDate: string;
  endTime: string;
  passengers: number;
  notes: string;
  price: number;
};
export const blankManualRideDraft = (now = new Date()): Omit<ManualRideDraft, 'id'> => { const today = businessDateKey(now); return { guestName: '', email: '', phone: '', service: 'airport', pickupAddress: '', destinationAddress: '', pickupDate: today, pickupTime: '09:00', endDate: today, endTime: '10:30', passengers: 1, notes: '', price: 0 }; };

export function ManualRideEntry() {
  const requests = useRequests();
  if (requests.loading) return <StatePanel kind="loading" title="Opening manual ride entry"/>;
  if (requests.error) return <StatePanel kind="error" title="Manual ride entry could not check the schedule" body={requests.error} retry={requests.reload}/>;
  return <ManualRideEntryContent rides={requests.data}/>;
}

export function ManualRideEntryContent({ rides }: { rides: RideRequest[] }) {
  const [draft, setDraft] = useState(blankManualRideDraft);
  const [review, setReview] = useState<ManualRideDraft[]>(loadManualRideDrafts<ManualRideDraft>);
  const [message, setMessage] = useState('');
  const candidate = useMemo(() => ({ label: draft.guestName || 'Manual ride', startDate: draft.pickupDate, startTime: draft.pickupTime, endDate: draft.endDate, endTime: draft.endTime }), [draft]);
  const conflicts = useMemo(() => [...detectScheduleConflicts(candidate, rides), ...detectLocalScheduleConflicts(candidate, loadAvailabilityBlocks(), review)], [candidate, rides, review]);
  function add(event: React.FormEvent) {
    event.preventDefault();
    const item: ManualRideDraft = { ...draft, id: crypto.randomUUID() };
    setReview((current) => { const next = [item, ...current]; storeManualRideDrafts(next); return next; });
    setDraft(blankManualRideDraft());
    setMessage('Draft added to this page for review. Nothing was sent or saved to the customer record.');
  }
  return <div className="page manual-ride-page">
    <header className="page-head"><div><p className="eyebrow">Phone and text bookings</p><h1>Manual ride entry</h1><p>Organize the details Raishawn receives away from the website before entering them into an approved system.</p></div></header>
    <aside className="local-scope-note"><LockKeyhole aria-hidden/><span><strong>Device-local review only</strong> Drafts stay in this browser until removed. They do not create a request, guest, invoice, payment, calendar event, or customer message.</span></aside>
    <section className="manual-ride-layout">
      <form className="workflow-card manual-ride-form" onSubmit={add}>
        <div className="workflow-heading"><div><p className="eyebrow">New local draft</p><h2>Capture the ride</h2></div><ClipboardPlus aria-hidden/></div>
        <fieldset><legend>Guest</legend><div className="workflow-form-grid"><label><span>Full name</span><input required value={draft.guestName} onChange={(event) => setDraft({ ...draft, guestName: event.target.value })}/></label><label><span>Phone</span><input required inputMode="tel" value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })}/></label><label className="workflow-field-wide"><span>Email</span><input required type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })}/></label></div></fieldset>
        <fieldset><legend>Ride</legend><div className="workflow-form-grid"><label><span>Service</span><select value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value as RideRequest['service'] })}>{Object.entries(serviceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Passengers</span><input type="number" inputMode="numeric" min="1" max="7" required value={draft.passengers} onChange={(event) => setDraft({ ...draft, passengers: Number(event.target.value) })}/></label><label className="workflow-field-full"><span>Pickup</span><input required value={draft.pickupAddress} onChange={(event) => setDraft({ ...draft, pickupAddress: event.target.value })}/></label><label className="workflow-field-full"><span>Destination</span><input required value={draft.destinationAddress} onChange={(event) => setDraft({ ...draft, destinationAddress: event.target.value })}/></label></div></fieldset>
        <fieldset><legend>Schedule and price</legend><div className="workflow-form-grid"><label><span>Pickup date</span><input type="date" required value={draft.pickupDate} onChange={(event) => setDraft({ ...draft, pickupDate: event.target.value, endDate: event.target.value })}/></label><label><span>Pickup time</span><select aria-label="Manual ride pickup time" value={draft.pickupTime} onChange={(event) => setDraft({ ...draft, pickupTime: event.target.value })}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label><label><span>Expected finish date</span><input type="date" required min={draft.pickupDate} value={draft.endDate} onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}/></label><label><span>Expected finish</span><select aria-label="Manual ride finish time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label><label><span>Working price</span><div className="workflow-money"><b aria-hidden>$</b><input aria-label="Working price" type="number" inputMode="decimal" min="0" step="0.01" value={draft.price || ''} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}/></div></label><label className="workflow-field-wide"><span>Owner notes</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })}/></label></div></fieldset>
        {conflicts.length > 0 && <div className="conflict-callout" role="alert"><AlertTriangle aria-hidden/><div><strong>Review the schedule before using this draft.</strong>{conflicts.map((item) => <span key={`${item.rideId}:${item.kind}`}>{item.message}</span>)}</div></div>}
        <button className="button primary" type="submit"><Plus aria-hidden/> Add to local review</button>
        {message && <p className="workflow-message" role="status">{message}</p>}
      </form>
      <section className="workflow-card manual-review" aria-labelledby="manual-review-title"><div className="workflow-heading"><div><p className="eyebrow">This device</p><h2 id="manual-review-title">Draft review</h2></div><span>{review.length} draft{review.length === 1 ? '' : 's'}</span></div>{review.length ? <div className="manual-review-list">{review.map((item) => <article key={item.id}><header><div><strong>{item.guestName}</strong><span>{serviceLabels[item.service]} · {item.passengers} passenger{item.passengers === 1 ? '' : 's'}</span></div><button type="button" onClick={() => setReview((current) => { const next = current.filter((draftItem) => draftItem.id !== item.id); storeManualRideDrafts(next); return next; })} aria-label={`Delete local draft for ${item.guestName}`}><Trash2 aria-hidden/></button></header><p>{item.pickupAddress}<i>to</i>{item.destinationAddress}</p><dl><div><dt>Pickup</dt><dd>{formatDate(item.pickupDate)} at {formatTime(item.pickupTime)}</dd></div><div><dt>Expected finish</dt><dd>{formatDate(item.endDate)} at {formatTime(item.endTime)}</dd></div><div><dt>Working price</dt><dd>{formatMoney(item.price || undefined)}</dd></div></dl>{item.notes && <blockquote>{item.notes}</blockquote>}<small>Local review only · not saved to Pxpress records</small></article>)}</div> : <p className="workflow-empty">Saved local drafts appear here until you remove them.</p>}</section>
    </section>
  </div>;
}
