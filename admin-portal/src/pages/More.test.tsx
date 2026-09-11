import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { More } from './More';

describe('More owner tools', () => {
  it('routes phone users to the integrated analytics and local expenses pages', () => {
    render(<MemoryRouter><More/></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Analytics/ })).toHaveAttribute('href', '/analytics');
    expect(screen.getByRole('link', { name: /Expenses/ })).toHaveAttribute('href', '/expenses');
    expect(screen.getByRole('link', { name: /Availability/ })).toHaveAttribute('href', '/availability');
    expect(screen.getByRole('link', { name: /Manual ride entry/ })).toHaveAttribute('href', '/manual-ride');
    expect(screen.getByRole('link', { name: /Payment center/ })).toHaveAttribute('href', '/payments');
    expect(screen.getByRole('link', { name: /Communications/ })).toHaveAttribute('href', '/communications');
    expect(screen.getByRole('link', { name: /Vehicle & records/ })).toHaveAttribute('href', '/vehicle-records');
    expect(screen.getByRole('link', { name: /Tax Center/ })).toHaveAttribute('href', '/tax-center');
    expect(screen.getByText('Understand revenue, requests, and repeat guests')).toBeInTheDocument();
    expect(screen.getByText('Track spending and keep your receipts')).toBeInTheDocument();
    expect(screen.queryByText(/financial providers switched off/i)).not.toBeInTheDocument();
  });
});
