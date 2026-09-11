import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,describe,expect,it,vi } from 'vitest';

const beginOwnerGmailOAuth=vi.fn();
vi.mock('../features/email-center/supabase-provider',async()=>{
 const actual=await vi.importActual<typeof import('../features/email-center/supabase-provider')>('../features/email-center/supabase-provider');
 return {...actual,beginOwnerGmailOAuth};
});

describe('Email Center MFA recovery',()=>{
 beforeEach(async()=>{
  vi.resetModules();
  vi.stubEnv('VITE_OWNER_EMAIL_CONNECT_ENABLED','true');
  beginOwnerGmailOAuth.mockReset().mockRejectedValue(new Error('OWNER_AAL2_REQUIRED'));
 });

 it('replaces the technical rejection with a clear, safe recovery action',async()=>{
  const repository=await import('../features/email-center/repository');
  repository.resetOwnerEmailProvider();
  const { EmailCenter }=await import('./EmailCenter');
  render(<MemoryRouter><EmailCenter/></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Connect approved Gmail'}));
  await waitFor(()=>expect(screen.getByText('Verify your identity to connect Gmail')).toBeInTheDocument());
  expect(screen.queryByText('OWNER_AAL2_REQUIRED')).not.toBeInTheDocument();
  expect(screen.getByRole('link',{name:'Verify identity'})).toHaveAttribute('href','/mfa-challenge?returnTo=%2Femail&force=1');
 });
});
