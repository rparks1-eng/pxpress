import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoRequests } from '../demo-data';
import { storeManualRideDrafts } from '../lib/local-schedule';
import { AvailabilityContent } from './Availability';

describe('Availability page', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() } });
  });
  it('warns about ride overlap and stores only a removable browser-local block', () => {
    render(<MemoryRouter><AvailabilityContent rides={[{ ...demoRequests[0], status: 'confirmed' }]}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-02' } });
    fireEvent.change(screen.getByLabelText('Availability start time'), { target: { value: '07:00' } });
    fireEvent.change(screen.getByLabelText('Availability end time'), { target: { value: '08:00' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Overlaps PXR-1048');
    fireEvent.click(screen.getByRole('button', { name: /Add local block/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/saved on this device only|kept for this open page only/i);
    const remove = screen.getByRole('button', { name: /Remove 7:00 AM unavailable block/i });
    fireEvent.click(remove);
    expect(screen.queryByRole('button', { name: /Remove 7:00 AM unavailable block/i })).not.toBeInTheDocument();
  });
  it('warns when an unavailable block overlaps a saved manual ride draft', () => {
    storeManualRideDrafts([{ id: 'draft-1', guestName: 'Taylor Guest', pickupDate: '2026-09-02', pickupTime: '10:00', endDate: '2026-09-02', endTime: '11:00' }]);
    render(<MemoryRouter><AvailabilityContent rides={[]}/></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-09-02' } });
    fireEvent.change(screen.getByLabelText('Availability start time'), { target: { value: '10:15' } });
    fireEvent.change(screen.getByLabelText('Availability end time'), { target: { value: '10:45' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Overlaps local draft: Taylor Guest');
  });
});
