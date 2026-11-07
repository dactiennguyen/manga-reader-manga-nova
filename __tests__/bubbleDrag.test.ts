import type { PanelShape } from '../src/core/layout/layout';
import {
  ROTATE_OFFSET,
  bubbleAt,
  clampToBox,
  hitSelected,
  localCorners,
  moveBubble,
  pickDrag,
  resizeBubble,
  rotateBubble,
  rotateHandle,
  settleTail,
  snapTargets,
  snapTo,
} from '../src/core/lettering/bubbleDrag';
import { bubbleCenter, createBubble, rotatePoint } from '../src/core/lettering/bubbles';
import type { Bubble } from '../src/core/model/types';

const bubble = (patch: Partial<Bubble> = {}) => createBubble('speak', { x: 500, y: 500 }, { w: 200, h: 100, ...patch });

describe('hit priority', () => {
  it('prefers the tail over everything under it', () => {
    const b = bubble({ tail: { x: 400, y: 450 } });
    expect(hitSelected(b, { x: 400, y: 450 }, 1)?.mode).toBe('tail');
  });

  it('prefers rotate over a corner', () => {
    const b = bubble({ w: 40, h: 30, x: 480, y: 485, tail: null });
    const knob = rotateHandle(b, 1);
    expect(hitSelected(b, knob, 1)?.mode).toBe('rotate');
  });

  it('prefers a corner over the body', () => {
    const b = bubble({ tail: null });
    expect(hitSelected(b, { x: b.x + 2, y: b.y + 2 }, 1)).toMatchObject({ mode: 'resize', corner: 0 });
    expect(hitSelected(b, { x: b.x + b.w, y: b.y + b.h }, 1)).toMatchObject({ mode: 'resize', corner: 2 });
  });

  it('falls through to the body, then to nothing', () => {
    const b = bubble({ tail: null });
    expect(hitSelected(b, bubbleCenter(b), 1)?.mode).toBe('move');
    expect(hitSelected(b, { x: 0, y: 0 }, 1)).toBeNull();
  });

  it('finds handles on a rotated bubble', () => {
    const b = bubble({ tail: null, rotation: 90 });
    const corner = rotatePoint(localCorners(b)[1], bubbleCenter(b), 90);
    expect(hitSelected(b, corner, 1)).toMatchObject({ mode: 'resize', corner: 1 });
  });

  it('measures handle reach on screen, so it shrinks in page units as you zoom in', () => {
    const b = bubble({ tail: { x: 300, y: 300 } });
    expect(hitSelected(b, { x: 300 + 23, y: 300 }, 1)?.mode).toBe('tail');
    expect(hitSelected(b, { x: 300 + 23, y: 300 }, 2)).toBeNull();
    expect(hitSelected(b, { x: 300 + 11, y: 300 }, 2)?.mode).toBe('tail');
  });

  it('keeps the rotate knob the same distance away on screen', () => {
    const b = bubble();
    expect(b.y - rotateHandle(b, 2).y).toBe(ROTATE_OFFSET / 2);
  });
});

describe('picking a drag', () => {
  const selected = bubble({ tail: null });

  it('takes the selected bubble first, then the effect dot, then any bubble, then the view', () => {
    const other = createBubble('speak', { x: 100, y: 100 }, { w: 80, h: 80 });
    const dot = { x: 900, y: 900 };
    const base = { k: 1, selected, effectCenter: dot, grabbable: [other, selected] };
    expect(pickDrag({ ...base, p: bubbleCenter(selected) })).toMatchObject({ mode: 'move', start: selected });
    expect(pickDrag({ ...base, p: dot }).mode).toBe('center');
    expect(pickDrag({ ...base, p: { x: 100, y: 100 } })).toMatchObject({ mode: 'move', start: other });
    expect(pickDrag({ ...base, p: { x: 700, y: 100 } }).mode).toBe('view');
  });

  it('grabs the topmost bubble', () => {
    const under = createBubble('speak', { x: 100, y: 100 }, { w: 80, h: 80 });
    const over = createBubble('speak', { x: 100, y: 100 }, { w: 80, h: 80 });
    expect(bubbleAt([under, over], { x: 100, y: 100 }, 1)).toBe(over);
  });
});

describe('snap guides', () => {
  const shapes = [{ bbox: { x: 0, y: 0, w: 1000, h: 1000 } }] as PanelShape[];

  it('picks the nearest target in range', () => {
    expect(snapTo(10, [0, 12, 14], 5)).toBe(12);
    expect(snapTo(10, [100], 5)).toBeNull();
  });

  it('snaps to a panel middle and shows a guide, moving the tail along', () => {
    const start = bubble({ x: 395, y: 200, tail: { x: 450, y: 400 } });
    const { bubble: moved, guides } = moveBubble(start, 2, 0, 1, snapTargets([start], start.id, shapes));
    expect(bubbleCenter(moved).x).toBe(500);
    expect(guides).toEqual([{ axis: 'x', at: 500 }]);
    expect(moved.tail).toEqual({ x: 455, y: 400 });
  });

  it('snaps to another bubble but never to itself', () => {
    const start = bubble({ x: 100, y: 100, w: 100, h: 100 });
    const other = bubble({ x: 300, y: 100, w: 100, h: 100 });
    const targets = snapTargets([start, other], start.id, []);
    expect(targets.xs).toEqual([350]);
    expect(moveBubble(start, 198, 0, 1, targets).guides).toContainEqual({ axis: 'x', at: 350 });
  });

  it('moves freely with no target in range', () => {
    const start = bubble({ x: 100, y: 100 });
    const result = moveBubble(start, 40, 30, 1, { xs: [], ys: [] });
    expect(result.guides).toEqual([]);
    expect(result.bubble).toMatchObject({ x: 140, y: 130 });
  });

  it('tightens the snap range in page units as you zoom in', () => {
    const start = bubble({ x: 395, y: 100 });
    const targets = { xs: [500], ys: [] };
    expect(moveBubble(start, 0, 0, 1, targets).guides).toHaveLength(1);
    expect(moveBubble(start, 0, 0, 2, targets).guides).toHaveLength(0);
  });
});

describe('resize and rotate', () => {
  it('keeps the opposite corner still', () => {
    const start = bubble({ tail: null });
    const next = resizeBubble(start, 2, { x: start.x + 300, y: start.y + 200 });
    expect(next).toMatchObject({ x: start.x, y: start.y, w: 300, h: 200 });
  });

  it('keeps the opposite corner still on a rotated bubble', () => {
    const start = bubble({ tail: null, rotation: 30 });
    const fixed = rotatePoint(localCorners(start)[0], bubbleCenter(start), 30);
    const next = resizeBubble(start, 2, { x: fixed.x + 200, y: fixed.y + 240 });
    const after = rotatePoint(localCorners(next)[0], bubbleCenter(next), 30);
    expect(Math.hypot(after.x - fixed.x, after.y - fixed.y)).toBeLessThan(40);
    expect(next.w).not.toBe(start.w);
  });

  it('stops at the minimum size', () => {
    const next = resizeBubble(bubble({ tail: null }), 2, { x: 0, y: 0 });
    expect(next).toMatchObject({ w: 60, h: 40 });
  });

  it('snaps to common angles and rounds the rest', () => {
    const start = bubble();
    const c = bubbleCenter(start);
    expect(rotateBubble(start, { x: c.x, y: c.y - 100 }).rotation).toBe(0);
    expect(rotateBubble(start, { x: c.x + 100, y: c.y }).rotation).toBe(90);
    const free = rotateBubble(start, { x: c.x + 100, y: c.y - 60 }).rotation;
    expect(Number.isInteger(free)).toBe(true);
  });
});

describe('dropping a tail', () => {
  it('removes a tail dropped inside the bubble', () => {
    const b = bubble();
    expect(settleTail({ ...b, tail: bubbleCenter(b) }).tail).toBeNull();
  });

  it('keeps a tail dropped outside', () => {
    const b = bubble({ tail: { x: 0, y: 0 } });
    expect(settleTail(b).tail).toEqual({ x: 0, y: 0 });
  });

  it('keeps a tail resting on the rim, which is what a short tail looks like', () => {
    const b = bubble();
    expect(settleTail({ ...b, tail: { x: b.x + 2, y: b.y + b.h / 2 } }).tail).not.toBeNull();
  });
});

it('keeps an effect centre inside its panel', () => {
  expect(clampToBox({ x: -5, y: 500 }, { x: 0, y: 0, w: 100, h: 100 })).toEqual({ x: 0, y: 100 });
});
