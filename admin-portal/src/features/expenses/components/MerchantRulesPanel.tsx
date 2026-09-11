import { Plus, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { categoryLabels, classificationLabels } from '../domain';
import { expenseCategories, type MerchantRule } from '../types';

const newRule = (): Omit<MerchantRule, 'id'> => ({ merchantPattern: '', matchType: 'contains', category: 'needs_review', classification: 'business', businessUsePercent: 100, enabled: true });

export function MerchantRulesPanel({ rules, onAdd }: { rules: MerchantRule[]; onAdd: (rule: Omit<MerchantRule, 'id'>) => void }) {
  const [draft, setDraft] = useState(newRule);
  function submit(event: React.FormEvent) { event.preventDefault(); if (!draft.merchantPattern.trim()) return; onAdd({ ...draft, merchantPattern: draft.merchantPattern.trim() }); setDraft(newRule()); }
  return <section className="expense-card merchant-rules" aria-labelledby="merchant-rules-title">
    <div className="expense-section-heading"><div><p className="eyebrow">Owner rules</p><h2 id="merchant-rules-title">Merchant categorization</h2></div><Sparkles aria-hidden/></div>
    <p className="expense-card-copy">Rules suggest a category when a manual entry matches. Every new transaction still enters owner review.</p>
    <div className="rule-list">{rules.map((rule) => <div key={rule.id}><strong>{rule.merchantPattern}</strong><span>{rule.matchType.replace('_', ' ')} · {categoryLabels[rule.category]} · {classificationLabels[rule.classification]}</span></div>)}</div>
    <form onSubmit={submit} className="rule-form">
      <label><span>Merchant pattern</span><input required value={draft.merchantPattern} onChange={(event) => setDraft({ ...draft, merchantPattern: event.target.value })} placeholder="Example: Shell"/></label>
      <label><span>Match</span><select value={draft.matchType} onChange={(event) => setDraft({ ...draft, matchType: event.target.value as MerchantRule['matchType'] })}><option value="contains">Contains</option><option value="starts_with">Starts with</option><option value="exact">Exact</option></select></label>
      <label><span>Category</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as MerchantRule['category'] })}>{expenseCategories.map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select></label>
      <button className="button secondary" type="submit"><Plus aria-hidden/> Add rule</button>
    </form>
  </section>;
}
