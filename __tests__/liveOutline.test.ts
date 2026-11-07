import { getStroke, type StrokeOptions } from '../src/core/art/freehand';
import { addLivePoint, createLiveOutline, isBaked, readLiveOutline, readLiveTail } from '../src/core/art/liveOutline';
import { freehandOptions } from '../src/core/art/strokes';

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function walk(r: () => number, count: number, pressure: boolean): number[][] {
  let x = r() * 500;
  let y = r() * 500;
  let a = r() * 6;
  const out: number[][] = [];
  for (let i = 0; i < count; i++) {
    a += (r() - 0.5) * (r() < 0.08 ? 6 : 0.6);
    const d = r() < 0.05 ? 0 : 0.5 + r() * 10;
    x = Math.round((x + Math.cos(a) * d) * 10) / 10;
    y = Math.round((y + Math.sin(a) * d) * 10) / 10;
    out.push(pressure ? [x, y, Math.round(r() * 100) / 100] : [x, y]);
  }
  return out;
}

function checkEveryStep(input: number[][], options: StrokeOptions): void {
  const live = createLiveOutline(options);
  input.forEach((point, index) => {
    addLivePoint(live, point);
    const expected = getStroke(
      input.slice(0, index + 1).map(p => [...p]),
      options,
    );
    expect(readLiveOutline(live)).toEqual(expected);
  });
}

describe('live outline', () => {
  it('equals getStroke at every step of random strokes', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const r = rng(seed);
      const pressure = seed % 2 === 0;
      const tool = seed % 3 === 0 ? 'brush' : 'gpen';
      const size = 2 + r() * 58;
      checkEveryStep(walk(r, 80 + Math.floor(r() * 140), pressure), freehandOptions({ tool, size, pressure }, false));
    }
  });

  it('holds without tapers and with flat caps', () => {
    const r = rng(99);
    const input = walk(r, 160, false);
    checkEveryStep(input, { size: 12, thinning: 0.5, start: { cap: true }, end: { cap: true } });
    checkEveryStep(input, { size: 12, thinning: 0, start: { cap: false }, end: { cap: false } });
    checkEveryStep(input, { size: 12, thinning: 0.5, simulatePressure: false, start: { taper: 30 }, end: { taper: 0 } });
  });

  it('keeps the unbaked tail bounded on a long stroke', () => {
    const size = 6;
    const live = createLiveOutline(freehandOptions({ tool: 'gpen', size }, false));
    for (let i = 0; i < 3000; i++) {
      addLivePoint(live, [i * 3, Math.sin(i / 9) * 40]);
    }
    expect(isBaked(live)).toBe(true);
    const tail = readLiveTail(live);
    expect(tail.tailLeft.length + tail.tailRight.length).toBeLessThan(40);
    expect(live.left.length).toBeGreaterThan(200);
  });

  it('never rewrites a baked point', () => {
    const r = rng(7);
    const input = walk(r, 300, true);
    const live = createLiveOutline(freehandOptions({ tool: 'brush', size: 16, pressure: true }, false));
    let seen: number[][] = [];
    input.forEach(point => {
      addLivePoint(live, point);
      expect(live.left.slice(0, seen.length)).toEqual(seen);
      seen = live.left.map(p => [...p]);
    });
  });
});
