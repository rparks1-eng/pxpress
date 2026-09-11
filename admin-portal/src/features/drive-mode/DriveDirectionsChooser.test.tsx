import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RideRequest } from '../../types';
import { driveNavigationTarget, navigationUrl } from '../navigation/navigation';
import { DriveDirectionsChooser } from './DriveDirectionsChooser';
import type { DriveStage } from './domain';

const ride: RideRequest = {
  id: 'ride-directions', requestNumber: 'PXR-MAPS', status: 'confirmed', version: 1, createdAt: '2026-09-02T12:00:00Z',
  customerId: 'guest-1', customerName: 'Jordan Ellis', email: 'jordan@example.com', phone: '2165550100', service: 'point',
  tripType: 'Round trip', pickupAddress: '100 Main St #4, Cleveland, OH 44113', destinationAddress: '200 Lake Ave & W 3rd, Cleveland, OH',
  returnAddress: '300 Cedar Rd, Beachwood, OH', pickupDate: '2026-09-04', pickupTime: '13:45', passengers: 1, carryons: 0,
  checkedBags: 0, hasOversizedItems: false, pricingStatus: 'calculated', paymentStatus: 'paid',
};

describe('Drive Mode directions handoff', () => {
  it.each<[DriveStage, string | null]>([
    ['ready', 'pickup'],
    ['heading_to_pickup', 'pickup'],
    ['at_pickup', 'destination'],
    ['passenger_onboard', 'destination'],
    ['at_destination', 'return'],
    ['return_passenger_onboard', 'return'],
    ['at_return_stop', null],
    ['returning_to_base', 'base'],
    ['completed_elsewhere', null],
    ['at_base', null],
  ])('maps %s to only its current leg destination', (stage, expectedKind) => {
    expect(driveNavigationTarget(ride, stage).stop?.kind || null).toBe(expectedKind);
  });

  it('creates encoded universal driving URLs for Apple Maps, Google Maps, and Waze', () => {
    const address = '200 Lake Ave & W 3rd, Cleveland, OH';
    expect(navigationUrl('apple', address)).toBe('https://maps.apple.com/?daddr=200%20Lake%20Ave%20%26%20W%203rd%2C%20Cleveland%2C%20OH&dirflg=d');
    expect(navigationUrl('google', address)).toBe('https://www.google.com/maps/dir/?api=1&destination=200%20Lake%20Ave%20%26%20W%203rd%2C%20Cleveland%2C%20OH');
    expect(navigationUrl('waze', address)).toBe('https://www.waze.com/ul?q=200%20Lake%20Ave%20%26%20W%203rd%2C%20Cleveland%2C%20OH&navigate=yes');
  });

  it('renders three labeled keyboard-focusable app choices for the active stop', () => {
    const opened = vi.fn();
    render(<DriveDirectionsChooser target={driveNavigationTarget(ride, 'passenger_onboard')} onProviderOpen={opened}/>);
    const apple = screen.getByRole('link', { name: 'Open Destination directions with Apple Maps' });
    const google = screen.getByRole('link', { name: 'Open Destination directions with Google Maps' });
    const waze = screen.getByRole('link', { name: 'Open Destination directions with Waze' });
    expect([apple, google, waze]).toHaveLength(3);
    google.focus();
    expect(google).toHaveFocus();
    fireEvent.click(waze);
    expect(opened).toHaveBeenCalledWith('waze');
    expect(waze).toHaveAttribute('target', '_blank');
    expect(waze).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('disables every app choice and explains a missing active-leg address', () => {
    const target = driveNavigationTarget({ ...ride, pickupAddress: '' }, 'ready');
    render(<DriveDirectionsChooser target={target} onProviderOpen={vi.fn()}/>);
    expect(screen.getByText('The pickup address is missing. Add it before opening directions.')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled());
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
