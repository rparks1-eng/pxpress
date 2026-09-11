import { beforeEach,describe,expect,it,vi } from 'vitest';

const mock=vi.hoisted(()=>({from:vi.fn(),order:vi.fn(),select:vi.fn(),rpc:vi.fn()}));
vi.mock('./supabase',()=>({
  supabase:{from:mock.from,rpc:mock.rpc,functions:{invoke:vi.fn()}},
  tableNames:{requests:'ride_requests',history:'ride_request_history'},
  analyticsViews:{daily:'daily',pages:'pages',sources:'sources',services:'services'},
  wixReconciliationEnabled:false,
}));

import { isOptionalTaxProjectionSchemaMiss,listRequests,taxCenterReadError,toRequest } from './repository';

const row={id:'00000000-0000-4000-8000-000000000001',public_reference:'PXR-TEST',status:'new',requested_at:'2026-09-02T12:00:00Z',version:1,service:'airport',trip_type:'one-way',pickup_address:'Pickup',destination_address:'Destination',pickup_date:'2026-09-03',pickup_time:'13:45:00',passengers:1,customers:{id:'customer-1',full_name:'Test Guest',email:'test@example.com',phone:'234-555-0100'},quotes:[],payments:[],ride_request_internal_notes:[],lifecycle_effects:[]};

describe('request repository optional tax projection',()=>{
  beforeEach(()=>{vi.clearAllMocks();mock.from.mockImplementation(()=>({select:mock.select}));mock.select.mockImplementation(()=>({order:mock.order}));mock.rpc.mockResolvedValue({data:[],error:null})});
  it('loads the core owner queue when only the additive tax relationship is absent',async()=>{
    mock.order
      .mockResolvedValueOnce({data:null,error:{code:'PGRST200',message:"Could not find a relationship between 'ride_requests' and 'ride_tax_quote_projections' in the schema cache"}})
      .mockResolvedValueOnce({data:[row],error:null});
    const requests=await listRequests();
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({requestNumber:'PXR-TEST'});
    expect(requests[0]).not.toHaveProperty('taxProjection');
    expect(mock.select).toHaveBeenCalledTimes(2);
    expect(mock.select.mock.calls[0][0]).toContain('ride_tax_quote_projections');
    expect(mock.select.mock.calls[1][0]).not.toContain('ride_tax_quote_projections');
  });
  it('does not mask authorization, network, or unrelated schema failures',async()=>{
    const error={code:'42501',message:'permission denied'};
    mock.order.mockResolvedValueOnce({data:null,error});
    await expect(listRequests()).rejects.toBe(error);
    expect(mock.select).toHaveBeenCalledOnce();
  });
  it('requires both exact relation names before using the compatibility read',()=>{
    expect(isOptionalTaxProjectionSchemaMiss({code:'PGRST200',message:'ride_tax_quote_projections is absent'})).toBe(false);
    expect(isOptionalTaxProjectionSchemaMiss({code:'PGRST200',message:'ride_requests and ride_tax_quote_projections relationship missing'})).toBe(true);
  });
  it('turns the absent Tax Center RPC into an owner-readable unavailable state',()=>{
    expect(taxCenterReadError({code:'PGRST202',message:'Could not find the function public.admin_read_tax_center in the schema cache'}).message).toBe('Tax Center is not connected to this database yet. No tax totals are being assumed.');
    expect(taxCenterReadError({code:'42501',message:'permission denied'}).message).toBe('Tax records could not be verified. Retry after the private database connection is available.');
  });
  it('keeps every persisted owner note in chronological order while retaining the latest summary',()=>{
    const request=toRequest({...row,ride_request_internal_notes:[
      {note:'Confirmed garage code.',created_at:'2026-09-02T15:04:00Z'},
      {note:'Guest asked for a five-minute arrival text.',created_at:'2026-09-02T17:45:00Z'},
    ]});
    expect(request.ownerNotes).toBe('Guest asked for a five-minute arrival text.');
    expect(request.ownerNoteHistory).toEqual([
      {note:'Confirmed garage code.',createdAt:'2026-09-02T15:04:00Z'},
      {note:'Guest asked for a five-minute arrival text.',createdAt:'2026-09-02T17:45:00Z'},
    ]);
  });
  it('keeps a current manual draft separate from the canonical sent quote amount after reload',async()=>{
    const sent={...row,version:8,quoted_amount:'125.00',currency:'USD',quotes:[{status:'draft',total:85,created_at:'2026-09-03T10:00:00Z'}]};
    mock.order.mockResolvedValueOnce({data:[sent],error:null});
    mock.rpc.mockResolvedValueOnce({data:[{ride_request_id:sent.id,status:'draft',input_semantics:'final_customer_total_tax_included',entered_final_customer_total_minor:8500,entered_base_fare_minor:null,rate_basis_points:675,service_subtotal_minor:7963,tax_minor:537,customer_total_minor:8500,saved_at:'2026-09-03T10:00:00Z',is_current:true}],error:null});
    const [request]=await listRequests();
    expect(request.quoteAmount).toBe(125);
    expect(request.manualQuoteDraft).toEqual({status:'draft',inputSemantics:'final_customer_total_tax_included',enteredCustomerTotalMinor:8500,rateBasisPoints:675,serviceSubtotalMinor:7963,salesTaxMinor:537,customerTotalMinor:8500,savedAt:'2026-09-03T10:00:00Z',isCurrent:true});
    expect(mock.rpc).toHaveBeenCalledWith('admin_read_manual_owner_tax_quote_drafts',{p_ride_request_ids:[sent.id]});
  });
  it('does not surface a stale, malformed, or non-draft audit projection',async()=>{
    mock.order.mockResolvedValueOnce({data:[row],error:null});
    mock.rpc.mockResolvedValueOnce({data:[
      {ride_request_id:row.id,status:'sent',entered_base_fare_minor:7495,rate_basis_points:675,service_subtotal_minor:7963,tax_minor:537,customer_total_minor:8500,saved_at:'2026-09-03T10:00:00Z',is_current:true},
      {ride_request_id:row.id,status:'draft',entered_base_fare_minor:7495,rate_basis_points:675,service_subtotal_minor:7963,tax_minor:538,customer_total_minor:8500,saved_at:'not-a-time',is_current:false},
    ],error:null});
    const [request]=await listRequests();
    expect(request.manualQuoteDraft).toBeUndefined();
  });
  it('keeps the latest draft visible but marked stale after a non-price request update',async()=>{
    mock.order.mockResolvedValueOnce({data:[row],error:null});
    mock.rpc.mockResolvedValueOnce({data:[{ride_request_id:row.id,status:'draft',input_semantics:'legacy_base_fare_plus_tax',entered_base_fare_minor:7495,rate_basis_points:675,service_subtotal_minor:7963,tax_minor:537,customer_total_minor:8500,saved_at:'2026-09-03T10:00:00Z',is_current:false}],error:null});
    const [request]=await listRequests();
    expect(request.manualQuoteDraft).toMatchObject({status:'draft',isCurrent:false,customerTotalMinor:8500});
  });
});
