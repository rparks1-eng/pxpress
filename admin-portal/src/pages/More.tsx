import { Activity,ArrowRight,BarChart3,Bell,CalendarRange,CarFront,ClipboardPlus,Landmark,Mail,MessagesSquare,ReceiptText,WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOwnerNotifications } from '../features/owner-notifications/OwnerNotificationsProvider';

const destinations=[
  {to:'/feedback',icon:MessagesSquare,title:'Guest feedback',detail:'Read every rating and review comments shared with permission'},
  {to:'/manual-ride',icon:ClipboardPlus,title:'Manual ride entry',detail:'Organize phone and text bookings in a local review draft'},
  {to:'/availability',icon:CalendarRange,title:'Availability',detail:'Plan working blocks and check ride conflicts on this device'},
  {to:'/notifications',icon:Bell,title:'Notifications',detail:'Ride reminders and items that need attention'},
  {to:'/email',icon:Mail,title:'Email',detail:'Read and respond from Raishawn’s owner-only Pxpress inbox'},
  {to:'/analytics',icon:BarChart3,title:'Analytics',detail:'Understand revenue, requests, and repeat guests'},
  {to:'/expenses',icon:ReceiptText,title:'Expenses',detail:'Track spending and keep your receipts'},
  {to:'/payments',icon:WalletCards,title:'Payment center',detail:'See paid rides and outstanding balances'},
  {to:'/communications',icon:MessagesSquare,title:'Communications',detail:'Preview customer emails and review their history'},
  {to:'/vehicle-records',icon:CarFront,title:'Vehicle & records',detail:'Maintenance reminders and vehicle documents'},
  {to:'/tax-center',icon:Landmark,title:'Tax Center',detail:'Review collected tax and prepare for filing'},
  {to:'/activity',icon:Activity,title:'Activity',detail:'Owner and system history'},
];

export function More(){const {unreadCount}=useOwnerNotifications();return <div className="page more-page"><header className="page-head"><div><p className="eyebrow">More</p><h1>Tools</h1></div></header><nav className="more-links" aria-label="More owner tools">{destinations.map(({to,icon:Icon,title,detail})=><Link key={to} to={to} aria-label={to==='/notifications'&&unreadCount?`${title}, ${unreadCount} unread notification${unreadCount===1?'':'s'}`:undefined}><Icon aria-hidden/><span><strong>{title}{to==='/notifications'&&unreadCount>0&&<span className="tool-unread-badge" aria-hidden>{unreadCount>99?'99+':unreadCount}</span>}</strong><small>{detail}</small></span><ArrowRight aria-hidden/></Link>)}</nav></div>}
