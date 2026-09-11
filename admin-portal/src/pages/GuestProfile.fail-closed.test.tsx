import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { GuestProfile } from './GuestProfile';

vi.mock('../hooks', () => ({
  useRequests: () => ({ data: [], loading: false, error: 'Recorded requests are unavailable.', reload: vi.fn() }),
}));

describe('guest profile data boundary', () => {
  it('fails closed when recorded customer and request data cannot be loaded', () => {
    render(<MemoryRouter initialEntries={['/customers/customer-jordan']}><Routes><Route path="/customers/:id" element={<GuestProfile/>}/></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Guest profile could not be loaded' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Call' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Email' })).not.toBeInTheDocument();
  });
});
