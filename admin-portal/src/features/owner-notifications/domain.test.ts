import { describe,expect,it } from 'vitest';
import type { OwnerNotification } from '../../lib/operations';
import { bannerEligible,dedupeNotifications,emptyNotificationStore,notificationCategory,reconcileNotificationStore,safeNotificationRoute,unreadNotificationCount } from './domain';

const notice=(overrides:Partial<OwnerNotification>={}):OwnerNotification=>({id:'new:req-1',requestId:'req-1',kind:'new_request',priority:2,title:'New ride request',detail:'Ready for review.',at:'2026-09-02T12:00:00Z',timeBasis:'request_received_fallback',...overrides});

describe('owner notification state',()=>{
  it('deduplicates stable identities and sorts by urgency then time',()=>{
    const items=dedupeNotifications([notice(),notice({detail:'Updated',at:'2026-09-02T13:00:00Z'}),notice({id:'conflict:req-2',requestId:'req-2',kind:'conflict',priority:3})]);
    expect(items).toHaveLength(2);expect(items[0].kind).toBe('conflict');expect(items[1].detail).toBe('Updated');
  });
  it('establishes the initial baseline without a banner, then identifies a genuinely new record',()=>{
    const baseline=reconcileNotificationStore(emptyNotificationStore(),[notice()]);
    expect(baseline.added).toEqual([]);
    const next=reconcileNotificationStore(baseline.store,[notice(),notice({id:'payment:req-2',requestId:'req-2',kind:'payment_pending'})]);
    expect(next.added).toEqual(['payment:req-2']);expect(unreadNotificationCount(next.store)).toBe(2);
  });
  it('does not replay an existing alert after a refresh or reconnect',()=>{
    const baseline=reconcileNotificationStore(emptyNotificationStore(),[notice()]).store;
    const firstUpdate=reconcileNotificationStore(baseline,[notice(),notice({id:'payment:req-2',requestId:'req-2',kind:'payment_pending'})]);
    expect(firstUpdate.added).toEqual(['payment:req-2']);
    const refresh=reconcileNotificationStore(firstUpdate.store,[notice(),notice({id:'payment:req-2',requestId:'req-2',kind:'payment_pending',detail:'Still awaiting payment.'})]);
    expect(refresh.added).toEqual([]);
    expect(refresh.store.records['payment:req-2'].notification.detail).toBe('Still awaiting payment.');
  });
  it('keeps dismissed and read state separate and excludes inactive history from unread count',()=>{
    const first=reconcileNotificationStore(emptyNotificationStore(),[notice()]).store;
    const dismissed={...first,records:{...first.records,['new:req-1']:{...first.records['new:req-1'],bannerDismissed:true}}};
    expect(bannerEligible(dismissed.records['new:req-1'])).toBe(false);expect(dismissed.records['new:req-1'].read).toBe(false);
    const historical=reconcileNotificationStore(dismissed,[]).store;
    expect(historical.records['new:req-1'].active).toBe(false);expect(unreadNotificationCount(historical)).toBe(0);
  });
  it('only produces a safe internal request route',()=>{
    expect(safeNotificationRoute(notice())).toBe('/requests/req-1');
    expect(safeNotificationRoute(notice({requestId:'https://evil.example'}))).toBeUndefined();
  });
  it('groups events into clear owner-facing categories',()=>{
    expect(notificationCategory('new_request')).toBe('requests');
    expect(notificationCategory('upcoming')).toBe('rides');
    expect(notificationCategory('payment_received')).toBe('payments');
    expect(notificationCategory('system_error')).toBe('operations');
  });
});
