import { describe, expect, it } from 'vitest';
import { detectLocalScheduleConflicts } from './local-schedule';

const candidate = { label: 'Taylor Guest', startDate: '2026-09-02', startTime: '10:00', endDate: '2026-09-02', endTime: '11:00' };

describe('combined device-local schedule conflicts', () => {
  it('warns when a manual ride overlaps an unavailable block', () => {
    const conflicts = detectLocalScheduleConflicts(candidate, [{ id: 'block-1', date: '2026-09-02', startTime: '09:30', endTime: '10:30', kind: 'unavailable', note: 'Vehicle service' }], []);
    expect(conflicts[0]).toMatchObject({ kind: 'overlap', requestNumber: 'unavailable block' });
  });

  it('warns when a manual ride overlaps another local draft but ignores available blocks', () => {
    const conflicts = detectLocalScheduleConflicts(candidate, [{ id: 'open-1', date: '2026-09-02', startTime: '09:00', endTime: '17:00', kind: 'available', note: 'Open' }], [{ id: 'draft-1', guestName: 'Jordan', pickupDate: '2026-09-02', pickupTime: '10:30', endDate: '2026-09-02', endTime: '11:30' }]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: 'overlap', requestNumber: 'local draft' });
  });
});
