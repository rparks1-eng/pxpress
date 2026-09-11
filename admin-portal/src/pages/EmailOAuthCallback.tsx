import {useEffect,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {completeOwnerGmailOAuth} from '../features/email-center/supabase-provider';

export function EmailOAuthCallback(){
  const[params]=useSearchParams(),started=useRef(false),[state,setState]=useState<'working'|'paused'|'error'>('working'),[message,setMessage]=useState('Verifying the exact Pxpress Gmail account…');
  useEffect(()=>{if(started.current)return;started.current=true;const code=params.get('code')||'',oauthState=params.get('state')||'',providerError=params.get('error');if(providerError||!code||!oauthState){setState('error');setMessage('Google did not return a valid authorization. Nothing was connected.');return}void completeOwnerGmailOAuth(code,oauthState).then(()=>{setState('paused');setMessage('Google authorization was verified and stored securely. Email remains paused until the owner explicitly enables each capability.');history.replaceState({},'',location.pathname)}).catch(error=>{setState('error');setMessage(error instanceof Error?error.message:'Google authorization could not be verified. Nothing was enabled.');history.replaceState({},'',location.pathname)})},[params]);
  return <main className="auth-page"><section className="auth-card" aria-live="polite"><p className="eyebrow">Owner email</p><h1>{state==='working'?'Securing Gmail':state==='paused'?'Connected, still paused':'Connection not completed'}</h1><p>{message}</p><Link className="button primary" to="/email">Return to Email Center</Link></section></main>;
}
