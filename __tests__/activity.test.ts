import {
  ACTIVITY_KEEP_DAYS,
  EMPTY_ACTIVITY,
  addStrokes,
  bestStreak,
  currentStreak,
  goalProgress,
  lastWeek,
  parseActivity,
  type Activity,
} from '../src/core/story/activity';

const days = (list: Record<string, number>): Activity => ({
  days: list,
  total: Object.values(list).reduce((a, b) => a + b, 0),
});

describe('drawing activity', () => {
  it('adds strokes to a day and to the total', () => {
    const one = addStrokes(EMPTY_ACTIVITY, '2026-11-10', 3);
    const two = addStrokes(one, '2026-11-10', 2);
    expect(two).toEqual({ days: { '2026-11-10': 5 }, total: 5 });
    expect(addStrokes(two, '2026-11-10', 0)).toBe(two);
    expect(EMPTY_ACTIVITY.days).toEqual({});
  });

  it('drops days older than the keep window but keeps the total', () => {
    const old = addStrokes(EMPTY_ACTIVITY, '2025-01-01', 10);
    const now = addStrokes(old, '2026-11-10', 1);
    expect(Object.keys(now.days)).toEqual(['2026-11-10']);
    expect(now.total).toBe(11);
    expect(ACTIVITY_KEEP_DAYS).toBeGreaterThan(365);
  });

  it('counts the streak up to today, or up to yesterday before today is drawn on', () => {
    const activity = days({ '2026-11-08': 4, '2026-11-09': 1, '2026-11-10': 9 });
    expect(currentStreak(activity, '2026-11-10')).toBe(3);
    expect(currentStreak(activity, '2026-11-11')).toBe(3);
    expect(currentStreak(activity, '2026-11-12')).toBe(0);
    expect(currentStreak(EMPTY_ACTIVITY, '2026-11-10')).toBe(0);
  });

  it('counts a streak across a month and a year boundary', () => {
    const activity = days({ '2025-12-30': 1, '2025-12-31': 1, '2026-01-01': 1, '2026-01-02': 1 });
    expect(currentStreak(activity, '2026-01-02')).toBe(4);
  });

  it('finds the longest run', () => {
    const activity = days({ '2026-10-01': 1, '2026-10-02': 1, '2026-10-03': 1, '2026-10-10': 1, '2026-10-11': 1 });
    expect(bestStreak(activity)).toBe(3);
    expect(bestStreak(EMPTY_ACTIVITY)).toBe(0);
  });

  it('lists the last seven days, oldest first', () => {
    const week = lastWeek(days({ '2026-11-10': 7, '2026-11-05': 2 }), '2026-11-10');
    expect(week.map(bar => bar.day)).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
    ]);
    expect(week.map(bar => bar.strokes)).toEqual([0, 2, 0, 0, 0, 0, 7]);
    expect(week[6].weekday).toBe(new Date(2026, 10, 10).getDay());
  });

  it('measures today against the goal', () => {
    const activity = days({ '2026-11-10': 50 });
    expect(goalProgress(activity, '2026-11-10', 100)).toBe(0.5);
    expect(goalProgress(activity, '2026-11-10', 20)).toBe(1);
    expect(goalProgress(activity, '2026-11-10', 0)).toBe(0);
    expect(goalProgress(activity, '2026-11-11', 100)).toBe(0);
  });

  it('reads stored activity and ignores anything broken', () => {
    expect(parseActivity('{"days":{"2026-11-10":4,"bad":3,"2026-11-09":-1},"total":40}')).toEqual({
      days: { '2026-11-10': 4 },
      total: 40,
    });
    expect(parseActivity('{"days":{"2026-11-10":4},"total":1}').total).toBe(4);
    expect(parseActivity('nope')).toEqual(EMPTY_ACTIVITY);
    expect(parseActivity(null)).toEqual(EMPTY_ACTIVITY);
  });
});
