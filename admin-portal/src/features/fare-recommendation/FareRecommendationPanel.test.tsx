import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { demoRequests } from '../../demo-data';
import type { RouteEstimate } from '../../types';
import { FareRecommendationPanel, fareRouteLegs } from './FareRecommendationPanel';

const estimate: RouteEstimate = {
  rideRequestId: demoRequests[0].id, baseAddress: '10273 Maryland St, Reminderville, OH 44202',
  pickupAddress: demoRequests[0].pickupAddress, destinationAddress: demoRequests[0].destinationAddress,
  baseToPickupMiles: 12, pickupToDestinationMiles: 28, destinationToBaseMiles: 30,
  totalMiles: 70, totalDurationMinutes: 98, calculatedAt: '2026-09-02T12:00:00.000Z',
  sourceAttribution: 'Google Maps', ephemeral: true,
};

describe('owner fare recommendation panel', () => {
  it('uses the actual last stop for one-way and round-trip return-to-base legs', () => {
    const oneWay = fareRouteLegs({ ...demoRequests[0], tripType: 'One way' }, {
      ...estimate,
      routeLegs: [
        { origin: estimate.baseAddress, destination: demoRequests[0].pickupAddress, miles: 12, durationMinutes: 20 },
        { origin: demoRequests[0].pickupAddress, destination: demoRequests[0].destinationAddress, miles: 28, durationMinutes: 38 },
        { origin: demoRequests[0].destinationAddress, destination: estimate.baseAddress, miles: 30, durationMinutes: 40 },
      ],
    });
    expect(oneWay.map(({ origin, destination }) => [origin, destination])).toEqual([
      [estimate.baseAddress, demoRequests[0].pickupAddress],
      [demoRequests[0].pickupAddress, demoRequests[0].destinationAddress],
      [demoRequests[0].destinationAddress, estimate.baseAddress],
    ]);

    const returnAddress = '123 Return Rd, Solon, OH 44139';
    const roundTrip = fareRouteLegs({ ...demoRequests[0], tripType: 'Round trip', returnAddress }, {
      ...estimate, returnAddress, totalMiles: 110, totalDurationMinutes: 150,
      routeLegs: [
        { origin: estimate.baseAddress, destination: demoRequests[0].pickupAddress, miles: 12, durationMinutes: 20 },
        { origin: demoRequests[0].pickupAddress, destination: demoRequests[0].destinationAddress, miles: 28, durationMinutes: 38 },
        { origin: demoRequests[0].destinationAddress, destination: returnAddress, miles: 40, durationMinutes: 52 },
        { origin: returnAddress, destination: estimate.baseAddress, miles: 30, durationMinutes: 40 },
      ],
    });
    expect(roundTrip).toHaveLength(4);
    expect(roundTrip.at(-1)).toMatchObject({ kind: 'return_to_base', origin: returnAddress, destination: estimate.baseAddress });
  });

  it('requires real route/capacity inputs and never guesses a tax rate', () => {
    render(<FareRecommendationPanel request={demoRequests[0]} onUsePrice={vi.fn()}/>);
    expect(screen.getByText(/Calculate mileage on the request first/i)).toBeInTheDocument();
    expect(screen.getByText('Ohio Finder not available')).toBeInTheDocument();
    expect(screen.getByText(/No ZIP or county estimate is substituted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exact tax required/i })).toBeDisabled();
  });

  it('builds an advisory recommendation from cached route economics and owner assumptions', () => {
    const use = vi.fn();
    render(<FareRecommendationPanel request={demoRequests[0]} routeEstimate={estimate} onUsePrice={use}/>);
    fireEvent.click(screen.getByText('Review pricing assumptions'));
    fireEvent.change(screen.getByLabelText('Available rides per year'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Fuel cost per mile'), { target: { value: '.25' } });
    fireEvent.change(screen.getByLabelText('Maintenance cost per mile'), { target: { value: '.20' } });
    fireEvent.change(screen.getByLabelText('Depreciation cost per mile'), { target: { value: '.30' } });
    expect(screen.getByText('70.0 mi · 98 min')).toBeInTheDocument();
    expect(screen.getByText('Not provided')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exact tax required/i })).toBeDisabled();
    expect(use).not.toHaveBeenCalled();
  });

  it('shows exact Finder evidence but enables a rounded tax-inclusive amount only with policy and human confirmation', () => {
    const use = vi.fn();
    render(<FareRecommendationPanel request={demoRequests[0]} routeEstimate={estimate} onUsePrice={use} finderEvidence={{
      status: 'verified', finderAuditId: 'finder-audit-1', source: 'Ohio Department of Taxation Finder', sourceReference: 'finder-case-1',
      jurisdiction: { county: 'Summit County', state: 'Ohio' }, jurisdictionLabel: 'Summit County',
      rateBasisPoints: 675, lookupStatus: 'cached', effectiveDate: '2026-09-02', observedAt: '2026-09-02 12:00 PM', expiresAt: '2099-09-03 12:00 PM',
      transportationSourcingPolicyConfirmed: true, humanConfirmationStatus: 'confirmed',sourceEventId:`finder:6b36fc7d-d3fd-4f9f-a790-351fe6a8b2ec:${'a'.repeat(64)}`,
      reviewedBy:'owner-1',reviewedAt:'2026-09-02T14:00:00Z',reviewPolicySource:'Ohio adviser review',reviewPolicyDate:'2026-09-02',reviewReason:'Confirmed exact pickup evidence.',
    }}/>);
    fireEvent.click(screen.getByText('Review pricing assumptions'));
    fireEvent.change(screen.getByLabelText('Available rides per year'), { target: { value: '1000' } });
    expect(screen.getByText('Summit County · 6.75%')).toBeInTheDocument();
    expect(screen.getByLabelText('Tax and total preview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Use verified subtotal \+ tax/i }));
    expect(use).toHaveBeenCalledWith(expect.objectContaining({
      serviceSubtotalMinor: expect.any(Number),
      taxProjection: expect.objectContaining({ jurisdictionLabel: 'Summit County', rateBasisPoints: 675 }),
    }));
  });

  it('requires an explicit owner review action for a pending Finder result', async () => {
    const review=vi.fn(async()=>{});
    render(<FareRecommendationPanel request={demoRequests[0]} routeEstimate={estimate} onUsePrice={vi.fn()} finderEvidence={{
      status:'verified',finderAuditId:'finder-audit-1',source:'Ohio Department of Taxation Finder',sourceReference:'finder-case-1',
      jurisdiction:{county:'Summit'},jurisdictionLabel:'Summit County',rateBasisPoints:675,lookupStatus:'cached',effectiveDate:'2026-09-02',
      observedAt:'2026-09-02T12:00:00Z',expiresAt:'2026-09-03T12:00:00Z',transportationSourcingPolicyConfirmed:false,
      humanConfirmationStatus:'pending',onReview:review,
    }}/>);
    fireEvent.click(screen.getByText('Review this Finder result'));
    fireEvent.change(screen.getByLabelText('Policy source'),{target:{value:'Ohio adviser review reference'}});
    fireEvent.change(screen.getByLabelText('Policy date'),{target:{value:'2026-09-02'}});
    fireEvent.change(screen.getByLabelText('Review reason'),{target:{value:'Exact standardized pickup and jurisdiction match.'}});
    fireEvent.click(screen.getByRole('button',{name:'Confirm result'}));
    expect(review).toHaveBeenCalledWith('confirmed','Ohio adviser review reference','2026-09-02','Exact standardized pickup and jurisdiction match.');
  });

  it('keeps a durable rejection visible and tax-ineligible after refresh',()=>{
    render(<FareRecommendationPanel request={demoRequests[0]} routeEstimate={estimate} onUsePrice={vi.fn()} finderEvidence={{
      status:'verified',finderAuditId:'6b36fc7d-d3fd-4f9f-a790-351fe6a8b2ec',source:'Ohio Department of Taxation Finder',sourceReference:'finder-case-1',
      jurisdiction:{county:'Summit'},jurisdictionLabel:'Summit County',rateBasisPoints:675,lookupStatus:'cached',effectiveDate:'2026-09-02',
      observedAt:'2026-09-02T12:00:00Z',expiresAt:'2026-09-03T12:00:00Z',transportationSourcingPolicyConfirmed:true,
      humanConfirmationStatus:'rejected',reviewPolicySource:'Ohio adviser review',reviewPolicyDate:'2026-09-02',reviewReason:'Jurisdiction needs manual verification.',reviewedBy:'owner-1',reviewedAt:'2026-09-02T14:05:00Z',
    }}/>);
    expect(screen.getByText('Rejected — manual tax review required')).toBeInTheDocument();
    expect(screen.getByText('Jurisdiction needs manual verification.')).toBeInTheDocument();
    expect(screen.getByText(/Sep 2, 2026, 10:05 AM/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-09-02T14:05:00Z/)).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Exact tax required/i})).toBeDisabled();
    expect(screen.queryByRole('button',{name:/Use verified subtotal \+ tax/i})).not.toBeInTheDocument();
  });
});
