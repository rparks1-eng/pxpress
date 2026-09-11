import { describe, expect, it } from 'vitest';
import { demoRequests } from '../../demo-data';
import { buildGuestProfile, inferRepeatedAddresses } from './selectors';

describe('guest profile selectors', () => {
  it('builds paid and quoted totals only from recorded request fields', () => {
    const profile = buildGuestProfile(demoRequests, 'customer-jordan', new Date('2026-09-01T12:00:00Z'));
    expect(profile).toMatchObject({ name: 'Jordan Ellis', totalQuoted: 148, totalPaid: 148 });
    expect(profile?.nextRide?.requestNumber).toBe('PXR-1048');
    expect(profile?.lastCompletedRide?.requestNumber).toBe('PXR-1045');
  });

  it('labels only addresses that actually repeat in recorded request roles', () => {
    const addresses = inferRepeatedAddresses(demoRequests.filter((request) => request.customerId === 'customer-jordan'));
    expect(addresses[0]).toMatchObject({ address: 'Shaker Heights, OH', appearances: 3 });
    expect(addresses[0].roles).toEqual(['pickup', 'return']);
  });

  it('returns null instead of inventing a customer profile', () => {
    expect(buildGuestProfile(demoRequests, 'missing-customer')).toBeNull();
  });

  it('classifies rides by the Ohio business date near UTC midnight', () => {
    const profile = buildGuestProfile(demoRequests, 'customer-jordan', new Date('2026-09-02T02:30:00Z'));
    expect(profile?.nextRide?.requestNumber).toBe('PXR-1048');
  });
});
