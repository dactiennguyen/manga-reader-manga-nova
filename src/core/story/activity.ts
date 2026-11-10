import { DAY_MS, dayKey, dayKeyToDate } from '../util/time';

/** Strokes drawn per day, keyed by day (2026-11-10). Only days with drawing are stored. */
export type Activity = { days: Record<string, number>; total: number };

export const EMPTY_ACTIVITY: Activity = { days: {}, total: 0 };

/** Days kept. Older ones only matter for the total, which is stored on its own. */
export const ACTIVITY_KEEP_DAYS = 400;

export const DAILY_GOALS = [0, 50, 100, 200, 400] as const;

export const DEFAULT_DAILY_GOAL = 100;

function shiftDay(day: string, delta: number): string {
  const date = dayKeyToDate(day);
  // Noon keeps the result on the right day across a daylight-saving change.
  date.setHours(12);
  return dayKey(date.getTime() + delta * DAY_MS);
}

export function addStrokes(activity: Activity, day: string, count: number): Activity {
  if (count <= 0) {
    return activity;
  }
  const days = { ...activity.days, [day]: (activity.days[day] ?? 0) + count };
  const oldest = shiftDay(day, -ACTIVITY_KEEP_DAYS);
  for (const key of Object.keys(days)) {
    if (key < oldest) {
      delete days[key];
    }
  }
  return { days, total: activity.total + count };
}

/** Days in a row with drawing. A day that has not been drawn on yet does not break yesterday's streak. */
export function currentStreak(activity: Activity, today: string): number {
  let day = activity.days[today] ? today : shiftDay(today, -1);
  let streak = 0;
  while (activity.days[day]) {
    streak++;
    day = shiftDay(day, -1);
  }
  return streak;
}

export function bestStreak(activity: Activity): number {
  let best = 0;
  for (const day of Object.keys(activity.days)) {
    if (activity.days[shiftDay(day, -1)]) {
      continue;
    }
    let length = 0;
    for (let cursor = day; activity.days[cursor]; cursor = shiftDay(cursor, 1)) {
      length++;
    }
    best = Math.max(best, length);
  }
  return best;
}

export type DayBar = { day: string; weekday: number; strokes: number };

/** The last seven days, oldest first, for the week chart. */
export function lastWeek(activity: Activity, today: string): DayBar[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(today, index - 6);
    return { day, weekday: dayKeyToDate(day).getDay(), strokes: activity.days[day] ?? 0 };
  });
}

export function goalProgress(activity: Activity, today: string, goal: number): number {
  return goal > 0 ? Math.min(1, (activity.days[today] ?? 0) / goal) : 0;
}

export function parseActivity(raw: string | null | undefined): Activity {
  if (!raw) {
    return EMPTY_ACTIVITY;
  }
  try {
    const value = JSON.parse(raw) as Partial<Activity> | null;
    const days: Record<string, number> = {};
    for (const [day, count] of Object.entries(value?.days ?? {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && typeof count === 'number' && count > 0) {
        days[day] = Math.floor(count);
      }
    }
    const sum = Object.values(days).reduce((a, b) => a + b, 0);
    const total = typeof value?.total === 'number' && value.total >= sum ? Math.floor(value.total) : sum;
    return { days, total };
  } catch {
    return EMPTY_ACTIVITY;
  }
}
