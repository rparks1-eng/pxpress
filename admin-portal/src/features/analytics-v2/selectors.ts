import { operatingExpenseTotal, receiptRequired } from '../expenses/domain';
import type { BusinessInsights, BusinessInsightsInput, CompletenessIndicator, FunnelStage, ServiceInsight } from './types';
import type { RideRequest } from '../../types';

const quotedStatuses = new Set<RideRequest['status']>(['quote_ready', 'quote_sent', 'deposit_pending', 'deposit_paid', 'confirmed', 'in_progress', 'completed', 'payment_failed', 'refunded']);
const confirmedStatuses = new Set<RideRequest['status']>(['confirmed', 'in_progress', 'completed']);

const ratio = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;

export function buildFunnel(requests: RideRequest[]): FunnelStage[] {
  const counts = [
    requests.length,
    requests.filter((request) => request.quoteAmount !== undefined || quotedStatuses.has(request.status)).length,
    requests.filter((request) => confirmedStatuses.has(request.status)).length,
    requests.filter((request) => request.status === 'completed').length,
  ];
  const definitions: Array<[FunnelStage['key'], string]> = [['received', 'Requests received'], ['quoted', 'Price prepared'], ['confirmed', 'Confirmed'], ['completed', 'Completed']];
  return definitions.map(([key, label], index) => ({ key, label, count: counts[index], rateFromPrior: index === 0 ? null : ratio(counts[index], counts[index - 1]) }));
}

export function buildServiceInsights(requests: RideRequest[]): ServiceInsight[] {
  const services: RideRequest['service'][] = ['airport', 'appointment', 'point', 'events', 'hourly'];
  return services.map((service) => {
    const matching = requests.filter((request) => request.service === service);
    return {
      service,
      requests: matching.length,
      completed: matching.filter((request) => request.status === 'completed').length,
      paidRevenue: matching.filter((request) => request.paymentStatus === 'paid').reduce((total, request) => total + (request.quoteAmount ?? 0), 0),
    };
  }).filter((row) => row.requests > 0).sort((a, b) => b.requests - a.requests);
}

const indicator = (key: string, label: string, complete: number, total: number, note: string): CompletenessIndicator => ({ key, label, complete, total, rate: ratio(complete, total), note });

export function computeBusinessInsights(input: BusinessInsightsInput): BusinessInsights {
  const { requests, expenses } = input;
  const expensesConnected = input.source !== 'live_requests_expenses_disconnected';
  const paidRequests = requests.filter((request) => request.paymentStatus === 'paid');
  const paidRevenue = paidRequests.reduce((total, request) => total + (request.quoteAmount ?? 0), 0);
  const quoted = requests.filter((request) => request.quoteAmount !== undefined);
  const quotedValue = quoted.reduce((total, request) => total + (request.quoteAmount ?? 0), 0);
  const completedRides = requests.filter((request) => request.status === 'completed').length;
  const reviewedOperatingExpense = operatingExpenseTotal(expenses);
  const routeEligible = requests.filter((request) => confirmedStatuses.has(request.status));
  const routesWithCachedMiles = routeEligible.filter((request) => Number.isFinite(request.cachedRouteMiles));
  const recordedRouteMiles = routesWithCachedMiles.length
    ? routesWithCachedMiles.reduce((total, request) => total + (request.cachedRouteMiles ?? 0), 0)
    : null;
  const customerCounts = new Map<string, number>();
  requests.forEach((request) => customerCounts.set(request.customerId, (customerCounts.get(request.customerId) ?? 0) + 1));
  const receiptCandidates = expenses.filter(receiptRequired);
  const reviewedExpenses = expenses.filter((expense) => expense.reviewState === 'reviewed' && expense.category !== 'needs_review');
  return {
    funnel: buildFunnel(requests),
    revenue: {
      paidRevenue,
      paidRideCount: paidRequests.length,
      quotedValue,
      quoteCount: quoted.length,
      averagePaidRide: paidRequests.length ? paidRevenue / paidRequests.length : null,
    },
    efficiency: {
      reviewedOperatingExpense,
      contributionBeforeUntrackedCosts: expensesConnected && paidRevenue > 0 ? paidRevenue - reviewedOperatingExpense : null,
      expenseToPaidRevenueRate: expensesConnected ? ratio(reviewedOperatingExpense, paidRevenue) : null,
      completedRides,
      recordedRouteMiles,
      costPerCompletedRide: expensesConnected && completedRides ? reviewedOperatingExpense / completedRides : null,
    },
    customers: {
      uniqueCustomers: customerCounts.size,
      repeatCustomers: [...customerCounts.values()].filter((count) => count > 1).length,
      repeatCustomerRate: ratio([...customerCounts.values()].filter((count) => count > 1).length, customerCounts.size),
    },
    services: buildServiceInsights(requests),
    completeness: [
      indicator('contacts', 'Guest contact details', requests.filter((request) => Boolean(request.customerName && request.email && request.phone)).length, requests.length, 'Name, email, and phone present'),
      indicator('quotes', 'Recorded prices', quoted.length, requests.length, 'Request has an owner-entered quote amount'),
      indicator('routes', 'Route mileage', routeEligible.filter((request) => request.cachedRouteMiles !== undefined).length, routeEligible.length, 'Confirmed or completed rides with cached route miles'),
      indicator('expense-review', 'Expense decisions', reviewedExpenses.length, expenses.length, 'Category and owner review completed'),
      indicator('receipts', 'Expense receipts', receiptCandidates.filter((expense) => expense.receipt.state !== 'missing').length, receiptCandidates.length, 'Receipt metadata present when documentation is expected'),
    ],
  };
}
