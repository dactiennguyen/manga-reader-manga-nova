import type { Divider } from '../src/core/layout/layout';
import { hitHandle } from '../src/core/layout/pageEdit';
import {
  HANDLE_HIT_DP,
  HOME_VIEW,
  clampView,
  clampZoom,
  fitScale,
  insidePage,
  pageFrame,
  swipeStep,
  toPagePoint,
} from '../src/core/layout/pageView';

const box = { w: 400, h: 600 };
const size = { w: 1000, h: 1414 };

describe('workspace maths', () => {
  it('fits a page inside the padded box, and a webtoon strip by width only', () => {
    expect(fitScale(box, size, false)).toBeCloseTo(0.368);
    expect(fitScale(box, { w: 1000, h: 8000 }, true)).toBeCloseTo(0.2944);
    expect(fitScale({ w: 0, h: 0 }, size, false)).toBe(0);
  });

  it('turns a screen point into a page point and back', () => {
    const fit = fitScale(box, size, false);
    const frame = pageFrame(box, size, { scale: 2, tx: 10, ty: -20 }, fit, false);
    const p = toPagePoint(frame, 200, 300);
    expect(p.x * frame.k + frame.ox).toBeCloseTo(200);
    expect(p.y * frame.k + frame.oy).toBeCloseTo(300);
  });

  it('keeps the page within 40dp of the edge of the view, at any zoom', () => {
    const fit = fitScale(box, size, false);
    const fitted = clampView({ ...HOME_VIEW, tx: 500, ty: 500 }, box, size, fit, false);
    expect(fitted.tx).toBeCloseTo((size.w * fit - box.w) / 2 + 40);
    expect(fitted.ty).toBeCloseTo((size.h * fit - box.h) / 2 + 40);
    const zoomed = clampView({ scale: 3, tx: 9999, ty: -9999 }, box, size, fit, false);
    expect(zoomed.tx).toBeCloseTo((size.w * fit * 3 - box.w) / 2 + 40);
    expect(zoomed.ty).toBeCloseTo(-((size.h * fit * 3 - box.h) / 2 + 40));
  });

  it('only lets a webtoon zoom out below 1', () => {
    expect(clampZoom(0.2, false)).toBe(1);
    expect(clampZoom(0.2, true)).toBe(0.4);
    expect(clampZoom(50, false)).toBe(6);
  });

  it('knows the page edges', () => {
    expect(insidePage({ x: 0, y: size.h }, size)).toBe(true);
    expect(insidePage({ x: -1, y: 0 }, size)).toBe(false);
  });
});

describe('page swipe', () => {
  it('follows the reading direction', () => {
    expect(swipeStep(100, 0, true)).toBe(1);
    expect(swipeStep(-100, 0, true)).toBe(-1);
    expect(swipeStep(100, 0, false)).toBe(-1);
    expect(swipeStep(-100, 0, false)).toBe(1);
  });

  it('ignores short and mostly vertical swipes', () => {
    expect(swipeStep(60, 0, true)).toBe(0);
    expect(swipeStep(100, 120, true)).toBe(0);
  });
});

describe('divider handle hit area', () => {
  const divider: Divider = {
    splitId: 's',
    dir: 'v',
    a: { x: 500, y: 0 },
    b: { x: 500, y: 1000 },
    bb: { x: 0, y: 0, w: 1000, h: 1000 },
    t0: 0.5,
    t1: 0.5,
  };

  it('is 24dp on screen at every zoom', () => {
    expect(HANDLE_HIT_DP).toBe(24);
    for (const k of [0.25, 0.5, 2, 4]) {
      const radius = HANDLE_HIT_DP / k;
      expect(hitHandle([divider], { x: 500 + 23 / k, y: 500 }, radius)?.kind).toBe('mid');
      expect(hitHandle([divider], { x: 500 + 25 / k, y: 500 }, radius)).toBeNull();
    }
  });
});
