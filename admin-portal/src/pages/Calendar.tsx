import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Settings as Settings2,
  Navigation,
  Phone,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { serviceLabels } from "../components/RequestTable";
import "./calendar-dispatch.css";
import { StatePanel } from "../components/StatePanel";
import { useRequests } from "../hooks";
import {
  getGoogleCalendarConnection,
  startGoogleCalendarConnection,
} from "../lib/repository";
import { formatDate, formatTime } from "../lib/selectors";
import { businessDateKey } from "../lib/business-date";
import { isSupabaseConfigured } from "../lib/supabase";
import type { GoogleCalendarConnection, RideRequest } from "../types";

export const PXPRESS_BASE = "10273 Maryland St., Reminderville, OH 44202";
const scheduledStatuses = new Set([
  "deposit_pending",
  "confirmed",
  "in_progress",
]);
export const scheduledRequests = (items: RideRequest[]) =>
  items
    .filter((item) => scheduledStatuses.has(item.status))
    .sort((a, b) =>
      `${a.pickupDate}T${a.pickupTime}`.localeCompare(
        `${b.pickupDate}T${b.pickupTime}`,
      ),
    );
export const upcomingScheduledRequests = (items: RideRequest[], now = new Date()) => {
  const today = businessDateKey(now);
  return scheduledRequests(items).filter((item) => `${item.pickupDate}T${item.pickupTime}` >= `${today}T00:00`).slice(0, 8);
};
export const calendarRideState=(ride:RideRequest)=>ride.status==='deposit_pending'?{key:'tentative',label:'Tentative / awaiting payment'}:ride.status==='in_progress'?{key:'progress',label:'In progress'}:{key:'paid',label:'Paid / confirmed'};
type GoogleCallbackResult='connected'|'denied'|'failed'|'invalid'|null;
export const googleCalendarCallbackMessage=(result:GoogleCallbackResult,readback?:GoogleCalendarConnection,error=false):string=>{
  if(result==='denied')return 'Google Calendar connection was cancelled.';
  if(result==='failed'||result==='invalid')return 'Google Calendar could not be connected.';
  if(result!=='connected')return '';
  if(error)return 'Google Calendar returned from setup, but the owner desk could not verify the connection. Retry the status check.';
  if(!readback)return 'Checking Google Calendar connection…';
  if(readback.connected&&readback.syncEnabled)return 'Google Calendar connected. Accepted rides will now sync automatically.';
  if(readback.connected)return 'Google Calendar is connected, but automatic accepted-ride sync is paused.';
  return 'Google Calendar returned from setup, but the connection was not confirmed. Retry or reconnect before expecting ride sync.';
};
const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    date,
  );
const dateKey = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;


export function Calendar() {
  const requests=useRequests(), location=useLocation();
  if(new URLSearchParams(location.search).has('google')) return <Navigate to={'/calendar/settings'+location.search} replace/>;
  if(requests.loading) return <StatePanel kind="loading" title="Loading your rides"/>;
  if(requests.error) return <StatePanel kind="error" title="Your calendar could not be loaded" body="Please try again to see your latest rides." retry={requests.reload}/>;
  return <CalendarContent items={requests.data}/>;
}
export function CalendarContent({items}:{items:RideRequest[]}) {
  const today=businessDateKey(new Date());
  const [selected,setSelected]=useState(today);
  const [month,setMonth]=useState(()=>new Date(today+'T12:00:00'));
  const [showMonth,setShowMonth]=useState(false);
  const scheduled=useMemo(()=>scheduledRequests(items),[items]);
  const year=month.getFullYear(), monthIndex=month.getMonth(), offset=new Date(year,monthIndex,1).getDay(), days=new Date(year,monthIndex+1,0).getDate();
  const cells=Array.from({length:Math.ceil((offset+days)/7)*7},(_,i)=>i-offset+1);
  const dayRides=scheduled.filter(ride=>ride.pickupDate===selected);
  const next=scheduled.find(ride=>ride.pickupDate>selected);
  const chosenDate=new Date(selected+'T12:00:00');
  const weekStart=new Date(chosenDate);weekStart.setDate(weekStart.getDate()-weekStart.getDay());
  const visibleDates=showMonth?cells.map(day=>day<1||day>days?null:dateKey(year,monthIndex,day)):Array.from({length:7},(_,i)=>{const day=new Date(weekStart);day.setDate(day.getDate()+i);return dateKey(day.getFullYear(),day.getMonth(),day.getDate())});
  function choose(key:string){setSelected(key);setMonth(new Date(key+'T12:00:00'))}
  function move(delta:number){const d=showMonth?new Date(year,monthIndex+delta,1):new Date(chosenDate);if(!showMonth)d.setDate(d.getDate()+delta*7);choose(dateKey(d.getFullYear(),d.getMonth(),d.getDate()))}
  return <div className="page dispatch-calendar">
    <header className="page-head"><h1>Calendar</h1><Link className="dispatch-settings" to="/calendar/settings" aria-label="Calendar settings"><Settings2 aria-hidden/></Link></header>
    <div className="dispatch-calendar-workspace">
      <section className="dispatch-month" aria-label="Choose a day">
        <div className="dispatch-month-toolbar"><button type="button" className="dispatch-month-toggle" aria-expanded={showMonth} aria-controls="dispatch-date-picker" aria-label={showMonth?'Show week':'Show month'} onClick={()=>setShowMonth(value=>!value)}><span aria-live="polite">{monthLabel(month)}</span><ChevronDown aria-hidden/></button><button type="button" className="dispatch-today" onClick={()=>choose(today)}>Today</button><button type="button" onClick={()=>move(-1)} aria-label={showMonth?'Previous month':'Previous week'}><ChevronLeft aria-hidden/></button><button type="button" onClick={()=>move(1)} aria-label={showMonth?'Next month':'Next week'}><ChevronRight aria-hidden/></button></div>
        <div className="dispatch-weekdays" aria-hidden>{['S','M','T','W','T','F','S'].map((day,i)=><span key={i}>{day}</span>)}</div>
        <div className="dispatch-dates" id="dispatch-date-picker">{visibleDates.map((key,index)=>{
          if(!key) return <span key={'blank-'+index} aria-hidden/>;
          const day=Number(key.slice(-2)), rides=scheduled.filter(ride=>ride.pickupDate===key);
          const label=new Date(key+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
          return <button type="button" key={key} className={key===selected?'is-selected':undefined} aria-pressed={key===selected} aria-current={key===today?'date':undefined} aria-label={label+(key===today?', today':'')+', '+rides.length+' rides'} onClick={()=>choose(key)}><span>{day}</span><span className="dispatch-date-markers" aria-hidden>{rides.length>0&&<i/>}</span></button>;
        })}</div>
        <p className="dispatch-calendar-key"><i aria-hidden/>Ride scheduled<span>All times Eastern</span></p>
      </section>
      <section className="dispatch-day" aria-label="Selected day rides">
        <header><div><h2>{selected===today?'Today':chosenDate.toLocaleDateString('en-US',{weekday:'long'})}</h2><p>{chosenDate.toLocaleDateString('en-US',{month:'long',day:'numeric'})}</p></div><span aria-live="polite">{dayRides.length} ride{dayRides.length===1?'':'s'}</span></header>
        {dayRides.length?<ol className="dispatch-appointments">{dayRides.map(ride=><li key={ride.id}>
          <div className="dispatch-appointment-time"><time dateTime={ride.pickupDate+'T'+ride.pickupTime}>{formatTime(ride.pickupTime)}</time><span data-state={calendarRideState(ride).key}>{calendarRideState(ride).label}</span></div>
          <Link className="dispatch-appointment-heading" to={'/requests/'+ride.id} state={{ownerReturn:'/calendar'}}><div><h3>{ride.customerName}</h3><p>{serviceLabels[ride.service]} · {ride.passengers} guest{ride.passengers===1?'':'s'}</p></div><ChevronRight aria-hidden/></Link>
          <ol className="dispatch-route"><li><span>Pickup</span><strong>{ride.pickupAddress}</strong></li><li><span>Destination</span><strong>{ride.destinationAddress||ride.airport||'See ride details'}</strong></li></ol>
          <div className="dispatch-ride-actions">{ride.status==='deposit_pending'?<Link className="button secondary" to={'/requests/'+ride.id}>Review payment</Link>:<Link className="button primary" to={'/drive/'+ride.id}><Navigation aria-hidden/>Drive Mode</Link>}{ride.phone&&!ride.customerDeleted&&<a className="dispatch-call" href={'tel:'+ride.phone.replace(/[^+\d]/g,'')}><Phone aria-hidden/>Call guest</a>}</div>
        </li>)}</ol>:<div className="dispatch-day-empty"><h3>No rides scheduled</h3><p>{selected===today?'Your day is clear.':'There are no scheduled rides on this date.'}</p>{next&&<button className="button secondary" type="button" onClick={()=>choose(next.pickupDate)}>Next ride · {formatDate(next.pickupDate)}<ChevronRight aria-hidden/></button>}<Link to="/requests">View ride requests<ChevronRight aria-hidden/></Link></div>}
      </section>
    </div>
  </div>;
}
export function CalendarSettings() {
  const [connection, setConnection] = useState<GoogleCalendarConnection>({
      connected: false,
      syncEnabled: false,
    }),
    [connectionBusy, setConnectionBusy] = useState(false),
    [connectionLoading,setConnectionLoading]=useState(true),
    [connectionError,setConnectionError]=useState(""),
    [connectionMessage, setConnectionMessage] = useState("");
  const location = useLocation();
  const callbackResult=useMemo(()=>{const result=new URLSearchParams(location.search).get('google');return ['connected','denied','failed','invalid'].includes(String(result))?result as Exclude<GoogleCallbackResult,null>:null},[location.search]);
  const loadConnection=useCallback(async()=>{setConnectionLoading(true);setConnectionError("");if(callbackResult==='connected')setConnectionMessage(googleCalendarCallbackMessage(callbackResult));try{const readback=await getGoogleCalendarConnection();setConnection(readback);if(callbackResult==='connected')setConnectionMessage(googleCalendarCallbackMessage(callbackResult,readback))}catch(error){setConnectionError(error instanceof Error?error.message:"Google Calendar status could not be checked.");if(callbackResult==='connected')setConnectionMessage(googleCalendarCallbackMessage(callbackResult,undefined,true))}finally{setConnectionLoading(false)}},[callbackResult]);
  useEffect(() => {void loadConnection()}, [loadConnection]);
  useEffect(() => {
    if(callbackResult!=='connected')setConnectionMessage(googleCalendarCallbackMessage(callbackResult));
  }, [callbackResult]);

  async function connectGoogle() {
    setConnectionBusy(true);
    setConnectionMessage("");
    try {
      const url = await startGoogleCalendarConnection();
      window.location.assign(url);
    } catch (e) {
      setConnectionMessage(
        e instanceof Error
          ? e.message
          : "Google Calendar could not be connected.",
      );
      setConnectionBusy(false);
    }
  }

  return <div className="page dispatch-calendar-settings"><Link className="dispatch-back" to="/calendar"><ArrowLeft aria-hidden/>Calendar</Link><header className="page-head"><h1>Calendar settings</h1></header>
      <section
        className="calendar-guardrails"
        aria-label="Google Calendar settings"
      >
        <article>
          <CalendarCheck2 aria-hidden />
          <div>
            <p className="eyebrow">Google Calendar</p>
            <h2>
              {connectionLoading?"Checking connection":connectionError?"Connection status unavailable":connection.connected ? "Connected" : "Connection not configured"}
            </h2>
            <p>
              {connectionError
                ? "The owner desk could not verify Google Calendar. Retry the check before connecting or assuming it is disconnected."
                : connection.connected
                ? `${connection.googleEmail || "Raishawn’s Google account"} · ${connection.syncEnabled ? "Automatic accepted-ride sync is on." : "Connection saved; automatic sync is paused."}`
                : "Connect your Google calendar to keep your rides together."}
            </p>
            {connectionMessage && (
              <p className="connection-message" role="status">
                {connectionMessage}
              </p>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={connectionError?loadConnection:connectGoogle}
              disabled={
                !isSupabaseConfigured || connectionBusy || connectionLoading || (!connectionError&&connection.connected)
              }
              title={!isSupabaseConfigured
                ? 'The private server connection must be completed first.'
                : connection.connected
                  ? 'Google Calendar is already connected. Connection changes are managed through the secure account flow.'
                  : undefined}
            >
              <RefreshCw aria-hidden />
              {connectionLoading
                ? "Checking connection…"
                : connectionError
                  ? "Retry connection check"
                : connection.connected
                ? "Google Calendar connected"
                : connectionBusy
                  ? "Opening Google…"
                  : isSupabaseConfigured
                    ? "Connect Google Calendar"
                    : "Connect after server setup"}
            </button>
          </div>
        </article>
      </section>

  </div>;
}
