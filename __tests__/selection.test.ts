import {
  AFFINE_SCALE_MAX,
  HIT_INSIDE,
  HIT_NONE,
  HIT_ROTATE,
  IDENTITY_AFFINE,
  affineAngle,
  affineScale,
  applyAffine,
  applySelectionOp,
  composeAffine,
  dragRotate,
  dragScale,
  frameCenter,
  frameCorners,
  hitFrame,
  invertAffine,
  isIdentityAffine,
  keepsAxes,
  mirrorAround,
  moveBy,
  rotateAround,
  rotateHandle,
  scaleAround,
  type Affine,
} from '../src/core/art/affine';
import { shapeBox } from '../src/core/art/artMath';
import {
  ellipseOutline,
  isInsideLasso,
  pickStrokes,
  pointInPolygon,
  rectRing,
  removeSelected,
  selectionBounds,
  selectionRuns,
  strokeSamples,
  transformSelected,
  transformStrokeAffine,
} from '../src/core/art/selection';
import type { Stroke } from '../src/core/model/types';
import { buildStrokePath } from '../src/render/drawArt';
import { signedArea, type FakePath } from './helpers/fakeSkia';

jest.mock('@shopify/react-native-skia', () => require('./helpers/fakeSkia'));

const square = [0, 0, 100, 0, 100, 100, 0, 100];
const box = { x: 100, y: 200, w: 80, h: 40 };

const pen = (points: number[], extra: Partial<Stroke> = {}): Stroke => ({
  tool: 'gpen',
  color: '#000000',
  size: 4,
  opacity: 1,
  points,
  ...extra,
});

const close = (a: { x: number; y: number }, x: number, y: number) => {
  expect(a.x).toBeCloseTo(x, 6);
  expect(a.y).toBeCloseTo(y, 6);
};

describe('affine maps', () => {
  it('composes in order and undoes itself with its inverse', () => {
    const m = composeAffine(composeAffine(scaleAround(10, 20, 2), rotateAround(5, 5, 0.7)), moveBy(30, -4));
    const direct = applyAffine(moveBy(30, -4), 0, 0);
    close(direct, 30, -4);
    const p = applyAffine(m, 13, 37);
    const back = applyAffine(invertAffine(m) as Affine, p.x, p.y);
    close(back, 13, 37);
    expect(affineScale(m)).toBeCloseTo(2, 6);
    expect(affineAngle(m)).toBeCloseTo(0.7, 6);
  });

  it('turns clockwise on screen about a point that stays put', () => {
    const quarter = rotateAround(50, 50, Math.PI / 2);
    close(applyAffine(quarter, 50, 50), 50, 50);
    close(applyAffine(quarter, 50, 0), 100, 50);
  });

  it('mirrors about a centre without changing size', () => {
    const flip = mirrorAround(50, 80, true);
    close(applyAffine(flip, 10, 7), 90, 7);
    close(applyAffine(mirrorAround(50, 80, false), 10, 70), 10, 90);
    expect(affineScale(flip)).toBeCloseTo(1, 6);
  });

  it('has no inverse for a collapsed map', () => {
    expect(invertAffine({ a: 0, b: 0, c: 0, d: 0, tx: 1, ty: 1 })).toBeNull();
  });

  it('knows which maps keep a level box level', () => {
    expect(keepsAxes(IDENTITY_AFFINE)).toBe(true);
    expect(keepsAxes(mirrorAround(0, 0, true))).toBe(true);
    expect(keepsAxes(rotateAround(3, 4, Math.PI / 2))).toBe(true);
    expect(keepsAxes(composeAffine(scaleAround(1, 1, 3), moveBy(5, 5)))).toBe(true);
    expect(keepsAxes(rotateAround(0, 0, 0.3))).toBe(false);
  });

  it('tells a real transform from a resting one', () => {
    expect(isIdentityAffine(moveBy(0.01, 0))).toBe(true);
    expect(isIdentityAffine(moveBy(1, 0))).toBe(false);
    expect(isIdentityAffine(rotateAround(0, 0, 0.01))).toBe(false);
  });
});

describe('the selection frame', () => {
  it('follows the transform with its corners, centre and turn handle', () => {
    const m = rotateAround(140, 220, Math.PI / 2);
    const corners = frameCorners(box, m);
    close(corners[0], 160, 180);
    close(frameCenter(box, m), 140, 220);
    const turn = rotateHandle(box, m, 30);
    // The top edge now faces right, so the handle stands to the right of it.
    close(turn.top, 160, 220);
    close(turn.handle, 190, 220);
  });

  it('reads a touch as the turn handle, a corner, the inside or nothing', () => {
    const hit = (x: number, y: number) => hitFrame(box, IDENTITY_AFFINE, x, y, 10, 30);
    expect(hit(140, 170)).toBe(HIT_ROTATE);
    expect(hit(100, 200)).toBe(0);
    expect(hit(184, 243)).toBe(2);
    expect(hit(140, 220)).toBe(HIT_INSIDE);
    expect(hit(300, 300)).toBe(HIT_NONE);
  });

  it('lets a small frame be moved, by shrinking the corners inside it', () => {
    const tiny = { x: 0, y: 0, w: 12, h: 12 };
    expect(hitFrame(tiny, IDENTITY_AFFINE, 6, 6, 20, 30)).toBe(HIT_INSIDE);
    expect(hitFrame(tiny, IDENTITY_AFFINE, -8, -8, 20, 30)).toBe(0);
  });

  it('hit-tests in the frame turned by the transform', () => {
    const m = rotateAround(140, 220, Math.PI / 2);
    expect(hitFrame(box, m, 140, 255, 10, 30)).toBe(HIT_INSIDE);
    expect(hitFrame(box, IDENTITY_AFFINE, 140, 255, 10, 30)).toBe(HIT_NONE);
  });

  it('scales evenly from a dragged corner, with the opposite corner fixed', () => {
    const m = dragScale(box, IDENTITY_AFFINE, 2, 260, 280);
    expect(affineScale(m)).toBeCloseTo(2, 6);
    close(applyAffine(m, 100, 200), 100, 200);
    close(applyAffine(m, 180, 240), 260, 280);
    expect(m.b).toBeCloseTo(0, 9);
  });

  it('keeps the scale inside its limits and never flips through the anchor', () => {
    expect(affineScale(dragScale(box, IDENTITY_AFFINE, 2, 99999, 99999))).toBeCloseTo(AFFINE_SCALE_MAX, 6);
    const past = dragScale(box, IDENTITY_AFFINE, 2, -500, -500);
    expect(past.a).toBeGreaterThan(0);
  });

  it('turns about the centre and lands on a quarter turn when close', () => {
    const free = dragRotate(box, IDENTITY_AFFINE, 140, 170, 190, 220);
    expect(affineAngle(free)).toBeCloseTo(Math.PI / 2, 6);
    close(frameCenter(box, free), 140, 220);
    const near = dragRotate(box, IDENTITY_AFFINE, 140, 170, 190, 222);
    expect(affineAngle(near)).toBeCloseTo(Math.PI / 2, 9);
    const loose = dragRotate(box, IDENTITY_AFFINE, 140, 170, 190, 190);
    expect(Math.abs(affineAngle(loose) - Math.PI / 2)).toBeGreaterThan(0.1);
  });

  it('gives every gesture a button that acts about the frame centre', () => {
    const right = applySelectionOp(box, IDENTITY_AFFINE, 'rotateRight');
    expect(affineAngle(right)).toBeCloseTo(Math.PI / 2, 9);
    close(frameCenter(box, right), 140, 220);
    expect(isIdentityAffine(applySelectionOp(box, right, 'rotateLeft'))).toBe(true);
    const flipped = applySelectionOp(box, IDENTITY_AFFINE, 'flipH');
    close(applyAffine(flipped, 100, 200), 180, 200);
    expect(isIdentityAffine(applySelectionOp(box, flipped, 'flipH'))).toBe(true);
    close(applyAffine(applySelectionOp(box, IDENTITY_AFFINE, 'flipV'), 100, 200), 100, 240);
    const bigger = applySelectionOp(box, IDENTITY_AFFINE, 'grow');
    expect(affineScale(bigger)).toBeCloseTo(1.1, 9);
    expect(affineScale(applySelectionOp(box, bigger, 'shrink'))).toBeCloseTo(1, 9);
    expect(applySelectionOp(box, bigger, 'reset')).toEqual(IDENTITY_AFFINE);
  });
});

describe('picking strokes with a lasso', () => {
  it('tests points against a polygon that closes itself', () => {
    expect(pointInPolygon(square, 50, 50)).toBe(true);
    expect(pointInPolygon(square, 150, 50)).toBe(false);
    const notch = [0, 0, 100, 0, 100, 100, 50, 20, 0, 100];
    expect(pointInPolygon(notch, 50, 60)).toBe(false);
    expect(pointInPolygon(notch, 20, 30)).toBe(true);
  });

  it('selects a stroke with more than half of its points inside, and not at exactly half', () => {
    expect(isInsideLasso(pen([10, 10, 20, 20, 30, 30, 200, 200]), square)).toBe(true);
    expect(isInsideLasso(pen([10, 10, 20, 20, 200, 200, 210, 210]), square)).toBe(false);
    expect(isInsideLasso(pen([10, 10, 200, 200, 210, 210]), square)).toBe(false);
    expect(isInsideLasso(pen([50, 50]), square)).toBe(true);
  });

  it('reads pressure strokes as x, y, pressure triples', () => {
    const stroke = pen([10, 10, 0.5, 20, 20, 0.5, 300, 300, 0.5], { pressure: true });
    expect(strokeSamples(stroke)).toEqual([10, 10, 20, 20, 300, 300]);
    expect(isInsideLasso(stroke, square)).toBe(true);
  });

  it('judges a shape by its outline, not by its two stored corners', () => {
    const line = pen([50, 50, 400, 50], { tool: 'line' });
    expect(isInsideLasso(line, square)).toBe(false);
    expect(isInsideLasso(pen([10, 50, 90, 50], { tool: 'line' }), square)).toBe(true);
    // Its first corner and its whole left edge are outside, yet most of the outline is inside.
    const rect = pen([-10, 10, 90, 90], { tool: 'rect' });
    expect(isInsideLasso(rect, square)).toBe(true);
    const ellipse = pen([60, 10, 260, 90], { tool: 'ellipse' });
    expect(isInsideLasso(ellipse, square)).toBe(false);
    expect(strokeSamples(ellipse)).toHaveLength(32);
  });

  it('needs a lasso of at least three points', () => {
    expect(isInsideLasso(pen([1, 1]), [0, 0, 10, 10])).toBe(false);
  });

  it('returns indices in drawing order, erasers included', () => {
    const strokes = [pen([10, 10, 20, 20]), pen([300, 300, 310, 310]), pen([40, 40, 50, 50], { tool: 'eraser' })];
    expect(pickStrokes(strokes, square)).toEqual([0, 2]);
  });

  it('boxes the selected ink, and reports nothing when only erasers are picked', () => {
    const strokes = [pen([10, 10, 50, 30]), pen([40, 40, 500, 500], { tool: 'eraser' })];
    expect(selectionBounds(strokes, [0, 1])).toEqual({ x: 8, y: 8, w: 44, h: 24 });
    expect(selectionBounds(strokes, [1])).toBeNull();
    expect(selectionBounds(strokes, [])).toBeNull();
  });
});

describe('writing a transform into a stroke', () => {
  const m = composeAffine(composeAffine(scaleAround(0, 0, 2), rotateAround(0, 0, Math.PI / 2)), moveBy(10, 20));

  it('moves the points, scales the width, and keeps everything else', () => {
    const stroke = pen([1, 2, 3, 4], { tone: { density: 0.25 }, opacity: 0.5, color: '#E53935', tool: 'brush' });
    const out = transformStrokeAffine(stroke, m);
    expect(out.points).toEqual([6, 22, 2, 26]);
    expect(out.size).toBe(8);
    expect(out.tone).toEqual({ density: 0.25 });
    expect(out.opacity).toBe(0.5);
    expect(out.color).toBe('#E53935');
    expect(out.tool).toBe('brush');
    expect(stroke.points).toEqual([1, 2, 3, 4]);
  });

  it('leaves pressure values alone', () => {
    const out = transformStrokeAffine(pen([1, 2, 0.31, 3, 4, 0.9], { pressure: true }), m);
    expect(out.points).toEqual([6, 22, 0.31, 2, 26, 0.9]);
    expect(out.pressure).toBe(true);
  });

  it('maps a line exactly, whatever the turn', () => {
    const turn = rotateAround(0, 0, Math.PI / 6);
    const out = transformStrokeAffine(pen([0, 0, 100, 0], { tool: 'line' }), turn);
    expect(out.tool).toBe('line');
    expect(out.points[2]).toBeCloseTo(86.6, 1);
    expect(out.points[3]).toBeCloseTo(50, 1);
  });

  it('keeps a rectangle or ellipse as it is through moves, scales, mirrors and quarter turns', () => {
    const rect = pen([10, 20, 110, 60], { tool: 'rect' });
    const flipped = transformStrokeAffine(rect, mirrorAround(0, 0, true));
    expect(flipped.tool).toBe('rect');
    expect(shapeBox(flipped.points)).toEqual({ x: -110, y: 20, w: 100, h: 40 });
    const quarter = transformStrokeAffine(rect, rotateAround(0, 0, Math.PI / 2));
    expect(quarter.tool).toBe('rect');
    expect(shapeBox(quarter.points)).toEqual({ x: -60, y: 10, w: 40, h: 100 });
    const ellipse = transformStrokeAffine(pen([0, 0, 10, 20], { tool: 'ellipse' }), scaleAround(0, 0, 3));
    expect(ellipse.tool).toBe('ellipse');
    expect(ellipse.points).toEqual([0, 0, 30, 60]);
    expect(ellipse.size).toBe(12);
  });

  /** True when (x, y) is on the ink of a rectangle stroke: within half the width of its edge, mitred. */
  const onRectInk = (rect: Stroke, x: number, y: number) => {
    const b = shapeBox(rect.points)!;
    const half = rect.size / 2;
    const inOuter = x > b.x - half && x < b.x + b.w + half && y > b.y - half && y < b.y + b.h + half;
    const inInner = x > b.x + half && x < b.x + b.w - half && y > b.y + half && y < b.y + b.h - half;
    return inOuter && !inInner;
  };

  it('turns a rotated rectangle into a filled ring that covers the same ink', () => {
    const rect = pen([20, 30, 140, 90], { tool: 'rect', size: 10, opacity: 0.6 });
    const turn = composeAffine(rotateAround(80, 60, 0.5), moveBy(15, -7));
    const out = transformStrokeAffine(rect, turn);
    expect(out.tool).toBe('fill');
    expect(out.opacity).toBe(0.6);
    expect(out.pressure).toBeUndefined();
    const back = invertAffine(turn) as Affine;
    let checked = 0;
    for (let x = -20; x <= 200; x += 3.7) {
      for (let y = -40; y <= 160; y += 3.3) {
        const local = applyAffine(back, x, y);
        // Skip points on the very edge, where rounding to two decimals decides.
        const edge = [-0.05, 0.05].map(d => onRectInk(rect, local.x + d, local.y + d));
        if (edge[0] !== edge[1]) {
          continue;
        }
        expect(pointInPolygon(out.points, x, y)).toBe(edge[0]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(3000);
  });

  it('draws that ring with straight edges: the path covers exactly the area of the stroke', () => {
    const rect = pen([0, 0, 120, 60], { tool: 'rect', size: 10 });
    const ring = { ...rect, tool: 'fill' as const, points: rectRing(rect) };
    const area = Math.abs(signedArea(buildStrokePath(ring, true) as unknown as FakePath));
    expect(area).toBeCloseTo(130 * 70 - 110 * 50, 6);
    const turned = transformStrokeAffine(rect, rotateAround(0, 0, 1));
    expect(Math.abs(signedArea(buildStrokePath(turned, true) as unknown as FakePath))).toBeCloseTo(3600, 0);
  });

  it('fills a rectangle thinner than its own line as one solid block', () => {
    const rect = pen([0, 0, 100, 4], { tool: 'rect', size: 10 });
    const ring = rectRing(rect);
    expect(ring).toHaveLength(16);
    expect(pointInPolygon(ring, 50, 2)).toBe(true);
    expect(pointInPolygon(ring, -4, -4)).toBe(true);
    expect(pointInPolygon(ring, -6, 2)).toBe(false);
  });

  it('turns a rotated ellipse into a closed outline that stays on the ellipse', () => {
    const ellipse = pen([100, 100, 300, 180], { tool: 'ellipse', size: 6, opacity: 0.8 });
    const turn = rotateAround(200, 140, 0.9);
    const out = transformStrokeAffine(ellipse, turn);
    expect(out.tool).toBe('pencil');
    expect(out.size).toBe(6);
    expect(out.opacity).toBe(0.8);
    const n = out.points.length;
    expect([out.points[0], out.points[1]]).toEqual([out.points[n - 2], out.points[n - 1]]);
    // The drawn curve passes through the middle of each pair of points. Those must sit on the ellipse.
    const back = invertAffine(turn) as Affine;
    for (let i = 2; i + 3 < n - 2; i += 2) {
      const mid = applyAffine(back, (out.points[i] + out.points[i + 2]) / 2, (out.points[i + 1] + out.points[i + 3]) / 2);
      const r = Math.hypot((mid.x - 200) / 100, (mid.y - 140) / 40);
      expect(Math.abs(r - 1)).toBeLessThan(0.002);
    }
    const flat = ellipseOutline(ellipse);
    expect(flat.length).toBe((64 + 2) * 2);
  });

  it('scales the width of a converted shape too', () => {
    const turn = composeAffine(scaleAround(0, 0, 3), rotateAround(0, 0, 0.4));
    expect(transformStrokeAffine(pen([0, 0, 10, 20], { tool: 'ellipse' }), turn).size).toBe(12);
  });

  it('changes only the selected strokes and keeps the drawing order', () => {
    const strokes = [pen([0, 0, 1, 1]), pen([5, 5, 6, 6]), pen([9, 9, 8, 8])];
    const out = transformSelected(strokes, [0, 2], moveBy(10, 0));
    expect(out).toHaveLength(3);
    expect(out[0].points).toEqual([10, 0, 11, 1]);
    expect(out[1]).toBe(strokes[1]);
    expect(out[2].points).toEqual([19, 9, 18, 8]);
    expect(removeSelected(strokes, [0, 2])).toEqual([strokes[1]]);
  });
});

describe('preview runs', () => {
  it('keeps selected and unselected stretches in drawing order', () => {
    expect(selectionRuns(6, [1, 2, 5])).toEqual([
      { moving: false, indices: [0] },
      { moving: true, indices: [1, 2] },
      { moving: false, indices: [3, 4] },
      { moving: true, indices: [5] },
    ]);
    expect(selectionRuns(2, [0, 1])).toEqual([{ moving: true, indices: [0, 1] }]);
    expect(selectionRuns(0, [])).toEqual([]);
  });

  it('folds the tail into two runs past the cap, losing no stroke', () => {
    const picked = [0, 2, 4, 6, 8];
    const runs = selectionRuns(10, picked, 4);
    expect(runs).toHaveLength(4);
    expect(runs[2]).toEqual({ moving: false, indices: [3, 5, 7, 9] });
    expect(runs[3]).toEqual({ moving: true, indices: [2, 4, 6, 8] });
    expect(runs.flatMap(run => run.indices).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
