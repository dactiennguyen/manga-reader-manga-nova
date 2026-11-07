import { estimatePages, estimateScenePages, paginate } from '../src/core/model/paginate';
import type { Block, BlockType, Scene } from '../src/core/model/types';

let counter = 0;
const block = (type: BlockType, text: string): Block => ({ id: `b${counter++}`, type, text });
const scene = (blocks: Block[], description = ''): Scene => ({
  id: `s${counter++}`,
  chapterId: 'c',
  description,
  blocks,
});

describe('paginate', () => {
  it('each action block opens a panel and dialogue follows the panel before it', () => {
    const blocks = [
      block('setting', 'An alley, rainy afternoon'),
      block('action', 'Minh stops his bike'),
      block('dialogue', 'Not again…'),
      block('action', 'The box starts shaking'),
      block('sfx', 'BAM'),
    ];
    const pages = paginate([scene(blocks)]);
    expect(pages).toHaveLength(1);
    expect(pages[0].panels).toHaveLength(2);
    expect(pages[0].panels[0].description).toBe('Minh stops his bike (An alley, rainy afternoon)');
    expect(pages[0].panels[0].blockIds).toEqual([blocks[0].id, blocks[1].id, blocks[2].id]);
    expect(pages[0].panels[1].blockIds).toEqual([blocks[3].id, blocks[4].id]);
    expect(pages[0].panels[0].shot).toBe('wide');
  });

  it('never drops or repeats a block across pages', () => {
    const scenes = [0, 1, 2, 3].map(s =>
      scene([0, 1, 2, 3, 4, 5].map(i => block(i % 2 ? 'dialogue' : 'action', `scene ${s} block ${i}`))),
    );
    const expected = scenes.flatMap(sc => sc.blocks.map(b => b.id));
    for (const pages of [undefined, 1, 2, 5, 9, 40]) {
      const plan = paginate(scenes, { pages });
      const got = plan.flatMap(p => p.panels.flatMap(panel => panel.blockIds));
      expect(got).toEqual(expected);
      expect(plan.every(p => p.panels.length >= 1 && p.panels.length <= 7)).toBe(true);
    }
  });

  it('follows the requested page count when there are enough panels', () => {
    const scenes = [scene(Array.from({ length: 12 }, (_, i) => block('action', `action ${i}`)))];
    expect(paginate(scenes, { pages: 2 })).toHaveLength(2);
    expect(paginate(scenes, { pages: 4 })).toHaveLength(4);
    expect(paginate(scenes, { pages: 99 })).toHaveLength(12);
  });

  it('skips blocks already placed on existing pages', () => {
    const a = block('action', 'placed');
    const b = block('action', 'unplaced');
    const plan = paginate([scene([a, b])], { skipBlockIds: new Set([a.id]) });
    expect(plan.flatMap(p => p.panels.flatMap(panel => panel.blockIds))).toEqual([b.id]);
    expect(paginate([scene([a])], { skipBlockIds: new Set([a.id]) })).toEqual([]);
  });

  it('keeps setting blocks linked to a panel so nothing looks unplaced', () => {
    const lone = block('setting', 'A quiet harbor');
    const trailing = block('setting', 'Night falls');
    const action = block('action', 'Boats rock gently');
    expect(paginate([scene([lone])])[0].panels[0]).toMatchObject({
      description: 'A quiet harbor',
      blockIds: [lone.id],
    });
    const plan = paginate([scene([action, trailing])]);
    expect(plan.flatMap(p => p.panels.flatMap(panel => panel.blockIds))).toEqual([action.id, trailing.id]);
  });

  it('an empty script yields no pages', () => {
    expect(paginate([])).toEqual([]);
    expect(paginate([scene([block('action', '   ')])])).toEqual([]);
  });

  it('estimates pages from the number of non-empty blocks', () => {
    expect(estimateScenePages(scene([]))).toBe(0);
    expect(estimateScenePages(scene([block('setting', 'x'), block('action', 'y')]))).toBe(1);
    const six = scene(Array.from({ length: 6 }, () => block('action', 'z')));
    expect(estimateScenePages(six)).toBe(2);
    expect(estimatePages([six, six])).toBe(4);
  });
});
