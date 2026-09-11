import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: null,
  tableNames: { requests: 'ride_requests', history: 'ride_request_history' },
  analyticsViews: { daily: 'daily', pages: 'pages', sources: 'sources', services: 'services' },
  wixReconciliationEnabled: false,
}));

import { calculateRouteEstimate, clearRouteEstimateSessionCache } from './repository';

describe('route estimate without a private endpoint', () => {
  it('fails precisely and leaves manual mileage as the supported path', async () => {
    clearRouteEstimateSessionCache();
    await expect(calculateRouteEstimate('c148e5ee-31b3-4077-985a-74963aaf1d2b')).rejects.toThrow(/private data service.*manual mileage/i);
  });
});
