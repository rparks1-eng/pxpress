import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isSupabaseConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT') && key.startsWith('sb_publishable_'));
export const supabase: SupabaseClient | null = isSupabaseConfigured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;
export const tableNames = { requests: import.meta.env.VITE_SUPABASE_REQUESTS_TABLE || 'ride_requests', history: import.meta.env.VITE_SUPABASE_HISTORY_TABLE || 'ride_request_history' };
export const analyticsViews={daily:'website_daily_metrics',pages:'website_page_metrics',sources:'website_source_metrics',services:'website_service_funnel'};
export const wixPaymentEnabled = import.meta.env.VITE_ENABLE_WIX_PAYMENT_REQUEST === 'true';
export const wixReconciliationEnabled = import.meta.env.VITE_ENABLE_WIX_RECONCILIATION_OPERATOR === 'true';
export const wixPayLinkReconciliationEnabled = import.meta.env.VITE_ENABLE_WIX_PAY_LINK_RECONCILIATION === 'true';
