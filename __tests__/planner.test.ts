import type { StoryData } from '../src/core/model/types';
import { EMPTY_ACTIVITY, type Activity } from '../src/core/story/activity';
import { agenda, dayInfo, plannerContext, weekSummary } from '../src/core/planner/calendar';
import {
  EMPTY_PLANNER,
  PLANNED_KEEP_DAYS,
  UNKNOWN_DAY,
  chapterIsLive,
  doneByDay,
  doneOnDay,
  parsePlanner,
  planViews,
  prunePlanner,
  recordPlanned,
  serializePlanner,
  syncDoneLog,
  type PlannerData,
} from '../src/core/planner/data';
import {
  addDays,
  addMonths,
  dayRange,
  daysBetween,
  isDayKey,
  monthGrid,
  weekDays,
  weekStartOf,
  weekdayOf,
  weekdayOrder,
} from '../src/core/planner/days';
import {
  ALL_WEEKDAYS,
  MAX_TARGET,
  WORKWEEK,
  distribute,
  expectedBy,
  makePlan,
  pagesOn,
  parsePlan,
  viewPlan,
  workDays,
  type ChapterPlan,
} from '../src/core/planner/plan';
import { dayEntryText, daysLeftText, monthTitle, planAdvice, planReminderText, todayText, weekLine } from '../src/core/planner/words';
import { addChapter, addPage, addProject, emptyStory } from './helpers/studioStory';

// 2026-11-16 is a Monday.
const MON = '2026-11-16';
const TUE = '2026-11-17';
const WED = '2026-11-18';
const FRI = '2026-11-20';
const SAT = '2026-11-21';
const SUN = '2026-11-22';
const NEXT_MON = '2026-11-23';

function plan(patch: Partial<ChapterPlan> = {}): ChapterPlan {
  return { chapterId: 'c1', target: 10, deadline: FRI, workdays: [...WORKWEEK], start: MON, startDone: 0, ...patch };
}

describe('planner days', () => {
  it('adds days and counts between them across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-11-15', '2026-12-15')).toBe(30);
    expect(daysBetween(FRI, MON)).toBe(-4);
  });

  it('knows weekdays and week starts, Monday first by default', () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(weekdayOf('2026-11-15')).toBe(0);
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
    expect(weekStartOf(MON)).toBe(MON);
    expect(weekStartOf(SUN)).toBe(MON);
    expect(weekStartOf('2026-11-15', 0)).toBe('2026-11-15');
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
    expect(weekDays(MON)).toEqual([MON, TUE, WED, '2026-11-19', FRI, SAT, SUN]);
    expect(weekdayOrder()).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('checks day keys', () => {
    expect(isDayKey('2026-11-15')).toBe(true);
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-1-5')).toBe(false);
    expect(isDayKey(20261115)).toBe(false);
  });

  it('lists ranges and lays a month out in Monday-first weeks', () => {
    expect(dayRange(FRI, MON)).toEqual([]);
    expect(dayRange(FRI, SUN)).toEqual([FRI, SAT, SUN]);
    const grid = monthGrid({ year: 2026, month: 10 });
    expect(grid).toHaveLength(6);
    expect(grid[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(grid[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
    expect(monthGrid({ year: 2027, month: 1 })).toHaveLength(4);
    expect(addMonths({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe('splitting a plan into days', () => {
  it('spreads pages evenly, the first days taking the extra ones', () => {
    expect(distribute(10, 4)).toEqual([3, 3, 2, 2]);
    expect(distribute(10, 5)).toEqual([2, 2, 2, 2, 2]);
    expect(distribute(0, 3)).toEqual([0, 0, 0]);
    expect(distribute(5, 0)).toEqual([]);
    expect(distribute(-3, 2)).toEqual([0, 0]);
  });

  it('plans only on the chosen weekdays', () => {
    expect(workDays(FRI, NEXT_MON, WORKWEEK)).toEqual({ days: [FRI, NEXT_MON], restDays: false });
    const view = viewPlan(plan({ target: 6, deadline: NEXT_MON, start: FRI }), 0, 0, FRI);
    expect(view.schedule).toEqual([
      { day: FRI, pages: 3 },
      { day: NEXT_MON, pages: 3 },
    ]);
    expect(pagesOn(view, SAT)).toBe(0);
    expect(view.workDaysLeft).toBe(2);
  });

  it('starts on track with the even split', () => {
    const view = viewPlan(plan(), 0, 0, MON);
    expect(view).toMatchObject({ todayPlanned: 2, todayLeft: 2, perDay: 2, remaining: 10, status: 'onTrack', gap: 0, daysLeft: 4 });
    expect(view.schedule.map(item => item.pages)).toEqual([2, 2, 2, 2, 2]);
  });

  it("keeps pages finished today in today's goal", () => {
    const view = viewPlan(plan(), 1, 1, MON);
    expect(view).toMatchObject({ todayPlanned: 2, todayLeft: 1, remaining: 9, status: 'onTrack' });
    expect(view.schedule.map(item => item.pages)).toEqual([2, 2, 2, 2, 2]);
    const more = viewPlan(plan(), 4, 4, MON);
    expect(more).toMatchObject({ todayPlanned: 2, todayLeft: 0, status: 'ahead', gap: 2 });
    expect(more.schedule.map(item => item.pages)).toEqual([2, 2, 2, 1, 1]);
  });

  it('spreads missed days over the days left and says the plan is behind', () => {
    const view = viewPlan(plan(), 0, 0, WED);
    expect(view.schedule).toEqual([
      { day: WED, pages: 4 },
      { day: '2026-11-19', pages: 3 },
      { day: FRI, pages: 3 },
    ]);
    expect(view).toMatchObject({ todayPlanned: 4, perDay: 4, status: 'behind', gap: 4 });
    expect(planAdvice(view)).toBe('4 pages behind. 4 pages a day still finishes on time.');
  });

  it('says the plan is ahead when more is done than expected', () => {
    const view = viewPlan(plan(), 6, 0, TUE);
    expect(view).toMatchObject({ status: 'ahead', gap: 2, todayPlanned: 1 });
    expect(expectedBy(plan(), MON)).toBe(2);
    expect(expectedBy(plan(), TUE)).toBe(4);
  });

  it('is overdue once the deadline has passed with pages left', () => {
    const view = viewPlan(plan(), 7, 0, NEXT_MON);
    expect(view).toMatchObject({ status: 'overdue', remaining: 3, gap: 3, todayPlanned: 0, perDay: 0, daysLeft: -3, schedule: [] });
    expect(daysLeftText(view)).toBe('3 days late');
    expect(todayText(view)).toBe('Past the deadline');
  });

  it('is done with no pages left, even past the deadline', () => {
    const view = viewPlan(plan(), 10, 0, WED);
    expect(view).toMatchObject({ status: 'done', remaining: 0, todayPlanned: 0, todayLeft: 0, schedule: [] });
    expect(viewPlan(plan(), 12, 0, NEXT_MON).status).toBe('done');
    expect(todayText(view)).toBe('Chapter done');
  });

  it('works on the deadline day itself', () => {
    const view = viewPlan(plan(), 8, 0, FRI);
    expect(view).toMatchObject({ daysLeft: 0, todayPlanned: 2, status: 'onTrack' });
    expect(daysLeftText(view)).toBe('Due today');
  });

  it('uses days off when no work day is left before the deadline', () => {
    const view = viewPlan(plan({ target: 4, deadline: SUN, start: SAT }), 0, 0, SAT);
    expect(view.usesRestDays).toBe(true);
    expect(view.schedule.map(item => item.pages)).toEqual([2, 2]);
    expect(planAdvice(view)).toMatch(/days off/);
  });

  it('gives no pages on a day off', () => {
    const view = viewPlan(plan({ deadline: NEXT_MON }), 0, 0, SAT);
    expect(view.todayPlanned).toBe(0);
    expect(todayText(view)).toBe('Day off from this chapter');
    expect(view.schedule[0]).toEqual({ day: NEXT_MON, pages: 10 });
  });

  it('makes and reads plans safely', () => {
    const made = makePlan({ chapterId: 'c1', target: 9999, deadline: '2026-11-01', workdays: [] }, 3, MON);
    expect(made).toEqual({ chapterId: 'c1', target: MAX_TARGET, deadline: MON, workdays: ALL_WEEKDAYS, start: MON, startDone: 3 });
    expect(parsePlan({ chapterId: 'c1', target: 0, deadline: FRI, workdays: [5, 5, 9, 1] })).toEqual({
      chapterId: 'c1',
      target: 1,
      deadline: FRI,
      workdays: [1, 5],
      start: FRI,
      startDone: 0,
    });
    expect(parsePlan({ chapterId: 'c1', deadline: 'soon' })).toBeNull();
    expect(parsePlan(null)).toBeNull();
  });
});

function story(): StoryData {
  const state = emptyStory();
  addProject(state, 'p1', 'Moon Bakery');
  addChapter(state, 'p1', 'c1');
  addChapter(state, 'p1', 'c2', { title: 'The oven' });
  for (let i = 1; i <= 4; i++) {
    addPage(state, 'c1', `a${i}`);
    addPage(state, 'c2', `b${i}`);
  }
  return state;
}

describe('planner data', () => {
  it('logs the day a page turns done, and no day for pages already done', () => {
    const state = story();
    const before = state.pages;
    const after = { ...before, a1: { ...before.a1, done: true }, new1: { ...before.a2, id: 'new1', done: true } };
    const log = syncDoneLog({}, after, before, MON);
    expect(log).toEqual({ a1: MON, new1: UNKNOWN_DAY });
    expect(syncDoneLog(log, after, after, TUE)).toBe(log);
    const undone = { ...after, a1: { ...after.a1, done: false } };
    expect(syncDoneLog(log, undone, after, TUE)).toEqual({ new1: UNKNOWN_DAY });
  });

  it('counts pages done per day and chapter', () => {
    const state = story();
    state.pages.a1.done = true;
    state.pages.a2.done = true;
    state.pages.b1.done = true;
    const log = { a1: MON, a2: TUE, b1: MON, gone: MON };
    expect(doneOnDay(log, state, 'c1', MON)).toBe(1);
    expect(doneByDay(log, state)).toEqual({ [MON]: { c1: 1, c2: 1 }, [TUE]: { c1: 1 } });
  });

  it('drops plans and records of deleted work at startup', () => {
    const state = story();
    const data: PlannerData = {
      ...EMPTY_PLANNER,
      plans: { c1: plan(), gone: plan({ chapterId: 'gone' }) },
      planned: { [MON]: { c1: 2, gone: 1 }, [addDays(MON, -PLANNED_KEEP_DAYS - 1)]: { c1: 2 } },
      doneLog: { a1: MON },
    };
    const pruned = prunePlanner(data, state, MON);
    expect(Object.keys(pruned.plans)).toEqual(['c1']);
    expect(pruned.planned).toEqual({ [MON]: { c1: 2 } });
    expect(pruned.doneLog).toEqual({});
    expect(prunePlanner(pruned, state, MON)).toBe(pruned);
  });

  it('hides plans of a story in the trash and sorts by deadline', () => {
    const state = story();
    const data: PlannerData = { ...EMPTY_PLANNER, plans: { c1: plan({ deadline: NEXT_MON }), c2: plan({ chapterId: 'c2' }) } };
    expect(planViews(data, state, MON).map(item => item.plan.chapterId)).toEqual(['c2', 'c1']);
    state.projects.p1.deletedAt = 1;
    expect(chapterIsLive(state, 'c1')).toBe(false);
    expect(planViews(data, state, MON)).toEqual([]);
  });

  it('notes the planned pages of the day once', () => {
    const state = story();
    const data: PlannerData = { ...EMPTY_PLANNER, plans: { c1: plan({ target: 4 }) } };
    const noted = recordPlanned(data, planViews(data, state, MON), MON);
    expect(noted.planned).toEqual({ [MON]: { c1: 1 } });
    expect(recordPlanned(noted, planViews(noted, state, MON), MON)).toBe(noted);
  });

  it('reads back what it saved and survives bad data', () => {
    const data: PlannerData = { plans: { c1: plan() }, doneLog: { a1: MON, a2: '' }, planned: { [MON]: { c1: 2 } }, summarySeen: MON };
    expect(parsePlanner(serializePlanner(data))).toEqual(data);
    expect(parsePlanner('not json')).toEqual(EMPTY_PLANNER);
    expect(parsePlanner(null)).toEqual(EMPTY_PLANNER);
    expect(parsePlanner('{"plans":[1],"doneLog":{"a":"x"},"planned":{"bad":{}},"summarySeen":3}')).toEqual(EMPTY_PLANNER);
  });
});

describe('calendar and week', () => {
  const activity: Activity = { days: { [MON]: 40, [TUE]: 12 }, total: 52 };

  function setup(today: string) {
    const state = story();
    state.pages.a1.done = true;
    state.pages.a2.done = true;
    const data: PlannerData = {
      ...EMPTY_PLANNER,
      plans: { c1: plan({ target: 4, deadline: FRI }) },
      doneLog: { a1: MON, a2: TUE },
      planned: { [MON]: { c1: 1 }, [TUE]: { c1: 1 } },
    };
    return { state, data, context: plannerContext(data, state, activity, today) };
  }

  it('shows past days from the record and coming days from the plan', () => {
    const { context } = setup(WED);
    const monday = dayInfo(context, MON);
    expect(monday).toMatchObject({ planned: 1, done: 1, strokes: 40 });
    expect(dayEntryText(monday.entries[0], MON, WED)).toBe('1 of 1 page done');
    // Two pages left over Wednesday to Friday: one each on Wednesday and Thursday.
    const thursday = dayInfo(context, '2026-11-19');
    expect(dayEntryText(thursday.entries[0], '2026-11-19', WED)).toBe('1 page planned');
    const friday = dayInfo(context, FRI);
    expect(friday).toMatchObject({ hasDeadline: true, overdue: false, planned: 0, strokes: 0 });
    expect(dayEntryText(friday.entries[0], FRI, WED)).toBe('');
    expect(dayInfo(context, SAT).entries).toEqual([]);
    expect(agenda(context, 7).map(info => info.day)).toEqual([WED, '2026-11-19', FRI]);
  });

  it('marks the deadline day of an overdue chapter', () => {
    const { context } = setup(NEXT_MON);
    expect(dayInfo(context, FRI)).toMatchObject({ hasDeadline: true, overdue: true });
  });

  it('sums a week: pages done against planned, days drawn and the closest deadlines', () => {
    const { context } = setup(WED);
    const week = weekSummary(context, MON);
    expect(week).toMatchObject({ start: MON, end: SUN, pagesDone: 2, strokes: 52, daysDrawn: 2, past: false });
    // Monday and Tuesday from the record, then Wednesday and Thursday from the plan.
    expect(week.pagesPlanned).toBe(4);
    expect(week.closest.map(item => item.plan.chapterId)).toEqual(['c1']);
    expect(weekSummary(context, NEXT_MON).past).toBe(false);
    expect(weekSummary(context, '2026-11-09').past).toBe(true);
  });

  it('picks a weekly line that fits the week', () => {
    const { context } = setup(WED);
    const beat = weekLine({ ...weekSummary(context, MON), pagesDone: 5 });
    expect(beat).toMatch(/5 pages|every promise/);
    const quiet = weekLine(weekSummary(plannerContext(EMPTY_PLANNER, story(), EMPTY_ACTIVITY, WED), MON));
    expect(quiet).toMatch(/quiet week|desk missed you/);
    expect(weekLine(weekSummary(context, MON))).toBe(weekLine(weekSummary(context, MON)));
  });

  it('names months', () => {
    expect(monthTitle({ year: 2026, month: 10 })).toBe('November 2026');
  });
});

describe('reminder text', () => {
  const state = story();
  const nameOf = (id: string) => (id === 'c1' ? 'Chapter 1' : 'The oven');

  it("names today's pages of one chapter", () => {
    const items = planViews({ ...EMPTY_PLANNER, plans: { c1: plan({ deadline: NEXT_MON }) } }, state, MON);
    expect(planReminderText(items, nameOf, MON, MON)).toBe('Today: 2 pages of Chapter 1.');
  });

  it('uses the plan of the next day when the reminder fires tomorrow', () => {
    const items = planViews({ ...EMPTY_PLANNER, plans: { c1: plan({ target: 3, deadline: NEXT_MON }) } }, state, FRI);
    // Friday takes 2, Monday 1; a reminder for Saturday has nothing to say.
    expect(planReminderText(items, nameOf, SAT, FRI)).toBeNull();
  });

  it('adds up several chapters', () => {
    const items = planViews(
      { ...EMPTY_PLANNER, plans: { c1: plan({ deadline: NEXT_MON }), c2: plan({ chapterId: 'c2', deadline: NEXT_MON }) } },
      state,
      MON,
    );
    expect(planReminderText(items, nameOf, MON, MON)).toBe('Today: 4 pages across 2 chapters.');
  });

  it('warns the day before a deadline, with the date written out', () => {
    const items = planViews({ ...EMPTY_PLANNER, plans: { c1: plan({ target: 4 }) } }, state, '2026-11-19');
    expect(planReminderText(items, nameOf, '2026-11-19', '2026-11-19')).toBe('Chapter 1 is due 20/11/2026. 4 pages to go.');
  });

  it('keeps the usual text with no plan, or when today is done', () => {
    expect(planReminderText([], nameOf, MON, MON)).toBeNull();
    const done = story();
    done.pages.a1.done = true;
    done.pages.a2.done = true;
    const items = planViews(
      { ...EMPTY_PLANNER, doneLog: { a1: MON, a2: MON }, plans: { c1: plan({ target: 4, deadline: NEXT_MON }) } },
      done,
      MON,
    );
    expect(items[0].todayLeft).toBe(0);
    expect(planReminderText(items, nameOf, MON, MON)).toBeNull();
  });
});
