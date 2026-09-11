import { useEffect,useRef,useState } from 'react';
import { Bell,ChevronRight,X } from 'lucide-react';
import { Link,useLocation } from 'react-router-dom';
import { useOwnerNotifications } from '../features/owner-notifications/OwnerNotificationsProvider';
import { safeNotificationRoute } from '../features/owner-notifications/domain';

export function NotificationPeek(){
 const {records,unreadCount,loading,error,markRead,reload}=useOwnerNotifications(),[open,setOpen]=useState(false),box=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),location=useLocation();
 useEffect(()=>setOpen(false),[location.pathname]);
 useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false)},escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[open]);
 const visible=records.filter(r=>r.active).slice(0,4);
 return <div className="desk-notification-peek" ref={box}><button ref={trigger} type="button" className="desk-notification-bell" aria-label={`Open notification center${unreadCount?', '+unreadCount+' unread':''}`} aria-expanded={open} aria-controls="desk-notification-peek" onClick={()=>setOpen(v=>!v)}><Bell aria-hidden/>{unreadCount>0&&<span className="desk-bell-count" aria-hidden>{unreadCount>99?'99+':unreadCount}</span>}</button>{open&&<section className="desk-peek-panel" id="desk-notification-peek" aria-label="Notification center"><header><h2>Notifications</h2><button type="button" aria-label="Close notifications" onClick={()=>{setOpen(false);trigger.current?.focus()}}><X aria-hidden/></button></header>{error?<p role="alert">Couldn’t refresh notifications. <button onClick={reload}>Try again</button></p>:loading&&!visible.length?<p>Checking your latest updates…</p>:visible.length?<ul>{visible.map(r=><li key={r.notification.id} className={r.read?'is-read':''}><Link to={safeNotificationRoute(r.notification)||'/notifications'} onClick={()=>markRead(r.notification.id)}><span><strong>{r.notification.title}</strong><small>{r.notification.detail}</small></span><ChevronRight aria-hidden/></Link></li>)}</ul>:<p>You’re all caught up.</p>}<Link className="desk-peek-all" to="/notifications">View all notifications <ChevronRight aria-hidden/></Link></section>}</div>;
}
