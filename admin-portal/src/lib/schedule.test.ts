import { describe, expect, it } from 'vitest';
import { demoRequests } from '../demo-data';
import { detectScheduleConflicts, timeOptions } from './schedule';

describe('local schedule conflict helper', () => {
  const ride = { ...demoRequests[2], status: 'confirmed' as const, pickupDate: '2026-09-12', pickupTime: '18:15', returnDate: '2026-09-12', returnTime: '23:15' };

  it('warns on an overlap without calling a route provider', () => {
    const result = detectScheduleConflicts({ label: 'Manual ride', startDate: '2026-09-12', startTime: '17:30', endTime: '19:00' }, [ride]);
    expect(result).toMatchObject([{ rideId: ride.id, kind: 'overlap', minutesApart: 0 }]);
  });

  it('warns on a turnaround under one hour and allows a wider gap', () => {
    expect(detectScheduleConflicts({ label: 'Block', startDate: '2026-09-12', startTime: '16:30', endTime: '17:30' }, [ride])).toMatchObject([{ kind: 'tight_turnaround', minutesApart: 45 }]);
    expect(detectScheduleConflicts({ label: 'Block', startDate: '2026-09-12', startTime: '15:00', endTime: '16:30' }, [ride])).toEqual([]);
  });

  it('uses explicit 12-hour AM and PM labels', () => {
    expect(timeOptions.find((option) => option.value === '00:15')?.label).toBe('12:15 AM');
    expect(timeOptions.find((option) => option.value === '13:45')?.label).toBe('1:45 PM');
  });
});
