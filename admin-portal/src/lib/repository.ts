import { demoEvents, demoRequests } from '../demo-data';
import {decodeReleaseResponse,failedRelease,presentationProducerConfigured,releaseTarget,unavailableRelease,type QuoteReleaseResult} from './quote-release-result';
import type { ApprovedTaxProjection, OwnerPriceDecision } from '../features/fare-recommendation/domain';
import type { FinderReviewEvidence } from '../features/fare-recommendation/FareRecommendationPanel';
import type { FinderUsageStatus, PricingAssumptionStatus, RideTaxRecordView, TaxAdjustmentViewEntry, TaxLedgerViewEntry, TransportationSourcingStatus } from '../features/tax-center/types';
import type { AnalyticsSnapshot, AuditEvent, FollowUpPresentation, GoogleCalendarConnection, LifecycleEffect, ManualQuoteDraft, RequestStatus, RideRequest, RideTaxProjection, RouteEstimate, WixReconciliationAction, WixReconciliationIdentity } from '../types';
import { analyticsViews, supabase, tableNames, wixReconciliationEnabled } from './supabase';
import { RouteEstimateError, toRouteEstimateError } from './edge-function-errors';
import { normalizeVerifiedPlace } from '../features/places/place-metadata';

type RelatedCustomer={id?:string;full_name:string;email:string;phone:string;metadata?:{contactDeleted?:boolean}|null};
type RelatedQuote={status:string;total:number;created_at:string};
type RelatedPayment={status:RideRequest['paymentStatus'];created_at:string};
type RelatedNote={note:string;created_at:string;author_id?:string};
type RelatedEffect={id:string;effect_type:LifecycleEffect['effectType'];state:LifecycleEffect['state'];enabled_snapshot:boolean;attempt_count:number;max_attempts:number;not_before?:string;lease_expires_at?:string;delivered_at?:string;last_safe_error_code?:string;updated_at:string};
type RelatedTaxProjection={id:string;quote_id:string;finder_audit_id:string;state:RideTaxProjection['status'];currency:'USD';service_subtotal_minor:number;tax_minor:number;customer_total_minor:number;recommended_pre_tax_service_minor:number;unrounded_tax_minor:number;unrounded_customer_total_minor:number;rounding_adjustment_minor:number;rate_basis_points:number;jurisdiction:Record<string,string>;rate_source:string;rate_source_reference:string;effective_date:string;lookup_status:'provider_lookup'|'cache_hit';observed_at:string;expires_at:string;human_confirmation_status:'confirmed';transportation_sourcing_policy_confirmed:true;wix_tax_group_id:string;filing_ready:boolean;payment_status:'unpaid'|'authorized'|'paid'|'refunded'|'void'};
type DbRequest=Record<string,unknown>&{metadata?:Record<string,unknown>|null;customers?:RelatedCustomer|RelatedCustomer[];quotes?:RelatedQuote[];payments?:RelatedPayment[];ride_request_internal_notes?:RelatedNote[];lifecycle_effects?:RelatedEffect[];ride_tax_quote_projections?:RelatedTaxProjection[]};
type ManualDraftReadback={ride_request_id:unknown;quote_id?:unknown;status:unknown;input_semantics?:unknown;entered_final_customer_total_minor?:unknown;entered_base_fare_minor:unknown;rate_basis_points:unknown;service_subtotal_minor:unknown;tax_minor:unknown;customer_total_minor:unknown;saved_at:unknown;is_current:unknown;payment_link_ready?:unknown};
const latest=<T extends {created_at:string}>(rows:T[]|undefined)=>[...(rows||[])].sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
const REQUEST_SELECT_CORE='*,customers!inner(id,full_name,email,phone,metadata),quotes(status,total,created_at),payments(status,created_at),ride_request_internal_notes(note,created_at,author_id),lifecycle_effects(id,effect_type,state,enabled_snapshot,attempt_count,max_attempts,not_before,lease_expires_at,delivered_at,last_safe_error_code,updated_at)';
const REQUEST_SELECT_TAX='ride_tax_quote_projections(id,quote_id,finder_audit_id,state,currency,service_subtotal_minor,tax_minor,customer_total_minor,recommended_pre_tax_service_minor,unrounded_tax_minor,unrounded_customer_total_minor,rounding_adjustment_minor,rate_basis_points,wix_tax_group_id,jurisdiction,rate_source,rate_source_reference,effective_date,lookup_status,observed_at,expires_at,human_confirmation_status,transportation_sourcing_policy_confirmed,filing_ready,payment_status)';
export const isOptionalTaxProjectionSchemaMiss=(error:unknown):boolean=>{
  if(!error||typeof error!=='object')return false;
  const row=error as {code?:unknown;message?:unknown;details?:unknown;hint?:unknown};
  const evidence=[row.message,row.details,row.hint].filter((value):value is string=>typeof value==='string').join(' ');
  return row.code==='PGRST200'&&evidence.includes('ride_requests')&&evidence.includes('ride_tax_quote_projections');
};
const CANONICAL_WIX_PROVIDER_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_RECONCILIATION_KEY=/(?:card|cvv|cvc|pan|checkout|token)/i;
const UNSAFE_RECONCILIATION_TEXT=/(?:https?:\/\/|[\s\u0000-\u001f]|@|(?:card|cvv|cvc|pan|checkout|token)|\d{13,19})/i;
export const isCanonicalWixProviderId=(value:unknown):value is string=>typeof value==='string'&&CANONICAL_WIX_PROVIDER_ID.test(value)&&!UNSAFE_RECONCILIATION_TEXT.test(value);
export const hasUnsafeWixReconciliationContent=(value:unknown,seen=new Set<object>()):boolean=>{
  if(typeof value==='string')return /https?:\/\//i.test(value)||/(?:card|cvv|cvc|pan)/i.test(value)||/\d{13,19}/.test(value.replace(/[\s-]/g,''));
  if(!value||typeof value!=='object'||seen.has(value as object))return false;seen.add(value as object);
  if(Array.isArray(value))return value.some(item=>hasUnsafeWixReconciliationContent(item,seen));
  return Object.entries(value as Record<string,unknown>).some(([key,item])=>UNSAFE_RECONCILIATION_KEY.test(key)||hasUnsafeWixReconciliationContent(item,seen));
};
const APPROVED_TAX_KEYS=new Set(['schemaVersion','finderAuditId','serviceSubtotalMinor','salesTaxMinor','customerTotalMinor','recommendedPreTaxServiceMinor','unroundedTaxMinor','unroundedCustomerTotalMinor','roundingAdjustmentMinor','rateBasisPoints','jurisdiction','jurisdictionLabel','source','sourceReference','effectiveDate','lookupStatus','observedAt','expiresAt','taxGroupId','providerTaxMode']);
const JURISDICTION_KEYS=new Set(['countryCode','subdivisionCode','county','locality']);
export function assertSafeApprovedTaxProjection(value:unknown):asserts value is ApprovedTaxProjection{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!APPROVED_TAX_KEYS.has(key))||hasUnsafeWixReconciliationContent(value))throw new Error('The verified tax projection contains unsupported or unsafe fields.');
  const projection=value as Record<string,unknown>,jurisdiction=projection.jurisdiction;
  const numbers=['serviceSubtotalMinor','salesTaxMinor','customerTotalMinor','recommendedPreTaxServiceMinor','unroundedTaxMinor','unroundedCustomerTotalMinor','roundingAdjustmentMinor','rateBasisPoints'];
  if(!jurisdiction||typeof jurisdiction!=='object'||Array.isArray(jurisdiction)||Object.keys(jurisdiction).some(key=>!JURISDICTION_KEYS.has(key))||numbers.some(key=>!Number.isSafeInteger(projection[key]))||projection.schemaVersion!=='pxpress-approved-tax-projection-v1'||projection.providerTaxMode!=='wix-calculates-once-from-tax-exclusive-subtotal'||projection.source!=='Ohio Department of Taxation Finder')throw new Error('The verified tax projection contains unsupported or unsafe fields.');
}

const whole=(value:unknown):number|undefined=>typeof value==='number'&&Number.isSafeInteger(value)?value:typeof value==='string'&&/^-?\d+$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):undefined;
export const toManualQuoteDraft=(value:ManualDraftReadback):ManualQuoteDraft|undefined=>{
  const base=whole(value.entered_base_fare_minor),finalTotal=whole(value.entered_final_customer_total_minor),rate=whole(value.rate_basis_points),subtotal=whole(value.service_subtotal_minor),tax=whole(value.tax_minor),total=whole(value.customer_total_minor);
  const inputSemantics=value.input_semantics==='final_customer_total_tax_included'?'final_customer_total_tax_included':'legacy_base_fare_plus_tax';
  if(typeof value.ride_request_id!=='string'||!['draft','approved'].includes(String(value.status))||typeof value.is_current!=='boolean'||rate===undefined||rate<0||rate>3000||subtotal===undefined||subtotal<=0||tax===undefined||tax<0||total===undefined||total<=0||total%500!==0||subtotal+tax!==total||typeof value.saved_at!=='string'||!Number.isFinite(Date.parse(value.saved_at))||(inputSemantics==='final_customer_total_tax_included'&&(finalTotal===undefined||finalTotal<=0))||(inputSemantics==='legacy_base_fare_plus_tax'&&(base===undefined||base<=0)))return undefined;
  return {status:value.status as 'draft'|'approved',inputSemantics,...(typeof value.quote_id==='string'?{quoteId:value.quote_id}:{}),...(typeof value.payment_link_ready==='boolean'?{paymentLinkReady:value.payment_link_ready}:{}),...(inputSemantics==='final_customer_total_tax_included'?{enteredCustomerTotalMinor:finalTotal}:{enteredBaseFareMinor:base}),rateBasisPoints:rate,serviceSubtotalMinor:subtotal,salesTaxMinor:tax,customerTotalMinor:total,savedAt:value.saved_at,isCurrent:value.is_current};
};
const quotedAmount=(value:unknown):number|undefined=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:typeof value==='string'&&Number.isFinite(Number(value))&&Number(value)>0?Number(value):undefined;
const sameFinalManualDraft=(draft:ManualQuoteDraft|undefined,input:{enteredCustomerTotalMinor:number;rateBasisPoints:number;serviceSubtotalMinor:number;salesTaxMinor:number;customerTotalMinor:number}):boolean=>Boolean(
  draft&&draft.status==='draft'&&draft.isCurrent&&draft.inputSemantics==='final_customer_total_tax_included'&&
  draft.enteredCustomerTotalMinor===input.enteredCustomerTotalMinor&&
  draft.rateBasisPoints===input.rateBasisPoints&&
  draft.serviceSubtotalMinor===input.serviceSubtotalMinor&&
  draft.salesTaxMinor===input.salesTaxMinor&&
  draft.customerTotalMinor===input.customerTotalMinor,
);
async function readMatchingSavedManualDraft(rideRequestId:string,input:{enteredCustomerTotalMinor:number;rateBasisPoints:number;serviceSubtotalMinor:number;salesTaxMinor:number;customerTotalMinor:number}):Promise<boolean>{
  if(!supabase)return false;
  const {data,error}=await supabase.rpc('admin_read_manual_owner_tax_quote_drafts',{p_ride_request_ids:[rideRequestId]});
  if(error||!Array.isArray(data))return false;
  return data.some(value=>{
    const row=value as ManualDraftReadback;
    return row.ride_request_id===rideRequestId&&sameFinalManualDraft(toManualQuoteDraft(row),input);
  });
}
export const toRequest=(row:DbRequest,manualQuoteDraft?:ManualQuoteDraft):RideRequest=>{
  const customer=Array.isArray(row.customers)?row.customers[0]:row.customers;
  const payment=latest(row.payments),notes=[...(row.ride_request_internal_notes||[])].sort((a,b)=>a.created_at.localeCompare(b.created_at)),note=notes.at(-1);
  const tax=(row.ride_tax_quote_projections||[])[0];
  const routePlacesRaw=row.metadata?.routePlaces;
  const routePlacesRecord=routePlacesRaw&&typeof routePlacesRaw==='object'&&!Array.isArray(routePlacesRaw)?routePlacesRaw as Record<string,unknown>:{};
  const routePlaces={pickup:normalizeVerifiedPlace(routePlacesRecord.pickup),destination:normalizeVerifiedPlace(routePlacesRecord.destination),return:normalizeVerifiedPlace(routePlacesRecord.return)};
  const verifiedRoutePlaces=Object.fromEntries(Object.entries(routePlaces).filter((entry):entry is [string,NonNullable<typeof entry[1]>]=>Boolean(entry[1])));
  return {
    id:String(row.id),requestNumber:String(row.public_reference),status:row.status as RideRequest['status'],createdAt:String(row.requested_at),version:Number(row.version),customerId:customer?.id||'',customerDeleted:Boolean(customer?.metadata?.contactDeleted),
    customerName:customer?.full_name||'',email:customer?.email||'',phone:customer?.phone||'',service:row.service as RideRequest['service'],tripType:String(row.trip_type),
    pickupAddress:String(row.pickup_address),destinationAddress:String(row.destination_address),returnAddress:row.return_address?String(row.return_address):undefined,...(Object.keys(verifiedRoutePlaces).length?{routePlaces:verifiedRoutePlaces}:{}),
    pickupDate:String(row.pickup_date),pickupTime:row.pickup_time?String(row.pickup_time).slice(0,5):(row.hourly_start?String(row.hourly_start).slice(0,5):''),
    returnDate:row.return_date?String(row.return_date):undefined,returnTime:row.return_time?String(row.return_time).slice(0,5):undefined,hourlyEnd:row.hourly_end?String(row.hourly_end).slice(0,5):undefined,airport:row.airport?String(row.airport):undefined,
    passengers:Number(row.passengers||0),carryons:Number(row.carryons||0),checkedBags:Number(row.checked_bags||0),hasOversizedItems:Boolean(row.has_oversized_items),
    oversizedDescription:row.oversized_description?String(row.oversized_description):undefined,customerNotes:row.notes?String(row.notes):undefined,ownerNotes:note?.note,ownerNoteHistory:notes.map(entry=>({note:entry.note,createdAt:entry.created_at})),
    quoteAmount:quotedAmount(row.quoted_amount),currency:quotedAmount(row.quoted_amount)?String(row.currency||'USD'):undefined,pricingStatus:quotedAmount(row.quoted_amount)?'calculated':'configuration-required',paymentStatus:payment?.status||'not_requested',lifecycleEffects:(row.lifecycle_effects||[]).map(effect=>({id:effect.id,effectType:effect.effect_type,state:effect.state,enabledSnapshot:effect.enabled_snapshot,attemptCount:effect.attempt_count,maxAttempts:effect.max_attempts,notBefore:effect.not_before,leaseExpiresAt:effect.lease_expires_at,deliveredAt:effect.delivered_at,lastSafeErrorCode:effect.last_safe_error_code,updatedAt:effect.updated_at})),
    ...(manualQuoteDraft?{manualQuoteDraft}:{}),
    ...(tax?{taxProjection:{id:tax.id,quoteId:tax.quote_id,finderAuditId:tax.finder_audit_id,status:tax.state,currency:tax.currency,serviceSubtotalMinor:Number(tax.service_subtotal_minor),salesTaxMinor:Number(tax.tax_minor),customerTotalMinor:Number(tax.customer_total_minor),recommendedPreTaxServiceMinor:Number(tax.recommended_pre_tax_service_minor),unroundedTaxMinor:Number(tax.unrounded_tax_minor),unroundedCustomerTotalMinor:Number(tax.unrounded_customer_total_minor),roundingAdjustmentMinor:Number(tax.rounding_adjustment_minor),rateBasisPoints:Number(tax.rate_basis_points),taxGroupId:tax.wix_tax_group_id,jurisdiction:String(tax.jurisdiction?.county||tax.jurisdiction?.locality||'Ohio jurisdiction'),jurisdictionEvidence:tax.jurisdiction,source:tax.rate_source,sourceReference:tax.rate_source_reference,effectiveDate:tax.effective_date,lookupStatus:tax.lookup_status==='cache_hit'?'cached':'lookup',observedAt:tax.observed_at,expiresAt:tax.expires_at,humanConfirmationStatus:tax.human_confirmation_status,transportationSourcingPolicyConfirmed:tax.transportation_sourcing_policy_confirmed,filingReady:tax.filing_ready,paymentStatus:tax.payment_status}}:{})
  };
};

export async function listRequests():Promise<RideRequest[]>{
  if(!supabase)return demoRequests;
  const withTax=await supabase.from(tableNames.requests).select(`${REQUEST_SELECT_CORE},${REQUEST_SELECT_TAX}`).order('requested_at',{ascending:false});
  if(!withTax.error)return attachManualQuoteDrafts((withTax.data||[]) as DbRequest[]);
  // Tax migrations are additive and default-off. A missing optional relationship
  // must not take the core owner queue offline, but every other error still does.
  if(!isOptionalTaxProjectionSchemaMiss(withTax.error))throw withTax.error;
  const core=await supabase.from(tableNames.requests).select(REQUEST_SELECT_CORE).order('requested_at',{ascending:false});
  if(core.error)throw core.error;
  return attachManualQuoteDrafts((core.data||[]) as DbRequest[]);
}

async function attachManualQuoteDrafts(rows:DbRequest[]):Promise<RideRequest[]>{
  if(!rows.length)return [];
  const ids=rows.map(row=>String(row.id));
  const {data,error}=await supabase!.rpc('admin_read_manual_owner_tax_quote_drafts',{p_ride_request_ids:ids});
  // This additive read model is intentionally fail-closed for drafts, while
  // retaining the existing owner queue during a staggered schema/frontend roll.
  if(error&&!(error as {code?:unknown}).code?.toString().match(/^(PGRST202|42883)$/))throw error;
  const drafts=new Map<string,ManualQuoteDraft>();
  if(!error&&Array.isArray(data))for(const value of data as ManualDraftReadback[]){const draft=toManualQuoteDraft(value);if(draft&&!drafts.has(String(value.ride_request_id)))drafts.set(String(value.ride_request_id),draft)}
  return rows.map(row=>toRequest(row,drafts.get(String(row.id))));
}

export type NotificationRequestProvenance='supabase'|'explicit_demo'|'disconnected';
export type NotificationRequestSnapshot={data:RideRequest[];provenance:NotificationRequestProvenance};
export function resolveNotificationRequestProvenance(input:{supabaseConfigured:boolean;development:boolean;demoEnabled:boolean}):NotificationRequestProvenance{
  if(input.supabaseConfigured)return 'supabase';
  if(input.development&&input.demoEnabled)return 'explicit_demo';
  return 'disconnected';
}
export async function listNotificationRequests():Promise<NotificationRequestSnapshot>{
  const provenance=resolveNotificationRequestProvenance({supabaseConfigured:Boolean(supabase),development:import.meta.env.DEV,demoEnabled:import.meta.env.VITE_ENABLE_DEMO_NOTIFICATIONS==='true'});
  if(provenance==='supabase')return {data:await listRequests(),provenance};
  if(provenance==='explicit_demo')return {data:demoRequests,provenance};
  return {data:[],provenance};
}

export async function transitionRequest(id:string,expectedVersion:number,toStatus:RequestStatus,reason:string):Promise<void>{
  if(!supabase){const target=demoRequests.find(r=>r.id===id);if(target){target.status=toStatus;target.version=(target.version||0)+1;}return;}
  const {error}=await supabase.rpc('admin_transition_ride_request',{p_ride_request_id:id,p_expected_version:expectedVersion,p_to_status:toStatus,p_reason:reason.slice(0,500)});
  if(error)throw error;
}

export async function resetExactPaymentCanaryForTaxRequote(request:RideRequest,reason:string):Promise<void>{
  const clean=reason.trim();if(clean.length<8)throw new Error('Enter a clear reset reason with at least 8 characters.');
  if(!supabase)throw new Error('The exact canary reset is unavailable in local demo mode. Sign in with owner MFA to use it.');
  const {error}=await supabase.rpc('admin_reset_exact_payment_canary_for_tax_requote',{p_ride_request_id:request.id,p_expected_version:request.version||1,p_reason:clean.slice(0,500)});
  if(error)throw error;
}

export async function declineRequest(request:RideRequest,reason:string):Promise<void>{if(!reason.trim())throw new Error('Enter a reason before declining.');return transitionRequest(request.id,request.version||1,'declined',reason.trim())}

export type CompleteRideResult={rideRequestId:string;status:'completed';presentation:'day'|'night';duplicate:boolean;effectId:string};
const edgeMessage=async(error:unknown,response?:Response):Promise<string>=>{
  const context=(error&&typeof error==='object'?(error as {context?:unknown}).context:undefined);
  const edgeResponse=response||((context instanceof Response)?context:undefined);
  const status=edgeResponse?.status??(context&&typeof context==='object'&&typeof (context as {status?:unknown}).status==='number'?(context as {status:number}).status:undefined);
  const payload=edgeResponse?await edgeResponse.clone().json().catch(()=>undefined):undefined;
  const message=payload&&typeof payload==='object'&&typeof (payload as {message?:unknown}).message==='string'?(payload as {message:string}).message:'';
  if(status===401||message==='Authentication required.')return 'Your owner session has expired. Sign in again, complete owner verification, then retry.';
  if(status===403||message==='Admin access required.')return 'Complete owner verification before making this change, then retry.';
  if(status===409)return 'This request changed or is no longer eligible. Your manual fare and rate are still in the form; refresh the request before retrying.';
  if(message==='The request could not be updated.')return 'The request could not be updated. Refresh it once and retry; no customer email or payment was created.';
  return 'Owner Desk could not reach the secure request service. Check your connection, refresh once, and retry. Nothing was sent.';
};
async function invokeAdminMutation<T>(body:Record<string,unknown>):Promise<T>{
  if(!supabase)throw new Error('Owner operations are not connected in this preview.');
  const {data,error,response}=await supabase.functions.invoke('admin-mutations',{body});
  if(error){
    // The edge boundary deliberately does not disclose lifecycle details for a
    // failed owner mutation.  A 409 still needs an actionable, non-destructive
    // recovery path in the manual quote form.
    throw new Error(await edgeMessage(error,response));
  }
  if(!data||typeof data!=='object'||!('data' in data))throw new Error('The owner operation did not return a durable readback. Refresh before trying again.');
  return (data as {data:T}).data;
}
export async function completePaidRide(request:RideRequest,presentation:FollowUpPresentation):Promise<CompleteRideResult>{
  if(request.paymentStatus!=='paid'||!new Set<RequestStatus>(['confirmed','in_progress','completed']).has(request.status))throw new Error('Only a paid, confirmed ride can be completed.');
  if(!new Set<FollowUpPresentation>(['auto','day','night']).has(presentation))throw new Error('Choose an available thank-you image.');
  if(!supabase){
    const duplicate=request.status==='completed';
    if(!duplicate){request.status='completed';request.version=(request.version||0)+1}
    const hour=Number((request.pickupTime||'').slice(0,2));
    return{rideRequestId:request.id,status:'completed',presentation:presentation==='auto'?(hour>=6&&hour<18?'day':'night'):presentation,duplicate,effectId:'00000000-0000-4000-8000-000000000001'};
  }
  const data=await invokeAdminMutation<unknown>({action:'completePaidRide',rideRequestId:request.id,expectedVersion:request.version||1,presentation});
  const row=data as Record<string,unknown>|null;
  if(!row||row.status!=='completed'||!['day','night'].includes(String(row.presentation))||typeof row.effectId!=='string')throw new Error('Ride completion could not be verified. Refresh before trying again.');
  return{rideRequestId:String(row.rideRequestId),status:'completed',presentation:row.presentation as 'day'|'night',duplicate:Boolean(row.duplicate),effectId:String(row.effectId)};
}

export async function removeCustomerContact(customerId:string,reason='Removed by the owner from the customer directory'):Promise<void>{
  if(!supabase){for(const request of demoRequests.filter(item=>item.customerId===customerId)){request.customerDeleted=true;request.customerName='Deleted contact';request.email='';request.phone='';}return;}
  const {error}=await supabase.rpc('admin_remove_customer_contact',{p_customer_id:customerId,p_reason:reason.slice(0,500)});
  if(error)throw error;
}

export async function createQuote(id:string,expectedVersion:number,subtotal:number):Promise<void>{
  if(!Number.isFinite(subtotal)||subtotal<=0)throw new Error('Enter a price greater than $0 before continuing.');
  if(!supabase){const target=demoRequests.find(r=>r.id===id);if(target)target.quoteAmount=subtotal;return;}
  const {error}=await supabase.rpc('admin_create_quote',{p_ride_request_id:id,p_expected_request_version:expectedVersion,p_subtotal:subtotal,p_fees:0,p_deposit_required:0,p_line_items:[],p_expires_at:null});
  if(error)throw error;
}

export async function approveAndPreparePayment(request:RideRequest,decision:OwnerPriceDecision):Promise<void>{
  if(decision.currency!=='USD'||!Number.isSafeInteger(decision.serviceSubtotalMinor)||decision.serviceSubtotalMinor<=0||!Number.isSafeInteger(decision.salesTaxMinor)||decision.salesTaxMinor<0||decision.serviceSubtotalMinor+decision.salesTaxMinor!==decision.customerTotalMinor)throw new Error('The service subtotal, tax, and customer total do not reconcile.');
  if(decision.manualTaxQuote){const manual=decision.manualTaxQuote;if(manual.sourceKind!=='owner_entered_manual'||manual.inputSemantics!=='final_customer_total_tax_included'||!Number.isSafeInteger(manual.enteredCustomerTotalMinor)||manual.enteredCustomerTotalMinor<=0||!Number.isSafeInteger(manual.rateBasisPoints)||manual.rateBasisPoints<0||manual.rateBasisPoints>3000||manual.serviceSubtotalMinor!==decision.serviceSubtotalMinor||manual.salesTaxMinor!==decision.salesTaxMinor||manual.customerTotalMinor!==decision.customerTotalMinor||manual.customerTotalMinor%500!==0)throw new Error('The entered final customer total and tax rate do not reconcile.');if(!supabase){const target=demoRequests.find(item=>item.id===request.id);if(target){target.quoteAmount=manual.customerTotalMinor/100;target.currency='USD';target.version=(target.version||0)+1}return}try{await invokeAdminMutation<unknown>({action:'createManualOwnerTaxIncludedQuote',rideRequestId:request.id,expectedVersion:request.version||1,enteredCustomerTotalMinor:manual.enteredCustomerTotalMinor,enteredRateBasisPoints:manual.rateBasisPoints});}catch(error){
    // A lost browser response is an unknown outcome, never permission to replay
    // the write. Read the owner's current draft once and accept only an exact,
    // already-persisted match; otherwise preserve the original safe error.
    const message=error instanceof Error?error.message:'';
    if(message.includes('could not reach the secure request service')&&await readMatchingSavedManualDraft(request.id,manual))return;
    throw error;
  }return;}
  if(!decision.taxProjection)throw new Error('Verify the exact pickup tax before approving this customer quote. No untaxed payment request was created.');
  assertSafeApprovedTaxProjection(decision.taxProjection);
  if(!supabase){const target=demoRequests.find(item=>item.id===request.id);if(target){target.quoteAmount=decision.customerTotalMinor/100;target.currency='USD';target.status='deposit_pending';target.paymentStatus='pending';target.version=(target.version||0)+1}return}
  await invokeAdminMutation<unknown>({action:'approveAndPreparePayment',rideRequestId:request.id,expectedVersion:request.version||1,serviceSubtotalMinor:decision.serviceSubtotalMinor,salesTaxMinor:decision.salesTaxMinor,customerTotalMinor:decision.customerTotalMinor,currency:'USD',taxProjection:decision.taxProjection});
}

/**
 * Releases an already-saved quote only after the server has verified every
 * payment-link prerequisite. This does not collect a card or mark a ride paid.
 */
export async function releaseManualQuoteForPayment(request:RideRequest,ownerId?:string):Promise<QuoteReleaseResult>{
  const target=releaseTarget(request,ownerId);
  // The database re-computes the request, quote, recipient, owner, gate, and
  // prior-outcome scope atomically. `paymentLinkReady` is only a cacheable UI
  // hint, so a stale false value must never prevent the owner from asking that
  // authoritative server to evaluate the saved draft.
  if(!target)return unavailableRelease(target,'not_ready');
  if(!supabase||!presentationProducerConfigured())return unavailableRelease(target);
  try{
    const response=await invokeAdminMutation<unknown>({action:'approveManualOwnerTaxQuoteForWixPayment',rideRequestId:target.requestId,expectedVersion:target.requestVersion,quoteId:target.quoteId});
    return await decodeReleaseResponse(response,target);
  }catch{return failedRelease(target)}
}

/** Read existing durable result only. Never wakes a worker or resubmits approval. */
export async function readManualQuoteRelease(request:RideRequest,ownerId?:string):Promise<QuoteReleaseResult>{
 const target=releaseTarget(request,ownerId);
 if(!target||!supabase||!presentationProducerConfigured())return unavailableRelease(target,'not_ready');
 try{return await decodeReleaseResponse(await invokeAdminMutation<unknown>({action:'readSendQuote',rideRequestId:target.requestId,expectedVersion:target.requestVersion,quoteId:target.quoteId}),target)}
 catch{return failedRelease(target)}
}

export async function lookupOhioFinderRate(rideRequestId:string):Promise<FinderReviewEvidence>{
  if(!supabase)throw new Error('Ohio Finder is not connected in this preview.');
  const {data,error,response}=await supabase.functions.invoke('ohio-tax-quote-preview',{body:{rideRequestId}});if(error)throw await toRouteEstimateError(error,response);
  const result=normalizeFinderReviewEvidence(data?.finderEvidence);if(!result)throw new Error('Ohio Finder did not return verified exact-address evidence.');
  return result;
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const record=(value:unknown):Record<string,unknown>|undefined=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined;
export function normalizeFinderReviewEvidence(value:unknown):Extract<FinderReviewEvidence,{status:'verified'}>|undefined{
  const row=record(value),jurisdiction=record(row?.jurisdiction),decision=record(row?.reviewDecision);
  const human=row?.humanConfirmationStatus;
  if(row?.status!=='verified'||typeof row.finderAuditId!=='string'||!UUID.test(row.finderAuditId)||!jurisdiction||
    !Number.isInteger(row.rateBasisPoints)||Number(row.rateBasisPoints)<=0||Number(row.rateBasisPoints)>3000||
    !['lookup','cached'].includes(String(row.lookupStatus))||!['pending','confirmed','rejected'].includes(String(human))||
    row.source!=='Ohio Department of Taxation Finder'||typeof row.sourceReference!=='string'||!row.sourceReference.trim()||
    typeof row.jurisdictionLabel!=='string'||!row.jurisdictionLabel.trim()||typeof row.effectiveDate!=='string'||
    typeof row.observedAt!=='string'||typeof row.expiresAt!=='string'||!Number.isFinite(Date.parse(row.observedAt))||!Number.isFinite(Date.parse(row.expiresAt)))return undefined;
  const optional=(key:string)=>typeof row[key]==='string'&&row[key]?String(row[key]):typeof decision?.[key]==='string'&&decision[key]?String(decision[key]):undefined;
  return {status:'verified',finderAuditId:row.finderAuditId,source:row.source,sourceReference:row.sourceReference,
    jurisdiction:Object.fromEntries(Object.entries(jurisdiction).filter((entry):entry is [string,string]=>typeof entry[1]==='string')),
    jurisdictionLabel:row.jurisdictionLabel,rateBasisPoints:Number(row.rateBasisPoints),lookupStatus:row.lookupStatus as 'lookup'|'cached',
    effectiveDate:row.effectiveDate,observedAt:row.observedAt,expiresAt:row.expiresAt,
    transportationSourcingPolicyConfirmed:row.transportationSourcingPolicyConfirmed===true,
    humanConfirmationStatus:human as 'pending'|'confirmed'|'rejected',
    ...(typeof row.sourceEventId==='string'?{sourceEventId:row.sourceEventId}:{}),
    ...(optional('reviewedBy')?{reviewedBy:optional('reviewedBy')}:{}),...(optional('reviewedAt')?{reviewedAt:optional('reviewedAt')}:{}),
    ...(optional('reviewPolicySource')||optional('policySource')?{reviewPolicySource:optional('reviewPolicySource')||optional('policySource')}:{}),
    ...(optional('reviewPolicyDate')||optional('policyDate')?{reviewPolicyDate:optional('reviewPolicyDate')||optional('policyDate')}:{}),
    ...(optional('reviewReason')||optional('reason')?{reviewReason:optional('reviewReason')||optional('reason')}:{}),
  };
}

export const FINDER_REVIEW_NOT_CONNECTED_REASON='Finder review is not connected yet. The reviewed tax migration is required before owner review can be saved.';
const OPTIONAL_FINDER_RELATIONS=['ohio_finder_lookup_audit','ohio_finder_review_decisions'];
export const isOptionalFinderReviewSchemaMiss=(error:unknown):boolean=>{
  if(!error||typeof error!=='object')return false;
  const row=error as {code?:unknown;message?:unknown;details?:unknown;hint?:unknown};
  const evidence=[row.message,row.details,row.hint].filter((value):value is string=>typeof value==='string').join(' ');
  if((row.code==='PGRST202'||row.code==='42883')&&evidence.includes('admin_read_ohio_finder_review'))return true;
  return (row.code==='42P01'||row.code==='PGRST205')&&OPTIONAL_FINDER_RELATIONS.some(relation=>evidence.includes(relation));
};
const finderReviewReadError=(error:unknown):Error=>{
  if(error instanceof Error)return error;
  if(error&&typeof error==='object'){
    const row=error as {code?:unknown;message?:unknown};
    if(row.code==='42501'||row.code==='PGRST301')return new Error('Finder review access was denied. Sign in again before reviewing tax evidence.');
    if(typeof row.message==='string'&&/failed to fetch|network|timeout/i.test(row.message))return new Error('Finder review could not reach the private database. Retry when the connection is available.');
  }
  return new Error('Finder review could not be verified. No tax approval has been enabled.');
};
export async function readOhioFinderReview(rideRequestId:string):Promise<FinderReviewEvidence|undefined>{
  if(!supabase)return undefined;
  let response:{data:unknown;error:unknown};
  try{response=await supabase.rpc('admin_read_ohio_finder_review',{p_ride_request_id:rideRequestId})}
  catch(error){throw finderReviewReadError(error)}
  const {data,error}=response;
  if(error){if(isOptionalFinderReviewSchemaMiss(error))return {status:'unavailable',reason:FINDER_REVIEW_NOT_CONNECTED_REASON};throw finderReviewReadError(error)}
  if(data===null)return undefined;
  const result=normalizeFinderReviewEvidence(data);if(!result)throw new Error('Finder review returned an invalid durable readback.');
  return result;
}

export async function reviewOhioFinderResult(rideRequestId:string,finderAuditId:string,decision:'confirmed'|'rejected',policySource:string,policyDate:string,reason:string):Promise<Extract<FinderReviewEvidence,{status:'verified'}>>{
  const source=policySource.trim(),detail=reason.trim();
  if(source.length<8||source.length>500||detail.length<8||detail.length>500||!/^\d{4}-\d{2}-\d{2}$/.test(policyDate))throw new Error('Enter the policy source, date, and a clear review reason.');
  if(!supabase)throw new Error('Finder review is not connected in this preview.');
  const {error}=await supabase.rpc('admin_review_ohio_finder_result',{p_finder_audit_id:finderAuditId,p_expected_status:'pending',p_decision:decision,p_policy_source:source,p_policy_date:policyDate,p_reason:detail});
  if(error)throw error;
  const readback=await readOhioFinderReview(rideRequestId);if(!readback||readback.status!=='verified'||readback.finderAuditId!==finderAuditId||readback.humanConfirmationStatus!==decision)throw new Error('Finder review was not confirmed by durable readback.');
  return readback;
}

export type TaxCenterRepositoryData={entries:TaxLedgerViewEntry[];adjustments:TaxAdjustmentViewEntry[];rideRecords:RideTaxRecordView[];finder:FinderUsageStatus;sourcing:TransportationSourcingStatus;pricing:PricingAssumptionStatus;filingConfiguration:{assignedFrequency:'monthly'|'semiannual';assignmentVerified:boolean;assignmentSource?:string};reserveBalanceMinor:number|null};
export const taxCenterReadError=(error:unknown):Error=>{
  if(error&&typeof error==='object'){
    const row=error as {code?:unknown;message?:unknown;details?:unknown};
    const evidence=[row.message,row.details].filter((value):value is string=>typeof value==='string').join(' ');
    if((row.code==='PGRST202'||row.code==='42883')&&/admin_read_tax_center/i.test(evidence))return new Error('Tax Center is not connected to this database yet. No tax totals are being assumed.');
    if(typeof row.message==='string'&&row.message.trim())return new Error('Tax records could not be verified. Retry after the private database connection is available.');
  }
  return error instanceof Error?error:new Error('Tax records could not be verified. No tax totals are being assumed.');
};
export async function getTaxCenterData():Promise<TaxCenterRepositoryData>{
  if(!supabase)throw new Error('The paid tax ledger is not connected in this preview.');
  const {data,error}=await supabase.rpc('admin_read_tax_center');if(error)throw taxCenterReadError(error);
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Tax Center returned an invalid readback.');
  return data as TaxCenterRepositoryData;
}
export async function requestWixProviderReconciliation(effect:LifecycleEffect,action:WixReconciliationAction,reason:string,identity:WixReconciliationIdentity={}):Promise<void>{
  if(!wixReconciliationEnabled)throw new Error('Wix reconciliation is disabled until exact-site readback and the owner canary are approved.');
  const clean=reason.trim();if(clean.length<8||clean.length>500)throw new Error('Enter a reason between 8 and 500 characters.');if(hasUnsafeWixReconciliationContent({reason:clean,identity}))throw new Error('Do not enter URLs, tokens, or card data in reconciliation.');
  const values=[identity.providerInvoiceId,identity.paymentRequestId,identity.providerBookingId].filter(Boolean) as string[];
  if(values.some(value=>!isCanonicalWixProviderId(value)))throw new Error('Enter canonical Wix provider UUIDs only. URLs, malformed IDs, whitespace, tokens, and card data are never accepted.');
  if(action==='bind_invoice_payment_request'&&(!identity.providerInvoiceId||!identity.paymentRequestId||identity.providerBookingId))throw new Error('Enter the exact Wix invoice ID and payment request ID.');
  if(action==='bind_paid_booking'&&(!identity.providerBookingId||identity.providerInvoiceId||identity.paymentRequestId))throw new Error('Enter the exact Wix Booking ID only.');
  if(action==='provider_absent_retry'&&values.length)throw new Error('Provider absence cannot include provider IDs.');
  if(action==='provider_observed_cancel'&&effect.effectType==='wix_invoice_payment'&&(!identity.providerInvoiceId||identity.paymentRequestId||identity.providerBookingId))throw new Error('Enter only the exact observed Wix invoice ID for this invoice effect.');
  if(action==='provider_observed_cancel'&&effect.effectType==='wix_paid_booking_confirmation'&&(!identity.providerBookingId||identity.providerInvoiceId||identity.paymentRequestId))throw new Error('Enter only the exact observed Wix Booking ID for this Booking effect.');
  if(action==='provider_observed_cancel'&&!new Set(['wix_invoice_payment','wix_paid_booking_confirmation']).has(effect.effectType))throw new Error('This effect cannot be reconciled through the Wix invoice-first controls.');
  if(!supabase)throw new Error('Supabase is not configured.');
  const {error}=await supabase.rpc('admin_request_wix_provider_reconciliation',{
    p_effect_id:effect.id,p_expected_effect_updated_at:effect.updatedAt,p_action:action,p_reason:clean,
    p_provider_invoice_id:identity.providerInvoiceId||null,p_payment_request_id:identity.paymentRequestId||null,p_provider_booking_id:identity.providerBookingId||null,
  });if(error)throw error;
}
export async function verifyWixPayLinkPayment(request:RideRequest,reason:string):Promise<void>{
  const clean=reason.trim();
  if(request.status!=='deposit_pending'||request.paymentStatus!=='pending')throw new Error('This request is not awaiting Wix payment verification.');
  if(!Number.isSafeInteger(request.version)||Number(request.version)<1)throw new Error('Refresh this request before verifying payment.');
  if(clean.length<8||clean.length>500)throw new Error('Enter a reason between 8 and 500 characters.');
  if(hasUnsafeWixReconciliationContent({reason:clean}))throw new Error('Do not enter URLs, tokens, or card data in the reason.');
  if(!supabase)throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.functions.invoke('wix-pay-link-reconciliation',{body:{rideRequestId:request.id,expectedVersion:request.version,reason:clean}});
  if(error)throw error;
  if(data?.status!=='verified'&&data?.status!=='duplicate')throw new Error('Wix did not authoritatively verify this payment.');
}

const normalizeConnection=(row:Record<string,unknown>|undefined):GoogleCalendarConnection=>({connected:Boolean(row?.connected),googleEmail:row?.google_email?String(row.google_email):undefined,calendarId:row?.calendar_id?String(row.calendar_id):undefined,syncEnabled:Boolean(row?.sync_enabled),connectedAt:row?.connected_at?String(row.connected_at):undefined});
export async function getGoogleCalendarConnection():Promise<GoogleCalendarConnection>{
  if(!supabase)return {connected:false,syncEnabled:false};
  const {data,error}=await supabase.rpc('admin_google_calendar_status');if(error)throw error;
  const row=Array.isArray(data)?data[0]:data;return normalizeConnection(row as Record<string,unknown>|undefined);
}
export async function startGoogleCalendarConnection():Promise<string>{
  if(!supabase)throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.functions.invoke('google-calendar-admin',{body:{action:'start'}});if(error)throw error;
  const url=data?.authorizationUrl;if(typeof url!=='string'||!url.startsWith('https://accounts.google.com/'))throw new Error('Google authorization could not be started.');return url;
}
export async function syncRideToGoogleCalendar(rideRequestId:string):Promise<void>{
  if(!supabase)throw new Error('Supabase is not configured.');
  const {data,error}=await supabase.functions.invoke('google-calendar-admin',{body:{action:'sync',rideRequestId}});
  if(error)throw error;
  if(data?.synced!==true)throw new Error('Google Calendar did not confirm the sync.');
}
const routeEstimateSessionCache=new Map<string,{estimate:RouteEstimate;expiresAt:number}>();
const routeEstimateInFlight=new Map<string,Promise<RouteEstimate>>();
export const clearRouteEstimateSessionCache=()=>{routeEstimateSessionCache.clear();routeEstimateInFlight.clear()};
const finiteNonnegative=(value:unknown)=>Number.isFinite(Number(value))&&Number(value)>=0;
export function normalizeEstimate(row:Record<string,unknown>):RouteEstimate{
  const requiredText=['ride_request_id','base_address','pickup_address','destination_address','calculated_at'];
  const requiredNumbers=['base_to_pickup_miles','pickup_to_destination_miles','destination_to_base_miles','total_miles','total_duration_minutes'];
  if(requiredText.some(key=>typeof row[key]!=='string'||!String(row[key]).trim())||requiredNumbers.some(key=>!finiteNonnegative(row[key]))||Number(row.total_miles)<=0||!Number.isInteger(Number(row.total_duration_minutes))||Number(row.total_duration_minutes)<=0||!Number.isFinite(Date.parse(String(row.calculated_at))))throw new RouteEstimateError('GOOGLE_ROUTES_READBACK_INVALID','Google Routes returned an incomplete mileage result.');
  const routeLegs=Array.isArray(row.route_legs)?(row.route_legs as Array<Record<string,unknown>>).map(leg=>({origin:String(leg.origin||''),destination:String(leg.destination||''),miles:Number(leg.miles),durationMinutes:Number(leg.durationMinutes)})):undefined;
  if(routeLegs&&(routeLegs.length<3||routeLegs.length>4||routeLegs.some(leg=>!leg.origin||!leg.destination||!finiteNonnegative(leg.miles)||!Number.isInteger(leg.durationMinutes)||leg.durationMinutes<0)||Math.abs(routeLegs.reduce((sum,leg)=>sum+leg.miles,0)-Number(row.total_miles))>.02||routeLegs.reduce((sum,leg)=>sum+leg.durationMinutes,0)!==Number(row.total_duration_minutes)))throw new RouteEstimateError('GOOGLE_ROUTES_READBACK_INVALID','Google Routes returned an incomplete mileage result.');
  const cacheStatus=row.cache_status==='cache'?'cache':'provider';
  return {rideRequestId:String(row.ride_request_id),baseAddress:String(row.base_address),pickupAddress:String(row.pickup_address),destinationAddress:String(row.destination_address),...(row.return_address?{returnAddress:String(row.return_address)}:{}),baseToPickupMiles:Number(row.base_to_pickup_miles),pickupToDestinationMiles:Number(row.pickup_to_destination_miles),...(row.destination_to_return_miles!==undefined&&row.destination_to_return_miles!==null?{destinationToReturnMiles:Number(row.destination_to_return_miles)}:{}),...(row.return_to_base_miles!==undefined&&row.return_to_base_miles!==null?{returnToBaseMiles:Number(row.return_to_base_miles)}:{}),destinationToBaseMiles:Number(row.destination_to_base_miles),...(routeLegs?{routeLegs}:{}),totalMiles:Number(row.total_miles),totalDurationMinutes:Number(row.total_duration_minutes),calculatedAt:String(row.calculated_at),sourceAttribution:'Google Maps',cacheStatus,...(typeof row.provider_version==='string'&&row.provider_version?{providerVersion:row.provider_version}:{}),ephemeral:true};
}
export async function calculateRouteEstimate(rideRequestId:string,routeIdentity=''):Promise<RouteEstimate>{
  const cacheKey=rideRequestId+':'+routeIdentity;
  const cached=routeEstimateSessionCache.get(cacheKey);if(cached&&cached.expiresAt>Date.now())return {...cached.estimate,cacheStatus:'cache'};
  routeEstimateSessionCache.delete(cacheKey);
  const active=routeEstimateInFlight.get(cacheKey);if(active)return active;
  if(!supabase)throw new RouteEstimateError('SERVER_CONFIGURATION_MISSING','Automatic mileage is not connected to the private data service. Use manual mileage below.');
  const pending=(async()=>{const {data,error,response}=await supabase.functions.invoke('google-route-estimate',{body:{rideRequestId}});if(error)throw await toRouteEstimateError(error,response);
    if(!data?.estimate)throw new RouteEstimateError('GOOGLE_ROUTES_READBACK_INVALID','Google Routes returned an incomplete mileage result.');
    const estimate=normalizeEstimate(data.estimate as Record<string,unknown>);
    if(estimate.rideRequestId!==rideRequestId)throw new RouteEstimateError('GOOGLE_ROUTES_READBACK_INVALID','Mileage did not match this ride.');
    if(routeEstimateSessionCache.size>=100){const oldest=routeEstimateSessionCache.keys().next().value;if(oldest)routeEstimateSessionCache.delete(oldest)}
    routeEstimateSessionCache.set(cacheKey,{estimate,expiresAt:Date.now()+24*60*60_000});return estimate;})();
  routeEstimateInFlight.set(cacheKey,pending);try{return await pending}finally{routeEstimateInFlight.delete(cacheKey)}
}

export async function addInternalNote(id:string,expectedVersion:number,note:string):Promise<number>{
  if(!supabase){const target=demoRequests.find(r=>r.id===id);if(target){target.ownerNotes=note;target.version=(target.version||0)+1;}return (targetVersion(demoRequests.find(r=>r.id===id)));}
  const {data,error}=await supabase.rpc('admin_add_internal_note',{p_ride_request_id:id,p_expected_version:expectedVersion,p_note:note.slice(0,2000)});
  if(error)throw error;const row=Array.isArray(data)?data[0]:data;return Number(row?.request_version||expectedVersion+1);
}
const targetVersion=(target:RideRequest|undefined)=>target?.version||0;

export async function listEvents(requestId?:string):Promise<AuditEvent[]>{
  if(!supabase)return requestId?demoEvents.filter(e=>e.requestId===requestId):demoEvents;
  let query=supabase.from(tableNames.history).select('id,ride_request_id,from_status,to_status,changed_by,reason,source,created_at').order('created_at',{ascending:false});
  if(requestId)query=query.eq('ride_request_id',requestId);
  const {data,error}=await query;if(error)throw error;
  return (data||[]).map(r=>({id:String(r.id),requestId:String(r.ride_request_id),at:String(r.created_at),actor:r.changed_by?'Owner':String(r.source),action:r.from_status?`${r.from_status} → ${r.to_status}`:'Request received',detail:String(r.reason||'')}));
}

export async function getAnalytics():Promise<AnalyticsSnapshot>{
  if(!supabase)return {daily:[],pages:[],sources:[],services:[]};
  const [daily,pages,sources,services]=await Promise.all([
    supabase.from(analyticsViews.daily).select('*').order('metric_day',{ascending:true}).limit(90),
    supabase.from(analyticsViews.pages).select('*').order('page_views',{ascending:false}),
    supabase.from(analyticsViews.sources).select('*').order('sessions',{ascending:false}).limit(12),
    supabase.from(analyticsViews.services).select('*').order('selections',{ascending:false}),
  ]);
  const error=daily.error||pages.error||sources.error||services.error;if(error)throw error;
  return {
    daily:(daily.data||[]).map(r=>({day:String(r.metric_day),pageViews:Number(r.page_views),visitors:Number(r.visitors),sessions:Number(r.sessions),ctaClicks:Number(r.cta_clicks),formStarts:Number(r.form_starts),submissions:Number(r.submissions)})),
    pages:(pages.data||[]).map(r=>({pageKey:String(r.page_key),pageViews:Number(r.page_views),visitors:Number(r.visitors),ctaClicks:Number(r.cta_clicks)})),
    sources:(sources.data||[]).map(r=>({source:String(r.source),sessions:Number(r.sessions),submissions:Number(r.submissions)})),
    services:(services.data||[]).map(r=>({service:r.service,selections:Number(r.selections),starts:Number(r.starts),submissions:Number(r.submissions)})),
  };
}
