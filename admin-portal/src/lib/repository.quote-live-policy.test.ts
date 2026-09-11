import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('./supabase',()=>({supabase:{functions:{invoke:mock.invoke}},tableNames:{},analyticsViews:{},wixReconciliationEnabled:false}));
import {demoRequests} from '../demo-data';
import {releaseManualQuoteForPayment,readManualQuoteRelease} from './repository';
import {presentationProducerConfigured} from './quote-release-result';
import {quotePresentationPolicy} from './quote-presentation-policy';
const owner='00000000-0000-4000-8000-000000000004';
const request={...demoRequests[0],id:'00000000-0000-4000-8000-000000000001',customerId:'00000000-0000-4000-8000-000000000002',version:1,currency:'USD',paymentStatus:'not_requested' as const,
 manualQuoteDraft:{status:'draft' as const,inputSemantics:'final_customer_total_tax_included' as const,quoteId:'00000000-0000-4000-8000-000000000003',enteredCustomerTotalMinor:500,rateBasisPoints:0,serviceSubtotalMinor:500,salesTaxMinor:0,customerTotalMinor:500,savedAt:'2026-09-10T13:00:00Z',isCurrent:true,paymentLinkReady:false}};
describe('actual compiled quote producer, without a policy mock',()=>{
 beforeEach(()=>{vi.clearAllMocks();mock.invoke.mockResolvedValue({data:{data:null},error:null})});
 it('enables only the reviewed producer and observed Wix route',()=>{
  expect(presentationProducerConfigured()).toBe(true);
  expect(quotePresentationPolicy.producerId).toBe('pxpress-send-quote-v2');
  expect(quotePresentationPolicy.allowedDestinations).toEqual([{origin:'https://pxpressmedia.wixsite.com',pathPrefix:'/pxpress-llc/_paylink/'}]);
 });
 it('Send quote reaches the authenticated Edge action, then rejects invalid receipts',async()=>{
  const result=await releaseManualQuoteForPayment(request,owner);
  expect(mock.invoke).toHaveBeenCalledWith('admin-mutations',{body:{action:'approveManualOwnerTaxQuoteForWixPayment',rideRequestId:request.id,expectedVersion:1,quoteId:request.manualQuoteDraft.quoteId}});
  expect(result.status).toBe('unavailable');
 });
 it('Check quote status performs an actual read, never a send',async()=>{
  await readManualQuoteRelease(request,owner);
  expect(mock.invoke).toHaveBeenCalledWith('admin-mutations',{body:{action:'readSendQuote',rideRequestId:request.id,expectedVersion:1,quoteId:request.manualQuoteDraft.quoteId}});
  expect(mock.invoke).toHaveBeenCalledTimes(1);
 });
});
