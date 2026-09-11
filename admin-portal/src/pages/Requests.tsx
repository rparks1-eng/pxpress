import { Search, Settings as SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { RequestTable } from '../components/RequestTable';
import { StatePanel } from '../components/StatePanel';
import { useRequests } from '../hooks';
import { filterRequests } from '../lib/selectors';

export function Requests(){
 const {data,loading,error,reload}=useRequests();
 const [q,setQ]=useState(''),[status,setStatus]=useState('__active'),[service,setService]=useState(''),[filters,setFilters]=useState(false);
 const filtered=filterRequests(data,q,status,service);
 return <div className="page touch-requests-page">
   <header className="page-head"><h1>Requests</h1><button type="button" className="desk-icon-action" aria-label="Filter services" aria-expanded={filters} onClick={()=>setFilters(v=>!v)}><SlidersHorizontal aria-hidden/></button></header>
   <label className="search touch-request-search"><Search aria-hidden/><span className="sr-only">Search requests</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Find a guest or address"/></label>
   <nav className="desk-view-switch" aria-label="Request lists">{[['__active','Needs action'],['__archive','History'],['','All']].map(([key,label])=><button type="button" key={key} aria-pressed={status===key} onClick={()=>setStatus(key)}>{label}</button>)}</nav>
   {filters&&<label className="touch-service-filter">Service<select value={service} onChange={e=>setService(e.target.value)}><option value="">All services</option><option value="airport">Airport</option><option value="appointment">Appointment</option><option value="point">Point-to-point</option><option value="events">Event</option><option value="hourly">Hourly</option></select></label>}
   {service&&!filters&&<button type="button" className="desk-text-action" onClick={()=>setService('')}>Clear service filter</button>}
   {loading?<StatePanel kind="loading" title="Loading requests"/>:error?<StatePanel kind="error" title="Requests could not be loaded" body="Please try again to see your latest requests." retry={reload}/>:filtered.length?<RequestTable items={filtered}/>:<StatePanel kind="empty" title={status==='__active'&&!q&&!service?'You’re all caught up':'No matching requests'} body={status==='__active'&&!q&&!service?'New ride requests will appear here.':'Try a different search or filter.'}/>}
 </div>;
}
