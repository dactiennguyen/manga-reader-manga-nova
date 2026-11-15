/**
 * What the person made each day: pages and panels added, pages and chapters finished, words written in
 * scripts and bubbles placed. Stories carry no history of when things were made, so this is recorded from
 * the day it shipped: the app compares the stories before and after each change and adds what grew to
 * today. Only per-day totals are stored, kept for ACTIVITY_KEEP_DAYS days.
 *
 * Rules, so the numbers stay honest:
 * - A story seen for the first time (loaded at start, imported, received or the sample) is a baseline.
 *   Nothing in it counts as made today.
 * - Trashed stories still count toward the totals, so moving a story to the trash and back adds nothing.
 * - Removing something lowers the baseline and never takes from a day. Adding it again counts again.
 * - A page or chapter counts as finished once. Unmarking and marking it again the same run adds nothing.
 */
import type { ID, StoryData } from '../model/types';
import { ACTIVITY_KEEP_DAYS, shiftDay } from '../story/activity';
import { wordCount } from '../studio/metrics';
import type { DaySeries } from './period';

export const PROGRESS_FIELDS = ['pages', 'panels', 'pagesDone', 'words', 'bubbles', 'chapters'] as const;

export type ProgressField = (typeof PROGRESS_FIELDS)[number];

export type DayGains = Partial<Record<ProgressField, number>>;

/** Saved under the meta key `statsProgress`. `since` is the first day it recorded. */
export type ProgressLog = { since: string | null; days: Record<string, DayGains> };

export const EMPTY_PROGRESS: ProgressLog = { since: null, days: {} };

type Counts = { pages: number; panels: number; words: number; bubbles: number };

/** Counts per story, and which pages and chapters were already counted as finished. Kept in memory only. */
export type ProgressSnapshot = {
  projects: Record<ID, Counts>;
  donePages: Set<ID>;
  doneChapters: Set<ID>;
};

type Story = Pick<StoryData, 'projects' | 'chapters' | 'scenes' | 'pages'>;

type Counted = {
  projects: Record<ID, Counts>;
  /** Finished page id to its story. */
  donePages: Map<ID, ID>;
  doneChapters: Map<ID, ID>;
};

function countStory(state: Story): Counted {
  const projects: Record<ID, Counts> = {};
  for (const id of Object.keys(state.projects)) {
    projects[id] = { pages: 0, panels: 0, words: 0, bubbles: 0 };
  }
  const donePages = new Map<ID, ID>();
  const doneChapters = new Map<ID, ID>();
  for (const chapter of Object.values(state.chapters)) {
    const counts = projects[chapter.projectId];
    if (!counts) {
      continue;
    }
    for (const sceneId of chapter.sceneIds) {
      for (const block of state.scenes[sceneId]?.blocks ?? []) {
        counts.words += wordCount(block.text);
      }
    }
    let pages = 0;
    let done = 0;
    for (const pageId of chapter.pageIds) {
      const page = state.pages[pageId];
      if (!page) {
        continue;
      }
      pages++;
      counts.pages++;
      counts.panels += Object.keys(page.panels).length;
      counts.bubbles += page.bubbles.length;
      if (page.done) {
        done++;
        donePages.set(page.id, chapter.projectId);
      }
    }
    if (pages > 0 && done === pages) {
      doneChapters.set(chapter.id, chapter.projectId);
    }
  }
  return { projects, donePages, doneChapters };
}

/** The first look at the stories: everything in them is the baseline. */
export function progressSnapshot(state: Story): ProgressSnapshot {
  const counted = countStory(state);
  return { projects: counted.projects, donePages: new Set(counted.donePages.keys()), doneChapters: new Set(counted.doneChapters.keys()) };
}

/** What grew since the last snapshot, and the snapshot to compare with next time. */
export function progressStep(previous: ProgressSnapshot, state: Story): { gains: DayGains; snapshot: ProgressSnapshot } {
  const counted = countStory(state);
  const gains: Record<ProgressField, number> = { pages: 0, panels: 0, pagesDone: 0, words: 0, bubbles: 0, chapters: 0 };
  for (const [id, now] of Object.entries(counted.projects)) {
    const before = previous.projects[id];
    if (!before) {
      continue;
    }
    gains.pages += Math.max(0, now.pages - before.pages);
    gains.panels += Math.max(0, now.panels - before.panels);
    gains.words += Math.max(0, now.words - before.words);
    gains.bubbles += Math.max(0, now.bubbles - before.bubbles);
  }
  const donePages = new Set(previous.donePages);
  for (const [pageId, projectId] of counted.donePages) {
    if (!donePages.has(pageId)) {
      donePages.add(pageId);
      if (previous.projects[projectId]) {
        gains.pagesDone++;
      }
    }
  }
  const doneChapters = new Set(previous.doneChapters);
  for (const [chapterId, projectId] of counted.doneChapters) {
    if (!doneChapters.has(chapterId)) {
      doneChapters.add(chapterId);
      if (previous.projects[projectId]) {
        gains.chapters++;
      }
    }
  }
  const kept: DayGains = {};
  for (const field of PROGRESS_FIELDS) {
    if (gains[field] > 0) {
      kept[field] = gains[field];
    }
  }
  return { gains: kept, snapshot: { projects: counted.projects, donePages, doneChapters } };
}

export function hasGains(gains: DayGains): boolean {
  return PROGRESS_FIELDS.some(field => (gains[field] ?? 0) > 0);
}

/** Marks the first day of recording. Changes nothing once it is set. */
export function startProgress(log: ProgressLog, day: string): ProgressLog {
  return log.since ? log : { ...log, since: day };
}

/** Adds a step's gains to a day, and drops days older than the keep window. */
export function addGains(log: ProgressLog, day: string, gains: DayGains): ProgressLog {
  if (!hasGains(gains)) {
    return log;
  }
  const current = log.days[day] ?? {};
  const merged: DayGains = { ...current };
  for (const field of PROGRESS_FIELDS) {
    const add = gains[field] ?? 0;
    if (add > 0) {
      merged[field] = (merged[field] ?? 0) + add;
    }
  }
  const days = { ...log.days, [day]: merged };
  const oldest = shiftDay(day, -ACTIVITY_KEEP_DAYS);
  for (const key of Object.keys(days)) {
    if (key < oldest) {
      delete days[key];
    }
  }
  return { since: log.since ?? day, days };
}

/** One field as a day series, for the charts. */
export function progressSeries(log: ProgressLog, field: ProgressField): DaySeries {
  const series: DaySeries = {};
  for (const [day, gains] of Object.entries(log.days)) {
    const value = gains[field] ?? 0;
    if (value > 0) {
      series[day] = value;
    }
  }
  return series;
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function parseProgress(raw: string | null | undefined): ProgressLog {
  if (!raw) {
    return EMPTY_PROGRESS;
  }
  try {
    const value = JSON.parse(raw) as Partial<ProgressLog> | null;
    const days: Record<string, DayGains> = {};
    for (const [day, gains] of Object.entries(value?.days ?? {})) {
      if (!DAY_KEY.test(day) || !gains || typeof gains !== 'object') {
        continue;
      }
      const clean: DayGains = {};
      for (const field of PROGRESS_FIELDS) {
        const count = (gains as DayGains)[field];
        if (typeof count === 'number' && count > 0) {
          clean[field] = Math.floor(count);
        }
      }
      if (hasGains(clean)) {
        days[day] = clean;
      }
    }
    const since = typeof value?.since === 'string' && DAY_KEY.test(value.since) ? value.since : null;
    return { since, days };
  } catch {
    return EMPTY_PROGRESS;
  }
}
