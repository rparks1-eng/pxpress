import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import type { MessageTemplatePreview } from './domain';
import { renderSampleTemplate } from './template-preview';

export function TemplatePreview({ template }: { template: MessageTemplatePreview }) {
  const [open, setOpen] = useState(false);
  const sample = renderSampleTemplate(template.key);
  return <details onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span><strong>{template.label}</strong><small>{template.audience} · {sample ? 'sample email design' : 'proposed message'}</small></span><MessageSquareText aria-hidden/></summary>
    <div>
      <p className="template-subject">Subject: {sample?.subject ?? template.subject}</p>
      {sample ? <>
        <p>Shared email design with fictional details. This is not a retained sent message; delivery-worker copy can differ. Links are inactive. Public Pxpress branding images load without a referrer.</p>
        {sample.availabilityNote && <p className="template-availability">{sample.availabilityNote}</p>}
        {template.key.startsWith('post-ride-thank-you') && <p>The matching public day or evening artwork is shown; this does not verify the sending service’s current image configuration.</p>}
        {open && <iframe className="template-email-frame" title={`${template.label} sample email`} sandbox="" referrerPolicy="no-referrer" srcDoc={sample.html}/>}
        <details className="template-plain-text"><summary>Read plain text</summary><pre>{sample.text}</pre></details>
      </> : <><p>{template.preview}</p><p>No implemented email template or automatic sending workflow is available for this proposed message.</p></>}
      <button type="button" disabled title="Messaging is not enabled from this preview">Sending unavailable</button>
    </div>
  </details>;
}
