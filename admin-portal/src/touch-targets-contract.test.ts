import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = (...parts: string[]) => readFileSync(join(process.cwd(), 'src', ...parts), 'utf8');

describe('owner action touch targets', () => {
  it('keeps local workflow delete actions at least 44 pixels', () => {
    const source = css('local-workflow.css');
    expect(source).toMatch(/\.local-block button\{[^}]*width:44px;[^}]*height:44px/);
    expect(source).toMatch(/\.manual-review-list header button\{width:44px;height:44px/);
  });
  it('keeps vehicle, expense, and payment actions at least 44 pixels', () => {
    expect(css('features', 'vehicle-records', 'vehicle-records.css')).toMatch(/\.vehicle-local-banner button,\.reminder-board article>button\{min-height:44px/);
    expect(css('features', 'expenses', 'expenses.css')).toMatch(/\.expense-local-banner button,\.review-controls \.button\{min-height:44px/);
    expect(css('features', 'payment-center', 'payment-center.css')).toMatch(/\.payment-record footer \.button\{min-height:44px/);
  });
});
