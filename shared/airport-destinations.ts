export const AIRPORT_DESTINATIONS = {
  CLE: 'Cleveland Hopkins International Airport, Cleveland, OH 44135',
  CAK: 'Akron-Canton Airport, North Canton, OH 44720',
} as const;

export type PxpressAirportCode = keyof typeof AIRPORT_DESTINATIONS;

export function airportDestination(code: string | undefined) {
  const normalized = (code || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(AIRPORT_DESTINATIONS, normalized)
    ? AIRPORT_DESTINATIONS[normalized as PxpressAirportCode]
    : '';
}
