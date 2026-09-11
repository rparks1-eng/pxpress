import {supabase} from '../../lib/supabase';
export type PublicFinderEvidence={
 rateBasisPoints:number;
 jurisdiction:string;
 matchedAddress:string;
 applicableDate:string;
 observedAt:string;
 sourceUrl:string;
};
export type PublicFinderState={connected:boolean;dispatchEnabled:boolean;consumerEnabled:boolean;paymentDeliveryAllowed:false;policies:Array<{id:string;dateBasis:string;sourcingSource:string}>;job:null|{id:string;requestRevision:number;status:string;lastError?:string;pricingReady:boolean;evidence?:PublicFinderEvidence;};draft?:null|{id:string;serviceSubtotalMinor:number;taxMinor:number;totalMinor:number;current:boolean}};
const unavailable:PublicFinderState={connected:false,dispatchEnabled:false,consumerEnabled:false,paymentDeliveryAllowed:false,policies:[],job:null};
export async function readPublicFinderState(requestId:string):Promise<PublicFinderState>{
 if(!supabase)return unavailable;
 const {data,error}=await supabase.rpc('owner_read_finder_public_state',{p_ride_request_id:requestId});
 if(error){if(['PGRST202','42883'].includes(error.code))return unavailable;throw Error('Public Finder review could not be read.');}
 if(!data||data.paymentDeliveryAllowed!==false||!Array.isArray(data.policies)||typeof data.connected!=='boolean')throw Error('Public Finder readback is invalid.');
 const evidence=data.job?.evidence;
 if(evidence&&(!Number.isInteger(evidence.rateBasisPoints)||evidence.rateBasisPoints<1||evidence.rateBasisPoints>3000||
  typeof evidence.jurisdiction!=='string'||!evidence.jurisdiction.trim()||typeof evidence.matchedAddress!=='string'||!evidence.matchedAddress.trim()||
  !/^\d{4}-\d{2}-\d{2}$/.test(evidence.applicableDate)||!Number.isFinite(Date.parse(evidence.observedAt))||
  typeof evidence.sourceUrl!=='string'||!/^https:\/\/thefinder\.tax\.ohio\.gov\//.test(evidence.sourceUrl)))throw Error('Public Finder evidence readback is invalid.');
 return data;
}
export async function preparePublicFinderContext(jobId:string,review:Record<string,unknown>){
 if(!supabase)throw Error('Public Finder is not connected.');
 const {data,error}=await supabase.rpc('owner_prepare_finder_public_context',{p_job_id:jobId,p_review:review});
 if(error||data?.id!==jobId||data?.status!=='pending')throw Error('The current itinerary and approved tax policy could not be saved.');
}
export async function savePublicFinderPrice(jobId:string,subtotalMinor:number){
 if(!supabase)throw Error('Public Finder is not connected.');
 const {data,error}=await supabase.rpc('owner_save_finder_public_price',{p_job_id:jobId,p_recommended_subtotal_minor:subtotalMinor});
 if(error||data?.jobId!==jobId||data?.paymentDeliveryAllowed!==false||data?.status!=='owner_price_draft'||
 ![data.serviceSubtotalMinor,data.taxMinor,data.totalMinor].every(Number.isSafeInteger)||data.serviceSubtotalMinor+data.taxMinor!==data.totalMinor)throw Error('The reviewed price draft was not confirmed by saved readback.');
 return data;
}
