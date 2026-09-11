import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { demoRequests } from '../demo-data';
import { CommunicationsCenter } from './CommunicationsCenter';
import { Customers } from './Customers';
import { GuestProfile } from './GuestProfile';
import { PaymentCenter } from './PaymentCenter';
import { VehicleRecords } from './VehicleRecords';

vi.mock('../hooks', () => ({
  useRequests: () => ({ data: demoRequests, loading: false, error: '', reload: vi.fn() }),
  useEvents: () => ({ data: [], loading: false, error: '', reload: vi.fn() }),
}));

describe('isolated owner centers', () => {
  it('renders a guest profile from recorded customer requests with device-local notes labeled', () => {
    render(<MemoryRouter initialEntries={['/customers/customer-jordan']}><Routes><Route path="/customers/:id" element={<GuestProfile/>}/></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Jordan Ellis' })).toBeInTheDocument();
    expect(screen.getByText(/These fields are not saved to Supabase/i)).toBeInTheDocument();
    expect(screen.getByText(/These are not claimed as saved or preferred/i)).toBeInTheDocument();
    expect(screen.getByText('7:15 AM')).toBeInTheDocument();
  });

  it('links each customer name to its real request-backed guest profile', () => {
    render(<MemoryRouter><Customers/></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'View guest profile for Jordan Ellis' })).toHaveAttribute('href', '/customers/customer-jordan');
  });

  it('keeps payment resend disabled while provider actions are off', () => {
    render(<MemoryRouter><PaymentCenter/></MemoryRouter>);
    const buttons = screen.getAllByRole('button', { name: /Resend unavailable/i });
    expect(buttons.length).toBe(demoRequests.length);
    expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true);
    expect(screen.getAllByText(/No provider transaction readback is attached/i)).toHaveLength(demoRequests.length);
  });

  it('shows standardized communication previews without an enabled send path', () => {
    render(<MemoryRouter><CommunicationsCenter/></MemoryRouter>);
    expect(screen.getByText(/This page does not resend messages or change your email settings/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Sending unavailable/i }).every((button) => button.hasAttribute('disabled'))).toBe(true);
  });

  it('offers document metadata without any file upload control', () => {
    const { container } = render(<VehicleRecords/>);
    expect(screen.getByText(/No document upload is available/i)).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeNull();
    expect(screen.getByText(/Device-local planning only/i)).toBeInTheDocument();
  });
});
