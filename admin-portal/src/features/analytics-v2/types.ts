import type { ExpenseTransaction } from '../expenses/types';
import type { RideRequest } from '../../types';

export type AnalyticsDataSource = 'live_repository' | 'live_requests_expenses_disconnected' | 'local_preview' | 'not_connected';

export type BusinessInsightsInput = {
  requests: RideRequest[];
  expenses: ExpenseTransaction[];
  source: AnalyticsDataSource;
  periodLabel: string;
};

export type FunnelStage = { key: 'received' | 'quoted' | 'confirmed' | 'completed'; label: string; count: number; rateFromPrior: number | null };
export type ServiceInsight = { service: RideRequest['service']; requests: number; completed: number; paidRevenue: number };
export type CompletenessIndicator = { key: string; label: string; complete: number; total: number; rate: number | null; note: string };

export type BusinessInsights = {
  funnel: FunnelStage[];
  revenue: {
    paidRevenue: number;
    paidRideCount: number;
    quotedValue: number;
    quoteCount: number;
    averagePaidRide: number | null;
  };
  efficiency: {
    reviewedOperatingExpense: number;
    contributionBeforeUntrackedCosts: number | null;
    expenseToPaidRevenueRate: number | null;
    completedRides: number;
    recordedRouteMiles: number | null;
    costPerCompletedRide: number | null;
  };
  customers: {
    uniqueCustomers: number;
    repeatCustomers: number;
    repeatCustomerRate: number | null;
  };
  services: ServiceInsight[];
  completeness: CompletenessIndicator[];
};
