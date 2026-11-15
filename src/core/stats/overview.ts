/**
 * The creation statistics put together: which metrics exist, where each one's day series comes from, and
 * the totals for a period. Strokes come from the drawing activity, kept since the app first counted them.
 * Everything else comes from the progress log, recorded from the day statistics shipped.
 */
import { msg, tn } from '../i18n';
import type { StoryData } from '../model/types';
import { bestStreak, currentStreak, type Activity } from '../story/activity';
import { liveProjectIds, wordCount } from '../studio/metrics';
import { formatNumber } from './format';
import {
  activeDaysIn,
  bestDayOf,
  bucketsOf,
  daysDrawnSeries,
  longestRunIn,
  totalIn,
  type Bucket,
  type DaySeries,
  type Period,
} from './period';
import { progressSeries, type ProgressField, type ProgressLog } from './progress';

export type StatMetric = 'strokes' | ProgressField;

export const STAT_METRICS: readonly StatMetric[] = ['strokes', 'pagesDone', 'pages', 'panels', 'words', 'bubbles', 'chapters'];

export const METRIC_LABEL: Record<StatMetric, string> = {
  strokes: msg('Strokes drawn'),
  pagesDone: msg('Pages finished'),
  pages: msg('Pages created'),
  panels: msg('Panels created'),
  words: msg('Words written'),
  bubbles: msg('Bubbles lettered'),
  chapters: msg('Chapters finished'),
};

export function isStatMetric(value: unknown): value is StatMetric {
  return typeof value === 'string' && (STAT_METRICS as readonly string[]).includes(value);
}

/** A count with its noun, the number grouped for the language: "1,240 strokes". */
export function metricAmount(metric: StatMetric | 'days', count: number): string {
  const params = { count: formatNumber(count) };
  switch (metric) {
    case 'strokes':
      return tn(count, '{count} stroke', '{count} strokes', params);
    case 'pagesDone':
      return tn(count, '{count} page finished', '{count} pages finished', params);
    case 'pages':
      return tn(count, '{count} page', '{count} pages', params);
    case 'panels':
      return tn(count, '{count} panel', '{count} panels', params);
    case 'words':
      return tn(count, '{count} word', '{count} words', params);
    case 'bubbles':
      return tn(count, '{count} bubble', '{count} bubbles', params);
    case 'chapters':
      return tn(count, '{count} chapter', '{count} chapters', params);
    case 'days':
      return tn(count, '{count} day', '{count} days', params);
  }
}

/** What the stories hold right now, for "all time" where the log cannot reach back. Live stories only. */
export type StoryTotals = Record<ProgressField, number>;

export function storyTotals(state: Pick<StoryData, 'projects' | 'chapters' | 'scenes' | 'pages'>): StoryTotals {
  const live = liveProjectIds(state);
  const totals: StoryTotals = { pages: 0, panels: 0, pagesDone: 0, words: 0, bubbles: 0, chapters: 0 };
  for (const chapter of Object.values(state.chapters)) {
    if (!live.has(chapter.projectId)) {
      continue;
    }
    for (const sceneId of chapter.sceneIds) {
      for (const block of state.scenes[sceneId]?.blocks ?? []) {
        totals.words += wordCount(block.text);
      }
    }
    const pages = chapter.pageIds.map(id => state.pages[id]).filter(Boolean);
    for (const page of pages) {
      totals.pages++;
      totals.panels += Object.keys(page.panels).length;
      totals.bubbles += page.bubbles.length;
      if (page.done) {
        totals.pagesDone++;
      }
    }
    if (pages.length > 0 && pages.every(page => page.done)) {
      totals.chapters++;
    }
  }
  return totals;
}

export type StatsSource = { activity: Activity; progress: ProgressLog; totals: StoryTotals };

export function metricSeries(source: StatsSource, metric: StatMetric): DaySeries {
  return metric === 'strokes' ? source.activity.days : progressSeries(source.progress, metric);
}

/**
 * The total for a period. For everything, strokes use the running total, which outlives the 400 days of
 * daily counts, and the rest use what the stories hold now.
 */
export function metricTotal(source: StatsSource, metric: StatMetric, period: Period): number {
  if (period.kind === 'all') {
    return metric === 'strokes' ? source.activity.total : source.totals[metric];
  }
  return totalIn(metricSeries(source, metric), period);
}

/** Whether the period started before the progress log did, so its numbers may miss days. */
export function beforeRecording(source: StatsSource, metric: StatMetric, period: Period): boolean {
  if (metric === 'strokes') {
    return false;
  }
  return !source.progress.since || period.start < source.progress.since;
}

export type DrawingSummary = {
  strokes: number;
  daysDrawn: number;
  /** Longest run of drawn days inside the period. */
  bestRun: number;
  buckets: Bucket[];
};

export function drawingSummary(source: StatsSource, period: Period): DrawingSummary {
  const days = daysDrawnSeries(source.activity.days);
  return {
    strokes: metricTotal(source, 'strokes', period),
    daysDrawn: activeDaysIn(days, period),
    bestRun: longestRunIn(days, period),
    buckets: bucketsOf(period, source.activity.days),
  };
}

export type StatsRecords = {
  streak: number;
  bestStreak: number;
  bestDay: { day: string; value: number } | null;
  bestPagesDay: { day: string; value: number } | null;
  bestWordsDay: { day: string; value: number } | null;
};

export function statsRecords(source: StatsSource, today: string): StatsRecords {
  const streak = currentStreak(source.activity, today);
  return {
    streak,
    // Only 400 days of activity are kept, so the current run is a floor for the best one.
    bestStreak: Math.max(bestStreak(source.activity), streak),
    bestDay: bestDayOf(source.activity.days),
    bestPagesDay: bestDayOf(progressSeries(source.progress, 'pagesDone')),
    bestWordsDay: bestDayOf(progressSeries(source.progress, 'words')),
  };
}
