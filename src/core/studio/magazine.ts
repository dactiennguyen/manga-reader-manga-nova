import type { ID, Page, StoryData } from '../model/types';
import { DAY_MS, dayKey, dayKeyToDate } from '../util/time';
import { daysBetweenKeys, liveProjectIds, livePages, pageHasArt } from './metrics';
import type { Issue, RankedChapter, StudioState } from './types';

const WEEK_DAYS = 7;

function shiftDay(day: string, delta: number): string {
  const date = dayKeyToDate(day);
  // Noon keeps the result on the right day across a daylight-saving change.
  date.setHours(12);
  return dayKey(date.getTime() + delta * DAY_MS);
}

/**
 * How many issues have come out: one on each issue weekday from the day the first story was made up to
 * today, both included, and at least 1, so the number goes up on release day.
 */
function issuesOut(firstDay: string, today: string, weekday: number): number {
  const days = daysBetweenKeys(firstDay, today);
  const first = (weekday - dayKeyToDate(firstDay).getDay() + WEEK_DAYS) % WEEK_DAYS;
  return Math.max(1, days < first ? 0 : Math.floor((days - first) / WEEK_DAYS) + 1);
}

/**
 * This week's issue of the person's own magazine, made from their own work. It counts up one on each issue
 * weekday from the day the first story was made, leads with their latest finished drawn page, and lists the chapters
 * they worked on this week, best ranked by the reading club first.
 */
export function issueOf(
  state: StoryData,
  studio: Pick<StudioState, 'issueWeekday'>,
  today: string,
  rank: RankedChapter[],
  hasArt: (panelId: ID) => boolean,
): Issue {
  const live = liveProjectIds(state);
  const projects = Object.values(state.projects).filter(project => live.has(project.id));
  const firstMade = projects.reduce((min, project) => Math.min(min, project.createdAt), Infinity);

  const pages = livePages(state);
  const newest = (list: Page[]) =>
    list.reduce<Page | null>((best, page) => (!best || page.updatedAt > best.updatedAt || (page.updatedAt === best.updatedAt && page.id > best.id) ? page : best), null);
  const drawn = pages.filter(page => pageHasArt(page, hasArt));
  const cover = newest(drawn.filter(page => page.done)) ?? newest(drawn);

  // The last seven days, today included.
  const weekStart = dayKeyToDate(shiftDay(today, -(WEEK_DAYS - 1))).getTime();
  const touched = new Map<ID, number>();
  for (const page of pages) {
    if (page.updatedAt >= weekStart) {
      touched.set(page.chapterId, Math.max(touched.get(page.chapterId) ?? 0, page.updatedAt));
    }
  }
  const rankOf = new Map(rank.map(item => [item.chapterId, item.rank]));
  const contents = [...touched.keys()]
    .sort((a, b) => {
      const ra = rankOf.get(a) ?? Infinity;
      const rb = rankOf.get(b) ?? Infinity;
      return ra !== rb ? ra - rb : (touched.get(b) ?? 0) - (touched.get(a) ?? 0);
    })
    .map(chapterId => ({ chapterId, projectId: state.chapters[chapterId].projectId }));

  const weekday = Math.min(6, Math.max(0, Math.floor(studio.issueWeekday)));
  // 0 when the issue comes out today.
  const daysLeft = (weekday - dayKeyToDate(today).getDay() + WEEK_DAYS) % WEEK_DAYS;

  return {
    number: Number.isFinite(firstMade) ? issuesOut(dayKey(firstMade), today, weekday) : 1,
    coverPageId: cover?.id ?? null,
    contents,
    nextDay: shiftDay(today, daysLeft),
    daysLeft,
  };
}
