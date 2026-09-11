import { describe, expect, it } from 'vitest';
import { applyMerchantRule, categoryTotals, expensesToCsv, mileageComparison, missingReceiptTransactions, operatingExpenseTotal, transactionsNeedingReview } from './domain';
import { localExpenseFixtures, localMerchantRuleFixtures } from './fixtures';

describe('expense domain', () => {
  it('counts only reviewed business shares in the informational operating total', () => {
    expect(operatingExpenseTotal(localExpenseFixtures)).toBeCloseTo(257.86, 2);
  });

  it('keeps unresolved transactions in the owner review inbox', () => {
    expect(transactionsNeedingReview(localExpenseFixtures).map((item) => item.id)).toEqual(['expense-local-004']);
  });

  it('finds missing documentation without treating personal or transfer activity as an expense receipt gap', () => {
    expect(missingReceiptTransactions(localExpenseFixtures).map((item) => item.id)).toEqual(['expense-local-002', 'expense-local-003']);
  });

  it('applies an enabled merchant rule as a suggestion before owner review', () => {
    const draft = { occurredOn: '2026-09-01', merchant: 'SHELL 102', amount: 50, category: 'needs_review' as const, classification: 'personal' as const, businessUsePercent: 0, receipt: { state: 'missing' as const } };
    expect(applyMerchantRule(draft, localMerchantRuleFixtures)).toMatchObject({ category: 'fuel', classification: 'business', businessUsePercent: 100 });
  });

  it('requires an explicit mileage rate and never invents one', () => {
    expect(mileageComparison(localExpenseFixtures, 100, null).mileageMethodAmount).toBeNull();
    expect(mileageComparison(localExpenseFixtures, 100, 0.7).mileageMethodAmount).toBeCloseTo(70, 2);
  });

  it('exports quoted CSV cells safely and preserves a category ledger', () => {
    expect(expensesToCsv([{ ...localExpenseFixtures[0], merchant: 'Vendor, "North"' }])).toContain('"Vendor, ""North"""');
    const hardened = expensesToCsv([{ ...localExpenseFixtures[0], merchant: '=DANGEROUS()', description: ' +formula', notes: '@formula', amount: 42.5, category: 'refunds' }]);
    expect(hardened).toContain('"\'=DANGEROUS()"');
    expect(hardened).toContain('"\' +formula"');
    expect(hardened).toContain('"\'@formula"');
    expect(hardened).toContain('"-42.5"');
    expect(categoryTotals(localExpenseFixtures).map((row) => row.category)).toContain('needs_review');
  });
});
