import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { beforeEach,describe,expect,it,vi } from 'vitest';

const auth=vi.hoisted(()=>({user:{id:'owner-1'},mfa:{readStatus:'ready',currentLevel:'aal1',verifiedFactorId:null as string|null,verifiedFactors:[] as Array<{id:string;name:string}>},startMfaEnrollment:vi.fn(),startAdditionalMfaEnrollment:vi.fn(),verifyMfa:vi.fn(),signOut:vi.fn(),signOutPending:false,clearSignOutError:vi.fn(),retryAuth:vi.fn()}));
vi.mock('../auth',()=>({useAuth:()=>auth}));
import { MfaChallenge,MfaSetup } from './Mfa';
const setupKey='JBSWY3DPEHPK3PXP';
function page(path='/mfa-setup'){return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/mfa-setup" element={<MfaSetup/>}/><Route path="/mfa-challenge" element={<h1>Existing authenticator challenge</h1>}/><Route path="/" element={<h1>Owner desk</h1>}/></Routes></MemoryRouter>)}
async function begin(){fireEvent.click(screen.getByRole('button',{name:'Start secure setup'}));await screen.findByRole('button',{name:'Show setup key'});}
describe('phone-only new MFA setup',()=>{
 beforeEach(()=>{vi.clearAllMocks();auth.mfa.verifiedFactorId=null;auth.mfa.currentLevel='aal1';auth.mfa.verifiedFactors=[];auth.startMfaEnrollment.mockResolvedValue({data:{factorId:'new-factor',qrCode:'data:image/svg+xml,%3Csvg/%3E',setupKey},error:null});auth.startAdditionalMfaEnrollment.mockResolvedValue({data:{factorId:'second-factor',qrCode:'data:image/svg+xml,%3Csvg/%3E',setupKey},error:null});auth.verifyMfa.mockResolvedValue(null);Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockResolvedValue(undefined)}})});
 it('requires explicit enrollment and reveal before displaying or copying the key',async()=>{
  page();expect(auth.startMfaEnrollment).not.toHaveBeenCalled();expect(screen.queryByDisplayValue(setupKey)).not.toBeInTheDocument();
  await begin();expect(screen.queryByDisplayValue(setupKey)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Show setup key'}));expect(screen.getByLabelText('Private setup key')).toHaveValue(setupKey);
  fireEvent.click(screen.getByRole('button',{name:'Copy setup key'}));expect(await screen.findByRole('status')).toHaveTextContent('Setup key copied');expect(navigator.clipboard.writeText).toHaveBeenCalledWith(setupKey);
  fireEvent.click(screen.getByRole('button',{name:'Hide setup key'}));expect(screen.queryByDisplayValue(setupKey)).not.toBeInTheDocument();
 });
 it.each(['missing','denied'])('provides manual selection when clipboard is %s',async(kind)=>{
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:kind==='missing'?undefined:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});
  page();await begin();fireEvent.click(screen.getByRole('button',{name:'Show setup key'}));fireEvent.click(screen.getByRole('button',{name:'Copy setup key'}));
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Press and hold the setup key'));
  expect(screen.getByLabelText('Private setup key')).toHaveAttribute('readonly');
 });
 it('keeps six-digit verification and removes enrollment material on completion',async()=>{
  page();await begin();fireEvent.click(screen.getByRole('button',{name:'Show setup key'}));
  const input=screen.getByLabelText('Authenticator code');const verify=screen.getByRole('button',{name:'Verify & enter owner desk'});
  fireEvent.change(input,{target:{value:'a12'}});expect(input).toHaveValue('12');expect(verify).toBeDisabled();
  fireEvent.change(input,{target:{value:'123456'}});fireEvent.click(verify);
  expect(await screen.findByRole('heading',{name:'Owner desk'})).toBeInTheDocument();expect(auth.verifyMfa).toHaveBeenCalledWith('new-factor','123456');expect(screen.queryByDisplayValue(setupKey)).not.toBeInTheDocument();
 });
 it('does not expose an old key after unmount and never enrolls over a verified factor',async()=>{
  const view=page();await begin();fireEvent.click(screen.getByRole('button',{name:'Show setup key'}));view.unmount();
  page();expect(screen.queryByDisplayValue(setupKey)).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Start secure setup'})).toBeInTheDocument();
 });
 it('routes a verified factor to its challenge without enrollment',async()=>{
  auth.mfa.verifiedFactorId='existing-factor';page();expect(await screen.findByRole('heading',{name:'Existing authenticator challenge'})).toBeInTheDocument();expect(auth.startMfaEnrollment).not.toHaveBeenCalled();
 });
 it('blocks an AAL1 attempt to add a second authenticator',async()=>{
  auth.mfa.verifiedFactorId='existing';page('/mfa-setup?add=1');expect(await screen.findByRole('heading',{name:'Existing authenticator challenge'})).toBeInTheDocument();expect(auth.startAdditionalMfaEnrollment).not.toHaveBeenCalled();
 });
 it('lets an AAL2 owner explicitly add a separately named device without resetting the original',async()=>{
  auth.mfa.verifiedFactorId='existing';auth.mfa.currentLevel='aal2';page('/mfa-setup?add=1');
  expect(auth.startAdditionalMfaEnrollment).not.toHaveBeenCalled();fireEvent.change(screen.getByLabelText('Device name'),{target:{value:'Dad’s iPhone'}});fireEvent.click(screen.getByRole('button',{name:'Add this authenticator'}));
  await screen.findByRole('button',{name:'Show setup key'});expect(auth.startAdditionalMfaEnrollment).toHaveBeenCalledWith('Dad’s iPhone');expect(auth.startMfaEnrollment).not.toHaveBeenCalled();expect(auth.mfa.verifiedFactorId).toBe('existing');
 });
 it('verifies the selected device and clears a code when switching devices',async()=>{
  auth.mfa.verifiedFactorId='original';auth.mfa.verifiedFactors=[{id:'original',name:'Original phone'},{id:'dad',name:'Dad’s phone'}];
  render(<MemoryRouter><MfaChallenge/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Six-digit authenticator code'),{target:{value:'123456'}});
  fireEvent.change(screen.getByLabelText('Authenticator device'),{target:{value:'dad'}});expect(screen.getByLabelText('Six-digit authenticator code')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Six-digit authenticator code'),{target:{value:'654321'}});fireEvent.click(screen.getByRole('button',{name:'Open owner desk'}));
  await waitFor(()=>expect(auth.verifyMfa).toHaveBeenCalledWith('dad','654321'));
 });
});
