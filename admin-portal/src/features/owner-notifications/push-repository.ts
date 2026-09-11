import { supabase } from '../../lib/supabase';
import type { OwnerNotificationPreferences } from './push-policy';

export type OwnerPushReadiness={serverConfigured:boolean;databaseReady:boolean;featureEnabled:boolean;dispatchEnabled:boolean;subscriptionActive:boolean;preferences?:OwnerNotificationPreferences;preferencesRevision?:string;reason?:string};
export type BrowserSubscription={endpoint:string;expirationTime:number|null;keys:{p256dh:string;auth:string}};

export function decodeVapidPublicKey(value:string){
  if(!/^[A-Za-z0-9_-]+$/.test(value))throw new Error('The push public key is invalid.');
  const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
  const bytes=Uint8Array.from(atob(padded),character=>character.charCodeAt(0));
  if(bytes.length!==65||bytes[0]!==4)throw new Error('The push public key is not a valid P-256 public key.');
  return bytes;
}
async function invoke<T>(body:Record<string,unknown>):Promise<T>{
  if(!supabase)throw new Error('Owner notification services are not connected.');
  const {data,error}=await supabase.functions.invoke('owner-push-admin',{body});
  if(error)throw new Error('The secure owner notification service is not ready.');
  return data as T;
}
/** Never infer this device's status from another device on the same account. */
export async function currentOwnerPushEndpoint():Promise<string|undefined>{
  try{
    if(typeof navigator==='undefined'||!navigator.serviceWorker?.getRegistration)return undefined;
    const registration=await navigator.serviceWorker.getRegistration('/admin/');
    const subscription=await registration?.pushManager?.getSubscription();
    return subscription?.endpoint||undefined;
  }catch{return undefined;}
}
export const readOwnerPushReadiness=async()=>invoke<OwnerPushReadiness>({action:'readiness',currentEndpoint:await currentOwnerPushEndpoint()});
export const saveOwnerPushPreferences=async(preferences:OwnerNotificationPreferences)=>invoke<OwnerPushReadiness>({action:'save_preferences',preferences,currentEndpoint:await currentOwnerPushEndpoint()});
export const storeOwnerPushSubscription=(subscription:BrowserSubscription,deviceLabel:string)=>invoke<OwnerPushReadiness>({action:'subscribe',subscription,deviceLabel});
export const revokeOwnerPushSubscription=(endpoint:string)=>invoke<OwnerPushReadiness>({action:'revoke',endpoint});
export const queueOwnerPushTestForCurrentDevice=(currentEndpoint:string)=>invoke<{queued:true}>({action:'send_test',currentEndpoint});

export function serializePushSubscription(subscription:PushSubscription):BrowserSubscription{
  const json=subscription.toJSON();
  if(!json.endpoint||!json.keys?.p256dh||!json.keys.auth)throw new Error('The browser returned an incomplete push subscription.');
  return {endpoint:json.endpoint,expirationTime:json.expirationTime??null,keys:{p256dh:json.keys.p256dh,auth:json.keys.auth}};
}
export async function enableOwnerPushFromTap(publicKey:string,readiness:OwnerPushReadiness,deviceLabel:string){
  if(!readiness.serverConfigured||!readiness.databaseReady||!readiness.featureEnabled)throw new Error(readiness.reason||'Phone notifications are not configured on the server.');
  const registration=await navigator.serviceWorker.ready;
  const permission=await Notification.requestPermission();
  if(permission!=='granted')return {permission,readiness};
  const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapidPublicKey(publicKey)});
  try{return {permission,readiness:await storeOwnerPushSubscription(serializePushSubscription(subscription),deviceLabel)}}catch(error){await subscription.unsubscribe();throw error}
}
export async function disableOwnerPushFromTap(){
  const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();
  if(!subscription)return readOwnerPushReadiness();
  const readiness=await revokeOwnerPushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
  return readiness;
}
/** Uses the subscription held by this browser now. It deliberately never lists
 * or accepts a stored device id, so a test cannot be redirected to old device. */
export async function sendOwnerPushTestFromCurrentDevice(){
  const registration=await navigator.serviceWorker.ready,subscription=await registration.pushManager.getSubscription();
  if(!subscription?.endpoint)throw new Error('This device is not subscribed to notifications.');
  return queueOwnerPushTestForCurrentDevice(subscription.endpoint);
}
