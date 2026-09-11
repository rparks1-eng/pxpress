import {render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {afterEach,expect,it,vi} from 'vitest';
import type {OwnerEmailProvider} from '../features/email-center/provider-contract';
afterEach(()=>{vi.unstubAllEnvs();vi.resetModules()});
for(const code of ['OWNER_GMAIL_RUNTIME_UNAVAILABLE','OWNER_AAL2_REQUIRED','OWNER_AUTHENTICATION_REQUIRED']){
 it(`does not ask for OAuth reconnection after ${code}`,async()=>{
  vi.stubEnv('VITE_OWNER_EMAIL_READ_ENABLED','true');vi.stubEnv('VITE_OWNER_EMAIL_CONNECT_ENABLED','true');
  const repository=await import('../features/email-center/repository');
  repository.setOwnerEmailProviderForTests({connection:vi.fn().mockRejectedValue(new Error(code)),listThreads:vi.fn()} as unknown as OwnerEmailProvider);
  const {EmailCenter}=await import('./EmailCenter');
  render(<MemoryRouter><EmailCenter/></MemoryRouter>);
  if(code==='OWNER_AAL2_REQUIRED')expect(await screen.findByRole('link',{name:'Verify identity'})).toHaveAttribute('href','/mfa-challenge?returnTo=%2Femail&force=1');
  else if(code==='OWNER_AUTHENTICATION_REQUIRED')expect(await screen.findByRole('link',{name:'Sign in again'})).toHaveAttribute('href','/owner-access?returnTo=%2Femail');
  else expect(await screen.findByRole('button',{name:'Check connection again'})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Connect approved Gmail'})).not.toBeInTheDocument();
  expect(screen.queryByText('Gmail is not connected')).not.toBeInTheDocument();
 });
}
