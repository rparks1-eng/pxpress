import { describe, expect, it } from 'vitest';
import { hasUnsafeWixReconciliationContent, isCanonicalWixProviderId } from './repository';

describe('Wix reconciliation provider identity', () => {
  it('accepts current canonical Wix UUID identities', () => {
    expect(isCanonicalWixProviderId('11924b3e-cf0a-43b3-8bd8-21d75e4431c2')).toBe(true);
    expect(isCanonicalWixProviderId('22924B3E-CF0A-43B3-8BD8-21D75E4431C2')).toBe(true);
  });

  it.each([
    '123456789012345678901234567890123456',
    '--------------------4111111111111111',
    '11924b3ecf0a43b38bd821d75e4431c2',
    '11924b3e-cf0a-03b3-8bd8-21d75e4431c2',
    '11924b3e-cf0a-43b3-1bd8-21d75e4431c2',
    'https://wix.example/11924b3e-cf0a-43b3-8bd8-21d75e4431c2',
    'user@example.com',
    '11924b3e-cf0a-43b3-8bd8-21d75e4431c2\n',
    'checkoutToken',
  ])('rejects malformed, URL, whitespace, token, or card-shaped ID %s', value => {
    expect(isCanonicalWixProviderId(value)).toBe(false);
  });

  it('rejects nested card-shaped fields before an RPC can be attempted', () => {
    expect(hasUnsafeWixReconciliationContent({ identity: { metadata: { cardNumber: '4111111111111111' } } })).toBe(true);
    expect(hasUnsafeWixReconciliationContent({ identity: { providerInvoiceId: '11924b3e-cf0a-43b3-8bd8-21d75e4431c2' } })).toBe(false);
  });
});
