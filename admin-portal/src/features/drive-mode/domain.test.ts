import { describe,expect,it } from 'vitest';
import { createDriveSession,recordManualMileage,segmentElapsedMinutes,totalActualMiles,transitionDriveSession } from './domain';

const at=(minute:number)=>`2026-09-02T12:${String(minute).padStart(2,'0')}:00.000Z`;

describe('Drive Mode state machine',()=>{
 it('records the no-return path without inventing a base segment',()=>{
  let session=createDriveSession('ride-1',at(0),'session-1');
  session=transitionDriveSession(session,'start_heading','e1',at(1));
  session=transitionDriveSession(session,'arrive_pickup','e2',at(11));
  session=transitionDriveSession(session,'passenger_onboard','e3',at(15));
  session=transitionDriveSession(session,'arrive_destination','e4',at(35));
  session=transitionDriveSession(session,'continue_elsewhere','e5',at(36));
  expect(session.stage).toBe('completed_elsewhere');
  expect(session.segments.start_to_pickup?.endedAt).toBe(at(11));
  expect(session.segments.pickup_to_destination?.endedAt).toBe(at(35));
  expect(session.segments.final_to_base).toBeUndefined();
  expect(segmentElapsedMinutes(session.segments.pickup_to_destination,at(40))).toBe(20);
 });

 it('creates the optional final-to-base segment only after an explicit return choice',()=>{
  let session=createDriveSession('ride-2',at(0),'session-2');
  for(const [action,id,minute] of [['start_heading','e1',1],['arrive_pickup','e2',5],['passenger_onboard','e3',6],['arrive_destination','e4',20],['return_to_base','e5',21],['arrive_base','e6',31]] as const)session=transitionDriveSession(session,action,id,at(minute));
  expect(session.stage).toBe('at_base');
  expect(session.segments.final_to_base).toMatchObject({startedAt:at(21),endedAt:at(31)});
 });

 it('finishes a booked round trip at its return stop before any optional base return',()=>{
  let session=createDriveSession('ride-return','2026-09-02T12:00:00.000Z','session-return');
  const actions=[['start_heading','e1',1],['arrive_pickup','e2',5],['passenger_onboard','e3',6],['arrive_destination','e4',20],['start_booked_return','e5',30],['arrive_return_stop','e6',50]] as const;
  for(const [action,id,minute] of actions)session=transitionDriveSession(session,action,id,at(minute));
  expect(session.stage).toBe('at_return_stop');
  expect(session.segments.destination_to_return).toMatchObject({startedAt:at(30),endedAt:at(50)});
  expect(session.segments.final_to_base).toBeUndefined();
  session=transitionDriveSession(session,'continue_elsewhere','e7',at(51));
  expect(session.stage).toBe('completed_elsewhere');
 });

 it('rejects impossible transitions and conflicting replay identities',()=>{
  const session=createDriveSession('ride-3',at(0),'session-3');
  expect(()=>transitionDriveSession(session,'arrive_pickup','e1',at(1))).toThrow('not available');
  const heading=transitionDriveSession(session,'start_heading','stable-event',at(1));
  expect(transitionDriveSession(heading,'start_heading','stable-event',at(2))).toBe(heading);
  expect(()=>transitionDriveSession(heading,'arrive_pickup','stable-event',at(2))).toThrow('conflicts');
 });

 it('records a validated manual odometer override and keeps it in the audit trail',()=>{
  const heading=transitionDriveSession(createDriveSession('ride-4',at(0),'session-4'),'start_heading','e1',at(1));
  const corrected=recordManualMileage(heading,'start_to_pickup',{startOdometer:100,endOdometer:112.4,reason:'GPS paused'},'override-1',at(12));
  expect(corrected.segments.start_to_pickup?.manualOverride?.miles).toBeCloseTo(12.4);
  expect(totalActualMiles(corrected)).toBeCloseTo(12.4);
  expect(corrected.events.at(-1)).toMatchObject({action:'manual_mileage_override',detail:'start_to_pickup:12.40:GPS paused'});
  expect(recordManualMileage(corrected,'start_to_pickup',{startOdometer:100,endOdometer:112.4,reason:'GPS paused'},'override-1',at(13))).toBe(corrected);
  expect(()=>recordManualMileage(heading,'start_to_pickup',{startOdometer:110,endOdometer:100,reason:'Bad reading'},'override-2',at(12))).toThrow('greater');
 });
});
