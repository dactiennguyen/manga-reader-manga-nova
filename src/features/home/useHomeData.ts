import { useMemo } from 'react';

import { activeProjects } from '../../core/model/selectors';
import type { ID, Project, StoryData } from '../../core/model/types';
import type { Activity } from '../../core/story/activity';
import { levelIndexOf } from '../../core/studio/journey';
import { metricsOf } from '../../core/studio/metrics';
import { clubReviews, type ClubReviews } from '../../core/studio/ranking';
import { latestDrawnPage } from '../../core/studio/trailer';
import { EMPTY_STUDIO, type Metrics, type StudioState } from '../../core/studio/types';
import { dayKey } from '../../core/util/time';
import { panelHasArt, useArtVersion } from '../../state/artStore';
import { useStoryData, useWhileFocused } from '../../state/hooks';
import { useActivity } from '../../state/useActivity';
import { useStudioState } from '../../state/useMetrics';

/** Everything the Home cards read, worked out once per change and passed down. */
export type HomeData = {
  state: StoryData;
  activity: Activity;
  /** Bumps when any panel's art changes, for the rules that look at drawn panels. */
  artVersion: number;
  m: Metrics;
  studio: StudioState;
  today: string;
  projects: Project[];
  /** The story worked on last, if any. */
  project: Project | undefined;
  levelIndex: number;
  drewToday: boolean;
  /** The club's reviews and ranking, shared by the magazine, the club and the letters. */
  club: ClubReviews;
  /** The newest drawn page of the latest story, for the hero, or null before anything is drawn. */
  heroPageId: ID | null;
};

type Live = { state: StoryData; activity: Activity; artVersion: number; today: string };

/**
 * Home stays mounted under the canvas, and every stroke changes the stories, the activity and the art. While
 * Home is out of sight it keeps the last inputs it showed, so none of its cards are worked out again until it
 * comes back. This is why it builds the metrics here instead of through useMetrics.
 */
export function useHomeData(): HomeData {
  const storyData = useStoryData();
  const liveActivity = useActivity();
  const liveArt = useArtVersion();
  const studio = useStudioState();
  const day = dayKey();
  const live = useMemo<Live>(
    () => ({ state: storyData, activity: liveActivity, artVersion: liveArt, today: day }),
    [storyData, liveActivity, liveArt, day],
  );
  const { state, activity, artVersion, today } = useWhileFocused(live);
  const { promptDays, giftsOpened } = studio;

  const m = useMemo(
    () => metricsOf(state, activity, { ...EMPTY_STUDIO, promptDays, giftsOpened }, today, panelHasArt),
    // Art is not React state: artVersion is what says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, activity, promptDays, giftsOpened, artVersion, today],
  );
  const projects = useMemo(() => activeProjects(state), [state]);
  const levelIndex = useMemo(() => levelIndexOf(m), [m]);
  const project = projects[0];
  const club = useMemo(
    () => clubReviews(state, panelHasArt),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, artVersion],
  );
  const heroPageId = useMemo(
    () => (project ? latestDrawnPage(state, project.id, panelHasArt) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, project, artVersion],
  );

  const drewToday = (activity.days[today] ?? 0) > 0;

  // One object that changes only with its parts, so cards wrapped in memo skip the renders Home makes for nothing.
  return useMemo(
    () => ({ state, activity, artVersion, m, studio, today, projects, project, levelIndex, drewToday, club, heroPageId }),
    [state, activity, artVersion, m, studio, today, projects, project, levelIndex, drewToday, club, heroPageId],
  );
}
