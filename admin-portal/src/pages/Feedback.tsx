import { useCallback,useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight,Check,MessageSquareText,RefreshCw,Star } from 'lucide-react';
import { StatePanel } from '../components/StatePanel';
import { listGuestFeedback,reviewGuestFeedback,type GuestFeedback } from '../features/feedback/repository';
import { formatDateTime } from '../lib/selectors';

export function Feedback(){
 const [items,setItems]=useState<GuestFeedback[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(''),[message,setMessage]=useState(''),[filter,setFilter]=useState('all');
 const load=useCallback(async()=>{setLoading(true);setError('');try{setItems(await listGuestFeedback())}catch(e){setError(e instanceof Error?e.message:'Feedback could not be loaded.')}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 async function review(item:GuestFeedback,decision:'approved'|'rejected'){
  if(busy)return;
  if(!window.confirm(decision==='approved'?'Approve this comment for the website? The guest has agreed to share it.':'Keep this comment off the website? The star rating will still count.'))return;
  setBusy(item.id);setMessage('');try{await reviewGuestFeedback(item,decision);setMessage(decision==='approved'?'Comment approved. Public display also depends on the website feedback connection.':'Comment kept off the website. Its star rating is unchanged.');await load()}catch(e){setMessage(e instanceof Error?e.message:'Review could not be saved.')}finally{setBusy('')}
 }
 const pending=items.filter(i=>i.visibility==='public_with_consent'&&i.moderation_status==='pending'),visible=items.filter(i=>filter==='all'||(filter==='pending'?pending.includes(i):i.visibility==='private'));
 return <div className="page feedback-owner-page">
  <header className="page-head"><div><h1>Guest feedback</h1><p>Every rating matters. Only comments shared with permission can appear on the website.</p></div><button className="desk-icon-action" onClick={()=>void load()} disabled={loading} aria-label="Refresh feedback"><RefreshCw aria-hidden/></button></header>
  <nav className="desk-view-switch" aria-label="Feedback filter">{[['all','All feedback'],['pending',`To review (${pending.length})`],['private','Private']].map(([value,label])=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</nav>
  {message&&<p role="status" className="request-message">{message}</p>}
  {loading?<StatePanel kind="loading" title="Loading guest feedback"/>:error?<StatePanel kind="error" title="Feedback unavailable" body={error} retry={()=>void load()}/>:!visible.length?<div className="desk-feedback-empty"><MessageSquareText aria-hidden/><h2>{filter==='pending'?'Nothing waiting for review':'No feedback here yet'}</h2><p>After a paid ride is completed, the thank-you email includes a private rating link. Feedback appears here when a guest submits it.</p><Link to="/communications">Check message history <ArrowUpRight aria-hidden/></Link></div>:<ol className="desk-feedback-list">{visible.map(item=><li key={item.id}><header><span className="desk-stars" aria-label={`${item.stars} out of 5 stars`}>{[1,2,3,4,5].map(n=><Star key={n} aria-hidden fill={n<=item.stars?'currentColor':'none'}/>)}</span><time>{formatDateTime(item.created_at)}</time></header><blockquote>{item.comment||'Star rating only. No written comment.'}</blockquote><footer><span>{item.visibility==='private'?'Private · never published':item.moderation_status==='approved'?'Approved for public display':item.moderation_status==='rejected'?'Not shown publicly':'Guest agreed to share'}</span><Link to={'/requests/'+item.ride_request_id}>Ride details <ArrowUpRight aria-hidden/></Link></footer>{item.visibility==='public_with_consent'&&item.moderation_status==='pending'&&<div className="desk-feedback-actions"><button className="button primary" disabled={Boolean(busy)} onClick={()=>void review(item,'approved')}><Check aria-hidden/>Approve comment</button><button className="desk-text-action" disabled={Boolean(busy)} onClick={()=>void review(item,'rejected')}>Keep off website</button></div>}</li>)}</ol>}
 </div>;
}
