import type {
  CategoryTotal,
  ExpenseCategory,
  ExpenseClassification,
  ExpenseDraft,
  ExpenseTransaction,
  MerchantRule,
  MileageComparison,
  MonthlyExpenseTotal,
  ReceiptMetadata,
} from './types';
import { expenseCategories } from './types';
import { csvRows } from '../../lib/csv';

export const categoryLabels: Record<ExpenseCategory, string> = {
  fuel: 'Fuel',
  maintenance: 'Maintenance',
  tires: 'Tires',
  washing_detailing: 'Washing & detailing',
  tolls: 'Tolls',
  parking: 'Parking',
  insurance: 'Insurance',
  registration_licensing: 'Registration & licensing',
  phone_internet: 'Phone & internet',
  software: 'Software',
  advertising: 'Advertising',
  supplies: 'Supplies',
  professional_fees: 'Professional fees',
  payment_fees: 'Payment fees',
  refreshments: 'Guest refreshments',
  meals: 'Meals',
  refunds: 'Refunds',
  owner_contribution: 'Owner contribution',
  owner_withdrawal: 'Owner withdrawal',
  transfer: 'Transfer',
  personal_nondeductible: 'Personal / nondeductible',
  needs_review: 'Needs review',
};

export const classificationLabels: Record<ExpenseClassification, string> = {
  business: 'Business',
  personal: 'Personal',
  mixed: 'Mixed use',
};

const nonOperatingCategories = new Set<ExpenseCategory>([
  'owner_contribution',
  'owner_withdrawal',
  'transfer',
  'personal_nondeductible',
  'needs_review',
]);

export const isOperatingCategory = (category: ExpenseCategory) => !nonOperatingCategories.has(category);

export const signedAmount = (transaction: Pick<ExpenseTransaction, 'amount' | 'category'>) =>
  transaction.category === 'refunds' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount);

export function accountantReviewCandidate(transaction: ExpenseTransaction): number {
  if (transaction.reviewState !== 'reviewed' || transaction.classification === 'personal' || !isOperatingCategory(transaction.category)) return 0;
  const share = transaction.classification === 'mixed' ? transaction.businessUsePercent / 100 : 1;
  return signedAmount(transaction) * share;
}

export const operatingExpenseTotal = (transactions: ExpenseTransaction[]) =>
  transactions.reduce((total, transaction) => total + accountantReviewCandidate(transaction), 0);

export function categoryTotals(transactions: ExpenseTransaction[]): CategoryTotal[] {
  return expenseCategories
    .map((category) => {
      const matching = transactions.filter((transaction) => transaction.category === category);
      return {
        category,
        amount: matching.reduce((total, transaction) => total + accountantReviewCandidate(transaction), 0),
        transactionCount: matching.length,
      };
    })
    .filter((row) => row.transactionCount > 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

export function monthlyTotals(transactions: ExpenseTransaction[]): MonthlyExpenseTotal[] {
  const totals = new Map<string, MonthlyExpenseTotal>();
  transactions.forEach((transaction) => {
    const month = transaction.occurredOn.slice(0, 7);
    const current = totals.get(month) ?? { month, amount: 0, transactionCount: 0 };
    current.amount += accountantReviewCandidate(transaction);
    current.transactionCount += 1;
    totals.set(month, current);
  });
  return [...totals.values()].sort((a, b) => b.month.localeCompare(a.month));
}

export const transactionsNeedingReview = (transactions: ExpenseTransaction[]) =>
  transactions.filter((transaction) => transaction.reviewState === 'needs_review' || transaction.category === 'needs_review');

export const receiptRequired = (transaction: ExpenseTransaction) =>
  transaction.reviewState !== 'excluded' &&
  transaction.classification !== 'personal' &&
  isOperatingCategory(transaction.category) &&
  signedAmount(transaction) > 0;

export const missingReceiptTransactions = (transactions: ExpenseTransaction[]) =>
  transactions.filter((transaction) => receiptRequired(transaction) && transaction.receipt.state === 'missing');

export function matchMerchantRule(merchant: string, rules: MerchantRule[]): MerchantRule | undefined {
  const normalized = merchant.trim().toLocaleLowerCase();
  return rules.find((rule) => {
    if (!rule.enabled || !rule.merchantPattern.trim()) return false;
    const pattern = rule.merchantPattern.trim().toLocaleLowerCase();
    if (rule.matchType === 'exact') return normalized === pattern;
    if (rule.matchType === 'starts_with') return normalized.startsWith(pattern);
    return normalized.includes(pattern);
  });
}

export function applyMerchantRule(draft: ExpenseDraft, rules: MerchantRule[]): ExpenseDraft {
  const match = matchMerchantRule(draft.merchant, rules);
  return match
    ? { ...draft, category: match.category, classification: match.classification, businessUsePercent: match.businessUsePercent }
    : draft;
}

export function receiptMetadataFromFile(file?: File): ReceiptMetadata {
  if (!file) return { state: 'missing' };
  return { state: 'local_metadata', fileName: file.name, mimeType: file.type || 'application/octet-stream', byteSize: file.size, lastModified: file.lastModified };
}

export function mileageComparison(transactions: ExpenseTransaction[], businessMiles: number, mileageRate: number | null): MileageComparison {
  const miles = Number.isFinite(businessMiles) ? Math.max(0, businessMiles) : 0;
  const rate = mileageRate !== null && Number.isFinite(mileageRate) && mileageRate >= 0 ? mileageRate : null;
  const mileageMethodAmount = rate === null ? null : miles * rate;
  const actualExpenseCandidate = operatingExpenseTotal(transactions);
  return {
    businessMiles: miles,
    mileageRate: rate,
    mileageMethodAmount,
    actualExpenseCandidate,
    difference: mileageMethodAmount === null ? null : mileageMethodAmount - actualExpenseCandidate,
  };
}

export function expensesToCsv(transactions: ExpenseTransaction[]): string {
  const headings = ['Date', 'Merchant', 'Description', 'Amount', 'Currency', 'Category', 'Classification', 'Business use %', 'Review state', 'Receipt', 'Source', 'Notes'];
  const rows = transactions.map((transaction) => [
    transaction.occurredOn,
    transaction.merchant,
    transaction.description,
    signedAmount(transaction),
    transaction.currency,
    categoryLabels[transaction.category],
    classificationLabels[transaction.classification],
    transaction.businessUsePercent,
    transaction.reviewState,
    transaction.receipt.state,
    transaction.source,
    transaction.notes,
  ]);
  return csvRows([headings, ...rows]);
}
