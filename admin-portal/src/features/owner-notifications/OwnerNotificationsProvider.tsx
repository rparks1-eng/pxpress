import { createContext,useCallback,useContext,useEffect,useMemo,useRef,useState } from 'react';
import { useEvents,useNotificationRequests } from '../../hooks';
import type { NotificationRequestProvenance } from '../../lib/repository';
import { buildOwnerNotifications } from '../../lib/operations';
import { bannerEligible,reconcileNotificationStore,sortedNotificationRecords,unreadNotificationCount,type NotificationStore } from './domain';
import { DeviceLocalNotificationRepository,type NotificationStateRepository } from './local-repository';
import { readRideReminders } from './ride-reminders';

type NotificationContextValue={
  records:ReturnType<typeof sortedNotificationRecords>;
  banners:ReturnType<typeof sortedNotificationRecords>;
  unreadCount:number;
  loading:boolean;
  error:string;
  provenance:NotificationRequestProvenance;
  reload():void;
  markRead(id:string,read?:boolean):void;
  markAllRead():void;
  dismissBanner(id:string):void;
};

const emptyContext:NotificationContextValue={records:[],banners:[],unreadCount:0,loading:false,error:'',provenance:'disconnected',reload(){},markRead(){},markAllRead(){},dismissBanner(){}};
const NotificationContext=createContext<NotificationContextValue>(emptyContext);

export function OwnerNotificationsProvider({children,repository}:{children:React.ReactNode;repository?:NotificationStateRepository}){
  const requests=useNotificationRequests();
  const events=useEvents();
  const repositoryRef=useRef<NotificationStateRepository>(repository||new DeviceLocalNotificationRepository());
  const [store,setStore]=useState<NotificationStore>(()=>repositoryRef.current.load());
  const [bannerIds,setBannerIds]=useState<string[]>([]);
  const [rideReminders,setRideReminders]=useState<Awaited<ReturnType<typeof readRideReminders>>>([]);
  const [reminderError,setReminderError]=useState('');
  const reloadReminders=useCallback(()=>{readRideReminders().then(rows=>{setRideReminders(rows);setReminderError('')}).catch(()=>setReminderError('Ride reminders could not refresh.'))},[]);
  useEffect(()=>{reloadReminders();const timer=window.setInterval(reloadReminders,30_000);return()=>window.clearInterval(timer)},[reloadReminders]);

  useEffect(()=>{
    if(requests.loading||events.loading||requests.error||events.error)return;
    setStore(current=>{
      const remindedRequests=new Set(rideReminders.map(item=>item.requestId));
      const standard=buildOwnerNotifications(requests.data,new Date(),events.data).filter(item=>item.kind!=='upcoming'||!remindedRequests.has(item.requestId));
      const result=reconcileNotificationStore(current,requests.provenance==='disconnected'?[]:[...standard,...rideReminders]);
      repositoryRef.current.save(result.store);
      if(result.added.length)setBannerIds(ids=>[...new Set([...ids,...result.added])]);
      return result.store;
    });
  },[events.data,events.error,events.loading,requests.data,requests.error,requests.loading,requests.provenance,rideReminders]);

  useEffect(()=>{
    const timer=window.setInterval(()=>{requests.reload();events.reload()},30_000);
    return()=>window.clearInterval(timer);
  },[events.reload,requests.reload]);

  const mutate=useCallback((change:(current:NotificationStore)=>NotificationStore)=>setStore(current=>{const next=change(current);repositoryRef.current.save(next);return next}),[]);
  const markRead=useCallback((id:string,read=true)=>mutate(current=>{const record=current.records[id];return record?{...current,records:{...current.records,[id]:{...record,read}}}:current}),[mutate]);
  const markAllRead=useCallback(()=>mutate(current=>({
    ...current,
    records:Object.fromEntries(Object.entries(current.records).map(([id,record])=>[id,record.active?{...record,read:true}:record])),
  })),[mutate]);
  const dismissBanner=useCallback((id:string)=>{setBannerIds(ids=>ids.filter(value=>value!==id));mutate(current=>{const record=current.records[id];return record?{...current,records:{...current.records,[id]:{...record,bannerDismissed:true}}}:current})},[mutate]);
  const connected=requests.provenance!=='disconnected';
  const records=useMemo(()=>sortedNotificationRecords(store),[store]);
  const banners=useMemo(()=>connected?records.filter(record=>bannerIds.includes(record.notification.id)&&bannerEligible(record)):[],[bannerIds,connected,records]);
  const reload=useCallback(()=>{requests.reload();events.reload();reloadReminders()},[events.reload,requests.reload,reloadReminders]);
  const value=useMemo(()=>({records,banners,unreadCount:connected?unreadNotificationCount(store):0,loading:requests.loading||events.loading,error:requests.error||events.error||reminderError,provenance:requests.provenance,reload,markRead,markAllRead,dismissBanner}),[banners,connected,events.error,events.loading,markAllRead,markRead,dismissBanner,records,reload,requests.error,requests.loading,requests.provenance,store,reminderError]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useOwnerNotifications=()=>useContext(NotificationContext);
