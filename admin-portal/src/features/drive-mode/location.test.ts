import { describe,expect,it } from 'vitest';
import { createDriveSession,transitionDriveSession } from './domain';
import { applyCheckpoint,evaluateCheckpoint } from './location';

const point=(latitude:number,longitude:number,observedAt:string,accuracyMeters=8)=>({latitude,longitude,observedAt,accuracyMeters});

describe('foreground actual-mileage safeguards',()=>{
 it('rejects inaccurate, duplicate, out-of-order, and implausible points',()=>{
  const previous=point(41.2,-81.5,'2026-09-02T12:00:00.000Z');
  expect(evaluateCheckpoint(undefined,{...previous,accuracyMeters:150}).reason).toBe('inaccurate');
  expect(evaluateCheckpoint(previous,point(41.200001,-81.500001,'2026-09-02T12:00:10.000Z')).reason).toBe('duplicate');
  expect(evaluateCheckpoint(previous,point(41.21,-81.5,'2026-09-02T11:59:00.000Z')).reason).toBe('out_of_order');
  expect(evaluateCheckpoint(previous,point(42.2,-81.5,'2026-09-02T12:00:01.000Z')).reason).toBe('outlier');
 });

 it('adds accepted foreground points only to the active actual segment',()=>{
  let session=transitionDriveSession(createDriveSession('ride-1','2026-09-02T12:00:00.000Z','session-1'),'start_heading','e1','2026-09-02T12:00:01.000Z');
  session=applyCheckpoint(session,point(41.2,-81.5,'2026-09-02T12:00:02.000Z'));
  session=applyCheckpoint(session,point(41.201,-81.5,'2026-09-02T12:01:02.000Z'));
  expect(session.segments.start_to_pickup?.acceptedPoints).toBe(2);
  expect(session.segments.start_to_pickup?.gpsMiles).toBeGreaterThan(.05);
  expect(JSON.stringify(session)).not.toMatch(/Google|estimated/i);
 });
});

