import {
  IDENTITY_TRANSFORM,
  TONE_PITCH,
  appendPressurePoint,
  composeTransform,
  cornerOffset,
  cornerScale,
  hitCorner,
  isIdentityTransform,
  layerBounds,
  pinchTransform,
  scaleAbout,
  shapeBox,
  strokeStep,
  toneRadius,
  transformBox,
  transformLayer,
  transformStroke,
} from '../src/core/art/artMath';
import type { Stroke } from '../src/core/model/types';

const stroke = (patch: Partial<Stroke>): Stroke => ({
  tool: 'gpen',
  color: '#000000',
  size: 10,
  opacity: 1,
  points: [],
  ...patch,
});

describe('artMath', () => {
  it('normalises a shape box from any drag direction', () => {
    expect(shapeBox([50, 80, 10, 20])).toEqual({ x: 10, y: 20, w: 40, h: 60 });
    expect(shapeBox([1, 2])).toBeNull();
  });

  it('uses triples only for freehand pressure strokes', () => {
    expect(strokeStep({ tool: 'gpen', pressure: true })).toBe(3);
    expect(strokeStep({ tool: 'gpen' })).toBe(2);
    expect(strokeStep({ tool: 'rect', pressure: true })).toBe(2);
    expect(strokeStep({ tool: 'fill', pressure: true })).toBe(2);
  });

  it('bakes a transform into points and size, keeping pressure values', () => {
    const t = { s: 2, tx: 10, ty: -5 };
    expect(transformStroke(stroke({ points: [1, 2, 3, 4] }), t)).toMatchObject({ points: [12, -1, 16, 3], size: 20 });
    const pressed = transformStroke(stroke({ points: [1, 2, 0.4, 3, 4, 0.9], pressure: true }), t);
    expect(pressed.points).toEqual([12, -1, 0.4, 16, 3, 0.9]);
    expect(pressed.pressure).toBe(true);
  });

  it('keeps tone and tool when transforming and does not mutate the source', () => {
    const source = stroke({ tool: 'fill', tone: { density: 0.25 }, points: [0, 0, 10, 0, 10, 10] });
    const moved = transformStroke(source, { s: 1, tx: 5, ty: 5 });
    expect(moved.tone).toEqual({ density: 0.25 });
    expect(moved.tool).toBe('fill');
    expect(source.points).toEqual([0, 0, 10, 0, 10, 10]);
  });

  it('transforms layer strokes and image together', () => {
    const layer = {
      strokes: [stroke({ tool: 'rect', points: [0, 0, 10, 10], size: 4 })],
      image: { uri: 'a.png', x: 10, y: 20, w: 100, h: 50 },
    };
    const next = transformLayer(layer, { s: 0.5, tx: 100, ty: 0 });
    expect(next.strokes[0].points).toEqual([100, 0, 105, 5]);
    expect(next.strokes[0].size).toBe(2);
    expect(next.image).toEqual({ uri: 'a.png', x: 105, y: 10, w: 50, h: 25 });
    expect('image' in transformLayer({ strokes: [] }, IDENTITY_TRANSFORM)).toBe(false);
  });

  it('computes layer bounds from strokes and image, ignoring eraser strokes', () => {
    expect(layerBounds({ strokes: [] })).toBeNull();
    expect(layerBounds({ strokes: [stroke({ tool: 'eraser', points: [0, 0, 500, 500] })] })).toBeNull();
    const bounds = layerBounds({
      strokes: [
        stroke({ points: [10, 10, 30, 40], size: 10 }),
        stroke({ tool: 'fill', points: [0, 20, 5, 25, 3, 60] }),
      ],
      image: { uri: 'a.png', x: 20, y: 0, w: 50, h: 10 },
    });
    expect(bounds).toEqual({ x: 0, y: 0, w: 70, h: 60 });
  });

  it('scales about the opposite corner when dragging a handle', () => {
    const box = { x: 100, y: 100, w: 100, h: 50 };
    expect(hitCorner(box, 198, 152, 10)).toBe(2);
    expect(hitCorner(box, 150, 125, 10)).toBe(-1);
    const t = cornerScale(box, 2, 300, 200);
    expect(t.s).toBeCloseTo(2);
    const scaled = transformBox(box, t);
    expect(scaled.x).toBeCloseTo(100);
    expect(scaled.y).toBeCloseTo(100);
    expect(scaled.w).toBeCloseTo(200);
    expect(scaleAbout(10, 10, 1000).s).toBe(20);
  });

  it('builds pinch transforms that map the start centroid onto the current one', () => {
    const t = pinchTransform({ cx: 100, cy: 100, dist: 50 }, { cx: 150, cy: 120, dist: 100 });
    expect(t.s).toBe(2);
    expect(100 * t.s + t.tx).toBeCloseTo(150);
    expect(100 * t.s + t.ty).toBeCloseTo(120);
    expect(isIdentityTransform(pinchTransform({ cx: 1, cy: 1, dist: 5 }, { cx: 1, cy: 1, dist: 5 }))).toBe(true);
  });

  it('composes transforms in order', () => {
    const first = { s: 2, tx: 10, ty: 0 };
    const then = { s: 0.5, tx: -5, ty: 3 };
    const c = composeTransform(first, then);
    const x = 7;
    expect(x * c.s + c.tx).toBeCloseTo((x * first.s + first.tx) * then.s + then.tx);
    expect(c.ty).toBeCloseTo(3);
  });

  it('keeps the combined scale inside the allowed range', () => {
    const tiny = composeTransform({ s: 0.05, tx: 0, ty: 0 }, { s: 0.05, tx: 0, ty: 0 });
    const huge = composeTransform({ s: 20, tx: 0, ty: 0 }, { s: 20, tx: 0, ty: 0 });
    expect(tiny.s).toBeCloseTo(0.05);
    expect(huge.s).toBeCloseTo(20);
  });

  it('does not jump when a corner handle is grabbed off-centre', () => {
    const box = { x: 100, y: 100, w: 200, h: 100 };
    const grab = cornerOffset(box, 2, 290, 195);
    const t = cornerScale(box, 2, 290 + grab.x, 195 + grab.y);
    expect(t.s).toBeCloseTo(1);
    expect(t.tx).toBeCloseTo(0);
    expect(t.ty).toBeCloseTo(0);
  });

  it('appends pressure triples with a minimum distance', () => {
    const points: number[] = [];
    expect(appendPressurePoint(points, 1.04, 2.06, 0.5, 0)).toBe(true);
    expect(appendPressurePoint(points, 1.2, 2.1, 0.7, 2)).toBe(false);
    expect(appendPressurePoint(points, 5, 2.1, 1.7, 2)).toBe(true);
    expect(points).toEqual([1, 2.1, 0.5, 5, 2.1, 1]);
  });

  it('sizes tone dots so coverage matches the density', () => {
    const r = toneRadius(0.25);
    expect((Math.PI * r * r) / (TONE_PITCH * TONE_PITCH)).toBeCloseTo(0.25);
    expect(toneRadius(0.6)).toBeLessThan(TONE_PITCH / 2);
  });
});
