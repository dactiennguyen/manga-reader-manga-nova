import { useMemo } from 'react';

import { storyTotals, type StatsSource } from '../../core/stats/overview';
import { WEEK_START, firstDayOf, type WeekStart } from '../../core/stats/period';
import { PROGRESS_FIELDS, progressSeries } from '../../core/stats/progress';
import { dayKey } from '../../core/util/time';
import { useActivity } from '../../state/useActivity';
import { useStats } from '../../state/useStats';
import { useStory } from '../../state/useStory';

export type StatsData = {
  source: StatsSource;
  today: string;
  weekStart: WeekStart;
  /** The oldest day with any data, where "all time" starts. */
  firstDay: string | undefined;
};

/** Everything the statistics screens read, rebuilt only when a source changes. */
export function useStatsData(): StatsData {
  const activity = useActivity();
  const progress = useStats(s => s.progress);
  const projects = useStory(s => s.projects);
  const chapters = useStory(s => s.chapters);
  const scenes = useStory(s => s.scenes);
  const pages = useStory(s => s.pages);
  const totals = useMemo(() => storyTotals({ projects, chapters, scenes, pages }), [projects, chapters, scenes, pages]);
  const today = dayKey();
  // The language is fixed while a screen is shown: changing it redraws every screen.
  const weekStart = WEEK_START;
  return useMemo(() => {
    const firstDay = firstDayOf(activity.days, ...PROGRESS_FIELDS.map(field => progressSeries(progress, field)));
    return { source: { activity, progress, totals }, today, weekStart, firstDay };
  }, [activity, progress, totals, today, weekStart]);
}
