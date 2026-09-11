import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: null as unknown,
  loading: false,
  configured: true,
  mfa: { readStatus: 'ready', verifiedFactorId: null as string | null, currentLevel: null as string | null },
  authError: null,
  retryAuth: vi.fn(),
}));

vi.mock('./auth', () => ({ useAuth: () => authState }));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, Navigate: ({ to }: { to: string }) => <output data-testid="navigate">{to}</output> };
});

import { Protected } from './App';
import { Login } from './pages/Login';

const requestPath = '/requests/123e4567-e89b-12d3-a456-426614174000';

describe('request deep-link preservation', () => {
  beforeEach(() => {
    authState.user = null;
    authState.mfa = { readStatus: 'ready', verifiedFactorId: null, currentLevel: null };
  });

  it('carries a signed-out request target through owner access', () => {
    render(<MemoryRouter initialEntries={[requestPath]}><Protected /></MemoryRouter>);
    expect(screen.getByTestId('navigate')).toHaveTextContent(`/owner-access?returnTo=${encodeURIComponent(requestPath)}`);
  });

  it('carries an authenticated request target through MFA challenge', () => {
    authState.user = { id: 'owner' };
    authState.mfa = { readStatus: 'ready', verifiedFactorId: 'factor', currentLevel: 'aal1' };
    render(<MemoryRouter initialEntries={[requestPath]}><Protected /></MemoryRouter>);
    expect(screen.getByTestId('navigate')).toHaveTextContent(`/mfa-challenge?returnTo=${encodeURIComponent(requestPath)}`);
  });

  it('returns an authenticated login page to the bounded request target', () => {
    authState.user = { id: 'owner' };
    render(<MemoryRouter initialEntries={[`/owner-access?returnTo=${encodeURIComponent(requestPath)}`]}><Login /></MemoryRouter>);
    expect(screen.getByTestId('navigate')).toHaveTextContent(requestPath);
  });

  it('rejects external and malformed return targets', () => {
    authState.user = { id: 'owner' };
    for (const target of ['https://evil.example', '//evil.example/admin', '/admin/requests/not-a-uuid']) {
      const { unmount } = render(<MemoryRouter initialEntries={[`/owner-access?returnTo=${encodeURIComponent(target)}`]}><Login /></MemoryRouter>);
      expect(screen.getByTestId('navigate')).toHaveTextContent('/');
      unmount();
    }
  });
});
