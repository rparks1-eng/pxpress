import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoRequests } from '../../demo-data';
import { NavigationLauncher } from './NavigationLauncher';
import { NAVIGATION_PROVIDER_STORAGE_KEY } from './navigation';

describe('NavigationLauncher', () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() } });
  });

  it('starts at pickup and opens a safe provider URL in a separate browsing context', () => {
    render(<NavigationLauncher request={demoRequests[2]}/>);
    const link = screen.getByRole('link', { name: /Open Pickup directions with Apple Maps/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('maps.apple.com'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.queryByText('Start directions')).not.toBeInTheDocument();
  });

  it('changes stop and provider without falsely auto-advancing the route', () => {
    render(<NavigationLauncher request={demoRequests[2]}/>);
    fireEvent.click(screen.getByRole('radio', { name: /Destination/i }));
    fireEvent.click(screen.getByRole('link', { name: /Open Destination directions with Waze/i }));
    const link = screen.getByRole('link', { name: /Open Destination directions with Waze/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('https://www.waze.com/ul?'));
    expect(screen.getByRole('heading', { name: 'Next stop: Destination' })).toBeInTheDocument();
    expect(globalThis.localStorage.getItem(NAVIGATION_PROVIDER_STORAGE_KEY)).toBe('waze');

  });

  it('loads a stored provider as a device-saved choice', () => {
    globalThis.localStorage.setItem(NAVIGATION_PROVIDER_STORAGE_KEY, 'google');
    render(<NavigationLauncher request={{ ...demoRequests[0], destinationAddress: '', airport: 'CLE' }}/>);

    expect(screen.getByRole('link', { name: /Open Pickup directions with Google Maps/i })).toHaveAttribute('href', expect.stringContaining('google.com/maps'));
  });

  it('shows unknown airport destinations as unavailable instead of linking a bare code', () => {
    render(<NavigationLauncher request={{ ...demoRequests[0], destinationAddress: '', airport: 'XYZ' }}/>);
    expect(screen.getByText('Destination unavailable')).toBeInTheDocument();
    expect(document.querySelector('a[href*="XYZ"]')).not.toBeInTheDocument();
  });

  it('labels missing ride addresses and never creates a dead destination link', () => {
    render(<NavigationLauncher request={{ ...demoRequests[0], pickupAddress: '', destinationAddress: '', airport: '' }}/>);
    expect(screen.getByText('Pickup unavailable · Destination unavailable')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Next stop: Pxpress base' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Pxpress base directions with Apple Maps/i })).toBeInTheDocument();
  });
});
