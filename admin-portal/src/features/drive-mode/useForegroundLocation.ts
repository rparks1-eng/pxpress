import { useCallback,useEffect,useRef,useState } from 'react';
import type { DriveCheckpoint,DriveSession } from './domain';
import { applyCheckpoint } from './location';

export type LocationNotice={kind:'idle'|'watching'|'paused'|'denied'|'unavailable'|'error';message:string};

export function useForegroundLocation(session:DriveSession,setSession:(update:(current:DriveSession)=>DriveSession)=>void){
 const watchId=useRef<number|null>(null),[notice,setNotice]=useState<LocationNotice>({kind:'idle',message:'GPS mileage is off.'});
 const stop=useCallback((reason='GPS mileage paused.')=>{if(watchId.current!==null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId.current);watchId.current=null;setNotice({kind:'paused',message:reason});setSession(current=>{const at=new Date().toISOString();return{...current,trackingStatus:'paused',updatedAt:at,events:[...current.events,{id:`tracking-pause:${at}`,action:'tracking_paused',at,detail:reason}]}})},[setSession]);
 const start=useCallback(()=>{
  if(!('geolocation'in navigator)){setNotice({kind:'unavailable',message:'This browser does not provide location tracking. Use manual mileage.'});setSession(current=>({...current,trackingStatus:'unavailable'}));return}
  if(watchId.current!==null)return;
  setNotice({kind:'watching',message:'Foreground GPS mileage is running while this page stays open.'});
  const consentAt=session.trackingConsentAt||new Date().toISOString();
  setSession(current=>({...current,trackingConsentAt:current.trackingConsentAt||consentAt,trackingStatus:'watching',updatedAt:new Date().toISOString(),events:current.trackingConsentAt?current.events:[...current.events,{id:`tracking-start:${consentAt}`,action:'tracking_started',at:consentAt}]}));
  watchId.current=navigator.geolocation.watchPosition(position=>{
   const point:DriveCheckpoint={latitude:position.coords.latitude,longitude:position.coords.longitude,accuracyMeters:position.coords.accuracy,observedAt:new Date(position.timestamp).toISOString()};
   setSession(current=>applyCheckpoint(current,point));
  },error=>{
   if(watchId.current!==null)navigator.geolocation.clearWatch(watchId.current);watchId.current=null;
   const denied=error.code===error.PERMISSION_DENIED;
   setNotice({kind:denied?'denied':'error',message:denied?'Location permission was denied. Use manual mileage or allow location in browser settings.':'GPS tracking stopped. Your saved checkpoints are still on this device.'});
   setSession(current=>({...current,trackingStatus:denied?'denied':'error',updatedAt:new Date().toISOString()}));
  },{enableHighAccuracy:true,maximumAge:5000,timeout:15000});
 },[session.trackingConsentAt,setSession]);
 useEffect(()=>{if(session.trackingStatus==='watching'&&watchId.current===null){setNotice({kind:'paused',message:'A saved GPS session was recovered. Resume tracking before driving.'});setSession(current=>({...current,trackingStatus:'paused'}))}},[session.id,session.trackingStatus,setSession]);
 useEffect(()=>{const foreground=()=>{if(document.hidden&&watchId.current!==null)stop('GPS paused because Drive Mode left the foreground.')};document.addEventListener('visibilitychange',foreground);return()=>document.removeEventListener('visibilitychange',foreground)},[stop]);
 useEffect(()=>()=>{if(watchId.current!==null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId.current)},[]);
 return{notice,start,stop,isWatching:notice.kind==='watching'};
}
