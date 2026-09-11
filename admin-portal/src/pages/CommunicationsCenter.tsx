import { FileText, LockKeyhole, MailCheck, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import {useState} from 'react';
import { StatePanel } from '../components/StatePanel';
import { useEvents, useRequests } from '../hooks';
import { buildCommunicationHistory, communicationStatus, messageTemplatePreviews } from '../features/communications-center/domain';
import { formatDateTime } from '../lib/selectors';
import { TemplatePreview } from '../features/communications-center/TemplatePreview';
import '../features/communications-center/communications-center.css';

export function CommunicationsCenter() {
  const requests = useRequests();
  const events = useEvents();
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(0);
  if (requests.loading || events.loading) return <StatePanel kind="loading" title="Loading communication records"/>;
  if (requests.error) return <StatePanel kind="error" title="Communication records could not be loaded" body={requests.error} retry={requests.reload}/>;
  if (events.error) return <StatePanel kind="error" title="Communication history could not be loaded" body={events.error} retry={events.reload}/>;
  const history = buildCommunicationHistory(requests.data, events.data);
  const delivered = history.filter((row) => row.state === 'delivered').length;
  const needsAttention = history.filter((row) => ['dead_letter', 'reconciliation_required'].includes(row.state)).length;
  const filtered=history.filter(row=>(`${row.customerName} ${row.requestNumber} ${row.label}`).toLowerCase().includes(query.toLowerCase())&&(filter==='all'||(filter==='attention'?['dead_letter','reconciliation_required'].includes(row.state):row.state==='delivered')));
  const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/6)-1)),visible=filtered.slice(currentPage*6,currentPage*6+6);
  return <div className="page communications-page">
    <header className="page-head"><div><h1>Customer emails</h1><p>See what was prepared, what needs attention, and what has a delivery record.</p></div><span className="communications-send-state"><LockKeyhole aria-hidden/> Read-only history</span></header>
    <section className="communications-rail"><div><span>Recorded entries</span><strong>{history.length}</strong><small>Message records and matching activity</small></div><div><span>Delivery recorded</span><strong>{delivered}</strong><small>Inbox placement is unverified</small></div><div><span>Needs attention</span><strong>{needsAttention}</strong><small>Stopped attempts or unconfirmed outcomes</small></div><div><span>Template previews</span><strong>{messageTemplatePreviews.length}</strong><small>Never counted as sent</small></div></section>
    <aside className="communications-boundary"><ShieldAlert aria-hidden/><div><strong>Prepared does not mean sent</strong><span>Queued messages are waiting for an attempt. A sending service accepting an email does not prove delivery to the receiving server or Inbox. This page does not resend messages or change your email settings.</span></div></aside>
    <section className="communications-layout">
      <article className="communications-card communications-history"><header><div><h2>Delivery history</h2></div><MailCheck aria-hidden/></header><div className="communication-filters"><input aria-label="Search delivery history" placeholder="Guest, request or message" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/><select aria-label="Filter delivery history" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}><option value="all">All messages</option><option value="attention">Needs attention</option><option value="delivered">Delivery recorded</option></select></div>{filtered.length ? <div>{visible.map((row) => {
        const status = communicationStatus(row.state);
        return <details className="communication-entry" key={`${row.channel}-${row.id}`}><summary><span><strong>{row.customerName}</strong><small>{row.label}</small></span><b>{status.label}</b></summary><div><small>{row.requestNumber} · {formatDateTime(row.at)}</small><p>{status.detail}</p><small>{row.attemptCount!==undefined?`${row.attemptCount} attempts recorded`: 'Activity entry'}</small><Link to={`/requests/${row.requestId}`}>Open request</Link></div></details>;
      })}</div> : <p className="communications-empty">No messages in this view.</p>}<nav className="communication-paging" aria-label="Delivery history pages"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><span>{filtered.length?`${currentPage*6+1}–${Math.min(currentPage*6+6,filtered.length)} of ${filtered.length}`:'0 messages'}</span><button disabled={(currentPage+1)*6>=filtered.length} onClick={()=>setPage(currentPage+1)}>Next</button></nav></article>
      <article className="communications-card communications-previews"><header><div><p className="eyebrow">Sample email designs</p><h2>Template previews</h2></div><FileText aria-hidden/></header><p className="template-preview-boundary">Open a template to see the rendered email with fictional details. These are not copies of sent emails and do not establish that automatic sending is active.</p><div>{messageTemplatePreviews.map((template) => <TemplatePreview key={template.key} template={template}/>)}</div></article>
    </section>
  </div>;
}
