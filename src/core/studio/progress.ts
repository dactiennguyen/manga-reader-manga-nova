import type { ID, Page, StoryData } from '../model/types';
import { dayKey } from '../util/time';
import { daysBetweenKeys, liveProjectIds, pageHasArt } from './metrics';
import type { ProgressPair } from './types';

/** How long ago a memory may be, and how far off the exact day it may land. Longest first: a year beats a week. */
const MEMORIES = [
  { days: 365, slack: 3 },
  { days: 30, slack: 1 },
  { days: 7, slack: 0 },
];

type Drawn = { page: Page; madeAt: number; order: number };

/**
 * Pages with art, in the order they were made. A page has no creation time of its own, so its chapter's
 * creation and its place in the chapter stand in for it. Edits move `updatedAt` but never this order.
 */
function drawnPages(state: StoryData, hasArt: (panelId: ID) => boolean): Drawn[] {
  const live = liveProjectIds(state);
  const out: Drawn[] = [];
  const chapters = Object.values(state.chapters)
    .filter(chapter => live.has(chapter.projectId))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  for (const chapter of chapters) {
    chapter.pageIds.forEach(id => {
      const page = state.pages[id];
      if (page && pageHasArt(page, hasArt)) {
        out.push({ page, madeAt: chapter.createdAt, order: out.length });
      }
    });
  }
  return out;
}

/** The first drawn page next to the latest, and a page from about a year, a month or a week ago today. */
export function progressPair(state: StoryData, hasArt: (panelId: ID) => boolean, today: string): ProgressPair {
  const drawn = drawnPages(state, hasArt);
  if (drawn.length === 0) {
    return { firstPageId: null, latestPageId: null, daysBetween: 0, memory: null };
  }
  const first = drawn[0];
  const latest = drawn.reduce((best, item) =>
    item.page.updatedAt > best.page.updatedAt || (item.page.updatedAt === best.page.updatedAt && item.order > best.order) ? item : best,
  );
  const daysBetween = Math.max(0, daysBetweenKeys(dayKey(first.madeAt), dayKey(latest.page.updatedAt)));

  let memory: ProgressPair['memory'] = null;
  for (const { days, slack } of MEMORIES) {
    let best: { item: Drawn; off: number } | null = null;
    for (const item of drawn) {
      const ago = daysBetweenKeys(dayKey(item.page.updatedAt), today);
      const off = Math.abs(ago - days);
      if (off <= slack && (!best || off < best.off)) {
        best = { item, off };
      }
    }
    if (best) {
      memory = { pageId: best.item.page.id, daysAgo: daysBetweenKeys(dayKey(best.item.page.updatedAt), today) };
      break;
    }
  }

  return { firstPageId: first.page.id, latestPageId: latest.page.id, daysBetween, memory };
}
