import type { DriveCheckpoint,DriveSession } from './domain';
import { activeSegmentKind } from './domain';

export const MAX_LOCATION_ACCURACY_METERS=100;
export const MIN_POINT_DISTANCE_METERS=5;
export const MAX_REASONABLE_SPEED_MPH=110;

const earthRadiusMeters=6371008.8;
export function distanceMeters(a:Pick<DriveCheckpoint,'latitude'|'longitude'>,b:Pick<DriveCheckpoint,'latitude'|'longitude'>){
 const radians=(value:number)=>value*Math.PI/180,dLat=radians(b.latitude-a.latitude),dLon=radians(b.longitude-a.longitude),lat1=radians(a.latitude),lat2=radians(b.latitude);
 const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
 return 2*earthRadiusMeters*Math.asin(Math.sqrt(h));
}

export type PointDecision={accepted:boolean;reason?:'inaccurate'|'duplicate'|'out_of_order'|'outlier';distanceMiles:number};
export function evaluateCheckpoint(previous:DriveCheckpoint|undefined,next:DriveCheckpoint):PointDecision{
 if(!Number.isFinite(next.latitude)||!Number.isFinite(next.longitude)||next.accuracyMeters>MAX_LOCATION_ACCURACY_METERS||next.accuracyMeters<0)return{accepted:false,reason:'inaccurate',distanceMiles:0};
 if(!previous)return{accepted:true,distanceMiles:0};
 const elapsedMs=Date.parse(next.observedAt)-Date.parse(previous.observedAt);
 if(!Number.isFinite(elapsedMs)||elapsedMs<=0)return{accepted:false,reason:'out_of_order',distanceMiles:0};
 const meters=distanceMeters(previous,next);
 if(meters<MIN_POINT_DISTANCE_METERS)return{accepted:false,reason:'duplicate',distanceMiles:0};
 const miles=meters/1609.344,hours=elapsedMs/3_600_000;
 if(miles/hours>MAX_REASONABLE_SPEED_MPH)return{accepted:false,reason:'outlier',distanceMiles:0};
 return{accepted:true,distanceMiles:miles};
}

export function applyCheckpoint(session:DriveSession,next:DriveCheckpoint):DriveSession{
 const decision=evaluateCheckpoint(session.lastCheckpoint,next);
 if(!decision.accepted)return session;
 const kind=activeSegmentKind(session),segments={...session.segments};
 if(kind&&segments[kind])segments[kind]={...segments[kind]!,gpsMiles:segments[kind]!.gpsMiles+decision.distanceMiles,acceptedPoints:segments[kind]!.acceptedPoints+1};
 return{...session,updatedAt:next.observedAt,lastCheckpoint:next,segments};
}

