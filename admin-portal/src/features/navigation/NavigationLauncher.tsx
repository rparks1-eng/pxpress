import { Check, MapPinned } from 'lucide-react';
import { useMemo, useState } from 'react';
import {DriveDirectionsChooser} from '../drive-mode/DriveDirectionsChooser';
import type { RideRequest } from '../../types';
import {
  defaultNavigationStop,
  navigationStopsForRequest,
  saveNavigationProvider,
  type NavigationProvider,
  type NavigationStopKind,
} from './navigation';


export function NavigationLauncher({ request }: { request: RideRequest }) {
  const stops = useMemo(() => navigationStopsForRequest(request), [request]);
  const initialStop = defaultNavigationStop(stops);
  const [selectedKind, setSelectedKind] = useState<NavigationStopKind | undefined>(initialStop?.kind);
  const selectedStop = stops.find((stop) => stop.kind === selectedKind) || initialStop;
  const missingPickup = !stops.some((stop) => stop.kind === 'pickup');
  const missingDestination = !stops.some((stop) => stop.kind === 'destination');

  function chooseProvider(next: NavigationProvider) {
    saveNavigationProvider(next);
  }

  return <section className="navigation-launcher" aria-labelledby="navigation-title">
    <header className="navigation-launcher-head">
      <div>
        <p className="eyebrow">Owner navigation</p>
        <h3 id="navigation-title">{selectedStop ? `Next stop: ${selectedStop.label}` : 'Directions unavailable'}</h3>
        <p>{selectedStop?.address || 'Add a valid ride address before opening directions.'}</p>
      </div>
      <MapPinned aria-hidden/>
    </header>

    <div className="navigation-stop-list" role="radiogroup" aria-label="Choose a route stop">
      {stops.map((stop, index) => <button type="button" role="radio" aria-checked={stop.kind === selectedStop?.kind} className={stop.kind === selectedStop?.kind ? 'is-selected' : ''} key={stop.kind} onClick={() => setSelectedKind(stop.kind)}>
        <span className="navigation-stop-index">{stop.kind === selectedStop?.kind ? <Check aria-hidden/> : index + 1}</span>
        <span><strong>{stop.label}</strong><small>{stop.address}</small></span>
      </button>)}
    </div>

    {(missingPickup || missingDestination) && <p className="navigation-unavailable" role="status">
      {[missingPickup && 'Pickup unavailable', missingDestination && 'Destination unavailable'].filter(Boolean).join(' · ')}
    </p>}

    <DriveDirectionsChooser target={{stop:selectedStop||null,unavailableReason:"Choose a valid stop first."}} onProviderOpen={chooseProvider}/>
    <p className="navigation-handoff-note">Maps opens separately and may appear on CarPlay when connected. Return to this page with your phone’s app switcher.</p>
  </section>;
}
