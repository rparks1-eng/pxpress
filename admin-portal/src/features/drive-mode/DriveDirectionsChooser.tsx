import { ExternalLink, Map, MapPin, Navigation } from 'lucide-react';
import { navigationProviderLabel, navigationUrl, type DriveNavigationTarget, type NavigationProvider } from '../navigation/navigation';

const providers: { id: NavigationProvider; Icon: typeof MapPin }[] = [
  { id: 'apple', Icon: Map },
  { id: 'google', Icon: MapPin },
  { id: 'waze', Icon: Navigation },
];

export function DriveDirectionsChooser({ target, onProviderOpen }: { target: DriveNavigationTarget; onProviderOpen: (provider: NavigationProvider) => void }) {
  const descriptionId = 'drive-directions-description';
  return <section className="drive-directions" aria-labelledby="drive-directions-title">
    <div className="drive-directions-copy">
      <span id="drive-directions-title">Open directions with</span>
      <strong>{target.stop?.label || 'Directions unavailable'}</strong>
      <small id={descriptionId}>{target.stop?.address || target.unavailableReason}</small>
    </div>
    <div className="drive-map-choices" role="group" aria-label={target.stop ? `Open directions to ${target.stop.label}` : 'Directions unavailable'}>
      {providers.map(({ id, Icon }) => {
        const label = navigationProviderLabel(id);
        const href = target.stop ? navigationUrl(id, target.stop.address) : null;
        const content = <><span className={`drive-map-mark mark-${id}`} aria-hidden><Icon/></span><span>{label}</span>{href && <ExternalLink aria-hidden/>}</>;
        return href
          ? <a key={id} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${target.stop!.label} directions with ${label}`} onClick={() => onProviderOpen(id)}>{content}</a>
          : <button key={id} type="button" disabled aria-describedby={descriptionId}>{content}</button>;
      })}
    </div>
  </section>;
}
