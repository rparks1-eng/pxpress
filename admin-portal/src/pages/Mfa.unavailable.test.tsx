import { render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe,expect,it,vi } from 'vitest';

const retryAuth=vi.fn();
vi.mock('../auth',()=>({useAuth:()=>({
 user:{id:'owner-1'},
 mfa:{currentLevel:null,nextLevel:null,verifiedFactorId:null,readStatus:'unavailable',error:'Owner verification could not be checked.'},
 retryAuth,
 startMfaEnrollment:vi.fn(),verifyMfa:vi.fn(),signOut:vi.fn(),
})}));

import { MfaChallenge,MfaSetup } from './Mfa';

describe('MFA unavailable direct routes',()=>{
 it.each([['setup',MfaSetup],['challenge',MfaChallenge]])('keeps %s fail closed when MFA readback is unavailable',async(_name,Page)=>{
  render(<MemoryRouter><Page/></MemoryRouter>);
  expect(screen.getByRole('heading',{name:'Owner verification is unavailable'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Try again'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:/Start secure setup|Open owner desk/})).not.toBeInTheDocument();
 });
});
