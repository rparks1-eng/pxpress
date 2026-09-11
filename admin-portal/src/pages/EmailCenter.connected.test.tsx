import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach,describe,expect,it,vi } from 'vitest';
import type { OwnerEmailProvider } from '../features/email-center/provider-contract';
import type { EmailMessage,EmailThread } from '../features/email-center/types';

vi.mock('../auth',()=>({
  useAuth:()=>({user:{id:'owner-test',email:'owner@example.com'}}),
  useOptionalAuth:()=>({user:{id:'owner-test',email:'owner@example.com'}}),
}));

const thread:EmailThread={id:'thread-1',providerThreadId:'provider-thread-1',historyId:'history-1',subject:'Airport pickup',participants:[{name:'Jordan Ellis',email:'jordan@example.com'}],snippet:'Please confirm.',lastMessageAt:'2026-09-02T18:30:00Z',unread:true,starred:false,labels:['inbox'],messageCount:1,matchedRequestIds:[]};
const message:EmailMessage={id:'message:1',threadId:'thread-1',providerMessageId:'provider-message-1',rfcMessageId:'rfc-message-1',references:[],from:{name:'Jordan Ellis',email:'jordan@example.com'},to:[{name:'Raishawn',email:'owner@example.com'}],cc:[{email:'dispatch@example.com'}],subject:'Airport pickup',sentAt:'2026-09-02T18:30:00Z',direction:'received',plainText:'Please confirm.',unread:true,attachments:[]};

afterEach(()=>{vi.unstubAllEnvs();vi.resetModules()});

describe('Email Center connected controls',()=>{
  it('expands recipient details and locks a confirmed send to one stable dispatch',async()=>{
    vi.stubEnv('VITE_OWNER_EMAIL_READ_ENABLED','true');
    vi.stubEnv('VITE_OWNER_EMAIL_COMPOSE_ENABLED','true');
    const sendDraft=vi.fn().mockImplementation((_draft,idempotencyKey)=>Promise.resolve({idempotencyKey,providerMessageId:'sent-1',providerThreadId:'provider-thread-2',verifiedAt:new Date().toISOString()}));
    const provider={
      connection:vi.fn().mockResolvedValue({connected:true,accountEmail:'owner@example.com',readEnabled:true,composeEnabled:true,modifyEnabled:false,status:'active'}),
      listThreads:vi.fn().mockResolvedValue({items:[thread]}),
      readThread:vi.fn().mockResolvedValue({thread,messages:[message]}),
      saveDraft:vi.fn(),discardDraft:vi.fn(),sendDraft,modifyThread:vi.fn(),attachmentAccess:vi.fn(),
    } as unknown as OwnerEmailProvider;
    const repository=await import('../features/email-center/repository');
    repository.setOwnerEmailProviderForTests(provider);
    const { EmailCenter }=await import('./EmailCenter');
    render(<MemoryRouter><EmailCenter/></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:/Jordan Ellis/}));
    const recipientButton=await screen.findByRole('button',{name:/to Raishawn/});
    expect(recipientButton).toHaveAttribute('aria-expanded','false');
    fireEvent.click(recipientButton);
    expect(recipientButton).toHaveAttribute('aria-expanded','true');
    expect(screen.getByText('dispatch@example.com')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button',{name:/compose/i}));
    fireEvent.change(screen.getByLabelText('To'),{target:{value:'guest@example.com'}});
    fireEvent.change(screen.getByLabelText('Subject'),{target:{value:'Your Pxpress ride'}});
    fireEvent.change(screen.getByLabelText('Message'),{target:{value:'Your ride details are ready.'}});
    fireEvent.click(screen.getByRole('button',{name:/review send/i}));
    const confirm=await screen.findByRole('button',{name:'Confirm and send'});
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(()=>expect(sendDraft).toHaveBeenCalledTimes(1));
    expect(sendDraft.mock.calls[0][1]).toMatch(/^pxpress-email-/);
    expect(sendDraft.mock.calls[0][2]).toEqual(expect.any(String));
  });

  it('moves a conversation to recoverable Trash only after confirmation',async()=>{
    vi.stubEnv('VITE_OWNER_EMAIL_READ_ENABLED','true');
    vi.stubEnv('VITE_OWNER_EMAIL_MODIFY_ENABLED','true');
    vi.spyOn(window,'confirm').mockReturnValue(true);
    const modifyThread=vi.fn().mockResolvedValue(undefined);
    const provider={
      connection:vi.fn().mockResolvedValue({connected:true,accountEmail:'owner@example.com',readEnabled:true,composeEnabled:false,modifyEnabled:true,status:'active'}),
      listThreads:vi.fn().mockResolvedValue({items:[thread]}),
      readThread:vi.fn().mockResolvedValue({thread,messages:[message]}),
      saveDraft:vi.fn(),discardDraft:vi.fn(),sendDraft:vi.fn(),modifyThread,attachmentAccess:vi.fn(),
    } as unknown as OwnerEmailProvider;
    const repository=await import('../features/email-center/repository');
    repository.setOwnerEmailProviderForTests(provider);
    const {EmailCenter}=await import('./EmailCenter');
    render(<MemoryRouter><EmailCenter/></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button',{name:/Jordan Ellis/}));
    fireEvent.click(await screen.findByRole('button',{name:'Trash'}));
    await waitFor(()=>expect(modifyThread).toHaveBeenCalledWith('provider-thread-1','trash',expect.any(String)));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('restore it later'));
  });

  it('lists Trash and restores a trashed conversation with untrash',async()=>{
    vi.stubEnv('VITE_OWNER_EMAIL_READ_ENABLED','true');
    vi.stubEnv('VITE_OWNER_EMAIL_MODIFY_ENABLED','true');
    const trashed={...thread,labels:['trash']};
    const modifyThread=vi.fn().mockResolvedValue(undefined);
    const listThreads=vi.fn().mockImplementation(({label})=>Promise.resolve({items:label==='trash'?[trashed]:[thread]}));
    const provider={connection:vi.fn().mockResolvedValue({connected:true,accountEmail:'owner@example.com',readEnabled:true,composeEnabled:false,modifyEnabled:true,status:'active'}),listThreads,readThread:vi.fn().mockResolvedValue({thread:trashed,messages:[message]}),saveDraft:vi.fn(),discardDraft:vi.fn(),sendDraft:vi.fn(),modifyThread,attachmentAccess:vi.fn()} as unknown as OwnerEmailProvider;
    const repository=await import('../features/email-center/repository');repository.setOwnerEmailProviderForTests(provider);
    const {EmailCenter}=await import('./EmailCenter');render(<MemoryRouter><EmailCenter/></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText('Filter email'),{target:{value:'trash'}});
    await waitFor(()=>expect(listThreads).toHaveBeenCalledWith(expect.objectContaining({label:'trash'})));
    fireEvent.click(await screen.findByRole('button',{name:/Jordan Ellis/}));
    fireEvent.click(await screen.findByRole('button',{name:'Restore'}));
    await waitFor(()=>expect(modifyThread).toHaveBeenCalledWith('provider-thread-1','untrash',expect.any(String)));
  });
});
