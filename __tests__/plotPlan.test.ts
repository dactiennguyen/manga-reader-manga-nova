import {
  existingWork,
  isUntouchedChapter,
  planPlotApply,
  storyIsBlank,
  type PlanAct,
  type PlanChapter,
} from '../src/core/story/plotPlan';

function chapter(id: string, patch: Partial<PlanChapter> = {}): PlanChapter {
  return { id, title: 'Chapter 1', summary: '', goal: '', sceneCount: 0, pageCount: 0, ...patch };
}

const direction = [
  [
    { title: 'The spark', summary: 'A stranger arrives.' },
    { title: 'First clash', summary: 'The rival appears.' },
  ],
  [],
  [{ title: 'Showdown', summary: 'Everything is settled.' }],
];

describe('isUntouchedChapter', () => {
  it('accepts a default chapter with nothing in it', () => {
    expect(isUntouchedChapter(chapter('a'))).toBe(true);
    expect(isUntouchedChapter(chapter('a', { title: '' }))).toBe(true);
    expect(isUntouchedChapter(chapter('a', { title: 'chapter 12' }))).toBe(true);
  });

  it('rejects a chapter the author worked on', () => {
    expect(isUntouchedChapter(chapter('a', { title: 'Rain' }))).toBe(false);
    expect(isUntouchedChapter(chapter('a', { summary: 'Something happens' }))).toBe(false);
    expect(isUntouchedChapter(chapter('a', { goal: 'Make them cry' }))).toBe(false);
    expect(isUntouchedChapter(chapter('a', { sceneCount: 1 }))).toBe(false);
    expect(isUntouchedChapter(chapter('a', { pageCount: 2 }))).toBe(false);
  });
});

describe('storyIsBlank', () => {
  it('is true with no chapters or only untouched defaults', () => {
    expect(storyIsBlank([{ id: 'act1', chapters: [] }])).toBe(true);
    expect(
      storyIsBlank([
        { id: 'act1', chapters: [chapter('a')] },
        { id: 'act2', chapters: [] },
      ]),
    ).toBe(true);
  });

  it('is false as soon as one chapter has content', () => {
    expect(
      storyIsBlank([
        { id: 'act1', chapters: [chapter('a')] },
        { id: 'act2', chapters: [chapter('b', { summary: 'Twist' })] },
      ]),
    ).toBe(false);
  });
});

describe('existingWork', () => {
  it('counts chapters, scenes and pages', () => {
    expect(
      existingWork([
        { id: 'act1', chapters: [chapter('a', { sceneCount: 2, pageCount: 3 })] },
        { id: 'act2', chapters: [chapter('b', { sceneCount: 1 }), chapter('c')] },
      ]),
    ).toEqual({ chapters: 3, scenes: 3, pages: 3 });
  });
});

describe('planPlotApply', () => {
  const blank: PlanAct[] = [
    { id: 'act1', chapters: [chapter('default')] },
    { id: 'act2', chapters: [] },
    { id: 'act3', chapters: [] },
  ];
  const written: PlanAct[] = [
    { id: 'act1', chapters: [chapter('a', { title: 'Rain', summary: 'It rains.' }), chapter('b')] },
    { id: 'act2', chapters: [] },
    { id: 'act3', chapters: [chapter('c', { sceneCount: 2, pageCount: 4 })] },
  ];

  it('silently replaces untouched default chapters whatever the mode', () => {
    for (const mode of ['append', 'replace'] as const) {
      const plan = planPlotApply(blank, direction, mode);
      expect(plan.remove).toEqual(['default']);
      expect(plan.create).toEqual([
        { actId: 'act1', index: 0, title: 'The spark', summary: 'A stranger arrives.' },
        { actId: 'act1', index: 1, title: 'First clash', summary: 'The rival appears.' },
        { actId: 'act3', index: 0, title: 'Showdown', summary: 'Everything is settled.' },
      ]);
    }
  });

  it('appends after the existing chapters of each act and removes nothing', () => {
    const plan = planPlotApply(written, direction, 'append');
    expect(plan.remove).toEqual([]);
    expect(plan.create.map(item => [item.actId, item.index, item.title])).toEqual([
      ['act1', 2, 'The spark'],
      ['act1', 3, 'First clash'],
      ['act3', 1, 'Showdown'],
    ]);
  });

  it('removes every existing chapter when replacing', () => {
    const plan = planPlotApply(written, direction, 'replace');
    expect(plan.remove).toEqual(['a', 'b', 'c']);
    expect(plan.create.map(item => [item.actId, item.index])).toEqual([
      ['act1', 0],
      ['act1', 1],
      ['act3', 0],
    ]);
  });

  it('puts chapters of extra acts into the last act', () => {
    const plan = planPlotApply([{ id: 'only', chapters: [] }], direction, 'append');
    expect(plan.create.map(item => [item.actId, item.index, item.title])).toEqual([
      ['only', 0, 'The spark'],
      ['only', 1, 'First clash'],
      ['only', 2, 'Showdown'],
    ]);
  });

  it('skips empty proposals and never deletes when there is nothing to create', () => {
    expect(planPlotApply(written, [[{ title: ' ', summary: '' }], [], []], 'replace')).toEqual({
      remove: [],
      create: [],
    });
    expect(planPlotApply([], direction, 'replace')).toEqual({ remove: [], create: [] });
  });
});
