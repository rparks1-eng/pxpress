import {beforeEach,describe,expect,it,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('../../lib/supabase',()=>({supabase:{rpc}}));
import {reviewGuestFeedback,type GuestFeedback} from './repository';
const item={id:'feedback-test',visibility:'public_with_consent'} as GuestFeedback;
describe('feedback moderation',()=>{
 beforeEach(()=>rpc.mockReset());
 it('will never publish private feedback',async()=>{await expect(reviewGuestFeedback({...item,visibility:'private'},'approved')).rejects.toThrow('private');expect(rpc).not.toHaveBeenCalled()});
 it('requires a verified saved decision',async()=>{rpc.mockResolvedValue({data:'approved',error:null});await reviewGuestFeedback(item,'approved');expect(rpc).toHaveBeenCalledWith('admin_moderate_ride_feedback',{p_feedback_id:item.id,p_decision:'approved'})});
 it('fails closed on failed or ambiguous writes',async()=>{rpc.mockResolvedValue({data:null,error:null});await expect(reviewGuestFeedback(item,'approved')).rejects.toThrow('verified');rpc.mockResolvedValue({error:{code:'42501'}});await expect(reviewGuestFeedback(item,'approved')).rejects.toThrow('could not be saved')});
});
