import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OwnerThemeProvider } from '../components/OwnerTheme';
import { Settings } from './Settings';
vi.mock('../auth', () => ({ useAuth: () => ({ user: { email: 'owner@example.com' } }) }));
vi.mock('./Calendar', () => ({ CalendarSettings: () => <p>Calendar connection controls</p> }));
vi.mock('./NotificationSettings', () => ({ NotificationSettings: () => <p>Notification controls</p> }));
afterEach(cleanup);
describe('unified settings', () => {
  it('switches sections in place and exposes appearance choices', () => {
    render(<MemoryRouter><OwnerThemeProvider><Settings/></OwnerThemeProvider></MemoryRouter>);
    expect(screen.getByText('owner@example.com')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Notification controls')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getByText('Calendar connection controls')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
  it('opens calendar connection feedback after a callback', () => {
    render(<MemoryRouter initialEntries={['/settings?google=connected']}><OwnerThemeProvider><Settings/></OwnerThemeProvider></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Calendar connection controls')).toBeInTheDocument();
  });
});
