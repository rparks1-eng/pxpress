import {describe,it,expect,vi,beforeEach} from 'vitest';

const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../../lib/supabase',()=>({supabase:{rpc}}));
import {readPublicFinderState} from './public-finder-repository';

const evidence={matchedAddress:'1 CAPITOL SQ, COLUMBUS, OH 43215',applicableDate:'2026-09-07',observedAt:'2026-09-07T16:09:34.503Z',sourceUrl:'https://thefinder.tax.ohio.gov/StreamlineSalesTaxWeb/default.aspx',jurisdiction:'Franklin (25) with COTA',rateBasisPoints:800};
const state={connected:true,dispatchEnabled:false,consumerEnabled:false,paymentDeliveryAllowed:false,policies:[],job:{id:'job',requestRevision:1,status:'accepted',pricingReady:true,evidence}};

beforeEach(()=>rpc.mockReset());
describe('public Finder evidence readback',()=>{
 it('accepts complete exact-address and effective-date evidence',async()=>{rpc.mockResolvedValue({data:state,error:null});expect((await readPublicFinderState('ride')).job?.evidence).toEqual(evidence);});
 it.each([
  ['missing matched address',{...evidence,matchedAddress:''}],
  ['invalid effective date',{...evidence,applicableDate:'today'}],
  ['non-Ohio source',{...evidence,sourceUrl:'https://example.com/rate'}],
  ['invalid rate units',{...evidence,rateBasisPoints:8.25}],
 ])('rejects %s',async(_label,bad)=>{rpc.mockResolvedValue({data:{...state,job:{...state.job,evidence:bad}},error:null});await expect(readPublicFinderState('ride')).rejects.toThrow('evidence readback is invalid');});
});
