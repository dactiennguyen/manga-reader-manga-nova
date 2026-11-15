/**
 * Periods for the creation statistics: a week, a month, a year or everything kept. Every boundary is a day
 * key in local time (core/util/time dayKey), and days are stepped with shiftDay, which stays on the right
 * day across a daylight-saving change.
 */
import type { Locale } from '../i18n';
import { shiftDay } from '../story/activity';
import { dayKey, dayKeyToDate } from '../util/time';

export type PeriodKind = 'week' | 'month' | 'year' | 'all';

/** Both ends are day keys and both are in the period. */
export type Period = { kind: PeriodKind; start: string; end: string };

/** A day series: day key to a count. Missing days are zero. */
export type DaySeries = Record<string, number>;

/** One bar of a chart: a day for a week or a month, a month for a year or everything. */
export type Bucket = { start: string; end: string; value: number };

/** Sunday is 0, as in Date.getDay(). */
export type WeekStart = 0 | 1;

/** The first day of the week where each language is mostly read (CLDR): Monday for Vietnam, China and Spain. */
export function weekStartFor(locale: Locale): WeekStart {
  return locale === 'vi' || locale === 'zh-Hans' || locale === 'es' ? 1 : 0;
}

function monthStart(year: number, month: number): string {
  return dayKey(new Date(year, month, 1, 12).getTime());
}

function monthEnd(year: number, month: number): string {
  return dayKey(new Date(year, month + 1, 0, 12).getTime());
}

/**
 * The period of `kind` that holds `today`, moved `offset` periods back (negative) or ahead. Everything
 * starts at `firstDay`, the oldest day with data, and ends today; with no data it is just today.
 */
export function periodOf(kind: PeriodKind, today: string, offset = 0, weekStart: WeekStart = 1, firstDay?: string): Period {
  const date = dayKeyToDate(today);
  if (kind === 'week') {
    const back = (date.getDay() - weekStart + 7) % 7;
    const start = shiftDay(today, offset * 7 - back);
    return { kind, start, end: shiftDay(start, 6) };
  }
  if (kind === 'month') {
    const month = date.getMonth() + offset;
    return { kind, start: monthStart(date.getFullYear(), month), end: monthEnd(date.getFullYear(), month) };
  }
  if (kind === 'year') {
    const year = date.getFullYear() + offset;
    return { kind, start: monthStart(year, 0), end: monthEnd(year, 11) };
  }
  return { kind, start: firstDay && firstDay < today ? firstDay : today, end: today };
}

/** Every day of the period, oldest first. */
export function periodDays(period: Period): string[] {
  const days: string[] = [];
  for (let day = period.start; day <= period.end; day = shiftDay(day, 1)) {
    days.push(day);
  }
  return days;
}

export function inPeriod(day: string, period: Period): boolean {
  return day >= period.start && day <= period.end;
}

export function totalIn(series: DaySeries, period: Period): number {
  let total = 0;
  for (const [day, value] of Object.entries(series)) {
    if (inPeriod(day, period)) {
      total += value;
    }
  }
  return total;
}

/** Days in the period with anything at all. */
export function activeDaysIn(series: DaySeries, period: Period): number {
  return Object.entries(series).filter(([day, value]) => value > 0 && inPeriod(day, period)).length;
}

/** The longest run of days in a row with anything, counted inside the period only. */
export function longestRunIn(series: DaySeries, period: Period): number {
  let best = 0;
  let run = 0;
  for (const day of periodDays(period)) {
    run = (series[day] ?? 0) > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Days for a week or a month, months for a year or everything. */
export function bucketsOf(period: Period, series: DaySeries): Bucket[] {
  if (period.kind === 'week' || period.kind === 'month') {
    return periodDays(period).map(day => ({ start: day, end: day, value: series[day] ?? 0 }));
  }
  const buckets: Bucket[] = [];
  const first = dayKeyToDate(period.start);
  let year = first.getFullYear();
  let month = first.getMonth();
  for (;;) {
    const start = monthStart(year, month);
    if (start > period.end) {
      break;
    }
    const bucket: Period = { kind: 'month', start: start < period.start ? period.start : start, end: monthEnd(year, month) };
    if (bucket.end > period.end) {
      bucket.end = period.end;
    }
    buckets.push({ start: bucket.start, end: bucket.end, value: totalIn(series, bucket) });
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return buckets;
}

/** The day with the most, the earliest one on a tie. Null when nothing has been counted. */
export function bestDayOf(series: DaySeries): { day: string; value: number } | null {
  let best: { day: string; value: number } | null = null;
  for (const day of Object.keys(series).sort()) {
    const value = series[day];
    if (value > 0 && (!best || value > best.value)) {
      best = { day, value };
    }
  }
  return best;
}

/** The oldest day with anything, or undefined. */
export function firstDayOf(...series: DaySeries[]): string | undefined {
  let first: string | undefined;
  for (const one of series) {
    for (const [day, value] of Object.entries(one)) {
      if (value > 0 && (!first || day < first)) {
        first = day;
      }
    }
  }
  return first;
}

/** Each drawn day as 1, so days drawn can share the series helpers. */
export function daysDrawnSeries(strokes: DaySeries): DaySeries {
  const days: DaySeries = {};
  for (const [day, value] of Object.entries(strokes)) {
    if (value > 0) {
      days[day] = 1;
    }
  }
  return days;
}
