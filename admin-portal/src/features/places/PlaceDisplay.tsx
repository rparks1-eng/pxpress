import type { RideRequest, RoutePlaceKind } from '../../types';
import { placeCategoryLabel, placeForRequest, routeAddress } from './place-metadata';

export function PlaceDisplay({ request, kind }: { request: RideRequest; kind: RoutePlaceKind }) {
  const place = placeForRequest(request, kind);
  const address = routeAddress(request, kind);
  const category = placeCategoryLabel(place);
  return <span className="place-display">
    {place?.displayName && <strong className="place-display-name">{place.displayName}</strong>}
    <span className={place?.displayName ? 'place-display-address' : 'place-display-address is-primary'}>{address || 'Not provided'}</span>
    {category && <span className="place-category">{category}</span>}
  </span>;
}
