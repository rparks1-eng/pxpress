const SERVICE_LABELS: Readonly<Record<string,string>> = Object.freeze({
  airport: 'Airport transportation',
  appointment: 'Appointment transportation',
  point: 'Point-to-point transportation',
  events: 'Events and corporate transportation',
  hourly: 'Hourly transportation',
});

/** Customer- and owner-facing label; the stored service code is unchanged. */
export function rideServiceLabel(value: string): string {
  const normalized=value.trim().toLowerCase();
  return SERVICE_LABELS[normalized] ?? value.trim();
}
