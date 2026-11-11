import { msg, t } from '../i18n';
import type { Level, LevelProgress, Metrics, Requirement } from './types';

/**
 * The mangaka journey. Each level asks for work a person really does over days and weeks: finished pages,
 * finished chapters, and drawing on many days. Nothing can be bought or skipped, and the best streak counts
 * instead of the current one, so a missed day never takes a level away.
 */
export const LEVELS: Level[] = [
  {
    id: 'rookie',
    index: 0,
    title: msg('Rookie'),
    blurb: msg('Every mangaka starts with a blank page.'),
    needs: [],
  },
  {
    id: 'assistant',
    index: 1,
    title: msg('Assistant'),
    blurb: msg('You have a story, a finished page and a drawing habit.'),
    needs: [
      { metric: 'projects', count: 1, label: msg('Start a story') },
      { metric: 'pagesDone', count: 1, label: msg('Finish a page') },
      { metric: 'bestStreak', count: 3, label: msg('Draw {count} days in a row') },
    ],
  },
  {
    id: 'oneshot',
    index: 2,
    title: msg('One-shot debut'),
    blurb: msg('A whole chapter, start to end. That is a one-shot.'),
    needs: [
      { metric: 'chaptersDone', count: 1, label: msg('Finish a chapter') },
      { metric: 'pagesDone', count: 8, label: msg('Finish {count} pages') },
      { metric: 'charactersFull', count: 1, label: msg('Fill in one full character profile') },
      { metric: 'activeDays', count: 7, label: msg('Draw on {count} different days') },
    ],
  },
  {
    id: 'serial',
    index: 3,
    title: msg('Serialized'),
    blurb: msg('Chapter after chapter: your story runs as a series.'),
    needs: [
      { metric: 'chaptersDone', count: 2, label: msg('Finish {count} chapters') },
      { metric: 'pagesDone', count: 20, label: msg('Finish {count} pages') },
      { metric: 'bestStreak', count: 7, label: msg('Draw {count} days in a row') },
      { metric: 'worldEntries', count: 3, label: msg('Add {count} world entries') },
    ],
  },
  {
    id: 'cover',
    index: 4,
    title: msg('On the cover'),
    blurb: msg('Your work is good enough to lead the issue.'),
    needs: [
      { metric: 'chaptersDone', count: 2, label: msg('Finish {count} chapters') },
      { metric: 'pagesDone', count: 35, label: msg('Finish {count} pages') },
      { metric: 'bestStreak', count: 14, label: msg('Draw {count} days in a row') },
      { metric: 'activeDays', count: 30, label: msg('Draw on {count} different days') },
      { metric: 'bubbles', count: 150, label: msg('Letter {count} speech bubbles') },
    ],
  },
  {
    id: 'anime',
    index: 5,
    title: msg('Anime adaptation'),
    blurb: msg('Months of steady work. The studios would come calling.'),
    needs: [
      { metric: 'chaptersDone', count: 3, label: msg('Finish {count} chapters') },
      { metric: 'pagesDone', count: 60, label: msg('Finish {count} pages') },
      { metric: 'bestStreak', count: 30, label: msg('Draw {count} days in a row') },
      { metric: 'activeDays', count: 60, label: msg('Draw on {count} different days') },
    ],
  },
];

/** A requirement as shown, such as "Finish 8 pages". */
export function requirementText(need: Requirement): string {
  return t(need.label, { count: need.count });
}

function meets(m: Metrics, level: Level): boolean {
  return level.needs.every(need => m[need.metric] >= need.count);
}

/** Levels are climbed in order, so a later level is never reached before an earlier one. */
export function levelIndexOf(m: Metrics): number {
  let index = 0;
  while (index + 1 < LEVELS.length && meets(m, LEVELS[index + 1])) {
    index++;
  }
  return index;
}

export function levelProgress(m: Metrics): LevelProgress {
  const level = LEVELS[levelIndexOf(m)];
  const next = LEVELS[level.index + 1] ?? null;
  if (!next) {
    return { level, next: null, progress: 1, steps: [] };
  }
  const steps = next.needs.map(need => ({ need, have: m[need.metric] }));
  const progress = steps.reduce((sum, step) => sum + Math.min(1, step.have / step.need.count), 0) / steps.length;
  return { level, next, progress, steps };
}
