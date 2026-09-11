import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {TodayWorkspace} from './TodayWorkspace';
const create=vi.hoisted(()=>vi.fn());
vi.mock('../features/expenses/repository',()=>({createExpense:create}));
vi.mock('../hooks',()=>({useRequests:()=>({data:[],loading:false,error:'',reload:vi.fn()})}));
beforeEach(()=>{
 create.mockReset();create.mockResolvedValue({id:'saved'});
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
describe('Today task sheet',()=>{
 it('saves an expense using the existing repository and shows Done instead of navigating',async()=>{
  const close=vi.fn();render(<MemoryRouter><TodayWorkspace task="expense" onClose={close}/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Merchant'),{target:{value:'Fuel stop'}});
  fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'42.50'}});
  fireEvent.click(screen.getByRole('button',{name:'Save expense'}));
  await screen.findByText('Expense saved');
  expect(create).toHaveBeenCalledTimes(1);expect(create.mock.calls[0][1]).toMatchObject({merchant:'Fuel stop',amount:42.5});
  expect(close).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Done'}));expect(close).toHaveBeenCalledTimes(1);
 });
 it('keeps a failed save available to retry with the same request id',async()=>{
  create.mockRejectedValueOnce(new Error('Connection interrupted'));render(<MemoryRouter><TodayWorkspace task="expense" onClose={()=>{}}/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Merchant'),{target:{value:'Fuel'}});fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'20'}});
  fireEvent.click(screen.getByRole('button',{name:'Save expense'}));await screen.findByRole('alert');
  expect(screen.getByLabelText('Merchant')).toHaveValue('Fuel');fireEvent.click(screen.getByRole('button',{name:'Save expense'}));await screen.findByText('Expense saved');
  expect(create.mock.calls[0][0]).toBe(create.mock.calls[1][0]);
 });
 it('does not discard an edited expense without confirmation',async()=>{
  const close=vi.fn(),confirm=vi.spyOn(window,'confirm').mockReturnValue(false);render(<MemoryRouter><TodayWorkspace task="expense" onClose={close}/></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Merchant'),{target:{value:'Keep me'}});fireEvent.click(screen.getByRole('button',{name:'Back to Today'}));
  await waitFor(()=>expect(confirm).toHaveBeenCalled());expect(close).not.toHaveBeenCalled();confirm.mockRestore();
 });
});
