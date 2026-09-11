import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {QuoteReleaseDialog} from './QuoteReleaseDialog';
import {demoRequests} from '../demo-data';
import {canReviewExpiredQuote,decodeReleaseResponse,releaseTarget} from '../lib/quote-release-result';
const owner='00000000-0000-4000-8000-000000000004';
const request={...demoRequests[0],status:'deposit_pending' as const,id:'00000000-0000-4000-8000-000000000001',customerId:'00000000-0000-4000-8000-000000000002',email:'internal@example.com',version:2,currency:'USD',paymentStatus:'pending' as const,
manualQuoteDraft:{status:'approved' as const,inputSemantics:'final_customer_total_tax_included' as const,quoteId:'00000000-0000-4000-8000-000000000003',enteredCustomerTotalMinor:500,rateBasisPoints:0,serviceSubtotalMinor:500,salesTaxMinor:0,customerTotalMinor:500,savedAt:'2026-09-10T13:00:00Z',isCurrent:true,paymentLinkReady:false}};
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
describe('explicit expired quote review',()=>{
 it('renders the same quote and requires one deliberate confirmation with no edit or automatic send',()=>{
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.open=true}});
  const send=vi.fn().mockResolvedValue(undefined),edit=vi.fn();
  render(<QuoteReleaseDialog request={request} recovery busy={false} onDismiss={()=>{}} onEdit={edit} onRelease={send}/>);
  expect(screen.getByText(request.email)).toBeTruthy();expect(screen.queryByRole('button',{name:'Edit'})).toBeNull();expect(send).not.toHaveBeenCalled();
  const button=screen.getByRole('button',{name:'Confirm and continue'});fireEvent.click(button);fireEvent.click(button);
  expect(send).toHaveBeenCalledTimes(1);expect(edit).not.toHaveBeenCalled();
 });
 it('maps expiry only from an authenticated queued-job readback and binds recovery to the current scope',async()=>{
  vi.stubGlobal('crypto',webcrypto);
  const target=releaseTarget(request,owner)!;
  const bytes=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(target.email));
  const scope={requestId:target.requestId,quoteId:target.quoteId,requestVersion:2,customerId:target.customerId,ownerId:owner,recipientFingerprint:Buffer.from(bytes).toString('hex')};
  const payload={schemaVersion:'pxpress-owner-quote-release-v1',producerId:'pxpress-send-quote-v2',scope,status:'unavailable',emailStatus:'not_sent',reason:'review_expired'};
  const result=await decodeReleaseResponse(payload,target);
  expect(result).toMatchObject({status:'unavailable',reason:'review_expired'});
  expect(canReviewExpiredQuote(result,request,owner)).toBe(true);
  expect(canReviewExpiredQuote(result,{...request,version:3},owner)).toBe(false);
  expect(canReviewExpiredQuote(result,{...request,paymentStatus:'paid'},owner)).toBe(false);
  expect(canReviewExpiredQuote(result,request,'another-owner')).toBe(false);
  expect(canReviewExpiredQuote(null,request,owner)).toBe(false);
  const pending=await decodeReleaseResponse({...payload,status:'pending',reason:'checking'},target);
  expect(canReviewExpiredQuote(pending,request,owner)).toBe(false);
  const unknown=await decodeReleaseResponse({...payload,status:'failed',emailStatus:'unknown',reason:'outcome_unknown'},target);
  expect(canReviewExpiredQuote(unknown,request,owner)).toBe(false);
 });
});
