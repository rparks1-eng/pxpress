import type { RideRequest } from '../types';
import { formatTime } from './selectors';

export type ScheduleWindow = {
  id: string;
  label: string;
  start: Date;
  end: Date;
};

export type ScheduleCandidate = {
  id?: string;
  label: string;
  startDate: string;
  startTime: string;
  endDate?: string;
  endTime: string;
};

export type ScheduleConflict = {
  rideId: string;
  requestNumber: string;
  customerName: string;
  kind: 'overlap' | 'tight_turnaround';
  minutesApart: number;
  message: string;
};

export const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const hour = Math.floor(index / 4);
  const minute = (index % 4) * 15;
  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { value, label: formatTime(value) };
});
const scheduledStatuses = new Set<RideRequest['status']>(['deposit_pending', 'deposit_paid', 'confirmed', 'in_progress']);

const dateTime = (date: string, time: string) => new Date(`${date}T${time}:00`);

function normalizeEnd(start: Date, date: string, time: string) {
  const end = dateTime(date, time);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

export function candidateWindow(candidate: ScheduleCandidate): ScheduleWindow | null {
  const start = dateTime(candidate.startDate, candidate.startTime);
  const end = normalizeEnd(start, candidate.endDate || candidate.startDate, candidate.endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) return null;
  return { id: candidate.id || 'candidate', label: candidate.label, start, end };
}

export function rideWindow(request: RideRequest): ScheduleWindow | null {
  if (!scheduledStatuses.has(request.status)) return null;
  const start = dateTime(request.pickupDate, request.pickupTime);
  if (!Number.isFinite(start.getTime())) return null;
  let end: Date;
  if (request.returnDate && request.returnTime) end = normalizeEnd(start, request.returnDate, request.returnTime);
  else if (request.hourlyEnd) end = normalizeEnd(start, request.pickupDate, request.hourlyEnd);
  else end = new Date(start.getTime() + 90 * 60_000);
  return { id: request.id, label: `${request.requestNumber} · ${request.customerName}`, start, end };
}

export function detectScheduleConflicts(candidate: ScheduleCandidate, requests: RideRequest[], tightTurnaroundMinutes = 60): ScheduleConflict[] {
  const proposed = candidateWindow(candidate);
  if (!proposed) return [];
  const conflicts: ScheduleConflict[] = [];
  for (const request of requests) {
    if (request.id === candidate.id) continue;
    const scheduled = rideWindow(request);
    if (!scheduled) continue;
    const overlap = proposed.start < scheduled.end && scheduled.start < proposed.end;
    if (overlap) {
      conflicts.push({ rideId: request.id, requestNumber: request.requestNumber, customerName: request.customerName, kind: 'overlap', minutesApart: 0, message: `Overlaps ${request.requestNumber} for ${request.customerName}.` });
      continue;
    }
    const gap = proposed.end <= scheduled.start
      ? Math.round((scheduled.start.getTime() - proposed.end.getTime()) / 60_000)
      : Math.round((proposed.start.getTime() - scheduled.end.getTime()) / 60_000);
    if (gap >= 0 && gap < tightTurnaroundMinutes) conflicts.push({ rideId: request.id, requestNumber: request.requestNumber, customerName: request.customerName, kind: 'tight_turnaround', minutesApart: gap, message: `Only ${gap} minutes between this block and ${request.requestNumber}.` });
  }
  return conflicts.sort((a, b) => (a.kind === b.kind ? a.minutesApart - b.minutesApart : a.kind === 'overlap' ? -1 : 1));
}
