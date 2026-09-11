import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {ownerEmailMemoryCache} from './features/email-center/memory-cache';

export type OwnerMfaState={
  currentLevel:string|null;
  nextLevel:string|null;
  verifiedFactorId:string|null;
  verifiedFactors?:Array<{id:string;name:string}>;
  readStatus:'ready'|'loading'|'unavailable';
  error:string|null;
};
export type OwnerMfaEnrollment={factorId:string;qrCode:string;setupKey?:string};
type AuthValue={
  user:User|null;
  loading:boolean;
  configured:boolean;
  mfa:OwnerMfaState;
  signIn:(email:string,password:string)=>Promise<string|null>;
  signOut:()=>Promise<string|null>;
  signOutPending:boolean;
  signOutError:string|null;
  clearSignOutError:()=>void;
  startMfaEnrollment:()=>Promise<{data:OwnerMfaEnrollment|null;error:string|null}>;
  startAdditionalMfaEnrollment:(deviceName:string)=>Promise<{data:OwnerMfaEnrollment|null;error:string|null}>;
  verifyMfa:(factorId:string,code:string)=>Promise<string|null>;
  refreshMfa:()=>Promise<void>;
  authError:string|null;
  retryAuth:()=>Promise<void>;
};
const emptyMfa:OwnerMfaState={currentLevel:null,nextLevel:null,verifiedFactorId:null,readStatus:'ready',error:null};
const loadingMfa:OwnerMfaState={...emptyMfa,readStatus:'loading'};
const unavailableMfa=(message:string):OwnerMfaState=>({...emptyMfa,readStatus:'unavailable',error:message});
const elevated=(level:string|null)=>level==='aal2'||level==='aal3';
async function readOwnerMfaState():Promise<OwnerMfaState>{
 if(!supabase)throw new Error('Owner verification is not connected.');
 const [{data:levels,error:levelsError},{data:factors,error:factorsError}]=await Promise.all([
  supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  supabase.auth.mfa.listFactors(),
 ]);
 if(levelsError||factorsError)throw levelsError||factorsError;
 const verified=[...(factors?.totp||[]),...(factors?.phone||[])].find(factor=>factor.status==='verified');
 return{currentLevel:levels?.currentLevel||null,nextLevel:levels?.nextLevel||null,verifiedFactorId:verified?.id||null,verifiedFactors:(factors?.totp||[]).filter(factor=>factor.status==='verified').map((factor,index)=>({id:factor.id,name:factor.friendly_name||`Authenticator ${index+1}`})),readStatus:'ready',error:null};
}
const AuthContext=createContext<AuthValue|null>(null);
export function AuthProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null),[loading,setLoading]=useState(true),[mfa,setMfa]=useState<OwnerMfaState>(emptyMfa),[authError,setAuthError]=useState<string|null>(null),[signOutPending,setSignOutPending]=useState(false),[signOutError,setSignOutError]=useState<string|null>(null);
 const signOutLock=useRef(false);
 const pendingEnrollmentIds=useRef(new Set<string>());
 useEffect(()=>{pendingEnrollmentIds.current.clear()},[user?.id]);
 const enrollmentLock=useRef(false);
 const enrollAuthenticator=useCallback(async(additional:boolean,deviceName='Pxpress Owner Desk')=>{
  if(!supabase)return{data:null,error:'Supabase is not configured.'};
  if(enrollmentLock.current)return{data:null,error:'Authenticator setup is already starting.'};
  enrollmentLock.current=true;
  try{
   const current=await readOwnerMfaState();
   if(additional&&(!current.verifiedFactorId||!elevated(current.currentLevel)))return{data:null,error:'Verify your existing authenticator before adding another device.'};
   if(!additional&&current.verifiedFactorId)return{data:null,error:'An authenticator is already connected. Verify it before adding another device.'};
   const name=deviceName.trim();
   if(!name||name.length>48)return{data:null,error:'Enter a device name between 1 and 48 characters.'};
   const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:additional?`${name} ${crypto.randomUUID().slice(0,8)}`:name});
   if(error||!data?.id||!data.totp?.qr_code)return{data:null,error:'Could not add the authenticator. Check your connection and available authenticator slots.'};
   pendingEnrollmentIds.current.add(data.id);
   return{data:{factorId:data.id,qrCode:data.totp.qr_code,setupKey:data.totp.secret},error:null};
  }catch{return{data:null,error:'Authenticator setup could not be started. Check the connection and try again.'}}finally{enrollmentLock.current=false}
 },[]);
 const refreshMfa=useCallback(async()=>{
  if(!supabase){setMfa(unavailableMfa('Owner verification is not connected.'));return;}
  setMfa(loadingMfa);
  try{
   setMfa(await readOwnerMfaState());
  }catch{
   setMfa(unavailableMfa('Owner verification could not be checked. Try again before opening private records.'));
  }
 },[]);
 const retryAuth=useCallback(async()=>{
  setLoading(true);setAuthError(null);
  if(!supabase){setLoading(false);return;}
  try{
   const {data,error}=await supabase.auth.getSession();
   if(error)throw error;
   const nextUser=data.session?.user||null;
   setUser(nextUser);
   if(nextUser)await refreshMfa();else setMfa(emptyMfa);
  }catch{
   setUser(null);setMfa(emptyMfa);
   setAuthError('Owner sign-in could not be verified. Check the connection and try again.');
  }finally{setLoading(false)}
 },[refreshMfa]);
 const clearSignOutError=useCallback(()=>setSignOutError(null),[]);
 const signOut=useCallback(async()=>{
  if(signOutLock.current)return 'Sign out is already in progress.';
  signOutLock.current=true;setSignOutPending(true);setSignOutError(null);
  try{
   if(supabase){const {error}=await supabase.auth.signOut();if(error)throw error;}
   ownerEmailMemoryCache.clearAll();
   pendingEnrollmentIds.current.clear();
   setUser(null);setMfa(emptyMfa);setAuthError(null);
   return null;
  }catch{
   const message='Sign out could not be completed. Check the connection and try again.';
   setSignOutError(message);
   return message;
  }finally{signOutLock.current=false;setSignOutPending(false)}
 },[]);
 useEffect(()=>{
  if(!supabase){setLoading(false);return;}
  void retryAuth();
  const {data}=supabase.auth.onAuthStateChange((_e,s)=>{setAuthError(null);setUser(s?.user||null);if(!s?.user){ownerEmailMemoryCache.clearAll();setMfa(emptyMfa);setSignOutError(null)}else queueMicrotask(()=>void refreshMfa())});
  return()=>data.subscription.unsubscribe();
 },[refreshMfa,retryAuth]);
 const value=useMemo<AuthValue>(()=>({
  user,loading,configured:isSupabaseConfigured,mfa,authError,retryAuth,signOut,signOutPending,signOutError,clearSignOutError,
  signIn:async(email,password)=>{if(!supabase)return 'Supabase is not configured.';try{const {error}=await supabase.auth.signInWithPassword({email,password});if(!error)await refreshMfa();return error?.message||null}catch{return 'Sign-in could not be completed. Check the connection and try again.'}},
  startMfaEnrollment:()=>enrollAuthenticator(false),
  startAdditionalMfaEnrollment:(deviceName)=>enrollAuthenticator(true,deviceName),
  verifyMfa:async(factorId,code)=>{
   if(!supabase)return'Supabase is not configured.';
   const clean=code.replace(/\s+/g,'');
   if(!/^\d{6}$/.test(clean))return'Enter the six-digit code from your authenticator app.';
   try{
    const {data:factors,error:factorError}=await supabase.auth.mfa.listFactors();
    if(factorError)throw factorError;
    if(![...(factors?.totp||[]),...(factors?.phone||[])].some(factor=>factor.id===factorId&&factor.status==='verified')&&!pendingEnrollmentIds.current.has(factorId))return'Choose a connected authenticator or start a new setup.';
    const {error}=await supabase.auth.mfa.challengeAndVerify({factorId,code:clean});
    if(error)return'That code could not be verified. Check the current code and try again.';
    let verifiedState=await readOwnerMfaState();
    if(!elevated(verifiedState.currentLevel)){
     const {error:refreshError}=await supabase.auth.refreshSession();
     if(refreshError)throw refreshError;
     verifiedState=await readOwnerMfaState();
    }
    if(!elevated(verifiedState.currentLevel)||!(verifiedState.verifiedFactors?.some(factor=>factor.id===factorId)||verifiedState.verifiedFactorId===factorId)){
     setMfa(unavailableMfa('Identity verification did not finish. Request a new code and try again.'));
     return'Identity verification did not finish. Request a new code and try again.';
    }
    setMfa(verifiedState);
    pendingEnrollmentIds.current.delete(factorId);
    return null;
   }catch{
    setMfa(unavailableMfa('Owner verification could not be confirmed. Try again before opening private records.'));
    return'Verification could not be completed. Check the connection and try again.';
   }
  },
  refreshMfa,
 }),[user,loading,mfa,authError,refreshMfa,retryAuth,signOut,signOutPending,signOutError,clearSignOutError,enrollAuthenticator]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth=()=>{const ctx=useContext(AuthContext);if(!ctx)throw new Error('AuthProvider missing');return ctx};
export const useOptionalAuth=()=>useContext(AuthContext);
