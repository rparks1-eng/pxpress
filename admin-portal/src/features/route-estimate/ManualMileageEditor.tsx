import { useMemo, useState } from 'react';
import type { RideRequest, RouteEstimate } from '../../types';

export const PXPRESS_BASE_ADDRESS = '10273 Maryland St., Reminderville, OH 44202';

export type RoutePlan = {
  stops: string[];
  labels: string[];
  error?: string;
};

const isRoundTrip = (request: RideRequest) => /round\s*trip/i.test(request.tripType);
const destinationFor = (request: RideRequest) => (request.destinationAddress || request.airport || '').trim();

export function routePlanForRequest(request: RideRequest): RoutePlan {
  const pickup = request.pickupAddress.trim();
  const destination = destinationFor(request);
  const roundTrip = isRoundTrip(request);
  const returnAddress = (request.returnAddress || '').trim();
  if (!pickup || !destination) return { stops: [], labels: [], error: 'Add both a pickup and destination before calculating mileage.' };
  if (roundTrip && !returnAddress) return { stops: [], labels: [], error: 'Add the round-trip return location before calculating mileage.' };
  return roundTrip
    ? { stops: [PXPRESS_BASE_ADDRESS, pickup, destination, returnAddress, PXPRESS_BASE_ADDRESS], labels: ['Base → pickup', 'Pickup → destination', 'Destination → return', 'Return → base'] }
    : { stops: [PXPRESS_BASE_ADDRESS, pickup, destination, PXPRESS_BASE_ADDRESS], labels: ['Base → pickup', 'Pickup → destination', 'Destination → base'] };
}

export function buildManualRouteEstimate(request: RideRequest, miles: number[], minutes: number[]): RouteEstimate {
  const plan = routePlanForRequest(request);
  if (plan.error) throw new Error(plan.error);
  if (miles.length !== plan.labels.length || minutes.length !== plan.labels.length) throw new Error('Enter mileage and drive time for every route leg.');
  if (miles.some((value) => !Number.isFinite(value) || value <= 0 || value > 5_000)) throw new Error('Each route leg needs a valid mileage greater than zero.');
  if (minutes.some((value) => !Number.isInteger(value) || value <= 0 || value > 10_000)) throw new Error('Each route leg needs whole drive minutes greater than zero.');
  const routeLegs = plan.labels.map((_label, index) => ({ origin: plan.stops[index], destination: plan.stops[index + 1], miles: Number(miles[index].toFixed(2)), durationMinutes: minutes[index] }));
  const roundTrip = isRoundTrip(request);
  return {
    rideRequestId: request.id,
    baseAddress: PXPRESS_BASE_ADDRESS,
    pickupAddress: plan.stops[1],
    destinationAddress: plan.stops[2],
    ...(roundTrip ? { returnAddress: plan.stops[3], destinationToReturnMiles: routeLegs[2].miles, returnToBaseMiles: routeLegs[3].miles } : {}),
    baseToPickupMiles: routeLegs[0].miles,
    pickupToDestinationMiles: routeLegs[1].miles,
    destinationToBaseMiles: routeLegs.at(-1)!.miles,
    routeLegs,
    totalMiles: Number(routeLegs.reduce((sum, leg) => sum + leg.miles, 0).toFixed(2)),
    totalDurationMinutes: routeLegs.reduce((sum, leg) => sum + leg.durationMinutes, 0),
    calculatedAt: new Date().toISOString(),
    sourceAttribution: 'Owner entered',
    cacheStatus: 'manual',
    ephemeral: true,
  };
}

export function ManualMileageEditor({ request, onSave }: { request: RideRequest; onSave: (estimate: RouteEstimate) => void }) {
  const plan = useMemo(() => routePlanForRequest(request), [request]);
  const [open, setOpen] = useState(false);
  const [miles, setMiles] = useState<string[]>(() => plan.labels.map(() => ''));
  const [minutes, setMinutes] = useState<string[]>(() => plan.labels.map(() => ''));
  const [error, setError] = useState('');
  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const estimate = buildManualRouteEstimate(request, miles.map(Number), minutes.map(Number));
      onSave(estimate);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Manual mileage could not be used.');
    }
  }
  if (plan.error) return <p className="manual-mileage-unavailable">{plan.error}</p>;
  return <div className="manual-mileage">
    <button type="button" className="button text-button manual-mileage-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? 'Close manual mileage' : 'Enter mileage manually'}</button>
    {open && <form onSubmit={submit} className="manual-mileage-form">
      <p><strong>No Google lookup.</strong> Enter the legs from a route source you reviewed. These values stay only in this browser tab session and are not saved to the ride record.</p>
      <div className="manual-mileage-legs">{plan.labels.map((label, index) => <fieldset key={label}><legend>{label}</legend><label><span>Miles</span><input aria-label={`${label} miles`} inputMode="decimal" type="number" min="0.01" max="5000" step="0.01" value={miles[index]} onChange={(event) => setMiles((current) => current.map((value, item) => item === index ? event.target.value : value))}/></label><label><span>Drive minutes</span><input aria-label={`${label} drive minutes`} inputMode="numeric" type="number" min="1" max="10000" step="1" value={minutes[index]} onChange={(event) => setMinutes((current) => current.map((value, item) => item === index ? event.target.value : value))}/></label></fieldset>)}</div>
      {error && <p className="dialog-error" role="alert">{error}</p>}
      <button type="submit" className="button secondary">Use manual mileage</button>
    </form>}
  </div>;
}
