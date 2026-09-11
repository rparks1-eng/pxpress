import { describe,expect,it } from 'vitest';
import { assertSafeApprovedTaxProjection } from './repository';

const valid=()=>({schemaVersion:'pxpress-approved-tax-projection-v1',finderAuditId:'6b36fc7d-d3fd-4f9f-a790-351fe6a8b2ec',serviceSubtotalMinor:11628,salesTaxMinor:872,customerTotalMinor:12500,recommendedPreTaxServiceMinor:11000,unroundedTaxMinor:743,unroundedCustomerTotalMinor:11743,roundingAdjustmentMinor:757,rateBasisPoints:675,jurisdiction:{countryCode:'US',subdivisionCode:'OH',county:'Summit',locality:'Reminderville'},jurisdictionLabel:'Summit County',source:'Ohio Department of Taxation Finder',sourceReference:'finder-case-1',effectiveDate:'2026-09-02',lookupStatus:'cached',observedAt:'2026-09-02T12:00:00Z',expiresAt:'2026-09-03T12:00:00Z',taxGroupId:'13d21c63-b5ec-5912-8397-c3a5ddb27a97',providerTaxMode:'wix-calculates-once-from-tax-exclusive-subtotal'});

describe('tax projection RPC boundary',()=>{
  it('accepts only the expected projection shape',()=>expect(()=>assertSafeApprovedTaxProjection(valid())).not.toThrow());
  it.each([
    ['extra top-level key',{...valid(),unexpected:'value'}],
    ['raw card field',{...valid(),cardNumber:'4111111111111111'}],
    ['nested payment secret',{...valid(),jurisdiction:{...valid().jurisdiction,paymentToken:'secret'}}],
  ])('rejects %s',(_label,value)=>expect(()=>assertSafeApprovedTaxProjection(value)).toThrow(/unsupported or unsafe/i));
  it.each(['4111111111111111','4111 1111 1111 1111','4111-1111-1111-1111'])('rejects PAN-like content inside an allowed field: %s',value=>expect(()=>assertSafeApprovedTaxProjection({...valid(),jurisdictionLabel:value})).toThrow(/unsupported or unsafe/i));
  it('accepts legitimate non-PAN jurisdiction identifiers',()=>expect(()=>assertSafeApprovedTaxProjection({...valid(),jurisdictionLabel:'Summit County 153'})).not.toThrow());
});
