import { useMemo } from 'react';

import { metricsOf } from '../core/studio/metrics';
import { EMPTY_STUDIO, type Metrics, type StudioState } from '../core/studio/types';
import { dayKey } from '../core/util/time';
import { panelHasArt, useArtVersion } from './artStore';
import { useStoryData } from './hooks';
import { useActivity } from './useActivity';
import { useStudio } from './useStudio';

/** The studio's saved data without its actions, rebuilt only when a field changes. */
export function useStudioState(): StudioState {
  const promptDays = useStudio(s => s.promptDays);
  const giftsOpened = useStudio(s => s.giftsOpened);
  const unlocked = useStudio(s => s.unlocked);
  const giftRewards = useStudio(s => s.giftRewards);
  const badgesSeen = useStudio(s => s.badgesSeen);
  const mailRead = useStudio(s => s.mailRead);
  const levelSeen = useStudio(s => s.levelSeen);
  const clubIntroSeen = useStudio(s => s.clubIntroSeen);
  const issueWeekday = useStudio(s => s.issueWeekday);
  const editorHiddenDay = useStudio(s => s.editorHiddenDay);
  const chatHiddenDay = useStudio(s => s.chatHiddenDay);
  const cardFrames = useStudio(s => s.cardFrames);
  return useMemo(
    () => ({
      promptDays,
      giftsOpened,
      unlocked,
      giftRewards,
      badgesSeen,
      mailRead,
      levelSeen,
      clubIntroSeen,
      issueWeekday,
      editorHiddenDay,
      chatHiddenDay,
      cardFrames,
    }),
    [promptDays, giftsOpened, unlocked, giftRewards, badgesSeen, mailRead, levelSeen, clubIntroSeen, issueWeekday, editorHiddenDay, chatHiddenDay, cardFrames],
  );
}

/**
 * The studio counts for today, from the stories, the drawing activity, the studio record and which panels
 * have art. Worked out again only when one of those changes. The day is read on each render, so a screen
 * open past midnight moves to the new day on its next render.
 */
export function useMetrics(): Metrics {
  const state = useStoryData();
  const activity = useActivity();
  const promptDays = useStudio(s => s.promptDays);
  const giftsOpened = useStudio(s => s.giftsOpened);
  const artVersion = useArtVersion();
  const today = dayKey();
  return useMemo(
    () => metricsOf(state, activity, { ...EMPTY_STUDIO, promptDays, giftsOpened }, today, panelHasArt),
    // Art is not in React state: artVersion is what says it changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, activity, promptDays, giftsOpened, artVersion, today],
  );
}
