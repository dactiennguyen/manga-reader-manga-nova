import { useMemo } from 'react';

import { clubReviews } from '../../../core/studio/ranking';
import type { ChapterReview, RankedChapter } from '../../../core/studio/types';
import { panelHasArt, useArtVersion } from '../../../state/artStore';
import { useStoryData } from '../../../state/hooks';

/** The club's ranking with each chapter's review, worked out again only when the stories or the art change. */
export function useClubReviews(): { rank: RankedChapter; review: ChapterReview }[] {
  const state = useStoryData();
  const artVersion = useArtVersion();
  return useMemo(
    () => {
      const { reviews, ranking } = clubReviews(state, panelHasArt);
      return ranking.flatMap(rank => {
        const review = reviews.get(rank.chapterId);
        return review ? [{ rank, review }] : [];
      });
    },
    // Art is not in React state: artVersion is what says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, artVersion],
  );
}
