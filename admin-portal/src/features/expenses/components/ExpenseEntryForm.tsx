import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { applyMerchantRule, categoryLabels, classificationLabels, matchMerchantRule } from '../domain';
import { expenseCategories, type ExpenseDraft, type MerchantRule } from '../types';
import { businessDateKey } from '../../../lib/business-date';

export const emptyExpenseDraft = (now = new Date()): ExpenseDraft => ({
  occurredOn: businessDateKey(now),
  merchant: '',
  description: '',
  amount: 0,
  category: 'needs_review',
  classification: 'business',
  businessUsePercent: 100,
  paymentMethod: '',
  notes: '',
  receipt: { state: 'missing' },
});

export function ExpenseEntryForm({ rules, onAdd, initial }: { rules: MerchantRule[]; onAdd: (draft: ExpenseDraft) => Promise<void>; initial?:ExpenseDraft }) {
  const [draft, setDraft] = useState(()=>initial||emptyExpenseDraft());
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const matchedRule = useMemo(() => matchMerchantRule(draft.merchant, rules), [draft.merchant, rules]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.merchant.trim() || !Number.isFinite(draft.amount) || draft.amount <= 0) return;
    if(busy)return;setBusy(true);setError('');
    try{await onAdd(applyMerchantRule({ ...draft, merchant: draft.merchant.trim(), amount: Math.abs(draft.amount) }, rules))}catch(e){setError(e instanceof Error?e.message:'Expense could not be saved.')}finally{setBusy(false)}
  }

  return <form className="expense-entry" onSubmit={submit}>

    <fieldset disabled={busy} className="expense-form-grid">
      <label><span>Date</span><input type="date" required value={draft.occurredOn} onChange={(event) => setDraft({ ...draft, occurredOn: event.target.value })}/></label>
      <label className="expense-field-wide"><span>Merchant</span><input required value={draft.merchant} onChange={(event) => setDraft({ ...draft, merchant: event.target.value })} placeholder="Business or vendor"/>{matchedRule && <small>Rule match: {categoryLabels[matchedRule.category]} · {classificationLabels[matchedRule.classification]}</small>}</label>
      <label><span>Amount</span><div className="expense-money-input"><b aria-hidden>$</b><input aria-label="Amount" required min="0.01" step="0.01" inputMode="decimal" type="number" value={draft.amount || ''} onChange={(event) => setDraft({ ...draft, amount: Number(event.target.value) })}/></div></label>
      <label><span>Category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as ExpenseDraft['category'] })}>{expenseCategories.map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select></label>
      <label><span>Use</span><select value={draft.classification} onChange={(event) => setDraft({ ...draft, classification: event.target.value as ExpenseDraft['classification'], businessUsePercent: event.target.value === 'business' ? 100 : event.target.value === 'personal' ? 0 : draft.businessUsePercent || 50 })}>{Object.entries(classificationLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label><span>Business use</span><div className="expense-percent-input"><input type="number" min="0" max="100" step="1" value={draft.businessUsePercent} disabled={draft.classification !== 'mixed'} onChange={(event) => setDraft({ ...draft, businessUsePercent: Number(event.target.value) })}/><b aria-hidden>%</b></div></label>
      <label className="expense-field-wide"><span>Description</span><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What was purchased?"/></label>
      <label><span>Payment method</span><input value={draft.paymentMethod} onChange={(event) => setDraft({ ...draft, paymentMethod: event.target.value })} placeholder="Optional"/></label>
      <label className="expense-field-full"><span>Owner note</span><textarea rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="Optional context for review"/></label>
    </fieldset>
    {error&&<p role="alert" className="ledger-error">{error}</p>}
    <button className="button primary" type="submit" disabled={busy}><Plus aria-hidden/>{busy?'Saving…':'Save expense'}</button>
  </form>;
}
