import {ArrowLeft} from 'lucide-react';
import {Link,useLocation,useNavigate} from 'react-router-dom';
const labels:Record<string,string>={'/':'Today','/requests':'Ride requests','/calendar':'Calendar','/notifications':'Notifications'};
export function OwnerReturnLink(){
 const location=useLocation(),navigate=useNavigate();
 const candidate=location.state?.ownerReturn;
 const path=typeof candidate==='string'&&Object.hasOwn(labels,candidate)?candidate:'/requests';
 return <Link className="back-link" to={path} replace onClick={event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  // Pop a detail entry instead of creating another copy of its parent in history.
  if(candidate===path&&typeof window.history.state?.idx==='number'&&window.history.state.idx>0){event.preventDefault();void navigate(-1);}
 }}><ArrowLeft aria-hidden/>{labels[path]}</Link>;
}
