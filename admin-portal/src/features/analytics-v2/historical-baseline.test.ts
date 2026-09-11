import {describe,expect,it} from 'vitest';
import {parseHistoricalBaselineJson,validateHistoricalBaseline} from './historical-baseline';

describe('historical baseline review',()=>{
  it('accepts reviewable evidence without inserting anything',()=>{const value=parseHistoricalBaselineJson(JSON.stringify({cutoffDate:'2026-09-01',completedRides:1600,starCounts:{1:0,2:0,3:1,4:0,5:499},provenance:'Owner platform export reviewed 2026-09-04'}));expect(validateHistoricalBaseline(value)).toBeUndefined();expect(value.starCounts[5]).toBe(499)});
  it('rejects impossible or unproven historical totals',()=>{expect(()=>parseHistoricalBaselineJson(JSON.stringify({cutoffDate:'2026-09-01',completedRides:10,starCounts:{1:0,2:0,3:1,4:0,5:499},provenance:'unknown'}))).toThrow(/cannot be lower/);expect(validateHistoricalBaseline({cutoffDate:'',completedRides:0,starCounts:{1:0,2:0,3:0,4:0,5:0},provenance:''})).toMatch(/cutoff/)});
});
