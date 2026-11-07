import { computePanels } from '../src/core/layout/layout';
import {
  bubblesInOrder,
  bubblesInPanel,
  clampFontSize,
  coalesceTag,
  defaultTail,
  duplicateBubble,
  moveInStack,
  patchItem,
  scriptSync,
} from '../src/core/lettering/bubbleEdit';
import { createBubble } from '../src/core/lettering/bubbles';
import { groupProposals, translationTargets } from '../src/core/lettering/translationPlan';
import type { Block, Bubble, Page, Scene } from '../src/core/model/types';

const bubble = (x: number, y: number, patch: Partial<Bubble> = {}) => createBubble('speak', { x, y }, { w: 40, h: 40, ...patch });

describe('list edits', () => {
  it('returns the same array for an edit that changes nothing', () => {
    const list = [bubble(0, 0, { fontSize: 20 })];
    expect(patchItem(list, list[0].id, { fontSize: 20 })).toBe(list);
    expect(patchItem(list, 'missing', { fontSize: 30 })).toBe(list);
    expect(patchItem(list, list[0].id, { fontSize: 30 })[0].fontSize).toBe(30);
  });

  it('gives each bubble and property its own tag, and a new one after undo', () => {
    expect(coalesceTag(0, 'a', 'size')).not.toBe(coalesceTag(0, 'a', 'text'));
    expect(coalesceTag(0, 'a', 'size')).not.toBe(coalesceTag(0, 'b', 'size'));
    expect(coalesceTag(0, 'a', 'size')).not.toBe(coalesceTag(1, 'a', 'size'));
  });

  it('duplicates beside the source, without its script link', () => {
    const source = bubble(100, 100, { blockId: 'b', tail: { x: 10, y: 10 } });
    const copy = duplicateBubble(source);
    expect(copy.id).not.toBe(source.id);
    expect(copy.blockId).toBeUndefined();
    expect(copy).toMatchObject({ x: source.x + 30, y: source.y + 30, tail: { x: 40, y: 40 } });
  });

  it('moves a bubble in the stack and stops at the ends', () => {
    const list = [bubble(0, 0), bubble(0, 0), bubble(0, 0)];
    expect(moveInStack(list, list[0].id, 1).map(item => item.id)).toEqual([list[1].id, list[0].id, list[2].id]);
    expect(moveInStack(list, list[0].id, -1)).toBe(list);
    expect(moveInStack(list, list[2].id, 1)).toBe(list);
  });

  it('puts a new tail below the bubble', () => {
    expect(defaultTail({ x: 0, y: 0, w: 100, h: 50 })).toEqual({ x: 35, y: 100 });
  });

  it('limits the font size by kind', () => {
    expect(clampFontSize('speak', 5)).toBe(14);
    expect(clampFontSize('speak', 500)).toBe(72);
    expect(clampFontSize('sfx', 5)).toBe(24);
    expect(clampFontSize('sfx', 500)).toBe(220);
  });
});

describe('bubble order', () => {
  const page: Pick<Page, 'layout' | 'panels' | 'gutterH' | 'gutterV'> = {
    layout: {
      kind: 'split',
      id: 's',
      dir: 'v',
      t0: 0.5,
      t1: 0.5,
      a: { kind: 'panel', id: 'left' },
      b: { kind: 'panel', id: 'right' },
    },
    panels: {},
    gutterH: 10,
    gutterV: 10,
  };

  it('reads panels first, then top to bottom, then along the reading direction', () => {
    const shapes = computePanels(page, { w: 1000, h: 1000 }, { rtl: true });
    const left = bubble(250, 500);
    const rightTop = bubble(750, 200);
    const rightBottom = bubble(750, 600);
    expect(bubblesInOrder([left, rightBottom, rightTop], shapes, true)).toEqual([rightTop, rightBottom, left]);
  });

  it('finds the bubbles sitting in a panel', () => {
    const shapes = computePanels(page, { w: 1000, h: 1000 }, { rtl: false });
    const left = bubble(250, 500);
    expect(bubblesInPanel([left, bubble(750, 200)], shapes, 'left')).toEqual([left]);
  });
});

describe('syncing text back to the script', () => {
  const block: Block = { id: 'b1', type: 'dialogue', text: 'Old line' } as Block;
  const other: Block = { id: 'b2', type: 'action', text: 'Runs' } as Block;
  const scene = { id: 's1', blocks: [other, block] } as Scene;

  it('rewrites only the linked block', () => {
    const sync = scriptSync({ text: '  New line ', blockId: 'b1' }, [undefined, scene]);
    expect(sync?.sceneId).toBe('s1');
    expect(sync?.blocks.map(item => item.text)).toEqual(['Runs', 'New line']);
  });

  it('does nothing when they already agree, or there is nothing to send', () => {
    expect(scriptSync({ text: ' Old line', blockId: 'b1' }, [scene])).toBeNull();
    expect(scriptSync({ text: '   ', blockId: 'b1' }, [scene])).toBeNull();
    expect(scriptSync({ text: 'Free bubble', blockId: undefined }, [scene])).toBeNull();
    expect(scriptSync({ text: 'Gone', blockId: 'nope' }, [scene])).toBeNull();
    expect(scriptSync(undefined, [scene])).toBeNull();
  });
});

describe('translation plan', () => {
  const sections = [
    {
      pageId: 'p1',
      bubbles: [
        { id: 'a', text: ' Hello ', translations: { vi: 'Chào' } },
        { id: 'b', text: 'Bye' },
        { id: 'c', text: '  ' },
      ],
    },
  ];

  it('targets missing lines, or every line with text', () => {
    expect(translationTargets(sections, 'vi', 'missing').map(item => item.bubbleId)).toEqual(['b']);
    expect(translationTargets(sections, 'vi', 'all')).toEqual([
      { pageId: 'p1', bubbleId: 'a', original: 'Hello' },
      { pageId: 'p1', bubbleId: 'b', original: 'Bye' },
    ]);
  });

  it('splits proposals by page and skips empty ones', () => {
    const grouped = groupProposals(
      [
        { pageId: 'p1', bubbleId: 'a', original: 'x', text: ' Chào ' },
        { pageId: 'p2', bubbleId: 'b', original: 'y', text: 'Tạm biệt' },
        { pageId: 'p2', bubbleId: 'c', original: 'z', text: '   ' },
      ],
      'p1',
    );
    expect(grouped).toEqual({ current: { a: 'Chào' }, others: { p2: { b: 'Tạm biệt' } } });
  });
});
