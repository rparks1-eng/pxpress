import type { ReminderTiming, VehicleDocumentMetadata, VehicleReminder } from './types';
import { businessDateKey, dateKeyOrdinal } from '../../lib/business-date';

export function reminderTiming(reminder: VehicleReminder, now = new Date()): ReminderTiming {
  if (reminder.state === 'completed') return 'completed';
  const today = dateKeyOrdinal(businessDateKey(now));
  const due = dateKeyOrdinal(reminder.dueOn);
  if (due < today) return 'overdue';
  if (due - today <= 30) return 'due_soon';
  return 'scheduled';
}

export function orderReminders(reminders: VehicleReminder[], now = new Date()) {
  const rank: Record<ReminderTiming, number> = { overdue: 0, due_soon: 1, scheduled: 2, completed: 3 };
  return [...reminders].sort((a, b) => rank[reminderTiming(a, now)] - rank[reminderTiming(b, now)] || a.dueOn.localeCompare(b.dueOn));
}

export const openEstimatedCost = (reminders: VehicleReminder[]) => reminders.filter((reminder) => reminder.state === 'open').reduce((total, reminder) => total + (reminder.estimatedCost ?? 0), 0);

export function documentsExpiringSoon(documents: VehicleDocumentMetadata[], now = new Date()) {
  const today = dateKeyOrdinal(businessDateKey(now));
  return documents.filter((document) => {
    if (!document.expiresOn) return false;
    const expiry = dateKeyOrdinal(document.expiresOn);
    return expiry >= today && expiry - today <= 60;
  }).sort((a, b) => (a.expiresOn ?? '').localeCompare(b.expiresOn ?? ''));
}
