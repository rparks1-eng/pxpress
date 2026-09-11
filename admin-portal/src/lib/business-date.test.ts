import { describe, expect, it } from 'vitest';
import { businessDateKey, dateKeyOrdinal } from './business-date';

describe('Pxpress business dates', () => {
  it('keeps late Ohio evenings on the correct local calendar day', () => {
    expect(businessDateKey(new Date('2026-09-02T02:30:00Z'))).toBe('2026-09-01');
    expect(businessDateKey(new Date('2026-01-02T03:30:00Z'))).toBe('2026-01-01');
  });

  it('compares date-only values without UTC offset drift', () => {
    expect(dateKeyOrdinal('2026-09-02') - dateKeyOrdinal('2026-09-01')).toBe(1);
  });
});
