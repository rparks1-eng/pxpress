import type { RideRequest, RoutePlaceKind, VerifiedPlaceMetadata } from '../../types';
import { airportDestination } from '../../../../shared/airport-destinations';

const airportNames = {
  CLE: 'Cleveland Hopkins International Airport',
  CAK: 'Akron-Canton Airport',
} as const;

const categoryLabels: Record<string, string> = {
  airport: 'Airport',
  hotel: 'Hotel',
  restaurant: 'Restaurant',
  venue: 'Venue',
  business: 'Business',
  medical: 'Medical',
  residence: 'Residence',
};
const allowedCategories = new Set(Object.keys(categoryLabels));
const allowedProvenance = new Set(['arcgis_suggest_selection','wix_atlas_prediction_selection','wix_atlas_place_details','owner_confirmed','pxpress_airport_directory']);

const clean = (value: unknown, max = 300) => typeof value === 'string'
  ? value.trim().replace(/\s+/g, ' ').slice(0, max)
  : '';

export function normalizeVerifiedPlace(value: unknown): VerifiedPlaceMetadata | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (input.verified !== true) return undefined;
  const formattedAddress = clean(input.formattedAddress);
  const provenance = clean(input.provenance, 40);
  const resolvedAt = clean(input.resolvedAt, 40);
  if (!formattedAddress || !allowedProvenance.has(provenance) || !Number.isFinite(Date.parse(resolvedAt))) return undefined;
  const rawCategory = clean(input.category, 40).toLowerCase();
  const category = allowedCategories.has(rawCategory) ? rawCategory : '';
  const candidateName = clean(input.displayName, 160);
  const displayName = category === 'residence' ? '' : candidateName;
  const placeId = clean(input.placeId, 240);
  const placeIdHash = clean(input.placeIdHash, 128);
  const types = Array.isArray(input.types)
    ? input.types.map((item) => clean(item, 40).toLowerCase()).filter(Boolean).slice(0, 12)
    : [];
  return {
    verified: true,
    formattedAddress,
    provenance,
    resolvedAt,
    ...(displayName ? { displayName } : {}),
    ...(placeId ? { placeId } : {}),
    ...(placeIdHash ? { placeIdHash } : {}),
    ...(category ? { category } : {}),
    ...(types.length ? { types } : {}),
  };
}

function airportPlace(request: RideRequest): VerifiedPlaceMetadata | undefined {
  const code = (request.airport || '').trim().toUpperCase() as keyof typeof airportNames;
  const formattedAddress = airportDestination(code);
  if (!formattedAddress || !airportNames[code]) return undefined;
  return {
    verified: true,
    displayName: airportNames[code],
    formattedAddress,
    category: 'airport',
    types: ['airport'],
    provenance: 'pxpress_airport_directory',
    resolvedAt: request.createdAt,
  };
}

export function placeForRequest(request: RideRequest, kind: RoutePlaceKind): VerifiedPlaceMetadata | undefined {
  if (kind === 'destination' && request.service === 'airport') return airportPlace(request);
  return normalizeVerifiedPlace(request.routePlaces?.[kind]);
}

export function routeAddress(request: RideRequest, kind: RoutePlaceKind) {
  const verified = placeForRequest(request, kind);
  if (verified) return verified.formattedAddress;
  if (kind === 'pickup') return request.pickupAddress;
  if (kind === 'return') return request.returnAddress || '';
  return request.destinationAddress || airportDestination(request.airport) || '';
}

export function placeCategoryLabel(place?: VerifiedPlaceMetadata) {
  if (!place?.category) return '';
  return categoryLabels[place.category] || '';
}
