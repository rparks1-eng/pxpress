import { render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,describe,expect,it,vi } from 'vitest';
import { resetOwnerEmailProvider,setOwnerEmailProviderForTests } from '../features/email-center/repository';
import type { OwnerEmailProvider } from '../features/email-center/provider-contract';
import { EmailCenter } from './EmailCenter';

vi.mock('../auth',()=>({
  useAuth:()=>({user:{id:'owner-test',email:'owner@example.com'}}),
  useOptionalAuth:()=>({user:{id:'owner-test',email:'owner@example.com'}}),
}));

describe('Email Center disconnected truth',()=>{
  beforeEach(()=>resetOwnerEmailProvider());
  it('shows no fixture inbox and disables live actions',async()=>{
    render(<MemoryRouter><EmailCenter/></MemoryRouter>);
    expect(await screen.findByText('Gmail is not connected')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:/compose/i})).toBeDisabled();
    expect(await screen.findByText('The email center stays empty until a verified Gmail account is connected.')).toBeInTheDocument();
    expect(screen.queryByText('Jordan Ellis')).not.toBeInTheDocument();
  });
  it('keeps lifecycle communications distinct',async()=>{render(<MemoryRouter><EmailCenter/></MemoryRouter>);expect(await screen.findByRole('link',{name:/lifecycle message history/i})).toHaveAttribute('href','/communications')});
  it('keeps read and compose provider calls off when feature flags are off',async()=>{
    const listThreads=vi.fn();
    const provider={
      connection:vi.fn().mockResolvedValue({connected:true,accountEmail:'owner@example.com',readEnabled:true,composeEnabled:true,modifyEnabled:true,status:'active'}),
      listThreads,
      readThread:vi.fn(),saveDraft:vi.fn(),discardDraft:vi.fn(),sendDraft:vi.fn(),modifyThread:vi.fn(),attachmentAccess:vi.fn(),
    } as unknown as OwnerEmailProvider;
    setOwnerEmailProviderForTests(provider);
    render(<MemoryRouter><EmailCenter/></MemoryRouter>);
    expect(await screen.findByText('Connect Gmail to begin')).toBeInTheDocument();
    expect(provider.connection).not.toHaveBeenCalled();
    expect(listThreads).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:/compose/i})).toBeDisabled();
  });
});
