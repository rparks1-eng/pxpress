import { Paperclip, Receipt } from 'lucide-react';
import { receiptMetadataFromFile } from '../domain';
import type { ExpenseTransaction } from '../types';

export function ReceiptQueue({ transactions, onAttach }: { transactions: ExpenseTransaction[]; onAttach: (id: string, receipt: ExpenseTransaction['receipt']) => void }) {
  return <section className="expense-card receipt-queue" aria-labelledby="receipt-queue-title">
    <div className="expense-section-heading"><div><p className="eyebrow">Documentation</p><h2 id="receipt-queue-title">Missing receipts</h2></div><strong>{transactions.length} missing</strong></div>
    <p className="expense-card-copy">Choose a file to retain its name, type, and size in this local preview. No receipt leaves this device because storage is not configured.</p>
    {transactions.length === 0 ? <p className="expense-empty">No receipt gaps in the current review set.</p> : <div className="receipt-list">{transactions.map((transaction) => <label key={transaction.id}>
      <Receipt aria-hidden/><span><strong>{transaction.merchant}</strong><small>{transaction.occurredOn} · ${transaction.amount.toFixed(2)}</small></span><b><Paperclip aria-hidden/> Add metadata</b>
      <input className="sr-only" type="file" accept="image/*,application/pdf" onChange={(event) => onAttach(transaction.id, receiptMetadataFromFile(event.currentTarget.files?.[0]))}/>
    </label>)}</div>}
  </section>;
}
