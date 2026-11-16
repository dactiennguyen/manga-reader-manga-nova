import { EMPTY_ACTIVITY, type Activity } from '../src/core/story/activity';
import { topCharacters } from '../src/core/stats/characters';
import { formatNumber } from '../src/core/stats/format';
import { beforeRecording, isStatMetric, metricAmount, metricTotal, statsRecords, storyTotals, type StatsSource } from '../src/core/stats/overview';
import {
  activeDaysIn,
  bestDayOf,
  bucketsOf,
  daysDrawnSeries,
  firstDayOf,
  longestRunIn,
  periodDays,
  periodOf,
  totalIn,
  WEEK_START,
} from '../src/core/stats/period';
import {
  EMPTY_PROGRESS,
  addGains,
  parseProgress,
  progressSeries,
  progressSnapshot,
  progressStep,
  startProgress,
} from '../src/core/stats/progress';
import {
  HEAT_MIN_DAYS,
  HEAT_MIN_SESSIONS,
  MAX_SESSIONS,
  SESSION_GAP_MS,
  heatLevel,
  heatPeak,
  heatmapOf,
  heatmapReady,
  noteSessionStrokes,
  parseSessions,
  pruneSessions,
  type DrawSession,
} from '../src/core/stats/sessions';
import { STATS_LINES, noteSituation, statsNote } from '../src/core/stats/voice';
import { DAY_MS, dayKey } from '../src/core/util/time';
import { connectStats, flushStats, noteSessionStrokesNow, useStats } from '../src/state/useStats';
import { addChapter, addCharacter, addPage, addProject, addScene, emptyStory } from './helpers/studioStory';
import { useTimeZone } from './helpers/timeZone';

const at = (day: string, hour: number, minute = 0) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour, minute).getTime();
};

const activity = (days: Record<string, number>): Activity => ({ days, total: Object.values(days).reduce((a, b) => a + b, 0) });

describe('periods', () => {
  it('starts the week on Monday, and can start it on Sunday', () => {
    // 2026-11-15 is a Sunday.
    expect(periodOf('week', '2026-11-15', 0, 1)).toEqual({ kind: 'week', start: '2026-11-09', end: '2026-11-15' });
    expect(periodOf('week', '2026-11-15', 0, 0)).toEqual({ kind: 'week', start: '2026-11-15', end: '2026-11-21' });
    expect(periodOf('week', '2026-11-15', -1, 1).start).toBe('2026-11-02');
    expect(WEEK_START).toBe(1);
  });

  it('steps months and years across the year boundary', () => {
    expect(periodOf('month', '2026-01-20', -1)).toEqual({ kind: 'month', start: '2025-12-01', end: '2025-12-31' });
    expect(periodOf('month', '2028-02-10')).toEqual({ kind: 'month', start: '2028-02-01', end: '2028-02-29' });
    expect(periodOf('year', '2026-06-01', -1)).toEqual({ kind: 'year', start: '2025-01-01', end: '2025-12-31' });
  });

  it('runs everything from the first day with data to today', () => {
    expect(periodOf('all', '2026-11-15', 0, 1, '2026-02-03')).toEqual({ kind: 'all', start: '2026-02-03', end: '2026-11-15' });
    expect(periodOf('all', '2026-11-15')).toEqual({ kind: 'all', start: '2026-11-15', end: '2026-11-15' });
  });

  it('adds up days, drawn days and runs inside the period only', () => {
    const series = { '2026-11-08': 5, '2026-11-09': 3, '2026-11-10': 2, '2026-11-12': 7 };
    const week = periodOf('week', '2026-11-15', 0, 1);
    expect(totalIn(series, week)).toBe(12);
    expect(activeDaysIn(series, week)).toBe(3);
    // 11-08 is in the week before, so the run inside this week is two days.
    expect(longestRunIn(series, week)).toBe(2);
    expect(daysDrawnSeries({ a: 4, b: 0 })).toEqual({ a: 1 });
  });

  it('groups a year into months and everything into months from its first day', () => {
    const series = { '2026-01-31': 1, '2026-02-01': 2, '2026-12-31': 4 };
    const year = bucketsOf(periodOf('year', '2026-06-01'), series);
    expect(year).toHaveLength(12);
    expect(year.map(bucket => bucket.value)).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4]);
    const all = bucketsOf(periodOf('all', '2026-03-10', 0, 1, '2026-01-15'), series);
    expect(all.map(bucket => [bucket.start, bucket.end])).toEqual([
      ['2026-01-15', '2026-01-31'],
      ['2026-02-01', '2026-02-28'],
      ['2026-03-01', '2026-03-10'],
    ]);
    expect(bucketsOf(periodOf('month', '2026-11-15'), series)).toHaveLength(30);
  });

  it('handles no data at all', () => {
    const week = periodOf('week', '2026-11-15', 0, 1);
    expect(bucketsOf(week, {}).every(bucket => bucket.value === 0)).toBe(true);
    expect(totalIn({}, week)).toBe(0);
    expect(longestRunIn({}, week)).toBe(0);
    expect(bestDayOf({})).toBeNull();
    expect(firstDayOf({}, {})).toBeUndefined();
  });

  it('finds the best day, the earliest on a tie', () => {
    expect(bestDayOf({ '2026-11-03': 9, '2026-11-01': 9, '2026-11-02': 1 })).toEqual({ day: '2026-11-01', value: 9 });
    expect(firstDayOf({ '2026-11-03': 1 }, { '2026-10-30': 2, '2026-10-01': 0 })).toBe('2026-10-30');
  });
});

describe('periods across daylight saving (Berlin)', () => {
  useTimeZone('Europe/Berlin');

  it('keeps seven distinct days in the week the clocks go forward and back', () => {
    // Clocks go forward on Sunday 2026-03-29 and back on Sunday 2026-10-25.
    for (const today of ['2026-03-29', '2026-03-30', '2026-10-25', '2026-10-26']) {
      const days = periodDays(periodOf('week', today, 0, 1));
      expect(new Set(days).size).toBe(7);
      expect(days).toContain(today);
    }
    expect(periodDays(periodOf('month', '2026-03-15'))).toHaveLength(31);
    expect(periodDays(periodOf('month', '2026-10-15'))).toHaveLength(31);
    expect(periodDays(periodOf('year', '2026-10-15'))).toHaveLength(365);
  });

  it('shares a session across the slots it spans, by local hour', () => {
    // 20:30 to 21:30 on a Wednesday: half before 21:00, half after.
    const cells = heatmapOf([{ start: at('2026-11-11', 20, 30), end: at('2026-11-11', 21, 30), strokes: 10 }]);
    expect(cells[3][6]).toBeCloseTo(5);
    expect(cells[3][7]).toBeCloseTo(5);
    // 01:00 to 04:00 on the night the clocks go forward is two real hours: 01:00-02:00 and 03:00-04:00.
    const spring = heatmapOf([{ start: at('2026-03-29', 1), end: at('2026-03-29', 4), strokes: 6 }]);
    expect(spring[0][0]).toBeCloseTo(3);
    expect(spring[0][1]).toBeCloseTo(3);
  });

  it('puts a session that runs past midnight on both days', () => {
    const cells = heatmapOf([{ start: at('2026-11-14', 23), end: at('2026-11-15', 1), strokes: 4 }]);
    expect(cells[6][7]).toBeCloseTo(2);
    expect(cells[0][0]).toBeCloseTo(2);
  });
});

describe('periods where midnight is skipped (Santiago)', () => {
  useTimeZone('America/Santiago');

  it('still finds every day of the month and the week', () => {
    // Chile moves clocks from 00:00 to 01:00 on Sunday 2026-09-06.
    expect(periodDays(periodOf('month', '2026-09-20'))).toHaveLength(30);
    const week = periodDays(periodOf('week', '2026-09-06', 0, 0));
    expect(week[0]).toBe('2026-09-06');
    expect(new Set(week).size).toBe(7);
    expect(periodOf('month', '2026-09-06').start).toBe('2026-09-01');
  });
});

describe('progress log', () => {
  function story() {
    const state = emptyStory();
    addProject(state, 'p1', 'One');
    addChapter(state, 'p1', 'c1');
    addScene(state, 'c1', 's1', [{ type: 'action', text: 'She runs' }]);
    addPage(state, 'c1', 'pg1');
    return state;
  }

  it('takes the first look as the baseline and counts what grows after', () => {
    const state = story();
    const first = progressSnapshot(state);
    addPage(state, 'c1', 'pg2');
    state.scenes.s1 = { ...state.scenes.s1, blocks: [...state.scenes.s1.blocks, { id: 'b2', type: 'dialogue', text: 'Wait for me' }] };
    state.pages.pg2 = { ...state.pages.pg2, bubbles: [{ id: 'bb', type: 'speak', text: 'Hi', x: 0, y: 0, w: 1, h: 1, rotation: 0, tail: null, fontSize: 12, font: 'hand', bold: false }] };
    const { gains } = progressStep(first, state);
    expect(gains).toEqual({ pages: 1, panels: 1, words: 3, bubbles: 1 });
  });

  it('does not count a story it sees for the first time', () => {
    const state = story();
    const first = progressSnapshot(state);
    addProject(state, 'p2', 'Imported');
    addChapter(state, 'p2', 'c2');
    addPage(state, 'c2', 'x1', { done: true });
    addPage(state, 'c2', 'x2', { done: true });
    const step = progressStep(first, state);
    expect(step.gains).toEqual({});
    // Once seen, it counts like any other.
    addPage(state, 'c2', 'x3');
    expect(progressStep(step.snapshot, state).gains).toEqual({ pages: 1, panels: 1 });
  });

  it('counts a finished page and chapter once, and ignores the trash', () => {
    const state = story();
    let snapshot = progressSnapshot(state);
    state.pages.pg1 = { ...state.pages.pg1, done: true };
    let step = progressStep(snapshot, state);
    expect(step.gains).toEqual({ pagesDone: 1, chapters: 1 });
    snapshot = step.snapshot;
    state.pages.pg1 = { ...state.pages.pg1, done: false };
    snapshot = progressStep(snapshot, state).snapshot;
    state.pages.pg1 = { ...state.pages.pg1, done: true };
    step = progressStep(snapshot, state);
    expect(step.gains).toEqual({});
    state.projects.p1 = { ...state.projects.p1, deletedAt: 1 };
    snapshot = progressStep(step.snapshot, state).snapshot;
    state.projects.p1 = { ...state.projects.p1, deletedAt: undefined };
    expect(progressStep(snapshot, state).gains).toEqual({});
  });

  it('lowers the baseline when something is removed and counts it again when re-added', () => {
    const state = story();
    addPage(state, 'c1', 'pg2');
    let snapshot = progressSnapshot(state);
    delete state.pages.pg2;
    state.chapters.c1 = { ...state.chapters.c1, pageIds: ['pg1'] };
    const step = progressStep(snapshot, state);
    expect(step.gains).toEqual({});
    snapshot = step.snapshot;
    addPage(state, 'c1', 'pg3');
    expect(progressStep(snapshot, state).gains).toEqual({ pages: 1, panels: 1 });
  });

  it('adds gains per day, keeps the first day and drops old days', () => {
    let log = startProgress(EMPTY_PROGRESS, '2026-11-01');
    expect(startProgress(log, '2026-11-09').since).toBe('2026-11-01');
    log = addGains(log, '2025-01-01', { pages: 2 });
    log = addGains(log, '2026-11-10', { pages: 1, words: 20 });
    log = addGains(log, '2026-11-10', { pages: 2 });
    expect(addGains(log, '2026-11-10', {})).toBe(log);
    expect(log.days['2026-11-10']).toEqual({ pages: 3, words: 20 });
    expect(log.days['2025-01-01']).toBeUndefined();
    expect(progressSeries(log, 'pages')).toEqual({ '2026-11-10': 3 });
  });

  it('reads a saved log and drops anything broken', () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress('{oops')).toEqual(EMPTY_PROGRESS);
    expect(
      parseProgress(JSON.stringify({ since: '2026-11-01', days: { '2026-11-02': { pages: 2.7, words: -1, nope: 4 }, bad: { pages: 1 }, '2026-11-03': {} } })),
    ).toEqual({ since: '2026-11-01', days: { '2026-11-02': { pages: 2 } } });
    expect(parseProgress(JSON.stringify({ since: 'yesterday', days: [] })).since).toBeNull();
  });
});

describe('drawing sessions', () => {
  const NOW = at('2026-11-15', 20);

  it('grows the last session while the pen comes back soon, and starts a new one after a gap', () => {
    let sessions = noteSessionStrokes([], NOW, 3);
    sessions = noteSessionStrokes(sessions, NOW + 60_000, 2);
    expect(sessions).toEqual([{ start: NOW, end: NOW + 60_000, strokes: 5 }]);
    sessions = noteSessionStrokes(sessions, NOW + 60_000 + SESSION_GAP_MS + 1, 1);
    expect(sessions).toHaveLength(2);
    expect(noteSessionStrokes(sessions, NOW, 0)).toBe(sessions);
  });

  it('starts a new session when the clock moved back', () => {
    const sessions = noteSessionStrokes([{ start: NOW, end: NOW, strokes: 1 }], NOW - 1000, 1);
    expect(sessions).toHaveLength(2);
  });

  it('drops sessions older than a year and keeps the newest under the cap', () => {
    const old: DrawSession = { start: NOW - 400 * DAY_MS, end: NOW - 400 * DAY_MS, strokes: 1 };
    const recent: DrawSession = { start: NOW - DAY_MS, end: NOW - DAY_MS, strokes: 1 };
    expect(pruneSessions([old, recent], NOW)).toEqual([recent]);
    const many = Array.from({ length: MAX_SESSIONS + 5 }, (_, index) => ({ start: NOW + index, end: NOW + index, strokes: 1 }));
    const kept = pruneSessions(many, NOW);
    expect(kept).toHaveLength(MAX_SESSIONS);
    expect(kept[0].start).toBe(NOW + 5);
  });

  it('waits for enough sessions on enough days before showing the map', () => {
    const one = (day: string, hour: number): DrawSession => ({ start: at(day, hour), end: at(day, hour, 30), strokes: 10 });
    const sameDay = Array.from({ length: HEAT_MIN_SESSIONS }, (_, index) => one('2026-11-10', index + 8));
    expect(heatmapReady(sameDay)).toBe(false);
    const spread = [...sameDay.slice(0, HEAT_MIN_SESSIONS - HEAT_MIN_DAYS + 1), one('2026-11-11', 9), one('2026-11-12', 9)];
    expect(spread.length).toBeGreaterThanOrEqual(HEAT_MIN_SESSIONS);
    expect(heatmapReady(spread)).toBe(true);
    expect(heatmapReady([])).toBe(false);
  });

  it('finds the busiest cell and grades cells against it', () => {
    const cells = heatmapOf([
      { start: at('2026-11-15', 21, 0), end: at('2026-11-15', 21, 0), strokes: 8 },
      { start: at('2026-11-10', 9, 0), end: at('2026-11-10', 9, 0), strokes: 2 },
    ]);
    expect(heatPeak(cells)).toEqual({ weekday: 0, slot: 7, value: 8 });
    expect(heatPeak(heatmapOf([]))).toBeNull();
    expect(heatLevel(0, 8)).toBe(0);
    expect(heatLevel(2, 8)).toBe(1);
    expect(heatLevel(8, 8)).toBe(4);
    expect(heatLevel(3, 0)).toBe(0);
  });

  it('reads saved sessions and drops broken ones', () => {
    expect(parseSessions(null)).toEqual([]);
    expect(parseSessions('{}')).toEqual([]);
    expect(
      parseSessions(
        JSON.stringify([
          { start: 5, end: 9, strokes: 2.5 },
          { start: 1, end: 2, strokes: 1 },
          { start: 9, end: 1, strokes: 1 },
          { start: 1, end: 2, strokes: 0 },
          null,
        ]),
      ),
    ).toEqual([
      { start: 1, end: 2, strokes: 1 },
      { start: 5, end: 9, strokes: 2 },
    ]);
  });
});

describe('overview', () => {
  function source(patch: Partial<StatsSource> = {}): StatsSource {
    return {
      activity: EMPTY_ACTIVITY,
      progress: EMPTY_PROGRESS,
      totals: { pages: 0, panels: 0, pagesDone: 0, words: 0, bubbles: 0, chapters: 0 },
      ...patch,
    };
  }

  it('uses the running stroke total and the stories for everything', () => {
    const src = source({
      activity: { days: { '2026-11-10': 5 }, total: 900 },
      progress: { since: '2026-11-01', days: { '2026-11-10': { pagesDone: 2 } } },
      totals: { pages: 40, panels: 120, pagesDone: 30, words: 5000, bubbles: 80, chapters: 3 },
    });
    const all = periodOf('all', '2026-11-15', 0, 1, '2026-11-10');
    expect(metricTotal(src, 'strokes', all)).toBe(900);
    expect(metricTotal(src, 'pagesDone', all)).toBe(30);
    const week = periodOf('week', '2026-11-15', 0, 1);
    expect(metricTotal(src, 'strokes', week)).toBe(5);
    expect(metricTotal(src, 'pagesDone', week)).toBe(2);
  });

  it('says when a period starts before the log did', () => {
    const src = source({ progress: { since: '2026-11-12', days: {} } });
    expect(beforeRecording(src, 'pages', periodOf('week', '2026-11-15', 0, 1))).toBe(true);
    expect(beforeRecording(src, 'pages', periodOf('week', '2026-11-22', 0, 1))).toBe(false);
    expect(beforeRecording(src, 'strokes', periodOf('week', '2026-11-15', 0, 1))).toBe(false);
  });

  it('keeps records: streaks and best days', () => {
    const src = source({
      activity: activity({ '2026-11-01': 40, '2026-11-02': 10, '2026-11-03': 5, '2026-11-14': 3, '2026-11-15': 2 }),
      progress: { since: '2026-11-01', days: { '2026-11-02': { pagesDone: 3, words: 100 }, '2026-11-03': { pagesDone: 1, words: 400 } } },
    });
    const records = statsRecords(src, '2026-11-15');
    expect(records.streak).toBe(2);
    expect(records.bestStreak).toBe(3);
    expect(records.bestDay).toEqual({ day: '2026-11-01', value: 40 });
    expect(records.bestPagesDay).toEqual({ day: '2026-11-02', value: 3 });
    expect(records.bestWordsDay).toEqual({ day: '2026-11-03', value: 400 });
    expect(statsRecords(source(), '2026-11-15')).toEqual({ streak: 0, bestStreak: 0, bestDay: null, bestPagesDay: null, bestWordsDay: null });
  });

  it('totals live stories only', () => {
    const state = emptyStory();
    addProject(state, 'p1', 'Live');
    addChapter(state, 'p1', 'c1');
    addPage(state, 'c1', 'a', { done: true });
    addProject(state, 'p2', 'Trashed', { deletedAt: 1 });
    addChapter(state, 'p2', 'c2');
    addPage(state, 'c2', 'b');
    expect(storyTotals(state)).toEqual({ pages: 1, panels: 1, pagesDone: 1, words: 0, bubbles: 0, chapters: 1 });
  });

  it('names amounts with grouped numbers', () => {
    expect(metricAmount('strokes', 1)).toBe('1 stroke');
    expect(metricAmount('strokes', 1240)).toBe(`${formatNumber(1240)} strokes`);
    expect(formatNumber(1240)).toMatch(/^1\D?240$/);
    expect(metricAmount('days', 3)).toBe('3 days');
    expect(isStatMetric('pagesDone')).toBe(true);
    expect(isStatMetric('nope')).toBe(false);
  });
});

describe('who appears most', () => {
  it('counts script lines and bubbles tied to a character, in live stories', () => {
    const state = emptyStory();
    addProject(state, 'p1', 'One');
    addCharacter(state, 'p1', 'aki');
    addCharacter(state, 'p1', 'ren');
    addChapter(state, 'p1', 'c1');
    addScene(state, 'c1', 's1', [
      { type: 'dialogue', text: 'Hi', characterId: 'aki' },
      { type: 'dialogue', text: '   ', characterId: 'ren' },
      { type: 'dialogue', text: 'Yo', characterId: 'ren' },
      { type: 'dialogue', text: 'Again', characterId: 'aki' },
    ]);
    const bubble = { type: 'speak' as const, text: 'Hi', x: 0, y: 0, w: 1, h: 1, rotation: 0, tail: null, fontSize: 12, font: 'hand' as const, bold: false };
    addPage(state, 'c1', 'pg1', { bubbles: [{ ...bubble, id: 'b1', characterId: 'ren' }, { ...bubble, id: 'b2', characterId: 'ghost' }] });
    addProject(state, 'p2', 'Trashed', { deletedAt: 1 });
    addCharacter(state, 'p2', 'gone');
    addChapter(state, 'p2', 'c2');
    addScene(state, 'c2', 's2', [{ type: 'dialogue', text: 'Lots', characterId: 'gone' }]);
    // A tie goes to the one with more bubbles on the page.
    expect(topCharacters(state)).toEqual([
      { characterId: 'ren', projectId: 'p1', lines: 1, bubbles: 1, total: 2 },
      { characterId: 'aki', projectId: 'p1', lines: 2, bubbles: 0, total: 2 },
    ]);
    expect(topCharacters(emptyStory())).toEqual([]);
  });
});

describe("Mori's line", () => {
  it('picks the situation from this period against the last', () => {
    expect(noteSituation(0, 5)).toBe('quiet');
    expect(noteSituation(0, 0, true)).toBe('collecting');
    expect(noteSituation(3, 0)).toBe('start');
    expect(noteSituation(5, 3)).toBe('up');
    expect(noteSituation(3, 5)).toBe('down');
    expect(noteSituation(4, 4)).toBe('steady');
  });

  it('fills in the amounts and stays the same all day', () => {
    const line = statsNote('up', '12 pages', '4 pages', 'pages', '2026-11-15');
    expect(line).toContain('12 pages');
    expect(line).toContain('4 pages');
    expect(statsNote('up', '12 pages', '4 pages', 'pages', '2026-11-15')).toBe(line);
    for (const lines of Object.values(STATS_LINES)) {
      expect(lines.length).toBeGreaterThan(0);
    }
  });
});

describe('recording from the app', () => {
  function memoryMeta() {
    const store = new Map<string, string>();
    return {
      store,
      get: (key: string) => store.get(key) ?? null,
      set: (key: string, value: string) => {
        store.set(key, value);
      },
      remove: (key: string) => {
        store.delete(key);
      },
    };
  }

  function storySource(initial: ReturnType<typeof emptyStory>) {
    let state = initial;
    const listeners = new Set<(next: typeof state) => void>();
    return {
      getState: () => state,
      subscribe: (listener: (next: typeof state) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      set(next: typeof state) {
        state = next;
        listeners.forEach(listener => listener(state));
      },
    };
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    connectStats(null, null);
    jest.useRealTimers();
  });

  it('counts what was added after start, saves it, and starts the log today', () => {
    const meta = memoryMeta();
    const state = emptyStory();
    addProject(state, 'p1', 'One');
    addChapter(state, 'p1', 'c1');
    addPage(state, 'c1', 'pg1');
    const story = storySource(state);
    connectStats(meta, story);
    expect(useStats.getState().progress).toEqual({ since: dayKey(), days: {} });
    expect(JSON.parse(meta.store.get('statsProgress') ?? '{}').since).toBe(dayKey());

    const next = { ...state, pages: { ...state.pages }, chapters: { ...state.chapters } };
    addPage(next, 'c1', 'pg2');
    story.set(next);
    jest.advanceTimersByTime(2500);
    expect(useStats.getState().progress.days[dayKey()]).toEqual({ pages: 1, panels: 1 });
    flushStats();
    expect(JSON.parse(meta.store.get('statsProgress') ?? '{}').days[dayKey()]).toEqual({ pages: 1, panels: 1 });
  });

  it('records sessions from pen lifts and keeps them across a restart', () => {
    const meta = memoryMeta();
    connectStats(meta, storySource(emptyStory()));
    noteSessionStrokesNow(3);
    noteSessionStrokesNow(2);
    expect(useStats.getState().sessions).toHaveLength(1);
    expect(useStats.getState().sessions[0].strokes).toBe(5);
    flushStats();
    connectStats(meta, storySource(emptyStory()));
    expect(useStats.getState().sessions[0].strokes).toBe(5);
  });
});
