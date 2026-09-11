import { describe, expect, it } from 'vitest';
import { customersToCsv } from './Customers';

describe('customer CSV export', () => {
  it('neutralizes customer-controlled formula prefixes while preserving generated values', () => {
    const csv = customersToCsv([{ id: 'customer-1', name: '=Guest', email: ' +guest@example.com', phone: '-2165550100', rides: 2, lastRide: '2026-09-01', totalQuoted: 125 }]);
    expect(csv).toContain('"\'=Guest"');
    expect(csv).toContain('"\' +guest@example.com"');
    expect(csv).toContain('"\'-2165550100"');
    expect(csv).toContain('"2","2026-09-01","125"');
  });
});
