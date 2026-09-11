export const expenseCategories = [
  'fuel',
  'maintenance',
  'tires',
  'washing_detailing',
  'tolls',
  'parking',
  'insurance',
  'registration_licensing',
  'phone_internet',
  'software',
  'advertising',
  'supplies',
  'professional_fees',
  'payment_fees',
  'refreshments',
  'meals',
  'refunds',
  'owner_contribution',
  'owner_withdrawal',
  'transfer',
  'personal_nondeductible',
  'needs_review',
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];
export type ExpenseClassification = 'business' | 'personal' | 'mixed';
export type ExpenseReviewState = 'needs_review' | 'reviewed' | 'excluded';
export type ExpenseSource = 'manual' | 'future_import';
export type ReceiptState = 'missing' | 'local_metadata' | 'stored';

export type ReceiptMetadata = {
  state: ReceiptState;
  fileName?: string;
  mimeType?: string;
  byteSize?: number;
  lastModified?: number;
  storagePath?: string;
};

export type ExpenseTransaction = {
  id: string;
  occurredOn: string;
  merchant: string;
  description?: string;
  amount: number;
  currency: 'USD';
  category: ExpenseCategory;
  classification: ExpenseClassification;
  businessUsePercent: number;
  reviewState: ExpenseReviewState;
  source: ExpenseSource;
  paymentMethod?: string;
  notes?: string;
  receipt: ReceiptMetadata;
  createdAt: string;
  updatedAt: string;
};

export type MerchantRule = {
  id: string;
  merchantPattern: string;
  matchType: 'contains' | 'starts_with' | 'exact';
  category: ExpenseCategory;
  classification: ExpenseClassification;
  businessUsePercent: number;
  enabled: boolean;
};

export type ExpenseDraft = Pick<
  ExpenseTransaction,
  'occurredOn' | 'merchant' | 'description' | 'amount' | 'category' | 'classification' | 'businessUsePercent' | 'paymentMethod' | 'notes'
> & { receipt: ReceiptMetadata };

export type CategoryTotal = { category: ExpenseCategory; amount: number; transactionCount: number };
export type MonthlyExpenseTotal = { month: string; amount: number; transactionCount: number };

export type MileageComparison = {
  businessMiles: number;
  mileageRate: number | null;
  mileageMethodAmount: number | null;
  actualExpenseCandidate: number;
  difference: number | null;
};
