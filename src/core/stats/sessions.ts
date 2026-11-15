/**
 * Drawing sessions: when the person draws, for the "when you draw" heatmap. The app never kept times of day
 * before, so sessions are recorded from the day this shipped. A session is a run of pen lifts with gaps of
 * at most SESSION_GAP_MS. Saved under the meta key `drawSessions`, pruned after SESSION_KEEP_DAYS days and
 * capped at MAX_SESSIONS, so it stays small.
 */
import { DAY_MS, dayKey } from '../util/time';

/** Times are epoch milliseconds. */
export type DrawSession = { start: number; end: number; strokes: number };

export const SESSION_GAP_MS = 10 * 60 * 1000;

export const SESSION_KEEP_DAYS = 365;

export const MAX_SESSIONS = 2000;

/** Hours in one heatmap column. Eight columns of three hours read well on a phone. */
export const HEAT_SLOT_HOURS = 3;

export const HEAT_SLOTS = 24 / HEAT_SLOT_HOURS;

/** The heatmap waits for this many sessions on this many different days, so one evening is not a pattern. */
export const HEAT_MIN_SESSIONS = 5;
export const HEAT_MIN_DAYS = 3;

/** Old sessions out, then the oldest beyond the cap. */
export function pruneSessions(sessions: DrawSession[], now: number): DrawSession[] {
  const oldest = now - SESSION_KEEP_DAYS * DAY_MS;
  const kept = sessions.filter(session => session.end >= oldest);
  return kept.length > MAX_SESSIONS ? kept.slice(kept.length - MAX_SESSIONS) : kept;
}

/**
 * Counts `count` strokes at `now`: the last session grows when the pen came back soon enough, or a new one
 * starts. A clock that moved back starts a new session rather than bending the last one.
 */
export function noteSessionStrokes(sessions: DrawSession[], now: number, count: number): DrawSession[] {
  if (count <= 0) {
    return sessions;
  }
  const last = sessions[sessions.length - 1];
  if (last && now >= last.end && now - last.end <= SESSION_GAP_MS) {
    return [...sessions.slice(0, -1), { start: last.start, end: now, strokes: last.strokes + count }];
  }
  return pruneSessions([...sessions, { start: now, end: now, strokes: count }], now);
}

/** Weekday (Sun 0) by slot, strokes in each. */
export type Heatmap = number[][];

function emptyHeatmap(): Heatmap {
  return Array.from({ length: 7 }, () => Array.from({ length: HEAT_SLOTS }, () => 0));
}

/** The start of the next slot after `time`, in local time. setHours steps over a daylight-saving gap. */
function nextSlotStart(time: number): number {
  const date = new Date(time);
  const slot = Math.floor(date.getHours() / HEAT_SLOT_HOURS);
  date.setHours((slot + 1) * HEAT_SLOT_HOURS, 0, 0, 0);
  // Never stand still, whatever a time zone does with its clock.
  return date.getTime() > time ? date.getTime() : time + 60 * 60 * 1000;
}

/**
 * Strokes by weekday and time of day, in local time. A session that crosses a slot boundary shares its
 * strokes between the slots by how long it spent in each.
 */
export function heatmapOf(sessions: DrawSession[]): Heatmap {
  const cells = emptyHeatmap();
  for (const session of sessions) {
    const length = session.end - session.start;
    if (length <= 0) {
      const date = new Date(session.start);
      cells[date.getDay()][Math.floor(date.getHours() / HEAT_SLOT_HOURS)] += session.strokes;
      continue;
    }
    for (let time = session.start; time < session.end; ) {
      const date = new Date(time);
      const next = Math.min(nextSlotStart(time), session.end);
      cells[date.getDay()][Math.floor(date.getHours() / HEAT_SLOT_HOURS)] += (session.strokes * (next - time)) / length;
      time = next;
    }
  }
  return cells;
}

/** Whether there are enough sessions for the heatmap to mean something. */
export function heatmapReady(sessions: DrawSession[]): boolean {
  if (sessions.length < HEAT_MIN_SESSIONS) {
    return false;
  }
  return new Set(sessions.map(session => dayKey(session.start))).size >= HEAT_MIN_DAYS;
}

/** The busiest cell, or null when the map is empty. */
export function heatPeak(cells: Heatmap): { weekday: number; slot: number; value: number } | null {
  let peak: { weekday: number; slot: number; value: number } | null = null;
  for (let weekday = 0; weekday < cells.length; weekday++) {
    for (let slot = 0; slot < cells[weekday].length; slot++) {
      const value = cells[weekday][slot];
      if (value > 0 && (!peak || value > peak.value)) {
        peak = { weekday, slot, value };
      }
    }
  }
  return peak;
}

/** 0 for an empty cell, then 1 to `levels` by share of the busiest cell. */
export function heatLevel(value: number, max: number, levels = 4): number {
  if (value <= 0 || max <= 0) {
    return 0;
  }
  return Math.max(1, Math.min(levels, Math.ceil((value / max) * levels)));
}

/** Total time spent in sessions, in milliseconds. */
export function sessionTime(sessions: DrawSession[]): number {
  return sessions.reduce((sum, session) => sum + Math.max(0, session.end - session.start), 0);
}

export function parseSessions(raw: string | null | undefined): DrawSession[] {
  if (!raw) {
    return [];
  }
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter(
        (item): item is DrawSession =>
          !!item &&
          typeof item.start === 'number' &&
          typeof item.end === 'number' &&
          typeof item.strokes === 'number' &&
          item.end >= item.start &&
          item.strokes > 0,
      )
      .map(item => ({ start: item.start, end: item.end, strokes: Math.floor(item.strokes) }))
      .sort((a, b) => a.start - b.start);
  } catch {
    return [];
  }
}
