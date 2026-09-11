import {useEffect,useRef,useState,type MouseEvent} from 'react';
import type {RideRequest} from '../types';
import {readPresentableLink,releaseTarget,sameReleaseTarget,type QuoteReleaseResult as Result} from '../lib/quote-release-result';

export function QuoteReleaseResult({result,request,ownerId}:{result:Result;request:RideRequest;ownerId:string|undefined}){
  const [,tick]=useState(0),[copyState,setCopyState]=useState<'idle'|'copying'|'copied'|'failed'>('idle');
  const copyLock=useRef(false),active=useRef(true);
  const target=releaseTarget(request,ownerId);
  const contextMatches=sameReleaseTarget(result.target,target);
  const url=readPresentableLink(result,target);
  function guardOpen(event:MouseEvent<HTMLAnchorElement>){
    if(!readPresentableLink(result,releaseTarget(request,ownerId))){event.preventDefault();tick(n=>n+1)}
  }
  useEffect(()=>{
    active.current=true;
    if(!('expiresAt' in result))return()=>{active.current=false};
    const timer=setTimeout(()=>tick(n=>n+1),Math.max(0,result.expiresAt-Date.now()));
    const refresh=()=>tick(n=>n+1);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{active.current=false;clearTimeout(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)};
  },[result]);
  async function copy(){
    if(copyLock.current)return;
    const current=readPresentableLink(result,releaseTarget(request,ownerId));
    if(!current){setCopyState('failed');return}
    copyLock.current=true;setCopyState('copying');
    try{
      if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');
      await navigator.clipboard.writeText(current);
      if(active.current)setCopyState('copied');
    }catch{if(active.current)setCopyState('failed')}
    finally{copyLock.current=false}
  }
  let title='Payment link unavailable',message='No verified payment link can be shown. Reconcile the outcome before retrying.';
  if(result.status==='pending'&&contextMatches){title='Payment link pending';message='The request is being checked. This is not a usable link or a sent email.'}
  if(result.status==='unavailable'&&result.reason==='review_expired'&&contextMatches){title='Review your saved quote';message='The sending window ended before completion. Review the same quote again to continue. Any previous activity will be checked before it resumes.'}
  if(result.status==='failed'&&contextMatches){title='Quote release failed or unconfirmed';message='The release result could not be confirmed. Do not repeat it until reconciled.'}
  if(result.status==='delivery_unknown'&&contextMatches){title='Email delivery unknown';message='No reliable delivery outcome is available. Reconcile before any resend.'}
  const emailVerified=contextMatches&&'expiresAt' in result&&Date.now()<result.expiresAt;
  if(result.status==='email_accepted'&&emailVerified){title='Email accepted by provider';message='The provider accepted this email. Delivery and Inbox placement are not confirmed.'}
  if(result.status==='delivered'&&emailVerified){title='Email delivery recorded';message='The provider recorded delivery. This does not prove Inbox placement, payment, or booking confirmation.'}
  if(!contextMatches){message='The current request, quote, recipient or owner changed. This result cannot be used.'}
  if(result.status==='provider_verified_link'&&!url&&contextMatches){message='The verification expired or is no longer valid. This link cannot be used.'}
  return <section className="guard-note quote-release-result" aria-label="Quote release result">
    <div role="status"><strong>{url?'Provider-verified payment link':title}</strong><p>{url?'Verified for this current quote. This is not payment, ride confirmation, or an email delivery receipt.':message}</p>
      <p>Email: <strong>{emailVerified&&result.status==='email_accepted'?'PROVIDER ACCEPTED':emailVerified&&result.status==='delivered'?'DELIVERY RECORDED':contextMatches&&result.emailStatus==='unknown'?'UNKNOWN':'NOT SENT'}</strong> — {url?'this workflow requested no Wix email; separate email delivery is not confirmed.':emailVerified&&(result.status==='email_accepted'||result.status==='delivered')?'independent server readback; this screen did not send an email.':'delivery unconfirmed; not proof of zero external sends.'}</p>
    </div>
    {url&&<div>
      <a className="button secondary" href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={guardOpen} onAuxClick={guardOpen}>Open payment link</a>
      <button type="button" className="button secondary" disabled={copyState==='copying'} onClick={copy}>{copyState==='copying'?'Copying…':'Copy payment link'}</button>
      <p role="status">{copyState==='copied'?'Link copied. No email was sent.':copyState==='failed'?'Link could not be copied. No email was sent.':''}</p>
    </div>}
  </section>;
}
