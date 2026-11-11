import { msg, t } from '../i18n';
import type { Badge, BadgeTier, MetricKey, Metrics } from './types';

/** What each badge asks for, one text per count so the tiers of a metric share it. */
const TEXT: Partial<Record<MetricKey, string>> = {
  strokes: msg('Draw {count} strokes'),
  panelsDrawn: msg('Draw in {count} panels'),
  pagesDone: msg('Finish {count} pages'),
  chaptersDone: msg('Finish {count} chapters'),
  projectsDone: msg('Mark {count} stories as done'),
  scriptWords: msg('Write {count} words of script'),
  dialogueLines: msg('Write {count} lines of dialogue'),
  chaptersWritten: msg('Script {count} chapters'),
  characters: msg('Create {count} characters'),
  charactersFull: msg('Fill in {count} full character profiles'),
  relations: msg('Link characters with {count} relationships'),
  worldEntries: msg('Add {count} world entries'),
  bubbles: msg('Letter {count} speech bubbles'),
  sfx: msg('Place {count} sound effects'),
  effects: msg('Add {count} effects like speed lines'),
  bestStreak: msg('Draw {count} days in a row'),
  activeDays: msg('Draw on {count} different days'),
  promptsDone: msg('Finish {count} daily prompts'),
  giftsOpened: msg('Open {count} gifts'),
};

/** The same asks for a count of one, which reads better without a number. */
const ONE: Partial<Record<MetricKey, string>> = {
  pagesDone: msg('Finish a page'),
  chaptersDone: msg('Finish a chapter'),
  projectsDone: msg('Mark a story as done'),
  charactersFull: msg('Fill in one full character profile'),
  promptsDone: msg('Finish a daily prompt'),
  giftsOpened: msg('Open a gift'),
};

const badge = (id: string, title: string, tier: BadgeTier, metric: MetricKey, count: number): Badge => ({
  id,
  title,
  text: (count === 1 ? ONE[metric] : undefined) ?? TEXT[metric] ?? '',
  tier,
  metric,
  count,
});

/** Grouped by area, easiest first in each. Ids are saved as seen, so they never change. */
export const BADGES: Badge[] = [
  // Drawing
  badge('first-ink', msg('First ink'), 'bronze', 'strokes', 100),
  badge('steady-hand', msg('Steady hand'), 'silver', 'strokes', 5000),
  badge('ink-machine', msg('Ink machine'), 'gold', 'strokes', 50000),
  badge('panel-filler', msg('Panel filler'), 'bronze', 'panelsDrawn', 10),
  badge('panel-pro', msg('Panel pro'), 'silver', 'panelsDrawn', 150),
  badge('first-page', msg('First page'), 'bronze', 'pagesDone', 1),
  badge('page-turner', msg('Page turner'), 'silver', 'pagesDone', 25),
  badge('hundred-pages', msg('Hundred pages'), 'gold', 'pagesDone', 100),
  badge('chapter-one', msg('Chapter one'), 'silver', 'chaptersDone', 1),
  badge('volume-one', msg('Volume one'), 'gold', 'chaptersDone', 8),
  badge('the-end', msg('The end'), 'gold', 'projectsDone', 1),
  // Writing
  badge('first-words', msg('First words'), 'bronze', 'scriptWords', 300),
  badge('storyteller', msg('Storyteller'), 'silver', 'scriptWords', 5000),
  badge('talker', msg('Big talker'), 'bronze', 'dialogueLines', 30),
  badge('script-desk', msg('Script desk'), 'silver', 'chaptersWritten', 5),
  // Characters
  badge('first-cast', msg('Small cast'), 'bronze', 'characters', 3),
  badge('full-cast', msg('Full cast'), 'silver', 'characters', 12),
  badge('true-to-life', msg('True to life'), 'bronze', 'charactersFull', 1),
  badge('deep-cast', msg('Deep cast'), 'gold', 'charactersFull', 8),
  badge('tangled', msg('Tangled web'), 'silver', 'relations', 6),
  // World
  badge('mapmaker', msg('Mapmaker'), 'bronze', 'worldEntries', 5),
  badge('worldbuilder', msg('Worldbuilder'), 'silver', 'worldEntries', 25),
  // Lettering
  badge('letterer', msg('Letterer'), 'bronze', 'bubbles', 25),
  badge('word-balloons', msg('Word balloons'), 'silver', 'bubbles', 300),
  badge('kaboom', msg('Ka-boom'), 'bronze', 'sfx', 10),
  badge('speed-lines', msg('Speed lines'), 'bronze', 'effects', 5),
  // Streaks
  badge('warming-up', msg('Warming up'), 'bronze', 'bestStreak', 3),
  badge('week-of-ink', msg('A week of ink'), 'silver', 'bestStreak', 7),
  badge('iron-pen', msg('Iron pen'), 'gold', 'bestStreak', 30),
  badge('regular', msg('Regular'), 'silver', 'activeDays', 30),
  badge('veteran', msg('Veteran'), 'gold', 'activeDays', 150),
  // Prompts and gifts
  badge('prompted', msg('Prompted'), 'bronze', 'promptsDone', 1),
  badge('prompt-habit', msg('Prompt habit'), 'silver', 'promptsDone', 20),
  badge('gift-wrapped', msg('Gift wrapped'), 'bronze', 'giftsOpened', 1),
  badge('collector', msg('Collector'), 'gold', 'giftsOpened', 12),
];

export function badgeText(item: Badge): string {
  return t(item.text, { count: item.count });
}

export function earnedBadges(m: Metrics): Badge[] {
  return BADGES.filter(item => m[item.metric] >= item.count);
}

/** Earned and not yet shown, to announce once. */
export function newBadges(m: Metrics, seen: string[]): Badge[] {
  const shown = new Set(seen);
  return earnedBadges(m).filter(item => !shown.has(item.id));
}

/** How far toward a badge, 0 to 1. */
export function badgeProgress(item: Badge, m: Metrics): number {
  return Math.min(1, m[item.metric] / item.count);
}
