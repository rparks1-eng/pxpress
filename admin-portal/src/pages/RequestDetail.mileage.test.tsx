import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  calculate: vi.fn(), reload: vi.fn(), eventsReload: vi.fn(),
  request: {
    id: 'c148e5ee-31b3-4077-985a-74963aaf1d2b', customerId: 'customer-1', requestNumber: 'PXR-MILES', status: 'new' as const,
    createdAt: '2026-09-02T12:00:00Z', version: 1, customerName: 'Test Guest', email: 'guest@example.com', phone: '2345550100',
    service: 'airport' as const, tripType: 'One way', pickupAddress: '10273 Maryland St, Reminderville, OH 44202', destinationAddress: 'CLE',
    pickupDate: '2026-09-03', pickupTime: '13:45', airport: 'CLE', passengers: 1, carryons: 0, checkedBags: 0,
    hasOversizedItems: false, pricingStatus: 'configuration-required' as const, paymentStatus: 'not_requested' as const,
  },
}));
vi.mock('../hooks', () => ({
  useRequests: () => ({ data: [state.request], loading: false, error: '', reload: state.reload }),
  useEvents: () => ({ data: [], loading: false, error: '', reload: state.eventsReload }),
}));
vi.mock('../lib/repository', () => ({
  readOhioFinderReview: vi.fn().mockResolvedValue(undefined), addInternalNote: vi.fn(), approveAndPreparePayment: vi.fn(),
  calculateRouteEstimate: state.calculate, declineRequest: vi.fn(), lookupOhioFinderRate: vi.fn(), requestWixProviderReconciliation: vi.fn(), reviewOhioFinderResult: vi.fn(),
}));

import { RequestDetail } from './RequestDetail';

const renderPage = () => render(<MemoryRouter initialEntries={[`/requests/${state.request.id}`]}><Routes><Route path="/requests/:id" element={<RequestDetail/>}/></Routes></MemoryRouter>);

describe('request detail mileage controls', () => {
  let sequence = 0;
  beforeEach(() => {
    state.calculate.mockReset();
    state.request.id = `c148e5ee-31b3-4077-985a-${String(++sequence).padStart(12, '0')}`;
    sessionStorage.clear();
  });
  it('keeps retry and manual entry usable after automatic mileage fails', async () => {
    state.calculate.mockRejectedValue(new Error('Automatic mileage is not connected yet. Use manual mileage below.'));
    renderPage();
    expect(await screen.findByText(/Automatic mileage is not connected yet/i)).toBeInTheDocument();
    const button = await screen.findByRole('button', { name: 'Calculate mileage' });
    expect(state.calculate).toHaveBeenCalledOnce();
    fireEvent.click(button);
    await waitFor(() => expect(state.calculate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Enter mileage manually' })).toBeEnabled();
  });

  it('blocks duplicate automatic clicks while the first request is in flight', () => {
    state.calculate.mockReset();
    state.calculate.mockReturnValue(new Promise(() => {}));
    renderPage();
    const button = screen.getByRole('button', { name: 'Calculating…' });
    fireEvent.click(button); fireEvent.click(button);
    expect(state.calculate).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Calculating…' })).toBeDisabled();
  });

  it('explains that an ephemeral cache hit used no additional lookup', async () => {
    state.calculate.mockReset();
    state.calculate.mockResolvedValue({rideRequestId:state.request.id,baseAddress:'Base',pickupAddress:'Pickup',destinationAddress:'Destination',baseToPickupMiles:1,pickupToDestinationMiles:2,destinationToBaseMiles:3,totalMiles:6,totalDurationMinutes:12,calculatedAt:'2026-09-02T18:00:00Z',sourceAttribution:'Google Maps',cacheStatus:'cache',ephemeral:true,routeLegs:[{origin:'Base',destination:'Pickup',miles:1,durationMinutes:2},{origin:'Pickup',destination:'Destination',miles:2,durationMinutes:4},{origin:'Destination',destination:'Base',miles:3,durationMinutes:6}]});
    const page = renderPage();
    expect(await screen.findByText(/saved result, no new lookup/i)).toBeInTheDocument();
    expect(screen.getByRole('button', {name:'Google mileage ready'})).toBeDisabled();
    page.unmount();
    renderPage();
    expect(await screen.findByText(/saved result, no new lookup/i)).toBeInTheDocument();
    expect(state.calculate).toHaveBeenCalledOnce();
  });
});
