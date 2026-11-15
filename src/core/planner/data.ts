/**
 * What the planner keeps on the device: the plans by chapter, the day each page was marked done, and the
 * pages planned on each past day. It lives in the meta table, not in the story, so it never travels in a
 * .manganova archive: a deadline belongs to the person, not to the story.
 */
import type { ID, Page, StoryData } from '../model/types';
import { addDays, isDayKey } from './days';
import { parsePlan, viewPlan, type ChapterPlan, type PlanView } from './plan';

export type PlannerData = {
  plans: Record<ID, ChapterPlan>;
  /** Page id to the day it was marked done. '' is a page that was done before the planner saw it. */
  doneLog: Record<ID, string>;
  /** Day to chapter id to pages planned that day, as the day began. Past days cannot be worked out again. */
  planned: Record<string, Record<ID, number>>;
  /** The first day of the last week whose summary was shown or put away. */
  summarySeen: string;
};

export const EMPTY_PLANNER: PlannerData = { plans: {}, doneLog: {}, planned: {}, summarySeen: '' };

/** Days of planned pages kept, enough for the calendar to look back a few months. */
export const PLANNED_KEEP_DAYS = 120;

export const UNKNOWN_DAY = '';

export function parsePlanner(raw: string | null | undefined): PlannerData {
  if (!raw) {
    return EMPTY_PLANNER;
  }
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof PlannerData, unknown>> | null;
    const plans: Record<ID, ChapterPlan> = {};
    for (const item of Object.values(asRecord(value?.plans))) {
      const plan = parsePlan(item);
      if (plan) {
        plans[plan.chapterId] = plan;
      }
    }
    const doneLog: Record<ID, string> = {};
    for (const [pageId, day] of Object.entries(asRecord(value?.doneLog))) {
      if (day === UNKNOWN_DAY || isDayKey(day)) {
        doneLog[pageId] = day;
      }
    }
    const planned: Record<string, Record<ID, number>> = {};
    for (const [day, entries] of Object.entries(asRecord(value?.planned))) {
      if (!isDayKey(day)) {
        continue;
      }
      const clean: Record<ID, number> = {};
      for (const [chapterId, pages] of Object.entries(asRecord(entries))) {
        if (typeof pages === 'number' && pages >= 0) {
          clean[chapterId] = Math.floor(pages);
        }
      }
      planned[day] = clean;
    }
    const summarySeen = isDayKey(value?.summarySeen) ? value.summarySeen : '';
    return { plans, doneLog, planned, summarySeen };
  } catch {
    return EMPTY_PLANNER;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function serializePlanner(data: PlannerData): string {
  return JSON.stringify(data);
}

/**
 * Keeps the done log in step with the pages. A page that turns done is logged today; a page that shows up
 * already done (an import, a copy, the first launch) is logged with no day, so it never counts as today's
 * work. Pages no longer done or gone are dropped. Returns the same object when nothing changed.
 */
export function syncDoneLog(
  log: Record<ID, string>,
  pages: Record<ID, Page>,
  previous: Record<ID, Page> | null,
  today: string,
): Record<ID, string> {
  let next: Record<ID, string> | null = null;
  const edit = () => (next ??= { ...log });
  for (const [pageId, page] of Object.entries(pages)) {
    if (page.done && !(pageId in log)) {
      const before = previous?.[pageId];
      edit()[pageId] = before && !before.done ? today : UNKNOWN_DAY;
    }
  }
  for (const pageId of Object.keys(log)) {
    if (!pages[pageId]?.done) {
      delete edit()[pageId];
    }
  }
  return next ?? log;
}

/** The chapter is in a story that is not in the trash. */
export function chapterIsLive(state: StoryData, chapterId: ID): boolean {
  const chapter = state.chapters[chapterId];
  const project = chapter ? state.projects[chapter.projectId] : undefined;
  return !!project && !project.deletedAt && project.acts.some(act => act.chapterIds.includes(chapterId));
}

/**
 * Drops what belongs to deleted work: plans and planned pages of chapters that are gone, log entries of
 * pages that are gone or no longer done, and planned pages older than the keep window. Runs at startup,
 * when the undo that could bring a deleted chapter back is gone too. During a session a deleted chapter's
 * plan is only hidden (see chapterIsLive). Returns the same object when nothing changed.
 */
export function prunePlanner(data: PlannerData, state: StoryData, today: string): PlannerData {
  const plans = { ...data.plans };
  let changed = false;
  for (const plan of Object.values(data.plans)) {
    const chapter = state.chapters[plan.chapterId];
    if (!chapter || !state.projects[chapter.projectId]) {
      delete plans[plan.chapterId];
      changed = true;
    }
  }
  const oldest = addDays(today, -PLANNED_KEEP_DAYS);
  const planned: PlannerData['planned'] = {};
  for (const [day, entries] of Object.entries(data.planned)) {
    const kept = day < oldest ? {} : Object.fromEntries(Object.entries(entries).filter(([chapterId]) => !!plans[chapterId] || !!state.chapters[chapterId]));
    if (Object.keys(kept).length !== Object.keys(entries).length || !Object.keys(kept).length) {
      changed = true;
    }
    if (Object.keys(kept).length) {
      planned[day] = kept;
    }
  }
  const doneLog = syncDoneLog(data.doneLog, state.pages, null, today);
  if (!changed && doneLog === data.doneLog) {
    return data;
  }
  return { ...data, plans, planned, doneLog };
}

/** Pages done in a chapter on one day, from the log. */
export function doneOnDay(log: Record<ID, string>, state: StoryData, chapterId: ID, day: string): number {
  return (state.chapters[chapterId]?.pageIds ?? []).filter(pageId => log[pageId] === day && state.pages[pageId]?.done).length;
}

/** Day to chapter id to pages done that day. Pages done before the planner knew about them are left out. */
export function doneByDay(log: Record<ID, string>, state: StoryData): Record<string, Record<ID, number>> {
  const result: Record<string, Record<ID, number>> = {};
  for (const [pageId, day] of Object.entries(log)) {
    const page = state.pages[pageId];
    if (!day || !page?.done) {
      continue;
    }
    const row = (result[day] ??= {});
    row[page.chapterId] = (row[page.chapterId] ?? 0) + 1;
  }
  return result;
}

export type PlanItem = PlanView & { projectId: ID };

/** Every plan of a live chapter, worked out for today, the nearest deadline first. */
export function planViews(data: PlannerData, state: StoryData, today: string): PlanItem[] {
  return Object.values(data.plans)
    .filter(plan => chapterIsLive(state, plan.chapterId))
    .map(plan => {
      const chapter = state.chapters[plan.chapterId];
      const done = chapter.pageIds.filter(pageId => state.pages[pageId]?.done).length;
      const view = viewPlan(plan, done, doneOnDay(data.doneLog, state, plan.chapterId, today), today);
      return { ...view, projectId: chapter.projectId };
    })
    .sort((a, b) => a.plan.deadline.localeCompare(b.plan.deadline) || a.plan.chapterId.localeCompare(b.plan.chapterId));
}

/** Notes today's planned pages, so the calendar can show them once the day is over. Same object when unchanged. */
export function recordPlanned(data: PlannerData, views: readonly PlanView[], today: string): PlannerData {
  const entries: Record<ID, number> = {};
  for (const view of views) {
    if (view.todayPlanned > 0) {
      entries[view.plan.chapterId] = view.todayPlanned;
    }
  }
  const current = data.planned[today] ?? {};
  const same =
    Object.keys(entries).length === Object.keys(current).length &&
    Object.entries(entries).every(([chapterId, pages]) => current[chapterId] === pages);
  if (same) {
    return data;
  }
  const planned = { ...data.planned };
  if (Object.keys(entries).length) {
    planned[today] = entries;
  } else {
    delete planned[today];
  }
  return { ...data, planned };
}
