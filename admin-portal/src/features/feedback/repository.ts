import { supabase } from '../../lib/supabase';

export type GuestFeedback={id:string;ride_request_id:string;stars:number;comment:string;visibility:'private'|'public_with_consent';moderation_status:string;created_at:string;synthetic:boolean};
export async function listGuestFeedback():Promise<GuestFeedback[]>{
  if(!supabase)throw new Error('Sign in to load customer feedback.');
  const {data,error}=await supabase.from('ride_feedback').select('id,ride_request_id,stars,comment,visibility,moderation_status,created_at,synthetic').eq('synthetic',false).order('created_at',{ascending:false}).limit(200);
  if(error)throw new Error('Feedback could not be loaded. Try again.');
  return (data||[]) as GuestFeedback[];
}
export async function reviewGuestFeedback(item:GuestFeedback,decision:'approved'|'rejected'){
  if(!supabase)throw new Error('Sign in before reviewing feedback.');
  if(item.visibility!=='public_with_consent'&&decision==='approved')throw new Error('This guest chose private feedback. It cannot be published.');
  const {data,error}=await supabase.rpc('admin_moderate_ride_feedback',{p_feedback_id:item.id,p_decision:decision});
  if(error)throw new Error('This review could not be saved. Refresh before trying again.');
  if(data!==decision)throw new Error('The saved review could not be verified. Refresh before trying again.');
}
