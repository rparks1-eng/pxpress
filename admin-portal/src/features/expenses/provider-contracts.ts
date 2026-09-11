import type { ExpenseCategory, ExpenseClassification } from './types';

export type FinancialDataProvider = 'stripe_financial_connections' | 'plaid';
export type FinancialConnectionState = 'disconnected' | 'pending_owner_consent' | 'connected' | 'revoked' | 'error';

export type FinancialConnectionSummary = {
  provider: FinancialDataProvider;
  state: FinancialConnectionState;
  enabled: false;
  institutionDisplayName?: string;
  lastImportedAt?: string;
  safeErrorCode?: string;
};

export type ImportedTransactionEnvelope = {
  provider: FinancialDataProvider;
  providerTransactionId: string;
  occurredOn: string;
  merchant?: string;
  description: string;
  amount: number;
  currency: string;
  pending: boolean;
  suggestedCategory?: ExpenseCategory;
  suggestedClassification?: ExpenseClassification;
};

export type ImportPreview = {
  connectionState: FinancialConnectionState;
  transactions: ImportedTransactionEnvelope[];
  duplicateProviderTransactionIds: string[];
  requiresOwnerReview: true;
};

export interface FinancialTransactionImportAdapter {
  readonly provider: FinancialDataProvider;
  readonly enabled: false;
  readConnection(): Promise<FinancialConnectionSummary>;
  previewImport(): Promise<ImportPreview>;
}

export const disconnectedFinancialConnections: FinancialConnectionSummary[] = [
  { provider: 'stripe_financial_connections', state: 'disconnected', enabled: false },
  { provider: 'plaid', state: 'disconnected', enabled: false },
];

export const financialProviderBoundary = Object.freeze({
  liveProviderCalls: false,
  storesCredentials: false,
  createsConnections: false,
  importsTransactions: false,
  requiresOwnerConsentAtActivation: true,
  requiresDuplicateAndPendingTransactionReview: true,
});
