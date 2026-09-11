import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state=vi.hoisted(()=>({user:null as unknown,loading:false,configured:true,authError:null,mfa:{readStatus:'ready',verifiedFactorId:null as string|null,currentLevel:null as string|null},signIn:vi.fn(),verifyMfa:vi.fn(),startMfaEnrollment:vi.fn(),signOut:vi.fn(),retryAuth:vi.fn(),clearSignOutError:vi.fn()}));
vi.mock('./auth',()=>({useAuth:()=>state}));
vi.mock('./components/Shell',()=>({Shell:({children}:{children:React.ReactNode})=><>{children}</>}));
import { Protected } from './App';
import { Login } from './pages/Login';
import { MfaChallenge, MfaSetup } from './pages/Mfa';
import { safeOwnerMfaReturnPath } from './features/email-center/mfa-return';

const request='/requests/123e4567-e89b-42d3-a456-426614174000';
function Destination(){const location=useLocation();return <output data-testid="destination">{location.pathname}</output>}
function Flow({entry}:{entry:string}){return <MemoryRouter initialEntries={[entry]}><Routes><Route path="owner-access" element={<Login/>}/><Route path="mfa-setup" element={<MfaSetup/>}/><Route path="mfa-challenge" element={<MfaChallenge/>}/><Route element={<Protected/>}><Route path="*" element={<Destination/>}/></Route></Routes></MemoryRouter>}

describe('actual password and MFA deep-link route chain',()=>{
 beforeEach(()=>{
  vi.clearAllMocks();state.user=null;state.mfa={readStatus:'ready',verifiedFactorId:null,currentLevel:null};
  state.signIn.mockImplementation(async()=>{state.user={id:'fixture-owner'};return null});
  state.verifyMfa.mockImplementation(async()=>{state.mfa={readStatus:'ready',verifiedFactorId:'fixture-factor',currentLevel:'aal2'};return null});
  state.startMfaEnrollment.mockResolvedValue({data:{factorId:'fixture-factor',qrCode:'fixture-qr'},error:null});
 });
 for(const target of [request,'/email','/calendar','/notifications'])for(const existing of [false,true])it(`preserves ${target} through password and ${existing?'challenge':'setup'} verification`,async()=>{
  if(existing)state.mfa={readStatus:'ready',verifiedFactorId:'fixture-factor',currentLevel:'aal1'};
  render(<Flow entry={target}/>);
  fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'owner@example.test'}});
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'fixture-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Enter owner desk'}));
  if(!existing)fireEvent.click(await screen.findByRole('button',{name:'Start secure setup'}));
  fireEvent.change(await screen.findByLabelText(existing?'Six-digit authenticator code':'Authenticator code'),{target:{value:'123456'}});
  fireEvent.click(screen.getByRole('button',{name:existing?'Open owner desk':'Verify & enter owner desk'}));
  expect(await screen.findByTestId('destination')).toHaveTextContent(target);
  expect(state.verifyMfa).toHaveBeenCalledWith('fixture-factor','123456');
 });
 for(const target of [request,'/calendar','/notifications'])for(const page of ['mfa-setup','mfa-challenge'])it(`retains ${target} when ${page} has lost its session`,async()=>{
  render(<Flow entry={`/${page}?returnTo=${encodeURIComponent(target)}`}/>);
  fireEvent.change(await screen.findByLabelText('Email address'),{target:{value:'owner@example.test'}});
  fireEvent.change(screen.getByLabelText('Password'),{target:{value:'fixture-password'}});
  fireEvent.click(screen.getByRole('button',{name:'Enter owner desk'}));
  fireEvent.click(await screen.findByRole('button',{name:'Start secure setup'}));
  fireEvent.change(await screen.findByLabelText('Authenticator code'),{target:{value:'123456'}});
  fireEvent.click(screen.getByRole('button',{name:'Verify & enter owner desk'}));
  await waitFor(()=>expect(screen.getByTestId('destination').textContent).toBe(target));
 });
 it('rejects external, encoded, malformed and suffixed destinations exactly',()=>{
  for(const value of ['https://evil.example','//evil.example','\\evil.example','javascript:alert(1)',`${request}?next=https://evil.example`,`${request}#x`,`${request}/..`,`${request}\n`,'%2Frequests%2F123e4567-e89b-42d3-a456-426614174000','/requests/123e4567-e89b-02d3-a456-426614174000','/requests/123e4567-e89b-42d3-c456-426614174000','/requests/not-a-uuid'])expect(safeOwnerMfaReturnPath(value)).toBe('/');
 });
});
