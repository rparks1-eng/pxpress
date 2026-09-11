import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { demoRequests } from '../demo-data';
import { blankManualRideDraft, ManualRideEntryContent } from './ManualRideEntry';

describe('Manual Ride Entry page', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() } });
  });
  it('defaults to the Ohio business date near UTC midnight', () => {
    expect(blankManualRideDraft(new Date('2026-09-02T02:30:00Z')).pickupDate).toBe('2026-09-01');
  });
  it('keeps a phone booking in local review and formats its visible schedule in 12-hour time', () => {
    render(<ManualRideEntryContent rides={[{ ...demoRequests[0], status: 'confirmed' }]}/>);
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Taylor Guest' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '(216) 555-0100' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'taylor@example.com' } });
    fireEvent.change(screen.getByLabelText('Pickup'), { target: { value: 'Cleveland, OH' } });
    fireEvent.change(screen.getByLabelText('Destination'), { target: { value: 'Akron, OH' } });
    fireEvent.change(screen.getByLabelText('Pickup date'), { target: { value: '2026-09-02' } });
    fireEvent.change(screen.getByLabelText('Manual ride pickup time'), { target: { value: '07:00' } });
    fireEvent.change(screen.getByLabelText('Expected finish date'), { target: { value: '2026-09-02' } });
    fireEvent.change(screen.getByLabelText('Manual ride finish time'), { target: { value: '08:00' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Overlaps PXR-1048');
    fireEvent.click(screen.getByRole('button', { name: /Add to local review/i }));
    expect(screen.getByRole('status')).toHaveTextContent('Nothing was sent or saved');
    expect(screen.getByText('Taylor Guest')).toBeInTheDocument();
    expect(screen.getByText(/Sep 2, 2026 at 7:00 AM/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Delete local draft for Taylor Guest/i }));
    expect(screen.queryByText('Taylor Guest')).not.toBeInTheDocument();
  });
});
