import { getStroke } from '../src/core/art/freehand';
import { freehandOptions, toTriples } from '../src/core/art/strokes';
import type { Stroke } from '../src/core/model/types';
import { centerPath, closedPath, outlinePath } from '../src/render/drawArt';
import { beginLiveStroke, pendingFrom, recordLiveStroke, recordPending } from '../src/render/liveStroke';
import { signedArea, type FakePath, type FakePicture } from './helpers/fakeSkia';

jest.mock('@shopify/react-native-skia', () => require('./helpers/fakeSkia'));

const stroke = (patch: Partial<Stroke>): Stroke => ({
  tool: 'gpen',
  color: '#000000',
  size: 8,
  opacity: 1,
  points: [],
  ...patch,
});

function pathOf(picture: unknown): FakePath {
  return ((picture as FakePicture).draws[0] as { path: FakePath }).path;
}

function wobble(i: number): number[] {
  return [Math.round((100 + i * 3 + Math.sin(i / 7) * 20) * 10) / 10, Math.round((100 + Math.sin(i / 11) * 80) * 10) / 10];
}

/** Feeds a stroke one point at a time and hands back the path of the last event. */
function draw(base: Stroke, count: number, point: (i: number) => number[]): { path: FakePath; live: ReturnType<typeof beginLiveStroke> } {
  const s = { ...base, points: [] as number[] };
  s.points.push(...point(0));
  const live = beginLiveStroke(s);
  let picture = recordLiveStroke(live, s);
  for (let i = 1; i < count; i++) {
    s.points.push(...point(i));
    picture = recordLiveStroke(live, s);
  }
  return { path: pathOf(picture), live };
}

describe('live stroke', () => {
  it.each([
    ['gpen', false],
    ['brush', false],
    ['gpen', true],
    ['brush', true],
  ] as const)('a sealed %s outline covers the same area as the whole path (pressure %s)', (tool, pressure) => {
    const base = stroke({ tool, pressure: pressure || undefined, size: tool === 'brush' ? 16 : 6 });
    const point = (i: number) => (pressure ? [...wobble(i), 0.3 + (i % 10) / 20] : wobble(i));
    const count = 600;
    const { path, live } = draw(base, count, point);
    expect(live.sealed).not.toBeNull();
    expect(live.sealedLeft).toBeGreaterThan(32);
    const input: number[][] = [];
    for (let i = 0; i < count; i++) {
      input.push(point(i));
    }
    const whole = outlinePath(getStroke(input, freehandOptions(base, false))) as unknown as FakePath;
    expect(signedArea(path)).toBeCloseTo(signedArea(whole), 4);
  });

  it('stays exact at every sealing boundary', () => {
    const base = stroke({ tool: 'brush', size: 16 });
    for (const count of [12, 40, 41, 90, 133, 200, 257]) {
      const { path } = draw(base, count, wobble);
      const input = Array.from({ length: count }, (_, i) => wobble(i));
      const whole = outlinePath(getStroke(input, freehandOptions(base, false))) as unknown as FakePath;
      expect(signedArea(path)).toBeCloseTo(signedArea(whole), 4);
    }
  });

  it('rebuilds only a short tail per event once sealed', () => {
    const { path, live } = draw(stroke({ size: 6 }), 800, wobble);
    const sealedVerbs = (live.sealed as unknown as FakePath).verbs.length;
    expect(path.verbs.length - sealedVerbs).toBeLessThan(120);
  });

  it.each([12, 33, 34, 35, 70, 300])('a center line of %i points equals centerPath', count => {
    const base = stroke({ tool: 'pencil' });
    const { path } = draw(base, count, wobble);
    const points = Array.from({ length: count }, (_, i) => wobble(i));
    expect(path.verbs).toEqual((centerPath(points) as unknown as FakePath).verbs);
  });

  it('keeps pressure out of a center line', () => {
    const base = stroke({ tool: 'eraser', pressure: true });
    const { path } = draw(base, 100, i => [...wobble(i), 0.5]);
    const points = Array.from({ length: 100 }, (_, i) => wobble(i));
    expect(path.verbs).toEqual((centerPath(points) as unknown as FakePath).verbs);
  });

  it.each([3, 4, 34, 35, 36, 80, 301])('a lasso of %i points equals closedPath', count => {
    const base = stroke({ tool: 'fill' });
    const { path } = draw(base, count, wobble);
    const points = Array.from({ length: count }, (_, i) => wobble(i));
    expect(path.verbs).toEqual((closedPath(points) as unknown as FakePath).verbs);
  });

  it('draws nothing for a lasso under three points', () => {
    const base = stroke({ tool: 'fill', points: [1, 2] });
    const picture = recordLiveStroke(beginLiveStroke(base), base) as unknown as FakePicture;
    expect(picture.draws).toHaveLength(0);
  });

  it('a lasso shows a thin edge as well as the fill', () => {
    const base = stroke({ tool: 'fill' });
    const s = { ...base, points: [0, 0, 10, 0, 10, 10] };
    const picture = recordLiveStroke(beginLiveStroke(s), s) as unknown as FakePicture;
    expect(picture.draws).toHaveLength(2);
  });

  it('follows a shape as its points are replaced', () => {
    const first = stroke({ tool: 'line', points: [1, 2, 3, 4] });
    const live = beginLiveStroke(first);
    const second = { ...first, points: [1, 2, 30, 40] };
    expect(pathOf(recordLiveStroke(live, second)).verbs).toEqual([
      ['move', 1, 2],
      ['line', 30, 40],
    ]);
  });

  it('pending strokes redraw through their finished path', () => {
    const s = stroke({ tool: 'pencil', points: [1, 2, 3, 4, 5, 6] });
    const live = beginLiveStroke(s);
    const pending = pendingFrom(live, s, 1, 'layer');
    expect((recordPending([pending]) as unknown as FakePicture).draws).toHaveLength(1);
    expect(toTriples(s)).toHaveLength(3);
  });
});
