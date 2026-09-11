import {cleanup,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {RequestPriceSummary} from './RequestDetail';
import type {RideRequest,ManualQuoteDraft} from '../types';

afterEach(cleanup);
describe('compact owner ride actions',()=>{
  const request=(values:Partial<RideRequest>)=>values as RideRequest;
  it('distinguishes an unquoted ride from a real zero price',()=>{
    const view=render(<RequestPriceSummary request={request({})}/>);
    expect(screen.getByText('Not quoted')).toBeInTheDocument();
    view.rerender(<RequestPriceSummary request={request({quoteAmount:0})}/>);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.queryByText('Not quoted')).not.toBeInTheDocument();
  });
  it('projects the saved canonical total rather than an older ride amount',()=>{
    const draft={customerTotalMinor:5500,status:'draft',isCurrent:true} as ManualQuoteDraft;
    const view=render(<RequestPriceSummary request={request({quoteAmount:70,manualQuoteDraft:draft})}/>);
    expect(screen.getByText('$55.00')).toBeInTheDocument();
    expect(screen.getByText('Quote draft')).toBeInTheDocument();
    view.rerender(<RequestPriceSummary request={request({manualQuoteDraft:{...draft,isCurrent:false}})}/>);
    expect(screen.getByText('Saved quote · needs review')).toBeInTheDocument();
  });
  it('labels approved quotes without implying that payment has arrived',()=>{
    render(<RequestPriceSummary request={request({manualQuoteDraft:{customerTotalMinor:0,status:'approved',isCurrent:true} as ManualQuoteDraft})}/>);
    expect(screen.getByText('Approved quote')).toBeInTheDocument();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.queryByText('Paid')).not.toBeInTheDocument();
  });
  it('puts the summary before route details and labels list navigation as a destination',()=>{
    const source=readFileSync('src/pages/RequestDetail.tsx','utf8');
    expect(source.indexOf('<RequestPriceSummary request={request}/>')).toBeLessThan(source.indexOf('<header className="detail-head'));
    expect(source).toContain('<Link to="/requests" replace>All rides</Link>');
    expect(source).not.toContain('<OwnerReturnLink/>');
  });
  it('retains guest telephone binding with an accessible icon and full touch target',()=>{
    const source=readFileSync('src/pages/Dashboard.tsx','utf8');
    expect(source).toContain("href={'tel:'+nextRide.phone.replace(/[^+\\d]/g,'')}");
    expect(source).toContain("aria-label={'Call guest: '+nextRide.customerName}");
    expect(source).not.toContain('<span>Call guest</span>');
    const styles=readFileSync('src/owner-quick-actions.css','utf8');
    expect(styles).toContain('min-width:44px');
    expect(styles).toContain('min-height:44px');
    expect(styles).toContain(':focus-visible');
  });
});
