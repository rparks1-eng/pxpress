import { beforeEach, describe, expect, it } from 'vitest';
import { demoRequests } from '../../demo-data';
import { buildManualRouteEstimate } from './ManualMileageEditor';
import { readRouteEstimateSession, writeRouteEstimateSession } from './session-cache';

describe('tab-session route estimate cache', () => {
  const request = { ...demoRequests[0], tripType: 'One way' };
  const estimate = buildManualRouteEstimate(request, [10, 20, 30], [15, 30, 45]);
  beforeEach(() => sessionStorage.clear());

  it('restores the same route after refresh without another lookup', () => {
    expect(writeRouteEstimateSession(request, estimate, 1_000)).toBe(true);
    expect(readRouteEstimateSession(request, 2_000)).toEqual(estimate);
  });

  it('rejects changed routes and expired or malformed entries', () => {
    writeRouteEstimateSession(request, estimate, 1_000);
    expect(readRouteEstimateSession({ ...request, destinationAddress: 'Different destination' }, 2_000)).toBeNull();
    writeRouteEstimateSession(request, estimate, 1_000);
    expect(readRouteEstimateSession(request, 1_000 + 24 * 60 * 60 * 1_000 + 1)).toBeNull();
  });

  it('rejects another ride identity and future-dated cache entries', () => {
    const key = `pxpress-route-estimate-v1:${request.id}`;
    writeRouteEstimateSession(request, estimate, 1_000);
    const envelope = JSON.parse(sessionStorage.getItem(key)!);
    envelope.estimate.rideRequestId = 'another-ride';
    sessionStorage.setItem(key, JSON.stringify(envelope));
    expect(readRouteEstimateSession(request, 2_000)).toBeNull();
    writeRouteEstimateSession(request, estimate, 3_000);
    expect(readRouteEstimateSession(request, 2_000)).toBeNull();
  });
});
