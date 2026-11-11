import type { MetricKey, Metrics } from './types';

/**
 * Studio points: a game score of the person's own work, nothing more. Finishing weighs most, because a
 * finished page is what makes a manga. Raw activity such as strokes and words counts a little, so busy work
 * cannot outscore finished work. Current streak is left out: a broken streak should not take points away.
 */
export const POINT_WEIGHTS: Partial<Record<MetricKey, number>> = {
  projects: 50,
  projectsDone: 300,
  chaptersWritten: 30,
  chaptersDone: 200,
  pagesDone: 50,
  panelsDrawn: 10,
  bubbles: 3,
  sfx: 3,
  effects: 2,
  characters: 15,
  charactersFull: 40,
  relations: 10,
  worldEntries: 10,
  scriptWords: 0.2,
  dialogueLines: 2,
  strokes: 0.1,
  bestStreak: 20,
  activeDays: 10,
  promptsDone: 25,
};

/** Points from each metric, largest first, for a breakdown. */
export function pointParts(m: Metrics): { metric: MetricKey; points: number }[] {
  return (Object.entries(POINT_WEIGHTS) as [MetricKey, number][])
    .map(([metric, weight]) => ({ metric, points: Math.floor(m[metric] * weight) }))
    .filter(part => part.points > 0)
    .sort((a, b) => b.points - a.points);
}

export function studioPoints(m: Metrics): number {
  return pointParts(m).reduce((sum, part) => sum + part.points, 0);
}
