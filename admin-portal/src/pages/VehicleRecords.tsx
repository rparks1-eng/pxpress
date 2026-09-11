import { CarFront, LockKeyhole, Plus, RotateCcw, ShieldCheck, Wrench } from 'lucide-react';
import { useState } from 'react';
import { DocumentMetadataPanel } from '../features/vehicle-records/DocumentMetadataPanel';
import { ReminderBoard } from '../features/vehicle-records/ReminderBoard';
import { documentsExpiringSoon, openEstimatedCost, reminderTiming } from '../features/vehicle-records/domain';
import { localVehicleDocumentFixtures, localVehicleReminderFixtures } from '../features/vehicle-records/fixtures';
import type { VehicleDocumentMetadata, VehicleReminder, VehicleRecordType } from '../features/vehicle-records/types';
import '../features/vehicle-records/vehicle-records.css';

const emptyReminder = () => ({ type: 'maintenance' as VehicleRecordType, title: '', dueOn: '', odometerMiles: '', estimatedCost: '', note: '' });

export function VehicleRecords() {
  const [reminders, setReminders] = useState<VehicleReminder[]>(() => structuredClone(localVehicleReminderFixtures));
  const [documents, setDocuments] = useState<VehicleDocumentMetadata[]>(() => structuredClone(localVehicleDocumentFixtures));
  const [draft, setDraft] = useState(emptyReminder);
  const [showForm, setShowForm] = useState(false);
  const open = reminders.filter((reminder) => reminder.state === 'open');
  const dueSoon = open.filter((reminder) => ['overdue', 'due_soon'].includes(reminderTiming(reminder))).length;
  const expiring = documentsExpiringSoon(documents).length;
  function addReminder(event: React.FormEvent) { event.preventDefault(); if (!draft.title.trim() || !draft.dueOn) return; const now = new Date().toISOString(); setReminders((current) => [{ id: crypto.randomUUID(), type: draft.type, title: draft.title.trim(), dueOn: draft.dueOn, state: 'open', odometerMiles: draft.odometerMiles ? Number(draft.odometerMiles) : undefined, estimatedCost: draft.estimatedCost ? Number(draft.estimatedCost) : undefined, note: draft.note.trim() || undefined, createdAt: now }, ...current]); setDraft(emptyReminder()); setShowForm(false); }
  function resetPreview() { setReminders(structuredClone(localVehicleReminderFixtures)); setDocuments(structuredClone(localVehicleDocumentFixtures)); }
  return <div className="page vehicle-records-page">
    <header className="page-head"><div><p className="eyebrow">Vehicle stewardship</p><h1>Vehicle & records</h1><p>Keep maintenance, required-document dates, and expense follow-ups visible without placing sensitive files in an unconfigured system.</p></div><span className="vehicle-local-state"><LockKeyhole aria-hidden/> Local preview</span></header>
    <aside className="vehicle-local-banner"><ShieldCheck aria-hidden/><div><strong>Device-local planning only</strong><span>These example reminders and document notes reset on page reload or unmount. No file upload, cloud storage, provider call, or Supabase write occurs.</span></div><button type="button" onClick={resetPreview}><RotateCcw aria-hidden/> Reset preview</button></aside>
    <section className="vehicle-record-rail"><div><Wrench aria-hidden/><span>Open reminders</span><strong>{open.length}</strong></div><div><CarFront aria-hidden/><span>Due or overdue</span><strong>{dueSoon}</strong></div><div><ShieldCheck aria-hidden/><span>Documents expiring in 60 days</span><strong>{expiring}</strong></div><div><span>Open cost estimates</span><strong>${openEstimatedCost(reminders).toLocaleString()}</strong><small>Not actual spend</small></div></section>
    <div className="vehicle-action-row"><button type="button" className="button primary" onClick={() => setShowForm((value) => !value)}><Plus aria-hidden/>{showForm ? 'Close reminder form' : 'Add reminder'}</button></div>
    {showForm && <form className="vehicle-reminder-form" onSubmit={addReminder}><label><span>Type</span><select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as VehicleRecordType })}><option value="maintenance">Maintenance</option><option value="registration">Registration</option><option value="insurance">Insurance</option><option value="expense_follow_up">Expense follow-up</option></select></label><label><span>Reminder</span><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label><label><span>Due date</span><input required type="date" value={draft.dueOn} onChange={(event) => setDraft({ ...draft, dueOn: event.target.value })}/></label><label><span>Odometer miles</span><input inputMode="numeric" type="number" min="0" value={draft.odometerMiles} onChange={(event) => setDraft({ ...draft, odometerMiles: event.target.value })}/></label><label><span>Estimated cost</span><input inputMode="decimal" type="number" min="0" step="0.01" value={draft.estimatedCost} onChange={(event) => setDraft({ ...draft, estimatedCost: event.target.value })}/></label><label className="vehicle-note-field"><span>Note</span><input value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })}/></label><button type="submit" className="button primary">Add locally</button></form>}
    <section className="vehicle-record-layout"><ReminderBoard reminders={reminders} onComplete={(id) => setReminders((current) => current.map((reminder) => reminder.id === id ? { ...reminder, state: 'completed' } : reminder))}/><DocumentMetadataPanel documents={documents} onAdd={(document) => setDocuments((current) => [{ ...document, id: crypto.randomUUID(), source: 'manual_metadata', createdAt: new Date().toISOString() }, ...current])}/></section>
  </div>;
}
