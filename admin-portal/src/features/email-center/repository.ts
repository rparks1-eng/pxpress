import { DisconnectedEmailProvider,EMAIL_FEATURE_FLAGS,type OwnerEmailProvider } from './provider-contract';
import { SupabaseOwnerEmailProvider } from './supabase-provider';

const configuredProvider=():OwnerEmailProvider=>import.meta.env.VITE_OWNER_EMAIL_PROVIDER==='gmail'?new SupabaseOwnerEmailProvider():new DisconnectedEmailProvider();
let provider:OwnerEmailProvider=configuredProvider();
export function ownerEmailProvider(){return provider}
export function setOwnerEmailProviderForTests(next:OwnerEmailProvider){provider=next}
export function resetOwnerEmailProvider(){provider=configuredProvider()}
export function emailFeatureState(){return EMAIL_FEATURE_FLAGS}
