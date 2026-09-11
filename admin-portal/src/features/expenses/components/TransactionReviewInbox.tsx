import { Check, CircleDollarSign } from 'lucide-react';
import { categoryLabels, classificationLabels } from '../domain';
import { expenseCategories, type ExpenseClassification, type ExpenseTransaction } from '../types';

export function TransactionReviewInbox({ transactions, onChange, onReview }: {
  transactions: ExpenseTransaction[];
  onChange: (id: string, patch: Partial<ExpenseTransaction>) => void;
  onReview: (id: string) => void;
}) {
  return <section className="expense-card review-inbox" aria-labelledby="review-inbox-title">
    <div className="expense-section-heading"><div><p className="eyebrow">Decision queue</p><h2 id="review-inbox-title">Transaction review</h2></div><strong>{transactions.length} waiting</strong></div>
    {transactions.length === 0 ? <p className="expense-empty">Everything has an owner decision.</p> : <div className="review-list">{transactions.map((transaction) => <article key={transaction.id}>
      <header><div><CircleDollarSign aria-hidden/><span><strong>{transaction.merchant}</strong><small>{transaction.occurredOn} · ${transaction.amount.toFixed(2)}</small></span></div><i>Review</i></header>
      <div className="review-controls">
        <label><span>Category</span><select value={transaction.category} onChange={(event) => onChange(transaction.id, { category: event.target.value as ExpenseTransaction['category'] })}>{expenseCategories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
        <label><span>Use</span><select value={transaction.classification} onChange={(event) => { const classification = event.target.value as ExpenseClassification; onChange(transaction.id, { classification, businessUsePercent: classification === 'business' ? 100 : classification === 'personal' ? 0 : 50 }); }}>{Object.entries(classificationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" className="button primary" disabled={transaction.category === 'needs_review'} title={transaction.category === 'needs_review' ? 'Choose a specific category before marking this transaction reviewed.' : undefined} onClick={() => onReview(transaction.id)}><Check aria-hidden/> Mark reviewed</button>
      </div>
    </article>)}</div>}
  </section>;
}
