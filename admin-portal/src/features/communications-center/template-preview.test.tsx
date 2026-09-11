import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { messageTemplatePreviews } from './domain';
import { TemplatePreview } from './TemplatePreview';
import { renderSampleTemplate } from './template-preview';

describe('actual sample email previews', () => {
  it('renders every implemented design and preserves proposed gaps', () => {
    for (const template of messageTemplatePreviews) {
      const result = renderSampleTemplate(template.key);
      if (template.availability === 'proposed') expect(result).toBeNull();
      else {
        expect(result?.html).toContain('<!doctype html>');
        expect(result?.html).toContain('SAMPLE-0001');
        expect(result?.recipient).toBe('sample@example.invalid');
      }
    }
  });

  it('uses canonical wording and distinct day/night versions', () => {
    expect(renderSampleTemplate('payment-ready')?.subject).toBe('Your Pxpress quote and secure payment link');
    expect(renderSampleTemplate('post-ride-thank-you')?.text).toContain('serving you today');
    expect(renderSampleTemplate('post-ride-thank-you-night')?.text).toContain('serving you this evening');
    expect(renderSampleTemplate('feedback-receipt')?.availabilityNote).toContain('remains disabled');
  });

  it('allows only fixed branding images and makes the rendered document inert', () => {
    const doc = new DOMParser().parseFromString(renderSampleTemplate('payment-ready')!.html, 'text/html');
    expect(doc.body.hasAttribute('inert')).toBe(true);
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("default-src 'none'");
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("form-action 'none'");
    expect(doc.querySelector('script')).toBeNull();
    expect(doc.body.textContent).toContain('Hi Sample,');
    expect(doc.body.textContent).not.toContain('Hi Sample guest,');
    expect(doc.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer');
    expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain('img-src https://static.wixstatic.com https://pxpressllc.com;');
    for (const [key, period] of [['post-ride-thank-you', 'day'], ['post-ride-thank-you-night', 'night']]) {
      const sample = new DOMParser().parseFromString(renderSampleTemplate(key)!.html, 'text/html');
      expect(sample.querySelector('.hero img')?.getAttribute('src')).toBe(`https://pxpressllc.com/email-assets/pxpress-thank-you-${period}-no-qr.png`);
    }
  });

  it('shows the actual document only on expansion inside an empty sandbox', () => {
    const { container } = render(<TemplatePreview template={messageTemplatePreviews[0]}/>);
    expect(container.querySelector('iframe')).toBeNull();
    const details = container.querySelector('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    const iframe = screen.getByTitle('Request received sample email');
    expect(iframe).toHaveAttribute('sandbox', '');
    expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(iframe.getAttribute('srcdoc')).toContain('We received your request.');
    expect(screen.getByRole('button', { name: 'Sending unavailable' })).toBeDisabled();
    expect(screen.getByText(/not a retained sent message/)).toBeInTheDocument();
  });
});
