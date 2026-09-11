export type HistoricalBaselineDraft={
  cutoffDate:string;
  completedRides:number;
  starCounts:Record<1|2|3|4|5,number>;
  provenance:string;
};

const whole=(value:unknown)=>Number.isSafeInteger(value)&&Number(value)>=0;

export function validateHistoricalBaseline(value:HistoricalBaselineDraft):string|undefined{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value.cutoffDate)||!Number.isFinite(Date.parse(`${value.cutoffDate}T12:00:00Z`)))return 'Enter a valid historical cutoff date.';
  if(!whole(value.completedRides)||!([1,2,3,4,5] as const).every(star=>whole(value.starCounts[star])))return 'Ride and rating counts must be whole numbers at or above zero.';
  if(value.completedRides<Object.values(value.starCounts).reduce((total,count)=>total+count,0))return 'Completed rides cannot be lower than the total historical ratings.';
  if(value.provenance.trim().length<8)return 'Describe where the historical totals came from.';
}

export function parseHistoricalBaselineJson(raw:string):HistoricalBaselineDraft{
  const value=JSON.parse(raw) as Record<string,unknown>;
  const stars=value.starCounts as Record<string,unknown>|undefined;
  const draft:HistoricalBaselineDraft={cutoffDate:String(value.cutoffDate||''),completedRides:Number(value.completedRides),
    starCounts:{1:Number(stars?.['1']),2:Number(stars?.['2']),3:Number(stars?.['3']),4:Number(stars?.['4']),5:Number(stars?.['5'])},provenance:String(value.provenance||'')};
  const error=validateHistoricalBaseline(draft);if(error)throw new Error(error);return draft;
}
