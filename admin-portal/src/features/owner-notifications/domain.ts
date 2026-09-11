import type { OwnerNotification } from '../../lib/operations';

export type NotificationCategory='requests'|'rides'|'payments'|'operations';
export type NotificationFilter='all'|NotificationCategory;

export function notificationCategory(kind:OwnerNotification['kind']):NotificationCategory{
  if(kind==='new_request'||kind==='cancellation')return 'requests';
  if(kind==='upcoming'||kind==='conflict')return 'rides';
  if(kind==='payment_pending'||kind==='payment_received'||kind==='payment_failed')return 'payments';
  return 'operations';
}

export const notificationCategoryLabel=(category:NotificationCategory)=>({requests:'Requests',rides:'Rides',payments:'Payments',operations:'Operations'}[category]);

export type NotificationRecord={
  notification:OwnerNotification;
  active:boolean;
  read:boolean;
  bannerDismissed:boolean;
  firstSeenAt:string;
  lastSeenAt:string;
};

export type NotificationStore={version:2;initialized:boolean;records:Record<string,NotificationRecord>};

export const emptyNotificationStore=():NotificationStore=>({version:2,initialized:false,records:{}});

export function dedupeNotifications(items:OwnerNotification[]){
  const byId=new Map<string,OwnerNotification>();
  for(const item of items){
    const existing=byId.get(item.id);
    if(!existing||new Date(item.at).getTime()>new Date(existing.at).getTime())byId.set(item.id,item);
  }
  return [...byId.values()].sort((a,b)=>b.priority-a.priority||new Date(b.at).getTime()-new Date(a.at).getTime()||a.id.localeCompare(b.id));
}

export function reconcileNotificationStore(current:NotificationStore,incoming:OwnerNotification[],now=new Date()){
  const records:NotificationStore['records']={};
  for(const [id,record] of Object.entries(current.records))records[id]={...record,active:false};
  const added:string[]=[];
  for(const notification of dedupeNotifications(incoming)){
    const previous=records[notification.id];
    if(!previous&&current.initialized)added.push(notification.id);
    records[notification.id]=previous
      ?{...previous,notification,active:true,lastSeenAt:now.toISOString()}
      :{notification,active:true,read:false,bannerDismissed:false,firstSeenAt:now.toISOString(),lastSeenAt:now.toISOString()};
  }
  return {store:{version:2,initialized:true,records} satisfies NotificationStore,added};
}

export const sortedNotificationRecords=(store:NotificationStore)=>Object.values(store.records).sort((a,b)=>Number(b.active)-Number(a.active)||b.notification.priority-a.notification.priority||new Date(b.notification.at).getTime()-new Date(a.notification.at).getTime()||a.notification.id.localeCompare(b.notification.id));
export const unreadNotificationCount=(store:NotificationStore)=>Object.values(store.records).filter(record=>record.active&&!record.read).length;
export const bannerEligible=(record:NotificationRecord)=>record.active&&!record.read&&!record.bannerDismissed&&record.notification.priority>=2;

export function safeNotificationRoute(notification:OwnerNotification){
  return /^[A-Za-z0-9_-]+$/.test(notification.requestId)?`/requests/${encodeURIComponent(notification.requestId)}`:undefined;
}
