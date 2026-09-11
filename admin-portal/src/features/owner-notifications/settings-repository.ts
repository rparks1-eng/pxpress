import { defaultOwnerNotificationPreferences,type OwnerNotificationPreferences } from './push-policy';
const key='pxpress-owner-notification-preferences:v2';
export function loadNotificationPreferences():OwnerNotificationPreferences{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value?.categories&&value?.quietHours?{...defaultOwnerNotificationPreferences,...value,channels:{...defaultOwnerNotificationPreferences.channels,...value.channels}}:defaultOwnerNotificationPreferences}catch{return defaultOwnerNotificationPreferences}}
export function saveNotificationPreferences(value:OwnerNotificationPreferences){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
