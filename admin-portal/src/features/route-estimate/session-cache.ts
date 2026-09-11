import type { RideRequest, RouteEstimate } from '../../types';
import { routePlanForRequest } from './ManualMileageEditor';

const VERSION = 1;
const MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const keyFor = (requestId: string) => `pxpress-route-estimate-v${VERSION}:${requestId}`;
const routeSignature = (request: RideRequest) => routePlanForRequest(request).stops.map((value) => value.trim().replace(/\s+/g, ' ').toLowerCase()).join(' > ');

const validEstimate = (value: unknown): value is RouteEstimate => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Partial<RouteEstimate>;
  return typeof row.rideRequestId === 'string' && typeof row.totalMiles === 'number' && Number.isFinite(row.totalMiles) && row.totalMiles > 0 &&
    typeof row.totalDurationMinutes === 'number' && Number.isInteger(row.totalDurationMinutes) && row.totalDurationMinutes > 0 &&
    (row.sourceAttribution === 'Google Maps' || row.sourceAttribution === 'Owner entered') && row.ephemeral === true && Array.isArray(row.routeLegs);
};

export function readRouteEstimateSession(request: RideRequest, now = Date.now()): RouteEstimate | null {
  try {
    const raw = sessionStorage.getItem(keyFor(request.id));
    if (!raw) return null;
    const envelope = JSON.parse(raw) as { version?: unknown; savedAt?: unknown; routeSignature?: unknown; estimate?: unknown };
    if (envelope.version !== VERSION || typeof envelope.savedAt !== 'number' || !Number.isFinite(envelope.savedAt) || envelope.savedAt > now || now - envelope.savedAt > MAX_AGE_MS || envelope.routeSignature !== routeSignature(request) || !validEstimate(envelope.estimate) || envelope.estimate.rideRequestId !== request.id) {
      sessionStorage.removeItem(keyFor(request.id));
      return null;
    }
    return envelope.estimate;
  } catch { return null; }
}

export function writeRouteEstimateSession(request: RideRequest, estimate: RouteEstimate, now = Date.now()): boolean {
  if (!validEstimate(estimate) || estimate.rideRequestId !== request.id || !routeSignature(request)) return false;
  try {
    sessionStorage.setItem(keyFor(request.id), JSON.stringify({ version: VERSION, savedAt: now, routeSignature: routeSignature(request), estimate }));
    return true;
  } catch { return false; }
}
