import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: { from: vi.fn(), rpc: mock.rpc, functions: { invoke: vi.fn() } },
  tableNames: { requests: 'ride_requests', history: 'ride_request_history' },
  analyticsViews: { daily: 'daily', pages: 'pages', sources: 'sources', services: 'services' },
  wixReconciliationEnabled: false,
}));

import {
  FINDER_REVIEW_NOT_CONNECTED_REASON,
  isOptionalFinderReviewSchemaMiss,
  readOhioFinderReview,
} from './repository';

const rideRequestId = 'c148e5ee-31b3-4077-985a-74963aaf1d2b';
const reviewed = {
  status: 'verified',
  finderAuditId: '00000000-0000-4000-8000-000000000001',
  source: 'Ohio Department of Taxation Finder',
  sourceReference: 'official-address-result',
  sourceEventId: `ride:${rideRequestId}:finder:one`,
  jurisdiction: { countryCode: 'US', subdivisionCode: 'OH', county: 'Summit' },
  jurisdictionLabel: 'Summit County, Ohio',
  rateBasisPoints: 675,
  lookupStatus: 'cached',
  effectiveDate: '2026-09-02',
  observedAt: '2026-09-02T15:00:00.000Z',
  expiresAt: '2026-09-03T15:00:00.000Z',
  transportationSourcingPolicyConfirmed: true,
  humanConfirmationStatus: 'confirmed',
  reviewedBy: '00000000-0000-4000-8000-000000000002',
  reviewedAt: '2026-09-02T15:05:00.000Z',
  reviewPolicySource: 'Owner-reviewed policy source',
  reviewPolicyDate: '2026-09-02',
  reviewReason: 'Exact address and source reviewed.',
};

describe('optional Finder review readback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a structured unavailable state only when the optional RPC is absent', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_read_ohio_finder_review in the schema cache' } });
    await expect(readOhioFinderReview(rideRequestId)).resolves.toEqual({ status: 'unavailable', reason: FINDER_REVIEW_NOT_CONNECTED_REASON });
    expect(isOptionalFinderReviewSchemaMiss({ code: '42P01', message: 'relation "pxpress_private.ohio_finder_review_decisions" does not exist' })).toBe(true);
    expect(isOptionalFinderReviewSchemaMiss({ code: 'PGRST202', message: 'some_other_function is missing' })).toBe(false);
  });

  it('does not convert authorization or permission failures into feature unavailability', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    await expect(readOhioFinderReview(rideRequestId)).rejects.toThrow('Finder review access was denied');
  });

  it('does not convert a network failure into feature unavailability', async () => {
    mock.rpc.mockRejectedValue(new Error('Failed to fetch'));
    await expect(readOhioFinderReview(rideRequestId)).rejects.toThrow('Failed to fetch');
  });

  it('rejects malformed successful data', async () => {
    mock.rpc.mockResolvedValue({ data: { status: 'verified', finderAuditId: 'not-a-uuid' }, error: null });
    await expect(readOhioFinderReview(rideRequestId)).rejects.toThrow('invalid durable readback');
  });

  it('returns the complete successful reviewed state', async () => {
    mock.rpc.mockResolvedValue({ data: reviewed, error: null });
    await expect(readOhioFinderReview(rideRequestId)).resolves.toMatchObject({
      status: 'verified',
      finderAuditId: reviewed.finderAuditId,
      humanConfirmationStatus: 'confirmed',
      reviewedBy: reviewed.reviewedBy,
      reviewPolicySource: reviewed.reviewPolicySource,
    });
    expect(mock.rpc).toHaveBeenCalledWith('admin_read_ohio_finder_review', { p_ride_request_id: rideRequestId });
  });
});
