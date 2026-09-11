export type DriveStage='ready'|'heading_to_pickup'|'at_pickup'|'passenger_onboard'|'at_destination'|'return_passenger_onboard'|'at_return_stop'|'returning_to_base'|'completed_elsewhere'|'at_base';
export type DriveSegmentKind='start_to_pickup'|'pickup_to_destination'|'destination_to_return'|'final_to_base';
export type DriveAction='start_heading'|'arrive_pickup'|'passenger_onboard'|'arrive_destination'|'start_booked_return'|'arrive_return_stop'|'return_to_base'|'continue_elsewhere'|'arrive_base';

export type DriveCheckpoint={latitude:number;longitude:number;accuracyMeters:number;observedAt:string};
export type DriveSegment={
 kind:DriveSegmentKind;
 startedAt:string;
 endedAt?:string;
 gpsMiles:number;
 acceptedPoints:number;
 manualOverride?:{miles:number;startOdometer?:number;endOdometer?:number;reason:string;recordedAt:string};
};
export type DriveEvent={id:string;action:DriveAction|'manual_mileage_override'|'tracking_started'|'tracking_paused';at:string;detail?:string};
export type DriveSession={
 schemaVersion:1;
 id:string;
 rideRequestId:string;
 stage:DriveStage;
 version:number;
 createdAt:string;
 updatedAt:string;
 trackingConsentAt?:string;
 trackingStatus:'off'|'watching'|'paused'|'denied'|'unavailable'|'error';
 lastCheckpoint?:DriveCheckpoint;
 segments:Partial<Record<DriveSegmentKind,DriveSegment>>;
 events:DriveEvent[];
};

const nextStage:Record<DriveStage,Partial<Record<DriveAction,DriveStage>>>={
 ready:{start_heading:'heading_to_pickup'},
 heading_to_pickup:{arrive_pickup:'at_pickup'},
 at_pickup:{passenger_onboard:'passenger_onboard'},
 passenger_onboard:{arrive_destination:'at_destination'},
 at_destination:{start_booked_return:'return_passenger_onboard',return_to_base:'returning_to_base',continue_elsewhere:'completed_elsewhere'},
 return_passenger_onboard:{arrive_return_stop:'at_return_stop'},
 at_return_stop:{return_to_base:'returning_to_base',continue_elsewhere:'completed_elsewhere'},
 returning_to_base:{arrive_base:'at_base'},
 completed_elsewhere:{},
 at_base:{},
};

const segmentForStage=(stage:DriveStage):DriveSegmentKind|null=>stage==='heading_to_pickup'?'start_to_pickup':stage==='passenger_onboard'?'pickup_to_destination':stage==='return_passenger_onboard'?'destination_to_return':stage==='returning_to_base'?'final_to_base':null;

export function createDriveSession(rideRequestId:string,at=new Date().toISOString(),id=`drive-${crypto.randomUUID()}`):DriveSession{
 return{schemaVersion:1,id,rideRequestId,stage:'ready',version:1,createdAt:at,updatedAt:at,trackingStatus:'off',segments:{},events:[]};
}

export function activeSegmentKind(session:DriveSession){return segmentForStage(session.stage)}
export function segmentMiles(segment?:DriveSegment){return segment?.manualOverride?.miles??segment?.gpsMiles??0}
export function segmentElapsedMinutes(segment?:DriveSegment,now=new Date().toISOString()){
 if(!segment)return 0;
 const start=Date.parse(segment.startedAt),end=Date.parse(segment.endedAt||now);
 return Number.isFinite(start)&&Number.isFinite(end)&&end>=start?Math.round((end-start)/60000):0;
}
export function totalActualMiles(session:DriveSession){return Object.values(session.segments).reduce((sum,segment)=>sum+segmentMiles(segment),0)}

export function transitionDriveSession(session:DriveSession,action:DriveAction,eventId:string,at=new Date().toISOString()):DriveSession{
 const existing=session.events.find(event=>event.id===eventId);
 if(existing){
  if(existing.action!==action)throw new Error('This drive action conflicts with an earlier saved action.');
  return session;
 }
 const target=nextStage[session.stage][action];
 if(!target)throw new Error('That drive step is not available yet.');
 const segments={...session.segments};
 const ending=segmentForStage(session.stage);
 if(ending&&segments[ending]&&!segments[ending]?.endedAt)segments[ending]={...segments[ending]!,endedAt:at};
 const starting=segmentForStage(target);
 if(starting&&!segments[starting])segments[starting]={kind:starting,startedAt:at,gpsMiles:0,acceptedPoints:0};
 return{...session,stage:target,version:session.version+1,updatedAt:at,lastCheckpoint:undefined,segments,events:[...session.events,{id:eventId,action,at}]};
}

export function recordManualMileage(session:DriveSession,kind:DriveSegmentKind,input:{miles?:number;startOdometer?:number;endOdometer?:number;reason:string},eventId:string,at=new Date().toISOString()):DriveSession{
 const segment=session.segments[kind];
 if(!segment)throw new Error('Start that drive segment before entering its mileage.');
 const reason=input.reason.trim();
 if(reason.length<3)throw new Error('Add a short reason for the manual mileage entry.');
 const odometerMiles=input.startOdometer!==undefined&&input.endOdometer!==undefined?input.endOdometer-input.startOdometer:undefined;
 const miles=input.miles??odometerMiles;
 if(odometerMiles!==undefined&&odometerMiles<0)throw new Error('Ending odometer must be greater than starting odometer.');
 if(miles===undefined||!Number.isFinite(miles)||miles<0||miles>1000)throw new Error('Enter mileage between 0 and 1,000 miles.');
 const prior=session.events.find(event=>event.id===eventId);
 if(prior){if(prior.action!=='manual_mileage_override'||prior.detail!==`${kind}:${miles.toFixed(2)}:${reason}`)throw new Error('This mileage entry conflicts with an earlier saved entry.');return session}
 const detail=`${kind}:${miles.toFixed(2)}:${reason}`;
 return{...session,version:session.version+1,updatedAt:at,segments:{...session.segments,[kind]:{...segment,manualOverride:{miles,startOdometer:input.startOdometer,endOdometer:input.endOdometer,reason,recordedAt:at}}},events:[...session.events,{id:eventId,action:'manual_mileage_override',at,detail}]};
}

export function isTerminalStage(stage:DriveStage){return stage==='completed_elsewhere'||stage==='at_base'}
export function isStaleDriveSession(session:DriveSession,now=Date.now()){return !isTerminalStage(session.stage)&&now-Date.parse(session.updatedAt)>24*60*60*1000}
