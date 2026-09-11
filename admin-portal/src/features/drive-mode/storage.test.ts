import { beforeEach,describe,expect,it } from 'vitest';
import { createDriveSession,transitionDriveSession } from './domain';
import { clearDriveSession,driveStorageKey,loadDriveSession,saveDriveSession } from './storage';

function installStorage(){const values=new Map<string,string>();Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>void values.set(key,value),removeItem:(key:string)=>void values.delete(key),clear:()=>values.clear(),key:(index:number)=>[...values.keys()][index]??null,get length(){return values.size}} satisfies Storage})}

describe('Drive Mode device recovery',()=>{
 beforeEach(()=>installStorage());
 it('restores a versioned active session after refresh and clears only the selected ride',()=>{
  const session=transitionDriveSession(createDriveSession('ride-a','2026-09-02T12:00:00.000Z','session-a'),'start_heading','e1','2026-09-02T12:01:00.000Z');
  expect(saveDriveSession(session)).toBe(true);
  expect(loadDriveSession('ride-a')).toMatchObject({stage:'heading_to_pickup',version:2});
  window.localStorage.setItem(driveStorageKey('ride-b'),JSON.stringify(createDriveSession('ride-b')));
  clearDriveSession('ride-a');
  expect(loadDriveSession('ride-a')).toBeNull();
  expect(loadDriveSession('ride-b')).not.toBeNull();
 });
 it('fails closed for malformed or cross-ride data',()=>{
  window.localStorage.setItem(driveStorageKey('ride-a'),'{bad json');
  expect(loadDriveSession('ride-a')).toBeNull();
  window.localStorage.setItem(driveStorageKey('ride-a'),JSON.stringify(createDriveSession('other')));
  expect(loadDriveSession('ride-a')).toBeNull();
 });
 it('rejects a tampered stage and malformed segment instead of crashing the page',()=>{
  const session=createDriveSession('ride-a');
  window.localStorage.setItem(driveStorageKey('ride-a'),JSON.stringify({...session,stage:'teleported'}));
  expect(loadDriveSession('ride-a')).toBeNull();
  window.localStorage.setItem(driveStorageKey('ride-a'),JSON.stringify({...session,segments:{start_to_pickup:{kind:'wrong',startedAt:'now',gpsMiles:-1,acceptedPoints:0}}}));
  expect(loadDriveSession('ride-a')).toBeNull();
 });
});
