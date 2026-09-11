import { describe,expect,it } from 'vitest';
import { emptyNotificationStore } from './domain';
import { DeviceLocalNotificationRepository,notificationStorageKey } from './local-repository';

describe('device-local notification repository',()=>{
  it('persists local read and dismissed choices without claiming cross-device sync',()=>{
    const values=new Map<string,string>(),storage={getItem:(key:string)=>values.get(key)||null,setItem:(key:string,value:string)=>{values.set(key,value)}};
    const repository=new DeviceLocalNotificationRepository(storage),store=emptyNotificationStore();store.initialized=true;
    repository.save(store);expect(repository.load()).toEqual(store);expect(values.has(notificationStorageKey)).toBe(true);
  });
  it('fails closed to an empty store when local data is malformed',()=>{
    const repository=new DeviceLocalNotificationRepository({getItem:()=>'{bad',setItem:()=>undefined});
    expect(repository.load()).toEqual(emptyNotificationStore());
  });
});
