/**
 * Numbers and dates for the statistics, in the app's language. Intl is used when the engine has it, and a
 * plain form is the fallback, so a missing locale never breaks a screen.
 */
import { LOCALE_TAG, getLocale, t } from '../i18n';
import { dayKeyToDate } from '../util/time';
import type { Period } from './period';

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function tag(): string {
  return LOCALE_TAG[getLocale()] ?? 'en-US';
}

/** Whole numbers with the language's digit grouping: 1,240 or 1.240. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  try {
    const key = tag();
    let format = numberFormats.get(key);
    if (!format) {
      format = new Intl.NumberFormat(key, { maximumFractionDigits: 0 });
      numberFormats.set(key, format);
    }
    return format.format(rounded);
  } catch {
    return String(rounded);
  }
}

function dateFormat(options: Intl.DateTimeFormatOptions, fallback: (date: Date) => string): (date: Date) => string {
  return date => {
    try {
      const key = `${tag()}|${JSON.stringify(options)}`;
      let format = dateFormats.get(key);
      if (!format) {
        format = new Intl.DateTimeFormat(tag(), options);
        dateFormats.set(key, format);
      }
      return format.format(date);
    } catch {
      return fallback(date);
    }
  };
}

const pad = (value: number) => String(value).padStart(2, '0');

const dayMonth = dateFormat({ day: 'numeric', month: 'numeric' }, date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`);
const fullDate = dateFormat(
  { day: 'numeric', month: 'long', year: 'numeric' },
  date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`,
);
const weekdayDate = dateFormat(
  { weekday: 'short', day: 'numeric', month: 'numeric' },
  date => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`,
);
const monthShort = dateFormat({ month: 'short' }, date => String(date.getMonth() + 1));
const monthYear = dateFormat({ month: 'long', year: 'numeric' }, date => `${pad(date.getMonth() + 1)}/${date.getFullYear()}`);
const monthShortYear = dateFormat({ month: 'short', year: 'numeric' }, date => `${pad(date.getMonth() + 1)}/${date.getFullYear()}`);

/** 15/11, or 11/15 in English. */
export function formatDayMonth(day: string): string {
  return dayMonth(dayKeyToDate(day));
}

/** 15 November 2026, in the language's order. */
export function formatFullDate(day: string): string {
  return fullDate(dayKeyToDate(day));
}

/** Sun, 15/11: for the rows of numbers per day. */
export function formatWeekdayDate(day: string): string {
  return weekdayDate(dayKeyToDate(day));
}

export function formatMonthShort(day: string): string {
  return monthShort(dayKeyToDate(day));
}

export function formatMonthYear(day: string): string {
  return monthYear(dayKeyToDate(day));
}

export function formatMonthShortYear(day: string): string {
  return monthShortYear(dayKeyToDate(day));
}

/** The period as a heading: 10/11 – 16/11, November 2026, 2026, or since a day. */
export function formatPeriod(period: Period): string {
  if (period.kind === 'week') {
    return t('{from} – {to}', { from: formatDayMonth(period.start), to: formatDayMonth(period.end) });
  }
  if (period.kind === 'month') {
    return formatMonthYear(period.start);
  }
  if (period.kind === 'year') {
    return String(dayKeyToDate(period.start).getFullYear());
  }
  return t('Since {date}', { date: formatFullDate(period.start) });
}
