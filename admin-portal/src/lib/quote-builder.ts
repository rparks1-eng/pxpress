export type QuoteBreakdown = {
  baseFare: number;
  overnight: number;
  waitingTime: number;
  parking: number;
  tolls: number;
  additionalStop: number;
  oversizedItem: number;
  discount: number;
  deposit: number;
};

export const emptyQuoteBreakdown = (baseFare = 0): QuoteBreakdown => ({
  baseFare,
  overnight: 0,
  waitingTime: 0,
  parking: 0,
  tolls: 0,
  additionalStop: 0,
  oversizedItem: 0,
  discount: 0,
  deposit: 0,
});

export const quoteCustomerTotal = (quote: QuoteBreakdown) => Math.max(0,
  quote.baseFare + quote.overnight + quote.waitingTime + quote.parking + quote.tolls + quote.additionalStop + quote.oversizedItem - quote.discount,
);

export function validateQuoteBreakdown(quote: QuoteBreakdown) {
  const entries = Object.entries(quote);
  if (entries.some(([, value]) => !Number.isFinite(value) || value < 0)) return 'Use zero or a positive amount for every quote item.';
  const total = quoteCustomerTotal(quote);
  if (total <= 0) return 'The customer total must be greater than $0.';
  if (quote.deposit > total) return 'The planned deposit cannot be greater than the customer total.';
  return '';
}

