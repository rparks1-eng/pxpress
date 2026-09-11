import { useEffect,useRef,useState,type CSSProperties,type PointerEvent } from 'react';
import { AlertTriangle,Bell,CalendarClock,CircleX,ReceiptText,TriangleAlert,X } from 'lucide-react';
import { Link,useLocation } from 'react-router-dom';
import { notificationCategory,notificationCategoryLabel,safeNotificationRoute } from './domain';
import { useOwnerNotifications } from './OwnerNotificationsProvider';
import './notification-banner-gesture.css';

const iconFor={new_request:Bell,upcoming:CalendarClock,payment_pending:ReceiptText,payment_received:ReceiptText,payment_failed:TriangleAlert,cancellation:CircleX,tax_review:ReceiptText,conflict:AlertTriangle,system_error:TriangleAlert} as const;

export function NotificationBanners(){
  const {banners,dismissBanner,markRead}=useOwnerNotifications(),location=useLocation();
  const record=banners[0];
  const gesture=useRef<{id:number;x:number;y:number;moved:boolean}|null>(null);
  const suppressClick=useRef(false);
  const [offset,setOffset]=useState(0);
  useEffect(()=>{gesture.current=null;suppressClick.current=false;setOffset(0)},[record?.notification.id]);
  const startGesture=(event:PointerEvent<HTMLElement>)=>{
    if(!event.isPrimary||event.button!==0)return;
    suppressClick.current=false;
    gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  };
  const moveGesture=(event:PointerEvent<HTMLElement>)=>{
    const start=gesture.current;
    if(!start||start.id!==event.pointerId)return;
    const x=event.clientX-start.x,y=event.clientY-start.y;
    if(Math.abs(x)>8||Math.abs(y)>8){start.moved=true;suppressClick.current=true}
    if(y< -8&&Math.abs(y)>Math.abs(x)){
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setOffset(Math.max(-120,y));
    }else setOffset(0);
  };
  const endGesture=(event:PointerEvent<HTMLElement>)=>{
    const start=gesture.current;
    if(!start||start.id!==event.pointerId)return;
    const x=event.clientX-start.x,y=event.clientY-start.y;
    gesture.current=null;setOffset(0);
    if(y<=-40&&Math.abs(y)>Math.abs(x)&&record){
      suppressClick.current=true;
      dismissBanner(record.notification.id);
    }
  };
  useEffect(()=>{
    if(!record)return;
    const timer=window.setTimeout(()=>dismissBanner(record.notification.id),8_000);
    return()=>window.clearTimeout(timer);
  },[dismissBanner,record]);
  if(location.pathname.startsWith('/drive/'))return null;
  if(!record)return null;
  const item=record.notification,Icon=iconFor[item.kind],route=safeNotificationRoute(item),category=notificationCategory(item.kind);
  return <section className="owner-banner-stack" aria-label="New notification" aria-live="polite"><article key={item.id} className={`owner-banner owner-banner-swipe category-${category} priority-${item.priority}${offset<0?' is-swiping':''}`}
    style={{'--banner-swipe-y':`${offset}px`,'--banner-swipe-opacity':1-Math.abs(offset)/180} as CSSProperties}
    onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture}
    onPointerCancel={()=>{gesture.current=null;setOffset(0)}}
    onLostPointerCapture={()=>{gesture.current=null;setOffset(0)}}
    onClickCapture={event=>{if(suppressClick.current&&event.detail!==0){event.preventDefault();event.stopPropagation();suppressClick.current=false}}}>
    <span className="owner-banner-icon"><Icon aria-hidden/></span>
    <div className="owner-banner-copy"><span>{notificationCategoryLabel(category)}</span><strong>{item.title}</strong><p>{item.detail}</p></div>
    <div className="owner-banner-actions">{route&&<Link to={route} onClick={()=>markRead(item.id)}>Open</Link>}<button type="button" onClick={()=>dismissBanner(item.id)} aria-label={`Dismiss ${item.title} banner`}><X aria-hidden/></button></div>
    <span className="owner-banner-timer" aria-hidden/>
  </article></section>;
}
