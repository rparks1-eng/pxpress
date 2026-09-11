import {describe,it,expect} from 'vitest';
import {messageDeliveryLabel} from './GuestMessageJourney';
import type {LifecycleEffect} from '../types';
describe('customer email status',()=>{
 it('never describes a held or missing message as sent',()=>{expect(messageDeliveryLabel()).toBe('Not prepared');expect(messageDeliveryLabel({state:'held'} as LifecycleEffect)).toBe('Prepared · sending on hold')});
 it('does not imply inbox placement or invite a duplicate resend',()=>{expect(messageDeliveryLabel({state:'delivered'} as LifecycleEffect)).toBe('Delivery recorded');expect(messageDeliveryLabel({state:'reconciliation_required'} as LifecycleEffect)).toContain('do not resend')});
});
