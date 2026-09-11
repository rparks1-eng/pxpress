import type { ExpenseTransaction, MerchantRule } from './types';

export const localExpenseFixtures: ExpenseTransaction[] = [
  {
    id: 'expense-local-001', occurredOn: '2026-08-29', merchant: 'Shell', description: 'Fuel', amount: 72.46, currency: 'USD',
    category: 'fuel', classification: 'business', businessUsePercent: 100, reviewState: 'reviewed', source: 'manual', paymentMethod: 'Owner card',
    receipt: { state: 'local_metadata', fileName: 'shell-receipt.jpg', mimeType: 'image/jpeg', byteSize: 284100 },
    createdAt: '2026-08-29T18:30:00Z', updatedAt: '2026-08-29T18:30:00Z',
  },
  {
    id: 'expense-local-002', occurredOn: '2026-08-27', merchant: 'Conrads', description: 'Oil service', amount: 118.2, currency: 'USD',
    category: 'maintenance', classification: 'business', businessUsePercent: 100, reviewState: 'reviewed', source: 'manual',
    receipt: { state: 'missing' }, createdAt: '2026-08-27T15:10:00Z', updatedAt: '2026-08-27T15:10:00Z',
  },
  {
    id: 'expense-local-003', occurredOn: '2026-08-25', merchant: 'T-Mobile', description: 'Monthly service', amount: 96, currency: 'USD',
    category: 'phone_internet', classification: 'mixed', businessUsePercent: 70, reviewState: 'reviewed', source: 'manual',
    receipt: { state: 'missing' }, createdAt: '2026-08-25T13:00:00Z', updatedAt: '2026-08-25T13:00:00Z',
  },
  {
    id: 'expense-local-004', occurredOn: '2026-08-23', merchant: 'Unknown card charge', amount: 34.18, currency: 'USD',
    category: 'needs_review', classification: 'business', businessUsePercent: 100, reviewState: 'needs_review', source: 'future_import',
    receipt: { state: 'missing' }, createdAt: '2026-08-23T10:15:00Z', updatedAt: '2026-08-23T10:15:00Z',
  },
];

export const localMerchantRuleFixtures: MerchantRule[] = [
  { id: 'rule-local-shell', merchantPattern: 'Shell', matchType: 'contains', category: 'fuel', classification: 'business', businessUsePercent: 100, enabled: true },
  { id: 'rule-local-conrads', merchantPattern: 'Conrads', matchType: 'contains', category: 'maintenance', classification: 'business', businessUsePercent: 100, enabled: true },
];
