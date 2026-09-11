import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { demoRequests } from '../../demo-data';
import { ManualMileageEditor, buildManualRouteEstimate, routePlanForRequest } from './ManualMileageEditor';

describe('manual mileage fallback', () => {
  it('builds the complete one-way owner loop', () => {
    const request = { ...demoRequests[0], tripType: 'One way' };
    const estimate = buildManualRouteEstimate(request, [8.2, 23.4, 31.1], [14, 32, 38]);
    expect(estimate.routeLegs?.map(({ origin, destination }) => [origin, destination])).toEqual([
      [estimate.baseAddress, request.pickupAddress],
      [request.pickupAddress, request.destinationAddress],
      [request.destinationAddress, estimate.baseAddress],
    ]);
    expect(estimate.totalMiles).toBe(62.7);
    expect(estimate.sourceAttribution).toBe('Owner entered');
  });

  it('uses the actual return stop for the round-trip base leg', () => {
    const request = { ...demoRequests[2], tripType: 'Round trip' };
    const estimate = buildManualRouteEstimate(request, [10, 20, 21, 11], [15, 30, 31, 16]);
    expect(estimate.routeLegs).toHaveLength(4);
    expect(estimate.routeLegs?.at(-1)).toMatchObject({ origin: request.returnAddress, destination: estimate.baseAddress });
    expect(estimate.destinationToReturnMiles).toBe(21);
    expect(estimate.returnToBaseMiles).toBe(11);
  });

  it('fails before any lookup when route addresses are incomplete', () => {
    expect(routePlanForRequest({ ...demoRequests[0], pickupAddress: '' }).error).toMatch(/pickup and destination/i);
    expect(routePlanForRequest({ ...demoRequests[2], tripType: 'Round trip', returnAddress: '' }).error).toMatch(/return location/i);
  });

  it('provides phone-usable labeled controls without calling a provider', () => {
    const onSave = vi.fn();
    render(<ManualMileageEditor request={{ ...demoRequests[0], tripType: 'One way' }} onSave={onSave}/>);
    fireEvent.click(screen.getByRole('button', { name: 'Enter mileage manually' }));
    const values = [['Base → pickup', '8', '12'], ['Pickup → destination', '20', '28'], ['Destination → base', '24', '32']];
    values.forEach(([label, miles, minutes]) => {
      fireEvent.change(screen.getByLabelText(`${label} miles`), { target: { value: miles } });
      fireEvent.change(screen.getByLabelText(`${label} drive minutes`), { target: { value: minutes } });
    });
    expect(screen.getAllByRole('spinbutton')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Use manual mileage' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ totalMiles: 52, sourceAttribution: 'Owner entered' }));
  });
});
