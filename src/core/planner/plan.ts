/**
 * A chapter plan: how many pages, done by which day, on which weekdays. The pages still to draw are split
 * over the work days left, the first days taking one more when it does not divide evenly. Everything is
 * worked out again from what is done, so a missed day spreads over the days after it.
 */
import type { ID } from '../model/types';
import { addDays, dayRange, daysBetween, isDayKey, weekdayOf } from './days';

export type ChapterPlan = {
  chapterId: ID;
  /** Pages the chapter should have done by the deadline. */
  target: number;
  /** The last day to work, included. */
  deadline: string;
  /** Weekdays to work, 0 for Sunday. Never empty. */
  workdays: number[];
  /** The day the plan was set or last changed. The expected pace is measured from here. */
  start: string;
  /** Pages done before `start`. */
  startDone: number;
};

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

export const WORKWEEK = [1, 2, 3, 4, 5];

export const MAX_TARGET = 500;

/** How far ahead a deadline can be. */
export const MAX_PLAN_DAYS = 730;

export const DEFAULT_PLAN_DAYS = 14;

/** Pages for a chapter that has none yet. */
export const DEFAULT_TARGET = 8;

export type PlanStatus = 'done' | 'overdue' | 'behind' | 'onTrack' | 'ahead';

export type ScheduleDay = { day: string; pages: number };

export type PlanView = {
  plan: ChapterPlan;
  done: number;
  doneToday: number;
  /** Pages still to finish. */
  remaining: number;
  /** Pages planned for today as the day began, so finishing one does not change the goal. */
  todayPlanned: number;
  /** Today's goal minus what was done today. */
  todayLeft: number;
  /** The most pages a work day needs from today, for "2 pages a day". */
  perDay: number;
  /** Work days from today to the deadline, today included. */
  workDaysLeft: number;
  /** No chosen weekday is left before the deadline, so the plan uses every day instead. */
  usesRestDays: boolean;
  /** Days until the deadline: 0 on the day, negative after it. */
  daysLeft: number;
  status: PlanStatus;
  /** Pages behind or ahead of the expected pace. 0 when on track. */
  gap: number;
  /** Today and the days after it up to the deadline that have pages, in order. */
  schedule: ScheduleDay[];
};

export function normalizeWorkdays(days: readonly number[]): number[] {
  const set = [...new Set(days.filter(day => Number.isInteger(day) && day >= 0 && day <= 6))].sort((a, b) => a - b);
  return set.length ? set : [...ALL_WEEKDAYS];
}

/** `total` split over `count` days, the first days taking the extra pages. */
export function distribute(total: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const pages = Math.max(0, Math.floor(total));
  const base = Math.floor(pages / count);
  const extra = pages % count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

/** The chosen weekdays from `from` to `to`. With none left, every day, so the work still has somewhere to go. */
export function workDays(from: string, to: string, workdays: readonly number[]): { days: string[]; restDays: boolean } {
  const all = dayRange(from, to);
  const chosen = all.filter(day => workdays.includes(weekdayOf(day)));
  return chosen.length || !all.length ? { days: chosen, restDays: false } : { days: all, restDays: true };
}

/** Pages expected since the plan began, through the end of `through`, from the pace set on `start`. */
export function expectedBy(plan: ChapterPlan, through: string): number {
  const { days } = workDays(plan.start, plan.deadline, plan.workdays);
  const amounts = distribute(plan.target - plan.startDone, days.length);
  let sum = 0;
  days.forEach((day, index) => {
    if (day <= through) {
      sum += amounts[index];
    }
  });
  return sum;
}

/**
 * Where a plan stands today. `done` counts the chapter's finished pages, `doneToday` the ones finished
 * today, which stay in today's goal.
 */
export function viewPlan(plan: ChapterPlan, done: number, doneToday: number, today: string): PlanView {
  const doneNow = Math.max(0, done);
  const todayDone = Math.min(doneNow, Math.max(0, doneToday));
  const doneBefore = doneNow - todayDone;
  const remaining = Math.max(0, plan.target - doneNow);
  const daysLeft = daysBetween(today, plan.deadline);
  const { days, restDays } = workDays(today, plan.deadline, plan.workdays);

  const startRemaining = Math.max(0, plan.target - doneBefore);
  const isWorkday = days[0] === today;
  const todayPlanned = isWorkday ? distribute(startRemaining, days.length)[0] : 0;
  const todayLeft = Math.max(0, todayPlanned - todayDone);
  const later = isWorkday ? days.slice(1) : days;
  const laterPages = distribute(remaining - todayLeft, later.length);
  const schedule: ScheduleDay[] = [
    ...(isWorkday && todayPlanned > 0 ? [{ day: today, pages: todayPlanned }] : []),
    ...later.map((day, index) => ({ day, pages: laterPages[index] })).filter(item => item.pages > 0),
  ];

  let status: PlanStatus = 'onTrack';
  let gap = 0;
  if (remaining === 0) {
    status = 'done';
  } else if (daysLeft < 0) {
    status = 'overdue';
    gap = remaining;
  } else {
    const start = plan.start <= today ? plan : { ...plan, start: today };
    const sinceStart = doneNow - start.startDone;
    const dueBefore = expectedBy(start, addDays(today, -1));
    const dueToday = expectedBy(start, today);
    if (sinceStart < dueBefore) {
      status = 'behind';
      gap = dueBefore - sinceStart;
    } else if (sinceStart > dueToday) {
      status = 'ahead';
      gap = sinceStart - dueToday;
    }
  }

  return {
    plan,
    done: doneNow,
    doneToday: todayDone,
    remaining,
    todayPlanned,
    todayLeft,
    perDay: days.length ? Math.ceil(startRemaining / days.length) : 0,
    workDaysLeft: days.length,
    usesRestDays: restDays,
    daysLeft,
    status,
    gap,
    schedule,
  };
}

/** Pages planned for one day from today on, 0 for a day without work. */
export function pagesOn(view: PlanView, day: string): number {
  return view.schedule.find(item => item.day === day)?.pages ?? 0;
}

/**
 * A new or changed plan. The expected pace starts today and counts the pages done before today, so pages
 * finished today still count toward today's goal.
 */
export function makePlan(
  input: { chapterId: ID; target: number; deadline: string; workdays: readonly number[] },
  doneBeforeToday: number,
  today: string,
): ChapterPlan {
  return {
    chapterId: input.chapterId,
    target: clampTarget(input.target),
    deadline: input.deadline < today ? today : input.deadline,
    workdays: normalizeWorkdays(input.workdays),
    start: today,
    startDone: Math.max(0, Math.floor(doneBeforeToday)),
  };
}

export function clampTarget(target: number): number {
  return Math.min(MAX_TARGET, Math.max(1, Math.round(Number.isFinite(target) ? target : 1)));
}

/** A plan read from storage, or null when it is not one. */
export function parsePlan(raw: unknown): ChapterPlan | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const value = raw as Partial<ChapterPlan>;
  if (typeof value.chapterId !== 'string' || !value.chapterId || !isDayKey(value.deadline)) {
    return null;
  }
  const start = isDayKey(value.start) ? value.start : value.deadline;
  return {
    chapterId: value.chapterId,
    target: clampTarget(typeof value.target === 'number' ? value.target : 1),
    deadline: value.deadline,
    workdays: normalizeWorkdays(Array.isArray(value.workdays) ? value.workdays : []),
    start: start > value.deadline ? value.deadline : start,
    startDone: typeof value.startDone === 'number' && value.startDone > 0 ? Math.floor(value.startDone) : 0,
  };
}
