import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GoogleCalendarConnection } from '../types';

const repository = vi.hoisted(() => ({
  getGoogleCalendarConnection: vi.fn(),
  startGoogleCalendarConnection: vi.fn(),
}));
vi.mock('../lib/repository', () => repository);

import { CalendarSettings } from './Calendar';

const renderCallback = () => render(<MemoryRouter initialEntries={['/?google=connected']}><CalendarSettings/></MemoryRouter>);

describe('Google Calendar callback readback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows only a neutral check until authoritative status returns', async () => {
    let resolve!: (value: GoogleCalendarConnection) => void;
    repository.getGoogleCalendarConnection.mockReturnValue(new Promise<GoogleCalendarConnection>((done) => { resolve = done }));
    renderCallback();
    expect(await screen.findByText('Checking Google Calendar connection…')).toBeInTheDocument();
    expect(screen.queryByText('Google Calendar connected. Accepted rides will now sync automatically.')).not.toBeInTheDocument();
    await act(async () => resolve({ connected: true, syncEnabled: true, googleEmail: 'owner@example.com' }));
    expect(await screen.findByText('Google Calendar connected. Accepted rides will now sync automatically.')).toBeInTheDocument();
  });

  it('does not trust a forged connected query when the provider is disconnected', async () => {
    repository.getGoogleCalendarConnection.mockResolvedValue({ connected: false, syncEnabled: false });
    renderCallback();
    expect(await screen.findByText(/connection was not confirmed/i)).toBeInTheDocument();
    expect(screen.queryByText('Google Calendar connected. Accepted rides will now sync automatically.')).not.toBeInTheDocument();
  });

  it('does not claim automatic sync when the connection is paused', async () => {
    repository.getGoogleCalendarConnection.mockResolvedValue({ connected: true, syncEnabled: false });
    renderCallback();
    expect(await screen.findByText(/automatic accepted-ride sync is paused/i)).toBeInTheDocument();
    expect(screen.queryByText('Google Calendar connected. Accepted rides will now sync automatically.')).not.toBeInTheDocument();
  });

  it('surfaces authoritative status failure without a success claim', async () => {
    repository.getGoogleCalendarConnection.mockRejectedValue(new Error('Connection status unavailable'));
    renderCallback();
    expect(await screen.findByText(/could not verify the connection/i)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Connection status unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('Google Calendar connected. Accepted rides will now sync automatically.')).not.toBeInTheDocument();
  });
});
