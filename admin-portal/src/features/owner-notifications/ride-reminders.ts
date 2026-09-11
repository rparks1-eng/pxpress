import { supabase } from '../../lib/supabase';
import type { OwnerNotification } from '../../lib/operations';
export async function readRideReminders():Promise<OwnerNotification[]> {
  if(!supabase)return [];
  const {data,error}=await supabase.rpc('owner_read_ride_reminders');
  if(error)throw new Error('Ride reminders could not refresh.');
  if(!Array.isArray(data))throw new Error('Ride reminder response invalid.');
  return data.slice(0,100).map(row=>({
    id:`ride-reminder:${row.id}`,requestId:row.requestId,kind:row.state!=='sent'?'system_error':'upcoming',priority:row.state!=='sent'||row.kind==='hour_before'?3:2,
    title:row.state==='skipped'?'Ride reminder missed its window':row.state==='outcome_unknown'?'Ride reminder needs review':row.kind==='hour_before'?'Pickup in one hour':'Ride in 24 hours',
    detail:`${row.reference} · ${new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(row.pickupAt))} · ${row.pickupAddress}`,
    at:row.at,timeBasis:'scheduled_pickup',
  }));
}
