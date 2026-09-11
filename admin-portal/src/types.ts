export type RequestStatus = 'new' | 'triaged' | 'quote_ready' | 'quote_sent' | 'deposit_pending' | 'deposit_paid' | 'confirmed' | 'in_progress' | 'completed' | 'declined' | 'expired' | 'cancelled' | 'payment_failed' | 'refunded' | 'notification_failed' | 'scheduling_conflict';
export type FollowUpPresentation = 'auto' | 'day' | 'night';
export type LifecycleEffectType =
  | 'customer_request_acknowledgement'
  | 'owner_request_notification'
  | 'owner_payment_notification'
  | 'tentative_calendar'
  | 'wix_contact'
  | 'wix_invoice_payment'
  | 'customer_payment_link_delivery'
  | 'wix_paid_booking_confirmation'
  | 'customer_payment_receipt'
  | 'calendar_finalization'
  | 'customer_post_ride_thank_you'
  | 'customer_feedback_receipt'
  // Retained only so historical rows remain readable. These are not active lanes.
  | 'payment_link_creation'
  | 'wix_booking_checkout';
export type LifecycleEffectState = 'held'|'ready'|'leased'|'retry'|'delivered'|'dead_letter'|'reconciliation_required'|'cancelled';
export type LifecycleEffect = {id:string;effectType:LifecycleEffectType;state:LifecycleEffectState;enabledSnapshot:boolean;attemptCount:number;maxAttempts:number;notBefore?:string;leaseExpiresAt?:string;deliveredAt?:string;lastSafeErrorCode?:string;updatedAt:string};
export type WixReconciliationAction = 'provider_absent_retry'|'provider_observed_cancel'|'bind_invoice_payment_request'|'bind_paid_booking';
export type WixReconciliationIdentity = {providerInvoiceId?:string;paymentRequestId?:string;providerBookingId?:string};

export type RideTaxProjection = {
  id:string;quoteId:string;status:'verified_approved'|'paid_verified'|'filing_ready'|'void';currency:'USD';
  serviceSubtotalMinor:number;salesTaxMinor:number;customerTotalMinor:number;recommendedPreTaxServiceMinor:number;unroundedTaxMinor:number;unroundedCustomerTotalMinor:number;roundingAdjustmentMinor:number;rateBasisPoints:number;taxGroupId:string;
  finderAuditId:string;jurisdiction:string;jurisdictionEvidence:Record<string,string>;source:string;sourceReference:string;effectiveDate:string;lookupStatus:'lookup'|'cached';
  observedAt:string;expiresAt:string;humanConfirmationStatus:'confirmed';
  transportationSourcingPolicyConfirmed:true;filingReady:boolean;paymentStatus:'unpaid'|'authorized'|'paid'|'refunded'|'void';
};

// Safe owner-facing projection of a current manual draft.  The audit's pickup
// address, owner identity, and source record intentionally stay private.
export type ManualQuoteDraft = {
  status:'draft'|'approved'; inputSemantics:'final_customer_total_tax_included'|'legacy_base_fare_plus_tax';
  /** Current draft identifier. It is used only for an explicit owner release. */
  quoteId?:string;
  /** Server-proven payment-link readiness. False means release remains unavailable. */
  paymentLinkReady?:boolean;
  enteredCustomerTotalMinor?:number;
  /** Historical only: records created before the final-total rule changed. */
  enteredBaseFareMinor?:number;
  rateBasisPoints:number;
  serviceSubtotalMinor:number; salesTaxMinor:number; customerTotalMinor:number;
  savedAt:string; isCurrent:boolean;
};

export type RoutePlaceKind = 'pickup' | 'destination' | 'return';
export type VerifiedPlaceMetadata = {
  verified:true;
  displayName?:string;
  formattedAddress:string;
  placeId?:string;
  placeIdHash?:string;
  types?:string[];
  category?:string;
  provenance:string;
  resolvedAt:string;
};

export type RideRequest = {
  id: string; requestNumber: string; status: RequestStatus; createdAt: string; version?: number; customerId: string; customerDeleted?: boolean;
  customerName: string; email: string; phone: string; service: 'airport' | 'appointment' | 'point' | 'events' | 'hourly';
  tripType: string; pickupAddress: string; destinationAddress: string; returnAddress?: string;
  routePlaces?:Partial<Record<RoutePlaceKind,VerifiedPlaceMetadata>>;
  pickupDate: string; pickupTime: string; returnDate?: string; returnTime?: string; hourlyEnd?: string; airport?: string;
  passengers: number; carryons: number; checkedBags: number; hasOversizedItems: boolean;
  oversizedDescription?: string; customerNotes?: string; ownerNotes?: string;
  ownerNoteHistory?:Array<{note:string;createdAt:string}>;
  cachedRouteMiles?: number;
  quoteAmount?: number; currency?:string; pricingStatus: 'calculated' | 'configuration-required'; paymentStatus: 'not_requested' | 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'void'; lifecycleEffects?:LifecycleEffect[]; taxProjection?:RideTaxProjection; manualQuoteDraft?:ManualQuoteDraft;
};

export type AuditEvent = { id: string; requestId: string; at: string; actor: string; action: string; detail: string };
export type Customer = { id: string; email: string; name: string; phone: string; rides: number; lastRide: string; totalQuoted: number };
export type DailyMetric = { day:string; pageViews:number; visitors:number; sessions:number; ctaClicks:number; formStarts:number; submissions:number };
export type PageMetric = { pageKey:string; pageViews:number; visitors:number; ctaClicks:number };
export type SourceMetric = { source:string; sessions:number; submissions:number };
export type ServiceFunnel = { service:RideRequest['service']; selections:number; starts:number; submissions:number };
export type AnalyticsSnapshot = { daily:DailyMetric[]; pages:PageMetric[]; sources:SourceMetric[]; services:ServiceFunnel[] };
export type GoogleCalendarConnection = { connected:boolean; googleEmail?:string; calendarId?:string; syncEnabled:boolean; connectedAt?:string };
export type RouteEstimateLeg = {origin:string;destination:string;miles:number;durationMinutes:number};
export type RouteEstimate = { rideRequestId:string; baseAddress:string; pickupAddress:string; destinationAddress:string; returnAddress?:string; baseToPickupMiles:number; pickupToDestinationMiles:number; destinationToReturnMiles?:number; returnToBaseMiles?:number; destinationToBaseMiles:number; routeLegs?:RouteEstimateLeg[]; totalMiles:number; totalDurationMinutes:number; calculatedAt:string; sourceAttribution:'Google Maps'|'Owner entered'; cacheStatus?:'provider'|'cache'|'manual'; providerVersion?:string; ephemeral:true };
