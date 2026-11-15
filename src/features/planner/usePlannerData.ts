import { useEffect, useMemo } from 'react';

import { chapterLabel } from '../../core/model/selectors';
import type { ID, StoryData } from '../../core/model/types';
import { plannerContext, type PlannerContext } from '../../core/planner/calendar';
import type { PlannerData } from '../../core/planner/data';
import { dayKey } from '../../core/util/time';
import { useStoryData } from '../../state/hooks';
import { useActivity } from '../../state/useActivity';
import { usePlanner } from '../../state/usePlanner';

export function usePlannerFields(): PlannerData {
  const plans = usePlanner(s => s.plans);
  const doneLog = usePlanner(s => s.doneLog);
  const planned = usePlanner(s => s.planned);
  const summarySeen = usePlanner(s => s.summarySeen);
  return useMemo(() => ({ plans, doneLog, planned, summarySeen }), [plans, doneLog, planned, summarySeen]);
}

/** Notes today's planned pages when a planner screen shows on a new day. */
export function useNoteToday(today: string): void {
  useEffect(() => {
    usePlanner.getState().noteToday(today);
  }, [today]);
}

/** Everything a planner screen reads, worked out once per change. */
export function usePlannerContext(): { context: PlannerContext; state: StoryData; data: PlannerData } {
  const state = useStoryData();
  const activity = useActivity();
  const data = usePlannerFields();
  const today = dayKey();
  useNoteToday(today);
  const context = useMemo(() => plannerContext(data, state, activity, today), [data, state, activity, today]);
  return { context, state, data };
}

/** "Chapter 3 · The bridge" and the story's title, for a plan row. */
export function chapterTitles(state: StoryData, chapterId: ID): { chapter: string; story: string } {
  const chapter = state.chapters[chapterId];
  const project = chapter ? state.projects[chapter.projectId] : undefined;
  return { chapter: chapterLabel(state, chapterId), story: project?.title.trim() ?? '' };
}
