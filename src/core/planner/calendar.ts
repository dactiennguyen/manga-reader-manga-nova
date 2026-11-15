/** What the calendar shows on each day: planned and finished pages per chapter, deadlines and drawing. */
import type { ID, StoryData } from '../model/types';
import type { Activity } from '../story/activity';
import { addDays, dayRange, weekDays } from './days';
import { doneByDay, planViews, type PlanItem, type PlannerData } from './data';
import { pagesOn } from './plan';

/** Everything the calendar reads, worked out once for a day and passed around. */
export type PlannerContext = {
  today: string;
  items: PlanItem[];
  byChapter: Record<ID, PlanItem>;
  done: Record<string, Record<ID, number>>;
  planned: PlannerData['planned'];
  activity: Activity;
};

export function plannerContext(data: PlannerData, state: StoryData, activity: Activity, today: string): PlannerContext {
  const items = planViews(data, state, today);
  return {
    today,
    items,
    byChapter: Object.fromEntries(items.map(item => [item.plan.chapterId, item])),
    done: doneByDay(data.doneLog, state),
    planned: data.planned,
    activity,
  };
}

export type DayEntry = {
  chapterId: ID;
  /** Pages planned. Null on a past day the planner has no record for. */
  planned: number | null;
  done: number;
  /** The chapter's deadline is this day. */
  deadline: boolean;
  /** The deadline is this day, has passed, and pages are still left. */
  overdue: boolean;
};

export type DayInfo = {
  day: string;
  entries: DayEntry[];
  planned: number;
  done: number;
  strokes: number;
  hasDeadline: boolean;
  overdue: boolean;
};

function plannedOn(context: PlannerContext, chapterId: ID, day: string): number | null {
  const { today } = context;
  const item = context.byChapter[chapterId];
  if (day < today) {
    return context.planned[day]?.[chapterId] ?? null;
  }
  if (!item) {
    return 0;
  }
  return day === today ? item.todayPlanned : pagesOn(item, day);
}

/** One day of the calendar. Chapters show up when they had pages planned or done, or a deadline. */
export function dayInfo(context: PlannerContext, day: string): DayInfo {
  const ids = new Set<ID>([
    ...Object.keys(context.done[day] ?? {}),
    ...Object.keys(day < context.today ? context.planned[day] ?? {} : {}),
    ...context.items.map(item => item.plan.chapterId),
  ]);
  const entries: DayEntry[] = [];
  for (const chapterId of ids) {
    const item = context.byChapter[chapterId];
    const planned = plannedOn(context, chapterId, day);
    const done = context.done[day]?.[chapterId] ?? 0;
    const deadline = item?.plan.deadline === day;
    const overdue = deadline && item.status === 'overdue';
    if ((planned ?? 0) > 0 || done > 0 || deadline) {
      entries.push({ chapterId, planned, done, deadline, overdue });
    }
  }
  entries.sort((a, b) => {
    const da = context.byChapter[a.chapterId]?.plan.deadline ?? '9999';
    const db = context.byChapter[b.chapterId]?.plan.deadline ?? '9999';
    return da.localeCompare(db) || a.chapterId.localeCompare(b.chapterId);
  });
  return {
    day,
    entries,
    planned: entries.reduce((sum, entry) => sum + (entry.planned ?? 0), 0),
    done: entries.reduce((sum, entry) => sum + entry.done, 0),
    strokes: context.activity.days[day] ?? 0,
    hasDeadline: entries.some(entry => entry.deadline),
    overdue: entries.some(entry => entry.overdue),
  };
}

/** The days from today on with something planned or due, for the agenda list. */
export function agenda(context: PlannerContext, days: number): DayInfo[] {
  return dayRange(context.today, addDays(context.today, days - 1))
    .map(day => dayInfo(context, day))
    .filter(info => info.entries.length > 0);
}

export type WeekSummary = {
  start: string;
  end: string;
  days: DayInfo[];
  pagesDone: number;
  pagesPlanned: number;
  strokes: number;
  daysDrawn: number;
  /** Plans not yet done, the nearest deadline first. */
  closest: PlanItem[];
  /** The week is over. */
  past: boolean;
};

export const CLOSEST_COUNT = 3;

/** One week, Monday first. A day not lived yet counts its planned pages but no work. */
export function weekSummary(context: PlannerContext, start: string): WeekSummary {
  const days = weekDays(start).map(day => dayInfo(context, day));
  return {
    start,
    end: days[6].day,
    days,
    pagesDone: days.reduce((sum, info) => sum + info.done, 0),
    pagesPlanned: days.reduce((sum, info) => sum + info.planned, 0),
    strokes: days.reduce((sum, info) => sum + info.strokes, 0),
    daysDrawn: days.filter(info => info.strokes > 0).length,
    closest: context.items.filter(item => item.status !== 'done').slice(0, CLOSEST_COUNT),
    past: days[6].day < context.today,
  };
}
