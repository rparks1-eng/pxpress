import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {Expenses} from './Expenses';
import {emptyExpenseDraft} from '../features/expenses/components/ExpenseEntryForm';
import {createExpense,listExpenses,updateExpense} from '../features/expenses/repository';
vi.mock('../auth',()=>({useAuth:()=>({user:{id:'owner'}})}));
vi.mock('../features/expenses/repository',()=>({listExpenses:vi.fn(),createExpense:vi.fn(),updateExpense:vi.fn(),attachExpenseReceipt:vi.fn(),downloadExpenseReceipt:vi.fn()}));
const saved={...emptyExpenseDraft(),merchant:'Shell Station',amount:25.5,id:'saved-id',ownerId:'owner',currency:'USD',reviewState:'needs_review',source:'manual',createdAt:'2026-09-06',updatedAt:'2026-09-06',version:1,archivedAt:null};
beforeEach(()=>{
 vi.clearAllMocks();vi.mocked(listExpenses).mockResolvedValue([]);
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute('open')};
});
describe('persistent owner expenses',()=>{
 it('defaults to the Ohio business date near UTC midnight',()=>{expect(emptyExpenseDraft(new Date('2026-09-02T02:30:00Z')).occurredOn).toBe('2026-09-01')});
 it('never presents missing storage as an empty working ledger',async()=>{
  vi.mocked(listExpenses).mockRejectedValue(new Error('Expense storage is not enabled yet. Nothing has been saved.'));
  render(<Expenses/>);
  expect(await screen.findByText('Expenses unavailable')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Add expense'})).toBeDisabled();
  expect(screen.queryByText('No expenses in this view')).not.toBeInTheDocument();
 });
 it('reloads saved records from the repository on remount',async()=>{
  vi.mocked(listExpenses).mockResolvedValue([saved as never]);
  const first=render(<Expenses/>);
  expect(await screen.findByRole('button',{name:'Edit expense from Shell Station'})).toBeInTheDocument();
  first.unmount();render(<Expenses/>);
  expect(await screen.findByRole('button',{name:'Edit expense from Shell Station'})).toBeInTheDocument();
  expect(listExpenses).toHaveBeenCalledTimes(2);
 });
 it('preserves a failed save and reuses the same id on retry',async()=>{
  vi.mocked(createExpense).mockRejectedValueOnce(new Error('Try again.')).mockResolvedValueOnce(saved as never);
  render(<Expenses/>);
  await screen.findByText('No expenses in this view');
  fireEvent.click(screen.getByRole('button',{name:'Add expense'}));
  fireEvent.change(screen.getByLabelText('Merchant'),{target:{value:'Shell Station'}});
  fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'25.50'}});
  fireEvent.click(screen.getByRole('button',{name:'Save expense'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Try again.');
  expect(screen.getByLabelText('Merchant')).toHaveValue('Shell Station');
  fireEvent.click(screen.getByRole('button',{name:'Save expense'}));
  await waitFor(()=>expect(createExpense).toHaveBeenCalledTimes(2));
  expect(vi.mocked(createExpense).mock.calls[0][0]).toBe(vi.mocked(createExpense).mock.calls[1][0]);
  expect(updateExpense).not.toHaveBeenCalled();
 });
});
