import type { VehicleDocumentMetadata, VehicleReminder } from './types';

export const localVehicleReminderFixtures: VehicleReminder[] = [
  { id: 'vehicle-reminder-local-1', type: 'maintenance', title: 'Oil and filter service', dueOn: '2026-09-18', state: 'open', odometerMiles: 74200, estimatedCost: 120, note: 'Example preview record', createdAt: '2026-09-01T12:00:00Z' },
  { id: 'vehicle-reminder-local-2', type: 'registration', title: 'Registration renewal check', dueOn: '2026-10-15', state: 'open', note: 'Confirm the actual renewal date before relying on this reminder.', createdAt: '2026-09-01T12:00:00Z' },
  { id: 'vehicle-reminder-local-3', type: 'insurance', title: 'Insurance policy review', dueOn: '2026-11-01', state: 'open', note: 'Example preview record', createdAt: '2026-09-01T12:00:00Z' },
  { id: 'vehicle-reminder-local-4', type: 'expense_follow_up', title: 'Attach maintenance receipt metadata', dueOn: '2026-09-05', state: 'open', note: 'Expense follow-up only. No receipt upload.', createdAt: '2026-09-01T12:00:00Z' },
];

export const localVehicleDocumentFixtures: VehicleDocumentMetadata[] = [
  { id: 'vehicle-document-local-1', kind: 'registration', label: 'Vehicle registration', documentReference: 'Local metadata example', effectiveOn: '2026-01-01', expiresOn: '2026-10-15', source: 'manual_metadata', createdAt: '2026-09-01T12:00:00Z' },
  { id: 'vehicle-document-local-2', kind: 'insurance', label: 'Commercial auto policy', documentReference: 'Enter policy reference locally', expiresOn: '2026-11-01', source: 'manual_metadata', createdAt: '2026-09-01T12:00:00Z' },
];
