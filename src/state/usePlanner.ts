import { create } from 'zustand';

import {
  EMPTY_PLANNER,
  parsePlanner,
  planViews,
  prunePlanner,
  recordPlanned,
  serializePlanner,
  syncDoneLog,
  type PlannerData,
} from '../core/planner/data';
import type { ChapterPlan } from '../core/planner/plan';
import type { ID } from '../core/model/types';
import type { MetaRepo } from '../core/ports';
import { dayKey } from '../core/util/time';
import { useStory } from './useStory';

const KEY = 'planner';

let repo: MetaRepo | null = null;
let unsubscribe: (() => void) | null = null;

type PlannerActions = {
  setPlan: (plan: ChapterPlan) => void;
  clearPlan: (chapterId: ID) => void;
  /** Notes today's planned pages, for the calendar to show once the day is over. */
  noteToday: (today?: string) => void;
  markSummarySeen: (weekStart: string) => void;
};

export type PlannerStore = PlannerData & PlannerActions;

function pick(state: PlannerData): PlannerData {
  return { plans: state.plans, doneLog: state.doneLog, planned: state.planned, summarySeen: state.summarySeen };
}

function save(next: PlannerData): void {
  usePlanner.setState(next);
  repo?.set(KEY, serializePlanner(pick(next)));
}

function withToday(data: PlannerData, today: string): PlannerData {
  return recordPlanned(data, planViews(data, useStory.getState(), today), today);
}

/** Chapter plans, the day each page was finished and the pages planned on past days. Rare, small writes. */
export const usePlanner = create<PlannerStore>()((_set, get) => ({
  ...EMPTY_PLANNER,
  setPlan: plan => save(withToday({ ...pick(get()), plans: { ...get().plans, [plan.chapterId]: plan } }, dayKey())),
  clearPlan: chapterId => {
    if (!get().plans[chapterId]) {
      return;
    }
    const plans = { ...get().plans };
    delete plans[chapterId];
    save(withToday({ ...pick(get()), plans }, dayKey()));
  },
  noteToday: (today = dayKey()) => {
    const before = pick(get());
    const next = withToday(before, today);
    if (next !== before) {
      save(next);
    }
  },
  markSummarySeen: weekStart => {
    if (get().summarySeen !== weekStart) {
      save({ ...pick(get()), summarySeen: weekStart });
    }
  },
}));

/**
 * Loads the planner after the stories, drops what deleted work left behind, and from then on logs the day
 * each page is marked done.
 */
export function connectPlanner(next: MetaRepo | null): void {
  repo = next;
  unsubscribe?.();
  unsubscribe = null;
  const today = dayKey();
  const loaded = parsePlanner(next?.get(KEY));
  const pruned = withToday(prunePlanner(loaded, useStory.getState(), today), today);
  usePlanner.setState(pruned);
  if (pruned !== loaded) {
    repo?.set(KEY, serializePlanner(pick(pruned)));
  }
  unsubscribe = useStory.subscribe((state, previous) => {
    if (state.pages === previous.pages) {
      return;
    }
    const current = usePlanner.getState();
    const doneLog = syncDoneLog(current.doneLog, state.pages, previous.pages, dayKey());
    if (doneLog !== current.doneLog) {
      save({ ...pick(current), doneLog });
    }
  });
}
