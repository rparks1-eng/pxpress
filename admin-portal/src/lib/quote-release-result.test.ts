import { describe,expect,it } from 'vitest';
import { demoRequests } from '../demo-data';
import { releaseTarget } from './quote-release-result';

const request={
  ...demoRequests[0],
  id:'00000000-0000-4000-8000-000000000001',
  customerId:'00000000-0000-4000-8000-000000000002',
  version:1,
  currency:'USD',
  paymentStatus:'not_requested' as const,
  manualQuoteDraft:{
    status:'draft' as const,inputSemantics:'final_customer_total_tax_included' as const,
    quoteId:'00000000-0000-4000-8000-000000000003',enteredCustomerTotalMinor:500,
    rateBasisPoints:0,serviceSubtotalMinor:500,salesTaxMinor:0,customerTotalMinor:500,
    savedAt:'2026-09-10T13:00:00Z',isCurrent:true,paymentLinkReady:false,
  },
};

describe('quote release target',()=>{
  it('does not let a stale client readiness hint suppress a current saved-quote request',()=>{
    expect(releaseTarget(request,'00000000-0000-4000-8000-000000000004')).toMatchObject({
      requestId:request.id,quoteId:request.manualQuoteDraft.quoteId,requestVersion:1,totalMinor:500,
    });
  });
  it('still rejects a stale draft before it can reach the server',()=>{
    expect(releaseTarget({...request,manualQuoteDraft:{...request.manualQuoteDraft,isCurrent:false}},'00000000-0000-4000-8000-000000000004')).toBeNull();
  });
});
