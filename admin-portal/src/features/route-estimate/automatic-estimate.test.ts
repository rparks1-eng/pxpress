import {beforeEach, expect, it, vi} from 'vitest';
import {demoRequests} from '../../demo-data';
import {buildManualRouteEstimate} from './ManualMileageEditor';
import {writeRouteEstimateSession} from './session-cache';
import {calculateRouteEstimate} from '../../lib/repository';
import {automaticRouteEstimate} from './automatic-estimate';
vi.mock('../../lib/repository',()=>({calculateRouteEstimate:vi.fn()}));
beforeEach(()=>{sessionStorage.clear();vi.mocked(calculateRouteEstimate).mockReset()});
it('combines concurrent requests and reuses the result without another lookup',async()=>{
 const request={...demoRequests[0],id:'singleflight-test',tripType:'One way'};
 const estimate=buildManualRouteEstimate(request,[10,20,30],[15,30,45]);
 vi.mocked(calculateRouteEstimate).mockResolvedValue(estimate);
 const a=automaticRouteEstimate(request),b=automaticRouteEstimate(request);
 expect(a).toBe(b);await Promise.all([a,b]);await automaticRouteEstimate(request);
 expect(calculateRouteEstimate).toHaveBeenCalledTimes(1);
});
it('uses an existing matching cache without a provider call',async()=>{
 const request={...demoRequests[0],id:'cached-test',tripType:'One way'};
 const estimate=buildManualRouteEstimate(request,[10,20,30],[15,30,45]);
 writeRouteEstimateSession(request,estimate);
 expect(await automaticRouteEstimate(request)).toEqual(estimate);
 expect(calculateRouteEstimate).not.toHaveBeenCalled();
});
it('does not repeatedly call a failing provider during navigation',async()=>{
 const request={...demoRequests[0],id:'failed-test',tripType:'One way'};
 vi.mocked(calculateRouteEstimate).mockRejectedValue(new Error('Provider unavailable'));
 await expect(automaticRouteEstimate(request)).rejects.toThrow('Provider unavailable');
 await expect(automaticRouteEstimate(request)).rejects.toThrow('Provider unavailable');
 expect(calculateRouteEstimate).toHaveBeenCalledTimes(1);
});
it('rejects incomplete addresses before any provider call',async()=>{
 await expect(automaticRouteEstimate({...demoRequests[0],pickupAddress:''})).rejects.toThrow();
 expect(calculateRouteEstimate).not.toHaveBeenCalled();
});
