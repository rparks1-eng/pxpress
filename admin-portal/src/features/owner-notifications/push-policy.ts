export type OwnerPushCategory='new_request'|'payment'|'ride_change'|'upcoming'|'tax_review'|'system_error';
export type OwnerChannelPolicy={inApp:boolean;push:boolean;email:boolean};
export type OwnerNotificationPreferences={categories:Record<OwnerPushCategory,boolean>;quietHours:{enabled:boolean;start:string;end:string};channels:{inApp:true;push:boolean;emailCritical:true}};
export const defaultOwnerNotificationPreferences:OwnerNotificationPreferences={categories:{new_request:true,payment:true,ride_change:true,upcoming:true,tax_review:true,system_error:true},quietHours:{enabled:false,start:'22:00',end:'07:00'},channels:{inApp:true,push:true,emailCritical:true}};
export const channelPolicy=(category:OwnerPushCategory):OwnerChannelPolicy=>({inApp:true,push:true,email:category==='payment'||category==='system_error'});
export type PushCapability={supported:boolean;installed:boolean;permission:NotificationPermission|'unsupported';reason?:string};
export function derivePushCapability(input:{notification:boolean;serviceWorker:boolean;pushManager:boolean;ios:boolean;standalone:boolean;permission:NotificationPermission}):PushCapability{
  if(!input.notification||!input.serviceWorker||!input.pushManager)return {supported:false,installed:false,permission:'unsupported',reason:'This browser does not support web push.'};
  if(input.ios&&!input.standalone)return {supported:true,installed:false,permission:input.permission,reason:'On iPhone or iPad, add the Owner Desk to the Home Screen before enabling notifications.'};
  return {supported:true,installed:input.ios?input.standalone:true,permission:input.permission};
}
export function getPushCapability(scope:Window=window):PushCapability{const standalone=scope.matchMedia?.('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true,ios=/iPad|iPhone|iPod/.test(navigator.userAgent);return derivePushCapability({notification:'Notification'in scope,serviceWorker:'serviceWorker'in navigator,pushManager:'PushManager'in scope,ios,standalone,permission:'Notification'in scope?Notification.permission:'default'})}
export const pushFeatureConfigured=()=>import.meta.env.VITE_PXPRESS_WEB_PUSH_ENABLED==='true'&&Boolean(import.meta.env.VITE_PXPRESS_WEB_PUSH_PUBLIC_KEY);
