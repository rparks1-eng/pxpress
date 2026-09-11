import { describe, expect, it } from 'vitest';
import { demoEvents, demoRequests } from '../../demo-data';
import { buildCommunicationHistory, communicationStatus, messageTemplatePreviews } from './domain';

describe('communications center domain', () => {
  it('does not turn unrelated audit history into communication history', () => {
    expect(buildCommunicationHistory(demoRequests, demoEvents)).toEqual([]);
  });

  it('includes only recorded communication lifecycle effects', () => {
    const request = { ...demoRequests[0], lifecycleEffects: [
      { id: 'message-effect', effectType: 'customer_request_acknowledgement' as const, state: 'delivered' as const, enabledSnapshot: true, attemptCount: 1, maxAttempts: 4, deliveredAt: '2026-08-29T13:19:00Z', updatedAt: '2026-08-29T13:19:00Z' },
      { id: 'calendar-effect', effectType: 'tentative_calendar' as const, state: 'held' as const, enabledSnapshot: false, attemptCount: 0, maxAttempts: 4, updatedAt: '2026-08-29T13:19:00Z' },
    ] };
    expect(buildCommunicationHistory([request], [])).toHaveLength(1);
    expect(buildCommunicationHistory([request], [])[0]).toMatchObject({ id: 'message-effect', state: 'delivered', enabledWhenRecorded: true });
  });

  it('keeps standardized templates in preview-only state with Pxpress casing', () => {
    expect(messageTemplatePreviews.every((template) => template.status === 'preview_only')).toBe(true);
    expect(messageTemplatePreviews.every((template) => !/PXPress|PXPRESS/.test(`${template.subject} ${template.preview}`))).toBe(true);
  });

  it('matches the canonical lifecycle subjects and payment action', () => {
    expect(messageTemplatePreviews.find((template) => template.key === 'payment-ready')).toMatchObject({
      subject: 'Your Pxpress payment link',
      actionLabel: 'Pay securely',
    });
    expect(messageTemplatePreviews.find((template) => template.key === 'payment-receipt')).toMatchObject({
      subject: 'Pxpress payment received',
    });
    expect(messageTemplatePreviews.find((template) => template.key === 'feedback-receipt')).toMatchObject({
      subject: 'Thank you for your Pxpress feedback',
    });
  });

  it('includes owner paid alerts without treating provider acceptance as delivery', () => {
    const request = { ...demoRequests[0], lifecycleEffects: [
      { id: 'owner-paid', effectType: 'owner_payment_notification' as const, state: 'reconciliation_required' as const, enabledSnapshot: true, attemptCount: 1, maxAttempts: 4, updatedAt: '2026-09-07T00:00:00Z' },
    ] };
    const [row] = buildCommunicationHistory([request], []);
    expect(row).toMatchObject({ label: 'Owner payment alert', state: 'reconciliation_required', attemptCount: 1 });
    expect(communicationStatus(row.state)).toMatchObject({ label: 'Checking outcome' });
    expect(communicationStatus(row.state).detail).toMatch(/before any resend/);
    expect(communicationStatus('delivered').detail).toMatch(/does not verify Inbox/);
  });

  it('distinguishes proposed messages and does not infer sending from an audit entry', () => {
    expect(messageTemplatePreviews.filter(template => template.availability === 'proposed').map(template => template.key)).toEqual(['request-declined', 'request-cancelled']);
    const [row] = buildCommunicationHistory(demoRequests, [{ id: 'synthetic-email-audit', requestId: demoRequests[0].id, actor: 'Synthetic owner', action: 'Email prepared', detail: 'Prepared only', at: '2026-09-07T00:00:00Z' }]);
    expect(communicationStatus(row.state).label).toBe('Activity recorded');
    expect(row.state).not.toBe('delivered');
  });
});
