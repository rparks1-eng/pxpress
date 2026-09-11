import { beforeEach, describe, expect, it } from 'vitest';
import { demoRequests } from '../../demo-data';
import {
  NAVIGATION_PROVIDER_STORAGE_KEY,
  navigationStopsForRequest,
  navigationUrl,
  readNavigationPreference,
  readNavigationProvider,
  saveNavigationProvider,
} from './navigation';

describe('owner navigation domain', () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() } });
  });

  it('builds the one-way order without inventing a return stop', () => {
    const stops = navigationStopsForRequest(demoRequests[0]);
    expect(stops.map((stop) => stop.kind)).toEqual(['pickup', 'destination', 'base']);
    expect(stops.at(-1)?.address).toBe('10273 Maryland St., Reminderville, OH 44202');
  });

  it('resolves live-schema CLE and CAK codes to canonical routing destinations', () => {
    const cle = navigationStopsForRequest({ ...demoRequests[0], destinationAddress: '', airport: 'CLE' });
    const cak = navigationStopsForRequest({ ...demoRequests[0], destinationAddress: '', airport: 'CAK' });
    expect(cle.find((stop) => stop.kind === 'destination')?.address).toBe('Cleveland Hopkins International Airport, Cleveland, OH 44135');
    expect(cak.find((stop) => stop.kind === 'destination')?.address).toBe('Akron-Canton Airport, North Canton, OH 44720');
    expect(cle.find((stop) => stop.kind === 'destination')?.address).not.toBe('CLE');
    expect(cak.find((stop) => stop.kind === 'destination')?.address).not.toBe('CAK');
  });

  it('omits an unknown airport code instead of handing a guess to Maps', () => {
    const stops = navigationStopsForRequest({ ...demoRequests[0], destinationAddress: '', airport: 'XYZ' });
    expect(stops.map((stop) => stop.kind)).toEqual(['pickup', 'base']);
  });

  it('keeps an actual round-trip return even when it returns to the pickup address', () => {
    const stops = navigationStopsForRequest(demoRequests[2]);
    expect(stops.map((stop) => stop.kind)).toEqual(['pickup', 'destination', 'return', 'base']);
    expect(stops[2].address).toBe(demoRequests[2].returnAddress);
  });

  it('omits missing, invalid, and consecutive duplicate stops', () => {
    const stops = navigationStopsForRequest({
      ...demoRequests[0], pickupAddress: '  ', destinationAddress: 'CLE\nAirport', airport: '', returnAddress: 'CLE\nAirport',
    });
    expect(stops.map((stop) => stop.kind)).toEqual(['base']);
  });

  it('creates encoded HTTPS links that have browser fallbacks and require no API key', () => {
    const address = '100 Public Sq #12, Cleveland, OH 44113';
    expect(navigationUrl('apple', address)).toBe('https://maps.apple.com/?daddr=100%20Public%20Sq%20%2312%2C%20Cleveland%2C%20OH%2044113&dirflg=d');
    expect(navigationUrl('google', address)).toBe('https://www.google.com/maps/dir/?api=1&destination=100%20Public%20Sq%20%2312%2C%20Cleveland%2C%20OH%2044113');
    expect(navigationUrl('waze', address)).toBe('https://www.waze.com/ul?q=100%20Public%20Sq%20%2312%2C%20Cleveland%2C%20OH%2044113&navigate=yes');
    expect(navigationUrl('google', '')).toBeNull();
  });

  it('persists only the preferred provider on this device', () => {
    expect(readNavigationProvider()).toBe('apple');
    expect(readNavigationPreference()).toEqual({ provider: 'apple', persisted: false });
    expect(saveNavigationProvider('waze')).toBe(true);
    expect(globalThis.localStorage.getItem(NAVIGATION_PROVIDER_STORAGE_KEY)).toBe('waze');
    expect(readNavigationProvider()).toBe('waze');
    expect(readNavigationPreference()).toEqual({ provider: 'waze', persisted: true });
  });
});
