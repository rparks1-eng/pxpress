import { Activity, BarChart3, Bell, CalendarDays, CarFront, ChevronDown, LayoutDashboard, LogOut, Mail, Menu, ReceiptText, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { NotificationBanners } from '../features/owner-notifications/NotificationBanners';
import { OwnerNotificationsProvider, useOwnerNotifications } from '../features/owner-notifications/OwnerNotificationsProvider';
import { pxpressLogo } from '../brand';
import ownerPortrait from '../../../src/extensions/site/widgets/pxpress-exact-site/raishawn-parks-owner-portrait.png';
import { NotificationPeek } from './NotificationPeek';
import { OwnerThemeProvider } from './OwnerTheme';

const desktopLinks = [['/',LayoutDashboard,'Today'],['/requests',CarFront,'Requests'],['/calendar',CalendarDays,'Calendar'],['/customers',Users,'Customers'],['/notifications',Bell,'Notifications'],['/communications',Mail,'Customer emails'],['/analytics',BarChart3,'Analytics'],['/expenses',ReceiptText,'Expenses'],['/activity',Activity,'Activity'],['/more',Menu,'All tools']] as const;
const mobileLinks = [['/',LayoutDashboard,'Today'],['/requests',CarFront,'Requests'],['/calendar',CalendarDays,'Calendar'],['/customers',Users,'Guests'],['/more',Menu,'More']] as const;
const morePaths = new Set(['/more','/calendar/settings','/feedback','/notifications','/notification-settings','/email','/analytics','/expenses','/availability','/manual-ride','/payments','/communications','/vehicle-records','/tax-center','/activity']);

function UnreadBadge({count}:{count:number}) {
  return count > 0 ? <span className="nav-unread-badge" aria-hidden>{count > 99 ? '99+' : count}</span> : null;
}

function ShellFrame({children}:{children:React.ReactNode}) {
  const {user,signOut,signOutPending,signOutError,clearSignOutError} = useAuth();
  const location = useLocation();
  const {unreadCount} = useOwnerNotifications();
  const account = useRef<HTMLDetailsElement>(null);
  const requestSignOut = () => { clearSignOutError(); void signOut(); };
  useEffect(() => { if(account.current) account.current.open = false; }, [location.pathname]);
  useEffect(() => {
    const dismiss = (event:PointerEvent) => { if(account.current && !account.current.contains(event.target as Node)) account.current.open = false; };
    const escape = (event:KeyboardEvent) => { if(event.key === 'Escape' && account.current?.open) { account.current.open = false; account.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, []);

  return <div className="app-shell owner-desk">
    <a className="skip-link" href="#main-content">Skip to owner workspace</a>
    <aside className="sidebar">
      <Link to="/" replace className="sidebar-brand" aria-label="Pxpress owner desk home"><img src={pxpressLogo} alt="Pxpress"/><p>Owner Desk</p></Link>
      <nav aria-label="Owner navigation">{desktopLinks.map(([to,Icon,label]) => <NavLink key={to} to={to} replace end={to === '/'} aria-label={to === '/notifications' && unreadCount ? label+', '+unreadCount+' unread notification'+(unreadCount === 1 ? '' : 's') : label}>
        <Icon aria-hidden/><span>{label}</span>{to === '/notifications' && <UnreadBadge count={unreadCount}/>}
      </NavLink>)}</nav>
      <div className="owner-session"><div><ShieldCheck aria-hidden/><span>Private owner access</span></div><small>{user?.email}</small><button type="button" className="signout-button" onClick={requestSignOut} disabled={signOutPending}><LogOut aria-hidden/>{signOutPending ? 'Signing out…' : 'Sign out'}</button></div>
    </aside>
    <header className="desk-toolbar">
      <Link to="/" replace className="desk-mobile-brand" aria-label="Pxpress owner desk home"><img src={pxpressLogo} alt="Pxpress"/></Link>
      <span className="desk-workspace-label">Owner Desk</span>
      <div className="desk-toolbar-actions">
        <NotificationPeek/>
        <details ref={account} className="desk-account">
          <summary aria-label="Raishawn’s account"><img src={ownerPortrait} alt="Raishawn B. Parks"/><span>Raishawn</span><ChevronDown aria-hidden/></summary>
          <div className="desk-account-menu"><strong>Raishawn B. Parks</strong><small>{user?.email}</small><Link to="/settings" replace>Settings</Link><a href="https://pxpressllc.com/">Visit website</a><button type="button" onClick={requestSignOut} disabled={signOutPending}><LogOut aria-hidden/>{signOutPending ? 'Signing out…' : 'Sign out'}</button></div>
        </details>
      </div>
    </header>
    {signOutError && <div className="signout-feedback" role="alert"><span>{signOutError}</span><div><button type="button" onClick={requestSignOut} disabled={signOutPending}>{signOutPending ? 'Retrying…' : 'Try again'}</button><button type="button" onClick={clearSignOutError}>Dismiss</button></div></div>}
    <NotificationBanners/>
    <main id="main-content">{children}</main>
    <nav className="mobile-nav" aria-label="Owner navigation">{mobileLinks.map(([to,Icon,label]) => {
      const more = to === '/more';
      return <NavLink key={to} to={to} replace end={to === '/' || more} aria-label={more && unreadCount ? label+', '+unreadCount+' unread notification'+(unreadCount === 1 ? '' : 's') : label} className={more && morePaths.has(location.pathname) ? 'active' : undefined}><Icon aria-hidden/><span>{label}</span>{more && <UnreadBadge count={unreadCount}/>}</NavLink>;
    })}</nav>
  </div>;
}

export function Shell({children}:{children:React.ReactNode}) {
  return <OwnerThemeProvider><OwnerNotificationsProvider><ShellFrame>{children}</ShellFrame></OwnerNotificationsProvider></OwnerThemeProvider>;
}
