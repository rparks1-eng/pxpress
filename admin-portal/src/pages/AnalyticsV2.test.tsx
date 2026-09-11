import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localInsightsPreview } from '../features/analytics-v2/fixtures';
import { useRequests } from '../hooks';
import { AnalyticsV2, AnalyticsV2Route, analyticsInputForRequests } from './AnalyticsV2';

vi.mock('../hooks', () => ({ useRequests: vi.fn() }));
const useRequestsMock = vi.mocked(useRequests);

describe('AnalyticsV2 page', () => {
  beforeEach(() => {
    useRequestsMock.mockReturnValue({ data: [], loading: false, error: '', reload: vi.fn() });
  });

  it('shows no fabricated values when a repository is absent', () => {
    render(<AnalyticsV2/>);
    expect(screen.getByText('Live business data is not connected')).toBeInTheDocument();
    expect(screen.getByText(/No values are fabricated/i)).toBeInTheDocument();
    expect(screen.getByRole('heading',{name:'Import and review'})).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Import remains locked/i})).toBeDisabled();
  });

  it('labels sample figures as local preview data', () => {
    render(<AnalyticsV2 input={localInsightsPreview}/>);
    expect(screen.getByText('Local preview data')).toBeInTheDocument();
    expect(screen.getByText(/not a claim about Pxpress performance/i)).toBeInTheDocument();
    expect(screen.getByText('$373')).toBeInTheDocument();
  });

  it('uses real request input without importing example expenses into live financial totals', () => {
    const input = analyticsInputForRequests(localInsightsPreview.requests, true);
    expect(input.requests).toHaveLength(localInsightsPreview.requests.length);
    expect(input.expenses).toEqual([]);
    expect(input.source).toBe('live_requests_expenses_disconnected');
    render(<AnalyticsV2 input={input}/>);
    expect(screen.getByText('Live requests · expense ledger not connected')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getAllByText('Not available').length).toBeGreaterThan(0);
    expect(screen.queryByText(/mixed-source preview/i)).not.toBeInTheDocument();
    expect(screen.getByText('Cached route miles').parentElement).toHaveTextContent('Not available');
  });

  it('loads the route from the request repository hook', () => {
    useRequestsMock.mockReturnValue({ data: localInsightsPreview.requests, loading: false, error: '', reload: vi.fn() });
    render(<AnalyticsV2Route/>);
    expect(screen.getByText('Request pipeline')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('fails closed when the request repository cannot load', () => {
    useRequestsMock.mockReturnValue({ data: [], loading: false, error: 'Request repository unavailable.', reload: vi.fn() });
    render(<AnalyticsV2Route/>);
    expect(screen.getByRole('alert')).toHaveTextContent('Business insights could not load');
    expect(screen.getByText(/No local figures are substituted/i)).toBeInTheDocument();
  });
});
