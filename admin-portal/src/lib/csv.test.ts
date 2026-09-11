import { describe, expect, it } from 'vitest';
import { csvCell } from './csv';

describe('CSV cell hardening', () => {
  it.each([
    ['=SUM(A1:A2)', '"\'=SUM(A1:A2)"'],
    [' +cmd', '"\' +cmd"'],
    ['\t-2+3', '"\'\t-2+3"'],
    ['@IMPORTDATA("https://example.invalid")', '"\'@IMPORTDATA(""https://example.invalid"")"'],
  ])('neutralizes the dangerous first non-whitespace prefix in %j', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it('preserves ordinary text, quotes, generated numbers, and ISO dates', () => {
    expect(csvCell('Vendor, "North"')).toBe('"Vendor, ""North"""');
    expect(csvCell(-42.5)).toBe('"-42.5"');
    expect(csvCell('2026-09-01')).toBe('"2026-09-01"');
  });
});
