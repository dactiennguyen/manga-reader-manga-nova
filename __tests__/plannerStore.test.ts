import type { MetaRepo } from '../src/core/ports';
import { parsePlanner, UNKNOWN_DAY } from '../src/core/planner/data';
import { addDays } from '../src/core/planner/days';
import { makePlan } from '../src/core/planner/plan';
import { dayKey } from '../src/core/util/time';
import { connectPlanner, usePlanner } from '../src/state/usePlanner';
import { useStory } from '../src/state/useStory';
import { addChapter, addPage, addProject, emptyStory } from './helpers/studioStory';

function memoryRepo(initial: Record<string, string> = {}): MetaRepo & { values: Record<string, string> } {
  const values = { ...initial };
  return {
    values,
    get: key => values[key] ?? null,
    set: (key, value) => {
      values[key] = value;
    },
    remove: key => {
      delete values[key];
    },
  };
}

function loadStory() {
  const state = emptyStory();
  addProject(state, 'p1', 'Moon Bakery');
  addChapter(state, 'p1', 'c1');
  addPage(state, 'c1', 'a1', { done: true });
  addPage(state, 'c1', 'a2');
  useStory.setState(state);
}

describe('planner store', () => {
  afterEach(() => {
    connectPlanner(null);
  });

  it('logs pages already done with no day, and pages marked done now with today', () => {
    loadStory();
    const repo = memoryRepo();
    connectPlanner(repo);
    expect(usePlanner.getState().doneLog).toEqual({ a1: UNKNOWN_DAY });
    const pages = useStory.getState().pages;
    useStory.setState({ pages: { ...pages, a2: { ...pages.a2, done: true } } });
    expect(usePlanner.getState().doneLog).toEqual({ a1: UNKNOWN_DAY, a2: dayKey() });
    expect(parsePlanner(repo.values.planner).doneLog.a2).toBe(dayKey());
  });

  it('saves, notes and clears a plan, and drops plans of deleted chapters at startup', () => {
    loadStory();
    const today = dayKey();
    const repo = memoryRepo({
      planner: JSON.stringify({
        plans: { gone: { chapterId: 'gone', target: 4, deadline: addDays(today, 3), workdays: [0, 1, 2, 3, 4, 5, 6] } },
      }),
    });
    connectPlanner(repo);
    expect(usePlanner.getState().plans).toEqual({});
    usePlanner.getState().setPlan(makePlan({ chapterId: 'c1', target: 5, deadline: addDays(today, 3), workdays: [0, 1, 2, 3, 4, 5, 6] }, 1, today));
    expect(parsePlanner(repo.values.planner).plans.c1.target).toBe(5);
    // Four pages left over four days.
    expect(usePlanner.getState().planned[today]).toEqual({ c1: 1 });
    usePlanner.getState().clearPlan('c1');
    expect(usePlanner.getState().plans).toEqual({});
    expect(usePlanner.getState().planned[today]).toBeUndefined();
  });

  it('remembers which week summary was seen', () => {
    loadStory();
    const repo = memoryRepo();
    connectPlanner(repo);
    usePlanner.getState().markSummarySeen('2026-11-16');
    expect(parsePlanner(repo.values.planner).summarySeen).toBe('2026-11-16');
  });
});
