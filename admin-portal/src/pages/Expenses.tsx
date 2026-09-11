import {ArrowDownToLine,ChevronRight,Plus,ReceiptText,Search,X} from 'lucide-react';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '../auth';
import {StatePanel} from '../components/StatePanel';
import {businessDateKey} from '../lib/business-date';
import {ExpenseEntryForm} from '../features/expenses/components/ExpenseEntryForm';
import {categoryLabels,expensesToCsv,operatingExpenseTotal} from '../features/expenses/domain';
import {attachExpenseReceipt,createExpense,downloadExpenseReceipt,listExpenses,updateExpense,type SavedExpense} from '../features/expenses/repository';
import './expense-ledger.css';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export function Expenses(){
 const {user}=useAuth(),[month,setMonth]=useState(()=>businessDateKey(new Date()).slice(0,7)),[items,setItems]=useState<SavedExpense[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[q,setQ]=useState(''),[editing,setEditing]=useState<SavedExpense|'new'|null>(null);
 const sequence=useRef(0);
 const load=useCallback(async()=>{const turn=++sequence.current;setLoading(true);setError('');try{const rows=await listExpenses(month);if(sequence.current===turn)setItems(rows)}catch(e){if(sequence.current===turn){setItems([]);setError(e instanceof Error?e.message:'Expenses unavailable.')}}finally{if(sequence.current===turn)setLoading(false)}},[month,user?.id]);
 useEffect(()=>{void load();return()=>{sequence.current++}},[load]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')void load()};document.addEventListener('visibilitychange',refresh);return()=>document.removeEventListener('visibilitychange',refresh)},[load]);
 const active=items.filter(i=>!i.archivedAt),visible=items.filter(i=>(filter==='archived'?!!i.archivedAt:!i.archivedAt&&(filter!=='review'||i.reviewState==='needs_review'))&&(i.merchant+' '+i.notes).toLowerCase().includes(q.toLowerCase()));
 return <div className="page ledger-page"><header className="page-head"><h1>Expenses</h1><button type="button" className="desk-icon-action" aria-label="Add expense" disabled={loading||!!error} onClick={()=>setEditing('new')}><Plus aria-hidden/></button></header>
 <div className="ledger-month"><label><span className="sr-only">Expense month</span><input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}/></label><button type="button" aria-label="Export this month" disabled={loading||!!error||!active.length} onClick={()=>download(new Blob([expensesToCsv(active)],{type:'text/csv;charset=utf-8'}),'pxpress-expenses-'+month+'.csv')}><ArrowDownToLine aria-hidden/></button></div>
 {loading?<StatePanel kind="loading" title="Loading expenses"/>:error?<StatePanel kind="error" title="Expenses unavailable" body={error} retry={load}/>:<>
 <div className="ledger-total"><span>Reviewed business spending</span><strong>{money(operatingExpenseTotal(active))}</strong><small>{active.filter(i=>i.reviewState==='needs_review').length} to review · {active.filter(i=>i.receipt.state!=='stored').length} without receipts</small></div>
 <label className="search touch-request-search"><Search aria-hidden/><span className="sr-only">Search expenses</span><input placeholder="Find a merchant" value={q} onChange={e=>setQ(e.target.value)}/></label>
 <nav className="desk-view-switch" aria-label="Expense lists">{[['all','All expenses'],['review','To review'],['archived','Archived']].map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</nav>
 {visible.length?<ul className="ledger-list">{visible.map(item=><li key={item.id}><button type="button" onClick={()=>setEditing(item)} aria-label={'Edit expense from '+item.merchant}><ReceiptText aria-hidden/><span><strong>{item.merchant}</strong><small>{categoryLabels[item.category]} · {item.occurredOn}</small><small>{item.reviewState==='needs_review'?'Needs review':item.reviewState==='excluded'?'Excluded':'Reviewed'}{item.receipt.state==='stored'?' · Receipt attached':''}</small></span><b>{money(item.amount)}</b><ChevronRight aria-hidden/></button></li>)}</ul>:<div className="ledger-empty"><h2>{filter==='review'?'Nothing waiting for review':'No expenses in this view'}</h2>{filter==='all'&&!q&&<button type="button" className="button primary" onClick={()=>setEditing('new')}><Plus aria-hidden/>Add an expense</button>}</div>}
 <details className="ledger-help"><summary>About this ledger</summary><p>Expenses and receipts are saved to your private account. Automatic bank imports are not connected. Use manual entry until a business bank connection is set up.</p><p>Totals show reviewed business spending, not tax deductions. Archived items stay in your history.</p></details></>}
 {editing&&<ExpenseSheet key={editing==='new'?'new':editing.id} expense={editing==='new'?null:editing} onClose={()=>{setEditing(null);void load()}} onSaved={saved=>{setEditing(saved);if(saved.occurredOn.slice(0,7)!==month)setMonth(saved.occurredOn.slice(0,7));else void load()}}/>}
 </div>;
}
function ExpenseSheet({expense,onClose,onSaved}:{expense:SavedExpense|null;onClose:()=>void;onSaved:(v:SavedExpense)=>void}){
 const dialog=useRef<HTMLDialogElement>(null),id=useRef(expense?.id||crypto.randomUUID()),locked=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close()},[]);
 const close=()=>{if(!locked.current&&window.confirm('Close this expense? Any unsaved edits will be discarded.'))onClose()};
 async function action(task:()=>Promise<void>){if(locked.current)return;locked.current=true;setBusy(true);setError('');try{await task()}catch(e){setError(e instanceof Error?e.message:'The change could not be saved.')}finally{locked.current=false;setBusy(false)}}
 return <dialog className="ledger-editor" ref={dialog} aria-labelledby="expense-title" onCancel={e=>{e.preventDefault();close()}}><header><h2 id="expense-title">{expense?'Expense details':'Add expense'}</h2><button type="button" aria-label="Close expense" onClick={close} disabled={busy}><X aria-hidden/></button></header>
 {notice&&<p role="status">{notice}</p>}{error&&<p role="alert" className="ledger-error">{error}</p>}
 <ExpenseEntryForm key={expense?.version||0} initial={expense||undefined} rules={[]} onAdd={async draft=>{if(locked.current)throw new Error('A save is already in progress.');locked.current=true;setBusy(true);try{const saved=expense?await updateExpense(expense,draft):await createExpense(id.current,draft);setNotice('Expense saved.');onSaved(saved)}finally{locked.current=false;setBusy(false)}}}/>
 {expense&&<div className="ledger-record-actions">
 <label>Attach a receipt<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf" disabled={busy||!!expense.archivedAt} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void action(async()=>{await attachExpenseReceipt(expense,file);setNotice('Receipt saved.');onClose()})}}/><small>Photo or PDF, up to 10 MB. Stored privately.</small></label>
 {expense.receipt.state==='stored'&&<button type="button" disabled={busy} onClick={()=>void action(async()=>download(await downloadExpenseReceipt(expense),expense.receipt.fileName||'receipt'))}>Download receipt</button>}
 {expense.reviewState!=='reviewed'&&!expense.archivedAt&&<button type="button" disabled={busy} onClick={()=>void action(async()=>{onSaved(await updateExpense(expense,expense,'reviewed'));setNotice('Marked as reviewed.')})}>Mark reviewed</button>}
 <button type="button" disabled={busy} onClick={()=>{if(window.confirm(expense.archivedAt?'Restore this expense to your ledger?':'Archive this expense? It will stay in history.'))void action(async()=>{await updateExpense(expense,expense,expense.reviewState,!expense.archivedAt);onClose()})}}>{expense.archivedAt?'Restore expense':'Archive expense'}</button>
 </div>}
 </dialog>;
}
