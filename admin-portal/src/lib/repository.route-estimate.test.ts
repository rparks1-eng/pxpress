import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: mock.invoke } },
  tableNames: { requests: 'ride_requests', history: 'ride_request_history' },
  analyticsViews: { daily: 'daily', pages: 'pages', sources: 'sources', services: 'services' },
  wixReconciliationEnabled: false,
}));

import { calculateRouteEstimate, clearRouteEstimateSessionCache, normalizeEstimate } from './repository';

const id = 'c148e5ee-31b3-4077-985a-74963aaf1d2b';
const estimate = {
  ride_request_id: id, base_address: '10273 Maryland St., Reminderville, OH 44202', pickup_address: 'Pickup', destination_address: 'Destination',
  base_to_pickup_miles: 10, pickup_to_destination_miles: 20, destination_to_base_miles: 30, total_miles: 60, total_duration_minutes: 90,
  calculated_at: '2026-09-02T18:00:00Z', route_legs: [
    { origin: '10273 Maryland St., Reminderville, OH 44202', destination: 'Pickup', miles: 10, durationMinutes: 15 },
    { origin: 'Pickup', destination: 'Destination', miles: 20, durationMinutes: 30 },
    { origin: 'Destination', destination: '10273 Maryland St., Reminderville, OH 44202', miles: 30, durationMinutes: 45 },
  ],
};

describe('route estimate repository', () => {
  beforeEach(() => { vi.clearAllMocks(); clearRouteEstimateSessionCache(); });

  it('reuses a successful result for the open app session without another provider invocation', async () => {
    mock.invoke.mockResolvedValue({ data: { estimate }, error: null, response: undefined });
    await expect(calculateRouteEstimate(id)).resolves.toMatchObject({ totalMiles: 60 });
    await expect(calculateRouteEstimate(id)).resolves.toMatchObject({ totalMiles: 60 });
    expect(mock.invoke).toHaveBeenCalledOnce();
  });

  it('coalesces duplicate clicks into one in-flight request', async () => {
    let resolve!: (value: unknown) => void;
    mock.invoke.mockReturnValue(new Promise((done) => { resolve = done; }));
    const first = calculateRouteEstimate(id), second = calculateRouteEstimate(id);
    resolve({ data: { estimate }, error: null, response: undefined });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(mock.invoke).toHaveBeenCalledOnce();
  });

  it('does not reuse mileage after a route changes on the same ride', async () => {
    mock.invoke.mockResolvedValue({data:{estimate},error:null});
    await calculateRouteEstimate(id,'original route');
    await calculateRouteEstimate(id,'changed return stop');
    expect(mock.invoke).toHaveBeenCalledTimes(2);
  });

  it('rejects a result belonging to another ride', async () => {
    mock.invoke.mockResolvedValue({data:{estimate:{...estimate,ride_request_id:'another-ride'}},error:null});
    await expect(calculateRouteEstimate(id)).rejects.toThrow('Mileage did not match this ride');
  });

  it('does not cache provider failures and permits an explicit retry', async () => {
    mock.invoke.mockResolvedValueOnce({ data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function' }, response: undefined })
      .mockResolvedValueOnce({ data: { estimate }, error: null, response: undefined });
    await expect(calculateRouteEstimate(id)).rejects.toThrow(/could not be reached/i);
    await expect(calculateRouteEstimate(id)).resolves.toMatchObject({ totalMiles: 60 });
    expect(mock.invoke).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed provider readback instead of showing invented zeroes', () => {
    expect(() => normalizeEstimate({ ...estimate, total_miles: undefined })).toThrow(/incomplete mileage result/i);
    expect(() => normalizeEstimate({ ...estimate, total_miles: 0 })).toThrow(/incomplete mileage result/i);
    expect(() => normalizeEstimate({ ...estimate, route_legs: [{ origin: 'A', destination: 'B', miles: 0, durationMinutes: 1 }] })).toThrow(/incomplete mileage result/i);
  });

  it('accepts a zero first leg when base and pickup resolve to the same place and the overall route is positive', () => {
    expect(normalizeEstimate({
      ...estimate,
      base_to_pickup_miles: 0,
      total_miles: 50,
      total_duration_minutes: 75,
      route_legs: [
        { origin: estimate.base_address, destination: 'Pickup', miles: 0, durationMinutes: 0 },
        { origin: 'Pickup', destination: 'Destination', miles: 20, durationMinutes: 30 },
        { origin: 'Destination', destination: estimate.base_address, miles: 30, durationMinutes: 45 },
      ],
    })).toMatchObject({ baseToPickupMiles: 0, totalMiles: 50, totalDurationMinutes: 75 });
  });

  it('preserves an ephemeral-cache receipt without relabeling it as a provider lookup', () => {
    expect(normalizeEstimate({ ...estimate, cache_status: 'cache', provider_version: 'directions-v2-traffic-unaware-v1' })).toMatchObject({
      cacheStatus: 'cache', providerVersion: 'directions-v2-traffic-unaware-v1', sourceAttribution: 'Google Maps', totalMiles: 60,
    });
  });
});
