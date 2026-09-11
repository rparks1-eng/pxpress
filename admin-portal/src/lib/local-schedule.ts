import type { ScheduleCandidate, ScheduleConflict } from './schedule';
import { candidateWindow } from './schedule';

export type LocalAvailabilityBlock = { id: string; date: string; startTime: string; endTime: string; kind: 'available' | 'unavailable'; note: string };
export type LocalManualRideDraft = { id: string; guestName: string; pickupDate: string; pickupTime: string; endDate: string; endTime: string };

const VERSION = 1;
export const availabilityStorageKey = 'pxpress-owner-availability:v1';
export const manualRideStorageKey = 'pxpress-owner-manual-rides:v1';

type Envelope<T> = { version: 1; items: T[] };
const read = <T>(key: string): T[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    if (Array.isArray(parsed)) return parsed as T[];
    return parsed?.version === VERSION && Array.isArray(parsed.items) ? parsed.items as T[] : [];
  } catch { return []; }
};
const write = <T>(key: string, items: T[]) => {
  try { localStorage.setItem(key, JSON.stringify({ version: VERSION, items } satisfies Envelope<T>)); return true; }
  catch { return false; }
};

export const loadAvailabilityBlocks = () => read<LocalAvailabilityBlock>(availabilityStorageKey);
export const storeAvailabilityBlocks = (items: LocalAvailabilityBlock[]) => write(availabilityStorageKey, items);
export const loadManualRideDrafts = <T extends LocalManualRideDraft>() => read<T>(manualRideStorageKey);
export const storeManualRideDrafts = <T extends LocalManualRideDraft>(items: T[]) => write(manualRideStorageKey, items);

function localConflict(candidate: ScheduleCandidate, other: ScheduleCandidate, kindLabel: string): ScheduleConflict | null {
  const proposed = candidateWindow(candidate), existing = candidateWindow(other);
  if (!proposed || !existing || candidate.id === other.id) return null;
  const overlaps = proposed.start < existing.end && existing.start < proposed.end;
  if (overlaps) return { rideId: other.id || kindLabel, requestNumber: kindLabel, customerName: other.label, kind: 'overlap', minutesApart: 0, message: `Overlaps ${kindLabel}: ${other.label}.` };
  const gap = proposed.end <= existing.start
    ? Math.round((existing.start.getTime() - proposed.end.getTime()) / 60_000)
    : Math.round((proposed.start.getTime() - existing.end.getTime()) / 60_000);
  return gap >= 0 && gap < 60 ? { rideId: other.id || kindLabel, requestNumber: kindLabel, customerName: other.label, kind: 'tight_turnaround', minutesApart: gap, message: `Only ${gap} minutes between this ride and ${kindLabel}: ${other.label}.` } : null;
}

export function detectLocalScheduleConflicts(candidate: ScheduleCandidate, availability: LocalAvailabilityBlock[], drafts: LocalManualRideDraft[]) {
  const unavailable = availability.filter((block) => block.kind === 'unavailable').map((block): ScheduleCandidate => ({ id: block.id, label: block.note || 'Unavailable time', startDate: block.date, startTime: block.startTime, endDate: block.date, endTime: block.endTime }));
  const draftCandidates = drafts.map((draft): ScheduleCandidate => ({ id: draft.id, label: draft.guestName || 'Manual ride', startDate: draft.pickupDate, startTime: draft.pickupTime, endDate: draft.endDate, endTime: draft.endTime }));
  return [...unavailable.map((item) => localConflict(candidate, item, 'unavailable block')), ...draftCandidates.map((item) => localConflict(candidate, item, 'local draft'))].filter((item): item is ScheduleConflict => item !== null).sort((a, b) => a.kind === b.kind ? a.minutesApart - b.minutesApart : a.kind === 'overlap' ? -1 : 1);
}
