import type {RideRequest,RouteEstimate} from '../../types';
import {calculateRouteEstimate} from '../../lib/repository';
import {routePlanForRequest} from './ManualMileageEditor';
import {readRouteEstimateSession,writeRouteEstimateSession} from './session-cache';
const pending=new Map<string,Promise<RouteEstimate>>();
const failures=new Map<string,{until:number;error:Error}>();
/** One calculation per route at a time; no polling, retries, or bulk fan-out. */
export function automaticRouteEstimate(request:RideRequest):Promise<RouteEstimate>{
 const plan=routePlanForRequest(request);
 if(plan.error)return Promise.reject(new Error(plan.error));
 const cached=readRouteEstimateSession(request);if(cached)return Promise.resolve(cached);
 const key=request.id+':'+JSON.stringify(plan.stops);
 const inflight=pending.get(key);if(inflight)return inflight;
 const failure=failures.get(key);if(failure&&failure.until>Date.now())return Promise.reject(failure.error);
 const task=calculateRouteEstimate(request.id,JSON.stringify(plan.stops)).then(value=>{writeRouteEstimateSession(request,value);failures.delete(key);return value}).catch(error=>{
  while(failures.size>=100){const first=failures.keys().next().value;if(first)failures.delete(first);else break}
  const safe=error instanceof Error?error:new Error('Mileage is unavailable.');failures.set(key,{until:Date.now()+10*60_000,error:safe});throw safe;
 }).finally(()=>pending.delete(key));
 pending.set(key,task);return task;
}
