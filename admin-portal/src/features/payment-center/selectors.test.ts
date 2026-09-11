import { describe, expect, it } from 'vitest';
import { demoRequests } from '../../demo-data';
import { buildPaymentRows, paymentLaneCounts, recordedPaidTotalsByCurrency } from './selectors';

describe('payment center selectors', () => {
  it('maps only recorded payment states into payment lanes', () => {
    const rows = buildPaymentRows(demoRequests);
    expect(paymentLaneCounts(rows)).toEqual({ awaiting_payment: 0, paid: 2, failed: 0, refunded: 0, not_requested: 2 });
    expect(recordedPaidTotalsByCurrency(rows)).toEqual({ totals: [], missingCurrencyCount: 2 });
  });

  it('surfaces missing price data instead of fabricating an amount', () => {
    const row = buildPaymentRows([demoRequests[0]])[0];
    expect(row).toMatchObject({ amount: null, completeness: 'missing_price', lane: 'not_requested' });
  });

  it('keeps failed and refunded states distinct', () => {
    const failed = { ...demoRequests[1], paymentStatus: 'failed' as const };
    const refunded = { ...demoRequests[2], paymentStatus: 'refunded' as const };
    expect(buildPaymentRows([failed, refunded]).map((row) => row.lane)).toEqual(['failed', 'refunded']);
  });

  it('groups recorded paid amounts by explicit currency without mixing them', () => {
    const rows = buildPaymentRows([{ ...demoRequests[2], currency: 'USD' }, { ...demoRequests[3], currency: 'CAD' }]);
    expect(recordedPaidTotalsByCurrency(rows)).toEqual({ totals: [{ currency: 'CAD', amount: 148 }, { currency: 'USD', amount: 225 }], missingCurrencyCount: 0 });
  });
});
