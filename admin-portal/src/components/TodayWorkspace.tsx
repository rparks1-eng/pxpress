import {lazy,Suspense,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,Search} from 'lucide-react';
import {Route,Routes,useNavigate} from 'react-router-dom';
import {useRequests} from '../hooks';
import {toCustomers} from '../lib/selectors';
import {ExpenseEntryForm} from '../features/expenses/components/ExpenseEntryForm';
import {createExpense} from '../features/expenses/repository';
import {StatePanel} from './StatePanel';

const Feedback=lazy(()=>import('../pages/Feedback').then(m=>({default:m.Feedback})));
const GuestProfile=lazy(()=>import('../pages/GuestProfile').then(m=>({default:m.GuestProfile})));
const RequestDetail=lazy(()=>import('../pages/RequestDetail').then(m=>({default:m.RequestDetail})));
const Communications=lazy(()=>import('../pages/CommunicationsCenter').then(m=>({default:m.CommunicationsCenter})));
export type TodayTask='expense'|'guests'|'feedback'|'communications'|`/requests/${string}`;

/** Transient tasks stay out of browser history and leave Today mounted behind them. */
export function TodayWorkspace({task,onClose}:{task:TodayTask;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),dirty=useRef(false),busy=useRef(false);
 const [path,setPath]=useState<string>(task),[saved,setSaved]=useState(false);
 const expenseId=useRef(crypto.randomUUID()),navigate=useNavigate();
 useEffect(()=>{const node=dialog.current,prior=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;node?.showModal();document.body.style.overflow='hidden';return()=>{node?.close();document.body.style.overflow=overflow;prior?.focus()}},[]);
 const close=()=>{if(busy.current)return;if(dirty.current&&!window.confirm('Discard your unsaved expense?'))return;onClose()};
 const title=path==='expense'?'Record expense':path==='guests'?'Find a guest':path==='feedback'?'Guest feedback':path==='communications'?'Customer emails':path.startsWith('/customers/')?'Guest details':'Ride details';
 function goFull(destination:string){onClose();navigate(destination,{replace:true})}
 return <dialog ref={dialog} className="today-sheet" aria-labelledby="today-task-title" onCancel={e=>{e.preventDefault();close()}} onClickCapture={e=>{
   const a=(e.target as Element).closest('a');if(!a||e.defaultPrevented||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
   const url=new URL(a.href,location.href);if(url.origin!==location.origin||!url.pathname.startsWith('/admin'))return;
   e.preventDefault();const next=url.pathname.slice(6)||'/';
   if(next==='/'){close();return}if(next==='/customers'){setPath('guests');return}if(next==='/communications'){setPath('communications');return}
   if(/^\/(customers|requests)\/[^/]+$/.test(next)){setPath(next+url.hash);return}
   goFull(next+url.hash);
 }}>
  <header className="today-sheet-head"><button type="button" onClick={close} aria-label="Back to Today"><ArrowLeft aria-hidden/><span>Today</span></button><h2 id="today-task-title">{title}</h2></header>
  <div className="today-sheet-body">
   {path==='expense'?(saved?<div className="today-task-success" role="status"><h3>Expense saved</h3><p>It’s in your expense ledger.</p><button className="button primary" onClick={onClose}>Done</button><button className="desk-text-action" onClick={()=>goFull('/expenses')}>View expenses <ArrowRight aria-hidden/></button></div>:<div onChangeCapture={()=>{dirty.current=true}}><ExpenseEntryForm rules={[]} onAdd={async draft=>{if(busy.current)throw new Error('A save is already in progress.');busy.current=true;try{await createExpense(expenseId.current,draft);dirty.current=false;setSaved(true)}finally{busy.current=false}}}/></div>):path==='guests'?<GuestFinder onSelect={id=>setPath('/customers/'+encodeURIComponent(id))} onDirectory={()=>goFull('/customers')}/>:<Suspense fallback={<StatePanel kind="loading" title="Opening details"/>}>{path==='feedback'?<Feedback/>:path==='communications'?<Communications/>:<Routes location={path}><Route path="/customers/:id" element={<GuestProfile/>}/><Route path="/requests/:id" element={<RequestDetail/>}/></Routes>}</Suspense>}
  </div>
 </dialog>;
}

function GuestFinder({onSelect,onDirectory}:{onSelect:(id:string)=>void;onDirectory:()=>void}){
 const {data,loading,error,reload}=useRequests(),[query,setQuery]=useState('');
 const guests=toCustomers(data).filter(g=>`${g.name} ${g.email} ${g.phone}`.toLowerCase().includes(query.toLowerCase()));
 return <div className="guest-finder"><label className="guest-finder-search"><Search aria-hidden/><input aria-label="Find a guest" placeholder="Name, phone or email" value={query} onChange={e=>setQuery(e.target.value)}/></label>
 {loading?<StatePanel kind="loading" title="Finding your guests"/>:error?<StatePanel kind="error" title="Guests unavailable" body={error} retry={reload}/>:<ul>{guests.map(g=><li key={g.id}><button onClick={()=>onSelect(g.id)}><span className="guest-finder-initials" aria-hidden>{g.name.split(' ').map(n=>n[0]).join('').slice(0,2)}</span><span><strong>{g.name}</strong><small>{g.phone||g.email}</small></span><ArrowRight aria-hidden/></button></li>)}{!guests.length&&<li className="guest-finder-empty">{query?'No matching guests':'No guests yet'}</li>}</ul>}
 <button className="desk-text-action" onClick={onDirectory}>Open full directory <ArrowRight aria-hidden/></button></div>;
}
