/** The reading club's ranking of the person's own chapters, best average first. Only chapters with something to read count. */
import { activeProjects, chapterIdsOf } from '../model/selectors';
import type { ID, StoryData } from '../model/types';
import { chapterTouchedAt } from './castUtil';
import { chapterReview } from './readers';
import type { ChapterReview, RankedChapter } from './types';

/** Every review of the live stories' chapters, by chapter, and the ranking made from them. Work it out once and share it. */
export type ClubReviews = { reviews: ReadonlyMap<ID, ChapterReview>; ranking: RankedChapter[] };

export function clubReviews(state: StoryData, hasArt?: (panelId: ID) => boolean): ClubReviews {
  const reviews = new Map<ID, ChapterReview>();
  const rows: (Omit<RankedChapter, 'rank'> & { at: number })[] = [];
  for (const project of activeProjects(state)) {
    for (const chapterId of chapterIdsOf(project)) {
      const review = chapterReview(state, chapterId, hasArt);
      if (review) {
        reviews.set(chapterId, review);
        rows.push({ chapterId, projectId: project.id, average: review.average, at: chapterTouchedAt(state, chapterId) });
      }
    }
  }
  // Ties go to the chapter worked on more recently, then to the id so the order never flickers.
  rows.sort((a, b) => b.average - a.average || b.at - a.at || (a.chapterId < b.chapterId ? -1 : 1));
  const ranking = rows.map(({ chapterId, projectId, average }, index) => ({ chapterId, projectId, average, rank: index + 1 }));
  return { reviews, ranking };
}

export function clubRanking(state: StoryData, hasArt?: (panelId: ID) => boolean): RankedChapter[] {
  return clubReviews(state, hasArt).ranking;
}
