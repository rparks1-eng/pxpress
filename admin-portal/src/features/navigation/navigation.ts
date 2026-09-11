import type { RideRequest } from '../../types';
import type { DriveStage } from '../drive-mode/domain';
import { PXPRESS_BASE_ADDRESS } from '../route-estimate/ManualMileageEditor';
import { routeAddress } from '../places/place-metadata';

export type NavigationProvider = 'apple' | 'google' | 'waze';
export type NavigationStopKind = 'pickup' | 'destination' | 'return' | 'base';
export type NavigationStop = { kind: NavigationStopKind; label: string; address: string };
export type DriveNavigationTarget = { stop: NavigationStop | null; unavailableReason: string | null };

export const NAVIGATION_PROVIDER_STORAGE_KEY = 'pxpress-owner-navigation-provider-v1';

const providerLabels: Record<NavigationProvider, string> = {
  apple: 'Apple Maps',
  google: 'Google Maps',
  waze: 'Waze',
};

const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
const safeAddress = (value?: string) => {
  const address = (value || '').trim();
  return address && !/[\u0000-\u001f\u007f]/.test(address) ? address : '';
};

export function navigationProviderLabel(provider: NavigationProvider) {
  return providerLabels[provider];
}

export function isNavigationProvider(value: unknown): value is NavigationProvider {
  return value === 'apple' || value === 'google' || value === 'waze';
}

export function readNavigationProvider(): NavigationProvider {
  return readNavigationPreference().provider;
}

export function readNavigationPreference(): { provider: NavigationProvider; persisted: boolean } {
  try {
    const saved = window.localStorage.getItem(NAVIGATION_PROVIDER_STORAGE_KEY);
    return isNavigationProvider(saved) ? { provider: saved, persisted: true } : { provider: 'apple', persisted: false };
  } catch {
    return { provider: 'apple', persisted: false };
  }
}

export function saveNavigationProvider(provider: NavigationProvider) {
  try {
    window.localStorage.setItem(NAVIGATION_PROVIDER_STORAGE_KEY, provider);
    return true;
  } catch {
    return false;
  }
}

export function navigationStopsForRequest(request: RideRequest): NavigationStop[] {
  const candidates: NavigationStop[] = [
    { kind: 'pickup', label: 'Pickup', address: safeAddress(routeAddress(request, 'pickup')) },
    { kind: 'destination', label: 'Destination', address: safeAddress(routeAddress(request, 'destination')) },
    { kind: 'return', label: 'Return', address: safeAddress(routeAddress(request, 'return')) },
    { kind: 'base', label: 'Pxpress base', address: PXPRESS_BASE_ADDRESS },
  ];
  let previous = '';
  return candidates.filter((stop) => {
    if (!stop.address) return false;
    const key = normalized(stop.address);
    if (key === previous) return false;
    previous = key;
    return true;
  });
}

export function defaultNavigationStop(stops: NavigationStop[]) {
  return stops.find((stop) => stop.kind === 'pickup') || stops[0];
}

export function driveNavigationTarget(request: RideRequest, stage: DriveStage): DriveNavigationTarget {
  const stops = navigationStopsForRequest(request);
  let kind: NavigationStopKind | null = null;
  if (stage === 'ready' || stage === 'heading_to_pickup') kind = 'pickup';
  else if (stage === 'at_pickup' || stage === 'passenger_onboard') kind = 'destination';
  else if (stage === 'at_destination' && request.returnAddress?.trim()) kind = 'return';
  else if (stage === 'return_passenger_onboard') kind = 'return';
  else if (stage === 'returning_to_base') kind = 'base';

  if (!kind) {
    const reason = stage === 'at_destination' && /round/i.test(request.tripType)
      ? 'The booked return address is missing. Add it before opening directions.'
      : stage === 'at_destination' || stage === 'at_return_stop'
        ? 'Choose Return to base before opening another route.'
        : stage === 'completed_elsewhere'
          ? 'This Drive Mode session ended without a base return.'
          : 'This Drive Mode session is complete.';
    return { stop: null, unavailableReason: reason };
  }

  const stop = stops.find((candidate) => candidate.kind === kind) || null;
  const labels: Record<NavigationStopKind, string> = {
    pickup: 'pickup',
    destination: 'outbound destination',
    return: 'booked return stop',
    base: 'Pxpress base',
  };
  return {
    stop,
    unavailableReason: stop ? null : `The ${labels[kind]} address is missing. Add it before opening directions.`,
  };
}

export function navigationUrl(provider: NavigationProvider, address: string) {
  const destination = safeAddress(address);
  if (!destination) return null;
  const encoded = encodeURIComponent(destination);
  if (provider === 'apple') return `https://maps.apple.com/?daddr=${encoded}&dirflg=d`;
  if (provider === 'waze') return `https://www.waze.com/ul?q=${encoded}&navigate=yes`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}
