import { describe,expect,it,vi } from 'vitest';
import { currentOwnerPushEndpoint,decodeVapidPublicKey,enableOwnerPushFromTap,sendOwnerPushTestFromCurrentDevice } from './push-repository';
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
describe('owner push subscription client',()=>{
 it('reads only the current installed owner registration for readiness',async()=>{
   const getRegistration=vi.fn().mockResolvedValue({pushManager:{getSubscription:vi.fn().mockResolvedValue({endpoint:'https://web.push.apple.com/current-device'})}});
   Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{getRegistration}}});
   expect(await currentOwnerPushEndpoint()).toBe('https://web.push.apple.com/current-device');
   expect(getRegistration).toHaveBeenCalledWith('/admin/');
 });
 it('reports no local device when registration is absent or unreadable',async()=>{
   const getRegistration=vi.fn().mockResolvedValue(undefined);
   Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{getRegistration}}});
   expect(await currentOwnerPushEndpoint()).toBeUndefined();
   getRegistration.mockRejectedValueOnce(new Error('unavailable'));
   expect(await currentOwnerPushEndpoint()).toBeUndefined();
 });
 it('accepts only a 65-byte uncompressed P-256 public key',()=>{const bytes=new Uint8Array(65);bytes[0]=4;expect(decodeVapidPublicKey(encode(bytes))).toHaveLength(65);expect(()=>decodeVapidPublicKey('bad')).toThrow(/(?:invalid|not a valid)/)});
 it('does not prompt unless authoritative readiness is true',async()=>{const prompt=vi.fn();Object.defineProperty(globalThis,'Notification',{configurable:true,value:{requestPermission:prompt}});await expect(enableOwnerPushFromTap('bad',{serverConfigured:false,databaseReady:false,featureEnabled:false,dispatchEnabled:false,subscriptionActive:false},'device')).rejects.toThrow(/not configured/);expect(prompt).not.toHaveBeenCalled()});
 it('test action reads only the active browser subscription',async()=>{Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{ready:Promise.resolve({pushManager:{getSubscription:vi.fn().mockResolvedValue(null)}})}}});await expect(sendOwnerPushTestFromCurrentDevice()).rejects.toThrow(/not subscribed/)});
});
