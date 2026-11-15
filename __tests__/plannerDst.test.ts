/**
 * Planner days across daylight saving changes. Jest gives each file a copy of process.env, so setting TZ
 * here would not reach the clock. The checks run in a child Jest per time zone, started with TZ set.
 */
import { addDays, dayRange } from '../src/core/planner/days';
import { makePlan, viewPlan } from '../src/core/planner/plan';
import { shiftDay } from '../src/core/story/activity';
import { dayKey } from '../src/core/util/time';

declare const require: (name: string) => {
  spawnSync: (command: string, args: string[], options: object) => { status: number | null; stdout: string; stderr: string };
};
declare const process: { env: Record<string, string | undefined>; execPath: string };
declare const __filename: string;
declare const __dirname: string;

const ZONES = ['America/New_York', 'Europe/Berlin', 'Australia/Sydney'];
const CHILD = process.env.PLANNER_DST_ZONE;

/** Late on the night of each 2026 clock change in the three zones, as [year, month from 0, day]. */
const CHANGES = [
  [2026, 2, 8],
  [2026, 10, 1],
  [2026, 2, 29],
  [2026, 9, 25],
  [2026, 3, 5],
  [2026, 9, 4],
];

(CHILD ? describe : describe.skip)(`planner days in ${CHILD ?? 'a zone'}`, () => {
  it('runs in a zone that changes its clocks', () => {
    const offsets = new Set(CHANGES.flatMap(([y, m, d]) => [new Date(y, m, d - 1).getTimezoneOffset(), new Date(y, m, d + 1).getTimezoneOffset()]));
    expect(offsets.size).toBeGreaterThan(1);
  });

  it('keeps local day keys and day steps right around each change', () => {
    for (const [y, m, d] of CHANGES) {
      const key = dayKey(new Date(y, m, d, 23, 30).getTime());
      expect(key).toBe(`${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
      expect(addDays(key, 1)).toBe(dayKey(new Date(y, m, d + 1, 0, 30).getTime()));
      expect(addDays(key, 1)).toBe(shiftDay(key, 1));
      expect(addDays(key, -1)).toBe(shiftDay(key, -1));
    }
  });

  it('splits a plan over a change by days, not hours', () => {
    for (const [y, m, d] of CHANGES) {
      const from = dayKey(new Date(y, m, d - 2, 12).getTime());
      const to = addDays(from, 4);
      expect(dayRange(from, to)).toHaveLength(5);
      const plan = makePlan({ chapterId: 'c1', target: 10, deadline: to, workdays: [0, 1, 2, 3, 4, 5, 6] }, 0, from);
      expect(viewPlan(plan, 0, 0, from).schedule.map(item => item.pages)).toEqual([2, 2, 2, 2, 2]);
      expect(viewPlan(plan, 4, 0, addDays(from, 2))).toMatchObject({ status: 'onTrack', todayPlanned: 2, daysLeft: 2 });
    }
  });
});

(CHILD ? describe.skip : describe)('planner days across daylight saving', () => {
  it.each(ZONES)('passes in %s', zone => {
    const { spawnSync } = require('child_process');
    const jest = `${__dirname}/../node_modules/jest/bin/jest.js`;
    const result = spawnSync(process.execPath, [jest, '--runTestsByPath', __filename, '--ci'], {
      cwd: `${__dirname}/..`,
      env: { ...process.env, TZ: zone, PLANNER_DST_ZONE: zone },
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      throw new Error(String(result.stderr));
    }
    expect(String(result.stderr)).toMatch(/Tests:.* 3 passed/);
  }, 60000);
});
