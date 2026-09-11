import { describe, expect, it } from 'vitest';
import { localInsightsPreview } from './fixtures';
import { buildFunnel, computeBusinessInsights } from './selectors';

describe('business insight selectors', () => {
  it('computes the request funnel from recorded request states', () => {
    expect(buildFunnel(localInsightsPreview.requests).map((stage) => [stage.key, stage.count])).toEqual([
      ['received', 4], ['quoted', 3], ['confirmed', 2], ['completed', 1],
    ]);
  });

  it('uses only paid request amounts as paid revenue', () => {
    const result = computeBusinessInsights(localInsightsPreview);
    expect(result.revenue.paidRevenue).toBe(373);
    expect(result.revenue.paidRideCount).toBe(2);
    expect(result.revenue.quotedValue).toBe(713);
  });

  it('computes expenses from reviewed business shares and exposes completeness gaps', () => {
    const result = computeBusinessInsights(localInsightsPreview);
    expect(result.efficiency.reviewedOperatingExpense).toBeCloseTo(257.86, 2);
    expect(result.completeness.find((row) => row.key === 'receipts')).toMatchObject({ complete: 1, total: 3 });
    expect(result.completeness.find((row) => row.key === 'routes')).toMatchObject({ complete: 0, total: 2, rate: 0 });
    expect(result.efficiency.recordedRouteMiles).toBeNull();
  });

  it('totals only applicable cached route mileage and distinguishes a missing record from zero', () => {
    const requests = localInsightsPreview.requests.map((request, index) => index === 0 ? { ...request, status: 'completed' as const, cachedRouteMiles: 18.2 } : request);
    expect(computeBusinessInsights({ ...localInsightsPreview, requests }).efficiency.recordedRouteMiles).toBeCloseTo(18.2);
  });

  it('returns null rates instead of fabricated percentages for empty inputs', () => {
    const result = computeBusinessInsights({ requests: [], expenses: [], source: 'not_connected', periodLabel: 'None' });
    expect(result.revenue.averagePaidRide).toBeNull();
    expect(result.customers.repeatCustomerRate).toBeNull();
    expect(result.efficiency.contributionBeforeUntrackedCosts).toBeNull();
  });

  it('never treats a disconnected expense ledger as zero cost against live request revenue', () => {
    const result = computeBusinessInsights({
      requests: localInsightsPreview.requests,
      expenses: [],
      source: 'live_requests_expenses_disconnected',
      periodLabel: 'Live requests · expense ledger off',
    });
    expect(result.revenue.paidRevenue).toBe(373);
    expect(result.efficiency.contributionBeforeUntrackedCosts).toBeNull();
    expect(result.efficiency.expenseToPaidRevenueRate).toBeNull();
    expect(result.efficiency.costPerCompletedRide).toBeNull();
  });
});
