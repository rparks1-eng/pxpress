import { describe,expect,it } from 'vitest';
import { demoRequests } from '../demo-data';
import { buildOwnerNotifications,nextOperationalRide,rideCountdown,todaysRides } from './operations';

const now=new Date('2026-09-02T06:45:00');

describe('daily owner operations',()=>{
  it('keeps today chronological and picks the next scheduled ride',()=>{
    const early={...demoRequests[0],id:'early',pickupDate:'2026-09-02',pickupTime:'07:15'};
    const later={...demoRequests[2],id:'later',pickupDate:'2026-09-02',pickupTime:'18:15'};
    expect(todaysRides([later,early],now).map(item=>item.id)).toEqual(['early','later']);
    expect(nextOperationalRide([{...early,status:'confirmed'},later],now)?.id).toBe('early');
    expect(rideCountdown({...early,status:'confirmed'},now)).toBe('30 min to pickup');
  });
  it('shows payment pending only after the customer payment link was delivered',()=>{
    const upcoming={...demoRequests[2],id:'soon',pickupDate:'2026-09-02',pickupTime:'08:15'};
    const pending={...demoRequests[0],id:'pending',status:'deposit_pending' as const,paymentStatus:'pending' as const,pickupDate:'2026-09-03',pickupTime:'06:45'};
    const conflict={...demoRequests[0],id:'conflict',status:'scheduling_conflict' as const};
    const items=buildOwnerNotifications([upcoming,pending,conflict],now);
    expect(items.some(item=>item.kind==='upcoming'&&item.title==='Ride within 2 hours')).toBe(true);
    expect(items.some(item=>item.kind==='payment_pending')).toBe(false);
    expect(items.some(item=>item.kind==='conflict')).toBe(true);
    const delivered={...pending,lifecycleEffects:[{id:'delivery',effectType:'customer_payment_link_delivery' as const,state:'delivered' as const,enabledSnapshot:true,attemptCount:1,maxAttempts:4,deliveredAt:'2026-09-02T07:00:00Z',updatedAt:'2026-09-02T07:00:00Z'}]};
    expect(buildOwnerNotifications([delivered],now).find(item=>item.kind==='payment_pending')).toMatchObject({title:'Awaiting customer payment',detail:expect.stringContaining('was delivered')});
  });
  it('does not invent a reminder for a completed ride',()=>expect(buildOwnerNotifications([demoRequests[3]],now)).toEqual([]));
  it('uses lifecycle event time for a cancellation and labels an unavailable fallback',()=>{
    const cancelled={...demoRequests[0],status:'cancelled' as const};
    const actual=buildOwnerNotifications([cancelled],now,[{id:'event',requestId:cancelled.id,at:'2026-09-02T10:15:00Z',actor:'owner',action:'confirmed → cancelled',detail:''}])[0];
    expect(actual).toMatchObject({at:'2026-09-02T10:15:00Z',timeBasis:'lifecycle_event'});
    expect(buildOwnerNotifications([cancelled],now)[0].detail).toContain('Status time is unavailable');
  });
});
