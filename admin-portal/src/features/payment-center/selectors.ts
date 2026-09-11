import type { RideRequest } from '../../types';

export type PaymentLane = 'awaiting_payment' | 'paid' | 'failed' | 'refunded' | 'not_requested';
export type PaymentCenterRow = {
  request: RideRequest;
  lane: PaymentLane;
  amount: number | null;
  currency: string | null;
  completeness: 'complete_for_display' | 'missing_price' | 'missing_currency';
  sourceNote: string;
};

export const paymentLaneLabels: Record<PaymentLane, string> = {
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  not_requested: 'Not requested',
};

export function paymentLane(request: RideRequest): PaymentLane {
  if (request.paymentStatus === 'paid') return 'paid';
  if (request.paymentStatus === 'failed') return 'failed';
  if (request.paymentStatus === 'refunded' || request.paymentStatus === 'void') return 'refunded';
  if (request.paymentStatus === 'pending' || request.paymentStatus === 'authorized') return 'awaiting_payment';
  return 'not_requested';
}

export function buildPaymentRows(requests: RideRequest[]): PaymentCenterRow[] {
  return requests.map((request) => {
    const amount = request.quoteAmount ?? null;
    const currency = request.currency ?? null;
    const completeness: PaymentCenterRow['completeness'] = amount === null ? 'missing_price' : currency === null ? 'missing_currency' : 'complete_for_display';
    return {
      request,
      lane: paymentLane(request),
      amount,
      currency,
      completeness,
      sourceNote: 'Ride request payment status and recorded quote only. No provider transaction readback is attached.',
    };
  }).sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt));
}

export function paymentLaneCounts(rows: PaymentCenterRow[]) {
  return rows.reduce<Record<PaymentLane, number>>((counts, row) => ({ ...counts, [row.lane]: counts[row.lane] + 1 }), { awaiting_payment: 0, paid: 0, failed: 0, refunded: 0, not_requested: 0 });
}

export function recordedPaidTotalsByCurrency(rows: PaymentCenterRow[]) {
  const totals = new Map<string, number>();
  let missingCurrencyCount = 0;
  rows.filter((row) => row.lane === 'paid' && row.amount !== null).forEach((row) => {
    if (!row.currency) { missingCurrencyCount += 1; return; }
    totals.set(row.currency, (totals.get(row.currency) ?? 0) + (row.amount ?? 0));
  });
  return { totals: [...totals.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => a.currency.localeCompare(b.currency)), missingCurrencyCount };
}
