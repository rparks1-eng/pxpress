import { render,screen } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { describe,expect,it,vi } from 'vitest';

vi.mock('../auth',()=>({useAuth:()=>({
 user:{id:'owner-1'},
 mfa:{currentLevel:'aal2',nextLevel:'aal2',verifiedFactorId:'factor-1',readStatus:'ready',error:''},
 retryAuth:vi.fn(),startMfaEnrollment:vi.fn(),verifyMfa:vi.fn(),signOut:vi.fn(),
 signOutPending:false,clearSignOutError:vi.fn(),
})}));

import { MfaChallenge } from './Mfa';

function renderRoute(path:string){
 return render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/mfa-challenge" element={<MfaChallenge/>}/>
  <Route path="/email" element={<h1>Email center</h1>}/>
  <Route path="/" element={<h1>Owner desk</h1>}/>
 </Routes></MemoryRouter>);
}

describe('Gmail connection MFA recovery',()=>{
 it('forces a fresh owner challenge even when the client session reports AAL2',()=>{
  renderRoute('/mfa-challenge?returnTo=%2Femail&force=1');
  expect(screen.getByRole('heading',{name:'Welcome back, Raishawn.'})).toBeInTheDocument();
  expect(screen.getByLabelText('Six-digit authenticator code')).toHaveAttribute('inputmode','numeric');
  expect(screen.getByRole('button',{name:'Open owner desk'})).toBeDisabled();
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img',{name:'Pxpress'})).toBeInTheDocument();
 });

 it('does not force another challenge without the explicit recovery marker',()=>{
  renderRoute('/mfa-challenge?returnTo=%2Femail');
  expect(screen.getByRole('heading',{name:'Email center'})).toBeInTheDocument();
 });

 it('rejects an external return target',()=>{
  renderRoute('/mfa-challenge?returnTo=https%3A%2F%2Fevil.example&force=1');
  expect(screen.getByRole('heading',{name:'Welcome back, Raishawn.'})).toBeInTheDocument();
 });
});
