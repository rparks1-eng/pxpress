import { Check, CircleAlert, Gauge, Wrench } from 'lucide-react';
import { orderReminders, reminderTiming } from './domain';
import type { VehicleReminder } from './types';

const labels = { maintenance: 'Maintenance', registration: 'Registration', insurance: 'Insurance', expense_follow_up: 'Expense follow-up' } as const;
const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function ReminderBoard({ reminders, onComplete }: { reminders: VehicleReminder[]; onComplete: (id: string) => void }) {
  return <section className="vehicle-card reminder-board"><header><div><p className="eyebrow">Owner schedule</p><h2>Vehicle reminders</h2></div><Wrench aria-hidden/></header><div>{orderReminders(reminders).map((reminder) => { const timing = reminderTiming(reminder); return <article key={reminder.id} className={`reminder-${timing}`}>
    <div className="reminder-icon">{timing === 'overdue' ? <CircleAlert aria-hidden/> : reminder.odometerMiles ? <Gauge aria-hidden/> : <Wrench aria-hidden/>}</div>
    <div><span>{labels[reminder.type]} · {timing.replace('_', ' ')}</span><strong>{reminder.title}</strong><small>Due {date(reminder.dueOn)}{reminder.odometerMiles ? ` · ${reminder.odometerMiles.toLocaleString()} mi` : ''}{reminder.estimatedCost ? ` · $${reminder.estimatedCost.toLocaleString()} estimate` : ''}</small>{reminder.note && <p>{reminder.note}</p>}</div>
    <button type="button" onClick={() => onComplete(reminder.id)} disabled={reminder.state === 'completed'}><Check aria-hidden/>{reminder.state === 'completed' ? 'Completed' : 'Mark complete'}</button>
  </article>; })}</div></section>;
}
