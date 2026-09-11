import { ArrowRight,Bell,CarFront,ClipboardPlus,Navigation,Phone,Users,RefreshCw,MessageSquareText } from 'lucide-react';
import { useEffect,useState } from 'react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../components/StatePanel';
import { serviceLabels,statusLabels } from '../components/RequestTable';
import { useRequests } from '../hooks';
import { buildOwnerNotifications,nextOperationalRide,rideCountdown,todaysRides } from '../lib/operations';
import { approvalStatuses,formatDate,formatTime,hasReconciliation,isOwnerActionRequest } from '../lib/selectors';
import type { RideRequest } from '../types';
import {TodayWorkspace,type TodayTask} from '../components/TodayWorkspace';
import '../owner-quick-actions.css';

const actionLabel=(request:RideRequest)=>hasReconciliation(request)?'Review request':approvalStatuses.has(request.status)?'Review and set price':'Review payment status';
const driveEligible=(request:RideRequest)=>['deposit_pending','confirmed','in_progress'].includes(request.status);
const OWNER_TIME_ZONE='America/New_York';

export function formatOwnerLocalTime(value:Date){
  return new Intl.DateTimeFormat('en-US',{timeZone:OWNER_TIME_ZONE,hour:'numeric',minute:'2-digit',hour12:true}).format(value);
}

export function dashboardReadStatus(loading:boolean,error:string){
  if(loading)return{tone:'loading',label:'Loading',description:'Loading current ride information.'};
  if(error)return{tone:'error',label:'Needs attention',description:'Current ride information could not be loaded.'};
  return{tone:'current',label:'Current',description:'Ride information loaded successfully.'};
}

export function DashboardClock({now,loading,error}:{now:Date;loading:boolean;error:string}){
  const status=dashboardReadStatus(loading,error),time=formatOwnerLocalTime(now);
  return <div className="dashboard-clock" aria-label={`Owner desk status: ${status.description}`} title={status.description}>
    <time dateTime={now.toISOString()} aria-label={`${time}, Eastern Time`}>{time}</time>
    {(loading||error)&&<span className={`dashboard-read-state state-${status.tone}`}>{status.label}</span>}
  </div>;
}

export function Dashboard(){
  const {data,loading,error,reload}=useRequests();
  const [now,setNow]=useState(()=>new Date());
  const [task,setTask]=useState<TodayTask|null>(null);
  useEffect(()=>{const timer=window.setInterval(()=>setNow(new Date()),60_000);return()=>window.clearInterval(timer)},[]);
  const attentionAll=data.filter(isOwnerActionRequest),attention=attentionAll.slice(0,4),today=todaysRides(data,now),nextRide=nextOperationalRide(data,now),notifications=buildOwnerNotifications(data,now);
  const paymentWarnings=data.filter(request=>request.status==='deposit_pending'||request.paymentStatus==='pending');
  const dateLabel=new Intl.DateTimeFormat('en-US',{timeZone:OWNER_TIME_ZONE,weekday:'long',month:'long',day:'numeric'}).format(now);
  return <div className="page dashboard-page" onClickCapture={event=>{
    if(task||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=(event.target as Element).closest('a');if(!anchor)return;
    const url=new URL(anchor.href,window.location.href);if(url.origin!==window.location.origin)return;
    const path=url.pathname.replace(/^\/admin(?=\/|$)/,'')||'/';
    const quick:Record<string,TodayTask>={'/expenses':'expense','/customers':'guests','/feedback':'feedback','/communications':'communications'};
    if(quick[path]||/^\/requests\/[^/]+$/.test(path)){event.preventDefault();setTask(quick[path]||path as TodayTask)}
  }}>
    <header className="page-head dashboard-head"><h1>Today</h1><div className="desk-today-status"><DashboardClock now={now} loading={loading} error={error}/><button className="desk-icon-action" onClick={reload} disabled={loading} aria-label="Refresh today’s rides"><RefreshCw aria-hidden/></button></div></header>
    <p className="desk-today-date">{dateLabel}</p>
    {loading?<StatePanel kind="loading" title="Preparing today’s run sheet"/>:error?<StatePanel kind="error" title="Requests could not be loaded" body={error} retry={reload}/>:<>
      <nav className="desk-day-summary" aria-label="Today totals">
        <Link to="/calendar"><strong>{today.length}</strong><span>Rides today</span><ArrowRight aria-hidden/></Link>
        <Link to="/requests"><strong>{attentionAll.length}</strong><span>Need a decision</span><ArrowRight aria-hidden/></Link>
        <Link to="/payments"><strong>{paymentWarnings.length}</strong><span>Payment pending</span><ArrowRight aria-hidden/></Link>
      </nav>
      {attentionAll.length>0&&<Link className="desk-priority-line" to={'/requests/'+attentionAll[0].id}><span><strong>{attentionAll.length} request{attentionAll.length===1?'':'s'} need{attentionAll.length===1?'s':''} your attention</strong><small>{attentionAll[0].customerName} · {actionLabel(attentionAll[0])}</small></span><ArrowRight aria-hidden/></Link>}
      <div className="desk-today-workspace">
        <section className="desk-next" aria-labelledby="next-ride-title">
          <div className="section-head"><h2 id="next-ride-title">{nextRide?.status==='in_progress'?'On the road':'Next pickup'}</h2><span className="desk-countdown">{nextRide?rideCountdown(nextRide,now):'Schedule clear'}</span></div>
          {nextRide?<>
            <div className="desk-next-heading"><time dateTime={nextRide.pickupDate+'T'+nextRide.pickupTime}>{formatTime(nextRide.pickupTime)}</time><span>{formatDate(nextRide.pickupDate)}<small>{serviceLabels[nextRide.service]} · {nextRide.passengers} passenger{nextRide.passengers===1?'':'s'}</small></span></div>
            <div className="desk-guest-line"><h3>{nextRide.customerName}</h3>{nextRide.phone&&!nextRide.customerDeleted&&<a className="desk-contact-guest desk-guest-phone" href={'tel:'+nextRide.phone.replace(/[^+\d]/g,'')} aria-label={'Call guest: '+nextRide.customerName} title={'Call '+nextRide.customerName}><Phone aria-hidden/></a>}</div>
            <ol className="desk-journey-route"><li><span>Pickup</span><strong>{nextRide.pickupAddress}</strong></li><li><span>Destination</span><strong>{nextRide.destinationAddress||nextRide.airport}</strong></li></ol>
            {(nextRide.status==='deposit_pending'||nextRide.paymentStatus==='pending')&&<p className="desk-payment-note">Payment is still pending. Review it before departure.</p>}
            <div className="desk-next-actions"><Link className="button primary" to={'/drive/'+nextRide.id}><Navigation aria-hidden/>Open Drive Mode</Link><Link className="button secondary" to={'/requests/'+nextRide.id}>Ride details <ArrowRight aria-hidden/></Link></div>
            {nextRide.paymentStatus==='paid'&&['confirmed','in_progress'].includes(nextRide.status)&&<Link className="desk-finish-link" to={'/requests/'+nextRide.id+'#decision'}>Finished this ride? Mark complete <ArrowRight aria-hidden/></Link>}
          </>:<div className="desk-next-empty"><Navigation aria-hidden/><h3>You’re clear for now.</h3><p>Your next scheduled or payment-pending ride will appear here.</p><Link className="button secondary" to="/calendar">Open calendar <ArrowRight aria-hidden/></Link></div>}
        </section>
        <section className="desk-decisions" aria-labelledby="needs-action-title"><div className="section-head"><h2 id="needs-action-title">Needs your attention</h2><Link to="/requests">View all <ArrowRight aria-hidden/></Link></div>
          {attention.length?<ul>{attention.map(request=><li key={request.id}><Link to={'/requests/'+request.id}><div><strong>{request.customerName}</strong><span>{serviceLabels[request.service]} · {formatDate(request.pickupDate)}<br/>{formatTime(request.pickupTime)}</span><small>{actionLabel(request)}</small></div><ArrowRight aria-hidden/></Link></li>)}</ul>:<p className="desk-clear-note">All caught up. New requests and decisions will appear here.</p>}
          <Link to="/notifications" className="desk-reminder-link"><Bell aria-hidden/><span>{notifications.length} active reminder{notifications.length===1?'':'s'}</span><ArrowRight aria-hidden/></Link>
        </section>
      </div>
      <section className="desk-run-sheet" aria-labelledby="today-rides-title"><div className="section-head"><h2 id="today-rides-title">Today’s schedule</h2><Link to="/calendar">Full calendar <ArrowRight aria-hidden/></Link></div>
        {today.length?<ol>{today.map(request=><li key={request.id}><time dateTime={request.pickupDate+'T'+request.pickupTime}>{formatTime(request.pickupTime)}</time><div><strong>{request.customerName}</strong><span>{serviceLabels[request.service]} · {request.pickupAddress}</span><small>{statusLabels[request.status]||request.status}</small></div><Link className="desk-schedule-action" to={(driveEligible(request)?'/drive/':'/requests/')+request.id}>{driveEligible(request)?'Drive Mode':'Details'}<ArrowRight aria-hidden/></Link></li>)}</ol>:<p className="desk-clear-note">No rides today. Your future rides are in the calendar.</p>}
      </section>
      <nav className="desk-shortcuts" aria-label="Owner quick links"><Link to="/manual-ride"><ClipboardPlus aria-hidden/><span>Phone or text request</span><ArrowRight aria-hidden/></Link><Link to="/expenses"><CarFront aria-hidden/><span>Record an expense</span><ArrowRight aria-hidden/></Link><Link to="/customers"><Users aria-hidden/><span>Find a guest</span><ArrowRight aria-hidden/></Link><Link to="/feedback"><MessageSquareText aria-hidden/><span>Guest feedback</span><ArrowRight aria-hidden/></Link><Link to="/communications"><Bell aria-hidden/><span>Customer emails</span><ArrowRight aria-hidden/></Link></nav>
    </>}
    {task&&<TodayWorkspace key={task} task={task} onClose={()=>{setTask(null);reload()}}/>}
  </div>;
}
