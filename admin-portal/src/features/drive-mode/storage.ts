import type { DriveSession } from './domain';

const prefix='pxpress:drive-session:v1:';
export const driveStorageKey=(rideRequestId:string)=>`${prefix}${rideRequestId}`;
const stages=new Set(['ready','heading_to_pickup','at_pickup','passenger_onboard','at_destination','return_passenger_onboard','at_return_stop','returning_to_base','completed_elsewhere','at_base']);
const segmentKinds=new Set(['start_to_pickup','pickup_to_destination','destination_to_return','final_to_base']);

function isDriveSession(value:unknown,rideRequestId:string):value is DriveSession{
 if(!value||typeof value!=='object')return false;
 const session=value as Partial<DriveSession>;
 if(session.schemaVersion!==1||session.rideRequestId!==rideRequestId||typeof session.id!=='string'||!stages.has(String(session.stage))||typeof session.version!=='number'||session.version<1||!Array.isArray(session.events)||!session.segments||typeof session.segments!=='object')return false;
 for(const [kind,segment] of Object.entries(session.segments)){
  if(!segmentKinds.has(kind)||!segment||typeof segment!=='object')return false;
  const record=segment as {kind?:unknown;startedAt?:unknown;gpsMiles?:unknown;acceptedPoints?:unknown};
  if(record.kind!==kind||typeof record.startedAt!=='string'||typeof record.gpsMiles!=='number'||!Number.isFinite(record.gpsMiles)||record.gpsMiles<0||record.gpsMiles>1000||!Number.isInteger(record.acceptedPoints)||Number(record.acceptedPoints)<0)return false;
 }
 return session.events.every(event=>Boolean(event)&&typeof event.id==='string'&&typeof event.action==='string'&&typeof event.at==='string');
}

export function loadDriveSession(rideRequestId:string):DriveSession|null{
 try{
  const raw=window.localStorage.getItem(driveStorageKey(rideRequestId));
  if(!raw)return null;
  const parsed=JSON.parse(raw) as unknown;
  if(!isDriveSession(parsed,rideRequestId))return null;
  return parsed;
 }catch{return null}
}

export function saveDriveSession(session:DriveSession){try{window.localStorage.setItem(driveStorageKey(session.rideRequestId),JSON.stringify(session));return true}catch{return false}}
export function clearDriveSession(rideRequestId:string){try{window.localStorage.removeItem(driveStorageKey(rideRequestId));return true}catch{return false}}
