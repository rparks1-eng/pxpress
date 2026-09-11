import { describe, expect, it } from 'vitest';
import { emptyQuoteBreakdown, quoteCustomerTotal, validateQuoteBreakdown } from './quote-builder';

describe('local quote builder', () => {
  it('adds fare items, subtracts discounts, and never adds the planned deposit', () => {
    const quote = { ...emptyQuoteBreakdown(150), tolls: 8, parking: 12, discount: 20, deposit: 50 };
    expect(quoteCustomerTotal(quote)).toBe(150);
    expect(validateQuoteBreakdown(quote)).toBe('');
  });

  it('rejects a deposit above the customer total', () => {
    expect(validateQuoteBreakdown({ ...emptyQuoteBreakdown(100), deposit: 101 })).toMatch(/cannot be greater/i);
  });
});

