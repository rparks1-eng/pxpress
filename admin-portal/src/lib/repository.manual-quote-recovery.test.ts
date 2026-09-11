import {beforeEach,describe,expect,it,vi} from 'vitest';

const mock=vi.hoisted(()=>({invoke:vi.fn(),rpc:vi.fn()}));
vi.mock('./supabase',()=>({
  supabase:{from:vi.fn(),rpc:mock.rpc,functions:{invoke:mock.invoke}},
  tableNames:{requests:'ride_requests',history:'ride_request_history'},
  analyticsViews:{daily:'daily',pages:'pages',sources:'sources',services:'services'},
  wixReconciliationEnabled:false,
}));

import {demoRequests} from '../demo-data';
import {manualOwnerTaxIncludedQuote} from '../features/fare-recommendation/domain';
import {approveAndPreparePayment} from './repository';

const request={...demoRequests[0],id:'00000000-0000-4000-8000-000000000001',version:1};
const decision={
  currency:'USD' as const,
  serviceSubtotalMinor:6089,
  salesTaxMinor:411,
  customerTotalMinor:6500,
  manualTaxQuote:manualOwnerTaxIncludedQuote(6500,6.75)!,
};
const matchingDraft={
  ride_request_id:request.id,quote_id:'00000000-0000-4000-8000-000000000002',status:'draft',
  input_semantics:'final_customer_total_tax_included',entered_final_customer_total_minor:6500,entered_base_fare_minor:null,
  rate_basis_points:675,service_subtotal_minor:6089,tax_minor:411,customer_total_minor:6500,
  saved_at:'2026-09-10T01:00:00Z',is_current:true,
};

describe('manual quote unknown-outcome readback',()=>{
  beforeEach(()=>vi.clearAllMocks());
  it('accepts a lost Edge response only after the exact current saved draft is read back',async()=>{
    mock.invoke.mockResolvedValue({data:null,error:{name:'FunctionsFetchError',message:'Failed to send a request to the Edge Function'},response:undefined});
    mock.rpc.mockResolvedValue({data:[matchingDraft],error:null});
    await expect(approveAndPreparePayment(request,decision)).resolves.toBeUndefined();
    expect(mock.invoke).toHaveBeenCalledWith('admin-mutations',{body:{action:'createManualOwnerTaxIncludedQuote',rideRequestId:request.id,expectedVersion:1,enteredCustomerTotalMinor:6500,enteredRateBasisPoints:675}});
    expect(mock.rpc).toHaveBeenCalledWith('admin_read_manual_owner_tax_quote_drafts',{p_ride_request_ids:[request.id]});
  });
  it('does not convert a missing or mismatched readback into a successful save',async()=>{
    mock.invoke.mockResolvedValue({data:null,error:{name:'FunctionsFetchError',message:'Failed to send a request to the Edge Function'},response:undefined});
    mock.rpc.mockResolvedValue({data:[{...matchingDraft,customer_total_minor:7000}],error:null});
    await expect(approveAndPreparePayment(request,decision)).rejects.toThrow(/could not reach the secure request service/i);
  });
});
