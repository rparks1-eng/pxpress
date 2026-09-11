import type { RideRequest } from '../../types';
import { businessDateKey } from '../../lib/business-date';

export type RepeatedAddress = { address: string; appearances: number; roles: Array<'pickup' | 'destination' | 'return'> };

export type GuestProfileSummary = {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  history: RideRequest[];
  nextRide?: RideRequest;
  lastCompletedRide?: RideRequest;
  repeatedAddresses: RepeatedAddress[];
  totalQuoted: number;
  totalPaid: number;
};

const terminalStatuses = new Set<RideRequest['status']>(['completed', 'declined', 'expired', 'cancelled', 'refunded']);
const rideMoment = (request: RideRequest) => `${request.pickupDate}T${request.pickupTime || '00:00'}`;

export function inferRepeatedAddresses(requests: RideRequest[]): RepeatedAddress[] {
  const values = new Map<string, RepeatedAddress>();
  const add = (address: string | undefined, role: RepeatedAddress['roles'][number]) => {
    const trimmed = address?.trim();
    if (!trimmed) return;
    const key = trimmed.toLocaleLowerCase();
    const existing = values.get(key) ?? { address: trimmed, appearances: 0, roles: [] };
    existing.appearances += 1;
    if (!existing.roles.includes(role)) existing.roles.push(role);
    values.set(key, existing);
  };
  requests.forEach((request) => {
    add(request.pickupAddress, 'pickup');
    add(request.destinationAddress, 'destination');
    add(request.returnAddress, 'return');
  });
  return [...values.values()].filter((row) => row.appearances > 1).sort((a, b) => b.appearances - a.appearances || a.address.localeCompare(b.address));
}

export function buildGuestProfile(requests: RideRequest[], customerId: string, now = new Date()): GuestProfileSummary | null {
  const history = requests.filter((request) => request.customerId === customerId && !request.customerDeleted).sort((a, b) => rideMoment(b).localeCompare(rideMoment(a)));
  if (!history.length) return null;
  const today = businessDateKey(now);
  const nextRide = history.filter((request) => request.pickupDate >= today && !terminalStatuses.has(request.status)).sort((a, b) => rideMoment(a).localeCompare(rideMoment(b)))[0];
  const lastCompletedRide = history.filter((request) => request.status === 'completed' && request.pickupDate <= today).sort((a, b) => rideMoment(b).localeCompare(rideMoment(a)))[0];
  const contact = history.find((request) => request.customerName && request.email && request.phone) ?? history[0];
  return {
    customerId,
    name: contact.customerName,
    email: contact.email,
    phone: contact.phone,
    history,
    nextRide,
    lastCompletedRide,
    repeatedAddresses: inferRepeatedAddresses(history),
    totalQuoted: history.reduce((total, request) => total + (request.quoteAmount ?? 0), 0),
    totalPaid: history.filter((request) => request.paymentStatus === 'paid').reduce((total, request) => total + (request.quoteAmount ?? 0), 0),
  };
}
