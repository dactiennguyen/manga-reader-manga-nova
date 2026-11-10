import { msg, t, tn } from '../i18n';

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

function formatDate(time: number, withWeekday = false): string {
  const d = new Date(time);
  const date = t('{day}/{month}/{year}', {
    day: String(d.getDate()).padStart(2, '0'),
    month: String(d.getMonth() + 1).padStart(2, '0'),
    year: d.getFullYear(),
  });
  return withWeekday ? t('{weekday}, {date}', { weekday: t(WEEKDAYS[d.getDay()]), date }) : date;
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
