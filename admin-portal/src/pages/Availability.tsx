import { AlertTriangle, CalendarClock, Clock3, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../components/StatePanel';
import { useRequests } from '../hooks';
import { detectScheduleConflicts, rideWindow, timeOptions } from '../lib/schedule';
import { businessDateKey } from '../lib/business-date';
import { detectLocalScheduleConflicts, loadAvailabilityBlocks, loadManualRideDrafts, storeAvailabilityBlocks, type LocalAvailabilityBlock, type LocalManualRideDraft } from '../lib/local-schedule';
import { formatDate, formatTime } from '../lib/selectors';
import type { RideRequest } from '../types';
import '../local-workflow.css';

type AvailabilityKind = 'available' | 'unavailable';
type AvailabilityBlock = LocalAvailabilityBlock;
const newBlock = () => ({ date: businessDateKey(), startTime: '09:00', endTime: '17:00', kind: 'unavailable' as AvailabilityKind, note: '' });
const weekDates = (anchor: string) => {
  const selected = new Date(`${anchor}T12:00:00`);
  const start = new Date(selected);
  start.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
};

export function Availability() {
  const requests = useRequests();
  if (requests.loading) return <StatePanel kind="loading" title="Opening availability"/>;
  if (requests.error) return <StatePanel kind="error" title="Availability could not load the ride schedule" body={requests.error} retry={requests.reload}/>;
  return <AvailabilityContent rides={requests.data}/>;
}

export function AvailabilityContent({ rides }: { rides: RideRequest[] }) {
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>(loadAvailabilityBlocks);
  const [draft, setDraft] = useState(newBlock);
  const [message, setMessage] = useState('');
  const week = useMemo(() => weekDates(draft.date), [draft.date]);
  const conflicts = useMemo(() => {
    const candidate = { label: draft.note || `${draft.kind} block`, startDate: draft.date, startTime: draft.startTime, endDate: draft.date, endTime: draft.endTime };
    return [...detectScheduleConflicts(candidate, rides), ...(draft.kind === 'unavailable' ? detectLocalScheduleConflicts(candidate, blocks, loadManualRideDrafts<LocalManualRideDraft>()) : [])];
  }, [blocks, draft, rides]);
  const scheduledRides = rides.filter((ride) => rideWindow(ride) !== null);

  function commit(next: AvailabilityBlock[], success: string) {
    setBlocks(next);
    setMessage(storeAvailabilityBlocks(next) ? success : 'Change kept for this open page only. Browser storage is unavailable, and nothing was sent elsewhere.');
  }
  function add(event: React.FormEvent) {
    event.preventDefault();
    const block: AvailabilityBlock = { ...draft, id: crypto.randomUUID() };
    commit([...blocks, block], `${draft.kind === 'available' ? 'Available' : 'Unavailable'} block saved on this device only.`);
    setDraft((current) => ({ ...newBlock(), date: current.date }));
  }
  function remove(id: string) { commit(blocks.filter((block) => block.id !== id), 'Local availability block removed.'); }

  return <div className="page availability-page">
    <header className="page-head"><div><p className="eyebrow">Owner schedule</p><h1>Availability</h1><p>Block working time around the rides already on Raishawn’s calendar.</p></div><Link className="button secondary" to="/calendar"><CalendarClock aria-hidden/> Ride calendar</Link></header>
    <aside className="local-scope-note"><LockKeyhole aria-hidden/><span><strong>Device-only planning</strong> Availability blocks stay in this browser. They do not change Google Calendar, contact customers, or write to the Pxpress database.</span></aside>
    <section className="availability-layout">
      <form className="workflow-card availability-editor" onSubmit={add}>
        <div className="workflow-heading"><div><p className="eyebrow">Add a block</p><h2>Protect time on the road</h2></div><Clock3 aria-hidden/></div>
        <div className="workflow-form-grid">
          <label><span>Date</span><input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })}/></label>
          <label><span>Start</span><select aria-label="Availability start time" value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
          <label><span>End</span><select aria-label="Availability end time" value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}>{timeOptions.map((time) => <option key={time.value} value={time.value}>{time.label}</option>)}</select></label>
          <label><span>Block type</span><select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AvailabilityKind })}><option value="unavailable">Unavailable</option><option value="available">Available</option></select></label>
          <label className="workflow-field-full"><span>Owner note</span><input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Personal block, vehicle service, open hours…"/></label>
        </div>
        {conflicts.length > 0 && <div className="conflict-callout" role="alert"><AlertTriangle aria-hidden/><div><strong>{conflicts.some((item) => item.kind === 'overlap') ? 'This time overlaps scheduled work.' : 'This leaves a tight turnaround.'}</strong>{conflicts.map((item) => <span key={`${item.rideId}:${item.kind}`}>{item.message}</span>)}</div></div>}
        <button className="button primary" type="submit"><Plus aria-hidden/> Add local block</button>
        {message && <p className="workflow-message" role="status">{message}</p>}
      </form>

      <section className="availability-week" aria-label="Availability week">
        <div className="workflow-heading"><div><p className="eyebrow">Week view</p><h2>{formatDate(week[0])} – {formatDate(week[6])}</h2></div><span>{blocks.length} local block{blocks.length === 1 ? '' : 's'}</span></div>
        <div className="availability-days">{week.map((date) => {
          const dayRides = scheduledRides.filter((ride) => ride.pickupDate === date);
          const dayBlocks = blocks.filter((block) => block.date === date);
          return <section className="availability-day" key={date}><header><strong>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })}</strong><span>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></header><div>{dayRides.map((ride) => <Link className="schedule-block ride-block" to={`/requests/${ride.id}`} key={ride.id}><strong>{formatTime(ride.pickupTime)}</strong><span>{ride.customerName}</span><small>{ride.requestNumber}</small></Link>)}{dayBlocks.map((block) => <article className={`schedule-block local-block block-${block.kind}`} key={block.id}><strong>{formatTime(block.startTime)} – {formatTime(block.endTime)}</strong><span>{block.note || (block.kind === 'available' ? 'Available' : 'Unavailable')}</span><button type="button" onClick={() => remove(block.id)} aria-label={`Remove ${formatTime(block.startTime)} ${block.kind} block`}><Trash2 aria-hidden/></button></article>)}{!dayRides.length && !dayBlocks.length && <p>Open</p>}</div></section>;
        })}</div>
      </section>
    </section>
  </div>;
}
