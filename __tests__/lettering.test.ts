import { computePanels } from '../src/core/layout/layout';
import {
  bubbleBounds,
  bubbleCorners,
  burstPoints,
  createBubble,
  hitTestBubble,
  rotatePoint,
  seededRandom,
  tailShape,
  textInset,
  toBubbleLocal,
} from '../src/core/lettering/bubbles';
import { createEffect } from '../src/core/lettering/effects';
import { fitBubbleText, fitTranslatedText, type TextMeasure } from '../src/core/lettering/fit';
import { autoPlace, blockMapOf, bubbleTypeOf, pageBlocksOf, placeBlock } from '../src/core/lettering/script';
import type { Block, Bubble, Page } from '../src/core/model/types';

/** Taller text at larger sizes, like real layout. */
const measure: TextMeasure = (_bubble, fontSize, width) => Math.ceil(800 / width) * fontSize * 1.15;

const bubble = (patch: Partial<Bubble> = {}) => createBubble('speak', { x: 300, y: 300 }, patch);

describe('bubble geometry', () => {
  it('builds each kind with its defaults', () => {
    expect(createBubble('sfx', { x: 0, y: 0 })).toMatchObject({ rotation: -8, font: 'display', tail: null, outline: 6 });
    expect(createBubble('narration', { x: 0, y: 0 })).toMatchObject({ narrationStyle: 'box', tail: null });
    expect(createBubble('shout', { x: 0, y: 0 }).bold).toBe(true);
    expect(bubble().tail).not.toBeNull();
  });

  it('centres on the given point', () => {
    const b = bubble({ w: 100, h: 60 });
    expect(b.x).toBe(250);
    expect(b.y).toBe(270);
  });

  it('rotates and unrotates a point', () => {
    const c = { x: 10, y: 10 };
    const p = rotatePoint({ x: 20, y: 10 }, c, 90);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(20);
    expect(rotatePoint(p, c, -90).x).toBeCloseTo(20);
  });

  it('hit tests through rotation', () => {
    const b = bubble({ w: 200, h: 20, rotation: 90 });
    expect(hitTestBubble(b, { x: 300, y: 380 })).toBe(true);
    expect(hitTestBubble(b, { x: 380, y: 300 })).toBe(false);
    expect(hitTestBubble(b, { x: 300, y: 405 }, 10)).toBe(true);
  });

  it('bounds cover the rotated corners', () => {
    const b = bubble({ w: 100, h: 100, rotation: 45 });
    const box = bubbleBounds(b);
    expect(box.w).toBeCloseTo(Math.SQRT2 * 100);
    expect(bubbleCorners(b)).toHaveLength(4);
    expect(toBubbleLocal(b, { x: 300, y: 300 })).toEqual({ x: 300, y: 300 });
  });

  it('gives each kind its text inset', () => {
    expect(textInset({ type: 'sfx', w: 100, h: 100 })).toEqual({ x: 0, y: 0 });
    expect(textInset({ type: 'machine', w: 100, h: 100 })).toEqual({ x: 16, y: 12 });
    expect(textInset({ type: 'speak', w: 100, h: 100 }).x).toBeCloseTo(15);
    expect(textInset({ type: 'speak', w: 100, h: 100 }).y).toBeCloseTo(14);
  });

  it('shapes a tail per kind', () => {
    const tip = { x: 300, y: 500 };
    expect(tailShape(bubble(), tip).kind).toBe('curve');
    expect(tailShape(createBubble('shout', { x: 300, y: 300 }), tip).kind).toBe('spike');
    expect(tailShape(createBubble('machine', { x: 300, y: 300 }), tip).kind).toBe('zigzag');
  });

  it('keeps a burst stable for a bubble id', () => {
    const b = createBubble('shout', { x: 300, y: 300 }, { id: 'same' });
    expect(burstPoints(b)).toEqual(burstPoints({ ...b }));
    expect(seededRandom('a')()).toBe(seededRandom('a')());
  });

  it('starts effects from sensible defaults', () => {
    expect(createEffect('gradient', 'p')).toMatchObject({ angle: 90, opacity: 0.5, panelId: 'p' });
    expect(createEffect('speed', 'p')).toMatchObject({ angle: 0, opacity: 1 });
  });
});

describe('fitting text', () => {
  it('shrinks text until it fits', () => {
    const fit = fitBubbleText(bubble({ fontSize: 40, w: 300, h: 120 }), measure);
    expect(fit.fontSize).toBeLessThan(40);
    expect(fit.overflow).toBe(false);
  });

  it('stops at the floor and reports overflow', () => {
    const fit = fitBubbleText(bubble({ fontSize: 40, w: 100, h: 60 }), measure);
    expect(fit.fontSize).toBe(17);
    expect(fit.overflow).toBe(true);
  });

  it('never shrinks sound effects', () => {
    const b = createBubble('sfx', { x: 0, y: 0 }, { fontSize: 84, w: 100, h: 20 });
    expect(fitBubbleText(b, measure)).toMatchObject({ fontSize: 84, overflow: false });
  });

  it('translated text may go smaller than the original', () => {
    const b = bubble({ fontSize: 40, w: 100, h: 60 });
    expect(fitTranslatedText(b, b, measure).fontSize).toBeLessThan(17);
  });
});

describe('placing script lines', () => {
  const blocks: Block[] = [
    { id: 'b1', type: 'dialogue', text: 'Hello there' } as Block,
    { id: 'b2', type: 'narration', text: 'Later' } as Block,
    { id: 'b3', type: 'sfx', text: 'BOOM' } as Block,
    { id: 'b4', type: 'action', text: 'Not lettered' } as Block,
  ];
  const page = {
    bubbles: [],
    effects: [],
    layout: { kind: 'panel', id: 'p1' },
    panels: { p1: { id: 'p1', blockIds: ['b1', 'b2', 'b3', 'b4'] } },
    order: undefined,
    gutterH: 20,
    gutterV: 20,
  } as unknown as Page;
  const map = blockMapOf([{ blocks } as never]);

  it('lists lettered blocks only', () => {
    expect(pageBlocksOf(page, map, false).map(item => item.block.id)).toEqual(['b1', 'b2', 'b3']);
  });

  it('marks a block already placed', () => {
    const placed = { ...page, bubbles: [bubble({ blockId: 'b1' })] };
    expect(pageBlocksOf(placed, map, false)[0].placed).toBe(true);
  });

  it('maps block kinds to bubble types', () => {
    expect(bubbleTypeOf(blocks[1])).toBe('narration');
    expect(bubbleTypeOf(blocks[2])).toBe('sfx');
    expect(bubbleTypeOf(blocks[0])).toBe('speak');
  });

  it('places every block inside its panel', () => {
    const shapes = computePanels(page, { w: 1000, h: 1400 }, { rtl: false });
    expect(shapes).toHaveLength(1);
    const bubbles = autoPlace(pageBlocksOf(page, map, false), shapes, false, measure);
    expect(bubbles.map(item => item.type)).toEqual(['speak', 'narration', 'sfx']);
    const bb = shapes[0].bbox;
    bubbles.forEach(item => {
      expect(item.x).toBeGreaterThanOrEqual(bb.x);
      expect(item.y).toBeGreaterThanOrEqual(bb.y);
      expect(item.x + item.w).toBeLessThanOrEqual(bb.x + bb.w);
      expect(item.y + item.h).toBeLessThanOrEqual(bb.y + bb.h);
    });
  });

  it('works without a measuring function', () => {
    const item = pageBlocksOf(page, map, false)[0];
    const placed = placeBlock(item, { x: 0, y: 0, w: 500, h: 500 }, 0, { y: 20 }, false, null);
    expect(placed.text).toBe('Hello there');
  });

  it('starts from the other side in right-to-left books', () => {
    const item = pageBlocksOf(page, map, false)[0];
    const box = { x: 0, y: 0, w: 800, h: 800 };
    const ltr = placeBlock(item, box, 0, { y: 20 }, false, null);
    const rtl = placeBlock(item, box, 0, { y: 20 }, true, null);
    expect(rtl.x).toBeGreaterThan(ltr.x);
  });
});
