import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestState = vi.hoisted(() => ({ data: [] as never[], loading: false, error: '', reload: vi.fn() }));
vi.mock('../hooks', () => ({ useRequests: () => requestState }));

import { Dashboard, DashboardClock, dashboardReadStatus, formatOwnerLocalTime } from './Dashboard';

describe('Today dashboard local clock and read state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-03T00:05:00.000Z'));
    requestState.loading = false;
    requestState.error = '';
  });
  afterEach(() => vi.useRealTimers());

  it('formats America/New_York time with a 12-hour AM/PM clock', () => {
    expect(formatOwnerLocalTime(new Date('2026-01-15T17:30:00.000Z'))).toBe('12:30 PM');
    expect(formatOwnerLocalTime(new Date('2026-07-15T00:05:00.000Z'))).toBe('8:05 PM');
  });

  it('uses honest loading, error, and current states without claiming a live connection', () => {
    expect(dashboardReadStatus(true, '')).toMatchObject({ tone: 'loading', label: 'Loading' });
    expect(dashboardReadStatus(false, 'offline')).toMatchObject({ tone: 'error', label: 'Needs attention' });
    expect(dashboardReadStatus(false, '')).toMatchObject({ tone: 'current', label: 'Current' });
    const view = render(<DashboardClock now={new Date()} loading error=""/>);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    view.rerender(<DashboardClock now={new Date()} loading={false} error="offline"/>);
    expect(screen.getByLabelText('Owner desk status: Current ride information could not be loaded.')).toHaveTextContent('Needs attention');
    view.rerender(<DashboardClock now={new Date()} loading={false} error=""/>);
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('shows the compact accessible clock, updates once per minute, and cleans up its timer', () => {
    const view = render(<MemoryRouter><Dashboard/></MemoryRouter>);
    expect(screen.getByRole('time', { name: '8:05 PM, Eastern Time' })).toBeInTheDocument();
    expect(screen.getByLabelText('Owner desk status: Ride information loaded successfully.')).toBeInTheDocument();
    expect(screen.queryByText(/Updated/i)).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('time', { name: '8:06 PM, Eastern Time' })).toBeInTheDocument();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the dashboard clock visible while loading and when loading fails', () => {
    requestState.loading = true;
    const view = render(<MemoryRouter><Dashboard/></MemoryRouter>);
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preparing today’s run sheet' })).toBeInTheDocument();
    requestState.loading = false;
    requestState.error = 'Network unavailable';
    view.rerender(<MemoryRouter><Dashboard/></MemoryRouter>);
    expect(screen.getByLabelText('Owner desk status: Current ride information could not be loaded.')).toHaveTextContent('Needs attention');
    expect(screen.getByRole('heading', { name: 'Requests could not be loaded' })).toBeInTheDocument();
  });

  it('uses mobile-safe semantic markup with visible non-color status text', () => {
    const { container } = render(<DashboardClock now={new Date()} loading={false} error=""/>);
    expect(container.querySelector('.dashboard-clock time')).toBeInTheDocument();
    expect(container.querySelector('.dashboard-read-state')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Owner desk status: Ride information loaded successfully.')).toBeInTheDocument();
  });
});
