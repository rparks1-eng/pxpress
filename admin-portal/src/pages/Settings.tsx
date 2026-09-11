import { Bell, CalendarDays, MoonStar, Settings as SystemIcon, Sun, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { useOwnerTheme, type OwnerTheme } from '../components/OwnerTheme';
import { CalendarSettings } from './Calendar';
import { NotificationSettings } from './NotificationSettings';

const sections = [['account', 'Account', UserRound], ['appearance', 'Appearance', Sun], ['notifications', 'Notifications', Bell], ['calendar', 'Calendar', CalendarDays]] as const;
type Section = typeof sections[number][0];
const themes = [['light', 'Light', Sun], ['dark', 'Dark', MoonStar], ['system', 'System', SystemIcon]] as const;

export function Settings() {
  const { user } = useAuth();
  const location = useLocation();
  const [section, setSection] = useState<Section>(() => {
    const requested = new URLSearchParams(location.search).get('section');
    if (new URLSearchParams(location.search).has('google')) return 'calendar';
    return sections.some(([key]) => key === requested) ? requested as Section : 'account';
  });
  const { theme, resolvedTheme, setTheme, storageError } = useOwnerTheme();
  return <div className="page desk-settings-page">
    <header className="page-head"><div><h1>Settings</h1><p>Your account, appearance, and connected services.</p></div></header>
    <nav className="desk-settings-sections" aria-label="Settings sections">
      {sections.map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={section === key} aria-controls="desk-settings-content" onClick={() => setSection(key)}><Icon aria-hidden="true"/>{label}</button>)}
    </nav>
    <section id="desk-settings-content" className="desk-settings-content" aria-label={sections.find(([key]) => key === section)?.[1]}>
      {section === 'account' && <><h2>Account</h2><dl className="desk-account-facts"><div><dt>Signed in as</dt><dd>{user?.email || 'Email unavailable'}</dd></div><div><dt>Workspace</dt><dd>Pxpress Owner Desk</dd></div></dl><Link className="button" to="/mfa-setup?add=1">Add another authenticator</Link><p className="desk-settings-help">Use the account menu to sign out.</p></>}
      {section === 'appearance' && <><h2>Appearance</h2><p className="desk-settings-help">Choose how Owner Desk looks on this device. System follows your device’s appearance.</p><fieldset className="desk-theme-choices"><legend className="sr-only">Color theme</legend>{themes.map(([key, label, Icon]) => <label key={key} className={`desk-theme-choice ${theme === key ? 'is-selected' : ''}`}><input type="radio" name="owner-theme" value={key} checked={theme === key} onChange={() => setTheme(key as OwnerTheme)}/><Icon aria-hidden="true"/><span>{label}</span></label>)}</fieldset><p className="desk-settings-help" role="status">{theme === 'system' ? `Following your device: ${resolvedTheme}.` : `${theme === 'light' ? 'Light' : 'Dark'} appearance selected.`}</p>{storageError && <p role="alert" className="form-error">{storageError}</p>}</>}
      {section === 'notifications' && <div className="desk-settings-embedded"><h2>Notifications</h2><NotificationSettings/></div>}
      {section === 'calendar' && <div className="desk-settings-embedded"><h2>Calendar</h2><CalendarSettings/></div>}
    </section>
  </div>;
}
