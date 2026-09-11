import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TaxCenterView } from './TaxCenter';
import type { RideTaxRecordView, TaxLedgerViewEntry } from '../features/tax-center/types';

afterEach(() => vi.restoreAllMocks());

describe('Tax Center', () => {
  it('is honest, default off, and leaves filing with the owner', () => {
    render(<TaxCenterView/>);
    expect(screen.getByRole('heading', { name: 'Tax Center' })).toBeInTheDocument();
    expect(screen.getByText(/Tax automation is off/i)).toBeInTheDocument();
    expect(screen.getByText(/Monthly · unverified/i)).toBeInTheDocument();
    expect(screen.getByText(/zero return is due/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export unavailable/i })).toBeDisabled();
    expect(screen.getByText(/Filing and payment remain Raishawn’s actions/i)).toBeInTheDocument();
    expect(screen.getByText(/Missing: Finder connection/)).toBeInTheDocument();
    expect(screen.getByText('Review required')).toBeInTheDocument();
    expect(screen.getByText('Not saved')).toBeInTheDocument();
  });

  it('shows Finder usage, cache evidence, sourcing review, and pricing assumptions truthfully', () => {
    render(<TaxCenterView finder={{ connected: true, availability:'ready', used: 7, hardCap: 200, cacheStatus: 'hit', providerVersion: 'ohio-finder-v1', stages:{adapterEnabled:true,rateProviderEnabled:true,runtimeCredentialsReady:true,repositoryReady:true,sourcingConfirmed:true} }} sourcing={{ confirmed: true, reviewedBy: 'Ohio adviser', reviewedAt: '2026-09-02T14:05:00Z', sourceReference: 'review-1' }} pricing={{ status: 'current', modelVersion: 'pxpress-fare-recommendation-v1', reviewedAt: '2026-09-02T14:05:00Z' }}/>);
    expect(screen.getByText(/193 of 200 lookups remaining/)).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Confirmed with evidence')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getAllByText(/Sep 2, 2026, 10:05 AM/)).toHaveLength(2);
    expect(screen.queryByText(/2026-09-02T14:05:00Z/)).not.toBeInTheDocument();
  });

  it('shows filing-ready and excluded rides without adding excluded amounts to totals', () => {
    const ready:RideTaxRecordView={rideRequestId:'ride-1',publicReference:'PXR-SAFE0001',guestLabel:'Guest · 0001',serviceLabel:'Airport',rideDate:'2026-09-02',paymentStatus:'paid',filingStatus:'filing_ready',taxPointStatus:'confirmed',taxPointAt:'2026-09-02T13:00:00Z',filingPeriod:'2026-09',jurisdictionLabel:'Summit County',rateBasisPoints:675,serviceSubtotalMinor:11628,taxMinor:872,totalMinor:12500,eligibleForFiling:true,adjustmentSummary:{confirmedSubtotalDeltaMinor:0,confirmedTaxDeltaMinor:0,confirmedTotalDeltaMinor:0,manualReviewCount:0,items:[]},sourceReadiness:{kind:'paid_tax_ledger',ledgerEntryId:'ledger-1'}};
    const pending:RideTaxRecordView={...ready,rideRequestId:'ride-2',publicReference:'PXR-SAFE0002',guestLabel:'Guest · 0002',paymentStatus:'unpaid',filingStatus:'pending',taxPointStatus:'not_recorded',taxPointAt:undefined,filingPeriod:undefined,eligibleForFiling:false,exclusionReason:'Payment has not been authoritatively verified as paid.',sourceReadiness:{kind:'quote_tax_projection'}};
    const ledger:TaxLedgerViewEntry={id:'ledger-1',paidAt:'2026-09-02T13:00:00Z',taxPointStatus:'confirmed',taxPointAt:'2026-09-02T13:00:00Z',taxPointBasis:'payment_received',filingPeriod:'2026-09',filingReady:true,jurisdictionLabel:'Summit County',taxableSubtotalMinor:11628,taxMinor:872,totalMinor:12500,reconciliationState:'reconciled'};
    render(<MemoryRouter><TaxCenterView entries={[ledger]} rideRecords={[ready,pending]} repositoryConnected/></MemoryRouter>);
    expect(screen.getByText('PXR-SAFE0001')).toBeInTheDocument();
    expect(screen.getByText('PXR-SAFE0002')).toBeInTheDocument();
    expect(screen.getByText(/Excluded from filing totals/i)).toBeInTheDocument();
    expect(screen.getAllByText('$116.28').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$8.72').length).toBeGreaterThan(0);
  });

  it('offers an internally generated CSV only when connected records exist', () => {
    const entry: TaxLedgerViewEntry = {
      id: 'ledger-1', paidAt: '2026-09-02T13:00:00Z', taxPointStatus: 'confirmed',
      taxPointAt: '2026-09-04T13:00:00Z', taxPointBasis: 'service_completed', filingPeriod: '2026-09', filingReady: true,
      jurisdictionLabel: 'Summit County', taxableSubtotalMinor: 11_628, taxMinor: 872, totalMinor: 12_500,
      reconciliationState: 'reconciled',
    };
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:tax-export');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<TaxCenterView entries={[entry]} repositoryConnected/>);
    const exportButton = screen.getByRole('button', { name: /Export filing-prep CSV/i });
    expect(exportButton).toBeEnabled();
    fireEvent.click(exportButton);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Only confirmed treatment changes filing totals/i)).toBeInTheDocument();
  });
});
