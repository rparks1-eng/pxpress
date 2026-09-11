import { ArrowLeft, CalendarClock, Mail, MapPinned, Phone, Route, StickyNote, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { StatePanel } from '../components/StatePanel';
import { useRequests } from '../hooks';
import { buildGuestProfile } from '../features/guest-profile/selectors';
import { formatTime } from '../lib/selectors';
import '../features/guest-profile/guest-profile.css';

const money = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const rideDate = (value?: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not recorded';
const serviceLabel = { airport: 'Airport transfer', appointment: 'Appointment', point: 'Point-to-point', events: 'Event operations', hourly: 'Hourly transportation' } as const;

export function GuestProfile() {
  const { id = '' } = useParams();
  const requests = useRequests();
  const [preferredContact, setPreferredContact] = useState('Not recorded');
  const [preferences, setPreferences] = useState('');
  const [privateNote, setPrivateNote] = useState('');
  if (requests.loading) return <StatePanel kind="loading" title="Opening guest profile"/>;
  if (requests.error) return <StatePanel kind="error" title="Guest profile could not be loaded" body={requests.error} retry={requests.reload}/>;
  const profile = buildGuestProfile(requests.data, id);
  if (!profile) return <div className="page"><Link className="back-link" to="/customers"><ArrowLeft aria-hidden/> Customers</Link><StatePanel kind="empty" title="Guest not found" body="No recorded ride requests match this customer."/></div>;

  return <div className="page guest-profile-page">
    <Link className="back-link" to="/customers"><ArrowLeft aria-hidden/> Customer directory</Link>
    <header className="guest-profile-hero"><div className="guest-profile-monogram" aria-hidden>{profile.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><p className="eyebrow">Guest profile</p><h1>{profile.name}</h1><p>{profile.history.length} recorded request{profile.history.length === 1 ? '' : 's'} · details shown only from existing Pxpress records</p></div><div className="guest-contact-actions">{profile.phone ? <a className="button secondary" href={`tel:${profile.phone}`}><Phone aria-hidden/> Call</a> : <button className="button secondary" type="button" disabled title="No phone number is recorded"><Phone aria-hidden/> Call unavailable</button>}{profile.email ? <a className="button primary" href={`mailto:${profile.email}`}><Mail aria-hidden/> Email</a> : <button className="button primary" type="button" disabled title="No email address is recorded"><Mail aria-hidden/> Email unavailable</button>}</div></header>
    <section className="guest-value-rail"><div><span>Total quoted</span><strong>{money(profile.totalQuoted)}</strong><small>Recorded quote amounts</small></div><div><span>Recorded paid</span><strong>{money(profile.totalPaid)}</strong><small>Only requests marked paid</small></div><div><span>Last completed ride</span><strong>{rideDate(profile.lastCompletedRide?.pickupDate)}</strong><small>{profile.lastCompletedRide?.requestNumber ?? 'None recorded'}</small></div><div><span>Next scheduled request</span><strong>{rideDate(profile.nextRide?.pickupDate)}</strong><small>{profile.nextRide?.status.replaceAll('_', ' ') ?? 'None recorded'}</small></div></section>
    <section className="guest-profile-layout">
      <article className="guest-profile-card guest-ride-history"><header><div><p className="eyebrow">Recorded activity</p><h2>Ride history</h2></div><Route aria-hidden/></header><div>{profile.history.map((request) => <Link to={`/requests/${request.id}`} key={request.id}><span className="guest-history-date"><strong>{rideDate(request.pickupDate)}</strong><small>{formatTime(request.pickupTime)}</small></span><span><strong>{serviceLabel[request.service]}</strong><small>{request.pickupAddress} → {request.destinationAddress}</small></span><span className={`guest-history-status status-${request.status}`}>{request.status.replaceAll('_', ' ')}</span></Link>)}</div></article>
      <aside className="guest-profile-stack">
        <article className="guest-profile-card guest-addresses"><header><div><p className="eyebrow">Inferred carefully</p><h2>Repeated addresses</h2></div><MapPinned aria-hidden/></header><p>Shown only when the same address appears more than once in this guest’s recorded requests. These are not claimed as saved or preferred.</p>{profile.repeatedAddresses.length ? <div>{profile.repeatedAddresses.map((row) => <section key={row.address}><strong>{row.address}</strong><span>{row.appearances} appearances · {row.roles.join(', ')}</span></section>)}</div> : <p className="guest-empty">No repeated address yet.</p>}</article>
        <article className="guest-profile-card guest-contact"><header><div><p className="eyebrow">Contact record</p><h2>Reach the guest</h2></div><UserRound aria-hidden/></header>{profile.email ? <a href={`mailto:${profile.email}`}><Mail aria-hidden/>{profile.email}</a> : <p className="guest-empty">No email recorded.</p>}{profile.phone ? <a href={`tel:${profile.phone}`}><Phone aria-hidden/>{profile.phone}</a> : <p className="guest-empty">No phone recorded.</p>}</article>
      </aside>
    </section>
    <section className="guest-profile-card guest-local-notes"><header><div><p className="eyebrow">Device-local workspace</p><h2>Preferences & private notes</h2></div><StickyNote aria-hidden/></header><p className="guest-local-warning">These fields are not saved to Supabase or any customer record. They reset when this page reloads or unmounts.</p><div><label><span>Preferred contact</span><select value={preferredContact} onChange={(event) => setPreferredContact(event.target.value)}><option>Not recorded</option><option>Call</option><option>Text</option><option>Email</option></select></label><label><span>Rider preferences</span><textarea rows={4} value={preferences} onChange={(event) => setPreferences(event.target.value)} placeholder="Device-local working notes only"/></label><label><span>Private owner note</span><textarea rows={4} value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} placeholder="Not shared with the guest"/></label></div><p><CalendarClock aria-hidden/> No saved preference is inferred from ride history. Record only what the guest has directly provided.</p></section>
  </div>;
}
