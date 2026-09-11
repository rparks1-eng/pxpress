import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach,describe,expect,it,vi } from 'vitest';

const authMocks=vi.hoisted(()=>({
 getSession:vi.fn(),
 refreshSession:vi.fn(),
 getAuthenticatorAssuranceLevel:vi.fn(),
 listFactors:vi.fn(),
 signInWithPassword:vi.fn(),
 enroll:vi.fn(),
 challengeAndVerify:vi.fn(),
 signOut:vi.fn(),
 unsubscribe:vi.fn(),
}));

vi.mock('./lib/supabase',()=>({
 isSupabaseConfigured:true,
 supabase:{auth:{
  getSession:authMocks.getSession,
  refreshSession:authMocks.refreshSession,
  onAuthStateChange:vi.fn(()=>({data:{subscription:{unsubscribe:authMocks.unsubscribe}}})),
  mfa:{
   getAuthenticatorAssuranceLevel:authMocks.getAuthenticatorAssuranceLevel,
   listFactors:authMocks.listFactors,
   enroll:authMocks.enroll,
   challengeAndVerify:authMocks.challengeAndVerify,
  },
  signInWithPassword:authMocks.signInWithPassword,
  signOut:authMocks.signOut,
 }},
}));

import { AuthProvider,useAuth } from './auth';

function AuthProbe(){
 const {loading,authError,mfa}=useAuth();
 return <><output aria-label="auth loading">{loading?'loading':'settled'}</output><output aria-label="auth error">{authError||'none'}</output><output aria-label="mfa status">{mfa.readStatus}</output><output aria-label="mfa factor">{mfa.verifiedFactorId||'none'}</output><output aria-label="mfa error">{mfa.error||'none'}</output></>;
}

function ActionProbe(){
 const {signIn,startMfaEnrollment,verifyMfa,signOut,signOutPending,signOutError,clearSignOutError}=useAuth();
 const [result,setResult]=useState('idle');
 return <><button onClick={async()=>setResult((await signIn('owner@example.com','password'))||'ok')}>Sign in action</button><button onClick={async()=>setResult((await startMfaEnrollment()).error||'ok')}>Enroll action</button><button onClick={async()=>setResult((await verifyMfa('factor-1','123456'))||'ok')}>Verify action</button><button onClick={async()=>setResult((await signOut())||'signed out')}>Sign out action</button><button onClick={clearSignOutError}>Clear sign-out error</button><output aria-label="action result">{result}</output><output aria-label="sign-out pending">{signOutPending?'pending':'settled'}</output><output aria-label="sign-out error">{signOutError||'none'}</output></>;
}

describe('owner auth settled-state behavior',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();
  authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:'aal1',nextLevel:'aal2'},error:null});
  authMocks.listFactors.mockResolvedValue({data:{totp:[],phone:[]},error:null});
  authMocks.signOut.mockResolvedValue({error:null});
  authMocks.refreshSession.mockResolvedValue({data:{session:{}},error:null});
 });

 it('settles loading and shows a safe error when the session read throws',async()=>{
  authMocks.getSession.mockRejectedValue(new Error('provider detail must not leak'));
  render(<AuthProvider><AuthProbe/></AuthProvider>);
  expect(await screen.findByText('settled')).toBeInTheDocument();
  expect(screen.getByLabelText('auth error')).toHaveTextContent('Owner sign-in could not be verified');
  expect(screen.queryByText('provider detail must not leak')).not.toBeInTheDocument();
 });

 it('keeps an MFA read failure unavailable instead of treating the owner as unenrolled',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:{user:{id:'owner-1'}}},error:null});
  authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({data:null,error:new Error('mfa offline')});
  render(<AuthProvider><AuthProbe/></AuthProvider>);
  expect(await screen.findByText('unavailable')).toBeInTheDocument();
  expect(screen.getByLabelText('mfa error')).toHaveTextContent('Owner verification could not be checked');
  expect(screen.getByLabelText('mfa factor')).toHaveTextContent('none');
  expect(screen.getByLabelText('auth loading')).toHaveTextContent('settled');
 });

  it('reports a verified factor only after successful assurance and factor readback',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:{user:{id:'owner-1'}}},error:null});
  authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:'aal2',nextLevel:'aal2'},error:null});
  authMocks.listFactors.mockResolvedValue({data:{totp:[{id:'factor-1',status:'verified'}],phone:[]},error:null});
  render(<AuthProvider><AuthProbe/></AuthProvider>);
  expect(await screen.findByText('ready')).toBeInTheDocument();
  expect(screen.getByLabelText('mfa factor')).toHaveTextContent('factor-1');
  expect(screen.getByLabelText('auth error')).toHaveTextContent('none');
  });

 it('settles thrown sign-in, enrollment, and verification actions with safe retryable errors',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  authMocks.signInWithPassword.mockRejectedValue(new Error('secret sign in failure'));
  authMocks.enroll.mockRejectedValue(new Error('secret enroll failure'));
  authMocks.challengeAndVerify.mockRejectedValue(new Error('secret verify failure'));
  render(<AuthProvider><ActionProbe/></AuthProvider>);
  fireEvent.click(screen.getByRole('button',{name:'Sign in action'}));
  expect(await screen.findByText(/Sign-in could not be completed/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Enroll action'}));
  expect(await screen.findByText(/Authenticator setup could not be started/)).toBeInTheDocument();
  authMocks.listFactors.mockResolvedValue({data:{totp:[{id:'factor-1',status:'verified'}],phone:[]},error:null});
  fireEvent.click(screen.getByRole('button',{name:'Verify action'}));
  expect(await screen.findByText(/Verification could not be completed/)).toBeInTheDocument();
  expect(screen.queryByText(/secret (sign in|enroll|verify) failure/)).not.toBeInTheDocument();
 });

 it('returns the manual key only in the new enrollment result',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  authMocks.enroll.mockResolvedValue({data:{id:'new-factor',totp:{qr_code:'data:image/svg+xml,test',secret:'fixture-private-key'}},error:null});
  const received=vi.fn();
  function EnrollmentProbe(){const {startMfaEnrollment}=useAuth();return <button onClick={async()=>received(await startMfaEnrollment())}>New enrollment</button>}
  render(<AuthProvider><EnrollmentProbe/></AuthProvider>);
  fireEvent.click(screen.getByRole('button',{name:'New enrollment'}));
  await waitFor(()=>expect(received).toHaveBeenCalledWith({data:{factorId:'new-factor',qrCode:'data:image/svg+xml,test',setupKey:'fixture-private-key'},error:null}));
  expect(screen.queryByText('fixture-private-key')).not.toBeInTheDocument();
 });

 it.each(['aal1','aal2'])('adds a separate device only after fresh AAL2 readback (%s)',async(level)=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  authMocks.listFactors.mockResolvedValue({data:{totp:[{id:'existing',status:'verified',friendly_name:'Original phone'}],phone:[]},error:null});
  authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:level,nextLevel:'aal2'},error:null});
  authMocks.enroll.mockResolvedValue({data:{id:'additional',totp:{qr_code:'data:image/svg+xml,test',secret:'fixture-additional-key'}},error:null});
  const received=vi.fn();
  function AddProbe(){const {startAdditionalMfaEnrollment}=useAuth();return <button onClick={async()=>received(await startAdditionalMfaEnrollment('Dad’s phone'))}>Add device</button>}
  render(<AuthProvider><AddProbe/></AuthProvider>);fireEvent.click(screen.getByRole('button',{name:'Add device'}));
  await waitFor(()=>expect(received).toHaveBeenCalled());
  if(level==='aal1'){expect(authMocks.enroll).not.toHaveBeenCalled();expect(received.mock.calls[0][0].error).toMatch(/Verify your existing authenticator/)}
  else{expect(authMocks.enroll).toHaveBeenCalledWith({factorType:'totp',friendlyName:expect.stringMatching(/^Dad’s phone [0-9a-f-]{8}$/)});expect(received.mock.calls[0][0].data.factorId).toBe('additional')}
  expect(authMocks.listFactors.mock.results).not.toHaveLength(0);
 });

 it('refuses initial enrollment over an existing factor and refuses unknown challenge IDs',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  authMocks.listFactors.mockResolvedValue({data:{totp:[{id:'other-factor',status:'verified'}],phone:[]},error:null});
  render(<AuthProvider><ActionProbe/></AuthProvider>);fireEvent.click(screen.getByRole('button',{name:'Enroll action'}));
  expect(await screen.findByText(/An authenticator is already connected/)).toBeInTheDocument();expect(authMocks.enroll).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'Verify action'}));expect(await screen.findByText(/Choose a connected authenticator/)).toBeInTheDocument();expect(authMocks.challengeAndVerify).not.toHaveBeenCalled();
 });

 it('does not report a new factor verified merely because the existing session is AAL2',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  authMocks.listFactors.mockResolvedValue({data:{totp:[{id:'original',status:'verified'}],phone:[]},error:null});
  authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:'aal2',nextLevel:'aal2'},error:null});
  authMocks.enroll.mockResolvedValue({data:{id:'additional',totp:{qr_code:'data:image/svg+xml,test',secret:'fixture-key'}},error:null});
  authMocks.challengeAndVerify.mockResolvedValue({data:{},error:null});
  const received=vi.fn();
  function VerifyNewProbe(){const {startAdditionalMfaEnrollment,verifyMfa}=useAuth();return <button onClick={async()=>{const result=await startAdditionalMfaEnrollment('New phone');if(result.data)received(await verifyMfa(result.data.factorId,'123456'))}}>Verify new device</button>}
  render(<AuthProvider><VerifyNewProbe/></AuthProvider>);fireEvent.click(screen.getByRole('button',{name:'Verify new device'}));
  await waitFor(()=>expect(received).toHaveBeenCalledWith('Identity verification did not finish. Request a new code and try again.'));
 });

 it('refreshes one stale AAL1 token and proves AAL2 before completing verification',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  authMocks.challengeAndVerify.mockResolvedValue({data:{access_token:'redacted'},error:null});
  authMocks.listFactors.mockResolvedValue({data:{totp:[{id:'factor-1',status:'verified'}],phone:[]},error:null});
  authMocks.getAuthenticatorAssuranceLevel
   .mockResolvedValueOnce({data:{currentLevel:'aal1',nextLevel:'aal2'},error:null})
   .mockResolvedValueOnce({data:{currentLevel:'aal2',nextLevel:'aal2'},error:null});
  render(<AuthProvider><ActionProbe/></AuthProvider>);
  fireEvent.click(screen.getByRole('button',{name:'Verify action'}));
  expect(await screen.findByText('ok')).toBeInTheDocument();
  expect(authMocks.refreshSession).toHaveBeenCalledTimes(1);
  expect(authMocks.getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(2);
 });

 it('fails closed when one bounded refresh still does not produce AAL2',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  authMocks.challengeAndVerify.mockResolvedValue({data:{access_token:'redacted'},error:null});
  authMocks.listFactors.mockResolvedValue({data:{totp:[{id:'factor-1',status:'verified'}],phone:[]},error:null});
  authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({data:{currentLevel:'aal1',nextLevel:'aal2'},error:null});
  render(<AuthProvider><ActionProbe/></AuthProvider>);
  fireEvent.click(screen.getByRole('button',{name:'Verify action'}));
  expect(await screen.findByText('Identity verification did not finish. Request a new code and try again.')).toBeInTheDocument();
  expect(authMocks.refreshSession).toHaveBeenCalledTimes(1);
  expect(authMocks.getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(2);
 });

 it('keeps the private session visible when sign-out fails and always settles its pending state',async()=>{
  authMocks.getSession.mockResolvedValue({data:{session:null},error:null});
  let rejectSignOut!:(error:Error)=>void;
  authMocks.signOut.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{rejectSignOut=reject}));
  render(<AuthProvider><ActionProbe/></AuthProvider>);
  fireEvent.click(screen.getByRole('button',{name:'Sign out action'}));
  expect(await screen.findByText('pending')).toBeInTheDocument();
  rejectSignOut(new Error('provider session detail'));
  expect(await screen.findByLabelText('sign-out error')).toHaveTextContent('Sign out could not be completed');
  expect(screen.getByLabelText('action result')).toHaveTextContent('Sign out could not be completed');
  await waitFor(()=>expect(screen.getByLabelText('sign-out pending')).toHaveTextContent('settled'));
  expect(screen.queryByText('provider session detail')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Clear sign-out error'}));
  expect(screen.getByLabelText('sign-out error')).toHaveTextContent('none');
 });
});
