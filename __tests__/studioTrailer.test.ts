import { TEMPLATES, buildTemplate, panelOrder } from '../src/core/layout/layout';
import type { Block, Page, Panel, Shot, StoryData } from '../src/core/model/types';
import {
  CAPTION_MAX,
  captionLength,
  KEN_BURNS_ZOOM,
  TRAILER_MAX_PANELS,
  containWindow,
  inkOf,
  isStillFrame,
  kenBurns,
  latestDrawnPage,
  lineScore,
  pickPanels,
  planTrailer,
  shotAt,
  trailerSeconds,
  visibilityAt,
  windowAt,
  type PanelPick,
  type PanelShot,
} from '../src/core/studio/trailer';

let next = 0;
const newId = () => `n${++next}`;

function page(id: string, templateId: string, extra: Partial<Page> = {}, shots: Shot[] = []): Page {
  const template = TEMPLATES.find(item => item.id === templateId)!;
  const built = buildTemplate(template, () => `${id}-${newId()}`);
  const panels: Record<string, Panel> = {};
  built.panelIds.forEach((panelId, index) => {
    panels[panelId] = { id: panelId, bleed: false, borderless: false, description: '', blockIds: [], shot: shots[index] };
  });
  return { id, chapterId: 'c1', layout: built.layout, panels, gutterH: 22, gutterV: 12, done: false, bubbles: [], effects: [], artRev: 0, updatedAt: 0, ...extra };
}

function story(pages: Page[], blocks: Block[] = []): StoryData {
  return {
    projects: {
      p: {
        id: 'p',
        title: '  Lantern Courier ',
        genres: [],
        logline: '',
        format: 'manga',
        pageSize: 'B5',
        style: 'shounen',
        color: false,
        done: false,
        acts: [{ id: 'a', title: '', chapterIds: ['c1'] }],
        createdAt: 0,
        updatedAt: 0,
      },
    },
    chapters: {
      c1: { id: 'c1', projectId: 'p', title: '', summary: '', goal: '', characterIds: [], sceneIds: ['s1'], pageIds: pages.map(item => item.id), createdAt: 0, updatedAt: 0 },
    },
    scenes: { s1: { id: 's1', chapterId: 'c1', description: '', blocks } },
    characters: {
      hero: { id: 'hero', projectId: 'p', name: 'Kai', role: 'main', age: '', gender: '', traits: [], goal: '', weakness: '', voice: '', bio: '', notes: '', appearance: '', sheet: { expressions: {} }, locked: false, createdAt: 0, updatedAt: 0 },
    },
    relations: {},
    world: {},
    pages: Object.fromEntries(pages.map(item => [item.id, item])),
  };
}

/** Reading order: a manga reads right to left. */
const panelIds = (item: Page) => panelOrder(item, true);

describe('picking panels', () => {
  const pick = (id: string, score: number, pageId: string, shot?: Shot): PanelPick => ({
    pageId,
    panelId: id,
    chapterId: 'c1',
    shot,
    strokes: 1,
    poly: [],
    bbox: { x: 0, y: 0, w: 1, h: 1 },
    order: Number(id.slice(1)),
    score,
  });

  it('prefers variety of shots and pages over a few more strokes, and keeps story order', () => {
    const picks = pickPanels(
      [pick('x1', 10, 'a', 'close'), pick('x2', 9.5, 'a', 'close'), pick('x3', 8, 'b', 'wide'), pick('x4', 7, 'c', 'close')],
      2,
    );
    expect(picks.map(item => item.panelId)).toEqual(['x1', 'x3']);
  });

  it('never takes more than the limit', () => {
    const many = Array.from({ length: 20 }, (_, index) => pick(`x${index}`, index, `p${index}`));
    expect(pickPanels(many)).toHaveLength(TRAILER_MAX_PANELS);
  });
});

describe('lines', () => {
  it('puts shouts and short punchy lines first and drops what cannot be read in time', () => {
    const shout = lineScore({ id: 'a', type: 'dialogue', text: 'Run!', kind: 'shout' })!;
    const plain = lineScore({ id: 'b', type: 'dialogue', text: 'I think we should probably go home now, it is getting late.' })!;
    expect(shout).toBeGreaterThan(plain);
    expect(lineScore({ id: 'c', type: 'dialogue', text: 'x'.repeat(CAPTION_MAX + 1) })).toBeNull();
    expect(lineScore({ id: 'd', type: 'action', text: 'He runs.' })).toBeNull();
    // Japanese, Chinese and Korean pack more into each letter.
    expect(lineScore({ id: 'e', type: 'dialogue', text: 'あ'.repeat(50) })).toBeNull();
    expect(lineScore({ id: 'f', type: 'dialogue', text: '我'.repeat(50) })).toBeNull();
    expect(lineScore({ id: 'g', type: 'dialogue', text: '하'.repeat(50) })).toBeNull();
    expect(captionLength('안녕, 하나야')).toBe(2 * 5 + 2);
    expect(captionLength('Hola, ¿qué?')).toBe(11);
  });
});

describe('the camera', () => {
  it('shows the whole panel at the stage aspect', () => {
    const wide = containWindow({ x: 0, y: 0, w: 400, h: 100 }, 0.8);
    expect(wide).toEqual({ x: 0, y: -200, w: 400, h: 500 });
    const tall = containWindow({ x: 0, y: 0, w: 100, h: 400 }, 0.8);
    expect(tall.h).toBe(400);
    expect(tall.w).toBeCloseTo(320);
  });

  it('pushes in and pulls out in turn, staying inside the wide view', () => {
    const box = { x: 100, y: 100, w: 300, h: 400 };
    const a = kenBurns(box, 0.8, 0);
    const b = kenBurns(box, 0.8, 1);
    expect(a.to.w).toBeCloseTo(a.from.w / KEN_BURNS_ZOOM);
    expect(b.from.w).toBeCloseTo(b.to.w / KEN_BURNS_ZOOM);
    expect(a.to.x).toBeGreaterThanOrEqual(a.from.x);
    expect(a.to.x + a.to.w).toBeLessThanOrEqual(a.from.x + a.from.w + 1e-9);
  });
});

describe('a trailer plan', () => {
  const pages = [
    page('pg1', 'g4-grid', { done: true }, ['wide', 'close', 'close', 'medium']),
    page('pg2', 'g3-rows', {}, ['close', 'extreme', 'low']),
    page('pg3', 'g2-rows'),
  ];
  // p1 is top right, p2 top left: the first two read on the page.
  const [p1, p2, p3, p4] = panelIds(pages[0]);
  const [q1] = panelIds(pages[1]);
  pages[0].panels[p2].blockIds = ['l1'];
  const blocks: Block[] = [
    { id: 'l1', type: 'dialogue', text: 'Not this time.', characterId: 'hero' },
    { id: 'l2', type: 'dialogue', text: 'GET DOWN!', characterId: 'hero', kind: 'shout' },
    { id: 'l3', type: 'dialogue', text: 'hm', characterId: 'hero', kind: 'think' },
  ];
  const strokes: Record<string, number> = { [p1]: 40, [p2]: 12, [p3]: 3, [p4]: 0, [q1]: 30 };
  const state = story(pages, blocks);
  const plan = planTrailer({ state, projectId: 'p', penName: ' Mika ', strokesOf: id => strokes[id] ?? 0 })!;

  it('opens on the title, shows only drawn panels in story order, and ends on the end card', () => {
    expect(plan.title).toBe('Lantern Courier');
    expect(plan.penName).toBe('Mika');
    const kinds = plan.shots.map(shot => shot.kind);
    expect(kinds[0]).toBe('title');
    expect(kinds[kinds.length - 1]).toBe('end');
    const panels = plan.shots.filter((shot): shot is PanelShot => shot.kind === 'panel').map(shot => shot.panelId);
    expect(panels).toEqual([p1, p2, p3, q1]);
  });

  it('captions a panel with its own line, then the best loose line', () => {
    const shots = plan.shots.filter((shot): shot is PanelShot => shot.kind === 'panel');
    const lines = shots.map(shot => shot.line);
    const lineOf = (panelId: string) => shots.find(shot => shot.panelId === panelId)?.line;
    expect(lineOf(p2)).toEqual({ text: 'Not this time.', speaker: 'Kai', shout: false });
    expect(lineOf(p1)).toEqual({ text: 'GET DOWN!', speaker: 'Kai', shout: true });
    // The weak thought is never used on its own.
    expect(lines.filter(Boolean).map(line => line!.text)).not.toContain('hm');
  });

  it('lasts between 10 and 18 seconds, vertical, with shots back to back', () => {
    expect(trailerSeconds(plan)).toBeGreaterThanOrEqual(10);
    expect(trailerSeconds(plan)).toBeLessThanOrEqual(18);
    expect(plan.size.h).toBeGreaterThan(plan.size.w);
    plan.shots.forEach((shot, index) => {
      if (index > 0) {
        const before = plan.shots[index - 1];
        expect(shot.start).toBe(before.start + before.frames);
      }
    });
    expect(plan.totalFrames).toBe(plan.shots.reduce((sum, shot) => sum + shot.frames, 0));
  });

  it('finds the shot and camera for any frame', () => {
    expect(shotAt(plan, 0).shot.kind).toBe('title');
    expect(shotAt(plan, plan.totalFrames + 50).shot.kind).toBe('end');
    const first = plan.shots[1] as PanelShot;
    const at = shotAt(plan, first.start);
    expect(at.index).toBe(1);
    expect(at.local).toBe(0);
    expect(windowAt(first, 0)).toEqual(first.from);
    expect(windowAt(first, first.frames - 1)).toEqual(first.to);
  });

  it('fades between shots but holds the last frame', () => {
    const title = plan.shots[0];
    expect(visibilityAt(title, 0, false)).toBeLessThan(1);
    expect(visibilityAt(title, Math.floor(title.frames / 2), false)).toBe(1);
    expect(visibilityAt(title, title.frames - 1, false)).toBeLessThan(1);
    const end = plan.shots[plan.shots.length - 1];
    expect(visibilityAt(end, end.frames - 1, true)).toBe(1);
    expect(isStillFrame(plan, Math.floor(title.frames / 2))).toBe(true);
    expect(isStillFrame(plan, first().start + 3)).toBe(false);
  });

  const first = () => plan.shots[1];

  it('is null when nothing is drawn', () => {
    expect(planTrailer({ state, projectId: 'p', penName: '', strokesOf: () => 0 })).toBeNull();
    expect(planTrailer({ state, projectId: 'missing', penName: '', strokesOf: () => 1 })).toBeNull();
  });

  it('finds the newest drawn page for the hero', () => {
    const later = story([{ ...pages[0], updatedAt: 5 }, { ...pages[1], updatedAt: 9 }, { ...pages[2], updatedAt: 20 }]);
    expect(latestDrawnPage(later, 'p', id => (strokes[id] ?? 0) > 0)).toBe('pg2');
    expect(latestDrawnPage(later, 'p', () => false)).toBeNull();
  });
});

describe('ink', () => {
  it('counts visible strokes, and an image as many', () => {
    expect(inkOf(null)).toBe(0);
    expect(
      inkOf({
        layers: [
          { visible: true, strokes: [1, 2] },
          { visible: false, strokes: [1, 2, 3] },
          { visible: true, strokes: [], image: {} },
        ],
      }),
    ).toBe(22);
  });
});
