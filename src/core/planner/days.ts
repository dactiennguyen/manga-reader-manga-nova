/**
 * Day arithmetic on day keys ('2026-11-15'). A key is a local calendar day, so the math runs on the key's
 * own numbers in UTC, where every day is 24 hours long: a daylight-saving change can never move a key.
 * Only `dayKey(now)` in core/util/time looks at the local clock.
 */
import { DAY_MS } from '../util/time';

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Monday. The app has no week start setting, so weeks run Monday to Sunday. */
export const WEEK_START = 1;

export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = KEY.exec(value);
  if (!match) {
    return false;
  }
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return keyOf(Date.UTC(y, m - 1, d) / DAY_MS) === value;
}

/** Days since 1970-01-01 for a key. */
export function dayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function keyOf(index: number): string {
  const date = new Date(index * DAY_MS);
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${m}-${d}`;
}

export function addDays(key: string, delta: number): string {
  return keyOf(dayIndex(key) + delta);
}

/** Whole days from `from` to `to`: 1 for tomorrow, negative for the past. */
export function daysBetween(from: string, to: string): number {
  return dayIndex(to) - dayIndex(from);
}

/** 0 is Sunday, as in Date.getDay(). */
export function weekdayOf(key: string): number {
  return (((dayIndex(key) + 4) % 7) + 7) % 7;
}

/** The first day of the week holding `key`. */
export function weekStartOf(key: string, firstDay: number = WEEK_START): string {
  return addDays(key, -((weekdayOf(key) - firstDay + 7) % 7));
}

/** The seven days of the week that starts on `start`. */
export function weekDays(start: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** Weekday numbers in display order, starting on `firstDay`. */
export function weekdayOrder(firstDay: number = WEEK_START): number[] {
  return Array.from({ length: 7 }, (_, index) => (firstDay + index) % 7);
}

/** Every day from `from` to `to`, both included. Empty when `to` is before `from`. */
export function dayRange(from: string, to: string): string[] {
  const start = dayIndex(from);
  const count = dayIndex(to) - start + 1;
  return count > 0 ? Array.from({ length: count }, (_, index) => keyOf(start + index)) : [];
}

export type Month = { year: number; month: number };

/** Month is 0 for January. */
export function monthOf(key: string): Month {
  const [y, m] = key.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function addMonths({ year, month }: Month, delta: number): Month {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function firstOfMonth({ year, month }: Month): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

export function compareMonths(a: Month, b: Month): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/**
 * The month as full weeks for a grid: each row has seven keys, and a day outside the month is null.
 * Weeks start on `firstDay`.
 */
export function monthGrid(month: Month, firstDay: number = WEEK_START): (string | null)[][] {
  const first = firstOfMonth(month);
  const last = addDays(firstOfMonth(addMonths(month, 1)), -1);
  const start = weekStartOf(first, firstDay);
  const rows: (string | null)[][] = [];
  for (let cursor = start; cursor <= last; cursor = addDays(cursor, 7)) {
    rows.push(weekDays(cursor).map(day => (day >= first && day <= last ? day : null)));
  }
  return rows;
}
