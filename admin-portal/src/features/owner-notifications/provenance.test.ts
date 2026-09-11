import { describe,expect,it } from 'vitest';
import { resolveNotificationRequestProvenance } from '../../lib/repository';
describe('notification request provenance',()=>{
 it('fails closed without Supabase, including production with a demo flag',()=>expect(resolveNotificationRequestProvenance({supabaseConfigured:false,development:false,demoEnabled:true})).toBe('disconnected'));
 it('allows demo notifications only through an explicit local development flag',()=>expect(resolveNotificationRequestProvenance({supabaseConfigured:false,development:true,demoEnabled:true})).toBe('explicit_demo'));
 it('prefers authenticated Supabase records',()=>expect(resolveNotificationRequestProvenance({supabaseConfigured:true,development:true,demoEnabled:true})).toBe('supabase'));
});
