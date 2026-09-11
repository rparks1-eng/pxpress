import { emptyNotificationStore,type NotificationStore } from './domain';

export const notificationStorageKey='pxpress-owner-notifications:v2';

export interface NotificationStateRepository{
  load():NotificationStore;
  save(store:NotificationStore):void;
}

export class DeviceLocalNotificationRepository implements NotificationStateRepository{
  constructor(private readonly storage:Pick<Storage,'getItem'|'setItem'>=window.localStorage){}
  load(){
    try{
      const value=JSON.parse(this.storage.getItem(notificationStorageKey)||'null') as NotificationStore|null;
      return value?.version===2&&value.records?value:emptyNotificationStore();
    }catch{return emptyNotificationStore()}
  }
  save(store:NotificationStore){try{this.storage.setItem(notificationStorageKey,JSON.stringify(store))}catch{/* Device storage can be unavailable in private browsing. */}}
}
