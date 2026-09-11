import { useMemo,useState } from 'react';
import { AlertTriangle,Bell,CalendarClock,Check,Clock3,CreditCard,Settings,TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatePanel } from '../components/StatePanel';
import { notificationCategory,notificationCategoryLabel,safeNotificationRoute,type NotificationFilter } from '../features/owner-notifications/domain';
import { useOwnerNotifications } from '../features/owner-notifications/OwnerNotificationsProvider';
import { formatDateTime } from '../lib/selectors';

const filters:NotificationFilter[]=['all','requests','rides','payments','operations'];
const iconFor={requests:Bell,rides:CalendarClock,payments:CreditCard,operations:TriangleAlert} as const;

export function Notifications(){
  const {records,unreadCount,loading,error,reload,markRead,markAllRead}=useOwnerNotifications();
  const [filter,setFilter]=useState<NotificationFilter>('all');
  const [unreadOnly,setUnreadOnly]=useState(false);
  const counts=useMemo(()=>Object.fromEntries(filters.map(key=>[key,records.filter(record=>(key==='all'||notificationCategory(record.notification.kind)===key)&&(!unreadOnly||!record.read)).length])),[records,unreadOnly]);
  const visible=useMemo(()=>records.filter(record=>(filter==='all'||notificationCategory(record.notification.kind)===filter)&&(!unreadOnly||!record.read)),[filter,records,unreadOnly]);
  if(loading&&!records.length)return <StatePanel kind="loading" title="Checking today’s reminders"/>;
  if(error&&!records.length)return <StatePanel kind="error" title="Notifications could not be prepared" body={error} retry={reload}/>;
  return <div className="page notifications-page"><header className="page-head notification-head"><div><p className="eyebrow">Notification center</p><h1>Notifications</h1><p>{unreadCount?`${unreadCount} item${unreadCount===1?'':'s'} need your attention.`:'You are all caught up.'}</p></div><div className="notification-page-actions"><Link className="notification-settings-link" to="/notification-settings" aria-label="Notification settings"><Settings aria-hidden/> Settings</Link><button type="button" className="notification-read-all" onClick={markAllRead} disabled={!unreadCount}><Check aria-hidden/> Mark all read</button></div></header><div className="notification-toolbar"><nav aria-label="Notification categories">{filters.map(key=><button type="button" key={key} className={filter===key?'is-active':''} onClick={()=>setFilter(key)}><span>{key==='all'?'All':notificationCategoryLabel(key)}</span><b>{counts[key]||0}</b></button>)}</nav><label><input type="checkbox" checked={unreadOnly} onChange={event=>setUnreadOnly(event.target.checked)}/><span>Unread only</span></label></div>{visible.length?<ol className="notification-list">{visible.map(record=>{const item=record.notification,route=safeNotificationRoute(item),category=notificationCategory(item.kind),Icon=iconFor[category];return <li key={item.id} className={`${record.read?'is-read':''} ${record.active?'':'is-history'} category-${category} priority-${item.priority}`}><Link className="notification-row-link" to={route||'/notifications'} replace={!route} onClick={()=>markRead(item.id)} aria-label={item.title}><div className="notification-mark"><Icon aria-hidden/></div><div className="notification-copy"><div className="notification-meta"><span>{notificationCategoryLabel(category)}</span><time><Clock3 aria-hidden/>{formatDateTime(item.at)}</time>{!record.active&&<em>Past</em>}</div><div className="notification-title"><strong>{item.title}</strong>{record.active&&!record.read&&<i aria-label="Unread"/>}</div><p>{item.detail}</p></div></Link><div className="notification-actions"><button type="button" aria-label={(record.read?'Mark unread: ':'Mark read: ')+item.title} onClick={()=>markRead(item.id,!record.read)}><Check aria-hidden/></button></div></li>})}</ol>:<div className="notification-empty"><AlertTriangle aria-hidden/><strong>Nothing in this view</strong><span>Try another category or turn off the unread filter.</span></div>}</div>;
}
