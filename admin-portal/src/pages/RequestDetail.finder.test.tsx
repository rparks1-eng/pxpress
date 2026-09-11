import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reason: 'Finder review is not connected yet. The reviewed tax migration is required before owner review can be saved.',
  read: vi.fn(),
  reload: vi.fn(),
  eventsReload: vi.fn(),
  request: {
    id: 'c148e5ee-31b3-4077-985a-74963aaf1d2b', requestNumber: 'PXR-TEST', status: 'new', createdAt: '2026-09-02T12:00:00Z', version: 1,
    customerId: 'customer-1', customerName: 'Test Guest', email: 'guest@example.com', phone: '2345550100', service: 'airport', tripType: 'One way',
    pickupAddress: '10273 Maryland St, Reminderville, OH 44202', destinationAddress: 'CLE', pickupDate: '2026-09-03', pickupTime: '13:45',
    passengers: 1, carryons: 0, checkedBags: 0, hasOversizedItems: false, pricingStatus: 'configuration-required', paymentStatus: 'not_requested', lifecycleEffects: [],
  },
}));
vi.mock('../hooks', () => ({
  useRequests: () => ({ data: [state.request], loading: false, error: '', reload: state.reload }),
  useEvents: () => ({ data: [], loading: false, error: '', reload: state.eventsReload }),
}));
vi.mock('../lib/repository', () => ({
  readOhioFinderReview: state.read,
  addInternalNote: vi.fn(), approveAndPreparePayment: vi.fn(), calculateRouteEstimate: vi.fn().mockRejectedValue(new Error("Automatic mileage unavailable in this fixture.")), declineRequest: vi.fn(),
  lookupOhioFinderRate: vi.fn(), requestWixProviderReconciliation: vi.fn(), reviewOhioFinderResult: vi.fn(),
}));

import { RequestDetail } from './RequestDetail';

describe('request detail manual quote', () => {
  it('does not request or surface optional Finder review while opening a manual draft quote', async () => {
    render(<MemoryRouter initialEntries={[`/requests/${state.request.id}`]}><Routes><Route path="/requests/:id" element={<RequestDetail/>}/></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Test Guest', level: 1 })).toBeInTheDocument();
    const review = screen.getByRole('button', { name: 'Set quote' });
    expect(review).toBeEnabled();
    expect(screen.queryByText(/Finder review could not be read/i)).not.toBeInTheDocument();
    fireEvent.click(review);
    expect(screen.getByLabelText('Final customer price tax included')).toBeInTheDocument();
    expect(screen.getByLabelText('Tax rate percent')).toBeInTheDocument();
    expect(screen.getByText(/Manual evidence, not Finder evidence/i)).toBeInTheDocument();
    expect(document.querySelector('.quote-builder-dialog')?.textContent).toContain('Save quote draft');
    expect(document.querySelector('.quote-builder-dialog')?.textContent).not.toContain('Ohio Finder not available');
    expect(state.read).not.toHaveBeenCalled();
  });
});
