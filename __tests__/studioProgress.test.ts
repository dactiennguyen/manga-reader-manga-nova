import type { Activity } from '../src/core/story/activity';
import type { Chapter, Character, Page, Project, Scene, StoryData } from '../src/core/model/types';
import { BADGES, badgeText, earnedBadges, newBadges } from '../src/core/studio/badges';
import { LEVELS, levelProgress, requirementText } from '../src/core/studio/journey';
import { issueOf } from '../src/core/studio/magazine';
import { EMPTY_METRICS, metricsOf, wordCount } from '../src/core/studio/metrics';
import { studioPoints } from '../src/core/studio/points';
import { progressPair } from '../src/core/studio/progress';
import { hashString, pick, rand } from '../src/core/studio/seed';
import { EMPTY_STUDIO, LEVEL_IDS, type Metrics } from '../src/core/studio/types';

const at = (day: string, hour = 12) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).getTime();

const project = (id: string, createdAt: number, more: Partial<Project> = {}): Project => ({
  id,
  title: id,
  genres: [],
  logline: '',
  format: 'manga',
  pageSize: 'B5',
  style: 'shounen',
  color: false,
  done: false,
  acts: [],
  createdAt,
  updatedAt: createdAt,
  ...more,
});

const chapter = (id: string, projectId: string, pageIds: string[], sceneIds: string[], createdAt: number): Chapter => ({
  id,
  projectId,
  title: id,
  summary: '',
  goal: '',
  characterIds: [],
  sceneIds,
  pageIds,
  createdAt,
  updatedAt: createdAt,
});

const page = (id: string, chapterId: string, panelIds: string[], done: boolean, updatedAt: number, more: Partial<Page> = {}): Page => ({
  id,
  chapterId,
  layout: null,
  panels: Object.fromEntries(panelIds.map(panelId => [panelId, { id: panelId, bleed: false, borderless: false, description: '', blockIds: [] }])),
  gutterH: 10,
  gutterV: 10,
  done,
  bubbles: [],
  effects: [],
  artRev: 0,
  updatedAt,
  ...more,
});

const character = (id: string, projectId: string, more: Partial<Character> = {}): Character => ({
  id,
  projectId,
  name: id,
  role: 'main',
  age: '',
  gender: '',
  traits: [],
  goal: '',
  weakness: '',
  voice: '',
  bio: '',
  notes: '',
  appearance: '',
  sheet: { expressions: {} },
  locked: false,
  createdAt: 0,
  updatedAt: 0,
  ...more,
});

const bubble = (id: string, type: 'speak' | 'sfx') => ({
  id,
  type,
  text: 'x',
  x: 0,
  y: 0,
  w: 10,
  h: 10,
  rotation: 0,
  tail: null,
  fontSize: 20,
  font: 'hand' as const,
  bold: false,
});

/** Two stories: a live one with two chapters, and a trashed one that must count for nothing. */
function built(): StoryData {
  const scene: Scene = {
    id: 's1',
    chapterId: 'c1',
    description: '',
    blocks: [
      { id: 'b1', type: 'action', text: 'Rain falls on the city' },
      { id: 'b2', type: 'dialogue', text: 'Where are you going', characterId: 'k1' },
    ],
  };
  return {
    projects: {
      p1: project('p1', at('2026-10-01')),
      gone: project('gone', at('2026-01-01'), { deletedAt: at('2026-11-01') }),
    },
    chapters: {
      c1: chapter('c1', 'p1', ['pg1', 'pg2'], ['s1'], at('2026-10-02')),
      c2: chapter('c2', 'p1', ['pg3'], [], at('2026-10-20')),
      cg: chapter('cg', 'gone', ['pgg'], [], at('2026-01-02')),
    },
    scenes: { s1: scene },
    characters: {
      k1: character('k1', 'p1', { appearance: 'tall', goal: 'win', traits: ['brave', 'loud'] }),
      k2: character('k2', 'p1'),
      kg: character('kg', 'gone', { appearance: 'a', goal: 'b', traits: ['c', 'd'] }),
    },
    relations: { r1: { id: 'r1', projectId: 'p1', a: 'k1', b: 'k2', label: 'rivals', note: '' } },
    world: {},
    pages: {
      pg1: page('pg1', 'c1', ['a1', 'a2'], true, at('2026-10-04'), {
        bubbles: [bubble('u1', 'speak'), bubble('u2', 'sfx')],
        effects: [{ id: 'e1', panelId: 'a1', type: 'speed', density: 1, angle: 0, cx: 0, cy: 0, opacity: 1 }],
      }),
      pg2: page('pg2', 'c1', ['a3'], true, at('2026-11-10')),
      pg3: page('pg3', 'c2', ['a4'], false, at('2026-11-05')),
      pgg: page('pgg', 'cg', ['ag'], true, at('2026-11-10')),
    },
  };
}

const ART = new Set(['a1', 'a2', 'a3', 'ag']);
const hasArt = (id: string) => ART.has(id);
const TODAY = '2026-11-11';
const activity: Activity = { days: { '2026-11-08': 5, '2026-11-09': 5, '2026-11-10': 5, '2026-11-01': 2 }, total: 900 };

const withMetrics = (patch: Partial<Metrics>): Metrics => ({ ...EMPTY_METRICS, ...patch });

describe('seed', () => {
  it('hashes and picks the same way every time', () => {
    expect(hashString('mori')).toBe(hashString('mori'));
    expect(hashString('mori')).not.toBe(hashString('hana'));
    expect(hashString('')).toBe(0x811c9dc5);
    const items = ['a', 'b', 'c', 'd'];
    expect(pick(items, 42)).toBe(pick(items, 42));
    const a = rand(7);
    const b = rand(7);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.every(n => n >= 0 && n < 1)).toBe(true);
    // Neighbouring seeds reach every item.
    expect(new Set(Array.from({ length: 40 }, (_, i) => pick(items, i))).size).toBe(4);
    expect(() => pick([], 1)).toThrow();
  });
});

describe('metrics', () => {
  const m = metricsOf(built(), activity, { ...EMPTY_STUDIO, promptDays: { '2026-11-10': 'x' }, giftsOpened: ['g'] }, TODAY, hasArt);

  it('counts only live stories', () => {
    expect(m).toMatchObject({
      projects: 1,
      projectsDone: 0,
      chapters: 2,
      chaptersWritten: 1,
      chaptersDone: 1,
      pages: 3,
      pagesDone: 2,
      panelsDrawn: 3,
      bubbles: 1,
      sfx: 1,
      effects: 1,
      characters: 2,
      charactersFull: 1,
      relations: 1,
      worldEntries: 0,
      dialogueLines: 1,
      scriptWords: 9,
    });
  });

  it('reads drawing and studio records', () => {
    expect(m).toMatchObject({ strokes: 900, streak: 3, bestStreak: 3, activeDays: 4, promptsDone: 1, giftsOpened: 1 });
  });

  it('counts words in scripts written without spaces', () => {
    expect(wordCount('I think we should go.')).toBe(5);
    expect(wordCount('  ')).toBe(0);
    expect(wordCount('안녕, 하나야! 늦었잖아.')).toBe(3);
    // About two letters to a Japanese word, one and a half to a Chinese one and five to a Thai one.
    expect(wordCount('今日はいい天気ですね。')).toBe(5);
    expect(wordCount('我们今天去学校吧。')).toBe(5);
    expect(wordCount('สวัสดีครับ ไปกันเถอะ')).toBe(4);
    expect(wordCount('Tokyo 東京')).toBe(2);
    expect(wordCount('!')).toBe(1);
  });

  it('starts at zero for a new person', () => {
    expect(Object.values(EMPTY_METRICS).every(value => value === 0)).toBe(true);
  });
});

describe('journey', () => {
  it('has six levels in order, the first with no requirement', () => {
    expect(LEVELS.map(level => level.id)).toEqual(LEVEL_IDS);
    expect(LEVELS.map(level => level.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(LEVELS[0].needs).toEqual([]);
    expect(LEVELS.slice(1).every(level => level.needs.length > 0)).toBe(true);
  });

  it('asks for more at every level', () => {
    const need = (index: number, metric: keyof Metrics) => LEVELS[index].needs.find(item => item.metric === metric)?.count ?? 0;
    for (let index = 2; index < LEVELS.length; index++) {
      expect(need(index, 'pagesDone')).toBeGreaterThan(need(index - 1, 'pagesDone'));
    }
    expect(need(5, 'chaptersDone')).toBe(3);
    expect(need(5, 'pagesDone')).toBe(60);
    expect(need(5, 'bestStreak')).toBe(30);
  });

  it('starts as a rookie with progress toward assistant', () => {
    const start = levelProgress(EMPTY_METRICS);
    expect(start.level.id).toBe('rookie');
    expect(start.next?.id).toBe('assistant');
    expect(start.progress).toBe(0);
    const half = levelProgress(withMetrics({ projects: 1, pagesDone: 1 }));
    expect(half.level.id).toBe('rookie');
    expect(half.progress).toBeCloseTo(2 / 3);
    expect(half.steps.map(step => step.have)).toEqual([1, 1, 0]);
  });

  it('reaches assistant at its thresholds, and not a level whose earlier one is missing', () => {
    expect(levelProgress(withMetrics({ projects: 1, pagesDone: 1, bestStreak: 3 })).level.id).toBe('assistant');
    // Plenty of pages, but no story: the climb stops at the first missing level.
    expect(levelProgress(withMetrics({ pagesDone: 100, chaptersDone: 5, bestStreak: 40, activeDays: 90 })).level.id).toBe('rookie');
  });

  it('tops out at anime with full progress', () => {
    const all = withMetrics({ projects: 2, pagesDone: 60, chaptersDone: 3, bestStreak: 30, activeDays: 60, charactersFull: 1, worldEntries: 3, bubbles: 150 });
    const top = levelProgress(all);
    expect(top.level.id).toBe('anime');
    expect(top.next).toBeNull();
    expect(top.progress).toBe(1);
    expect(levelProgress({ ...all, pagesDone: 59 }).level.id).toBe('cover');
  });

  it('writes a requirement with its number', () => {
    expect(requirementText({ metric: 'pagesDone', count: 8, label: 'Finish {count} pages' })).toBe('Finish 8 pages');
  });
});

describe('badges', () => {
  it('has about thirty, each id once, every tier and a text for each', () => {
    expect(BADGES.length).toBeGreaterThanOrEqual(28);
    expect(new Set(BADGES.map(item => item.id)).size).toBe(BADGES.length);
    expect(new Set(BADGES.map(item => item.tier))).toEqual(new Set(['bronze', 'silver', 'gold']));
    expect(BADGES.every(item => item.text && item.count > 0)).toBe(true);
    expect(BADGES.filter(item => item.count > 1).every(item => item.text.includes('{count}'))).toBe(true);
  });

  it('awards badges at their counts and announces only new ones', () => {
    expect(earnedBadges(EMPTY_METRICS)).toEqual([]);
    const m = withMetrics({ pagesDone: 1, strokes: 100 });
    expect(earnedBadges(m).map(item => item.id).sort()).toEqual(['first-ink', 'first-page']);
    expect(newBadges(m, ['first-ink']).map(item => item.id)).toEqual(['first-page']);
    expect(badgeText(BADGES.find(item => item.id === 'page-turner')!)).toBe('Finish 25 pages');
    expect(badgeText(BADGES.find(item => item.id === 'first-page')!)).toBe('Finish a page');
  });
});

describe('studio points', () => {
  it('is zero at the start and grows with finished work more than with busy work', () => {
    expect(studioPoints(EMPTY_METRICS)).toBe(0);
    expect(studioPoints(withMetrics({ pagesDone: 1 }))).toBeGreaterThan(studioPoints(withMetrics({ strokes: 300 })));
    expect(studioPoints(withMetrics({ pagesDone: 2 }))).toBeGreaterThan(studioPoints(withMetrics({ pagesDone: 1 })));
    expect(Number.isInteger(studioPoints(withMetrics({ strokes: 7, scriptWords: 3 })))).toBe(true);
  });
});

describe('magazine', () => {
  const state = built();

  it('numbers issues by release days since the first live story', () => {
    // The first story is from Thursday 2026-10-01; issues come out on Fridays by default.
    expect(issueOf(state, EMPTY_STUDIO, '2026-10-01', [], hasArt).number).toBe(1);
    expect(issueOf(state, EMPTY_STUDIO, '2026-10-02', [], hasArt).number).toBe(1);
    expect(issueOf(state, EMPTY_STUDIO, '2026-10-08', [], hasArt).number).toBe(1);
    expect(issueOf(state, EMPTY_STUDIO, '2026-10-09', [], hasArt).number).toBe(2);
    expect(issueOf(state, EMPTY_STUDIO, TODAY, [], hasArt).number).toBe(6);
    // It goes up on release day, the day the countdown reaches 0.
    expect(issueOf(state, EMPTY_STUDIO, '2026-11-12', [], hasArt)).toMatchObject({ number: 6, daysLeft: 1 });
    expect(issueOf(state, EMPTY_STUDIO, '2026-11-13', [], hasArt)).toMatchObject({ number: 7, daysLeft: 0 });
    // A release on the first story's weekday counts that first day.
    expect(issueOf(state, { issueWeekday: 4 }, '2026-10-01', [], hasArt).number).toBe(1);
    expect(issueOf(state, { issueWeekday: 4 }, '2026-10-07', [], hasArt).number).toBe(1);
    expect(issueOf(state, { issueWeekday: 4 }, '2026-10-08', [], hasArt).number).toBe(2);
    expect(issueOf(state, { issueWeekday: 3 }, TODAY, [], hasArt)).toMatchObject({ number: 6, daysLeft: 0 });
    expect(issueOf(state, { issueWeekday: 3 }, '2026-11-10', [], hasArt)).toMatchObject({ number: 5, daysLeft: 1 });
    const empty = { ...state, projects: {}, chapters: {}, pages: {} };
    expect(issueOf(empty, EMPTY_STUDIO, TODAY, [], hasArt)).toMatchObject({ number: 1, coverPageId: null, contents: [] });
  });

  it('leads with the latest finished drawn page, else any drawn page', () => {
    expect(issueOf(state, EMPTY_STUDIO, TODAY, [], hasArt).coverPageId).toBe('pg2');
    const pg2Open: StoryData = { ...state, pages: { ...state.pages, pg2: { ...state.pages.pg2, done: false } } };
    expect(issueOf(pg2Open, EMPTY_STUDIO, TODAY, [], hasArt).coverPageId).toBe('pg1');
    const allOpen: StoryData = { ...pg2Open, pages: { ...pg2Open.pages, pg1: { ...pg2Open.pages.pg1, done: false } } };
    expect(issueOf(allOpen, EMPTY_STUDIO, TODAY, [], hasArt).coverPageId).toBe('pg2');
    expect(issueOf(state, EMPTY_STUDIO, TODAY, [], () => false).coverPageId).toBeNull();
  });

  it('lists chapters worked on this week, best ranked first', () => {
    expect(issueOf(state, EMPTY_STUDIO, TODAY, [], hasArt).contents.map(item => item.chapterId)).toEqual(['c1', 'c2']);
    const rank = [
      { chapterId: 'c2', projectId: 'p1', average: 4.5, rank: 1 },
      { chapterId: 'c1', projectId: 'p1', average: 3.9, rank: 2 },
    ];
    expect(issueOf(state, EMPTY_STUDIO, TODAY, rank, hasArt).contents).toEqual([
      { chapterId: 'c2', projectId: 'p1' },
      { chapterId: 'c1', projectId: 'p1' },
    ]);
    // pg3 was touched on 11-05, which falls out of the week on 11-12.
    expect(issueOf(state, EMPTY_STUDIO, '2026-11-12', rank, hasArt).contents.map(item => item.chapterId)).toEqual(['c1']);
  });

  it('counts down to the issue weekday', () => {
    // 2026-11-11 is a Wednesday.
    expect(issueOf(state, { issueWeekday: 5 }, TODAY, [], hasArt)).toMatchObject({ nextDay: '2026-11-13', daysLeft: 2 });
    expect(issueOf(state, { issueWeekday: 3 }, TODAY, [], hasArt)).toMatchObject({ nextDay: TODAY, daysLeft: 0 });
    expect(issueOf(state, { issueWeekday: 2 }, TODAY, [], hasArt)).toMatchObject({ nextDay: '2026-11-17', daysLeft: 6 });
  });
});

describe('progress', () => {
  it('pairs the first drawn page with the latest one', () => {
    const pair = progressPair(built(), hasArt, TODAY);
    expect(pair.firstPageId).toBe('pg1');
    expect(pair.latestPageId).toBe('pg2');
    expect(pair.daysBetween).toBe(39);
  });

  it('finds a page from a week or a month ago today', () => {
    const state = built();
    expect(progressPair(state, hasArt, '2026-11-17').memory).toEqual({ pageId: 'pg2', daysAgo: 7 });
    // pg1 was last touched on 10-04: a month before 11-03, give or take a day.
    expect(progressPair(state, hasArt, '2026-11-04').memory).toEqual({ pageId: 'pg1', daysAgo: 31 });
    expect(progressPair(state, hasArt, TODAY).memory).toBeNull();
  });

  it('has nothing to show before anything is drawn', () => {
    expect(progressPair(built(), () => false, TODAY)).toEqual({ firstPageId: null, latestPageId: null, daysBetween: 0, memory: null });
  });
});
