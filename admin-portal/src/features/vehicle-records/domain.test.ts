import { describe, expect, it } from 'vitest';
import { localVehicleDocumentFixtures, localVehicleReminderFixtures } from './fixtures';
import { documentsExpiringSoon, openEstimatedCost, orderReminders, reminderTiming } from './domain';

describe('vehicle records domain', () => {
  const now = new Date('2026-09-01T12:00:00Z');
  it('calculates reminder timing from explicit dates', () => {
    expect(reminderTiming(localVehicleReminderFixtures[0], now)).toBe('due_soon');
    expect(reminderTiming({ ...localVehicleReminderFixtures[0], dueOn: '2026-08-31' }, now)).toBe('overdue');
  });
  it('orders owner attention before scheduled and completed records', () => {
    const completed = { ...localVehicleReminderFixtures[0], id: 'completed', state: 'completed' as const };
    expect(orderReminders([...localVehicleReminderFixtures, completed], now).at(-1)?.id).toBe('completed');
  });
  it('totals only explicit open cost estimates', () => expect(openEstimatedCost(localVehicleReminderFixtures)).toBe(120));
  it('finds only document dates within the explicit 60-day window', () => expect(documentsExpiringSoon(localVehicleDocumentFixtures, now).map((item) => item.kind)).toEqual(['registration']));
  it('does not mark the Ohio business date overdue during the UTC next day', () => expect(reminderTiming({ ...localVehicleReminderFixtures[0], dueOn: '2026-09-01' }, new Date('2026-09-02T02:30:00Z'))).toBe('due_soon'));
});
