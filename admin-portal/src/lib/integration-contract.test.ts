import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allowedTransitions } from './selectors';

describe('owner lifecycle contract', () => {
  it('has no direct confirmation transition', () => expect(Object.values(allowedTransitions).flat()).not.toContain('confirmed'));

  it('requires every customer approval to use the tax-projected RPC', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/repository.ts'), 'utf8');
    const mutationSource = readFileSync(join(process.cwd(), '../supabase/functions/admin-mutations/index.ts'), 'utf8');
    expect(source).toContain("action:'approveAndPreparePayment'");
    expect(mutationSource).toContain('admin_accept_ride_request_with_tax_projection');
    expect(source).toContain('if(!decision.taxProjection)throw new Error');
    expect(source).toContain('serviceSubtotalMinor:decision.serviceSubtotalMinor');
    expect(source).toContain('salesTaxMinor:decision.salesTaxMinor');
    expect(source).toContain('customerTotalMinor:decision.customerTotalMinor');
    expect(mutationSource).toContain('p_service_subtotal_minor: input.serviceSubtotalMinor');
    expect(mutationSource).toContain('p_tax_minor: input.salesTaxMinor');
    expect(mutationSource).toContain('p_customer_total_minor: input.customerTotalMinor');
    expect(source).not.toContain('p_amount:decision.customerTotalMinor/100');
  });

  it('keeps raw-card and hosted-link fields out of request UI', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/RequestDetail.tsx'), 'utf8');
    expect(source).not.toMatch(/cardNumber|cvv|hosted_url/);
    expect(source).toContain('never collects raw card data');
  });

  it('shows Payment Links as current and invoices as legacy and disabled', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/LifecyclePanel.tsx'), 'utf8');
    expect(source).toContain("label: 'Wix Payment Link created', effectType: 'payment_link_creation'");
    expect(source).toContain("legacyTypes: LifecycleEffectType[] = ['wix_invoice_payment', 'wix_booking_checkout']");
    expect(source).toContain('Legacy Wix invoice lane (disabled)');
    expect(source).toContain('Payment Links and booking lifecycle');
    expect(source).toContain('Wix Payment Links are the current payment path');
    expect(source).toContain('Authoritative paid verification');
    expect(source).toContain('Wix Booking confirmed PAID');
    expect(source).toContain('Legacy / inactive records');
  });

  it('keeps operator reconciliation hard disabled by default and provider-ID only', () => {
    const source = readFileSync(join(process.cwd(), 'src/lib/repository.ts'), 'utf8');
    const env = readFileSync(join(process.cwd(), '.env.example'), 'utf8');
    expect(env).toContain('VITE_ENABLE_WIX_RECONCILIATION_OPERATOR=false');
    expect(source).toContain('Wix reconciliation is disabled');
    expect(source).toContain('canonical Wix provider UUIDs only');
    expect(source).toContain('URLs, tokens, or card data');
    expect(source).toContain("rpc('admin_request_wix_provider_reconciliation'");
  });
});
