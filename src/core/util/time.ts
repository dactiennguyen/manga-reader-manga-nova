import { LOCALE_TAG, getLocale, msg, t, tn } from '../i18n';

const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKey(time: number = Date.now()): string {
  const d = new Date(time);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayKeyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const WEEKDAYS = [msg('Sun'), msg('Mon'), msg('Tue'), msg('Wed'), msg('Thu'), msg('Fri'), msg('Sat')];

/** Sun is 0, as in Date.getDay(). */
export function weekdayName(index: number): string {
  return t(WEEKDAYS[index] ?? '');
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'numeric', year: 'numeric' };
const WEEKDAY_DATE_OPTIONS: Intl.DateTimeFormatOptions = { ...DATE_OPTIONS, weekday: 'short' };
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** The engine's formatter for the app language, or null when Intl is missing or refuses the language. */
function intlFormat(withWeekday: boolean): Intl.DateTimeFormat | null {
  const tag = LOCALE_TAG[getLocale()] ?? 'en-US';
  const key = `${tag}|${withWeekday ? 'w' : ''}`;
  let format = dateFormats.get(key);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat(tag, withWeekday ? WEEKDAY_DATE_OPTIONS : DATE_OPTIONS);
    } catch {
      return null;
    }
    dateFormats.set(key, format);
  }
  return format;
}

/** The plain form, when Intl cannot help: day/month/year, or month/day/year in English. */
function plainDate(d: Date, withWeekday: boolean): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = getLocale() === 'en' ? `${month}/${day}/${d.getFullYear()}` : t('{day}/{month}/{year}', { day, month, year: d.getFullYear() });
  return withWeekday ? t('{weekday}, {date}', { weekday: t(WEEKDAYS[d.getDay()]), date }) : date;
}

/**
 * A date in the app language's own order: 11/16/2026 in English, 16/11/2026 in Vietnamese, 2026/11/16 in
 * Japanese. `withWeekday` adds the short day name: "Mon, 11/16/2026".
 */
export function formatDate(time: number, withWeekday = false): string {
  const d = new Date(time);
  try {
    const format = intlFormat(withWeekday);
    if (format) {
      return format.format(d);
    }
  } catch {
    // Hermes without full Intl: the plain form below.
  }
  return plainDate(d, withWeekday);
}

export function formatRelative(time: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - time);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) {
    return t('just now');
  }
  if (minutes < 60) {
    return t('{n} min ago', { n: minutes });
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return t('{n} hr ago', { n: hours });
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return tn(days, '{count} day ago', '{count} days ago');
  }
  return formatDate(time);
}

export { DAY_MS };
